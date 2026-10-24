"use client";

import { Fragment, useState } from "react";
import type { BossPart } from "@/lib/content/schema";
import { gradeFill } from "@/lib/grading";
import { cn } from "@/lib/utils";
import { Prompt } from "./inline-text";
import type { WidgetProps } from "./types";
import { usePrimaryAction } from "./useAction";

export function FillWidget({ id, exercise, setAction, onGrade, locked }: WidgetProps<Extract<BossPart, { type: "fill" }>>) {
  const n = exercise.answers.length;
  const [slots, setSlots] = useState<(number | null)[]>(() => Array(n).fill(null));
  const [active, setActive] = useState<number | null>(null);
  const filled = slots.map((s) => (s === null ? null : exercise.chips[s]));
  const used = new Set(slots.filter((s): s is number => s !== null));

  usePrimaryAction(
    setAction,
    locked ? null : { label: "Check", disabled: slots.some((s) => s === null), onPress: () => onGrade(gradeFill(exercise, filled)) },
  );

  const placeChip = (chip: number) => {
    if (locked) return;
    setSlots((prev) => {
      const next = [...prev];
      const target = active !== null && next[active] === null ? active : next.findIndex((s) => s === null);
      if (target === -1) return prev;
      next[target] = chip;
      return next;
    });
    setActive(null);
  };

  const tapSlot = (i: number) => {
    if (locked) return;
    if (slots[i] !== null) {
      setSlots((prev) => prev.map((s, j) => (j === i ? null : s)));
      setActive(i);
    } else setActive(i === active ? null : i);
  };

  const pieces = exercise.text.split(/(\{\{\d+\}\})/g);

  return (
    <div>
      {exercise.prompt && <Prompt text={exercise.prompt} />}
      <p className="mb-5 text-lg leading-[2.6] text-foreground">
        {pieces.map((p, k) => {
          const m = p.match(/^\{\{(\d+)\}\}$/);
          if (!m) return <Fragment key={k}>{p}</Fragment>;
          const i = Number(m[1]);
          const value = filled[i];
          const right = locked && value === exercise.answers[i];
          const wrong = locked && value !== exercise.answers[i];
          return (
            <button
              key={k}
              type="button"
              onClick={() => tapSlot(i)}
              disabled={locked}
              data-testid={`${id}-blank-${i}`}
              aria-label={value ? `Blank ${i + 1}: ${value}. Tap to clear.` : `Blank ${i + 1}, empty`}
              className={cn(
                "mx-1 inline-flex min-h-11 min-w-20 items-center justify-center rounded-md border-2 border-dashed px-3 align-middle font-mono text-base leading-tight",
                value ? "border-solid border-gold bg-panel-2 text-foreground" : "border-muted-foreground/60 text-muted-foreground",
                active === i && !value && "border-gold",
                right && "border-money",
                wrong && "border-danger",
              )}
            >
              {value ?? "____"}
            </button>
          );
        })}
      </p>
      {locked && filled.some((f, i) => f !== exercise.answers[i]) && (
        <p className="mb-3 text-base text-muted-foreground">
          Answer: {exercise.answers.map((a, i) => `(${i + 1}) ${a}`).join("  ")}
        </p>
      )}
      <div className="flex flex-wrap gap-2" aria-label="Word chips">
        {exercise.chips.map((chip, ci) => (
          <button
            key={ci}
            type="button"
            disabled={locked || used.has(ci)}
            onClick={() => placeChip(ci)}
            data-testid={`${id}-chip-${ci}`}
            className={cn(
              "min-h-11 rounded-full border-2 border-border bg-panel-2 px-4 font-mono text-base text-foreground transition-opacity",
              "hover:border-gold disabled:opacity-35",
            )}
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
