"use client";

import type { ComponentType } from "react";
import type { Exercise, ExerciseType } from "@/lib/content/schema";
import { BossWidget } from "./boss";
import { CodeWidget } from "./code";
import { DebugWidget } from "./debug";
import { FillWidget } from "./fill";
import { McqWidget } from "./mcq";
import { OrderingWidget } from "./ordering";
import { PredictWidget } from "./predict";
import { SimulatorWidget } from "./simulator";
import { StepperWidget } from "./stepper";
import type { WidgetProps } from "./types";

type Entry<T extends ExerciseType> = {
  label: string;
  component: ComponentType<WidgetProps<Extract<Exercise, { type: T }>>>;
};

/** One entry per exercise type in the content schema. Adding a type = schema + component + entry here. */
export const WIDGETS: { [T in ExerciseType]: Entry<T> } = {
  mcq: { label: "Quick check", component: McqWidget },
  fill: { label: "Fill the blanks", component: FillWidget },
  ordering: { label: "Put in order", component: OrderingWidget },
  predict: { label: "Predict the number", component: PredictWidget },
  simulator: { label: "Tuning simulator", component: SimulatorWidget },
  stepper: { label: "Step-through", component: StepperWidget },
  code: { label: "Code puzzle", component: CodeWidget },
  debug: { label: "Debug this", component: DebugWidget },
  boss: { label: "Boss fight", component: BossWidget },
};

export function ExerciseRenderer(props: WidgetProps<Exercise>) {
  const entry = WIDGETS[props.exercise.type] as Entry<ExerciseType>;
  const C = entry.component as ComponentType<WidgetProps<Exercise>>;
  return <C {...props} />;
}
