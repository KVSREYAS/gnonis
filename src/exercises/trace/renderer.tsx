"use client";

import { useState } from "react";
import type { ExerciseOf } from "@/exercises/schema";
import { gradeTrace } from "@/lib/grading";
import { cn } from "@/lib/utils";
import { Prompt } from "@/components/widgets/inline-text";
import type { WidgetProps } from "@/components/widgets/types";
import { usePrimaryAction } from "@/components/widgets/useAction";

export function Renderer({ id, exercise, setAction, onGrade, locked }: WidgetProps<ExerciseOf<"trace">>) {
  const [step, setStep] = useState(0);
  const [value, setValue] = useState("");
  const lines = exercise.code.split("\n");
  const current = exercise.steps[Math.min(step, exercise.steps.length - 1)];
  const doneStepping = step >= exercise.steps.length - 1;
  const submit = () => onGrade(gradeTrace(exercise, value));

  usePrimaryAction(
    setAction,
    locked ? null : doneStepping ? { label: "Lock it in", disabled: value.trim() === "", onPress: submit } : { label: "Next line", onPress: () => setStep((n) => n + 1) },
  );

  return (
    <div>
      <Prompt text={exercise.prompt} />
      <div className="overflow-hidden rounded-lg border-2 border-border bg-ink font-mono text-sm leading-6">
        {lines.map((line, i) => {
          const n = i + 1;
          const active = n === current.line;
          return (
            <div key={n} className={cn("flex gap-3 px-3", active && "bg-gold/15")}>
              <span className="w-6 shrink-0 text-right text-muted-foreground">{n}</span>
              <span className="whitespace-pre text-foreground">{line || " "}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 rounded-lg border border-border bg-panel-2 p-3 text-base" data-testid={`${id}-note`}>
        <span className="font-display tracking-wide text-gold-ink">LINE {current.line}. </span>
        {current.note}
      </p>
      {doneStepping && (
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!locked && value.trim()) submit();
          }}
        >
          <label htmlFor={`${id}-answer`} className="mb-1 block text-base font-bold">
            {exercise.question}
          </label>
          <input
            id={`${id}-answer`}
            data-testid={`${id}-answer`}
            value={value}
            disabled={locked}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="off"
            className="h-14 w-full rounded-lg border-2 border-border bg-ink px-4 font-mono text-base text-foreground focus:border-gold focus:outline-none"
          />
        </form>
      )}
    </div>
  );
}
