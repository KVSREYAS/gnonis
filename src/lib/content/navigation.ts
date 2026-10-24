import type { CourseData } from "./types";

export const courseHref = (c: string) => `/courses/${c}`;

/** Links rendered on the /courses index. One entry per course pack, in catalog order. */
export function courseIndexLinks(courses: { slug: string }[]) {
  return courses.map((course) => ({ slug: course.slug, href: courseHref(course.slug) }));
}
export const moduleHref = (c: string, m: string) => `/courses/${c}/${m}`;
export const lessonHref = (c: string, m: string, l: string) => `/courses/${c}/${m}/${l}`;

/** Where "next" goes after a lesson: the next lesson, else the next ready district's intro, else the map. */
export function nextAfter(course: CourseData, moduleSlug: string, lessonSlug: string): { href: string; label: string } {
  const mi = course.modules.findIndex((m) => m.slug === moduleSlug);
  const mod = course.modules[mi];
  const li = mod.lessons.findIndex((l) => l.slug === lessonSlug);
  const nextLesson = mod.lessons[li + 1];
  if (nextLesson)
    return { href: lessonHref(course.slug, mod.slug, nextLesson.slug), label: nextLesson.kind === "boss" ? "Face the boss" : "Next mission" };
  const nextModule = course.modules.slice(mi + 1).find((m) => m.status === "ready");
  if (nextModule) return { href: moduleHref(course.slug, nextModule.slug), label: `On to ${nextModule.district}` };
  return { href: courseHref(course.slug), label: "Back to the map" };
}
