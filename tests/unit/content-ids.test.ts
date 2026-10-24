import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { exerciseContentHash } from "@/lib/content/hash";
import { diffRetiredRenames, diffVanished, emptyIds, type IdSet } from "@/lib/content/ids";
import { EMPTY_RETIRED } from "@/lib/content/renames";
import { convertCourses } from "../../scripts/convert-legacy-content";
import { applyRenames, EMPTY_RENAMES } from "@/lib/progress/rename-map";
import { emptyProgress } from "@/lib/progress/logic";

function ids(partial: Partial<{ courses: string[]; lessons: string[]; exercises: string[] }>): IdSet {
  const out = emptyIds();
  for (const id of partial.courses ?? []) out.courses.add(id);
  for (const id of partial.lessons ?? []) out.lessons.add(id);
  for (const id of partial.exercises ?? []) out.exercises.add(id);
  return out;
}

describe("exercise content hash", () => {
  const base = { type: "mcq", prompt: "Q", options: ["a", "b"], answer: 1, explanation: "because", devices: ["phone", "desktop"] };

  it("ignores wording and changes when the answer changes", () => {
    expect(exerciseContentHash(base)).toBe(exerciseContentHash({ ...base, prompt: "Different wording", explanation: "typo" }));
    expect(exerciseContentHash(base)).not.toBe(exerciseContentHash({ ...base, answer: 0 }));
  });
});

describe("diffVanished", () => {
  const prev = ids({ courses: ["a"], lessons: ["a/m/l"], exercises: ["a/m/l#x"] });

  it("is quiet when every previous id is still there", () => {
    expect(diffVanished(prev, ids({ courses: ["a"], lessons: ["a/m/l"], exercises: ["a/m/l#x"] }), EMPTY_RETIRED, EMPTY_RENAMES)).toEqual([]);
  });

  it("flags a dropped id unless it is retired or renamed onto a live id", () => {
    const dropped = diffVanished(prev, ids({ courses: ["a"], lessons: [], exercises: ["a/m/l#x"] }), EMPTY_RETIRED, EMPTY_RENAMES);
    expect(dropped).toContain("lessons id vanished: a/m/l");
    const retired = { ...EMPTY_RETIRED, lessons: ["a/m/l"] };
    expect(diffVanished(prev, ids({ courses: ["a"], lessons: [], exercises: ["a/m/l#x"] }), retired, EMPTY_RENAMES)).toEqual([]);
    const renamed = diffVanished(
      prev,
      ids({ courses: ["a"], lessons: ["a/m/next"], exercises: ["a/m/l#x"] }),
      EMPTY_RETIRED,
      { ...EMPTY_RENAMES, lessons: { "a/m/l": "a/m/next" } },
    );
    expect(renamed).toEqual([]);
  });
});

describe("diffRetiredRenames", () => {
  const current = ids({ courses: ["a"], lessons: ["a/m/l"], exercises: ["a/m/l#x"] });

  it("flags a retired id that is still live and a rename whose target is missing", () => {
    const messages = diffRetiredRenames(
      current,
      { ...EMPTY_RETIRED, lessons: ["a/m/l", "gone"] },
      { ...EMPTY_RENAMES, courses: { a: "b" }, lessons: { "a/m/l": "a/m/l" } },
    );
    expect(messages).toContain("lessons id a/m/l is listed as retired but still in content");
    expect(messages).toContain("courses rename target b is not in content");
    expect(messages).toContain("lessons rename a/m/l does not change the id");
    expect(messages.some((m) => m.includes("not an id on main"))).toBe(false);
    expect(messages.some((m) => m.includes("vanished"))).toBe(false);
  });

  it("is quiet for an empty retirement list", () => {
    expect(diffRetiredRenames(current, EMPTY_RETIRED, EMPTY_RENAMES)).toEqual([]);
  });
});

describe("convert legacy courses", () => {
  let tmp: string | undefined;
  afterEach(() => tmp && fs.rmSync(tmp, { recursive: true, force: true }));

  it("keeps ids, images, and flat-only lessons", () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ia-convert-"));
    const course = path.join(tmp, "demo");
    fs.mkdirSync(path.join(course, "modules", "01-bay", "lessons"), { recursive: true });
    fs.writeFileSync(
      path.join(course, "course.yaml"),
      "title: Demo\ndescription: d\norder: 1\nmodules: [01-bay]\n",
    );
    fs.writeFileSync(
      path.join(course, "modules", "01-bay", "module.yaml"),
      "title: Bay\ndistrict: Bay\nsummary: s\ntip: tip\nart: pier\nstatus: ready\nlessons: [01-hello]\n",
    );
    fs.writeFileSync(
      path.join(course, "modules", "01-bay", "lessons", "01-hello.mdx"),
      [
        "---",
        "title: Hello",
        "summary: s",
        "xp: 10",
        "keyIdeas: [a, b, c]",
        "exercises:",
        "  size:",
        "    type: mcq",
        "    prompt: Q",
        "    options: [a, b]",
        "    answer: 1",
        "    explanation: e",
        "---",
        "## Mission briefing",
        "Go.",
        "",
        "![tokens](/diagrams/demo/01-hello.png)",
        "",
        '<Exercise id="size" />',
        "",
      ].join("\n"),
    );
    fs.mkdirSync(path.join(course, "lessons"), { recursive: true });
    const kept = [
      "---",
      "id: demo/01-bay/03-field-kit",
      "title: Kit",
      "estMinutes: 4",
      "xp: 10",
      "missionIntro: extra",
      "---",
      "## Mission briefing",
      "Stay.",
      "",
    ].join("\n");
    fs.writeFileSync(path.join(course, "lessons", "02-field-kit.mdx"), kept);

    expect(convertCourses(tmp)).toEqual(["demo"]);
    expect(fs.existsSync(path.join(course, "modules"))).toBe(false);
    const lesson = fs.readFileSync(path.join(course, "lessons", "01-hello.mdx"), "utf8");
    expect(lesson).toContain("id: demo/01-bay/01-hello");
    expect(lesson).toContain("![tokens](/diagrams/demo/01-hello.png)");
    expect(lesson).toContain('<MCQ');
    expect(lesson).toContain('id="size"');
    expect(lesson).not.toContain("<Exercise");
    expect(fs.readFileSync(path.join(course, "lessons", "02-field-kit.mdx"), "utf8")).toContain("id: demo/01-bay/03-field-kit");
    const yaml = fs.readFileSync(path.join(course, "course.yaml"), "utf8");
    expect(yaml).toContain("hello");
    expect(yaml).toContain("field-kit");

    expect(convertCourses(tmp)).toEqual([]);
    expect(fs.readFileSync(path.join(course, "lessons", "02-field-kit.mdx"), "utf8")).toContain("Stay.");
  });
});

describe("applyRenames", () => {
  it("returns the same state when the map is empty", () => {
    const state = emptyProgress();
    expect(applyRenames(state, EMPTY_RENAMES)).toBe(state);
  });
});
