"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useProgress } from "@/components/providers";
import type { CourseSummary } from "@/lib/content/types";
import { courseHref } from "@/lib/content/navigation";
import { respect } from "@/lib/progress/logic";
import { RespectBar } from "@/components/respect-bar";

export function courseLessons(course: CourseSummary) {
  return course.modules.flatMap((m) => m.lessons.map((l) => ({ key: l.key, exerciseCount: l.exerciseIds.length })));
}

export function CourseCard({ course }: { course: CourseSummary }) {
  const { state, loaded } = useProgress();
  const lessons = courseLessons(course);
  const done = lessons.filter((l) => state.lessons[l.key]).length;
  const ready = course.modules.filter((m) => m.status === "ready").length;
  return (
    <Link
      href={courseHref(course.slug)}
      className="group flex flex-col rounded-xl border border-border bg-panel p-5 transition-colors hover:border-gold focus-visible:border-gold sm:p-6"
      data-testid={`course-${course.slug}`}
    >
      <p className="text-sm font-bold tracking-widest text-gold-ink uppercase">
        {course.level} · {course.modules.length} district{course.modules.length > 1 ? "s" : ""} · {ready} open
      </p>
      <h3 className="mt-1 font-display text-3xl tracking-wide text-foreground">{course.title.toUpperCase()}</h3>
      <p className="mt-1 text-base font-bold text-foreground">{course.tagline}</p>
      <p className="mt-2 max-w-[60ch] text-base text-muted-foreground">{course.description}</p>
      <div className="mt-4">
        <RespectBar value={loaded ? respect(state, lessons) : 0} />
        <p className="mt-1 text-sm text-muted-foreground">
          {done}/{lessons.length} missions complete
        </p>
      </div>
      <span className="mt-4 inline-flex items-center gap-1.5 font-display text-lg tracking-wide text-gold-ink">
        {done ? "CONTINUE" : "START"} <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
      </span>
    </Link>
  );
}
