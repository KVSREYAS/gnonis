import { applyRenames, EMPTY_RENAMES, type RenameMap } from "./rename-map";

export const PROGRESS_VERSION = 1;

export type LessonRecord = {
  completedAt: string;
  xpEarned: number;
  /** Exercises skipped because they are desktop-only and the lesson was played in phone mode. */
  pendingDesktop: string[];
};

export type ExerciseRecord = {
  attempts: number;
  correct: boolean;
  firstTry: boolean;
  /** Hash of the answer-bearing fields at the time this record was written. Absent on older saves. */
  contentHash?: string;
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

export function recordExercise(state: ProgressState, key: string, correct: boolean, contentHash?: string): ProgressState {
  const prev = state.exercises[key];
  const hashChanged = !!contentHash && !!prev?.contentHash && prev.contentHash !== contentHash;
  if (prev?.correct && !hashChanged) {
    if (contentHash && !prev.contentHash)
      return { ...state, exercises: { ...state.exercises, [key]: { ...prev, contentHash } } };
    return state;
  }
  if (prev && hashChanged && !correct) {
    return { ...state, exercises: { ...state.exercises, [key]: { ...prev, attempts: prev.attempts + 1, correct: true } } };
  }
  if (prev && hashChanged && correct) {
    return {
      ...state,
      exercises: {
        ...state.exercises,
        [key]: { attempts: prev.attempts + 1, correct: true, firstTry: prev.firstTry, contentHash },
      },
    };
  }
  const attempts = (prev?.attempts ?? 0) + 1;
  const next: ExerciseRecord = { attempts, correct, firstTry: correct && attempts === 1 };
  if (contentHash) next.contentHash = contentHash;
  return { ...state, exercises: { ...state.exercises, [key]: next } };
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
  "Street Rookie",
  "Block Runner",
  "Getaway Courier",
  "Crew Hustler",
  "District Boss",
  "Wanted Captain",
  "City Kingpin",
  "Gnosis Legend",
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

/**
 * 0-100. A completed lesson is worth 1, minus a share for desktop missions still pending.
 * `lessons` lists every playable lesson in the course with its exercise count.
 */
export function respect(state: ProgressState, lessons: { key: string; exerciseCount: number }[]): number {
  if (lessons.length === 0) return 0;
  let score = 0;
  for (const l of lessons) {
    const rec = state.lessons[l.key];
    if (!rec) continue;
    const pendingShare = l.exerciseCount ? rec.pendingDesktop.length / l.exerciseCount : 0;
    score += 1 - 0.5 * pendingShare;
  }
  return Math.round((score / lessons.length) * 100);
}

/** First lesson (in course order) that has not been completed. */
export function nextLessonKey(state: ProgressState, orderedKeys: string[]): string | undefined {
  return orderedKeys.find((k) => !state.lessons[k]);
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
      exercises: r.exercises && typeof r.exercises === "object" ? r.exercises : {},
      streak: r.streak && typeof r.streak === "object" ? { ...base.streak, ...r.streak } : base.streak,
      updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : null,
      epoch: typeof r.epoch === "number" && r.epoch >= 0 ? r.epoch : 0,
    },
    renames,
  );
}
