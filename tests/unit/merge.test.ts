import { describe, expect, it } from "vitest";
import { completeLesson, emptyProgress, migrate, recordExercise, resetProgress, type ProgressState } from "@/lib/progress/logic";
import { isEmptyProgress, mergeProgress, sameProgress } from "@/lib/progress/merge";

const at = (iso: string) => new Date(iso);
const lesson = (key: string, baseXp = 50, pendingDesktop: string[] = []) => ({
  lessonKey: key,
  baseXp,
  exerciseKeys: [`${key}#a`, `${key}#code`],
  pendingDesktop,
});

/** A phone that finished lesson A, and a PC that finished lesson B and also lesson A later. */
function fixtures() {
  let phone = recordExercise(emptyProgress(), "c/m/a#a", true);
  phone = completeLesson(phone, { ...lesson("c/m/a", 50, ["c/m/a#code"]), now: at("2026-10-20T09:00:00") }).state;
  let pc = recordExercise(emptyProgress(), "c/m/b#a", false);
  pc = recordExercise(pc, "c/m/b#a", true);
  pc = completeLesson(pc, { ...lesson("c/m/b", 30), now: at("2026-10-21T20:00:00") }).state;
  pc = recordExercise(pc, "c/m/a#code", true);
  pc = completeLesson(pc, { ...lesson("c/m/a", 50), now: at("2026-10-22T20:00:00") }).state;
  return { phone, pc };
}

describe("mergeProgress", () => {
  it("unions completed lessons and exercises", () => {
    const { phone, pc } = fixtures();
    const m = mergeProgress(phone, pc);
    expect(Object.keys(m.lessons).sort()).toEqual(["c/m/a", "c/m/b"]);
    expect(Object.keys(m.exercises).sort()).toEqual(["c/m/a#a", "c/m/a#code", "c/m/b#a"]);
  });

  it("adds up XP from different lessons without counting a shared lesson twice", () => {
    const { phone, pc } = fixtures();
    // phone: a = 50 + 10 first-try bonus. pc: b = 30, a = 50 + 10 (code first try).
    expect(phone.xp).toBe(60);
    expect(pc.xp).toBe(90);
    const m = mergeProgress(phone, pc);
    expect(m.lessons["c/m/a"].xpEarned).toBe(60);
    expect(m.xp).toBe(90);

    const guest = completeLesson(emptyProgress(), { ...lesson("x/y/z", 40), now: at("2026-10-23T10:00:00") }).state;
    expect(mergeProgress(pc, guest).xp).toBe(130);
  });

  it("never lowers XP below either side", () => {
    const legacy = { ...emptyProgress(), xp: 500 };
    const { pc } = fixtures();
    expect(mergeProgress(legacy, pc).xp).toBe(500);
  });

  it("keeps the earliest completion and only desktop missions pending on both sides", () => {
    const { phone, pc } = fixtures();
    const m = mergeProgress(phone, pc);
    expect(m.lessons["c/m/a"].completedAt).toBe(phone.lessons["c/m/a"].completedAt);
    expect(m.lessons["c/m/a"].pendingDesktop).toEqual([]);

    const otherPhone = completeLesson(emptyProgress(), { ...lesson("c/m/a", 50, ["c/m/a#code"]), now: at("2026-10-24T09:00:00") }).state;
    expect(mergeProgress(phone, otherPhone).lessons["c/m/a"].pendingDesktop).toEqual(["c/m/a#code"]);
  });

  it("treats an exercise solved or first-tried on either side as solved or first-tried", () => {
    const a: ProgressState = { ...emptyProgress(), exercises: { e: { attempts: 3, correct: false, firstTry: false } } };
    const b: ProgressState = { ...emptyProgress(), exercises: { e: { attempts: 1, correct: true, firstTry: true } } };
    expect(mergeProgress(a, b).exercises.e).toEqual({ attempts: 3, correct: true, firstTry: true });
  });

  it("takes the most recent streak and the best of both", () => {
    const a = { ...emptyProgress(), streak: { current: 9, best: 12, lastDay: "2026-10-10" } };
    const b = { ...emptyProgress(), streak: { current: 2, best: 2, lastDay: "2026-10-22" } };
    expect(mergeProgress(a, b).streak).toEqual({ current: 2, best: 12, lastDay: "2026-10-22" });
    const same = { ...emptyProgress(), streak: { current: 4, best: 5, lastDay: "2026-10-22" } };
    expect(mergeProgress(b, same).streak).toEqual({ current: 4, best: 5, lastDay: "2026-10-22" });
  });

  it("lets a reset (higher epoch) win outright", () => {
    const { pc } = fixtures();
    const wiped = resetProgress(pc, at("2026-10-23T08:00:00"));
    expect(wiped.epoch).toBe(1);
    expect(mergeProgress(pc, wiped)).toEqual(wiped);
    expect(mergeProgress(wiped, pc)).toEqual(wiped);
  });

  it("is order-independent and idempotent", () => {
    const { phone, pc } = fixtures();
    const empty = emptyProgress();
    for (const [x, y] of [
      [phone, pc],
      [pc, empty],
      [phone, empty],
    ]) {
      expect(sameProgress(mergeProgress(x, y), mergeProgress(y, x))).toBe(true);
      const m = mergeProgress(x, y);
      expect(sameProgress(mergeProgress(m, x), m)).toBe(true);
      expect(sameProgress(mergeProgress(m, m), m)).toBe(true);
    }
    expect(sameProgress(mergeProgress(mergeProgress(phone, pc), empty), mergeProgress(phone, mergeProgress(pc, empty)))).toBe(true);
  });

  it("does not mutate its inputs", () => {
    const { phone, pc } = fixtures();
    const before = JSON.stringify([phone, pc]);
    const m = mergeProgress(phone, pc);
    m.lessons["c/m/a"].pendingDesktop.push("mutated");
    expect(JSON.stringify([phone, pc])).toBe(before);
  });
});

describe("merge helpers", () => {
  it("detects an empty save", () => {
    expect(isEmptyProgress(emptyProgress())).toBe(true);
    expect(isEmptyProgress(recordExercise(emptyProgress(), "e", false))).toBe(false);
  });

  it("compares saves regardless of key order", () => {
    const a = { ...emptyProgress(), exercises: { x: { attempts: 1, correct: true, firstTry: true } } };
    const b = JSON.parse(JSON.stringify({ epoch: 0, ...a, exercises: { x: { firstTry: true, correct: true, attempts: 1 } } }));
    expect(sameProgress(a, b)).toBe(true);
    expect(sameProgress(a, { ...a, xp: 1 })).toBe(false);
  });

  it("migrates the epoch, defaulting old saves to 0", () => {
    expect(migrate({ xp: 5 }).epoch).toBe(0);
    expect(migrate({ epoch: 3 }).epoch).toBe(3);
    expect(migrate({ epoch: -1 }).epoch).toBe(0);
  });
});
