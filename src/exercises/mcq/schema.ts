import { z } from "zod";
import { devicesField, nonEmpty } from "../shared";

const fields = {
  prompt: nonEmpty,
  options: z.array(nonEmpty).min(2).max(6),
  answer: z.number().int().nonnegative(),
  explanation: nonEmpty,
};

function check(ex: { answer: number; options: string[] }, ctx: z.RefinementCtx) {
  if (ex.answer >= ex.options.length)
    ctx.addIssue({ code: "custom", path: ["answer"], message: `answer index ${ex.answer} is out of range` });
}

export const mcqPartSchema = z.object({ type: z.literal("mcq"), ...fields }).strict().superRefine(check);
export const mcqSchema = z.object({ type: z.literal("mcq"), ...fields, devices: devicesField }).strict().superRefine(check);
