import { z } from "zod";
import { devicesField, nonEmpty, toleranceField } from "../shared";

export const envelopeSchema = z
  .object({
    type: z.literal("envelope"),
    devices: devicesField,
    prompt: nonEmpty,
    /** Facts the learner is allowed to use, shown up front. */
    given: z.array(nonEmpty).min(1).max(8),
    /** Revealed one at a time. The last hint should be enough to finish the sum. */
    hints: z.array(nonEmpty).min(1).max(6),
    answer: z.number(),
    tolerance: toleranceField,
    unit: z.string().optional(),
    explanation: nonEmpty,
  })
  .strict();
