import { z } from "zod";
import { fillPartSchema } from "../fill/schema";
import { mcqPartSchema } from "../mcq/schema";
import { orderingPartSchema } from "../ordering/schema";
import { predictPartSchema } from "../predict/schema";
import { devicesField, nonEmpty } from "../shared";

export const bossPartSchema = z.discriminatedUnion("type", [mcqPartSchema, fillPartSchema, orderingPartSchema, predictPartSchema]);
export type BossPart = z.infer<typeof bossPartSchema>;

export const bossSchema = z
  .object({
    type: z.literal("boss"),
    devices: devicesField,
    title: nonEmpty,
    briefing: nonEmpty,
    timeLimit: z.number().int().min(20).max(900),
    playerHp: z.number().int().min(1).max(6).default(3),
    parts: z.array(bossPartSchema).min(2).max(8),
    explanation: nonEmpty,
  })
  .strict();
