import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { ContentHotReload } from "@/components/content-hot-reload";
import { LessonPlayer, type PlayerStep } from "@/components/lesson/lesson-player";
import { Markdown } from "@/components/markdown";
import { getLessonBySlug } from "@/lib/content/loader";
import { courseHref, nextAfter } from "@/lib/content/navigation";
import type { Exercise } from "@/lib/content/schema";

export const dynamic = "force-dynamic";

function forClient(ex: Exercise): Exercise {
  if (ex.type === "code") return { ...ex, solution: "" };
  if (ex.type === "debug") return { ...ex, solution: undefined };
  return ex;
}

export async function generateMetadata({ params }: PageProps<"/preview/[course]/[lesson]">): Promise<Metadata> {
  const { course, lesson } = await params;
  const found = getLessonBySlug(course, lesson);
  return { title: found ? `Preview · ${found.lesson.title}` : "Preview" };
}

/** Skips progress gating. Accepts the authoring slug (`what-is-a-token`) or the URL slug. */
export default async function PreviewPage({ params }: PageProps<"/preview/[course]/[lesson]">) {
  if (process.env.NODE_ENV === "development") await connection();
  const { course: cslug, lesson: lslug } = await params;
  const found = getLessonBySlug(cslug, lslug);
  if (!found) notFound();
  const { course, mod, lesson } = found;

  const steps: PlayerStep[] = lesson.blocks.map((b) =>
    b.kind === "card"
      ? { kind: "card", title: b.title, content: <Markdown source={b.markdown} /> }
      : { kind: "exercise", id: b.id, exercise: forClient(lesson.exercises[b.id]) },
  );
  const next = nextAfter(course, mod.slug, lesson.slug);

  return (
    <>
      <ContentHotReload />
      <LessonPlayer
        key={`preview-${lesson.id}`}
        lesson={{
          key: lesson.id,
          title: lesson.title,
          kind: lesson.kind,
          xp: lesson.xp,
          keyIdeas: lesson.keyIdeas,
          district: mod.district,
          moduleIndex: mod.index,
          lessonIndex: lesson.index,
          lessonCount: mod.lessons.length,
          hashes: lesson.exerciseHashes,
          preview: true,
        }}
        steps={steps}
        nextHref={next.href}
        nextLabel={next.label}
        mapHref={courseHref(course.slug)}
      />
    </>
  );
}
