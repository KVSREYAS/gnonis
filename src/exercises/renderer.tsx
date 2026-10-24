"use client";

import type { ComponentType } from "react";
import type { WidgetProps } from "@/components/widgets/types";
import { Renderer as BossRenderer } from "./boss/renderer";
import { Renderer as CodeRenderer } from "./code/renderer";
import { Renderer as CodeBlanksRenderer } from "./code-blanks/renderer";
import { Renderer as DebugRenderer } from "./debug/renderer";
import { Renderer as DragSortRenderer } from "./drag-sort/renderer";
import { Renderer as EnvelopeRenderer } from "./envelope/renderer";
import { Renderer as FillRenderer } from "./fill/renderer";
import { Renderer as McqRenderer } from "./mcq/renderer";
import { Renderer as OrderingRenderer } from "./ordering/renderer";
import { Renderer as ParsonsRenderer } from "./parsons/renderer";
import { Renderer as PredictRenderer } from "./predict/renderer";
import { Renderer as PredictRevealRenderer } from "./predict-reveal/renderer";
import { Renderer as SimulatorRenderer } from "./simulator/renderer";
import { Renderer as SliderDiagramRenderer } from "./slider-diagram/renderer";
import { Renderer as SpotBugRenderer } from "./spot-bug/renderer";
import { Renderer as StepperRenderer } from "./stepper/renderer";
import { Renderer as TraceRenderer } from "./trace/renderer";
import { EXERCISES, type Exercise, type ExerciseType } from "./registry";

const RENDERERS: { [T in ExerciseType]: ComponentType<WidgetProps<Extract<Exercise, { type: T }>>> } = {
  mcq: McqRenderer,
  fill: FillRenderer,
  ordering: OrderingRenderer,
  predict: PredictRenderer,
  simulator: SimulatorRenderer,
  stepper: StepperRenderer,
  code: CodeRenderer,
  debug: DebugRenderer,
  boss: BossRenderer,
  "predict-reveal": PredictRevealRenderer,
  envelope: EnvelopeRenderer,
  trace: TraceRenderer,
  "drag-sort": DragSortRenderer,
  "spot-bug": SpotBugRenderer,
  parsons: ParsonsRenderer,
  "code-blanks": CodeBlanksRenderer,
  "slider-diagram": SliderDiagramRenderer,
};

export function ExerciseRenderer(props: WidgetProps<Exercise>) {
  const C = RENDERERS[props.exercise.type] as ComponentType<WidgetProps<Exercise>>;
  return <C {...props} />;
}

export function exerciseLabel(type: ExerciseType): string {
  return EXERCISES[type].label;
}
