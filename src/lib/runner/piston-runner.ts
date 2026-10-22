import { buildPythonHarness, parseHarnessOutput } from "./python-harness";
import type { CodeRunner, RunLanguage, RunRequest, RunResult } from "./types";

/**
 * Remote runner for a self-hosted Piston instance (https://github.com/engineer-man/piston).
 * Not wired into the MVP: C++ exercises would register this runner for "cpp" and supply a C++
 * harness that prints the same RESULT_MARKER JSON line.
 */
export class PistonRunner implements CodeRunner {
  readonly id = "piston";
  readonly languages: readonly RunLanguage[] = ["python", "cpp"];

  constructor(
    private readonly baseUrl: string,
    private readonly versions: Partial<Record<RunLanguage, string>> = { python: "3.12.0", cpp: "10.2.0" },
  ) {}

  async run(req: RunRequest): Promise<RunResult> {
    if (req.language !== "python") {
      return { error: `PistonRunner: no ${req.language} harness yet`, stdout: "", tests: [], durationMs: 0 };
    }
    const started = Date.now();
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/v2/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        language: req.language,
        version: this.versions[req.language] ?? "*",
        files: [{ name: "main.py", content: buildPythonHarness(req.code, req.tests) }],
        run_timeout: req.timeoutMs ?? 8000,
      }),
    });
    if (!res.ok) return { error: `Runner HTTP ${res.status}`, stdout: "", tests: [], durationMs: Date.now() - started };
    const body = (await res.json()) as { run?: { stdout?: string; stderr?: string } };
    const parsed = parseHarnessOutput(body.run?.stdout ?? "");
    return { ...parsed, error: parsed.error ?? (body.run?.stderr || null), durationMs: Date.now() - started };
  }
}
