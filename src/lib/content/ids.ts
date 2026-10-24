import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import YAML from "yaml";
import type { CourseData } from "./types";
import { loadAllCourses } from "./loader";
import { renameExerciseId, renameLessonId, type RenameMap } from "@/lib/progress/rename-map";
import type { RetiredIds } from "./renames";

export type IdSet = { courses: Set<string>; lessons: Set<string>; exercises: Set<string> };

export function emptyIds(): IdSet {
  return { courses: new Set(), lessons: new Set(), exercises: new Set() };
}

export function idsFromCourses(courses: CourseData[]): IdSet {
  const ids = emptyIds();
  for (const c of courses) {
    ids.courses.add(c.id);
    for (const m of c.modules)
      for (const l of m.lessons) {
        ids.lessons.add(l.id);
        for (const ex of Object.keys(l.exercises)) ids.exercises.add(`${l.id}#${ex}`);
      }
  }
  return ids;
}

function readYaml(file: string): Record<string, unknown> {
  return (YAML.parse(fs.readFileSync(file, "utf8")) ?? {}) as Record<string, unknown>;
}

/** Ids from a course tree that still uses modules/ and frontmatter exercises. */
export function collectLegacyIds(root: string): IdSet {
  const ids = emptyIds();
  if (!fs.existsSync(root)) return ids;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const courseSlug = entry.name;
    ids.courses.add(courseSlug);
    const courseYaml = readYaml(path.join(root, courseSlug, "course.yaml"));
    const modules = Array.isArray(courseYaml.modules) ? (courseYaml.modules as string[]) : [];
    for (const moduleSlug of modules) {
      const modFile = path.join(root, courseSlug, "modules", moduleSlug, "module.yaml");
      if (!fs.existsSync(modFile)) continue;
      const mod = readYaml(modFile);
      const lessons = Array.isArray(mod.lessons) ? (mod.lessons as string[]) : [];
      for (const lessonSlug of lessons) {
        const lessonId = `${courseSlug}/${moduleSlug}/${lessonSlug}`;
        ids.lessons.add(lessonId);
        const lessonFile = path.join(root, courseSlug, "modules", moduleSlug, "lessons", `${lessonSlug}.mdx`);
        if (!fs.existsSync(lessonFile)) continue;
        const fm = matter(fs.readFileSync(lessonFile, "utf8")).data as { exercises?: Record<string, unknown> };
        for (const exId of Object.keys(fm.exercises ?? {})) ids.exercises.add(`${lessonId}#${exId}`);
      }
    }
  }
  return ids;
}

/** Ids from whichever layout is on disk. New packs go through the loader; old packs use the legacy reader. */
export function collectIdsFromRoot(root: string): IdSet {
  if (!fs.existsSync(root)) return emptyIds();
  const dirs = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory());
  const legacy = dirs.some((d) => {
    const file = path.join(root, d.name, "course.yaml");
    if (!fs.existsSync(file)) return false;
    const meta = readYaml(file);
    return Array.isArray(meta.modules) && !Array.isArray(meta.lessons);
  });
  if (legacy) return collectLegacyIds(root);
  return idsFromCourses(loadAllCourses(root).courses);
}

export function diffVanished(previous: IdSet, current: IdSet, retired: RetiredIds, renames: RenameMap): string[] {
  const errors: string[] = [];
  const kinds = ["courses", "lessons", "exercises"] as const;
  const rewrite = {
    courses: (id: string) => renames.courses[id] ?? id,
    lessons: (id: string) => renameLessonId(id, renames),
    exercises: (id: string) => renameExerciseId(id, renames),
  };
  for (const kind of kinds) {
    const prev = previous[kind];
    const cur = current[kind];
    const retiredList = retired[kind];
    const explicit = renames[kind];
    for (const id of prev) {
      if (cur.has(id)) continue;
      if (retiredList.includes(id)) continue;
      const next = rewrite[kind](id);
      if (next !== id && cur.has(next)) continue;
      errors.push(`${kind} id vanished: ${id}`);
    }
    for (const id of retiredList) {
      if (cur.has(id)) errors.push(`${kind} id ${id} is listed as retired but still in content`);
      else if (!prev.has(id)) errors.push(`${kind} retired id ${id} is not an id on main`);
    }
    for (const [from, to] of Object.entries(explicit)) {
      if (from === to) errors.push(`${kind} rename ${from} does not change the id`);
      if (cur.has(from)) errors.push(`${kind} rename source ${from} is still in content`);
      if (!prev.has(from)) errors.push(`${kind} rename source ${from} is not an id on main`);
      if (!cur.has(to)) errors.push(`${kind} rename target ${to} is not in content`);
    }
  }
  return errors;
}
