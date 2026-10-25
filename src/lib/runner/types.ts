import type { TestResult } from "@/lib/grading";

export type RunLanguage = "python" | "cpp";

export type RunRequest = {
  language: RunLanguage;
  /** Learner code */
  code: string;
  /** Hidden tests (language-specific harness format) */
  tests: string;
  timeoutMs?: number;
  /** Pyodide packages to load before the script (also detected from import statements). */
  packages?: string[];
  /**
   * When set, run the program with this stdin and do not grade tests.
   * An empty string still means "run the program", not "run the tests".
   */
  stdin?: string;
};

export type RunFailure = "load" | "timeout" | "runtime" | "compile" | "unavailable";

export type RunResult = {
  /** Error raised by the learner's code before tests ran, or by the runner itself. */
  error: string | null;
  stdout: string;
  stderr: string;
  tests: TestResult[];
  durationMs: number;
  /** Set when the runner failed. Learner exceptions stay unset so the test report can show them. */
  failure?: RunFailure;
};

export type RunnerStatus = "idle" | "loading" | "ready" | "running" | "error";

/**
 * Executes learner code against hidden tests. Python uses in-browser Pyodide.
 * C++ compiles on the server (Vercel Sandbox) and is not registered here.
 */
export interface CodeRunner {
  readonly id: string;
  readonly languages: readonly RunLanguage[];
  /** Optional warm-up, e.g. downloading the Python runtime. */
  prepare?(): Promise<void>;
  /** True when the runtime is loaded and can run code without downloading again. */
  isReady?(): boolean;
  /** True after the runtime has loaded at least once this session. */
  isWarmed?(): boolean;
  run(req: RunRequest): Promise<RunResult>;
  dispose?(): void;
}
