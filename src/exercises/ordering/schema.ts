import { z } from "zod";
import { devicesField, nonEmpty } from "../shared";

const fields = {
  prompt: nonEmpty,
  /** Items listed in the CORRECT order. The widget shuffles them. */
  items: z.array(nonEmpty).min(3).max(8),
  explanation: nonEmpty,
};

function check(ex: { items: string[] }, ctx: z.RefinementCtx) {
  if (new Set(ex.items).size !== ex.items.length)
    ctx.addIssue({ code: "custom", path: ["items"], message: "ordering items must be unique" });
}

export const orderingPartSchema = z.object({ type: z.literal("ordering"), ...fields }).strict().superRefine(check);
export const orderingSchema = z.object({ type: z.literal("ordering"), ...fields, devices: devicesField }).strict().superRefine(check);
