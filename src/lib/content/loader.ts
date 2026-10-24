import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import YAML from "yaml";
import { z } from "zod";
import { exerciseContentHash } from "@/lib/content/hash";
import { exerciseTypeForTag, EXERCISE_TAGS, ExerciseSchema, type Exercise } from "@/exercises/schema";
import { getSim } from "@/lib/sims";
import { parseLessonSource } from "./mdx";
import { ArtSchema, CourseSchema, LessonFrontmatterSchema, type Art, type CourseMeta, type DistrictMeta } from "./schema";
import type { CourseData, LessonData, ModuleData } from "./types";

export type ContentIssue = { file: string; message: string };

export const DEFAULT_CONTENT_ROOT = path.join(process.cwd(), "content", "courses");
const SLUG = /^[a-z0-9-]+$/;
const LESSON_FILE = /^(\d+)-([a-z0-9-]+)\.mdx$/;

function formatZod(err: z.ZodError): string[] {
  return err.issues.map((i) => `${i.path.length ? i.path.join(".") + ": " : ""}${i.message}`);
}

function readYaml(file: string, issues: ContentIssue[]): unknown {
  try {
    return YAML.parse(fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8"));
  } catch (e) {
    issues.push({ file, message: `cannot parse YAML: ${(e as Error).message}` });
    return undefined;
  }
}

function checkSimReferences(id: string, ex: Exercise, file: string, issues: ContentIssue[]) {
  if (ex.type !== "simulator") return;
  const sim = getSim(ex.sim);
  if (!sim) {
    issues.push({ file, message: `exercise "${id}": unknown sim "${ex.sim}"` });
    return;
  }
  const sliderIds = new Set(sim.sliders.map((s) => s.id));
  for (const key of [...Object.keys(ex.params ?? {}), ...(ex.locked ?? [])])
    if (!sliderIds.has(key)) issues.push({ file, message: `exercise "${id}": sim "${ex.sim}" has no slider "${key}"` });
  for (const [key, value] of Object.entries(ex.params ?? {})) {
    const s = sim.sliders.find((x) => x.id === key);
    if (s?.options && !s.options.some((o) => o.value === value))
      issues.push({ file, message: `exercise "${id}": ${key}=${value} is not one of ${s.options.map((o) => o.value).join(", ")}` });
    else if (s && !s.options && ((s.min !== undefined && value < s.min) || (s.max !== undefined && value > s.max)))
      issues.push({ file, message: `exercise "${id}": ${key}=${value} is outside ${s.min}..${s.max}` });
  }
  if (ex.goal && !sim.outputs.some((o) => o.id === ex.goal!.output))
    issues.push({ file, message: `exercise "${id}": sim "${ex.sim}" has no output "${ex.goal.output}"` });
}

function lessonFiles(dir: string): { file: string; nn: string; slug: string }[] {
  if (!fs.existsSync(/*turbopackIgnore: true*/ dir)) return [];
  return fs
    .readdirSync(/*turbopackIgnore: true*/ dir)
    .map((name) => {
      const m = name.match(LESSON_FILE);
      return m ? { file: path.join(dir, name), nn: m[1], slug: m[2] } : null;
    })
    .filter((x): x is { file: string; nn: string; slug: string } => !!x);
}

function syntheticDistrict(meta: CourseMeta): DistrictMeta {
  const art = ArtSchema.safeParse(meta.cover);
  return {
    id: "missions",
    title: meta.title,
    district: "Missions",
    summary: meta.description,
    tip: "TIP: One mission at a time.",
    art: (art.success ? art.data : "skyline") as Art,
    status: "ready",
    lessons: meta.lessons,
  };
}

export function loadLessonFile(
  file: string,
  ids: { courseId: string; courseSlug: string; moduleSlug: string; contentSlug: string; index: number },
  issues: ContentIssue[],
): LessonData | undefined {
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8"));
  } catch (e) {
    issues.push({ file, message: `cannot parse frontmatter: ${(e as Error).message}` });
    return undefined;
  }
  const fm = LessonFrontmatterSchema.safeParse(parsed.data);
  if (!fm.success) {
    for (const m of formatZod(fm.error)) issues.push({ file, message: m });
    return undefined;
  }
  const source = parseLessonSource(parsed.content, EXERCISE_TAGS);
  for (const m of source.errors) issues.push({ file, message: m });

  const exercises: Record<string, Exercise> = {};
  const exerciseHashes: Record<string, string> = {};
  const seen = new Set<string>();
  for (const raw of source.exercises) {
    if (seen.has(raw.id)) issues.push({ file, message: `exercise id "${raw.id}" is used more than once` });
    seen.add(raw.id);
    const type = exerciseTypeForTag(raw.tag);
    if (!type) {
      issues.push({ file, message: `line ${raw.line}: unknown exercise component <${raw.tag}>` });
      continue;
    }
    const parsedEx = ExerciseSchema.safeParse({ type, ...raw.props });
    if (!parsedEx.success) {
      for (const m of formatZod(parsedEx.error)) issues.push({ file, message: `exercise "${raw.id}": ${m}` });
      continue;
    }
    exercises[raw.id] = parsedEx.data;
    exerciseHashes[raw.id] = exerciseContentHash(parsedEx.data);
    checkSimReferences(raw.id, parsedEx.data, file, issues);
  }

  const placed = source.blocks.filter((b) => b.kind === "exercise").map((b) => b.id);
  for (const id of placed) if (!exercises[id] && !source.errors.some((e) => e.includes(id))) {
    /* schema errors already reported */
  }
  if (!source.blocks.some((b) => b.kind === "card")) issues.push({ file, message: "lesson needs at least one card" });
  if (fm.data.kind === "boss" && !Object.values(exercises).some((e) => e.type === "boss"))
    issues.push({ file, message: 'kind: boss lessons need a <Boss /> exercise' });

  const parts = fm.data.id.split("/");
  const urlSlug = parts.length >= 3 && parts[0] === ids.courseId && parts[1] === ids.moduleSlug ? parts[2] : ids.contentSlug;

  return {
    id: fm.data.id,
    contentSlug: ids.contentSlug,
    slug: urlSlug,
    courseSlug: ids.courseSlug,
    moduleSlug: ids.moduleSlug,
    index: ids.index,
    title: fm.data.title,
    kind: fm.data.kind,
    summary: fm.data.missionIntro,
    xp: fm.data.xp,
    minutes: fm.data.estMinutes,
    keyIdeas: fm.data.keyIdeas ?? [fm.data.missionIntro],
    blocks: source.blocks,
    exercises,
    exerciseHashes,
  };
}

export function loadCourse(dir: string, issues: ContentIssue[]): CourseData | undefined {
  const courseSlug = path.basename(dir);
  if (!SLUG.test(courseSlug)) issues.push({ file: dir, message: "course folder name must be kebab-case" });
  const courseFile = path.join(dir, "course.yaml");
  if (!fs.existsSync(/*turbopackIgnore: true*/ courseFile)) {
    issues.push({ file: courseFile, message: "missing course.yaml" });
    return undefined;
  }
  const meta = CourseSchema.safeParse(readYaml(courseFile, issues));
  if (!meta.success) {
    for (const m of formatZod(meta.error)) issues.push({ file: courseFile, message: m });
    return undefined;
  }
  if (!ArtSchema.safeParse(meta.data.cover).success) {
    const coverPath = path.join(dir, meta.data.cover);
    if (!fs.existsSync(/*turbopackIgnore: true*/ coverPath))
      issues.push({ file: courseFile, message: `cover "${meta.data.cover}" is not an art name or a file in the course` });
  }

  const lessonsDir = path.join(dir, "lessons");
  const files = lessonFiles(lessonsDir);
  const bySlug = new Map<string, { file: string; nn: string }>();
  for (const f of files) {
    if (bySlug.has(f.slug)) issues.push({ file: f.file, message: `two lesson files use the slug "${f.slug}"` });
    bySlug.set(f.slug, f);
  }
  if (fs.existsSync(/*turbopackIgnore: true*/ lessonsDir)) {
    for (const name of fs.readdirSync(/*turbopackIgnore: true*/ lessonsDir)) {
      if (name.startsWith(".")) continue;
      const full = path.join(lessonsDir, name);
      if (!fs.statSync(/*turbopackIgnore: true*/ full).isFile()) continue;
      if (!LESSON_FILE.test(name)) issues.push({ file: full, message: "lesson files must be named <nn>-<slug>.mdx" });
      else if (!meta.data.lessons.includes(name.match(LESSON_FILE)![2]))
        issues.push({ file: full, message: "lesson file is not listed in course.yaml lessons" });
    }
  }

  const districts = meta.data.districts?.length ? meta.data.districts : [syntheticDistrict(meta.data)];
  const lessonsBySlug = new Map<string, LessonData>();
  meta.data.lessons.forEach((contentSlug) => {
    const found = bySlug.get(contentSlug);
    if (!found) {
      issues.push({ file: path.join(lessonsDir, `<nn>-${contentSlug}.mdx`), message: `lesson "${contentSlug}" is listed in course.yaml but the file is missing` });
      return;
    }
  });

  const modules: ModuleData[] = [];
  districts.forEach((district, mi) => {
    const lessons: LessonData[] = [];
    district.lessons.forEach((contentSlug, li) => {
      const found = bySlug.get(contentSlug);
      if (!found) return;
      const lesson = loadLessonFile(
        found.file,
        { courseId: meta.data.id, courseSlug, moduleSlug: district.id, contentSlug, index: li },
        issues,
      );
      if (!lesson) return;
      if (lessonsBySlug.has(lesson.id)) issues.push({ file: found.file, message: `duplicate lesson id "${lesson.id}"` });
      lessonsBySlug.set(lesson.id, lesson);
      lessons.push(lesson);
    });
    modules.push({
      slug: district.id,
      courseSlug,
      index: mi + 1,
      title: district.title,
      district: district.district,
      summary: district.summary,
      tip: district.tip,
      art: district.art,
      status: district.status,
      lessons,
    });
  });

  return {
    slug: courseSlug,
    id: meta.data.id,
    title: meta.data.title,
    description: meta.data.description,
    order: meta.data.order,
    cover: meta.data.cover,
    prerequisites: meta.data.prerequisites,
    tagline: meta.data.tagline ?? "",
    level: meta.data.level,
    modules,
  };
}

export function loadAllCourses(root = DEFAULT_CONTENT_ROOT): { courses: CourseData[]; issues: ContentIssue[] } {
  const issues: ContentIssue[] = [];
  if (!fs.existsSync(/*turbopackIgnore: true*/ root)) return { courses: [], issues: [{ file: root, message: "content root not found" }] };
  const courses = fs
    .readdirSync(/*turbopackIgnore: true*/ root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => loadCourse(path.join(/*turbopackIgnore: true*/ root, d.name), issues))
    .filter((c): c is CourseData => !!c)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

  const courseIds = new Map<string, string>();
  const lessonIds = new Map<string, string>();
  const exerciseIds = new Map<string, string>();
  for (const c of courses) {
    if (courseIds.has(c.id)) issues.push({ file: c.slug, message: `duplicate course id "${c.id}"` });
    courseIds.set(c.id, c.slug);
    for (const pre of c.prerequisites)
      if (!courses.some((other) => other.id === pre))
        issues.push({ file: c.slug, message: `prerequisite "${pre}" is not a course id` });
    for (const m of c.modules)
      for (const l of m.lessons) {
        if (lessonIds.has(l.id)) issues.push({ file: `${c.slug}/${l.contentSlug}`, message: `duplicate lesson id "${l.id}"` });
        lessonIds.set(l.id, l.contentSlug);
        for (const ex of Object.keys(l.exercises)) {
          const key = `${l.id}#${ex}`;
          if (exerciseIds.has(key)) issues.push({ file: key, message: `duplicate exercise id "${key}"` });
          exerciseIds.set(key, key);
        }
      }
  }
  const prereqCycle = findCycle(courses.map((c) => [c.id, c.prerequisites] as const));
  if (prereqCycle) issues.push({ file: root, message: `prerequisite cycle: ${prereqCycle.join(" -> ")}` });
  if (path.resolve(/*turbopackIgnore: true*/ root) === path.resolve(/*turbopackIgnore: true*/ DEFAULT_CONTENT_ROOT)) checkDiagrams(courses, issues);

  return { courses, issues };
}

function walkPngs(dir: string, out: string[]) {
  if (!fs.existsSync(/*turbopackIgnore: true*/ dir)) return;
  for (const name of fs.readdirSync(/*turbopackIgnore: true*/ dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(/*turbopackIgnore: true*/ full).isDirectory()) walkPngs(full, out);
    else if (name.endsWith(".png")) out.push(full);
  }
}

/** Every shipped diagram is used, and every image a lesson points at exists. */
function checkDiagrams(courses: CourseData[], issues: ContentIssue[]) {
  const publicDir = path.join(process.cwd(), "public");
  const referenced = new Set<string>();
  for (const c of courses)
    for (const m of c.modules)
      for (const l of m.lessons)
        for (const b of l.blocks) {
          if (b.kind !== "card") continue;
          for (const match of b.markdown.matchAll(/!\[[^\]]*\]\((\/diagrams\/[^)\s]+)\)/g)) referenced.add(match[1]);
        }
  const files: string[] = [];
  walkPngs(path.join(publicDir, "diagrams"), files);
  for (const file of files) {
    const url = `/${path.relative(publicDir, file).split(path.sep).join("/")}`;
    if (!referenced.has(url)) issues.push({ file, message: `diagram is not referenced by any lesson: ${url}` });
  }
  for (const url of referenced) {
    const file = path.join(publicDir, url.slice(1));
    if (!fs.existsSync(/*turbopackIgnore: true*/ file)) issues.push({ file: url, message: `lesson references a missing diagram ${url}` });
  }
}

function findCycle(edges: readonly (readonly [string, readonly string[]])[]): string[] | null {
  const adj = new Map(edges);
  const color = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  function visit(id: string): string[] | null {
    const state = color.get(id) ?? 0;
    if (state === 1) return [...stack.slice(stack.indexOf(id)), id];
    if (state === 2) return null;
    color.set(id, 1);
    stack.push(id);
    for (const next of adj.get(id) ?? []) {
      const hit = visit(next);
      if (hit) return hit;
    }
    stack.pop();
    color.set(id, 2);
    return null;
  }
  for (const [id] of edges) {
    const hit = visit(id);
    if (hit) return hit;
  }
  return null;
}

let cache: CourseData[] | undefined;

/** Loads and validates every course. Throws on invalid content so a bad pack fails the build. */
export function getCourses(): CourseData[] {
  if (cache && process.env.NODE_ENV === "production") return cache;
  const { courses, issues } = loadAllCourses();
  if (issues.length) {
    const lines = issues.map((i) => `  ${path.relative(process.cwd(), i.file)}: ${i.message}`).join("\n");
    throw new Error(`Invalid course content:\n${lines}\nRun "npm run validate:content" for details.`);
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

/** Preview routes address a lesson by its authoring slug or its URL slug. */
export function getLessonBySlug(courseSlug: string, lessonSlug: string) {
  const course = getCourse(courseSlug);
  if (!course) return undefined;
  for (const mod of course.modules) {
    const lesson = mod.lessons.find((l) => l.contentSlug === lessonSlug || l.slug === lessonSlug);
    if (lesson) return { course, mod, lesson };
  }
  return undefined;
}
