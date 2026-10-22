import { buildPythonHarness, parseHarnessOutput } from "./python-harness";
import type { CodeRunner, RunRequest, RunResult } from "./types";

export const PYODIDE_INDEX_URL =
  process.env.NEXT_PUBLIC_PYODIDE_INDEX_URL ?? "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/";

type Pending = { resolve: (r: { stdout: string; error?: string }) => void; timer: ReturnType<typeof setTimeout> };

/**
 * Runs Python in a dedicated Web Worker so a runaway loop never freezes the page. Pyodide is only
 * downloaded the first time a code exercise asks for it. On timeout the worker is killed and a
 * fresh one is created for the next run.
 */
export class PyodideRunner implements CodeRunner {
  readonly id = "pyodide";
  readonly languages = ["python"] as const;
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private seq = 0;
  private pending = new Map<number, Pending>();

  private spawn(): Promise<void> {
    const worker = new Worker("/workers/pyodide-worker.js");
    this.worker = worker;
    worker.onmessage = (e: MessageEvent) => {
      const { id, stdout, error } = e.data ?? {};
      const p = this.pending.get(id);
      if (!p) return;
      clearTimeout(p.timer);
      this.pending.delete(id);
      p.resolve({ stdout: stdout ?? "", error });
    };
    this.ready = this.call({ type: "init", indexURL: PYODIDE_INDEX_URL }, 90_000).then((r) => {
      if (r.error) {
        this.reset();
        throw new Error(r.error);
      }
    });
    return this.ready;
  }

  private call(msg: Record<string, unknown>, timeoutMs: number): Promise<{ stdout: string; error?: string }> {
    const id = ++this.seq;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.reset();
        resolve({ stdout: "", error: `Timed out after ${Math.round(timeoutMs / 1000)}s. Infinite loop?` });
      }, timeoutMs);
      this.pending.set(id, { resolve, timer });
      this.worker!.postMessage({ ...msg, id });
    });
  }

  private reset() {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
  }

  prepare(): Promise<void> {
    return this.ready ?? this.spawn();
  }

  async run(req: RunRequest): Promise<RunResult> {
    const started = performance.now();
    try {
      await this.prepare();
    } catch (e) {
      return { error: `Could not load Python: ${(e as Error).message}`, stdout: "", tests: [], durationMs: 0 };
    }
    const r = await this.call({ type: "run", code: buildPythonHarness(req.code, req.tests) }, req.timeoutMs ?? 8000);
    const durationMs = performance.now() - started;
    if (r.error) return { error: r.error, stdout: r.stdout, tests: [], durationMs };
    return { ...parseHarnessOutput(r.stdout), durationMs };
  }

  dispose() {
    this.reset();
  }
}
