import { z } from "zod";
import { bossSchema } from "./boss/schema";
import { codeSchema } from "./code/schema";
import { codeBlanksSchema } from "./code-blanks/schema";
import { debugSchema } from "./debug/schema";
import { dragSortSchema } from "./drag-sort/schema";
import { envelopeSchema } from "./envelope/schema";
import { fillSchema } from "./fill/schema";
import { mcqSchema } from "./mcq/schema";
import { orderingSchema } from "./ordering/schema";
import { parsonsSchema } from "./parsons/schema";
import { predictSchema } from "./predict/schema";
import { predictRevealSchema } from "./predict-reveal/schema";
import { simulatorSchema } from "./simulator/schema";
import { sliderDiagramSchema } from "./slider-diagram/schema";
import { spotBugSchema } from "./spot-bug/schema";
import { stepperSchema } from "./stepper/schema";
import { traceSchema } from "./trace/schema";

function defineExercise<S extends z.ZodType>(spec: {
  type: z.infer<S> extends { type: infer T } ? T & string : string;
  tag: string;
  label: string;
  schema: S;
}) {
  return spec;
}

/**
 * One line per exercise type. The folder next to it holds the Zod schema and the renderer.
 * Adding a type means that folder plus a line in this list and a line in renderer.tsx.
 */
export const EXERCISE_LIST = [
  defineExercise({ type: "mcq", tag: "MCQ", label: "Quick check", schema: mcqSchema }),
  defineExercise({ type: "fill", tag: "Fill", label: "Fill the blanks", schema: fillSchema }),
  defineExercise({ type: "ordering", tag: "Ordering", label: "Put in order", schema: orderingSchema }),
  defineExercise({ type: "predict", tag: "Predict", label: "Predict the number", schema: predictSchema }),
  defineExercise({ type: "simulator", tag: "Simulator", label: "Tuning simulator", schema: simulatorSchema }),
  defineExercise({ type: "stepper", tag: "Stepper", label: "Step-through", schema: stepperSchema }),
  defineExercise({ type: "code", tag: "Code", label: "Code puzzle", schema: codeSchema }),
  defineExercise({ type: "debug", tag: "Debug", label: "Debug this", schema: debugSchema }),
  defineExercise({ type: "boss", tag: "Boss", label: "Boss fight", schema: bossSchema }),
  defineExercise({ type: "predict-reveal", tag: "PredictReveal", label: "Predict and reveal", schema: predictRevealSchema }),
  defineExercise({ type: "envelope", tag: "Envelope", label: "Back of the envelope", schema: envelopeSchema }),
  defineExercise({ type: "trace", tag: "Trace", label: "Trace the code", schema: traceSchema }),
  defineExercise({ type: "drag-sort", tag: "DragSort", label: "Drag sort", schema: dragSortSchema }),
  defineExercise({ type: "spot-bug", tag: "SpotBug", label: "Spot the bug", schema: spotBugSchema }),
  defineExercise({ type: "parsons", tag: "Parsons", label: "Parsons", schema: parsonsSchema }),
  defineExercise({ type: "code-blanks", tag: "CodeBlanks", label: "Fill the code", schema: codeBlanksSchema }),
  defineExercise({ type: "slider-diagram", tag: "SliderDiagram", label: "Slider diagram", schema: sliderDiagramSchema }),
];

type Entry = (typeof EXERCISE_LIST)[number];
export type Exercise = z.infer<Entry["schema"]>;
export type ExerciseType = Exercise["type"];
export type ExerciseOf<T extends ExerciseType> = Extract<Exercise, { type: T }>;

export const EXERCISE_TYPES = EXERCISE_LIST.map((e) => e.type) as ExerciseType[];
export const EXERCISE_TAGS = EXERCISE_LIST.map((e) => e.tag);

export const EXERCISES = Object.fromEntries(EXERCISE_LIST.map((e) => [e.type, e])) as {
  [T in ExerciseType]: Extract<Entry, { type: T }>;
};

const members = EXERCISE_LIST.map((e) => e.schema) as unknown as [
  z.ZodObject<{ type: z.ZodLiteral<string> }>,
  ...z.ZodObject<{ type: z.ZodLiteral<string> }>[],
];

export const ExerciseSchema = z.discriminatedUnion("type", members) as unknown as z.ZodType<Exercise>;

export function exerciseTypeForTag(tag: string): ExerciseType | undefined {
  return EXERCISE_LIST.find((e) => e.tag === tag)?.type;
}
