import type { TestResult } from "@/lib/grading";

export type RunLanguage = "python" | "cpp";

export type RunRequest = {
  language: RunLanguage;
  /** Learner code */
  code: string;
  /** Hidden tests (language-specific harness format) */
  tests: string;
  timeoutMs?: number;
};

export type RunResult = {
  /** Error raised by the learner's code before tests ran, or by the runner itself. */
  error: string | null;
  stdout: string;
  tests: TestResult[];
  durationMs: number;
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
  run(req: RunRequest): Promise<RunResult>;
  dispose?(): void;
}
