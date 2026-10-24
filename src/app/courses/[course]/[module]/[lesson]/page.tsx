import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { ContentHotReload } from "@/components/content-hot-reload";
import { LessonPlayer, type PlayerStep } from "@/components/lesson/lesson-player";
import { Markdown } from "@/components/markdown";
import { clientDefaultModel } from "@/lib/chat/model-server";
import { getCourse, getCourses } from "@/lib/content/loader";
import { courseHref, nextAfter } from "@/lib/content/navigation";
import type { Exercise } from "@/lib/content/schema";

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
  if (process.env.NODE_ENV === "development") await connection();
  const { course: cslug, module: mslug, lesson: lslug } = await params;
  const course = getCourse(cslug);
  const mod = course?.modules.find((m) => m.slug === mslug);
  const lesson = mod?.lessons.find((l) => l.slug === lslug);
  if (!course || !mod || !lesson) notFound();

  const steps: PlayerStep[] = lesson.blocks.map((b) =>
    b.kind === "card"
      ? { kind: "card", title: b.title, content: <Markdown source={b.markdown} />, text: b.markdown }
      : { kind: "exercise", id: b.id, exercise: forClient(lesson.exercises[b.id]) },
  );
  const next = nextAfter(course, mod.slug, lesson.slug);

  return (
    <>
      <ContentHotReload />
      <LessonPlayer
        key={lesson.id}
        lesson={{
          key: lesson.id,
          courseTitle: course.title,
          title: lesson.title,
          kind: lesson.kind,
          xp: lesson.xp,
          keyIdeas: lesson.keyIdeas,
          district: mod.district,
          moduleIndex: mod.index,
          lessonIndex: lesson.index,
          lessonCount: mod.lessons.length,
          hashes: lesson.exerciseHashes,
        }}
        steps={steps}
        nextHref={next.href}
        nextLabel={next.label}
        mapHref={courseHref(course.slug)}
        chatEnabled={Boolean(process.env.OPENROUTER_API_KEY?.trim())}
        defaultModel={clientDefaultModel()}
      />
    </>
  );
}
