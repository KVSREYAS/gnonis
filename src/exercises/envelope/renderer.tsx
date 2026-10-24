"use client";

import { useState } from "react";
import { Lightbulb } from "lucide-react";
import type { ExerciseOf } from "@/exercises/schema";
import { gradeEnvelope } from "@/lib/grading";
import { Prompt } from "@/components/widgets/inline-text";
import type { WidgetProps } from "@/components/widgets/types";
import { usePrimaryAction } from "@/components/widgets/useAction";

export function Renderer({ id, exercise, setAction, onGrade, locked }: WidgetProps<ExerciseOf<"envelope">>) {
  const [value, setValue] = useState("");
  const [shown, setShown] = useState(0);
  const submit = () => onGrade(gradeEnvelope(exercise, value));

  usePrimaryAction(setAction, locked ? null : { label: "Lock it in", disabled: value.trim() === "", onPress: submit });

  return (
    <div>
      <Prompt text={exercise.prompt} />
      <ul className="mb-4 grid gap-1 rounded-lg border border-border bg-ink p-3 text-base">
        {exercise.given.map((g) => (
          <li key={g} className="font-mono text-sm text-foreground">
            {g}
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!locked && value.trim()) submit();
        }}
        className="flex items-center gap-3"
      >
        <label htmlFor={`${id}-input`} className="sr-only">
          Your estimate{exercise.unit ? ` in ${exercise.unit}` : ""}
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
      <div className="mt-3 space-y-2">
        {exercise.hints.slice(0, shown).map((h, i) => (
          <p key={i} className="rounded-lg border border-border bg-ink p-3 text-base">
            <Lightbulb className="mr-1 inline size-4 text-gold-ink" aria-hidden /> Step {i + 1}. {h}
          </p>
        ))}
        {shown < exercise.hints.length && !locked && (
          <button
            type="button"
            onClick={() => setShown((n) => n + 1)}
            className="tap inline-flex min-h-12 items-center gap-1.5 text-base font-bold text-gold-ink underline underline-offset-4"
            data-testid={`${id}-hint`}
          >
            <Lightbulb className="size-4" aria-hidden /> {shown === 0 ? "Show the first step" : "Next step"}
          </button>
        )}
      </div>
    </div>
  );
}
