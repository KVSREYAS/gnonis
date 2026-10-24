import { z } from "zod";
import { devicesField, nonEmpty } from "../shared";

export const dragSortSchema = z
  .object({
    type: z.literal("drag-sort"),
    devices: devicesField,
    prompt: nonEmpty,
    /** Correct order, top first. The widget shuffles. Items must be unique. */
    items: z.array(nonEmpty).min(3).max(8),
    explanation: nonEmpty,
  })
  .strict()
  .superRefine((ex, ctx) => {
    if (new Set(ex.items).size !== ex.items.length)
      ctx.addIssue({ code: "custom", path: ["items"], message: "drag-sort items must be unique" });
  });
