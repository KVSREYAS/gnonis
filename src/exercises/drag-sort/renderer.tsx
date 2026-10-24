"use client";

import { useState } from "react";
import type { ExerciseOf } from "@/exercises/schema";
import { gradeDragSort, shuffleForOrdering } from "@/lib/grading";
import { Prompt } from "@/components/widgets/inline-text";
import type { WidgetProps } from "@/components/widgets/types";
import { usePrimaryAction } from "@/components/widgets/useAction";
import { ReorderList } from "../reorder";

export function Renderer({ id, exercise, device, setAction, onGrade, locked }: WidgetProps<ExerciseOf<"drag-sort">>) {
  const [order, setOrder] = useState(() => shuffleForOrdering(exercise.items, id + exercise.prompt));
  usePrimaryAction(setAction, locked ? null : { label: "Check order", onPress: () => onGrade(gradeDragSort(exercise, order)) });

  return (
    <div>
      <Prompt text={exercise.prompt} />
      <p className="mb-3 text-sm text-muted-foreground">Tap two rows to swap, or use the arrows. Drag when you have a pointer. Top is first.</p>
      <ReorderList id={id} order={order} locked={locked} solved={exercise.items} canDrag={device === "desktop"} onOrder={setOrder} />
    </div>
  );
}
