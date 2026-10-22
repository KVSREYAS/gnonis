import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import YAML from "yaml";
import { z } from "zod";
import { getSim } from "@/lib/sims";
import {
  CourseSchema,
  LessonFrontmatterSchema,
  ModuleSchema,
  parseLessonBody,
  type Exercise,
} from "./schema";
import type { CourseData, LessonData, ModuleData } from "./types";

export type ContentIssue = { file: string; message: string };

export const DEFAULT_CONTENT_ROOT = path.join(process.cwd(), "content", "courses");
const SLUG = /^[a-z0-9-]+$/;

function formatZod(err: z.ZodError): string[] {
  return err.issues.map((i) => `${i.path.length ? i.path.join(".") + ": " : ""}${i.message}`);
}

function readYaml(file: string, issues: ContentIssue[]): unknown {
  try {
    return YAML.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    issues.push({ file, message: `cannot parse YAML: ${(e as Error).message}` });
    return undefined;
  }
}

function checkSimReferences(id: string, ex: Exercise, file: string, issues: ContentIssue[]) {
  if (ex.type !== "simulator") return;
  const sim = getSim(ex.sim);
  if (!sim) {
    issues.push({ file, message: `exercises.${id}: unknown sim "${ex.sim}"` });
    return;
  }
  const sliderIds = new Set(sim.sliders.map((s) => s.id));
  for (const key of [...Object.keys(ex.params ?? {}), ...(ex.locked ?? [])])
    if (!sliderIds.has(key)) issues.push({ file, message: `exercises.${id}: sim "${ex.sim}" has no slider "${key}"` });
  for (const [key, value] of Object.entries(ex.params ?? {})) {
    const s = sim.sliders.find((x) => x.id === key);
    if (s?.options && !s.options.some((o) => o.value === value))
      issues.push({ file, message: `exercises.${id}: ${key}=${value} is not one of ${s.options.map((o) => o.value).join(", ")}` });
  }
  if (ex.goal && !sim.outputs.some((o) => o.id === ex.goal!.output))
    issues.push({ file, message: `exercises.${id}: sim "${ex.sim}" has no output "${ex.goal.output}"` });
}

export function loadLesson(
  file: string,
  ids: { courseSlug: string; moduleSlug: string; slug: string; index: number },
  issues: ContentIssue[],
): LessonData | undefined {
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(fs.readFileSync(file, "utf8"));
  } catch (e) {
    issues.push({ file, message: `cannot parse frontmatter: ${(e as Error).message}` });
    return undefined;
  }
  const fm = LessonFrontmatterSchema.safeParse(parsed.data);
  if (!fm.success) {
    for (const m of formatZod(fm.error)) issues.push({ file, message: m });
    return undefined;
  }
  const { blocks, errors } = parseLessonBody(parsed.content);
  for (const m of errors) issues.push({ file, message: m });

  const exercises = fm.data.exercises;
  const used = new Map<string, number>();
  for (const b of blocks) if (b.kind === "exercise") used.set(b.id, (used.get(b.id) ?? 0) + 1);
  for (const [id, n] of used) {
    if (!exercises[id]) issues.push({ file, message: `<Exercise id="${id}" /> has no matching entry in frontmatter.exercises` });
    if (n > 1) issues.push({ file, message: `exercise "${id}" is placed ${n} times` });
  }
  for (const id of Object.keys(exercises)) {
    if (!used.has(id)) issues.push({ file, message: `exercise "${id}" is declared but never placed in the body` });
    checkSimReferences(id, exercises[id], file, issues);
  }
  if (!blocks.some((b) => b.kind === "card")) issues.push({ file, message: "lesson needs at least one card" });
  if (fm.data.kind === "boss" && !Object.values(exercises).some((e) => e.type === "boss"))
    issues.push({ file, message: 'kind: boss lessons need a "boss" exercise' });

  return {
    ...ids,
    title: fm.data.title,
    kind: fm.data.kind,
    summary: fm.data.summary,
    xp: fm.data.xp,
    minutes: fm.data.minutes ?? Math.max(2, Math.round(blocks.length * 1.5)),
    keyIdeas: fm.data.keyIdeas,
    blocks,
    exercises,
  };
}

export function loadCourse(dir: string, issues: ContentIssue[]): CourseData | undefined {
  const courseSlug = path.basename(dir);
  if (!SLUG.test(courseSlug)) issues.push({ file: dir, message: "course folder name must be kebab-case" });
  const courseFile = path.join(dir, "course.yaml");
  if (!fs.existsSync(courseFile)) {
    issues.push({ file: courseFile, message: "missing course.yaml" });
    return undefined;
  }
  const meta = CourseSchema.safeParse(readYaml(courseFile, issues));
  if (!meta.success) {
    for (const m of formatZod(meta.error)) issues.push({ file: courseFile, message: m });
    return undefined;
  }

  const modules: ModuleData[] = [];
  meta.data.modules.forEach((moduleSlug, mi) => {
    const mdir = path.join(dir, "modules", moduleSlug);
    const mfile = path.join(mdir, "module.yaml");
    if (!fs.existsSync(mfile)) {
      issues.push({ file: mfile, message: `module "${moduleSlug}" is listed in course.yaml but has no module.yaml` });
      return;
    }
    const m = ModuleSchema.safeParse(readYaml(mfile, issues));
    if (!m.success) {
      for (const msg of formatZod(m.error)) issues.push({ file: mfile, message: msg });
      return;
    }
    if (m.data.status === "stub" && m.data.lessons.length)
      issues.push({ file: mfile, message: "stub modules must not list lessons (set status: ready)" });
    const lessons: LessonData[] = [];
    m.data.lessons.forEach((slug, li) => {
      const lfile = path.join(mdir, "lessons", `${slug}.mdx`);
      if (!fs.existsSync(lfile)) {
        issues.push({ file: lfile, message: `lesson "${slug}" is listed in module.yaml but the file is missing` });
        return;
      }
      const lesson = loadLesson(lfile, { courseSlug, moduleSlug, slug, index: li }, issues);
      if (lesson) lessons.push(lesson);
    });
    const ldir = path.join(mdir, "lessons");
    if (fs.existsSync(ldir))
      for (const f of fs.readdirSync(ldir))
        if (f.endsWith(".mdx") && !m.data.lessons.includes(f.replace(/\.mdx$/, "")))
          issues.push({ file: path.join(ldir, f), message: "lesson file is not listed in module.yaml" });
    modules.push({ slug: moduleSlug, courseSlug, index: mi + 1, ...m.data, lessons });
  });

  return { slug: courseSlug, ...meta.data, modules };
}

export function loadAllCourses(root = DEFAULT_CONTENT_ROOT): { courses: CourseData[]; issues: ContentIssue[] } {
  const issues: ContentIssue[] = [];
  if (!fs.existsSync(root)) return { courses: [], issues: [{ file: root, message: "content root not found" }] };
  const courses = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => loadCourse(path.join(root, d.name), issues))
    .filter((c): c is CourseData => !!c)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  return { courses, issues };
}

let cache: CourseData[] | undefined;

/** Loads and validates every course. Throws on invalid content so a bad pack fails the build. */
export function getCourses(): CourseData[] {
  if (cache && process.env.NODE_ENV === "production") return cache;
  const { courses, issues } = loadAllCourses();
  if (issues.length) {
    const lines = issues.map((i) => `  ${path.relative(process.cwd(), i.file)}: ${i.message}`).join("\n");
    throw new Error(`Invalid course content:\n${lines}\nRun "npm run validate-content" for details.`);
  }
  cache = courses;
  return courses;
}

export function getCourse(slug: string) {
  return getCourses().find((c) => c.slug === slug);
}

export function getModule(courseSlug: string, moduleSlug: string) {
  return getCourse(courseSlug)?.modules.find((m) => m.slug === moduleSlug);
}

export function getLesson(courseSlug: string, moduleSlug: string, lessonSlug: string) {
  return getModule(courseSlug, moduleSlug)?.lessons.find((l) => l.slug === lessonSlug);
}
