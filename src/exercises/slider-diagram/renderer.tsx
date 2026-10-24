"use client";

import { useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { useReducedMotion } from "@/components/providers";
import type { ExerciseOf } from "@/exercises/schema";
import { formatNumber, gradeSliderDiagram, interpolateCurve } from "@/lib/grading";
import { cn } from "@/lib/utils";
import { Prompt } from "@/components/widgets/inline-text";
import type { WidgetProps } from "@/components/widgets/types";
import { usePrimaryAction } from "@/components/widgets/useAction";

export function Renderer({ id, exercise, setAction, onGrade, locked }: WidgetProps<ExerciseOf<"slider-diagram">>) {
  const reduced = useReducedMotion();
  const [x, setX] = useState(exercise.initial);
  const y = interpolateCurve(exercise.points, x);
  const met = useMemo(() => gradeSliderDiagram(exercise, x).correct, [exercise, x]);

  usePrimaryAction(setAction, locked ? null : { label: met ? "Goal reached: check" : "Check", onPress: () => onGrade(gradeSliderDiagram(exercise, x)) });

  const pts = [...exercise.points].sort((a, b) => a.x - b.x);
  const minX = Math.min(exercise.min, ...pts.map((p) => p.x));
  const maxX = Math.max(exercise.max, ...pts.map((p) => p.x));
  const minY = Math.min(0, ...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  const sx = (v: number) => ((v - minX) / (maxX - minX || 1)) * 100;
  const sy = (v: number) => 36 - ((v - minY) / (maxY - minY || 1)) * 32;
  const poly = pts.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ");

  return (
    <div>
      <Prompt text={exercise.prompt} />
      <p className={cn("mb-3 rounded-lg border-2 bg-ink p-3 text-base", met ? "border-money" : "border-gold/60")} data-testid={`${id}-goal`}>
        <strong>{met ? "Goal met. " : "Goal: "}</strong>
        {exercise.goal.description}
      </p>
      <svg viewBox="0 0 100 40" className="h-40 w-full rounded-lg border border-border bg-ink" role="img" aria-label={`${exercise.yLabel} against ${exercise.xLabel}`}>
        <polyline points={poly} fill="none" stroke="currentColor" className="text-gold" strokeWidth="1.2" />
        <circle cx={sx(x)} cy={sy(y)} r="1.8" className={cn("fill-gold", !reduced && "transition-all duration-200")} />
      </svg>
      <div className="mt-3 mb-1 flex items-baseline justify-between">
        <label htmlFor={`${id}-slider`} className="text-base font-bold">
          {exercise.xLabel}
        </label>
        <span className="font-mono text-base text-gold-ink tabular-nums">
          {formatNumber(x)}
          {exercise.unit ? ` ${exercise.unit}` : ""} · {exercise.yLabel} {formatNumber(y)}
        </span>
      </div>
      <Slider
        id={`${id}-slider`}
        aria-label={exercise.xLabel}
        min={exercise.min}
        max={exercise.max}
        step={exercise.step}
        value={[x]}
        disabled={locked}
        onValueChange={(v) => setX(Array.isArray(v) ? v[0] : v)}
        data-testid={`${id}-slider`}
      />
    </div>
  );
}
