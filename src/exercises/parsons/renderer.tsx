"use client";

import { useState } from "react";
import type { ExerciseOf } from "@/exercises/schema";
import { gradeParsons, shuffleForOrdering } from "@/lib/grading";
import { Prompt } from "@/components/widgets/inline-text";
import type { WidgetProps } from "@/components/widgets/types";
import { usePrimaryAction } from "@/components/widgets/useAction";
import { ReorderList } from "../reorder";

export function Renderer({ id, exercise, device, setAction, onGrade, locked }: WidgetProps<ExerciseOf<"parsons">>) {
  const [order, setOrder] = useState(() => shuffleForOrdering(exercise.lines, id + exercise.prompt));
  usePrimaryAction(setAction, locked ? null : { label: "Check order", onPress: () => onGrade(gradeParsons(exercise, order)) });

  return (
    <div>
      <Prompt text={exercise.prompt} />
      <p className="mb-3 text-sm text-muted-foreground">Put the lines back in order. Arrows work on a phone. Drag works with a pointer. Indentation matters.</p>
      <ReorderList id={id} order={order} locked={locked} solved={exercise.lines} canDrag={device === "desktop"} mono onOrder={setOrder} />
    </div>
  );
}
