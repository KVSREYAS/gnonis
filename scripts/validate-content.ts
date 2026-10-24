/**
 * Validates every course pack under content/courses. With python3 on PATH it also proves that each
 * code exercise's reference solution passes its own hidden tests (and that the starter code does not).
 *
 *   npm run validate-content            # schema + references + solutions
 *   npm run validate-content -- --no-python
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { loadAllCourses, DEFAULT_CONTENT_ROOT, type ContentIssue } from "../src/lib/content/loader";
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

const all = [...issues, ...pyIssues];
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
    (python ? `, ${codeChecks} code exercise(s) verified with ${python}` : " (python checks skipped)"),
);
