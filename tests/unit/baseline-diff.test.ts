import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { decideBaselineDiff } from "@/lib/content/baseline";

const repo = path.resolve(__dirname, "../..");
const tsx = path.join(repo, "node_modules", ".bin", "tsx");
const script = path.join(repo, "scripts", "validate-content.ts");

describe("decideBaselineDiff", () => {
  it("checks when the baseline ref is available and this is not Vercel", () => {
    expect(decideBaselineDiff({ skipBaseline: undefined, vercel: undefined, ref: "origin/main", refAvailable: true })).toEqual({
      check: true,
    });
  });

  it("skips quietly for a local fixture", () => {
    expect(decideBaselineDiff({ skipBaseline: "1", vercel: "1", ref: "origin/main", refAvailable: false })).toEqual({ check: false });
  });

  it("skips with a warning on Vercel even if the ref exists", () => {
    const decision = decideBaselineDiff({ skipBaseline: undefined, vercel: "1", ref: "origin/main", refAvailable: true });
    expect(decision.check).toBe(false);
    if (!decision.check) expect(decision.warning).toContain("VERCEL is set");
  });

  it("skips with a warning when the ref is missing", () => {
    const decision = decideBaselineDiff({ skipBaseline: undefined, vercel: undefined, ref: "origin/main", refAvailable: false });
    expect(decision.check).toBe(false);
    if (!decision.check) {
      expect(decision.warning).toContain('content baseline ref "origin/main" is not available');
      expect(decision.warning).toContain("git fetch origin main");
    }
  });
});

function runValidate(cwd: string, env: Record<string, string | undefined>, args: string[] = []) {
  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete childEnv[key];
    else childEnv[key] = value;
  }
  return spawnSync(tsx, ["--tsconfig", path.join(repo, "tsconfig.json"), script, "--no-python", ...args], {
    cwd,
    env: childEnv,
    encoding: "utf8",
  });
}

const clearBaselineEnv = {
  VERCEL: undefined,
  CONTENT_SKIP_BASELINE: undefined,
  CONTENT_BASELINE_REF: undefined,
};

describe("validate-content baseline skip", () => {
  const temps: string[] = [];
  afterEach(() => {
    for (const dir of temps.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it("still diffs ids against origin/main when the ref is available", () => {
    const result = runValidate(repo, clearBaselineEnv);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("ids checked against origin/main");
    expect(result.stderr).not.toContain("baseline id diff");
    expect(result.stdout).not.toContain("baseline id diff skipped");
  });

  it("skips only the id diff when VERCEL is set, and still fails schema errors", () => {
    const ok = runValidate(repo, { ...clearBaselineEnv, VERCEL: "1" });
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.stderr).toContain("VERCEL is set");
    expect(ok.stdout).toContain("baseline id diff skipped");
    expect(ok.stdout).not.toContain("ids checked against");

    const courses = fs.mkdtempSync(path.join(os.tmpdir(), "gnosis-courses-"));
    temps.push(courses);
    fs.mkdirSync(path.join(courses, "bad-pack"));
    const bad = runValidate(repo, { ...clearBaselineEnv, VERCEL: "1" }, [courses]);
    expect(bad.status).not.toBe(0);
    expect(bad.stderr).toContain("missing course.yaml");
    expect(bad.stderr).toContain("VERCEL is set");
  });

  it("skips only the id diff when the baseline ref is missing, and still checks renames", () => {
    const missing = runValidate(repo, { ...clearBaselineEnv, CONTENT_BASELINE_REF: "refs/does-not-exist-baseline" });
    expect(missing.status, missing.stderr).toBe(0);
    expect(missing.stderr).toContain('content baseline ref "refs/does-not-exist-baseline" is not available');
    expect(missing.stdout).toContain("baseline id diff skipped");
    expect(missing.stdout).not.toContain("ids checked against");

    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "gnosis-rename-"));
    temps.push(cwd);
    fs.mkdirSync(path.join(cwd, "content", "courses"), { recursive: true });
    fs.writeFileSync(path.join(cwd, "content", "retired-ids.yaml"), "courses: [1]\nlessons: []\nexercises: []\n");
    fs.writeFileSync(
      path.join(cwd, "content", "renames.yaml"),
      "courses:\n  old-course: new-course\nlessons: {}\nexercises: {}\n",
    );
    const broken = runValidate(cwd, { ...clearBaselineEnv, VERCEL: "1" });
    expect(broken.status).not.toBe(0);
    expect(broken.stderr).toContain("courses.0:");
    expect(broken.stderr).toContain("rename target new-course is not in content");
    expect(broken.stderr).not.toContain("not an id on main");
    expect(broken.stderr).toContain("VERCEL is set");
  });

  it("stays quiet when CONTENT_SKIP_BASELINE=1", () => {
    const result = runValidate(repo, { ...clearBaselineEnv, CONTENT_SKIP_BASELINE: "1" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).not.toContain("baseline");
    expect(result.stdout).not.toContain("ids checked against");
    expect(result.stdout).not.toContain("baseline id diff skipped");
  });
});
