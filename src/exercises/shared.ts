import { z } from "zod";

export const nonEmpty = z.string().trim().min(1);

/** Phone and desktop unless an exercise opts out. Code puzzles opt out. */
export const devicesField = z
  .array(z.enum(["phone", "desktop"]))
  .min(1, "declare at least one device")
  .default(["phone", "desktop"])
  .refine((d) => new Set(d).size === d.length, "devices must be unique");

export const toleranceField = z
  .object({
    mode: z.enum(["relative", "absolute"]),
    value: z.number().nonnegative(),
  })
  .default({ mode: "relative", value: 0.05 });

export type Tolerance = z.infer<typeof toleranceField>;
