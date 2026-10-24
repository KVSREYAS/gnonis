import { describe, expect, it } from "vitest";
import {
  completeLesson,
  dayKey,
  emptyProgress,
  EXERCISE_BONUS_XP,
  levelForXp,
  liveStreak,
  migrate,
  nextLessonKey,
  recordExercise,
  respect,
  touchStreak,
  wantedStars,
  xpForLevel,
} from "@/lib/progress/logic";
import { LocalProgressStore, MemoryProgressStore } from "@/lib/progress/store";

const at = (iso: string) => new Date(iso);

describe("streak and wanted stars", () => {
  it("extends on consecutive days, ignores same-day repeats and resets after a gap", () => {
    let s = emptyProgress().streak;
    s = touchStreak(s, "2026-10-01");
    expect(s.current).toBe(1);
    s = touchStreak(s, "2026-10-01");
    expect(s.current).toBe(1);
    s = touchStreak(s, "2026-10-02");
    s = touchStreak(s, "2026-10-03");
    expect(s).toMatchObject({ current: 3, best: 3 });
    s = touchStreak(s, "2026-10-06");
    expect(s).toMatchObject({ current: 1, best: 3 });
  });

  it("handles month and year boundaries", () => {
    const s = touchStreak({ current: 5, best: 5, lastDay: "2026-12-31" }, "2027-01-01");
    expect(s.current).toBe(6);
  });

  it("shows a broken streak as 0 once a day is missed", () => {
    const s = { current: 4, best: 4, lastDay: "2026-10-10" };
    expect(liveStreak(s, "2026-10-10")).toBe(4);
    expect(liveStreak(s, "2026-10-11")).toBe(4);
    expect(liveStreak(s, "2026-10-12")).toBe(0);
  });

  it("maps streak days to 0-6 stars", () => {
    expect([0, 1, 2, 3, 4, 7, 13, 14, 29, 30, 365].map(wantedStars)).toEqual([0, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6]);
  });

  it("formats local day keys", () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("exercise records", () => {
  it("marks first-try correctness and stops counting once solved", () => {
    let s = recordExercise(emptyProgress(), "l#a", true);
    expect(s.exercises["l#a"]).toEqual({ attempts: 1, correct: true, firstTry: true });
    s = recordExercise(s, "l#a", false);
    expect(s.exercises["l#a"].attempts).toBe(1);
    s = recordExercise(s, "l#b", false);
    s = recordExercise(s, "l#b", true);
    expect(s.exercises["l#b"]).toEqual({ attempts: 2, correct: true, firstTry: false });
  });
});

describe("completeLesson", () => {
  const input = { lessonKey: "c/m/l", baseXp: 50, exerciseKeys: ["c/m/l#a", "c/m/l#b", "c/m/l#code"], pendingDesktop: [] as string[] };

  it("pays base XP plus first-try bonuses and starts the streak", () => {
    let s = recordExercise(emptyProgress(), "c/m/l#a", true);
    s = recordExercise(s, "c/m/l#b", false);
    const r = completeLesson(s, { ...input, now: at("2026-10-22T12:00:00") });
    expect(r.firstCompletion).toBe(true);
    expect(r.xpGained).toBe(50 + EXERCISE_BONUS_XP);
    expect(r.state.xp).toBe(60);
    expect(r.state.streak.current).toBe(1);
  });

  it("does not pay twice for a replay", () => {
    const first = completeLesson(emptyProgress(), { ...input, now: at("2026-10-22T12:00:00") });
    const again = completeLesson(first.state, { ...input, now: at("2026-10-22T13:00:00") });
    expect(again.firstCompletion).toBe(false);
    expect(again.xpGained).toBe(0);
    expect(again.state.xp).toBe(first.state.xp);
  });

  it("tracks desktop missions skipped on a phone and pays the bonus when finished later", () => {
    const phone = completeLesson(emptyProgress(), { ...input, pendingDesktop: ["c/m/l#code"], now: at("2026-10-22T09:00:00") });
    expect(phone.state.lessons["c/m/l"].pendingDesktop).toEqual(["c/m/l#code"]);
    const solved = recordExercise(phone.state, "c/m/l#code", true);
    const desktop = completeLesson(solved, { ...input, pendingDesktop: [], now: at("2026-10-23T09:00:00") });
    expect(desktop.xpGained).toBe(EXERCISE_BONUS_XP);
    expect(desktop.state.lessons["c/m/l"].pendingDesktop).toEqual([]);
    expect(desktop.state.streak.current).toBe(2);
  });
});

describe("levels, respect and next lesson", () => {
  it("has increasing level thresholds", () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 150, 400, 750, 1200]);
    expect(levelForXp(0)).toMatchObject({ level: 1, rank: "Token Rookie", into: 0, span: 150 });
    expect(levelForXp(149).level).toBe(1);
    expect(levelForXp(150).level).toBe(2);
    expect(levelForXp(1340)).toMatchObject({ level: 5, into: 140 });
  });

  it("computes respect with a penalty for pending desktop missions", () => {
    const lessons = [
      { key: "a", exerciseCount: 2 },
      { key: "b", exerciseCount: 2 },
    ];
    const s = emptyProgress();
    expect(respect(s, lessons)).toBe(0);
    s.lessons.a = { completedAt: "", xpEarned: 1, pendingDesktop: [] };
    expect(respect(s, lessons)).toBe(50);
    s.lessons.b = { completedAt: "", xpEarned: 1, pendingDesktop: ["b#x"] };
    expect(respect(s, lessons)).toBe(88);
    expect(respect(s, [])).toBe(0);
  });

  it("finds the first unfinished lesson", () => {
    const s = emptyProgress();
    s.lessons.a = { completedAt: "", xpEarned: 1, pendingDesktop: [] };
    expect(nextLessonKey(s, ["a", "b", "c"])).toBe("b");
  });
});

describe("storage", () => {
  it("migrates partial or corrupt saves instead of crashing", () => {
    expect(migrate(null)).toEqual(emptyProgress());
    expect(migrate({ xp: -5, lessons: "nope" })).toMatchObject({ xp: 0, lessons: {} });
    expect(migrate({ xp: 42, streak: { current: 2 } }).streak).toEqual({ current: 2, best: 0, lastDay: null });
  });

  it("round-trips through LocalProgressStore with any Storage-like backend", async () => {
    const mem = new Map<string, string>();
    const backend = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    const store = new LocalProgressStore(backend, "k");
    expect(await store.load()).toEqual(emptyProgress());
    const s = { ...emptyProgress(), xp: 123 };
    await store.save(s);
    expect((await store.load()).xp).toBe(123);
    mem.set("k", "{not json");
    expect(await store.load()).toEqual(emptyProgress());
    await store.clear();
    expect(mem.has("k")).toBe(false);
  });

  it("MemoryProgressStore isolates copies", async () => {
    const store = new MemoryProgressStore();
    const s = await store.load();
    s.xp = 99;
    expect((await store.load()).xp).toBe(0);
  });
});
