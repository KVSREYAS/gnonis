import { z } from "zod";
import { devicesField, nonEmpty } from "../shared";

const fields = {
  prompt: nonEmpty.optional(),
  /** Sentence with numbered blanks: "Attention uses {{0}} and {{1}}." */
  text: nonEmpty,
  chips: z.array(nonEmpty).min(2).max(10),
  /** answers[i] is the chip that belongs in blank {{i}} */
  answers: z.array(nonEmpty).min(1),
  explanation: nonEmpty,
};

export function checkFill(ex: { text: string; answers: string[]; chips: string[] }, ctx: z.RefinementCtx, path: (string | number)[] = []) {
  const blanks = [...ex.text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  const expected = ex.answers.map((_, i) => i);
  if (blanks.length !== ex.answers.length || !expected.every((i) => blanks.includes(i)))
    ctx.addIssue({
      code: "custom",
      path: [...path, "text"],
      message: `text must contain blanks {{0}}..{{${ex.answers.length - 1}}} exactly once each`,
    });
  ex.answers.forEach((a, i) => {
    if (!ex.chips.includes(a))
      ctx.addIssue({ code: "custom", path: [...path, "answers", i], message: `answer "${a}" is not one of the chips` });
  });
}

export const fillPartSchema = z.object({ type: z.literal("fill"), ...fields }).strict().superRefine((ex, ctx) => checkFill(ex, ctx));
export const fillSchema = z
  .object({ type: z.literal("fill"), ...fields, devices: devicesField })
  .strict()
  .superRefine((ex, ctx) => checkFill(ex, ctx));
