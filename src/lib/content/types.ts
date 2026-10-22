import type { BodyBlock, CourseMeta, Device, Exercise, LessonFrontmatter, ModuleMeta } from "./schema";

export type LessonData = {
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
};

export type ModuleData = ModuleMeta & {
  slug: string;
  courseSlug: string;
  index: number;
  lessons: LessonData[];
};

export type CourseData = CourseMeta & {
  slug: string;
  modules: ModuleData[];
};

/** Serializable shapes passed to client components (no lesson bodies). */
export type LessonSummary = {
  key: string;
  slug: string;
  title: string;
  kind: LessonData["kind"];
  xp: number;
  minutes: number;
  exerciseIds: string[];
  desktopOnlyIds: string[];
};

export type ModuleSummary = Omit<ModuleData, "lessons"> & { lessons: LessonSummary[] };
export type CourseSummary = Omit<CourseData, "modules"> & { modules: ModuleSummary[] };

export function lessonKey(courseSlug: string, moduleSlug: string, lessonSlug: string) {
  return `${courseSlug}/${moduleSlug}/${lessonSlug}`;
}

export function exerciseKey(lesson: string, exerciseId: string) {
  return `${lesson}#${exerciseId}`;
}

export function supports(ex: { devices: Device[] }, device: Device) {
  return ex.devices.includes(device);
}

export function summarizeLesson(l: LessonData): LessonSummary {
  const ids = Object.keys(l.exercises);
  return {
    key: lessonKey(l.courseSlug, l.moduleSlug, l.slug),
    slug: l.slug,
    title: l.title,
    kind: l.kind,
    xp: l.xp,
    minutes: l.minutes,
    exerciseIds: ids,
    desktopOnlyIds: ids.filter((id) => !supports(l.exercises[id], "phone")),
  };
}

export function summarizeCourse(c: CourseData): CourseSummary {
  return {
    ...c,
    modules: c.modules.map((m) => ({ ...m, lessons: m.lessons.map(summarizeLesson) })),
  };
}
