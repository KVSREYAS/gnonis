import { applyRenames, EMPTY_RENAMES, type RenameMap } from "./rename-map";

export const PROGRESS_VERSION = 1;

export type LessonRecord = {
  completedAt: string;
  xpEarned: number;
  /** Exercises skipped because they are desktop-only and the lesson was played in phone mode. */
  pendingDesktop: string[];
};

/** "skip" is Skip. "know" is I already know this. Both are skipped, and neither is a solve. */
export type SkipReason = "skip" | "know";

export type ExerciseRecord = {
  attempts: number;
  correct: boolean;
  firstTry: boolean;
  /** Hash of the answer-bearing fields at the time this record was written. Absent on older saves. */
  contentHash?: string;
  /**
   * True while the learner has skipped this exercise and has not solved it.
   * False after they choose Try it. Absent when they never skipped.
   * A solve drops the field: skipped is not the same as correct.
   */
  skipped?: boolean;
  skipReason?: SkipReason;
  /** ISO time of the latest skip or un-skip. Merges keep the later choice. */
  skippedAt?: string;
};

export type ProgressState = {
  version: number;
  xp: number;
  lessons: Record<string, LessonRecord>;
  exercises: Record<string, ExerciseRecord>;
  streak: { current: number; best: number; lastDay: string | null };
  updatedAt: string | null;
  /** Bumped by every reset. When saves are merged, a higher epoch wins outright, so a reset sticks across devices. */
  epoch: number;
};

export const emptyProgress = (): ProgressState => ({
  version: PROGRESS_VERSION,
  xp: 0,
  lessons: {},
  exercises: {},
  streak: { current: 0, best: 0, lastDay: null },
  updatedAt: null,
  epoch: 0,
});

/** A wiped save that still outranks everything recorded before the wipe. */
export function resetProgress(state: ProgressState, now: Date): ProgressState {
  return { ...emptyProgress(), epoch: state.epoch + 1, updatedAt: now.toISOString() };
}

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** Registers activity on `today`. Same day is a no-op, the next day extends, a gap resets to 1. */
export function touchStreak(s: ProgressState["streak"], today: string): ProgressState["streak"] {
  if (s.lastDay === today) return s;
  const gap = s.lastDay ? daysBetween(s.lastDay, today) : Infinity;
  const current = gap === 1 ? s.current + 1 : 1;
  return { current, best: Math.max(s.best, current), lastDay: today };
}

/** The streak as it should be displayed today: a missed day means it is already broken. */
export function liveStreak(s: ProgressState["streak"], today: string): number {
  if (!s.lastDay) return 0;
  return daysBetween(s.lastDay, today) <= 1 ? s.current : 0;
}

/** Wanted level: 1-6 stars from consecutive days. */
export function wantedStars(streakDays: number): number {
  if (streakDays <= 0) return 0;
  const thresholds = [1, 2, 4, 7, 14, 30];
  return thresholds.filter((t) => streakDays >= t).length;
}

export const EXERCISE_BONUS_XP = 10;

/** An attempt after a skip is the later decision, so a stale skip on another device does not come back. A solve drops the skip entirely. */
function closeSkip(next: ExerciseRecord, prev: ExerciseRecord | undefined): ExerciseRecord {
  if (!prev?.skipped && !prev?.skippedAt && next.skipped !== true) return next;
  const rest: ExerciseRecord = { attempts: next.attempts, correct: next.correct, firstTry: next.firstTry };
  if (next.contentHash) rest.contentHash = next.contentHash;
  if (next.correct) return rest;
  return { ...rest, skipped: false, skippedAt: new Date().toISOString() };
}

export function recordExercise(state: ProgressState, key: string, correct: boolean, contentHash?: string): ProgressState {
  const prev = state.exercises[key];
  const hashChanged = !!contentHash && !!prev?.contentHash && prev.contentHash !== contentHash;
  if (prev?.correct && !hashChanged) {
    if (contentHash && !prev.contentHash)
      return { ...state, exercises: { ...state.exercises, [key]: { ...prev, contentHash } } };
    return state;
  }
  if (prev && hashChanged && !correct) {
    const next = closeSkip({ ...prev, attempts: prev.attempts + 1, correct: true }, prev);
    return { ...state, exercises: { ...state.exercises, [key]: next } };
  }
  if (prev && hashChanged && correct) {
    return {
      ...state,
      exercises: {
        ...state.exercises,
        [key]: closeSkip({ attempts: prev.attempts + 1, correct: true, firstTry: prev.firstTry, contentHash }, prev),
      },
    };
  }
  const attempts = (prev?.attempts ?? 0) + 1;
  const next: ExerciseRecord = { attempts, correct, firstTry: correct && attempts === 1 };
  if (contentHash) next.contentHash = contentHash;
  return { ...state, exercises: { ...state.exercises, [key]: closeSkip(next, prev) } };
}

/** Marks an exercise skipped without solving it. A solve is left alone. */
export function skipExercise(state: ProgressState, key: string, reason: SkipReason, now: Date, contentHash?: string): ProgressState {
  const prev = state.exercises[key];
  if (prev?.correct) return state;
  if (prev?.skipped && (prev.skipReason ?? "skip") === reason && (!contentHash || prev.contentHash === contentHash)) return state;
  const next: ExerciseRecord = {
    attempts: prev?.attempts ?? 0,
    correct: false,
    firstTry: prev?.firstTry ?? false,
    skipped: true,
    skipReason: reason,
    skippedAt: now.toISOString(),
  };
  const hash = contentHash ?? prev?.contentHash;
  if (hash) next.contentHash = hash;
  return { ...state, exercises: { ...state.exercises, [key]: next }, updatedAt: now.toISOString() };
}

/** Clears a skip so the exercise can be tried again. Solving it later is what counts as correct. */
export function unskipExercise(state: ProgressState, key: string, now: Date): ProgressState {
  const prev = state.exercises[key];
  if (!prev?.skipped) return state;
  const next: ExerciseRecord = {
    attempts: prev.attempts,
    correct: false,
    firstTry: prev.firstTry,
    skipped: false,
    skippedAt: now.toISOString(),
  };
  if (prev.contentHash) next.contentHash = prev.contentHash;
  return { ...state, exercises: { ...state.exercises, [key]: next }, updatedAt: now.toISOString() };
}

export function isExerciseSkipped(record: ExerciseRecord | undefined): boolean {
  return !!record && record.skipped === true && record.correct !== true;
}

/** Later skip or un-skip wins. With no timestamps, a skip on either side is kept and "know" beats "skip". */
export function mergeSkip(a: ExerciseRecord, b: ExerciseRecord): Pick<ExerciseRecord, "skipped" | "skipReason" | "skippedAt"> {
  const leftAt = typeof a.skippedAt === "string" ? a.skippedAt : "";
  const rightAt = typeof b.skippedAt === "string" ? b.skippedAt : "";
  if (leftAt !== rightAt) {
    const winner = leftAt > rightAt ? a : b;
    if (winner.skipped !== true) return winner.skippedAt ? { skipped: false, skippedAt: winner.skippedAt } : {};
    const reason = winner.skipReason === "know" || winner.skipReason === "skip" ? winner.skipReason : undefined;
    return reason
      ? { skipped: true, skipReason: reason, ...(winner.skippedAt ? { skippedAt: winner.skippedAt } : {}) }
      : { skipped: true, ...(winner.skippedAt ? { skippedAt: winner.skippedAt } : {}) };
  }
  if (a.skipped !== true && b.skipped !== true) return leftAt ? { skipped: false, skippedAt: leftAt } : {};
  const skipReason = a.skipReason === "know" || b.skipReason === "know" ? "know" : a.skipReason === "skip" || b.skipReason === "skip" ? "skip" : undefined;
  return skipReason
    ? { skipped: true, skipReason, ...(leftAt ? { skippedAt: leftAt } : {}) }
    : { skipped: true, ...(leftAt ? { skippedAt: leftAt } : {}) };
}

export function mergeExerciseRecord(a: ExerciseRecord, b: ExerciseRecord): ExerciseRecord {
  const attempts = Math.max(a.attempts, b.attempts);
  const correct = a.correct || b.correct;
  const firstTry = a.firstTry || b.firstTry;
  const contentHash = !a.contentHash
    ? b.contentHash
    : !b.contentHash
      ? a.contentHash
      : a.contentHash === b.contentHash
        ? a.contentHash
        : a.attempts >= b.attempts
          ? a.contentHash
          : b.contentHash;
  const base: ExerciseRecord = contentHash ? { attempts, correct, firstTry, contentHash } : { attempts, correct, firstTry };
  if (correct) return base;
  return { ...base, ...mergeSkip(a, b) };
}

/** Stamps the current hash onto a legacy record that has none. A mismatch is left alone so the exercise stays "updated". */
export function noteExerciseHash(state: ProgressState, key: string, contentHash: string): ProgressState {
  const prev = state.exercises[key];
  if (!prev || prev.contentHash) return state;
  return { ...state, exercises: { ...state.exercises, [key]: { ...prev, contentHash } } };
}

export type CompletionInput = {
  lessonKey: string;
  baseXp: number;
  exerciseKeys: string[];
  pendingDesktop: string[];
  now: Date;
};

export type CompletionResult = { state: ProgressState; xpGained: number; firstCompletion: boolean };

/**
 * Awards XP for a finished lesson. First completion pays the lesson XP plus a bonus per exercise
 * solved on the first try. Replays only pay bonuses not collected before (e.g. a desktop mission
 * that was skipped on a phone).
 */
export function completeLesson(state: ProgressState, input: CompletionInput): CompletionResult {
  const prev = state.lessons[input.lessonKey];
  const firstCompletion = !prev;
  const firstTryKeys = input.exerciseKeys.filter((k) => state.exercises[k]?.firstTry);
  const bonusNow = firstTryKeys.length * EXERCISE_BONUS_XP;
  const earnedBefore = prev?.xpEarned ?? 0;
  const total = input.baseXp + bonusNow;
  const xpGained = firstCompletion ? total : Math.max(0, total - earnedBefore);
  const pending = prev
    ? prev.pendingDesktop.filter((k) => input.pendingDesktop.includes(k))
    : input.pendingDesktop;
  return {
    firstCompletion,
    xpGained,
    state: {
      ...state,
      xp: state.xp + xpGained,
      lessons: {
        ...state.lessons,
        [input.lessonKey]: {
          completedAt: prev?.completedAt ?? input.now.toISOString(),
          xpEarned: earnedBefore + xpGained,
          pendingDesktop: pending,
        },
      },
      streak: touchStreak(state.streak, dayKey(input.now)),
      updatedAt: input.now.toISOString(),
    },
  };
}

/* ---------- Levels ---------- */

export const RANKS = [
  "Beginner",
  "Learner",
  "Practitioner",
  "Skilled",
  "Proficient",
  "Advanced",
  "Expert",
  "Master",
];

/** XP needed to reach `level` (level 1 = 0 XP, then 150, 400, 750, ...). */
export function xpForLevel(level: number): number {
  return level <= 1 ? 0 : 25 * (level - 1) * (2 * level + 2);
}

export function levelForXp(xp: number): { level: number; rank: string; into: number; span: number } {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const base = xpForLevel(level);
  return {
    level,
    rank: RANKS[Math.min(level - 1, RANKS.length - 1)],
    into: xp - base,
    span: xpForLevel(level + 1) - base,
  };
}

/* ---------- Respect (course mastery) ---------- */

export type RespectLesson = { key: string; exerciseCount: number; exerciseIds?: readonly string[] };

/** Skipped exercises in one lesson. Ids are the exercise id, not the `lesson#exercise` key. */
export function skippedExerciseCount(state: ProgressState, lessonKey: string, exerciseIds: readonly string[]): number {
  return exerciseIds.filter((id) => isExerciseSkipped(state.exercises[`${lessonKey}#${id}`])).length;
}

export function skippedExerciseTotal(state: ProgressState, lessons: readonly RespectLesson[]): number {
  return lessons.reduce((sum, lesson) => sum + skippedExerciseCount(state, lesson.key, lesson.exerciseIds ?? []), 0);
}

/**
 * 0-100. A completed lesson is worth 1, minus half a share for each desktop mission still pending,
 * and minus half a share for each exercise that is still skipped.
 *
 * Skipping does not block the next lesson: `nextLessonKey` only looks at lesson records, and
 * finishing a lesson writes that record whether the exercises were solved or skipped. A skipped
 * exercise is done-but-not-mastered: it counts in the percent at half a solve. A finished lesson
 * with nothing skipped is still worth a full share (older saves have no skip flags, so their
 * percent does not change). Solving the exercise later clears the skip and restores the share.
 * `exerciseIds` is optional so callers that only know the count keep the previous percent.
 */
export function respect(state: ProgressState, lessons: readonly RespectLesson[]): number {
  if (lessons.length === 0) return 0;
  let score = 0;
  for (const l of lessons) {
    const rec = state.lessons[l.key];
    if (!rec) continue;
    const pendingShare = l.exerciseCount ? rec.pendingDesktop.length / l.exerciseCount : 0;
    const skipped = skippedExerciseCount(state, l.key, l.exerciseIds ?? []);
    const skipShare = l.exerciseCount ? skipped / l.exerciseCount : 0;
    score += Math.max(0, 1 - 0.5 * pendingShare - 0.5 * skipShare);
  }
  return Math.round((score / lessons.length) * 100);
}

/** First lesson (in course order) that has not been completed. Skips do not keep it locked. */
export function nextLessonKey(state: ProgressState, orderedKeys: string[]): string | undefined {
  return orderedKeys.find((k) => !state.lessons[k]);
}

function cleanExercise(value: unknown): ExerciseRecord | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Partial<ExerciseRecord>;
  const next: ExerciseRecord = {
    attempts: typeof rec.attempts === "number" && rec.attempts >= 0 ? rec.attempts : 0,
    correct: rec.correct === true,
    firstTry: rec.firstTry === true,
  };
  if (typeof rec.contentHash === "string") next.contentHash = rec.contentHash;
  if (next.correct) return next;
  if (rec.skipped === true || rec.skipped === false) next.skipped = rec.skipped;
  if (rec.skipReason === "know" || rec.skipReason === "skip") next.skipReason = rec.skipReason;
  if (typeof rec.skippedAt === "string") next.skippedAt = rec.skippedAt;
  return next;
}

function cleanExercises(raw: unknown): Record<string, ExerciseRecord> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, ExerciseRecord> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const rec = cleanExercise(value);
    if (rec) out[key] = rec;
  }
  return out;
}

/** Tolerates old or partial saves instead of throwing them away, then rewrites any renamed ids. */
export function migrate(raw: unknown, renames: RenameMap = EMPTY_RENAMES): ProgressState {
  const base = emptyProgress();
  if (!raw || typeof raw !== "object") return applyRenames(base, renames);
  const r = raw as Partial<ProgressState>;
  return applyRenames(
    {
      version: PROGRESS_VERSION,
      xp: typeof r.xp === "number" && r.xp >= 0 ? r.xp : 0,
      lessons: r.lessons && typeof r.lessons === "object" ? r.lessons : {},
      exercises: cleanExercises(r.exercises),
      streak: r.streak && typeof r.streak === "object" ? { ...base.streak, ...r.streak } : base.streak,
      updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : null,
      epoch: typeof r.epoch === "number" && r.epoch >= 0 ? r.epoch : 0,
    },
    renames,
  );
}
