import { z } from "zod";
import { devicesField, nonEmpty } from "../shared";

export const traceSchema = z
  .object({
    type: z.literal("trace"),
    devices: devicesField,
    prompt: nonEmpty,
    code: nonEmpty,
    /** 1-indexed lines, in the order the learner steps through them. */
    steps: z.array(z.object({ line: z.number().int().positive(), note: nonEmpty })).min(1).max(12),
    question: nonEmpty,
    /** Exact text of what the snippet prints or the value at the asked line, after trim. */
    answer: nonEmpty,
    explanation: nonEmpty,
  })
  .strict()
  .superRefine((ex, ctx) => {
    const lines = ex.code.split("\n").length;
    ex.steps.forEach((s, i) => {
      if (s.line > lines) ctx.addIssue({ code: "custom", path: ["steps", i, "line"], message: `line ${s.line} is past the end of the snippet` });
    });
  });
