import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LessonPlayer, type PlayerStep } from "@/components/lesson/lesson-player";
import { Markdown } from "@/components/markdown";
import { getCourse, getCourses } from "@/lib/content/loader";
import { courseHref, nextAfter } from "@/lib/content/navigation";
import type { Exercise } from "@/lib/content/schema";
import { lessonKey } from "@/lib/content/types";

export const dynamicParams = false;

export function generateStaticParams() {
  return getCourses().flatMap((c) =>
    c.modules.flatMap((m) => m.lessons.map((l) => ({ course: c.slug, module: m.slug, lesson: l.slug }))),
  );
}

export async function generateMetadata({ params }: PageProps<"/courses/[course]/[module]/[lesson]">): Promise<Metadata> {
  const { course, module, lesson } = await params;
  return { title: getCourse(course)?.modules.find((m) => m.slug === module)?.lessons.find((l) => l.slug === lesson)?.title ?? "Lesson" };
}

/** Reference solutions stay on the server: they exist only so CI can prove the hidden tests are passable. */
function forClient(ex: Exercise): Exercise {
  if (ex.type === "code") return { ...ex, solution: "" };
  if (ex.type === "debug") return { ...ex, solution: undefined };
  return ex;
}

export default async function LessonPage({ params }: PageProps<"/courses/[course]/[module]/[lesson]">) {
  const { course: cslug, module: mslug, lesson: lslug } = await params;
  const course = getCourse(cslug);
  const mod = course?.modules.find((m) => m.slug === mslug);
  const lesson = mod?.lessons.find((l) => l.slug === lslug);
  if (!course || !mod || !lesson) notFound();

  const steps: PlayerStep[] = lesson.blocks.map((b) =>
    b.kind === "card"
      ? { kind: "card", title: b.title, content: <Markdown source={b.markdown} /> }
      : { kind: "exercise", id: b.id, exercise: forClient(lesson.exercises[b.id]) },
  );
  const next = nextAfter(course, mod.slug, lesson.slug);

  return (
    <LessonPlayer
      key={lesson.slug}
      lesson={{
        key: lessonKey(course.slug, mod.slug, lesson.slug),
        title: lesson.title,
        kind: lesson.kind,
        xp: lesson.xp,
        keyIdeas: lesson.keyIdeas,
        district: mod.district,
        moduleIndex: mod.index,
        lessonIndex: lesson.index,
        lessonCount: mod.lessons.length,
      }}
      steps={steps}
      nextHref={next.href}
      nextLabel={next.label}
      mapHref={courseHref(course.slug)}
    />
  );
}
