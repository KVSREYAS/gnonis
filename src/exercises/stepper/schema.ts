import { z } from "zod";
import { devicesField, nonEmpty } from "../shared";

const TokensView = z.object({
  kind: z.literal("tokens"),
  tokens: z.array(z.string()).min(1),
  highlight: z.array(z.number().int().nonnegative()).optional(),
  dim: z.array(z.number().int().nonnegative()).optional(),
  label: z.string().optional(),
});
const MatrixView = z.object({
  kind: z.literal("matrix"),
  rows: z.array(z.string()).min(1),
  cols: z.array(z.string()).min(1),
  /** null = masked / empty cell */
  cells: z.array(z.array(z.number().nullable())),
  highlight: z.array(z.tuple([z.number().int(), z.number().int()])).optional(),
  label: z.string().optional(),
});
const BarsView = z.object({
  kind: z.literal("bars"),
  bars: z.array(z.object({ label: nonEmpty, value: z.number(), tone: z.enum(["gold", "green", "red", "muted"]).optional() })).min(1),
  unit: z.string().optional(),
  max: z.number().positive().optional(),
  label: z.string().optional(),
});
export const FrameViewSchema = z.discriminatedUnion("kind", [TokensView, MatrixView, BarsView]);
export type FrameView = z.infer<typeof FrameViewSchema>;

export const stepperSchema = z
  .object({
    type: z.literal("stepper"),
    devices: devicesField,
    prompt: nonEmpty,
    frames: z.array(z.object({ caption: nonEmpty, view: FrameViewSchema })).min(2),
    explanation: nonEmpty,
  })
  .strict()
  .superRefine((ex, ctx) => {
    ex.frames.forEach((f, i) => {
      if (f.view.kind !== "matrix") return;
      const { rows, cols, cells } = f.view;
      if (cells.length !== rows.length || cells.some((r) => r.length !== cols.length))
        ctx.addIssue({ code: "custom", path: ["frames", i, "view", "cells"], message: "matrix cells must be rows x cols" });
    });
  });
