import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadAllCourses } from "@/lib/content/loader";
import { CourseSchema, ExerciseSchema, LessonFrontmatterSchema, ModuleSchema, parseLessonBody } from "@/lib/content/schema";

describe("ExerciseSchema", () => {
  it("accepts a valid MCQ and requires devices", () => {
    const mcq = { type: "mcq", devices: ["phone", "desktop"], prompt: "Q?", options: ["a", "b"], answer: 1, explanation: "because" };
    expect(ExerciseSchema.safeParse(mcq).success).toBe(true);
    const { devices: _omit, ...noDevices } = mcq;
    void _omit;
    expect(ExerciseSchema.safeParse(noDevices).success).toBe(false);
    expect(ExerciseSchema.safeParse({ ...mcq, devices: [] }).success).toBe(false);
    expect(ExerciseSchema.safeParse({ ...mcq, devices: ["tablet"] }).success).toBe(false);
  });

  it("rejects an MCQ answer index outside the options", () => {
    const r = ExerciseSchema.safeParse({ type: "mcq", devices: ["phone"], prompt: "Q", options: ["a", "b"], answer: 2, explanation: "x" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toMatch(/out of range/);
  });

  it("checks fill-in blanks against answers and chips", () => {
    const base = { type: "fill", devices: ["phone"], text: "A {{0}} and {{1}}", chips: ["x", "y", "z"], answers: ["x", "y"], explanation: "e" };
    expect(ExerciseSchema.safeParse(base).success).toBe(true);
    expect(ExerciseSchema.safeParse({ ...base, text: "only {{0}}" }).success).toBe(false);
    expect(ExerciseSchema.safeParse({ ...base, answers: ["x", "nope"] }).success).toBe(false);
  });

  it("defaults predict tolerance to 5% relative", () => {
    const r = ExerciseSchema.parse({ type: "predict", devices: ["desktop"], prompt: "n?", answer: 10, explanation: "e" });
    expect(r.type === "predict" && r.tolerance).toEqual({ mode: "relative", value: 0.05 });
  });

  it("requires tests + solution for code-mode debug and a bugLine for line mode", () => {
    const base = { type: "debug", devices: ["phone"], language: "python", prompt: "p", code: "a = 1\nb = 2", explanation: "e" };
    expect(ExerciseSchema.safeParse({ ...base, mode: "line", bugLine: 2 }).success).toBe(true);
    expect(ExerciseSchema.safeParse({ ...base, mode: "line", bugLine: 9 }).success).toBe(false);
    expect(ExerciseSchema.safeParse({ ...base, mode: "code" }).success).toBe(false);
  });

  it("validates boss parts recursively and only allows quick types", () => {
    const part = { type: "mcq", prompt: "q", options: ["a", "b"], answer: 0, explanation: "e" };
    const boss = { type: "boss", devices: ["phone"], title: "B", briefing: "b", timeLimit: 60, parts: [part, part], explanation: "e" };
    expect(ExerciseSchema.safeParse(boss).success).toBe(true);
    expect(ExerciseSchema.safeParse({ ...boss, parts: [part, { ...part, answer: 5 }] }).success).toBe(false);
    expect(ExerciseSchema.safeParse({ ...boss, parts: [part, { type: "code", prompt: "x" }] }).success).toBe(false);
  });

  it("validates stepper matrix shapes", () => {
    const frame = (cells: (number | null)[][]) => ({ caption: "c", view: { kind: "matrix", rows: ["a", "b"], cols: ["a", "b"], cells } });
    const ok = { type: "stepper", devices: ["phone"], prompt: "p", explanation: "e", frames: [frame([[1, null], [1, 2]]), frame([[1, 2], [3, 4]])] };
    expect(ExerciseSchema.safeParse(ok).success).toBe(true);
    expect(ExerciseSchema.safeParse({ ...ok, frames: [frame([[1]]), frame([[1, 2], [3, 4]])] }).success).toBe(false);
  });
});

describe("lesson, module and course schemas", () => {
  it("needs exactly three key ideas", () => {
    const fm = { title: "t", summary: "s", xp: 10, keyIdeas: ["a", "b"] };
    expect(LessonFrontmatterSchema.safeParse(fm).success).toBe(false);
    expect(LessonFrontmatterSchema.safeParse({ ...fm, keyIdeas: ["a", "b", "c"] }).success).toBe(true);
  });

  it("rejects unknown keys (typos) in frontmatter", () => {
    expect(LessonFrontmatterSchema.safeParse({ title: "t", summary: "s", xp: 1, keyIdeas: ["a", "b", "c"], tittle: "x" }).success).toBe(false);
  });

  it("requires lessons for ready modules but not for stubs", () => {
    const m = { title: "t", district: "d", summary: "s", tip: "tip" };
    expect(ModuleSchema.safeParse({ ...m, status: "ready" }).success).toBe(false);
    expect(ModuleSchema.safeParse({ ...m, status: "stub" }).success).toBe(true);
  });

  it("rejects duplicate module slugs", () => {
    expect(CourseSchema.safeParse({ title: "t", tagline: "t", description: "d", modules: ["a", "a"] }).success).toBe(false);
  });
});

describe("parseLessonBody", () => {
  it("splits cards on ## and places exercises between them", () => {
    const { blocks, errors } = parseLessonBody(`## One\nHello **world**.\n\n<Exercise id="q1" />\n\n## Two\nMore text.\n`);
    expect(errors).toEqual([]);
    expect(blocks.map((b) => b.kind)).toEqual(["card", "exercise", "card"]);
    expect(blocks[0]).toMatchObject({ kind: "card", title: "One", words: 2 });
    expect(blocks[1]).toEqual({ kind: "exercise", id: "q1" });
  });

  it("ignores exercise tags and headings inside code fences", () => {
    const { blocks, errors } = parseLessonBody("## Card\n```\n## not a heading\n<Exercise id=\"x\" />\n```\n");
    expect(errors).toEqual([]);
    expect(blocks).toHaveLength(1);
  });

  it("flags stray text, # headings and over-long cards", () => {
    expect(parseLessonBody("stray\n## A\ntext").errors[0]).toMatch(/before the first/);
    expect(parseLessonBody("## A\nx\n<Exercise id=\"q\" />\nloose text").errors[0]).toMatch(/needs its own/);
    expect(parseLessonBody("# Big\n## A\ntext").errors[0]).toMatch(/reserved/);
    expect(parseLessonBody(`## Long\n${"word ".repeat(400)}`).errors[0]).toMatch(/max/);
  });
});

describe("loader", () => {
  let tmp: string | undefined;
  afterEach(() => tmp && fs.rmSync(tmp, { recursive: true, force: true }));

  const write = (rel: string, body: string) => {
    const f = path.join(tmp!, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, body);
  };

  it("loads the shipped course packs without a single issue", () => {
    const { courses, issues } = loadAllCourses();
    expect(issues).toEqual([]);
    expect(courses.map((c) => c.slug)).toEqual(["llm-inference", "sample-bits-bytes"]);
    const llm = courses[0];
    expect(llm.modules).toHaveLength(12);
    for (const m of llm.modules.slice(0, 4)) {
      expect(m.status).toBe("ready");
      expect(m.lessons.length).toBeGreaterThanOrEqual(3);
      expect(m.lessons.some((l) => l.kind === "boss")).toBe(true);
      const types = m.lessons.flatMap((l) => Object.values(l.exercises).map((e) => e.type));
      expect(types.some((t) => t === "simulator" || t === "stepper")).toBe(true);
    }
    for (const m of llm.modules.slice(4)) expect(m.status).toBe("stub");
  });

  it("covers every widget type somewhere in the LLM course", () => {
    const { courses } = loadAllCourses();
    const types = new Set(courses[0].modules.flatMap((m) => m.lessons.flatMap((l) => Object.values(l.exercises).map((e) => e.type))));
    expect([...types].sort()).toEqual(["boss", "code", "debug", "fill", "mcq", "ordering", "predict", "simulator", "stepper"]);
  });

  it("reports broken references in a new pack without code changes", () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ia-content-"));
    write("demo/course.yaml", "title: Demo\ntagline: t\ndescription: d\nmodules: [m1, missing]\n");
    write("demo/modules/m1/module.yaml", "title: M\ndistrict: D\nsummary: s\ntip: t\nlessons: [l1]\n");
    write(
      "demo/modules/m1/lessons/l1.mdx",
      [
        "---",
        "title: L",
        "summary: s",
        "xp: 10",
        "keyIdeas: [a, b, c]",
        "exercises:",
        "  sim:",
        "    type: simulator",
        "    devices: [phone]",
        "    sim: warp-drive",
        "    prompt: p",
        "    explanation: e",
        "  unused:",
        "    type: mcq",
        "    devices: [phone]",
        "    prompt: q",
        "    options: [a, b]",
        "    answer: 0",
        "    explanation: e",
        "---",
        "## Card",
        "Text.",
        '<Exercise id="sim" />',
        '<Exercise id="ghost" />',
      ].join("\n"),
    );
    write("demo/modules/m1/lessons/orphan.mdx", "---\ntitle: x\n---\n");
    const { courses, issues } = loadAllCourses(tmp);
    const msgs = issues.map((i) => i.message).join("\n");
    expect(courses).toHaveLength(1);
    expect(msgs).toMatch(/module "missing" is listed/);
    expect(msgs).toMatch(/unknown sim "warp-drive"/);
    expect(msgs).toMatch(/"unused" is declared but never placed/);
    expect(msgs).toMatch(/<Exercise id="ghost" \/> has no matching entry/);
    expect(msgs).toMatch(/not listed in module.yaml/);
  });

  it("checks simulator params against the sim's sliders and options", () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ia-content-"));
    write("c/course.yaml", "title: C\ntagline: t\ndescription: d\nmodules: [m]\n");
    write("c/modules/m/module.yaml", "title: M\ndistrict: D\nsummary: s\ntip: t\nlessons: [l]\n");
    write(
      "c/modules/m/lessons/l.mdx",
      `---\ntitle: L\nsummary: s\nxp: 1\nkeyIdeas: [a, b, c]\nexercises:\n  s:\n    type: simulator\n    devices: [phone]\n    sim: kv-cache\n    prompt: p\n    params: { warp: 1, kvHeads: 3 }\n    goal: { output: nope, op: gte, value: 1, description: d }\n    explanation: e\n---\n## A\nx\n<Exercise id="s" />\n`,
    );
    const msgs = loadAllCourses(tmp).issues.map((i) => i.message).join("\n");
    expect(msgs).toMatch(/no slider "warp"/);
    expect(msgs).toMatch(/kvHeads=3 is not one of/);
    expect(msgs).toMatch(/no output "nope"/);
  });
});
