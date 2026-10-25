import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { exerciseContentHash } from "@/lib/content/hash";
import { loadAllCourses } from "@/lib/content/loader";
import { parseLessonSource } from "@/lib/content/mdx";
import { CourseSchema, DistrictSchema, ExerciseSchema, LessonFrontmatterSchema } from "@/lib/content/schema";

const frontmatter = {
  id: "demo/missions/01-one",
  title: "t",
  estMinutes: 5,
  xp: 10,
  missionIntro: "s",
};

describe("ExerciseSchema", () => {
  it("accepts an MCQ and defaults devices to phone and desktop", () => {
    const mcq = { type: "mcq", devices: ["phone", "desktop"], prompt: "Q?", options: ["a", "b"], answer: 1, explanation: "because" };
    expect(ExerciseSchema.safeParse(mcq).success).toBe(true);
    const { devices: _omit, ...noDevices } = mcq;
    void _omit;
    const parsed = ExerciseSchema.parse(noDevices);
    expect(parsed.type === "mcq" && parsed.devices).toEqual(["phone", "desktop"]);
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

  it("keeps a Python code exercise hash stable when visible tests are omitted", () => {
    const raw = {
      type: "code" as const,
      devices: ["phone" as const],
      language: "python" as const,
      prompt: "p",
      starter: "def add(a, b):\n    return 0\n",
      tests: "def test_add():\n    assert add(1, 2) == 3\n",
      solution: "def add(a, b):\n    return a + b\n",
      explanation: "e",
    };
    const parsed = ExerciseSchema.parse(raw);
    expect(parsed.type === "code" && parsed.language).toBe("python");
    expect(parsed).not.toHaveProperty("visibleTests");
    expect(exerciseContentHash(parsed)).toBe(
      exerciseContentHash({
        ...raw,
        starter: raw.starter.trim(),
        tests: raw.tests.trim(),
        solution: raw.solution.trim(),
        hints: [],
      }),
    );
    const withVisible = ExerciseSchema.parse({ ...raw, visibleTests: "def test_sample():\n    assert add(2, 3) == 5\n" });
    expect(exerciseContentHash(parsed)).not.toBe(exerciseContentHash(withVisible));
    expect(
      ExerciseSchema.safeParse({
        ...raw,
        language: "cpp",
        visibleTests: '#include "check.h"\nint main() {\n    CHECK(add(2, 3) == 5);\n    return 0;\n}\n',
      }).success,
    ).toBe(true);
    expect(ExerciseSchema.safeParse({ ...raw, language: "rust" }).success).toBe(false);
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

describe("lesson and course schemas", () => {
  it("requires an explicit id and treats key ideas as optional", () => {
    expect(LessonFrontmatterSchema.safeParse(frontmatter).success).toBe(true);
    const { id: _id, ...noId } = frontmatter;
    void _id;
    expect(LessonFrontmatterSchema.safeParse(noId).success).toBe(false);
    expect(LessonFrontmatterSchema.safeParse({ ...frontmatter, keyIdeas: ["a", "b", "c"] }).success).toBe(true);
  });

  it("rejects unknown keys (typos) in frontmatter", () => {
    expect(LessonFrontmatterSchema.safeParse({ ...frontmatter, tittle: "x" }).success).toBe(false);
  });

  it("requires lessons for ready districts but not for stubs", () => {
    const m = { id: "missions", title: "t", district: "d", summary: "s", tip: "tip" };
    expect(DistrictSchema.safeParse({ ...m, status: "ready" }).success).toBe(false);
    expect(DistrictSchema.safeParse({ ...m, status: "ready", lessons: ["one"] }).success).toBe(true);
    expect(DistrictSchema.safeParse({ ...m, status: "stub" }).success).toBe(true);
    expect(DistrictSchema.safeParse({ ...m, status: "stub", lessons: ["one"] }).success).toBe(false);
  });

  it("rejects duplicate lesson slugs and a lessons list that disagrees with the districts", () => {
    const district = { id: "missions", title: "t", district: "d", summary: "s", tip: "tip", lessons: ["a"] };
    const course = { id: "demo", title: "t", description: "d", cover: "skyline", lessons: ["a", "a"], districts: [district] };
    expect(CourseSchema.safeParse(course).success).toBe(false);
    expect(CourseSchema.safeParse({ ...course, lessons: ["a"], districts: [{ ...district, lessons: ["b"] }] }).success).toBe(false);
    expect(CourseSchema.safeParse({ ...course, lessons: ["a"], districts: [district] }).success).toBe(true);
  });
});

describe("parseLessonSource", () => {
  const tags = ["MCQ"];

  it("splits cards on ## and places exercises between them", () => {
    const { blocks, errors, exercises } = parseLessonSource(`## One\nHello **world**.\n\n<MCQ id="q1" prompt="p" />\n\n## Two\nMore text.\n`, tags);
    expect(errors).toEqual([]);
    expect(blocks.map((b) => b.kind)).toEqual(["card", "exercise", "card"]);
    expect(blocks[0]).toMatchObject({ kind: "card", title: "One", words: 2 });
    expect(blocks[1]).toEqual({ kind: "exercise", id: "q1" });
    expect(exercises[0]).toMatchObject({ id: "q1", tag: "MCQ", props: { prompt: "p" } });
  });

  it("ignores exercise tags and headings inside code fences", () => {
    const { blocks, errors } = parseLessonSource('## Card\n```\n## not a heading\n<MCQ id="x" />\n```\n', tags);
    expect(errors).toEqual([]);
    expect(blocks).toHaveLength(1);
  });

  it("flags stray text, # headings and over-long cards", () => {
    expect(parseLessonSource("stray\n## A\ntext", tags).errors[0]).toMatch(/before the first/);
    expect(parseLessonSource('## A\nx\n<MCQ id="q" />\nloose text', tags).errors[0]).toMatch(/needs its own/);
    expect(parseLessonSource("# Big\n## A\ntext", tags).errors[0]).toMatch(/reserved/);
    expect(parseLessonSource(`## Long\n${"word ".repeat(400)}`, tags).errors[0]).toMatch(/max/);
  });

  it("parses object and array literals and rejects code", () => {
    const ok = parseLessonSource('## A\nText.\n<MCQ id="q" options={["a", "b"]} answer={1} />\n', tags);
    expect(ok.errors).toEqual([]);
    expect(ok.exercises[0].props).toMatchObject({ options: ["a", "b"], answer: 1 });
    expect(parseLessonSource('## A\nText.\n<MCQ id="q" prompt={`${1}`} />\n', tags).errors.join("\n")).toMatch(/template interpolation/);
    expect(parseLessonSource('## A\nText.\n<MCQ id="q" prompt={function(){}} />\n', tags).errors.join("\n")).toMatch(/unexpected/);
    expect(parseLessonSource('## A\nText.\n<Nope id="q" />\n', tags).errors.join("\n")).toMatch(/unknown exercise component <Nope>/);
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
    expect(courses.map((c) => c.slug)).toEqual(["llm-inference", "sample-bits-bytes", "cpp-systems"]);
    const llm = courses[0];
    expect(llm.modules).toHaveLength(12);
    for (const m of llm.modules.slice(0, 4)) {
      expect(m.status).toBe("ready");
      expect(m.lessons.length).toBeGreaterThanOrEqual(3);
      expect(m.lessons.some((l) => l.kind === "boss")).toBe(true);
      const types = m.lessons.flatMap((l) => Object.values(l.exercises).map((e) => e.type));
      expect(types.some((t) => t === "simulator" || t === "stepper")).toBe(true);
    }
    for (const m of llm.modules.slice(4)) expect(m.status).toBe(m.lessons.length ? "ready" : "stub");

    const ids = new Set(llm.modules.flatMap((m) => m.lessons.map((l) => l.id)));
    for (const id of [
      "llm-inference/01-tokens-forward-pass/01-what-is-a-token",
      "llm-inference/05-batching/01-continuous-batching",
      "llm-inference/06-paged-attention/01-kv-as-virtual-memory",
      "llm-inference/07-quantization/01-fewer-bytes-faster-tokens",
      "llm-inference/09-speculative-decoding/01-draft-and-verify",
      "llm-inference/11-serving-systems/01-ttft-tpot-and-prefix-caching",
    ])
      expect(ids.has(id)).toBe(true);

    const token = llm.modules[0].lessons[0];
    expect(token.slug).toBe("01-what-is-a-token");
    expect(token.blocks.filter((b) => b.kind === "card").some((b) => b.kind === "card" && b.title === "Mission briefing")).toBe(true);
    const diagrams = llm.modules
      .flatMap((m) => m.lessons)
      .flatMap((l) => l.blocks)
      .filter((b) => b.kind === "card")
      .flatMap((b) => (b.kind === "card" ? [...b.markdown.matchAll(/\]\((\/diagrams\/[^)]+)\)/g)].map((m) => m[1]) : []));
    expect(diagrams).toHaveLength(40);
    expect(diagrams).toContain("/diagrams/llm-inference/05-batching/01-continuous-batching.png");

    const sample = courses[1];
    const kit = sample.modules[0].lessons.find((l) => l.contentSlug === "field-kit");
    expect(kit?.id).toBe("sample-bits-bytes/01-number-formats/03-field-kit");
    expect(Object.values(kit!.exercises).map((e) => e.type).sort()).toEqual([
      "code",
      "code-blanks",
      "drag-sort",
      "envelope",
      "parsons",
      "predict-reveal",
      "slider-diagram",
      "spot-bug",
      "trace",
    ]);
  });

  it("covers every original widget type somewhere in the LLM course", () => {
    const { courses } = loadAllCourses();
    const types = new Set(courses[0].modules.flatMap((m) => m.lessons.flatMap((l) => Object.values(l.exercises).map((e) => e.type))));
    expect([...types].sort()).toEqual(["boss", "code", "debug", "fill", "mcq", "ordering", "predict", "simulator", "stepper"]);
  });

  it("reports broken references in a new pack without code changes", () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ia-content-"));
    write(
      "demo/course.yaml",
      "id: demo\ntitle: Demo\ndescription: d\ncover: skyline\nlessons: [one, missing]\n",
    );
    write(
      "demo/lessons/01-one.mdx",
      [
        "---",
        "id: demo/missions/01-one",
        "title: L",
        "estMinutes: 2",
        "xp: 10",
        "missionIntro: s",
        "---",
        "## Card",
        "Text.",
        '<Simulator id="sim" sim="warp-drive" prompt="p" explanation="e" />',
        '<Nope id="ghost" />',
      ].join("\n"),
    );
    write("demo/lessons/99-orphan.mdx", `---\nid: demo/missions/99-orphan\ntitle: x\nestMinutes: 1\nxp: 1\nmissionIntro: s\n---\n## A\nx\n`);
    const { courses, issues } = loadAllCourses(tmp);
    const msgs = issues.map((i) => i.message).join("\n");
    expect(courses).toHaveLength(1);
    expect(msgs).toMatch(/lesson "missing" is listed/);
    expect(msgs).toMatch(/unknown sim "warp-drive"/);
    expect(msgs).toMatch(/unknown exercise component <Nope>/);
    expect(msgs).toMatch(/not listed in course.yaml lessons/);
  });

  it("checks simulator params against the sim's sliders and options", () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ia-content-"));
    write("c/course.yaml", "id: c\ntitle: C\ndescription: d\ncover: skyline\nlessons: [one]\n");
    write(
      "c/lessons/01-one.mdx",
      `---\nid: c/missions/01-one\ntitle: L\nestMinutes: 1\nxp: 1\nmissionIntro: s\n---\n## A\nx\n<Simulator id="s" sim="kv-cache" prompt="p" params={{"warp":1,"kvHeads":3}} goal={{"output":"nope","op":"gte","value":1,"description":"d"}} explanation="e" />\n`,
    );
    const msgs = loadAllCourses(tmp).issues.map((i) => i.message).join("\n");
    expect(msgs).toMatch(/no slider "warp"/);
    expect(msgs).toMatch(/kvHeads=3 is not one of/);
    expect(msgs).toMatch(/no output "nope"/);
  });
});
