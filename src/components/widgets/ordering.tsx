"use client";

import { useState } from "react";
import { GripVertical } from "lucide-react";
import type { BossPart } from "@/lib/content/schema";
import { gradeOrdering, shuffleForOrdering } from "@/lib/grading";
import { cn } from "@/lib/utils";
import { InlineText, Prompt } from "./inline-text";
import type { WidgetProps } from "./types";
import { usePrimaryAction } from "./useAction";

/** Tap two items to swap them. On desktop you can also drag an item onto another. */
export function OrderingWidget({ id, exercise, device, setAction, onGrade, locked }: WidgetProps<Extract<BossPart, { type: "ordering" }>>) {
  const [order, setOrder] = useState(() => shuffleForOrdering(exercise.items, id + exercise.prompt));
  const [picked, setPicked] = useState<number | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const canDrag = device === "desktop" && !locked;

  usePrimaryAction(setAction, locked ? null : { label: touched ? "Check" : "Check order", onPress: () => onGrade(gradeOrdering(exercise, order)) });

  const swap = (a: number, b: number) => {
    if (a === b) return;
    setOrder((prev) => {
      const next = [...prev];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
    setTouched(true);
  };

  const tap = (i: number) => {
    if (locked) return;
    if (picked === null) setPicked(i);
    else {
      swap(picked, i);
      setPicked(null);
    }
  };

  return (
    <div>
      <Prompt text={exercise.prompt} />
      <p className="mb-3 text-sm text-muted-foreground">
        {device === "desktop" ? "Drag items, or tap two items to swap them." : "Tap two items to swap them."} Top is first.
      </p>
      <ol className="grid gap-2" aria-label="Items to order">
        {order.map((item, i) => {
          const right = locked && exercise.items[i] === item;
          return (
            <li key={item}>
              <button
                type="button"
                draggable={canDrag}
                onDragStart={(e) => {
                  setDragFrom(i);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(i));
                }}
                onDragOver={(e) => canDrag && e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragFrom !== null) swap(dragFrom, i);
                  setDragFrom(null);
                  setPicked(null);
                }}
                onDragEnd={() => setDragFrom(null)}
                onClick={() => tap(i)}
                disabled={locked}
                aria-pressed={picked === i}
                aria-label={`Position ${i + 1}: ${item}${picked === i ? " (selected, tap another to swap)" : ""}`}
                data-testid={`${id}-item-${i}`}
                className={cn(
                  "flex min-h-12 w-full items-center gap-3 rounded-lg border-2 bg-ink px-3 py-2 text-left text-base text-foreground",
                  picked === i ? "border-gold bg-panel-2" : "border-border",
                  dragFrom === i && "opacity-50",
                  canDrag && "cursor-grab active:cursor-grabbing",
                  locked && (right ? "border-money" : "border-danger"),
                )}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded bg-panel-2 font-display text-sm text-gold-ink" aria-hidden>
                  {i + 1}
                </span>
                <span className="flex-1">
                  <InlineText text={item} />
                </span>
                {canDrag && <GripVertical className="size-5 text-muted-foreground" aria-hidden />}
              </button>
            </li>
          );
        })}
      </ol>
      {locked && order.some((x, i) => exercise.items[i] !== x) && (
        <div className="mt-3 rounded-lg border border-border bg-ink p-3 text-base">
          <p className="mb-1 font-bold">Correct order</p>
          <ol className="list-decimal pl-5 text-muted-foreground">
            {exercise.items.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
