import { z } from "zod";
import { devicesField, nonEmpty } from "../shared";

export const codeSchema = z
  .object({
    type: z.literal("code"),
    devices: devicesField,
    language: z.enum(["python", "cpp"]),
    prompt: nonEmpty,
    starter: nonEmpty,
    /**
     * Hidden tests. Python: test_* functions with assert, run after the learner's code.
     * C++: a test file with its own main(), compiled in one translation unit with the learner.
     * The runner provides check.h. CHECK prints file:line and the expression, then exits 1.
     * Exit 0 means every check passed.
     * This field name stays `tests` so existing Python exercises keep their content hash.
     */
    tests: nonEmpty,
    /** Sample tests in the same format. Run shows them. Submit does not grade them. */
    visibleTests: nonEmpty.optional(),
    /** Reference solution, used by CI to prove the hidden tests are passable. Never shown verbatim. */
    solution: nonEmpty,
    hints: z.array(nonEmpty).default([]),
    explanation: nonEmpty,
  })
  .strict();
