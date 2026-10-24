"use client";

import { useState } from "react";
import { Lightbulb } from "lucide-react";
import type { BossPart } from "@/lib/content/schema";
import { gradePredict } from "@/lib/grading";
import { Prompt } from "./inline-text";
import type { WidgetProps } from "./types";
import { usePrimaryAction } from "./useAction";

export function PredictWidget({ id, exercise, setAction, onGrade, locked }: WidgetProps<Extract<BossPart, { type: "predict" }>>) {
  const [value, setValue] = useState("");
  const [hint, setHint] = useState(false);
  const submit = () => onGrade(gradePredict(exercise, value));

  usePrimaryAction(setAction, locked ? null : { label: "Lock it in", disabled: value.trim() === "", onPress: submit });

  return (
    <div>
      <Prompt text={exercise.prompt} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!locked && value.trim()) submit();
        }}
        className="flex items-center gap-3"
      >
        <label htmlFor={`${id}-input`} className="sr-only">
          Your prediction{exercise.unit ? ` in ${exercise.unit}` : ""}
        </label>
        <input
          id={`${id}-input`}
          data-testid={`${id}-input`}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          disabled={locked}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Your number"
          className="h-14 w-full max-w-60 rounded-lg border-2 border-border bg-ink px-4 font-display text-2xl tracking-wide text-foreground tabular-nums placeholder:font-sans placeholder:text-base placeholder:tracking-normal placeholder:text-muted-foreground focus:border-gold focus:outline-none"
        />
        {exercise.unit && <span className="text-lg text-muted-foreground">{exercise.unit}</span>}
      </form>
      <p className="mt-2 text-sm text-muted-foreground">Accepts 1300, 1,300, 1.3k or 16e9.</p>
      {exercise.hint && !locked && (
        <div className="mt-3">
          {hint ? (
            <p className="rounded-lg border border-border bg-ink p-3 text-base">
              <Lightbulb className="mr-1 inline size-4 text-gold-ink" aria-hidden /> {exercise.hint}
            </p>
          ) : (
            <button type="button" onClick={() => setHint(true)} className="tap inline-flex items-center gap-1.5 text-base font-bold text-gold-ink underline underline-offset-4">
              <Lightbulb className="size-4" aria-hidden /> Show hint
            </button>
          )}
        </div>
      )}
    </div>
  );
}
