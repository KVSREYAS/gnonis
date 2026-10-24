import { z } from "zod";
import { devicesField, nonEmpty } from "../shared";

export const sliderDiagramSchema = z
  .object({
    type: z.literal("slider-diagram"),
    devices: devicesField,
    prompt: nonEmpty,
    xLabel: nonEmpty,
    yLabel: nonEmpty,
    unit: z.string().optional(),
    min: z.number(),
    max: z.number(),
    step: z.number().positive().default(1),
    initial: z.number(),
    /** Curve samples. The marker interpolates between them as the slider moves. */
    points: z.array(z.object({ x: z.number(), y: z.number() })).min(2).max(24),
    goal: z.object({
      op: z.enum(["lt", "lte", "gt", "gte", "between"]),
      value: z.number(),
      max: z.number().optional(),
      description: nonEmpty,
    }),
    explanation: nonEmpty,
  })
  .strict()
  .superRefine((ex, ctx) => {
    if (ex.min >= ex.max) ctx.addIssue({ code: "custom", path: ["min"], message: "min must be less than max" });
    if (ex.initial < ex.min || ex.initial > ex.max)
      ctx.addIssue({ code: "custom", path: ["initial"], message: "initial value must sit on the slider range" });
    if (ex.goal.op === "between" && ex.goal.max === undefined)
      ctx.addIssue({ code: "custom", path: ["goal", "max"], message: "between goals need a max" });
    const xs = ex.points.map((p) => p.x);
    if (new Set(xs).size !== xs.length) ctx.addIssue({ code: "custom", path: ["points"], message: "point x values must be unique" });
  });
