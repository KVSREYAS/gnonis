import { z } from "zod";

export const DeviceSchema = z.enum(["phone", "desktop"]);
export type Device = z.infer<typeof DeviceSchema>;

const devices = z
  .array(DeviceSchema)
  .min(1, "declare at least one device")
  .refine((d) => new Set(d).size === d.length, "devices must be unique");

const text = z.string().trim().min(1);

/* ---------- Exercise bodies (shared by top-level exercises and boss parts) ---------- */

const mcqBody = {
  type: z.literal("mcq"),
  prompt: text,
  options: z.array(text).min(2).max(6),
  answer: z.number().int().nonnegative(),
  explanation: text,
};

const fillBody = {
  type: z.literal("fill"),
  prompt: text.optional(),
  /** Sentence with numbered blanks: "Attention uses {{0}} and {{1}}." */
  text,
  chips: z.array(text).min(2).max(10),
  /** answers[i] is the chip that belongs in blank {{i}} */
  answers: z.array(text).min(1),
  explanation: text,
};

const orderingBody = {
  type: z.literal("ordering"),
  prompt: text,
  /** Items listed in the CORRECT order. The widget shuffles them. */
  items: z.array(text).min(3).max(8),
  explanation: text,
};

export const ToleranceSchema = z.object({
  mode: z.enum(["relative", "absolute"]),
  value: z.number().nonnegative(),
});

const predictBody = {
  type: z.literal("predict"),
  prompt: text,
  answer: z.number(),
  tolerance: ToleranceSchema.default({ mode: "relative", value: 0.05 }),
  unit: z.string().optional(),
  hint: z.string().optional(),
  explanation: text,
};

export const SimGoalSchema = z.object({
  output: text,
  op: z.enum(["lt", "lte", "gt", "gte", "between"]),
  value: z.number(),
  max: z.number().optional(),
  description: text,
});
export type SimGoal = z.infer<typeof SimGoalSchema>;

const simulatorBody = {
  type: z.literal("simulator"),
  /** Id of a simulation in the simulation registry (src/lib/sims). */
  sim: text,
  prompt: text,
  /** Initial slider values, keyed by slider id. */
  params: z.record(z.string(), z.number()).optional(),
  /** Slider ids to hide, so a mission can focus on a few knobs. */
  locked: z.array(z.string()).optional(),
  goal: SimGoalSchema.optional(),
  explanation: text,
};

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
  bars: z.array(z.object({ label: text, value: z.number(), tone: z.enum(["gold", "green", "red", "muted"]).optional() })).min(1),
  unit: z.string().optional(),
  max: z.number().positive().optional(),
  label: z.string().optional(),
});
export const FrameViewSchema = z.discriminatedUnion("kind", [TokensView, MatrixView, BarsView]);
export type FrameView = z.infer<typeof FrameViewSchema>;

const stepperBody = {
  type: z.literal("stepper"),
  prompt: text,
  frames: z.array(z.object({ caption: text, view: FrameViewSchema })).min(2),
  explanation: text,
};

const codeBody = {
  type: z.literal("code"),
  language: z.enum(["python"]),
  prompt: text,
  starter: text,
  /** Hidden tests: functions named test_* using assert. Run after the learner's code in the same namespace. */
  tests: text,
  /** Reference solution, used by CI to prove the hidden tests are passable. Never shown verbatim. */
  solution: text,
  hints: z.array(text).default([]),
  explanation: text,
};

const debugBody = {
  type: z.literal("debug"),
  mode: z.enum(["line", "code"]),
  language: z.enum(["python"]),
  prompt: text,
  code: text,
  /** line mode: 1-indexed line that holds the bug */
  bugLine: z.number().int().positive().optional(),
  /** code mode: hidden tests the fixed code must pass */
  tests: text.optional(),
  solution: text.optional(),
  explanation: text,
};

/* ---------- Boss ---------- */

const BossPartSchema = z.discriminatedUnion("type", [
  z.object(mcqBody),
  z.object(fillBody),
  z.object(orderingBody),
  z.object(predictBody),
]);
export type BossPart = z.infer<typeof BossPartSchema>;

const bossBody = {
  type: z.literal("boss"),
  title: text,
  briefing: text,
  timeLimit: z.number().int().min(20).max(900),
  playerHp: z.number().int().min(1).max(6).default(3),
  parts: z.array(BossPartSchema).min(2).max(8),
  explanation: text,
};

export const ExerciseSchema = z
  .discriminatedUnion("type", [
    z.object({ ...mcqBody, devices }),
    z.object({ ...fillBody, devices }),
    z.object({ ...orderingBody, devices }),
    z.object({ ...predictBody, devices }),
    z.object({ ...simulatorBody, devices }),
    z.object({ ...stepperBody, devices }),
    z.object({ ...codeBody, devices }),
    z.object({ ...debugBody, devices }),
    z.object({ ...bossBody, devices }),
  ])
  .superRefine((ex, ctx) => checkExercise(ex, ctx));

export type Exercise = z.infer<typeof ExerciseSchema>;
export type ExerciseType = Exercise["type"];
export type ExerciseOf<T extends ExerciseType> = Extract<Exercise, { type: T }>;

export const EXERCISE_TYPES = [
  "mcq",
  "fill",
  "ordering",
  "predict",
  "simulator",
  "stepper",
  "code",
  "debug",
  "boss",
] as const satisfies readonly ExerciseType[];

type Ctx = z.RefinementCtx;

function checkExercise(ex: Exercise | BossPart, ctx: Ctx, path: (string | number)[] = []) {
  switch (ex.type) {
    case "mcq":
      if (ex.answer >= ex.options.length)
        ctx.addIssue({ code: "custom", path: [...path, "answer"], message: `answer index ${ex.answer} is out of range` });
      break;
    case "fill": {
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
      break;
    }
    case "ordering":
      if (new Set(ex.items).size !== ex.items.length)
        ctx.addIssue({ code: "custom", path: [...path, "items"], message: "ordering items must be unique" });
      break;
    case "simulator":
      if (ex.goal?.op === "between" && ex.goal.max === undefined)
        ctx.addIssue({ code: "custom", path: [...path, "goal", "max"], message: "between goals need a max" });
      break;
    case "stepper":
      ex.frames.forEach((f, i) => {
        if (f.view.kind === "matrix") {
          const { rows, cols, cells } = f.view;
          if (cells.length !== rows.length || cells.some((r) => r.length !== cols.length))
            ctx.addIssue({ code: "custom", path: [...path, "frames", i, "view", "cells"], message: "matrix cells must be rows x cols" });
        }
      });
      break;
    case "debug":
      if (ex.mode === "line") {
        const lines = ex.code.split("\n").length;
        if (!ex.bugLine || ex.bugLine > lines)
          ctx.addIssue({ code: "custom", path: [...path, "bugLine"], message: "line-mode debug needs a bugLine inside the code" });
      } else if (!ex.tests || !ex.solution) {
        ctx.addIssue({ code: "custom", path: [...path, "tests"], message: "code-mode debug needs tests and a solution" });
      }
      break;
    case "boss":
      ex.parts.forEach((p, i) => checkExercise(p, ctx, [...path, "parts", i]));
      break;
  }
}

/* ---------- Lessons, modules, courses ---------- */

export const LessonFrontmatterSchema = z
  .object({
    title: text,
    kind: z.enum(["lesson", "boss"]).default("lesson"),
    summary: text,
    xp: z.number().int().min(0).max(1000),
    minutes: z.number().int().positive().max(60).optional(),
    keyIdeas: z.array(text).length(3, "exactly 3 key ideas (shown on MISSION PASSED)"),
    exercises: z.record(z.string().regex(/^[a-z0-9-]+$/, "exercise ids are kebab-case"), ExerciseSchema).default({}),
  })
  .strict();
export type LessonFrontmatter = z.infer<typeof LessonFrontmatterSchema>;

export const ArtSchema = z.enum(["skyline", "docks", "hills", "grid", "bridge", "desert", "pier", "tower"]);
export type Art = z.infer<typeof ArtSchema>;

export const ModuleSchema = z
  .object({
    title: text,
    district: text,
    summary: text,
    tip: text,
    art: ArtSchema.default("skyline"),
    status: z.enum(["ready", "stub"]).default("ready"),
    lessons: z.array(z.string().regex(/^[a-z0-9-]+$/)).default([]),
  })
  .strict()
  .superRefine((m, ctx) => {
    if (m.status === "ready" && m.lessons.length === 0)
      ctx.addIssue({ code: "custom", path: ["lessons"], message: "ready modules need at least one lesson" });
    if (new Set(m.lessons).size !== m.lessons.length)
      ctx.addIssue({ code: "custom", path: ["lessons"], message: "duplicate lesson slug" });
  });
export type ModuleMeta = z.infer<typeof ModuleSchema>;

export const CourseSchema = z
  .object({
    title: text,
    tagline: text,
    description: text,
    order: z.number().int().default(100),
    level: z.enum(["intro", "intermediate", "advanced"]).default("intermediate"),
    modules: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (new Set(c.modules).size !== c.modules.length)
      ctx.addIssue({ code: "custom", path: ["modules"], message: "duplicate module slug" });
  });
export type CourseMeta = z.infer<typeof CourseSchema>;

/* ---------- Lesson body ---------- */

export const EXERCISE_TAG = /^\s*<Exercise\s+id="([a-z0-9-]+)"\s*\/>\s*$/;
export const MAX_CARD_WORDS = 170;

export type BodyBlock =
  | { kind: "card"; title: string; markdown: string; words: number }
  | { kind: "exercise"; id: string };

/**
 * A lesson body is markdown split into short cards by `## ` headings, with
 * `<Exercise id="..." />` tags on their own line placed between cards.
 */
export function parseLessonBody(body: string): { blocks: BodyBlock[]; errors: string[] } {
  const blocks: BodyBlock[] = [];
  const errors: string[] = [];
  let current: { title: string; lines: string[] } | null = null;
  let inFence = false;

  const flush = () => {
    if (!current) return;
    const markdown = current.lines.join("\n").trim();
    const words = markdown.replace(/```[\s\S]*?```/g, " ").split(/\s+/).filter(Boolean).length;
    if (!markdown) errors.push(`card "${current.title}" is empty`);
    if (words > MAX_CARD_WORDS) errors.push(`card "${current.title}" has ${words} words (max ${MAX_CARD_WORDS})`);
    blocks.push({ kind: "card", title: current.title, markdown, words });
    current = null;
  };

  for (const line of body.split("\n")) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    const tag = !inFence && line.match(EXERCISE_TAG);
    if (tag) {
      flush();
      blocks.push({ kind: "exercise", id: tag[1] });
      continue;
    }
    if (!inFence && /^##\s+/.test(line)) {
      flush();
      current = { title: line.replace(/^##\s+/, "").trim(), lines: [] };
      continue;
    }
    if (!inFence && /^#\s+/.test(line)) {
      errors.push(`use "## " for card titles; "# " is reserved (line: ${line.trim()})`);
      continue;
    }
    if (current) current.lines.push(line);
    else if (line.trim())
      errors.push(
        blocks.length
          ? `text after an <Exercise /> needs its own "## " card heading: "${line.trim().slice(0, 40)}"`
          : `text before the first "## " card heading: "${line.trim().slice(0, 40)}"`,
      );
  }
  if (inFence) errors.push("unclosed code fence");
  flush();
  return { blocks, errors };
}
