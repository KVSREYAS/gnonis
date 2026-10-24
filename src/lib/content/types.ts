import type { BodyBlock } from "./mdx";
import type { CourseMeta, Device, DistrictMeta, Exercise, LessonFrontmatter } from "./schema";

export type LessonData = {
  /** Stable progress id from frontmatter. Not derived from the title or file order. */
  id: string;
  /** Authoring slug: the part after `nn-` in the filename, listed in course.yaml. */
  contentSlug: string;
  /** URL segment. For saved courses this is the last segment of `id`, so old links keep working. */
  slug: string;
  courseSlug: string;
  moduleSlug: string;
  index: number;
  title: string;
  kind: LessonFrontmatter["kind"];
  summary: string;
  xp: number;
  minutes: number;
  keyIdeas: string[];
  blocks: BodyBlock[];
  exercises: Record<string, Exercise>;
  exerciseHashes: Record<string, string>;
};

export type ModuleData = Omit<DistrictMeta, "lessons" | "id"> & {
  slug: string;
  courseSlug: string;
  index: number;
  lessons: LessonData[];
};

export type CourseData = Omit<CourseMeta, "districts" | "lessons" | "tagline"> & {
  slug: string;
  tagline: string;
  modules: ModuleData[];
};

/** Serializable shapes passed to client components (no lesson bodies). */
export type LessonSummary = {
  key: string;
  slug: string;
  contentSlug: string;
  title: string;
  kind: LessonData["kind"];
  xp: number;
  minutes: number;
  exerciseIds: string[];
  exerciseHashes: Record<string, string>;
  desktopOnlyIds: string[];
};

export type ModuleSummary = Omit<ModuleData, "lessons"> & { lessons: LessonSummary[] };
export type CourseSummary = Omit<CourseData, "modules"> & { modules: ModuleSummary[] };

export function exerciseKey(lessonId: string, exerciseId: string) {
  return `${lessonId}#${exerciseId}`;
}

export function supports(ex: { devices: Device[] }, device: Device) {
  return ex.devices.includes(device);
}

export function summarizeLesson(l: LessonData): LessonSummary {
  const ids = Object.keys(l.exercises);
  return {
    key: l.id,
    slug: l.slug,
    contentSlug: l.contentSlug,
    title: l.title,
    kind: l.kind,
    xp: l.xp,
    minutes: l.minutes,
    exerciseIds: ids,
    exerciseHashes: l.exerciseHashes,
    desktopOnlyIds: ids.filter((id) => !supports(l.exercises[id], "phone")),
  };
}

export function summarizeCourse(c: CourseData): CourseSummary {
  return {
    ...c,
    modules: c.modules.map((m) => ({ ...m, lessons: m.lessons.map(summarizeLesson) })),
  };
}
