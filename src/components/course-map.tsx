"use client";

import Link from "next/link";
import { Check, Lock, Monitor, Play, Skull } from "lucide-react";
import { courseLessons } from "@/components/course-card";
import { useDevice, useProgress } from "@/components/providers";
import { RespectBar } from "@/components/respect-bar";
import { buttonVariants } from "@/components/ui/button";
import type { CourseSummary, LessonSummary, ModuleSummary } from "@/lib/content/types";
import { levelForXp, nextLessonKey, respect } from "@/lib/progress/logic";
import { cn } from "@/lib/utils";

function Blip({ course, mod, lesson, done, isNext, pending }: { course: string; mod: string; lesson: LessonSummary; done: boolean; isNext: boolean; pending: boolean }) {
  const boss = lesson.kind === "boss";
  const state = done ? "complete" : isNext ? "next up" : "not started";
  return (
    <Link
      href={`/courses/${course}/${mod}/${lesson.slug}`}
      className="tap group relative grid place-items-center rounded-full"
      aria-label={`${lesson.title}, ${state}${boss ? ", boss fight" : ""}${pending ? ", desktop mission pending" : ""}`}
      title={lesson.title}
      data-testid={isNext ? "next-blip" : undefined}
    >
      <span
        className={cn(
          "grid place-items-center rounded-full border-2 transition-transform group-hover:scale-110",
          boss ? "size-9" : "size-6",
          done ? "border-gold bg-gold text-ink" : isNext ? "blip-next border-gold bg-ink text-gold" : "border-muted-foreground/60 bg-ink text-muted-foreground",
          boss && !done && "border-danger text-danger",
        )}
      >
        {boss ? <Skull className="size-5" aria-hidden /> : done ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : isNext ? <span className="size-2 rounded-full bg-gold" /> : null}
      </span>
      {pending && (
        <span className="absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-panel-2 text-gold-ink" aria-hidden>
          <Monitor className="size-3" />
        </span>
      )}
    </Link>
  );
}

function District({ course, mod, nextKey }: { course: string; mod: ModuleSummary; nextKey?: string }) {
  const { state } = useProgress();
  const device = useDevice();
  const stub = mod.status === "stub";
  const done = mod.lessons.filter((l) => state.lessons[l.key]).length;
  const cleared = !stub && done === mod.lessons.length;
  const hasNext = mod.lessons.some((l) => l.key === nextKey);
  const desktopOnly = mod.lessons.reduce((n, l) => n + l.desktopOnlyIds.length, 0);

  return (
    <li
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl border-2 bg-panel",
        hasNext ? "border-gold" : cleared ? "border-money/70" : "border-border",
        stub && "border-dashed",
      )}
      data-testid={`district-${mod.slug}`}
    >
      <div className={cn("decor h-1.5", stub ? "bg-panel-2" : "sunset")} />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <span className={cn("font-display text-4xl leading-none", stub ? "text-muted-foreground/70" : "text-gold-ink")}>{String(mod.index).padStart(2, "0")}</span>
          {stub ? (
            <span className="inline-flex items-center gap-1 rounded bg-panel-2 px-2 py-0.5 text-sm font-bold text-muted-foreground">
              <Lock className="size-3.5" aria-hidden /> Coming soon
            </span>
          ) : cleared ? (
            <span className="rounded bg-money px-2 py-0.5 text-sm font-bold text-ink">CLEARED</span>
          ) : (
            <span className="text-sm text-muted-foreground tabular-nums">
              {done}/{mod.lessons.length}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm font-bold tracking-widest text-muted-foreground uppercase">{mod.district}</p>
        {stub ? (
          <h3 className="font-display text-2xl leading-tight tracking-wide text-foreground">{mod.title}</h3>
        ) : (
          <h3 className="font-display text-2xl leading-tight tracking-wide text-foreground">
            <Link href={`/courses/${course}/${mod.slug}`} className="hover:text-gold-ink hover:underline">
              {mod.title}
            </Link>
          </h3>
        )}
        <p className="mt-1 line-clamp-3 text-base text-muted-foreground">{mod.summary}</p>
        {!stub && (
          <div className="mt-auto pt-3">
            <div className="relative flex flex-wrap items-center gap-x-1">
              <span className="decor absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 bg-border" aria-hidden />
              {mod.lessons.map((l) => (
                <span key={l.key} className="relative">
                  <Blip
                    course={course}
                    mod={mod.slug}
                    lesson={l}
                    done={!!state.lessons[l.key]}
                    isNext={l.key === nextKey}
                    pending={(state.lessons[l.key]?.pendingDesktop.length ?? 0) > 0}
                  />
                </span>
              ))}
            </div>
            {desktopOnly > 0 && device === "phone" && (
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <Monitor className="size-3.5 text-gold-ink" aria-hidden /> {desktopOnly} desktop mission{desktopOnly > 1 ? "s" : ""} here
              </p>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export function CourseMap({ course }: { course: CourseSummary }) {
  const { state, loaded } = useProgress();
  const lessons = courseLessons(course);
  const nextKey = loaded ? nextLessonKey(state, lessons.map((l) => l.key)) : lessons[0]?.key;
  const nextMod = course.modules.find((m) => m.lessons.some((l) => l.key === nextKey));
  const nextLesson = nextMod?.lessons.find((l) => l.key === nextKey);
  const lvl = levelForXp(state.xp);

  return (
    <div className="flex flex-1 flex-col pb-28 sm:pb-10">
      <header className="sunset">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-8">
          <div className="rounded-lg bg-ink/90 px-4 py-3">
            <p className="text-sm font-bold tracking-widest text-gold-ink uppercase">Map · {course.modules.length} districts</p>
            <h1 className="font-display text-4xl leading-none tracking-wide text-foreground sm:text-5xl">{course.title.toUpperCase()}</h1>
            <p className="mt-1 text-base text-foreground">{course.tagline}</p>
          </div>
          <div className="w-full rounded-lg bg-ink/90 px-4 py-3 sm:w-80">
            <RespectBar value={loaded ? respect(state, lessons) : 0} />
            <p className="mt-1 text-sm text-muted-foreground">
              Level {lvl.level} · {lvl.rank}
            </p>
          </div>
        </div>
      </header>

      <div className="relative mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground" aria-label="Map legend">
          <span className="inline-flex items-center gap-1.5">
            <span className="blip-next size-3 rounded-full border-2 border-gold" /> Next mission
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-gold" /> Complete
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Skull className="size-4 text-danger" /> Boss
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Monitor className="size-4 text-gold-ink" /> Desktop mission pending
          </span>
        </div>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Districts">
          {course.modules.map((m) => (
            <District key={m.slug} course={course.slug} mod={m} nextKey={nextKey} />
          ))}
        </ol>
      </div>

      {nextMod && nextLesson && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-ink/95 backdrop-blur sm:static sm:mx-auto sm:mt-8 sm:w-full sm:max-w-6xl sm:border-0 sm:bg-transparent sm:px-6">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-0">
            <div className="hidden min-w-0 flex-1 sm:block">
              <p className="text-sm text-muted-foreground">Next up in {nextMod.district}</p>
              <p className="truncate text-lg font-bold">{nextLesson.title}</p>
            </div>
            <Link
              href={
                state.lessons[nextMod.lessons[0].key] || nextMod.lessons[0].key !== nextKey
                  ? `/courses/${course.slug}/${nextMod.slug}/${nextLesson.slug}`
                  : `/courses/${course.slug}/${nextMod.slug}`
              }
              className={buttonVariants({ size: "lg", className: "h-14 flex-1 font-display text-xl tracking-wider sm:flex-none sm:px-8" })}
              data-testid="map-primary"
            >
              <Play className="size-5 fill-current" /> {Object.keys(state.lessons).length ? "Resume" : "Start"}: {nextLesson.kind === "boss" ? "Boss" : nextLesson.title}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
