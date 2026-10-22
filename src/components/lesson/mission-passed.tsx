"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Map as MapIcon, Monitor } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useDevice, useReducedMotion } from "@/components/providers";
import { formatMoney } from "@/components/hud";

function useCountUp(target: number, ms: number, run: boolean) {
  const [v, setV] = useState(run ? 0 : target);
  useEffect(() => {
    if (!run) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setV(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, run]);
  return v;
}

export type MissionPassedProps = {
  title: string;
  xpGained: number;
  keyIdeas: string[];
  firstCompletion: boolean;
  pendingDesktop: number;
  nextHref: string;
  nextLabel: string;
  mapHref: string;
};

/**
 * Two phases: a skippable full-screen splash (about 2 s on desktop, at most 1.5 s on phones, none with
 * reduced motion), then a recap panel with the three key ideas.
 */
export function MissionPassed(p: MissionPassedProps) {
  const device = useDevice();
  const reduced = useReducedMotion();
  const splashMs = reduced ? 0 : device === "phone" ? 1500 : 2000;
  const [phase, setPhase] = useState<"splash" | "recap">(splashMs ? "splash" : "recap");
  const shown = useCountUp(p.xpGained, reduced ? 0 : 900, !reduced);
  const nextRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (phase !== "splash") return;
    const t = setTimeout(() => setPhase("recap"), splashMs);
    const skip = () => setPhase("recap");
    window.addEventListener("keydown", skip);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", skip);
    };
  }, [phase, splashMs]);

  useEffect(() => {
    if (phase === "recap") nextRef.current?.focus();
  }, [phase]);

  if (phase === "splash")
    return (
      <div
        className="fixed inset-0 z-50 grid cursor-pointer place-items-center bg-ink/95 px-4"
        onClick={() => setPhase("recap")}
        role="status"
        aria-live="assertive"
        data-testid="mission-splash"
      >
        <div className="decor sunset absolute inset-x-0 top-1/2 h-40 -translate-y-1/2 opacity-25" />
        <div className="relative text-center">
          <p className="mission-title font-display text-6xl leading-none text-gold drop-shadow-[0_3px_0_#000] sm:text-8xl">MISSION PASSED</p>
          <p className="mt-4 font-display text-2xl tracking-widest text-foreground sm:text-3xl">RESPECT +</p>
          <p className="mt-2 font-display text-5xl text-money-ink tabular-nums">+{formatMoney(shown)}</p>
          <p className="mt-6 text-sm text-muted-foreground">Tap or press any key to skip</p>
        </div>
      </div>
    );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mission-title"
        className="w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-panel p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl max-sm:max-h-[85dvh] sm:rounded-2xl sm:p-7"
        data-testid="mission-passed"
      >
        <p id="mission-title" className="font-display text-4xl leading-none text-gold-ink sm:text-5xl">
          MISSION PASSED
        </p>
        <p className="mt-1 text-base text-muted-foreground">{p.title}</p>
        <p className="mt-3 font-display text-3xl text-money-ink tabular-nums" data-testid="mission-xp">
          +{formatMoney(shown)}
          {!p.firstCompletion && p.xpGained === 0 && <span className="ml-2 font-sans text-base text-muted-foreground">(already collected)</span>}
        </p>

        <h2 className="mt-5 mb-2 text-sm font-bold tracking-widest text-muted-foreground uppercase">Three things to keep</h2>
        <ol className="space-y-2">
          {p.keyIdeas.map((k, i) => (
            <li key={i} className="flex gap-3 text-base leading-snug text-foreground">
              <span className="grid size-7 shrink-0 place-items-center rounded bg-gold font-display text-ink">{i + 1}</span>
              <span>{k}</span>
            </li>
          ))}
        </ol>

        {p.pendingDesktop > 0 && (
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-ink p-3 text-base">
            <Monitor className="mt-0.5 size-5 shrink-0 text-gold-ink" aria-hidden />
            {p.pendingDesktop} desktop mission{p.pendingDesktop > 1 ? "s" : ""} waiting. Replay this lesson on a computer for the bonus.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <Link href={p.nextHref} ref={nextRef} className={buttonVariants({ size: "lg", className: "h-14 text-lg sm:flex-1" })} data-testid="mission-next">
            {p.nextLabel} <ArrowRight className="size-5" />
          </Link>
          <Link href={p.mapHref} className={buttonVariants({ variant: "outline", size: "lg", className: "h-14" })}>
            <MapIcon className="size-5" /> Map
          </Link>
        </div>
      </div>
    </div>
  );
}
