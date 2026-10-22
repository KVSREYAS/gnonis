"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import type { BossPart } from "@/lib/content/schema";
import { gradeMcq } from "@/lib/grading";
import { cn } from "@/lib/utils";
import { InlineText, Prompt } from "./inline-text";
import type { WidgetProps } from "./types";
import { usePrimaryAction } from "./useAction";

export function McqWidget({ id, exercise, setAction, onGrade, locked }: WidgetProps<Extract<BossPart, { type: "mcq" }>>) {
  const [selected, setSelected] = useState<number | null>(null);

  usePrimaryAction(setAction, locked ? null : { label: "Check", disabled: selected === null, onPress: () => onGrade(gradeMcq(exercise, selected)) });

  return (
    <div>
      <Prompt text={exercise.prompt} />
      <div role="radiogroup" aria-label="Answers" className="grid gap-2">
        {exercise.options.map((opt, i) => {
          const isSel = selected === i;
          const isAnswer = locked && i === exercise.answer;
          const isWrongPick = locked && isSel && i !== exercise.answer;
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={isSel}
              disabled={locked}
              data-testid={`${id}-option-${i}`}
              onClick={() => setSelected(i)}
              className={cn(
                "flex min-h-12 w-full items-center gap-3 rounded-lg border-2 bg-ink px-4 py-2.5 text-left text-base text-foreground transition-colors",
                isSel && !locked ? "border-gold" : "border-border hover:border-muted-foreground/60",
                isAnswer && "border-money",
                isWrongPick && "border-danger",
              )}
            >
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border-2 font-display text-sm",
                  isSel ? "border-gold bg-gold text-ink" : "border-border text-muted-foreground",
                  isAnswer && "border-money bg-money text-ink",
                  isWrongPick && "border-danger bg-danger text-white",
                )}
                aria-hidden
              >
                {isAnswer ? <Check className="size-4" /> : isWrongPick ? <X className="size-4" /> : String.fromCharCode(65 + i)}
              </span>
              <span>
                <InlineText text={opt} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
