import { z } from "zod";
import { devicesField, nonEmpty } from "../shared";

export const SimGoalSchema = z.object({
  output: nonEmpty,
  op: z.enum(["lt", "lte", "gt", "gte", "between"]),
  value: z.number(),
  max: z.number().optional(),
  description: nonEmpty,
});
export type SimGoal = z.infer<typeof SimGoalSchema>;

export const simulatorSchema = z
  .object({
    type: z.literal("simulator"),
    devices: devicesField,
    /** Id of a simulation in the simulation registry (src/lib/sims). */
    sim: nonEmpty,
    prompt: nonEmpty,
    /** Initial slider values, keyed by slider id. */
    params: z.record(z.string(), z.number()).optional(),
    /** Slider ids to hide, so a mission can focus on a few knobs. */
    locked: z.array(z.string()).optional(),
    goal: SimGoalSchema.optional(),
    explanation: nonEmpty,
  })
  .strict()
  .superRefine((ex, ctx) => {
    if (ex.goal?.op === "between" && ex.goal.max === undefined)
      ctx.addIssue({ code: "custom", path: ["goal", "max"], message: "between goals need a max" });
  });
