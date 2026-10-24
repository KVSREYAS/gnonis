import { PROGRESS_VERSION, type ExerciseRecord, type LessonRecord, type ProgressState } from "./logic";

/*
 * Merge rule for two saves of the same learner (e.g. phone and PC, or guest progress joining an account):
 *
 * - Reset wins: the save with the higher `epoch` is taken as-is, because the other one predates a reset.
 * - Lessons: union. A lesson finished on either side is finished. When both have it, keep the earliest
 *   `completedAt`, the highest `xpEarned`, and only the desktop missions still pending on both sides.
 * - Exercises: union. Solved on either side is solved, first-try on either side is first-try, attempts is the max.
 * - XP: the sum of the merged lessons' `xpEarned` (XP is only ever paid through lessons), never lower than
 *   either side's XP. So separate progress adds up, and the same progress is never counted twice.
 * - Streak: the side that played most recently, best is the max of both.
 *
 * The result is the same whichever order the saves are merged in, and merging a save with itself changes nothing.
 */
export function mergeProgress(a: ProgressState, b: ProgressState): ProgressState {
  if (a.epoch !== b.epoch) return structuredClone(a.epoch > b.epoch ? a : b);

  const lessons: Record<string, LessonRecord> = {};
  for (const key of union(a.lessons, b.lessons)) {
    lessons[key] = mergeLesson(a.lessons[key], b.lessons[key]);
  }
  const exercises: Record<string, ExerciseRecord> = {};
  for (const key of union(a.exercises, b.exercises)) {
    exercises[key] = mergeExercise(a.exercises[key], b.exercises[key]);
  }
  const lessonXp = Object.values(lessons).reduce((sum, l) => sum + (Number(l.xpEarned) || 0), 0);

  return {
    version: PROGRESS_VERSION,
    xp: Math.max(a.xp, b.xp, lessonXp),
    lessons,
    exercises,
    streak: mergeStreak(a.streak, b.streak),
    updatedAt: maxString(a.updatedAt, b.updatedAt),
    epoch: a.epoch,
  };
}

/** True when the save holds no progress at all, so there is nothing worth merging or uploading. */
export function isEmptyProgress(s: ProgressState): boolean {
  return s.xp === 0 && Object.keys(s.lessons).length === 0 && Object.keys(s.exercises).length === 0 && !s.streak.lastDay;
}

/** Structural equality that ignores key order (Postgres jsonb does not keep it). */
export function sameProgress(a: ProgressState, b: ProgressState): boolean {
  return stableStringify(a) === stableStringify(b);
}

function union(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
}

function mergeLesson(a: LessonRecord | undefined, b: LessonRecord | undefined): LessonRecord {
  if (!a || !b) return structuredClone((a ?? b)!);
  const pendingB = new Set(b.pendingDesktop ?? []);
  return {
    completedAt: minString(a.completedAt, b.completedAt) ?? "",
    xpEarned: Math.max(a.xpEarned, b.xpEarned),
    pendingDesktop: (a.pendingDesktop ?? []).filter((k) => pendingB.has(k)).sort(),
  };
}

function mergeExercise(a: ExerciseRecord | undefined, b: ExerciseRecord | undefined): ExerciseRecord {
  if (!a || !b) return { ...(a ?? b)! };
  return {
    attempts: Math.max(a.attempts, b.attempts),
    correct: a.correct || b.correct,
    firstTry: a.firstTry || b.firstTry,
  };
}

function mergeStreak(a: ProgressState["streak"], b: ProgressState["streak"]): ProgressState["streak"] {
  const best = Math.max(a.best, b.best);
  if (a.lastDay === b.lastDay) return { current: Math.max(a.current, b.current), best, lastDay: a.lastDay };
  const latest = (a.lastDay ?? "") > (b.lastDay ?? "") ? a : b;
  return { current: latest.current, best: Math.max(best, latest.current), lastDay: latest.lastDay };
}

function minString(a: string | null, b: string | null): string | null {
  if (!a) return b || null;
  if (!b) return a;
  return a < b ? a : b;
}

function maxString(a: string | null, b: string | null): string | null {
  if (!a) return b || null;
  if (!b) return a;
  return a > b ? a : b;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}
