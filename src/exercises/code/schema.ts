import { z } from "zod";
import { devicesField, nonEmpty } from "../shared";

export const codeSchema = z
  .object({
    type: z.literal("code"),
    devices: devicesField,
    language: z.enum(["python"]),
    prompt: nonEmpty,
    starter: nonEmpty,
    /** Hidden tests: functions named test_* using assert. Run after the learner's code in the same namespace. */
    tests: nonEmpty,
    /** Reference solution, used by CI to prove the hidden tests are passable. Never shown verbatim. */
    solution: nonEmpty,
    hints: z.array(nonEmpty).default([]),
    explanation: nonEmpty,
  })
  .strict();
