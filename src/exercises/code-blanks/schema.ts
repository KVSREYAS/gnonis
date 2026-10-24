import { z } from "zod";
import { devicesField, nonEmpty } from "../shared";

const blank = z
  .object({
    /** Shown after a miss. Also the value the pattern must accept. */
    answer: nonEmpty,
    /** When set, the learner's text must match this regex. Otherwise the check is an exact trim match. */
    pattern: z.string().min(1).max(200).optional(),
  })
  .strict();

export const codeBlanksSchema = z
  .object({
    type: z.literal("code-blanks"),
    devices: devicesField,
    prompt: nonEmpty,
    /** Snippet with {{0}}, {{1}}, ... where the blanks go. */
    code: nonEmpty,
    blanks: z.array(blank).min(1).max(6),
    explanation: nonEmpty,
  })
  .strict()
  .superRefine((ex, ctx) => {
    const found = [...ex.code.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    const expected = ex.blanks.map((_, i) => i);
    if (found.length !== ex.blanks.length || !expected.every((i) => found.includes(i)))
      ctx.addIssue({
        code: "custom",
        path: ["code"],
        message: `code must contain blanks {{0}}..{{${ex.blanks.length - 1}}} exactly once each`,
      });
    ex.blanks.forEach((b, i) => {
      if (!b.pattern) return;
      try {
        const re = new RegExp(b.pattern);
        if (!re.test(b.answer.trim()))
          ctx.addIssue({ code: "custom", path: ["blanks", i, "pattern"], message: "pattern does not match the published answer" });
      } catch {
        ctx.addIssue({ code: "custom", path: ["blanks", i, "pattern"], message: "pattern is not a valid regex" });
      }
    });
  });
