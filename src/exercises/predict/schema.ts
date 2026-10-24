import { z } from "zod";
import { devicesField, nonEmpty, toleranceField } from "../shared";

const fields = {
  prompt: nonEmpty,
  answer: z.number(),
  tolerance: toleranceField,
  unit: z.string().optional(),
  hint: z.string().optional(),
  explanation: nonEmpty,
};

export const predictPartSchema = z.object({ type: z.literal("predict"), ...fields }).strict();
export const predictSchema = z.object({ type: z.literal("predict"), ...fields, devices: devicesField }).strict();
