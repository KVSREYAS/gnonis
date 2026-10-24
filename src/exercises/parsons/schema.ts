import { z } from "zod";
import { devicesField, nonEmpty } from "../shared";

export const parsonsSchema = z
  .object({
    type: z.literal("parsons"),
    devices: devicesField,
    prompt: nonEmpty,
    /** Correct order, including indentation. Lines must be unique so a tap target is unambiguous. */
    lines: z.array(nonEmpty).min(3).max(10),
    explanation: nonEmpty,
  })
  .strict()
  .superRefine((ex, ctx) => {
    if (new Set(ex.lines).size !== ex.lines.length)
      ctx.addIssue({ code: "custom", path: ["lines"], message: "parsons lines must be unique" });
  });
