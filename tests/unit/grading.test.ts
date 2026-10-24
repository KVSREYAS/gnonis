import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  bossAnswer,
  bossTimeout,
  goalMet,
  blankAccepted,
  gradeCodeBlanks,
  gradeDebugLine,
  gradeDragSort,
  gradeEnvelope,
  gradeFill,
  gradeMcq,
  gradeOrdering,
  gradeParsons,
  gradePredict,
  gradeSliderDiagram,
  gradeSpotBug,
  gradeTrace,
  interpolateCurve,
  gradeSim,
  gradeTests,
  initialBoss,
  parseNumberInput,
  shuffleForOrdering,
  withinTolerance,
} from "@/lib/grading";
import { buildPythonHarness, parseHarnessOutput } from "@/lib/runner/python-harness";
import { defaultValues, getSim, kvBytesPerToken, sampleDistribution, SAMPLING_LOGITS } from "@/lib/sims";

describe("mcq / fill / ordering / debug-line", () => {
  const mcq = { options: ["a", "b", "c"], answer: 2, explanation: "e" };
  it("grades MCQ", () => {
    expect(gradeMcq(mcq, 2).correct).toBe(true);
    expect(gradeMcq(mcq, 0).correct).toBe(false);
    expect(gradeMcq(mcq, null)).toMatchObject({ correct: false, message: "Pick an answer first." });
  });

  it("grades fill-in chips per blank", () => {
    const ex = { answers: ["2", "kv_heads"], explanation: "e" };
    expect(gradeFill(ex, ["2", "kv_heads"]).correct).toBe(true);
    expect(gradeFill(ex, ["2", "query_heads"]).message).toMatch(/^1 blank is off/);
    expect(gradeFill(ex, ["2", null]).correct).toBe(false);
  });

  it("grades ordering and never starts solved", () => {
    const items = ["a", "b", "c", "d"];
    expect(gradeOrdering({ items, explanation: "e" }, ["a", "b", "c", "d"]).correct).toBe(true);
    expect(gradeOrdering({ items, explanation: "e" }, ["b", "a", "c", "d"]).message).toMatch(/^2 of 4/);
    for (let i = 0; i < 50; i++) {
      const s = shuffleForOrdering(items, `seed-${i}`);
      expect([...s].sort()).toEqual(items);
      expect(s).not.toEqual(items);
    }
    expect(shuffleForOrdering(items, "x")).toEqual(shuffleForOrdering(items, "x"));
  });

  it("grades debug-this line picks", () => {
    expect(gradeDebugLine({ bugLine: 5, explanation: "e" }, 5).correct).toBe(true);
    expect(gradeDebugLine({ bugLine: 5, explanation: "e" }, 4).correct).toBe(false);
  });
});

describe("predict-the-number", () => {
  it("parses friendly number input", () => {
    expect(parseNumberInput("1,300")).toBe(1300);
    expect(parseNumberInput("1.3k")).toBe(1300);
    expect(parseNumberInput("16e9")).toBe(16e9);
    expect(parseNumberInput(" 2 GB")).toBe(2e9);
    expect(parseNumberInput("131072 bytes")).toBe(131072);
    expect(parseNumberInput("abc")).toBeNaN();
  });

  it("applies relative and absolute tolerance", () => {
    const rel = { answer: 1600, tolerance: { mode: "relative" as const, value: 0.1 } };
    expect(withinTolerance(rel, 1440)).toBe(true);
    expect(withinTolerance(rel, 1439)).toBe(false);
    const abs = { answer: 52, tolerance: { mode: "absolute" as const, value: 1 } };
    expect(withinTolerance(abs, 51)).toBe(true);
    expect(withinTolerance(abs, 50)).toBe(false);
    expect(withinTolerance({ answer: 4, tolerance: { mode: "absolute", value: 0 } }, 4)).toBe(true);
  });

  it("explains direction when wrong", () => {
    const ex = { answer: 125, tolerance: { mode: "relative" as const, value: 0.04 }, unit: "tokens/s", explanation: "e" };
    expect(gradePredict(ex, "125").correct).toBe(true);
    expect(gradePredict(ex, "60").message).toMatch(/^Too low: the answer is 125 tokens\/s/);
    expect(gradePredict(ex, "x").message).toMatch(/Enter a number/);
  });
});

describe("simulators", () => {
  it("KV cache matches hand-computed Llama 3 8B numbers", () => {
    expect(kvBytesPerToken(32, 8, 128, 2)).toBe(131072);
    const sim = getSim("kv-cache")!;
    const out = sim.compute(defaultValues(sim));
    expect(out.kvPerSeqGB).toBeCloseTo(1.0737, 3);
    expect(out.maxBatch).toBe(52);
  });

  it("KV cache memory-budget mission is solvable with fp8 or a bigger GPU but not as given", () => {
    const sim = getSim("kv-cache")!;
    const goal = { output: "maxBatch", op: "gte" as const, value: 16, description: "d" };
    const base = defaultValues(sim, { seqLen: 32768, batch: 16 });
    expect(goalMet(goal, sim.compute(base))).toBe(false);
    expect(goalMet(goal, sim.compute({ ...base, kvBytes: 1 }))).toBe(true);
    expect(goalMet(goal, sim.compute({ ...base, gpuGB: 141 }))).toBe(true);
  });

  it("roofline: H100 fp16 decode becomes compute-bound at batch 512, not 256", () => {
    const sim = getSim("roofline")!;
    const v = defaultValues(sim);
    expect(sim.compute(v).ridge).toBeCloseTo(295.2, 0);
    expect(sim.compute({ ...v, batch: 256 }).computeBound).toBe(0);
    expect(sim.compute({ ...v, batch: 512 }).computeBound).toBe(1);
    expect(sim.compute(v).tokensPerSec).toBeCloseTo(209.4, 0);
    expect(sim.compute({ ...v, weightBytes: 0.5 }).tokensPerSec).toBeCloseTo(837.5, 0);
  });

  it("sampling: top-k=1 and low temperature are both greedy; T=1 is plain softmax", () => {
    const p1 = sampleDistribution(SAMPLING_LOGITS, 1, 1, 1);
    expect(p1[0]).toBe(1);
    expect(sampleDistribution(SAMPLING_LOGITS, 0.1, 8, 1)[0]).toBeGreaterThan(0.9);
    const p = sampleDistribution(SAMPLING_LOGITS, 1, 8, 1);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(p[0]).toBeLessThan(0.5);
  });

  it("attention cost crosses 80 GB at 64k tokens with 32 heads", () => {
    const sim = getSim("attention-cost")!;
    const v = defaultValues(sim);
    expect(sim.compute({ ...v, seqLen: 32768 }).scoresGB).toBeLessThan(80);
    expect(sim.compute({ ...v, seqLen: 65536 }).scoresGB).toBeGreaterThan(80);
  });

  it("grades goals including between", () => {
    const g = { output: "x", op: "between" as const, value: 1, max: 2, description: "d" };
    expect(gradeSim(g, { x: 1.5 }, "e").correct).toBe(true);
    expect(gradeSim(g, { x: 3 }, "e").message).toMatch(/^Not yet/);
    expect(gradeSim(undefined, {}, "e").correct).toBe(true);
  });
});

describe("boss fight state machine", () => {
  it("wins after every part is answered correctly", () => {
    let s = initialBoss(3, 2);
    s = bossAnswer(s, true, 3);
    s = bossAnswer(s, false, 3);
    expect(s).toMatchObject({ part: 1, bossHp: 2, playerHp: 1, status: "fighting" });
    s = bossAnswer(s, true, 3);
    s = bossAnswer(s, true, 3);
    expect(s).toMatchObject({ status: "won", bossHp: 0 });
    expect(bossAnswer(s, false, 3)).toBe(s);
  });

  it("loses on zero hearts or timeout", () => {
    let s = initialBoss(3, 1);
    s = bossAnswer(s, false, 3);
    expect(s).toMatchObject({ status: "lost", reason: "hp" });
    expect(bossTimeout(initialBoss(3, 3))).toMatchObject({ status: "lost", reason: "time" });
  });
});

describe("phase 2 graders", () => {
  it("grades envelope, trace, ordering, parsons, spot-the-bug, blanks, and the slider curve", () => {
    expect(gradeEnvelope({ answer: 128, tolerance: { mode: "absolute", value: 1 }, explanation: "e" }, "128").correct).toBe(true);
    expect(gradeTrace({ answer: "6", explanation: "e" }, " 6 ").correct).toBe(true);
    expect(gradeTrace({ answer: "6", explanation: "e" }, "7").correct).toBe(false);
    expect(gradeDragSort({ items: ["a", "b", "c"], explanation: "e" }, ["a", "b", "c"]).correct).toBe(true);
    expect(gradeParsons({ lines: ["a", "b", "c"], explanation: "e" }, ["b", "a", "c"]).correct).toBe(false);
    expect(gradeSpotBug({ bugLine: 2, explanation: "e" }, 2).correct).toBe(true);
    expect(blankAccepted({ answer: "2", pattern: "^2$" }, "2")).toBe(true);
    expect(gradeCodeBlanks({ blanks: [{ answer: "2", pattern: "^2$" }], explanation: "e" }, ["3"]).correct).toBe(false);
    expect(interpolateCurve([{ x: 0, y: 0 }, { x: 10, y: 100 }], 5)).toBe(50);
    expect(
      gradeSliderDiagram(
        { points: [{ x: 1, y: 800 }, { x: 8, y: 3000 }], goal: { op: "gte", value: 3000, description: "d" }, explanation: "e" },
        8,
      ).correct,
    ).toBe(true);
    expect(
      gradeSliderDiagram(
        { points: [{ x: 1, y: 800 }, { x: 8, y: 3000 }], goal: { op: "gte", value: 3000, description: "d" }, explanation: "e" },
        1,
      ).correct,
    ).toBe(false);
  });
});

describe("code runner harness", () => {
  it("grades test results", () => {
    expect(gradeTests([{ name: "a", passed: true }], null).correct).toBe(true);
    expect(gradeTests([{ name: "a", passed: false, message: "m" }], null).message).toMatch(/First failure: a: m/);
    expect(gradeTests([], "SyntaxError").correct).toBe(false);
  });

  it("parses harness output and tolerates noise", () => {
    const out = `hello\n__IA_RESULTS__{"error":null,"stdout":"hi","tests":[{"name":"t","passed":true}]}`;
    expect(parseHarnessOutput(out)).toEqual({ error: null, stdout: "hi", tests: [{ name: "t", passed: true }] });
    expect(parseHarnessOutput("nothing").error).toMatch(/no results/);
  });

  const python = ["python3", "python"].find((b) => spawnSync(b, ["--version"]).status === 0);
  it.skipIf(!python)("runs hidden tests in real CPython, including tricky quoting", () => {
    const run = (code: string, tests: string) =>
      parseHarnessOutput(spawnSync(python!, ["-"], { input: buildPythonHarness(code, tests), encoding: "utf8" }).stdout);
    const tests = `def test_add():\n    """adds"""\n    assert add(2, 3) == 5, "wrong sum"\n\ndef test_str():\n    assert s == 'it\\'s "quoted" \\\\ ok'\n`;
    const good = run(`def add(a, b):\n    print("debug")\n    return a + b\ns = 'it\\'s "quoted" \\\\ ok'\n`, tests);
    expect(good.error).toBeNull();
    expect(good.tests).toEqual([
      { name: "adds", passed: true },
      { name: "test_str", passed: true },
    ]);
    expect(good.stdout).toContain("debug");
    const bad = run("def add(a, b):\n    return a - b\ns = ''\n", tests);
    expect(bad.tests[0]).toMatchObject({ passed: false, message: "wrong sum" });
    expect(run("def broken(:\n", tests).error).toMatch(/SyntaxError/);
    const crashed = run("def add(a, b):\n    return a + b\n1 / 0\n", tests);
    expect(crashed.error).toMatch(/Traceback \(most recent call last\):/);
    expect(crashed.error).toMatch(/solution\.py/);
    expect(crashed.error).toMatch(/ZeroDivisionError/);
    const noisy = run("import sys\nsys.stderr.write('warn-token\\n')\ndef add(a, b):\n    return a + b\ns = 'it\\'s \"quoted\" \\\\ ok'\n", tests);
    expect(noisy.error).toBeNull();
    expect(noisy.stdout).toContain("warn-token");
  });
});
