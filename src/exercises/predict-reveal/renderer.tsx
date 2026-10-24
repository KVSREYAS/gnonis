"use client";

import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { useReducedMotion } from "@/components/providers";
import type { ExerciseOf } from "@/exercises/schema";
import { formatNumber, gradePredictReveal } from "@/lib/grading";
import { cn } from "@/lib/utils";
import { Prompt } from "@/components/widgets/inline-text";
import type { WidgetProps } from "@/components/widgets/types";
import { usePrimaryAction } from "@/components/widgets/useAction";

export function Renderer({ id, exercise, setAction, onGrade, locked }: WidgetProps<ExerciseOf<"predict-reveal">>) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(exercise.min);
  const maxBar = Math.max(...exercise.series.map((s) => Math.abs(s.value)), 1);

  usePrimaryAction(setAction, locked ? null : { label: "Lock it in", onPress: () => onGrade(gradePredictReveal(exercise, value)) });

  return (
    <div>
      <Prompt text={exercise.prompt} />
      <div className="mb-1 flex items-baseline justify-between">
        <label htmlFor={`${id}-slider`} className="text-base font-bold">
          Your guess
        </label>
        <span className="font-display text-2xl text-gold-ink tabular-nums">
          {formatNumber(value)}
          {exercise.unit ? ` ${exercise.unit}` : ""}
        </span>
      </div>
      <Slider
        id={`${id}-slider`}
        aria-label="Your guess"
        min={exercise.min}
        max={exercise.max}
        step={exercise.step}
        value={[value]}
        disabled={locked}
        onValueChange={(v) => setValue(Array.isArray(v) ? v[0] : v)}
        data-testid={`${id}-slider`}
      />
      <div className="mt-5 flex h-40 items-end gap-2 rounded-lg border border-border bg-ink p-3" data-testid={`${id}-chart`} data-revealed={locked ? "true" : "false"}>
        {exercise.series.map((s) => {
          const h = locked ? Math.max(4, (Math.abs(s.value) / maxBar) * 100) : 4;
          const isAnswer = s.value === exercise.answer;
          return (
            <div key={s.label} className="flex h-full min-w-0 flex-1 flex-col justify-end">
              <div
                className={cn("w-full rounded-t", isAnswer ? "bg-gold" : "bg-money/80", !reduced && "transition-[height] duration-700")}
                style={{ height: `${h}%` }}
              />
              <span className="mt-1 truncate text-center text-xs text-muted-foreground">{s.label}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{locked ? "The gold bar is the number that was waiting." : "Lock a guess and the chart fills in."}</p>
    </div>
  );
}
