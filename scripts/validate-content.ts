/**
 * Validates every course pack under content/courses. With python3 on PATH it also proves that each
 * code exercise's reference solution passes its own hidden tests (and that the starter code does not).
 *
 *   npm run validate-content            # schema + references + solutions
 *   npm run validate-content -- --no-python
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { collectIdsFromRoot, diffVanished, idsFromCourses } from "../src/lib/content/ids";
import { loadAllCourses, DEFAULT_CONTENT_ROOT, type ContentIssue } from "../src/lib/content/loader";
import { getRenameMap, getRetiredIds } from "../src/lib/content/renames";
import { buildPythonHarness, parseHarnessOutput } from "../src/lib/runner/python-harness";

const args = process.argv.slice(2);
const root = args.find((a) => !a.startsWith("--")) ?? DEFAULT_CONTENT_ROOT;
const skipPython = args.includes("--no-python");

const { courses, issues } = loadAllCourses(path.resolve(root));
const pyIssues: ContentIssue[] = [];

const python = skipPython ? null : ["python3", "python"].find((bin) => spawnSync(bin, ["--version"]).status === 0);

function runPython(code: string, tests: string) {
  const r = spawnSync(python!, ["-"], { input: buildPythonHarness(code, tests), encoding: "utf8", timeout: 20_000 });
  return parseHarnessOutput(r.stdout ?? "");
}

let codeChecks = 0;
if (python) {
  for (const c of courses)
    for (const m of c.modules)
      for (const l of m.lessons)
        for (const [id, ex] of Object.entries(l.exercises)) {
          const file = `${c.slug}/${m.slug}/${l.slug}#${id}`;
          let solution: string | undefined;
          let tests: string | undefined;
          let starter: string | undefined;
          if (ex.type === "code") [solution, tests, starter] = [ex.solution, ex.tests, ex.starter];
          if (ex.type === "debug" && ex.mode === "code") [solution, tests, starter] = [ex.solution, ex.tests, ex.code];
          if (!solution || !tests) continue;
          codeChecks++;
          const good = runPython(solution, tests);
          if (good.error || good.tests.length === 0 || good.tests.some((t) => !t.passed))
            pyIssues.push({
              file,
              message: `reference solution fails hidden tests: ${good.error ?? JSON.stringify(good.tests.filter((t) => !t.passed))}`,
            });
          const bad = runPython(starter!, tests);
          if (!bad.error && bad.tests.length > 0 && bad.tests.every((t) => t.passed))
            pyIssues.push({ file, message: "starter/buggy code already passes every hidden test" });
        }
}

const idIssues: ContentIssue[] = [];
const baseline = baselineCourseRoot();
if (baseline) {
  try {
    const vanished = diffVanished(collectIdsFromRoot(baseline), idsFromCourses(courses), getRetiredIds(), getRenameMap());
    for (const message of vanished) idIssues.push({ file: "content", message });
  } finally {
    fs.rmSync(path.dirname(path.dirname(baseline)), { recursive: true, force: true });
  }
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
    (python ? `, ${codeChecks} code exercise(s) verified with ${python}` : " (python checks skipped)") +
    (baseline ? `, ids checked against ${process.env.CONTENT_BASELINE_REF ?? "origin/main"}` : ""),
);

/** Unpack content/courses from the baseline git ref. Missing refs fail the run. */
function baselineCourseRoot(): string | null {
  if (process.env.CONTENT_SKIP_BASELINE === "1") return null;
  const ref = process.env.CONTENT_BASELINE_REF ?? "origin/main";
  const verify = spawnSync("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { encoding: "utf8" });
  if (verify.status !== 0) {
    console.error(`\n✗ content baseline ref "${ref}" is not available.\n  Run: git fetch origin main\n`);
    process.exit(1);
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gnosis-baseline-"));
  const tar = path.join(tmp, "base.tar");
  const archived = spawnSync("git", ["archive", "--format=tar", "-o", tar, ref, "content/courses"], { encoding: "utf8" });
  if (archived.status !== 0) {
    console.error(archived.stderr || `git archive ${ref} failed`);
    process.exit(1);
  }
  const extracted = spawnSync("tar", ["-xf", tar, "-C", tmp], { encoding: "utf8" });
  if (extracted.status !== 0) {
    console.error(extracted.stderr || "could not unpack the content baseline");
    process.exit(1);
  }
  return path.join(tmp, "content", "courses");
}
