import { z } from "zod";
import { devicesField, nonEmpty } from "../shared";

export const spotBugSchema = z
  .object({
    type: z.literal("spot-bug"),
    devices: devicesField,
    prompt: nonEmpty,
    code: nonEmpty,
    /** 1-indexed line that holds the bug. */
    bugLine: z.number().int().positive(),
    explanation: nonEmpty,
  })
  .strict()
  .superRefine((ex, ctx) => {
    const lines = ex.code.split("\n").length;
    if (ex.bugLine > lines) ctx.addIssue({ code: "custom", path: ["bugLine"], message: "bugLine is past the end of the code" });
  });
