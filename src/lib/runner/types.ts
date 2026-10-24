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
};

export type RunFailure = "load" | "timeout" | "runtime";

export type RunResult = {
  /** Error raised by the learner's code before tests ran, or by the runner itself. */
  error: string | null;
  stdout: string;
  tests: TestResult[];
  durationMs: number;
  /** Set when the runner failed. Learner exceptions stay unset so the test report can show them. */
  failure?: RunFailure;
};

export type RunnerStatus = "idle" | "loading" | "ready" | "running" | "error";

/**
 * Executes learner code against hidden tests. Implementations: in-browser Pyodide (MVP) and a
 * remote sandbox such as a self-hosted Piston instance (for C++ later).
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
