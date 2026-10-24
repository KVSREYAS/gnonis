import { z } from "zod";
import { devicesField, nonEmpty, toleranceField } from "../shared";

export const predictRevealSchema = z
  .object({
    type: z.literal("predict-reveal"),
    devices: devicesField,
    prompt: nonEmpty,
    min: z.number(),
    max: z.number(),
    step: z.number().positive().default(1),
    answer: z.number(),
    tolerance: toleranceField,
    unit: z.string().optional(),
    /** Bars revealed after the guess is locked in. */
    series: z.array(z.object({ label: nonEmpty, value: z.number() })).min(1).max(8),
    explanation: nonEmpty,
  })
  .strict()
  .superRefine((ex, ctx) => {
    if (ex.min >= ex.max) ctx.addIssue({ code: "custom", path: ["min"], message: "min must be less than max" });
    if (ex.answer < ex.min || ex.answer > ex.max)
      ctx.addIssue({ code: "custom", path: ["answer"], message: "answer must sit on the slider range" });
  });
