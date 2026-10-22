import type { ExerciseOf, SimGoal } from "@/lib/content/schema";
import type { Values } from "@/lib/sims";

export type Grade = { correct: boolean; message: string };

const ok = (message: string): Grade => ({ correct: true, message });
const no = (message: string): Grade => ({ correct: false, message });

type McqLike = Pick<ExerciseOf<"mcq">, "answer" | "options" | "explanation">;
export function gradeMcq(ex: McqLike, selected: number | null): Grade {
  if (selected === null) return no("Pick an answer first.");
  return selected === ex.answer ? ok(ex.explanation) : no(ex.explanation);
}

type FillLike = Pick<ExerciseOf<"fill">, "answers" | "explanation">;
export function gradeFill(ex: FillLike, filled: (string | null)[]): Grade {
  if (filled.length !== ex.answers.length || filled.some((f) => f === null)) return no("Fill every blank first.");
  const wrong = ex.answers.filter((a, i) => filled[i] !== a).length;
  return wrong === 0 ? ok(ex.explanation) : no(`${wrong} blank${wrong > 1 ? "s are" : " is"} off. ${ex.explanation}`);
}

type OrderingLike = Pick<ExerciseOf<"ordering">, "items" | "explanation">;
export function gradeOrdering(ex: OrderingLike, order: string[]): Grade {
  const inPlace = order.filter((item, i) => ex.items[i] === item).length;
  if (inPlace === ex.items.length && order.length === ex.items.length) return ok(ex.explanation);
  return no(`${inPlace} of ${ex.items.length} in the right spot. ${ex.explanation}`);
}

/** Deterministic shuffle that never returns the solved order (for 3+ items). */
export function shuffleForOrdering<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rand = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1_000_000) / 1_000_000;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (out.length > 1 && out.every((x, i) => x === items[i])) out.push(out.shift()!);
  return out;
}

type PredictLike = Pick<ExerciseOf<"predict">, "answer" | "tolerance" | "unit" | "explanation">;
export function withinTolerance(ex: Pick<PredictLike, "answer" | "tolerance">, value: number): boolean {
  if (!Number.isFinite(value)) return false;
  const diff = Math.abs(value - ex.answer);
  if (ex.tolerance.mode === "absolute") return diff <= ex.tolerance.value + 1e-12;
  if (ex.answer === 0) return diff <= 1e-9;
  return diff / Math.abs(ex.answer) <= ex.tolerance.value + 1e-12;
}

/** Accepts "1,300", "1.3k", "16e9", "2 GB" style input. */
export function parseNumberInput(raw: string): number {
  const s = raw.trim().toLowerCase().replace(/,/g, "").replace(/_/g, "");
  const m = s.match(/^(-?\d*\.?\d+(?:e-?\d+)?)\s*(?:([kmbgt])b?(?![a-z]))?/);
  if (!m) return NaN;
  const mult: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, g: 1e9, t: 1e12 };
  return Number(m[1]) * (m[2] ? mult[m[2]] : 1);
}

export function gradePredict(ex: PredictLike, raw: string): Grade {
  const value = parseNumberInput(raw);
  if (Number.isNaN(value)) return no("Enter a number, e.g. 1300 or 1.3k.");
  const unit = ex.unit ? ` ${ex.unit}` : "";
  const target = `${formatNumber(ex.answer)}${unit}`;
  if (withinTolerance(ex, value)) return ok(`Spot on, the answer is ${target}. ${ex.explanation}`);
  const dir = value < ex.answer ? "low" : "high";
  return no(`Too ${dir}: the answer is ${target}. ${ex.explanation}`);
}

export function formatNumber(n: number, digits = 3): string {
  if (!Number.isFinite(n)) return String(n);
  if (Math.abs(n) >= 1e4 || Number.isInteger(n)) return Math.round(n).toLocaleString("en-US");
  return Number(n.toPrecision(digits)).toString();
}

export function goalMet(goal: SimGoal, outputs: Values): boolean {
  const v = outputs[goal.output];
  if (v === undefined || Number.isNaN(v)) return false;
  switch (goal.op) {
    case "lt":
      return v < goal.value;
    case "lte":
      return v <= goal.value;
    case "gt":
      return v > goal.value;
    case "gte":
      return v >= goal.value;
    case "between":
      return v >= goal.value && v <= (goal.max ?? Infinity);
  }
}

export function gradeSim(goal: SimGoal | undefined, outputs: Values, explanation: string): Grade {
  if (!goal) return ok(explanation);
  return goalMet(goal, outputs) ? ok(explanation) : no(`Not yet: ${goal.description}`);
}

export function gradeDebugLine(ex: Pick<ExerciseOf<"debug">, "bugLine" | "explanation">, line: number | null): Grade {
  if (line === null) return no("Tap the line you think is broken.");
  return line === ex.bugLine ? ok(ex.explanation) : no(`Line ${line} is fine. Look again. ${ex.explanation}`);
}

export type TestResult = { name: string; passed: boolean; message?: string };
export function gradeTests(tests: TestResult[], error: string | null): Grade {
  if (error) return no(`Your code crashed before the tests ran:\n${error}`);
  if (tests.length === 0) return no("No tests ran.");
  const failed = tests.filter((t) => !t.passed);
  if (failed.length === 0) return ok(`All ${tests.length} hidden tests passed.`);
  return no(`${failed.length} of ${tests.length} hidden tests failed. First failure: ${failed[0].name}${failed[0].message ? `: ${failed[0].message}` : ""}`);
}

/* ---------- Boss fight ---------- */

export type BossState = {
  part: number;
  playerHp: number;
  bossHp: number;
  status: "fighting" | "won" | "lost";
  reason?: "hp" | "time";
};

export function initialBoss(parts: number, playerHp: number): BossState {
  return { part: 0, playerHp, bossHp: parts, status: "fighting" };
}

/** Correct answer: boss loses 1 hp and the next part starts. Wrong: player loses 1 hp and retries the part. */
export function bossAnswer(s: BossState, correct: boolean, totalParts: number): BossState {
  if (s.status !== "fighting") return s;
  if (correct) {
    const bossHp = s.bossHp - 1;
    const part = s.part + 1;
    return { ...s, bossHp, part, status: part >= totalParts ? "won" : "fighting" };
  }
  const playerHp = s.playerHp - 1;
  return { ...s, playerHp, status: playerHp <= 0 ? "lost" : "fighting", reason: playerHp <= 0 ? "hp" : undefined };
}

export function bossTimeout(s: BossState): BossState {
  return s.status === "fighting" ? { ...s, status: "lost", reason: "time" } : s;
}
