import type { LessonRecord, ProgressState, ExerciseRecord } from "./logic";

export type RenameMap = {
  courses: Record<string, string>;
  lessons: Record<string, string>;
  exercises: Record<string, string>;
};

export const EMPTY_RENAMES: RenameMap = { courses: {}, lessons: {}, exercises: {} };

export function renameLessonId(id: string, map: RenameMap): string {
  if (map.lessons[id]) return map.lessons[id];
  for (const [from, to] of Object.entries(map.courses)) {
    if (id === from) return to;
    if (id.startsWith(`${from}/`)) return to + id.slice(from.length);
  }
  return id;
}

export function renameExerciseId(id: string, map: RenameMap): string {
  if (map.exercises[id]) return map.exercises[id];
  const hash = id.indexOf("#");
  if (hash === -1) return id;
  const rewritten = renameLessonId(id.slice(0, hash), map) + id.slice(hash);
  return map.exercises[rewritten] ?? rewritten;
}

function mergeLessons(a: LessonRecord, b: LessonRecord): LessonRecord {
  const pendingB = new Set(b.pendingDesktop ?? []);
  return {
    completedAt: a.completedAt < b.completedAt ? a.completedAt : b.completedAt,
    xpEarned: Math.max(a.xpEarned, b.xpEarned),
    pendingDesktop: (a.pendingDesktop ?? []).filter((k) => pendingB.has(k)).sort(),
  };
}

function mergeExercises(a: ExerciseRecord, b: ExerciseRecord): ExerciseRecord {
  const attempts = Math.max(a.attempts, b.attempts);
  const correct = a.correct || b.correct;
  const firstTry = a.firstTry || b.firstTry;
  const hash = !a.contentHash ? b.contentHash : !b.contentHash ? a.contentHash : a.contentHash === b.contentHash ? a.contentHash : a.attempts >= b.attempts ? a.contentHash : b.contentHash;
  return hash ? { attempts, correct, firstTry, contentHash: hash } : { attempts, correct, firstTry };
}

/** Rewrites saved lesson and exercise keys. Explicit ids win over a course-prefix rewrite. */
export function applyRenames(state: ProgressState, map: RenameMap): ProgressState {
  const count = Object.keys(map.courses).length + Object.keys(map.lessons).length + Object.keys(map.exercises).length;
  if (count === 0) return state;

  const lessons: ProgressState["lessons"] = {};
  for (const [key, rec] of Object.entries(state.lessons)) {
    const next = renameLessonId(key, map);
    const updated: LessonRecord = { ...rec, pendingDesktop: (rec.pendingDesktop ?? []).map((k) => renameExerciseId(k, map)) };
    lessons[next] = lessons[next] ? mergeLessons(lessons[next], updated) : updated;
  }
  const exercises: ProgressState["exercises"] = {};
  for (const [key, rec] of Object.entries(state.exercises)) {
    const next = renameExerciseId(key, map);
    exercises[next] = exercises[next] ? mergeExercises(exercises[next], rec) : rec;
  }
  return { ...state, lessons, exercises };
}
