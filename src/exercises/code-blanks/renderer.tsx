"use client";

import { useState } from "react";
import type { ExerciseOf } from "@/exercises/schema";
import { blankAccepted, gradeCodeBlanks } from "@/lib/grading";
import { Prompt } from "@/components/widgets/inline-text";
import type { WidgetProps } from "@/components/widgets/types";
import { usePrimaryAction } from "@/components/widgets/useAction";

export function Renderer({ id, exercise, setAction, onGrade, locked }: WidgetProps<ExerciseOf<"code-blanks">>) {
  const [values, setValues] = useState<string[]>(() => exercise.blanks.map(() => ""));
  const parts = exercise.code.split(/(\{\{\d+\}\})/g);
  const submit = () => onGrade(gradeCodeBlanks(exercise, values));
  const ready = values.every((v) => v.trim() !== "");

  usePrimaryAction(setAction, locked ? null : { label: "Check", disabled: !ready, onPress: submit });

  return (
    <div>
      <Prompt text={exercise.prompt} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!locked && ready) submit();
        }}
        className="overflow-x-auto rounded-lg border-2 border-border bg-ink p-3 font-mono text-sm leading-8 text-foreground"
      >
        {parts.map((part, i) => {
          const m = part.match(/^\{\{(\d+)\}\}$/);
          if (!m) return <span key={i} className="whitespace-pre">{part}</span>;
          const n = Number(m[1]);
          const blank = exercise.blanks[n];
          const wrong = locked && !blankAccepted(blank, values[n] ?? "");
          return (
            <input
              key={i}
              aria-label={`Blank ${n + 1}`}
              data-testid={`${id}-blank-${n}`}
              value={values[n] ?? ""}
              disabled={locked}
              onChange={(e) => setValues((prev) => prev.map((v, j) => (j === n ? e.target.value : v)))}
              className={`mx-1 inline-block h-11 min-w-24 rounded border-2 bg-panel px-2 align-middle text-foreground focus:border-gold focus:outline-none ${
                locked ? (wrong ? "border-danger" : "border-money") : "border-gold/70"
              }`}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          );
        })}
      </form>
    </div>
  );
}
