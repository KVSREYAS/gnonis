import { z } from "zod";
import { devicesField, nonEmpty } from "../shared";

export const debugSchema = z
  .object({
    type: z.literal("debug"),
    devices: devicesField,
    mode: z.enum(["line", "code"]),
    language: z.enum(["python"]),
    prompt: nonEmpty,
    code: nonEmpty,
    /** line mode: 1-indexed line that holds the bug */
    bugLine: z.number().int().positive().optional(),
    /** code mode: hidden tests the fixed code must pass */
    tests: nonEmpty.optional(),
    solution: nonEmpty.optional(),
    explanation: nonEmpty,
  })
  .strict()
  .superRefine((ex, ctx) => {
    if (ex.mode === "line") {
      const lines = ex.code.split("\n").length;
      if (!ex.bugLine || ex.bugLine > lines)
        ctx.addIssue({ code: "custom", path: ["bugLine"], message: "line-mode debug needs a bugLine inside the code" });
    } else if (!ex.tests || !ex.solution) {
      ctx.addIssue({ code: "custom", path: ["tests"], message: "code-mode debug needs tests and a solution" });
    }
  });
