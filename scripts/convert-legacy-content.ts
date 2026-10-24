/**
 * Converts courses that still use content/courses/<slug>/modules/... into the flat layout
 * (course.yaml + lessons/<nn>-<slug>.mdx + assets/). Safe to re-run:
 *
 * - A course with no modules/ directory is left alone.
 * - Legacy lessons are rewritten in place. Their progress ids stay
 *   `<course>/<module>/<old-file-slug>#<exercise-id>`.
 * - Lessons that already exist only in the flat layout (no legacy twin) are kept,
 *   so a re-run after this migration does not drop hand-added lessons.
 * - Markdown is copied through, including mission briefings and diagram images.
 *   `<Exercise id="..." />` becomes a self-closing component such as `<MCQ id="..." />`.
 *
 *   npm run convert:legacy
 *   npm run convert:legacy -- content/courses
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import YAML from "yaml";

const TAGS: Record<string, string> = {
  mcq: "MCQ",
  fill: "Fill",
  ordering: "Ordering",
  predict: "Predict",
  simulator: "Simulator",
  stepper: "Stepper",
  code: "Code",
  debug: "Debug",
  boss: "Boss",
};

type LegacyLesson = {
  id: string;
  moduleSlug: string;
  fileSlug: string;
  contentSlug: string;
  body: string;
};

type KeptLesson = {
  id: string;
  contentSlug: string;
  moduleSlug: string;
  raw: string;
};

function jsxProp(name: string, value: unknown): string {
  if (typeof value === "string" && value.length > 0 && value.length < 120 && !/[\n\r"\\<>{}]/.test(value))
    return `${name}=${JSON.stringify(value)}`;
  return `${name}={${JSON.stringify(value)}}`;
}

function toComponent(id: string, ex: Record<string, unknown>): string {
  const tag = TAGS[String(ex.type)];
  if (!tag) throw new Error(`unknown exercise type "${String(ex.type)}" on ${id}`);
  const props: Record<string, unknown> = { id };
  for (const [key, value] of Object.entries(ex)) if (key !== "type" && value !== undefined) props[key] = value;
  const lines = Object.entries(props).map(([key, value]) => `  ${jsxProp(key, value)}`);
  return `<${tag}\n${lines.join("\n")}\n/>`;
}

function contentSlugOf(fileSlug: string): string {
  const m = fileSlug.match(/^\d+-(.+)$/);
  if (!m || !/^[a-z0-9-]+$/.test(m[1])) throw new Error(`lesson file "${fileSlug}" must look like 01-some-slug`);
  return m[1];
}

function estMinutes(body: string, exercises: number, explicit?: number): number {
  if (typeof explicit === "number" && explicit > 0) return Math.min(90, Math.round(explicit));
  const words = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<Exercise\b[^>]*\/>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(2, Math.min(90, Math.round(words / 180 + exercises * 0.75)));
}

function convertBody(body: string, exercises: Record<string, Record<string, unknown>>, file: string): string {
  const used = new Set<string>();
  const next = body.replace(/<Exercise\s+id=(?:"([^"]+)"|'([^']+)')\s*\/>/g, (full, a: string, b: string) => {
    const id = a || b;
    const ex = exercises[id];
    if (!ex) throw new Error(`${file}: <Exercise id="${id}" /> has no frontmatter entry`);
    if (used.has(id)) throw new Error(`${file}: exercise "${id}" is placed more than once`);
    used.add(id);
    return toComponent(id, ex);
  });
  for (const id of Object.keys(exercises)) if (!used.has(id)) throw new Error(`${file}: exercise "${id}" is never placed`);
  if (next.includes("<Exercise")) throw new Error(`${file}: an <Exercise> tag was not converted`);
  const before = body.match(/!\[[^\]]*\]\([^)]+\)/g) ?? [];
  const after = next.match(/!\[[^\]]*\]\([^)]+\)/g) ?? [];
  if (before.join("\n") !== after.join("\n")) throw new Error(`${file}: diagram or image markup changed during conversion`);
  return next.trim() + "\n";
}

function readLegacy(courseDir: string, courseSlug: string): { meta: Record<string, unknown>; lessons: LegacyLesson[]; districts: Record<string, unknown>[] } | null {
  const modulesDir = path.join(courseDir, "modules");
  if (!fs.existsSync(modulesDir)) return null;
  const courseYaml = YAML.parse(fs.readFileSync(path.join(courseDir, "course.yaml"), "utf8")) as Record<string, unknown>;
  const moduleSlugs = Array.isArray(courseYaml.modules) ? (courseYaml.modules as string[]) : [];
  if (moduleSlugs.length === 0 && !fs.readdirSync(modulesDir).length) return null;
  const lessons: LegacyLesson[] = [];
  const districts: Record<string, unknown>[] = [];
  for (const moduleSlug of moduleSlugs) {
    const mfile = path.join(modulesDir, moduleSlug, "module.yaml");
    const mod = YAML.parse(fs.readFileSync(mfile, "utf8")) as Record<string, unknown>;
    const listed = Array.isArray(mod.lessons) ? (mod.lessons as string[]) : [];
    const slugs: string[] = [];
    for (const fileSlug of listed) {
      const file = path.join(modulesDir, moduleSlug, "lessons", `${fileSlug}.mdx`);
      const raw = fs.readFileSync(file, "utf8");
      const parsed = matter(raw);
      const data = parsed.data as Record<string, unknown>;
      const exercises = (data.exercises ?? {}) as Record<string, Record<string, unknown>>;
      const contentSlug = contentSlugOf(fileSlug);
      const id = `${courseSlug}/${moduleSlug}/${fileSlug}`;
      const body = convertBody(parsed.content, exercises, file);
      const fm: Record<string, unknown> = {
        id,
        title: data.title,
        estMinutes: estMinutes(parsed.content, Object.keys(exercises).length, typeof data.minutes === "number" ? data.minutes : undefined),
        xp: data.xp,
        missionIntro: data.summary,
      };
      if (data.kind === "boss") fm.kind = "boss";
      if (data.keyIdeas) fm.keyIdeas = data.keyIdeas;
      lessons.push({
        id,
        moduleSlug,
        fileSlug,
        contentSlug,
        body: `---\n${YAML.stringify(fm).trimEnd()}\n---\n\n${body}`,
      });
      slugs.push(contentSlug);
    }
    districts.push({
      id: moduleSlug,
      title: mod.title,
      district: mod.district,
      summary: mod.summary,
      tip: mod.tip,
      ...(mod.art ? { art: mod.art } : {}),
      ...(mod.status ? { status: mod.status } : {}),
      ...(slugs.length ? { lessons: slugs } : {}),
    });
  }
  return { meta: courseYaml, lessons, districts };
}

function readKept(courseDir: string, legacyIds: Set<string>): KeptLesson[] {
  const dir = path.join(courseDir, "lessons");
  if (!fs.existsSync(dir)) return [];
  const kept: KeptLesson[] = [];
  for (const name of fs.readdirSync(dir)) {
    if (!/^\d+-[a-z0-9-]+\.mdx$/.test(name)) continue;
    const raw = fs.readFileSync(path.join(dir, name), "utf8");
    const data = matter(raw).data as { id?: string };
    if (!data.id || legacyIds.has(data.id)) continue;
    const contentSlug = contentSlugOf(name.replace(/\.mdx$/, ""));
    const parts = data.id.split("/");
    kept.push({ id: data.id, contentSlug, moduleSlug: parts.length >= 3 ? parts[1] : "", raw });
  }
  kept.sort((a, b) => a.contentSlug.localeCompare(b.contentSlug));
  return kept;
}

export function convertCourses(root: string): string[] {
  const converted: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const courseDir = path.join(root, entry.name);
    const legacy = readLegacy(courseDir, entry.name);
    if (!legacy) continue;
    const seen = new Set<string>();
    for (const lesson of legacy.lessons) {
      if (seen.has(lesson.contentSlug)) throw new Error(`${entry.name}: duplicate lesson slug "${lesson.contentSlug}"`);
      seen.add(lesson.contentSlug);
    }
    const kept = readKept(courseDir, new Set(legacy.lessons.map((l) => l.id)));
    for (const extra of kept) {
      if (seen.has(extra.contentSlug)) throw new Error(`${entry.name}: kept lesson slug "${extra.contentSlug}" collides with a legacy lesson`);
      seen.add(extra.contentSlug);
    }

    const ordered: { contentSlug: string; moduleSlug: string; raw: string }[] = [
      ...legacy.lessons.map((l) => ({ contentSlug: l.contentSlug, moduleSlug: l.moduleSlug, raw: l.body })),
      ...kept.map((l) => ({ contentSlug: l.contentSlug, moduleSlug: l.moduleSlug, raw: l.raw })),
    ];

    const lessonsDir = path.join(courseDir, "lessons");
    fs.rmSync(lessonsDir, { recursive: true, force: true });
    fs.mkdirSync(lessonsDir, { recursive: true });
    ordered.forEach((lesson, i) => {
      const nn = String(i + 1).padStart(2, "0");
      fs.writeFileSync(path.join(lessonsDir, `${nn}-${lesson.contentSlug}.mdx`), lesson.raw.endsWith("\n") ? lesson.raw : `${lesson.raw}\n`);
    });

    const districts = legacy.districts.map((d) => {
      const id = String(d.id);
      const extraSlugs = kept.filter((k) => k.moduleSlug === id).map((k) => k.contentSlug);
      const lessons = [...((d.lessons as string[] | undefined) ?? []), ...extraSlugs];
      return lessons.length ? { ...d, lessons } : d;
    });
    const lessonSlugs = districts.filter((d) => d.status !== "stub").flatMap((d) => (d.lessons as string[] | undefined) ?? []);
    const cover = String(legacy.districts.find((d) => d.art)?.art ?? legacy.meta.cover ?? "skyline");
    const course = {
      id: entry.name,
      title: legacy.meta.title,
      description: legacy.meta.description,
      order: legacy.meta.order ?? 100,
      cover,
      prerequisites: Array.isArray(legacy.meta.prerequisites) ? legacy.meta.prerequisites : [],
      ...(legacy.meta.tagline ? { tagline: legacy.meta.tagline } : {}),
      ...(legacy.meta.level ? { level: legacy.meta.level } : {}),
      lessons: lessonSlugs,
      districts,
    };
    fs.writeFileSync(path.join(courseDir, "course.yaml"), `${YAML.stringify(course).trimEnd()}\n`);
    const assets = path.join(courseDir, "assets");
    fs.mkdirSync(assets, { recursive: true });
    const keep = path.join(assets, ".gitkeep");
    if (!fs.existsSync(keep)) fs.writeFileSync(keep, "");
    fs.rmSync(path.join(courseDir, "modules"), { recursive: true, force: true });
    converted.push(entry.name);
  }
  return converted;
}

const isDirect = process.argv[1]?.includes("convert-legacy-content");
if (isDirect) {
  const root = path.resolve(process.argv[2] ?? path.join(process.cwd(), "content", "courses"));
  const converted = convertCourses(root);
  if (!converted.length) console.log(`No legacy courses under ${root}`);
  else console.log(`Converted ${converted.join(", ")}`);
}
