"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  order: string[];
  locked: boolean;
  solved: string[];
  canDrag: boolean;
  mono?: boolean;
  onOrder: (order: string[]) => void;
};

/** Tap two rows to swap, or use the arrow buttons. Drag is an extra on a fine pointer. */
export function ReorderList({ id, order, locked, solved, canDrag, mono, onOrder }: Props) {
  const [picked, setPicked] = useState<number | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  const swap = (a: number, b: number) => {
    if (a === b || locked) return;
    const next = [...order];
    [next[a], next[b]] = [next[b], next[a]];
    onOrder(next);
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    swap(i, j);
    setPicked(null);
  };

  return (
    <ol className="grid gap-2" aria-label="Items to reorder">
      {order.map((item, i) => {
        const right = locked && solved[i] === item;
        return (
          <li key={item} className="flex items-stretch gap-1">
            <button
              type="button"
              draggable={canDrag && !locked}
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
              }}
              onDragEnd={() => setDragFrom(null)}
              onClick={() => {
                if (locked) return;
                if (picked === null) setPicked(i);
                else {
                  swap(picked, i);
                  setPicked(null);
                }
              }}
              disabled={locked}
              aria-pressed={picked === i}
              data-testid={`${id}-item-${i}`}
              className={cn(
                "flex min-h-12 flex-1 items-center gap-3 rounded-lg border-2 bg-ink px-3 py-2 text-left text-base text-foreground",
                picked === i ? "border-gold bg-panel-2" : "border-border",
                dragFrom === i && "opacity-50",
                canDrag && !locked && "cursor-grab active:cursor-grabbing",
                locked && (right ? "border-money" : "border-danger"),
              )}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded bg-panel-2 font-display text-sm text-gold-ink" aria-hidden>
                {i + 1}
              </span>
              <span className={cn("flex-1 whitespace-pre", mono && "font-mono text-sm")}>{item}</span>
              {canDrag && !locked && <GripVertical className="size-5 shrink-0 text-muted-foreground" aria-hidden />}
            </button>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                aria-label={`Move item ${i + 1} up`}
                disabled={locked || i === 0}
                onClick={() => move(i, -1)}
                className="grid size-11 place-items-center rounded-lg border-2 border-border bg-ink text-foreground disabled:opacity-40"
              >
                <ChevronUp className="size-5" />
              </button>
              <button
                type="button"
                aria-label={`Move item ${i + 1} down`}
                disabled={locked || i === order.length - 1}
                onClick={() => move(i, 1)}
                className="grid size-11 place-items-center rounded-lg border-2 border-border bg-ink text-foreground disabled:opacity-40"
              >
                <ChevronDown className="size-5" />
              </button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
