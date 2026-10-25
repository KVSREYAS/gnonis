import type { TestResult } from "@/lib/grading";
import type { RunFailure } from "@/lib/runner/types";

/** Learner source cap. Hidden and visible specs share the test cap. */
export const CPP_CODE_MAX = 24_000;
export const CPP_TESTS_MAX = 48_000;
export const CPP_STDIN_MAX = 8_000;
export const CPP_STDOUT_MAX = 8_000;
export const CPP_STDERR_MAX = 4_000;
/** Wall clock for one program run, inside the sandbox and in CI. */
export const CPP_RUN_WALL_SEC = 3;
/** CPU seconds for one program run (`ulimit -t`). */
export const CPP_RUN_CPU_SEC = 2;
/** Address-space cap for the learner binary, in KiB (`ulimit -v`). 512 MiB. */
export const CPP_RUN_AS_KB = 524_288;
export const CPP_COMPILE_WALL_SEC = 10;

/**
 * Harness header. The runner writes this as `check.h` and includes it at the
 * top of the translation unit. A test file may also `#include "check.h"`.
 * CHECK prints `file:line` and the expression, then exits 1. Exit 0 means every check passed.
 */
export const CPP_CHECK_HEADER = `#ifndef GNOSIS_CHECK_H
#define GNOSIS_CHECK_H
#include <cstdio>
#include <cstdlib>
#define CHECK(cond) \\
  do { \\
    if (!(cond)) { \\
      std::fprintf(stderr, "%s:%d: CHECK failed: %s\\n", __FILE__, __LINE__, #cond); \\
      std::exit(1); \\
    } \\
  } while (0)
#endif
`;

export type CppPlan = {
  /** One translation unit: harness include, learner code, then the test file (when graded). */
  source: string;
  /** Graded runs use the test file's main(). Exit 0 is pass. */
  graded: boolean;
  stdin: string;
};

export type CppInterpreted = {
  error: string | null;
  stdout: string;
  stderr: string;
  tests: TestResult[];
  failure?: RunFailure;
};

export function planCpp(input: {
  code: string;
  tests?: string;
  mode: "tests" | "stdin";
  stdin?: string;
}): { ok: true; plan: CppPlan } | { ok: false; message: string } {
  if (input.code.length > CPP_CODE_MAX) return { ok: false, message: "That program is too long to compile." };
  if (input.mode === "stdin") {
    const stdin = input.stdin ?? "";
    if (stdin.length > CPP_STDIN_MAX) return { ok: false, message: "That input is too long." };
    return { ok: true, plan: { source: translationUnit(input.code, null), graded: false, stdin } };
  }
  const tests = input.tests ?? "";
  if (!tests.trim()) return { ok: false, message: "This exercise has no tests to run." };
  if (tests.length > CPP_TESTS_MAX) return { ok: false, message: "Those tests are too long." };
  return { ok: true, plan: { source: translationUnit(input.code, tests), graded: true, stdin: "" } };
}

/** Learner code and the test file, one translation unit. `#line` keeps diagnostics on the author's lines. */
export function translationUnit(learner: string, tests: string | null): string {
  const learnerBody = learner.endsWith("\n") ? learner : `${learner}\n`;
  let source = `#include "check.h"\n#line 1 "solution.cpp"\n${learnerBody}`;
  if (tests != null) {
    const testBody = tests.endsWith("\n") ? tests : `${tests}\n`;
    source += `#line 1 "tests.cpp"\n${testBody}`;
  }
  return source;
}

export type CppFile = { path: string; content: string; mode?: number };

/** Files for one job. The shell script never interpolates learner source or stdin. */
export function cppJobFiles(plan: CppPlan): CppFile[] {
  return [
    { path: "check.h", content: CPP_CHECK_HEADER },
    { path: "main.cpp", content: plan.source },
    { path: "in0", content: plan.stdin },
    { path: "run.sh", content: buildScript(), mode: 0o755 },
  ];
}

function buildScript(): string {
  return `#!/bin/bash
cd "$(dirname "$0")" || exit 2
machine=$(g++ -dumpmachine 2>/dev/null || true)
case "$machine" in
  x86_64*) ;;
  *)
    echo "__IA_ARCH__ \${machine:-unknown}"
    exit 0
    ;;
esac
touch compile.err
timeout -k 2s ${CPP_COMPILE_WALL_SEC}s g++ -std=c++20 -O2 -fdiagnostics-color=never -o prog main.cpp >compile.out 2>compile.err
compile_status=$?
echo "__IA_COMPILE__ $compile_status"
if [ "$compile_status" -ne 0 ]; then
  echo "__IA_COMPILE_ERR_B64__ $(base64 -w 0 compile.err)"
  exit 0
fi
touch out0 err0
timeout -k 1s ${CPP_RUN_WALL_SEC}s bash -c 'ulimit -t ${CPP_RUN_CPU_SEC} -v ${CPP_RUN_AS_KB} -f 8192; exec ./prog' < in0 > out0 2> err0
status=$?
head -c ${CPP_STDOUT_MAX} out0 > out0.cut
head -c ${CPP_STDERR_MAX} err0 > err0.cut
echo "__IA_CASE__ 0"
echo "__IA_STATUS__ $status"
echo "__IA_STDOUT_B64__ $(base64 -w 0 out0.cut)"
echo "__IA_STDERR_B64__ $(base64 -w 0 err0.cut)"
exit 0
`;
}

type RawRun = { status: number; stdout: string; stderr: string };

export function interpretCppOutput(plan: CppPlan, scriptStdout: string): CppInterpreted {
  const arch = scriptStdout.match(/__IA_ARCH__\s*(\S*)/);
  if (arch) {
    const triple = arch[1] || "unknown";
    return {
      error: `This compiler is ${triple}. C++ exercises need x86-64 g++ so SSE2 (<emmintrin.h>) builds.`,
      stdout: "",
      stderr: "",
      tests: [],
      failure: "unavailable",
    };
  }
  const compile = readCompile(scriptStdout);
  if (!compile) return { error: "The runner produced no results.", stdout: scriptStdout.slice(0, 500), stderr: "", tests: [], failure: "runtime" };
  if (compile.exit !== 0) {
    const timedOut = compile.exit === 124 || compile.exit === 137;
    const text = decodeB64(compile.errB64).trim() || (timedOut ? "Compilation timed out." : "Compilation failed.");
    return {
      error: timedOut ? "Compilation timed out." : `Compile error:\n${clip(text, CPP_STDERR_MAX)}`,
      stdout: "",
      stderr: clip(text, CPP_STDERR_MAX),
      tests: [],
      failure: timedOut ? "timeout" : "compile",
    };
  }
  const run = readRuns(scriptStdout)[0];
  if (!run) return { error: "The runner produced no results.", stdout: "", stderr: "", tests: [], failure: "runtime" };
  return plan.graded ? interpretGraded(run) : interpretPlain(run);
}

function interpretGraded(run: RawRun): CppInterpreted {
  const timedOut = run.status === 124 || run.status === 137 || run.status === 152;
  if (timedOut) {
    return {
      error: `Timed out after ${CPP_RUN_WALL_SEC}s. Infinite loop?`,
      stdout: clip(run.stdout, CPP_STDOUT_MAX),
      stderr: clip(run.stderr, CPP_STDERR_MAX),
      tests: [],
      failure: "timeout",
    };
  }
  const stdout = clip(run.stdout, CPP_STDOUT_MAX);
  const stderr = clip(run.stderr, CPP_STDERR_MAX);
  if (run.status === 0) {
    return { error: null, stdout, stderr, tests: [{ name: "checks", passed: true }] };
  }
  const crashed = run.status > 128 && run.status !== 124 && run.status !== 137 && run.status !== 152;
  const check = stderr.split("\n").find((line) => line.includes("CHECK failed:"));
  return {
    error: crashed ? "The program crashed." : null,
    stdout,
    stderr,
    tests: crashed ? [] : [{ name: "checks", passed: false, message: check?.trim() || `exited ${run.status}` }],
    failure: crashed ? "runtime" : undefined,
  };
}

function interpretPlain(run: RawRun): CppInterpreted {
  const timedOut = run.status === 124 || run.status === 137 || run.status === 152;
  if (timedOut) {
    return {
      error: `Timed out after ${CPP_RUN_WALL_SEC}s. Infinite loop?`,
      stdout: clip(run.stdout, CPP_STDOUT_MAX),
      stderr: clip(run.stderr, CPP_STDERR_MAX),
      tests: [],
      failure: "timeout",
    };
  }
  const crashed = run.status === 139 || run.status === 134 || run.status === 136;
  const note = run.status === 0 ? "" : `exited ${run.status}\n`;
  return {
    error: crashed ? "The program crashed." : null,
    stdout: clip(run.stdout, CPP_STDOUT_MAX),
    stderr: clip(note + run.stderr, CPP_STDERR_MAX),
    tests: [],
    failure: crashed ? "runtime" : undefined,
  };
}

function readCompile(stdout: string): { exit: number; errB64: string } | null {
  const exit = stdout.match(/__IA_COMPILE__\s+(-?\d+)/);
  if (!exit) return null;
  const err = stdout.match(/__IA_COMPILE_ERR_B64__\s*(\S*)/);
  return { exit: Number(exit[1]), errB64: err?.[1] ?? "" };
}

function readRuns(stdout: string): RawRun[] {
  const runs: RawRun[] = [];
  const chunks = stdout.split("__IA_CASE__ ").slice(1);
  for (const chunk of chunks) {
    const status = chunk.match(/__IA_STATUS__\s+(-?\d+)/);
    const out = chunk.match(/__IA_STDOUT_B64__\s*(\S*)/);
    const err = chunk.match(/__IA_STDERR_B64__\s*(\S*)/);
    runs.push({
      status: status ? Number(status[1]) : 1,
      stdout: decodeB64(out?.[1] ?? ""),
      stderr: decodeB64(err?.[1] ?? ""),
    });
  }
  return runs;
}

function decodeB64(value: string): string {
  if (!value) return "";
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}
