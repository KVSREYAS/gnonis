"use client";

import Link from "next/link";
import { ArrowLeft, Check, Clock, Monitor, Play, Skull } from "lucide-react";
import { Scene } from "@/components/art";
import { useProgress } from "@/components/providers";
import { buttonVariants } from "@/components/ui/button";
import type { ModuleSummary } from "@/lib/content/types";
import { cn } from "@/lib/utils";

/** Full-screen "loading screen" card for a district, with its tip line and mission list. */
export function ModuleIntro({ courseSlug, courseTitle, mod }: { courseSlug: string; courseTitle: string; mod: ModuleSummary }) {
  const { state } = useProgress();
  const next = mod.lessons.find((l) => !state.lessons[l.key]) ?? mod.lessons[0];
  const done = mod.lessons.filter((l) => state.lessons[l.key]).length;

  return (
    <div className="flex flex-1 flex-col">
      <section className="relative isolate flex min-h-[calc(100dvh-3rem)] flex-col justify-end overflow-hidden sm:min-h-[calc(100dvh-3.5rem)]" data-testid="module-intro">
        <Scene art={mod.art} className="absolute inset-0 -z-10 h-full w-full" />
        <div className="decor absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/60 to-transparent" />
        <div className="mx-auto w-full max-w-4xl px-4 pt-6 pb-28 sm:px-6 sm:pb-10">
          <Link href={`/courses/${courseSlug}`} className="tap mb-4 inline-flex items-center gap-1.5 rounded-lg bg-ink/90 px-3 text-base font-bold text-foreground">
            <ArrowLeft className="size-5" /> {courseTitle} map
          </Link>
          <div className="rounded-xl bg-ink/92 p-5 sm:p-7">
            <p className="text-sm font-bold tracking-widest text-gold-ink uppercase">
              District {String(mod.index).padStart(2, "0")} · {mod.district}
            </p>
            <h1 className="mt-1 font-display text-5xl leading-none tracking-wide text-foreground sm:text-6xl">{mod.title.toUpperCase()}</h1>
            <p className="mt-3 max-w-[62ch] text-lg text-foreground">{mod.summary}</p>

            <ol className="mt-5 grid gap-2" aria-label="Missions in this district">
              {mod.lessons.map((l, i) => {
                const complete = !!state.lessons[l.key];
                const boss = l.kind === "boss";
                return (
                  <li key={l.key}>
                    <Link
                      href={`/courses/${courseSlug}/${mod.slug}/${l.slug}`}
                      className={cn(
                        "flex min-h-12 items-center gap-3 rounded-lg border bg-panel px-3 py-2 hover:border-gold",
                        l.key === next.key && !complete ? "border-gold" : "border-border",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-full font-display",
                          complete ? "bg-gold text-ink" : boss ? "bg-panel-2 text-danger" : "bg-panel-2 text-muted-foreground",
                        )}
                      >
                        {complete ? <Check className="size-4" strokeWidth={3} /> : boss ? <Skull className="size-5" /> : i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-bold text-foreground">{l.title}</span>
                        <span className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3.5" aria-hidden /> {l.minutes} min
                          </span>
                          <span className="text-money-ink">${l.xp}</span>
                          {l.desktopOnlyIds.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-gold-ink">
                              <Monitor className="size-3.5" aria-hidden /> Desktop mission
                            </span>
                          )}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
          <p className="mt-4 rounded-lg bg-ink/90 px-4 py-3 text-base text-foreground" data-testid="tip-line">
            <span className="font-display tracking-widest text-gold-ink">{mod.tip.startsWith("TIP") ? "" : "TIP: "}</span>
            {mod.tip}
          </p>
          <div className="decor mt-3 h-1.5 overflow-hidden rounded bg-panel-2" aria-hidden>
            <div className="loading-bar h-full bg-gold" style={{ width: `${Math.max(8, (done / mod.lessons.length) * 100)}%` }} />
          </div>
        </div>
      </section>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-ink/95 backdrop-blur sm:static sm:border-0 sm:bg-transparent">
        <div className="mx-auto flex max-w-4xl px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-10">
          <Link
            href={`/courses/${courseSlug}/${mod.slug}/${next.slug}`}
            className={buttonVariants({ size: "lg", className: "h-14 w-full font-display text-xl tracking-wider sm:w-auto sm:px-10" })}
            data-testid="start-mission"
          >
            <Play className="size-5 fill-current" />
            {done === 0 ? "Start mission" : done === mod.lessons.length ? "Replay district" : "Continue"}
          </Link>
        </div>
      </div>
    </div>
  );
}
