import { z } from "zod";
import { decisionNodes, isLeaf, iteratedElimination, type Matrix, PD_STRATEGIES, treeHasTies, type TreeNode } from "./game-theory";

const strat = z.enum(PD_STRATEGIES);
const pos = z.number().positive();
const cell = z.tuple([z.number(), z.number()]);
const matrix = z.array(z.array(cell).min(2).max(4)).min(2).max(4).refine((m) => m.every((r) => r.length === m[0].length), "rows must have the same length");
const labels = z.array(z.string().min(1)).min(2).max(4);

const treeNode: z.ZodType<TreeNode> = z.lazy(() =>
  z.union([
    z.object({ id: z.string().min(1), payoffs: cell }).strict(),
    z
      .object({
        id: z.string().min(1),
        player: z.union([z.literal(0), z.literal(1)]),
        label: z.string().optional(),
        moves: z.array(z.object({ label: z.string().min(1), next: treeNode }).strict()).min(2).max(3),
      })
      .strict(),
  ]),
) as z.ZodType<TreeNode>;

/** Config schema for each mini-game. The `game` prop of <Game /> picks one. */
export const GAME_CONFIGS = {
  "pd-match": z
    .object({ opponent: strat, rounds: z.number().int().min(3).max(30).default(10), target: z.number().int().min(0), reveal: z.boolean().default(false), guess: z.boolean().default(false) })
    .strict(),
  "pd-tournament": z
    .object({ field: z.array(strat).min(2).max(10), rounds: z.number().int().min(5).max(200).default(50), noise: z.number().min(0).max(0.3).default(0), choices: z.array(strat).min(2), topN: z.number().int().min(1).default(1) })
    .strict(),
  "nash-hunt": z
    .object({ puzzles: z.array(z.object({ title: z.string().min(1), rows: labels, cols: labels, payoffs: matrix }).strict()).min(1).max(8), maxMistakes: z.number().int().min(0).default(2) })
    .strict(),
  dominance: z.object({ rows: labels, cols: labels, payoffs: matrix, maxMistakes: z.number().int().min(0).default(1) }).strict(),
  ultimatum: z
    .object({ pie: z.number().int().min(2).max(100).default(10), thresholds: z.array(z.number().min(0)).min(1).max(8), offers: z.array(z.number().int().min(0)).max(8).default([]), target: z.number().min(0) })
    .strict(),
  "beauty-contest": z.object({ rounds: z.number().int().min(1).max(6).default(4), fraction: z.number().gt(0).lt(1).default(2 / 3), crowd: z.number().int().min(5).max(200).default(40) }).strict(),
  auction: z
    .object({ format: z.enum(["first", "second"]), rounds: z.number().int().min(2).max(10).default(5), bidders: z.number().int().min(2).max(8).default(4), target: z.number().min(0) })
    .strict(),
  centipede: z.object({ stages: z.number().int().min(2).max(10).default(6), base: pos.default(4), botTakeAt: z.number().int().min(1), target: z.number().min(0) }).strict(),
  "game-tree": z.object({ tree: treeNode, players: z.tuple([z.string(), z.string()]).default(["You", "Rival"]) }).strict(),
  "penalty-kicks": z
    .object({ kicks: z.number().int().min(6).max(40).default(20), target: z.number().int().min(1), score: z.object({ L: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]), R: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]) }).strict(), memory: z.number().int().min(2).max(10).default(5) })
    .strict(),
  "monty-hall": z.object({ doors: z.number().int().min(3).max(10).default(3), minPlays: z.number().int().min(1).max(30).default(6) }).strict(),
  coordination: z
    .object({ questions: z.array(z.object({ prompt: z.string().min(1), options: z.array(z.string().min(1)).min(2).max(6), shares: z.array(z.number().min(0)).min(2).max(6) }).strict()).min(2).max(10), target: z.number().int().min(1) })
    .strict(),
  "hawk-dove": z.object({ start: z.number().min(0.01).max(0.99).default(0.1), lo: z.number().min(0).max(1), hi: z.number().min(0).max(1), generations: z.number().int().min(20).max(400).default(150) }).strict(),
  market: z
    .object({
      rounds: z
        .array(z.object({ label: z.string().min(1), demand: z.object({ a: pos, b: pos }).strict(), supply: z.object({ a: z.number(), b: pos }).strict(), tax: z.number().min(0).default(0) }).strict())
        .min(1)
        .max(6),
      maxPrice: pos,
    })
    .strict(),
  lemonade: z.object({ days: z.number().int().min(3).max(14).default(7), costPerCup: pos, maxPrice: pos, target: z.number(), seed: z.number().int().default(7) }).strict(),
  elasticity: z
    .object({ items: z.array(z.object({ good: z.string().min(1), p0: pos, p1: pos, q0: pos, q1: pos, note: z.string().min(1) }).strict()).min(2).max(10), target: z.number().int().min(1) })
    .strict(),
  compound: z
    .object({ start: z.number().min(0).default(0), monthly: z.number().min(0).default(5000), rate: z.number().min(0).max(30).default(10), inflation: z.number().min(0).max(20).default(6), years: z.number().int().min(1).max(50).default(20), goalReal: pos, locked: z.array(z.enum(["start", "monthly", "rate", "inflation", "years"])).default([]) })
    .strict(),
  "central-bank": z
    .object({ quarters: z.number().int().min(4).max(20).default(12), shocks: z.array(z.object({ quarter: z.number().int().min(1), demand: z.number().default(0), supply: z.number().default(0), news: z.string().min(1) }).strict()).default([]), maxAvgLoss: pos })
    .strict(),
  commons: z
    .object({ seasons: z.number().int().min(4).max(20).default(10), capacity: pos.default(1000), growth: z.number().gt(0).max(1).default(0.5), bots: z.number().int().min(1).max(6).default(3), greed: z.number().min(0).max(2).default(0.3), maxCatch: pos.default(150), minStock: z.number().min(0), target: z.number().min(0) })
    .strict(),
  "comparative-advantage": z
    .object({
      goods: z.tuple([z.string(), z.string()]),
      a: z.object({ name: z.string(), hours: pos, perHour: z.tuple([pos, pos]) }).strict(),
      b: z.object({ name: z.string(), hours: pos, perHour: z.tuple([pos, pos]) }).strict(),
      needA: z.tuple([z.number().min(0), z.number().min(0)]),
      needB: z.tuple([z.number().min(0), z.number().min(0)]),
    })
    .strict(),
  monopoly: z.object({ a: pos, b: pos, c: z.number().min(0), tolerance: z.number().min(0).default(0.03) }).strict(),
  lemons: z.object({ rounds: z.number().int().min(3).max(12).default(8), bonus: z.number().min(1).max(3).default(1.5), target: z.number(), inspectCost: z.number().min(0).optional() }).strict(),
} as const;

export type GameId = keyof typeof GAME_CONFIGS;
export const GAME_IDS = Object.keys(GAME_CONFIGS) as [GameId, ...GameId[]];
export type GameConfig<G extends GameId> = z.infer<(typeof GAME_CONFIGS)[G]>;

/** Content checks beyond the shape: puzzles must have a unique answer, shares must match options, and so on. */
export function gameConfigProblems(game: GameId, cfg: unknown): string[] {
  const parsed = GAME_CONFIGS[game].safeParse(cfg ?? {});
  if (!parsed.success) return parsed.error.issues.map((i) => `config${i.path.length ? "." + i.path.join(".") : ""}: ${i.message}`);
  const c = parsed.data as Record<string, unknown>;
  const out: string[] = [];
  if (game === "game-tree") {
    const tree = c.tree as TreeNode;
    if (isLeaf(tree)) out.push("config.tree: root must be a decision node");
    if (treeHasTies(tree)) out.push("config.tree: a mover has two moves with equal payoff, so the answer is ambiguous");
    const ids = decisionNodes(tree).map((n) => n.id);
    if (new Set(ids).size !== ids.length) out.push("config.tree: node ids must be unique");
  }
  if (game === "coordination")
    for (const [i, q] of (c.questions as { options: string[]; shares: number[] }[]).entries())
      if (q.options.length !== q.shares.length) out.push(`config.questions.${i}: shares must match options`);
  if (game === "nash-hunt" || game === "dominance") {
    const list = game === "dominance" ? [c] : (c.puzzles as Record<string, unknown>[]);
    for (const [i, p] of list.entries()) {
      const m = p.payoffs as unknown[][];
      if ((p.rows as string[]).length !== m.length || (p.cols as string[]).length !== m[0].length) out.push(`puzzle ${i}: labels must match the matrix size`);
    }
  }
  if (game === "dominance") {
    const left = iteratedElimination(c.payoffs as Matrix);
    if (left.rows.length !== 1 || left.cols.length !== 1) out.push("config.payoffs: iterated elimination must leave exactly one cell");
  }
  if (game === "pd-tournament") {
    const f = c.field as string[];
    if ((c.choices as string[]).some((s) => !PD_STRATEGIES.includes(s as never))) out.push("config.choices: unknown strategy");
    if ((c.topN as number) > f.length + 1) out.push("config.topN: larger than the field");
  }
  if (game === "hawk-dove" && (c.lo as number) >= (c.hi as number)) out.push("config: lo must be below hi");
  return out;
}
