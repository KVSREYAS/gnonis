"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarsList } from "@/components/viz";
import type { ExerciseOf, FrameView } from "@/lib/content/schema";
import { cn } from "@/lib/utils";
import { Prompt } from "./inline-text";
import type { WidgetProps } from "./types";
import { usePrimaryAction } from "./useAction";

function View({ view }: { view: FrameView }) {
  if (view.kind === "tokens") {
    const hl = new Set(view.highlight ?? []);
    const dim = new Set(view.dim ?? []);
    return (
      <div>
        {view.label && <p className="mb-2 text-sm text-muted-foreground">{view.label}</p>}
        <div className="flex flex-wrap gap-2">
          {view.tokens.map((t, i) => (
            <span
              key={i}
              className={cn(
                "rounded-md border-2 px-2.5 py-1.5 font-mono text-base whitespace-pre transition-colors",
                hl.has(i) ? "border-gold bg-gold text-ink" : dim.has(i) ? "border-border bg-panel-2 text-muted-foreground" : "border-border text-foreground",
              )}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (view.kind === "bars") {
    const max = view.max ?? Math.max(...view.bars.map((b) => b.value));
    return (
      <div>
        {view.label && <p className="mb-2 text-sm text-muted-foreground">{view.label}</p>}
        <BarsList bars={view.bars} max={max} unit={view.unit} />
      </div>
    );
  }
  const hl = new Set((view.highlight ?? []).map(([r, c]) => `${r},${c}`));
  const finite = view.cells.flat().filter((v): v is number => v !== null);
  const lo = Math.min(...finite);
  const hi = Math.max(...finite);
  return (
    <div className="overflow-x-auto">
      {view.label && <p className="mb-2 text-sm text-muted-foreground">{view.label}</p>}
      <table className="border-separate border-spacing-1 font-mono text-sm">
        <thead>
          <tr>
            <th className="sr-only">query \ key</th>
            {view.cols.map((c) => (
              <th key={c} scope="col" className="px-1 pb-1 text-center font-bold text-muted-foreground">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.rows.map((r, ri) => (
            <tr key={r}>
              <th scope="row" className="pr-2 text-right font-bold text-muted-foreground">
                {r}
              </th>
              {view.cols.map((c, ci) => {
                const v = view.cells[ri][ci];
                const t = v === null || hi === lo ? 0 : (v - lo) / (hi - lo);
                const isHl = hl.has(`${ri},${ci}`);
                return (
                  <td
                    key={c}
                    className={cn(
                      "h-11 min-w-14 rounded text-center tabular-nums",
                      v === null ? "border border-dashed border-border text-muted-foreground" : "text-foreground",
                      isHl && "outline-3 outline-gold",
                    )}
                    style={v === null ? undefined : { background: `color-mix(in srgb, var(--gold) ${Math.round(12 + t * 55)}%, var(--panel-2))`, color: t > 0.6 ? "#141414" : undefined }}
                  >
                    {v === null ? "−∞" : v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StepperWidget({ id, exercise, setAction, onGrade, locked }: WidgetProps<ExerciseOf<"stepper">>) {
  const [frame, setFrame] = useState(0);
  const last = exercise.frames.length - 1;
  const f = exercise.frames[frame];

  usePrimaryAction(
    setAction,
    locked
      ? null
      : frame < last
        ? { label: `Next step (${frame + 2}/${last + 1})`, onPress: () => setFrame((x) => Math.min(last, x + 1)) }
        : { label: "Got it", onPress: () => onGrade({ correct: true, message: exercise.explanation }) },
  );

  return (
    <div>
      <p className="mb-1 font-display text-sm tracking-widest text-gold-ink">STEP-THROUGH</p>
      <Prompt text={exercise.prompt} />
      <div className="rounded-lg border border-border bg-ink p-4" aria-live="polite">
        <View view={f.view} />
        <p className="mt-4 text-base text-foreground" data-testid={`${id}-caption`}>
          <span className="mr-2 font-display text-gold-ink">
            {frame + 1}/{last + 1}
          </span>
          {f.caption}
        </p>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setFrame((x) => Math.max(0, x - 1))} disabled={frame === 0}>
          <ChevronLeft className="size-4" /> Previous
        </Button>
        <div className="flex gap-1.5" aria-hidden>
          {exercise.frames.map((_, i) => (
            <span key={i} className={cn("size-2.5 rounded-full", i <= frame ? "bg-gold" : "bg-panel-2")} />
          ))}
        </div>
      </div>
    </div>
  );
}
