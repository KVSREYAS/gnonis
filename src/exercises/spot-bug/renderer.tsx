"use client";

import { useState } from "react";
import type { ExerciseOf } from "@/exercises/schema";
import { gradeSpotBug } from "@/lib/grading";
import { cn } from "@/lib/utils";
import { Prompt } from "@/components/widgets/inline-text";
import type { WidgetProps } from "@/components/widgets/types";
import { usePrimaryAction } from "@/components/widgets/useAction";

export function Renderer({ id, exercise, setAction, onGrade, locked }: WidgetProps<ExerciseOf<"spot-bug">>) {
  const [line, setLine] = useState<number | null>(null);
  const lines = exercise.code.split("\n");
  usePrimaryAction(setAction, locked ? null : { label: "That's the bug", disabled: line === null, onPress: () => onGrade(gradeSpotBug(exercise, line)) });

  return (
    <div>
      <Prompt text={exercise.prompt} />
      <p className="mb-3 text-sm text-muted-foreground">Tap the line that is wrong.</p>
      <div className="overflow-hidden rounded-lg border-2 border-border bg-ink" role="listbox" aria-label="Code lines">
        {lines.map((text, i) => {
          const n = i + 1;
          const sel = line === n;
          const isBug = locked && n === exercise.bugLine;
          const wrong = locked && sel && !isBug;
          return (
            <button
              key={n}
              type="button"
              role="option"
              aria-selected={sel}
              disabled={locked || !text.trim()}
              data-testid={`${id}-line-${n}`}
              onClick={() => setLine(n)}
              className={cn(
                "flex min-h-12 w-full items-start gap-3 px-3 py-2 text-left font-mono text-sm leading-6",
                sel && !locked && "bg-gold/15",
                isBug && "bg-money/20",
                wrong && "bg-danger/20",
              )}
            >
              <span className="w-6 shrink-0 text-right text-muted-foreground">{n}</span>
              <span className="whitespace-pre text-foreground">{text || " "}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
