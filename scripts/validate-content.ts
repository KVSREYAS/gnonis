/**
 * Validates every course pack under content/courses. With python3 on PATH it proves that each
 * Python code exercise's reference solution passes its hidden tests (and that the starter does not).
 * With g++ on PATH it does the same for C++ exercises. Either check is skipped, with a warning,
 * when that compiler is missing.
 *
 *   npm run validate-content            # schema + references + solutions + id diff
 *   npm run validate-content -- --no-python
 *   npm run validate-content -- --no-cpp
 *
 * Progress ids are diffed against CONTENT_BASELINE_REF (default origin/main). That diff is skipped
 * with a warning when the ref is missing or when VERCEL is set (Vercel’s shallow checkout has no
 * origin/main). Schema, registry, retired-id, and rename checks still run. CONTENT_SKIP_BASELINE=1
 * skips the diff quietly for a local fixture.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ZodError } from "zod";
import { decideBaselineDiff } from "../src/lib/content/baseline";
import { collectIdsFromRoot, diffRetiredRenames, diffVanished, idsFromCourses } from "../src/lib/content/ids";
import { loadAllCourses, DEFAULT_CONTENT_ROOT, type ContentIssue } from "../src/lib/content/loader";
import { EMPTY_RETIRED, getRenameMap, getRetiredIds } from "../src/lib/content/renames";
import { EMPTY_RENAMES } from "../src/lib/progress/rename-map";
import { executeCppPlan, findGpp } from "../src/lib/runner/cpp-local";
import { planCpp } from "../src/lib/runner/cpp-harness";
import { buildPythonHarness, parseHarnessOutput } from "../src/lib/runner/python-harness";
import type { TestResult } from "../src/lib/grading";

const args = process.argv.slice(2);
const root = args.find((a) => !a.startsWith("--")) ?? DEFAULT_CONTENT_ROOT;
const skipPython = args.includes("--no-python");
const skipCpp = args.includes("--no-cpp");

const { courses, issues } = loadAllCourses(path.resolve(root));
const pyIssues: ContentIssue[] = [];
let codeChecks = 0;

const python = skipPython ? null : ["python3", "python"].find((bin) => spawnSync(bin, ["--version"]).status === 0);
const gpp = skipCpp ? null : findGpp();
if (!skipCpp && !gpp) console.warn("\n⚠ g++ not found, C++ reference solutions were not executed\n");

function runPython(code: string, tests: string) {
  const r = spawnSync(python!, ["-"], { input: buildPythonHarness(code, tests), encoding: "utf8", timeout: 20_000 });
  return parseHarnessOutput(r.stdout ?? "");
}

function checkPair(
  file: string,
  language: "python" | "cpp",
  solution: string,
  tests: string,
  starter: string,
  visible?: string,
) {
  const run = (code: string, spec: string) => {
    if (language === "python") return runPython(code, spec);
    const plan = planCpp({ code, tests: spec, mode: "tests" });
    if (!plan.ok) return { error: plan.message, stdout: "", stderr: "", tests: [] as TestResult[] };
    return executeCppPlan(plan.plan);
  };
  codeChecks++;
  const good = run(solution, tests);
  if (good.error || good.tests.length === 0 || good.tests.some((t) => !t.passed))
    pyIssues.push({
      file,
      message: `reference solution fails hidden tests: ${good.error ?? JSON.stringify(good.tests.filter((t) => !t.passed))}`,
    });
  const bad = run(starter, tests);
  if (!bad.error && bad.tests.length > 0 && bad.tests.every((t) => t.passed))
    pyIssues.push({ file, message: "starter/buggy code already passes every hidden test" });
  if (!visible) return;
  const samples = run(solution, visible);
  if (samples.error || samples.tests.length === 0 || samples.tests.some((t) => !t.passed))
    pyIssues.push({
      file,
      message: `reference solution fails visible tests: ${samples.error ?? JSON.stringify(samples.tests.filter((t) => !t.passed))}`,
    });
}

for (const c of courses)
  for (const m of c.modules)
    for (const l of m.lessons)
      for (const [id, ex] of Object.entries(l.exercises)) {
        const file = `${c.slug}/${m.slug}/${l.slug}#${id}`;
        if (ex.type === "code" && ex.language === "cpp") {
          if (gpp) checkPair(file, "cpp", ex.solution, ex.tests, ex.starter, ex.visibleTests);
          continue;
        }
        if (!python) continue;
        if (ex.type === "code") checkPair(file, "python", ex.solution, ex.tests, ex.starter, ex.visibleTests);
        if (ex.type === "debug" && ex.mode === "code" && ex.solution && ex.tests) checkPair(file, "python", ex.solution, ex.tests, ex.code);
      }

const idIssues: ContentIssue[] = [];
const retired = readIdFile("content/retired-ids.yaml", getRetiredIds, idIssues, EMPTY_RETIRED);
const renames = readIdFile("content/renames.yaml", getRenameMap, idIssues, EMPTY_RENAMES);
const currentIds = idsFromCourses(courses);
const baseline = loadBaseline();
if (baseline.root) {
  try {
    const vanished = diffVanished(collectIdsFromRoot(baseline.root), currentIds, retired, renames);
    for (const message of vanished) idIssues.push({ file: "content", message });
  } finally {
    fs.rmSync(path.dirname(path.dirname(baseline.root)), { recursive: true, force: true });
  }
} else {
  for (const message of diffRetiredRenames(currentIds, retired, renames)) idIssues.push({ file: "content", message });
}

const all = [...issues, ...pyIssues, ...idIssues];
const lessons = courses.reduce((n, c) => n + c.modules.reduce((k, m) => k + m.lessons.length, 0), 0);
const exercises = courses.reduce(
  (n, c) => n + c.modules.reduce((k, m) => k + m.lessons.reduce((j, l) => j + Object.keys(l.exercises).length, 0), 0),
  0,
);

if (all.length) {
  console.error(`\n✗ ${all.length} content issue(s):\n`);
  for (const i of all) console.error(`  ${path.relative(process.cwd(), i.file) || i.file}\n    → ${i.message}`);
  process.exit(1);
}
console.log(
  `✓ ${courses.length} course(s), ${lessons} lessons, ${exercises} exercises valid` +
    (python || gpp ? `, ${codeChecks} code exercise(s) verified` + (python ? ` with ${python}` : "") + (gpp ? ` and ${gpp}` : "") : " (code execution checks skipped)") +
    baseline.summary,
);

function readIdFile<T>(file: string, load: () => T, issues: ContentIssue[], fallback: T): T {
  try {
    return load();
  } catch (e) {
    issues.push({ file, message: formatThrown(e) });
    return fallback;
  }
}

function formatThrown(e: unknown): string {
  if (e instanceof ZodError)
    return e.issues.map((i) => `${i.path.length ? i.path.join(".") + ": " : ""}${i.message}`).join("; ");
  return e instanceof Error ? e.message : String(e);
}

/** Unpack content/courses from the baseline git ref. A missing ref skips the diff. */
function loadBaseline(): { root: string | null; summary: string } {
  const ref = process.env.CONTENT_BASELINE_REF ?? "origin/main";
  const explicitlySkipped = process.env.CONTENT_SKIP_BASELINE === "1";
  const onVercel = Boolean(process.env.VERCEL);
  const refAvailable =
    !explicitlySkipped && !onVercel
      ? spawnSync("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { encoding: "utf8" }).status === 0
      : false;
  const decision = decideBaselineDiff({
    skipBaseline: process.env.CONTENT_SKIP_BASELINE,
    vercel: process.env.VERCEL,
    ref,
    refAvailable,
  });
  if (!decision.check) {
    if (decision.warning) console.warn(`\n⚠ ${decision.warning}\n`);
    return { root: null, summary: decision.warning ? ", baseline id diff skipped" : "" };
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gnosis-baseline-"));
  const tar = path.join(tmp, "base.tar");
  const archived = spawnSync("git", ["archive", "--format=tar", "-o", tar, ref, "content/courses"], { encoding: "utf8" });
  if (archived.status !== 0) {
    fs.rmSync(tmp, { recursive: true, force: true });
    console.error(archived.stderr || `git archive ${ref} failed`);
    process.exit(1);
  }
  const extracted = spawnSync("tar", ["-xf", tar, "-C", tmp], { encoding: "utf8" });
  if (extracted.status !== 0) {
    fs.rmSync(tmp, { recursive: true, force: true });
    console.error(extracted.stderr || "could not unpack the content baseline");
    process.exit(1);
  }
  return { root: path.join(tmp, "content", "courses"), summary: `, ids checked against ${ref}` };
}
