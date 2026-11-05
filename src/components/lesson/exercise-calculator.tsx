"use client";

import { useState, useSyncExternalStore } from "react";
import { Calculator } from "@/components/lesson/calculator";

const WIDE_QUERY = "(min-width: 1024px)";

function subscribeWide(onChange: () => void) {
  const media = window.matchMedia(WIDE_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** Desktop shows the calculator beside the question. Phones keep it one tap away so the problem stays on screen. */
function useWideScreen() {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE_QUERY).matches, () => false);
}

/** The same expression calculator as the side panel, sitting in the exercise so the problem stays in view. */
export function ExerciseCalculator({ focusToken }: { focusToken: number }) {
  const wide = useWideScreen();
  const [override, setOverride] = useState<boolean | null>(null);
  const [seenToken, setSeenToken] = useState(focusToken);
  if (focusToken !== seenToken) {
    setSeenToken(focusToken);
    setOverride(true);
  }
  const open = override ?? wide;

  return (
    <section
      data-testid="exercise-calc"
      aria-label="Calculator"
      className="rounded-lg border border-border bg-ink p-3 lg:sticky lg:top-16 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto"
    >
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
        aria-controls="exercise-calculator-panel"
        data-testid="exercise-calc-toggle"
        onClick={() => setOverride(!open)}
      >
        <span className="font-display text-lg tracking-widest text-gold-ink">CALCULATOR</span>
        <span className="text-sm font-bold text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div id="exercise-calculator-panel" className="mt-3">
          <Calculator active focusToken={focusToken} testId="exercise-calc" compact />
        </div>
      ) : null}
    </section>
  );
}
