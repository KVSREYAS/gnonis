import { PYODIDE_WORKER_URL, pyodideIndexUrls } from "./pyodide-config";
import { buildPythonHarness, parseHarnessOutput } from "./python-harness";
import type { CodeRunner, RunRequest, RunResult } from "./types";

const INIT_TIMEOUT_MS = 60_000;

type WorkerCode = "script" | "runtime" | "timeout";
type WorkerReply = { stdout: string; error?: string; code?: WorkerCode };
type Mode = "classic" | "module";
type Pending = {
  resolve: (reply: WorkerReply) => void;
  timer: ReturnType<typeof setTimeout>;
  epoch: number;
};

function coded(message: string, code: WorkerCode): Error & { code: WorkerCode } {
  const error = new Error(message) as Error & { code: WorkerCode };
  error.code = code;
  return error;
}

/**
 * Runs Python in a Web Worker so a runaway loop cannot freeze the page. One worker is kept for the
 * browser session and reused across lessons. A timeout or a failed load kills that worker; the next
 * run starts a fresh one, and the CDN responses stay in the browser cache.
 *
 * Classic workers load Pyodide with importScripts (iPhone Safari). If that fails, the same file is
 * started as a module worker and imports pyodide.mjs. Each attempt walks the CDN list.
 */
export class PyodideRunner implements CodeRunner {
  readonly id = "pyodide";
  readonly languages = ["python"] as const;
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private state: "cold" | "loading" | "ready" | "error" = "cold";
  private warmed = false;
  private seq = 0;
  private epoch = 0;
  private pending = new Map<number, Pending>();

  isReady(): boolean {
    return this.state === "ready" && this.worker !== null;
  }

  /** True after a successful load this session, including after a timeout killed the worker. */
  isWarmed(): boolean {
    return this.warmed;
  }

  prepare(): Promise<void> {
    if (this.ready && (this.state === "ready" || this.state === "loading")) return this.ready;
    this.state = "loading";
    const pending = this.boot().then(() => {
      this.state = "ready";
      this.warmed = true;
    });
    this.ready = pending;
    pending.catch(() => {
      if (this.ready === pending) {
        this.ready = null;
        this.state = "error";
      }
    });
    return pending;
  }

  private async boot(): Promise<void> {
    const errors: string[] = [];
    for (const indexURL of pyodideIndexUrls()) {
      for (const mode of ["classic", "module"] as const) {
        try {
          await this.bootOne(indexURL, mode);
          return;
        } catch (err) {
          const error = err as Error & { code?: WorkerCode };
          errors.push(`${mode} ${indexURL}: ${error.message}`);
          this.killWorker();
          if (error.code === "runtime" || error.code === "timeout") break;
        }
      }
    }
    throw new Error(errors.join("\n") || "Could not load Python");
  }

  private bootOne(indexURL: string, mode: Mode): Promise<void> {
    const epoch = ++this.epoch;
    const worker = new Worker(PYODIDE_WORKER_URL, mode === "module" ? { type: "module" } : undefined);
    this.worker = worker;
    worker.onmessage = (event: MessageEvent) => this.onMessage(event, epoch);
    worker.onerror = (event) => {
      event.preventDefault?.();
      this.rejectPending(epoch, event.message || "Python worker failed to start", "script");
    };
    return this.call({ type: "init", indexURL }, INIT_TIMEOUT_MS, "Python runtime download timed out.", epoch).then((reply) => {
      if (epoch !== this.epoch) throw coded("Python load was cancelled", "runtime");
      if (reply.error) throw coded(reply.error, reply.code ?? "runtime");
    });
  }

  private onMessage(event: MessageEvent, epoch: number) {
    if (epoch !== this.epoch) return;
    const data = (event.data ?? {}) as { id?: number; stdout?: string; error?: string; code?: WorkerCode };
    if (data.id === undefined) return;
    const pending = this.pending.get(data.id);
    if (!pending || pending.epoch !== epoch) return;
    clearTimeout(pending.timer);
    this.pending.delete(data.id);
    pending.resolve({ stdout: data.stdout ?? "", error: data.error, code: data.code });
  }

  private rejectPending(epoch: number, message: string, code: WorkerCode) {
    if (epoch !== this.epoch) return;
    for (const [id, pending] of this.pending) {
      if (pending.epoch !== epoch) continue;
      clearTimeout(pending.timer);
      this.pending.delete(id);
      pending.resolve({ stdout: "", error: message, code });
    }
  }

  private call(msg: Record<string, unknown>, timeoutMs: number, timeoutMessage: string, epoch: number): Promise<WorkerReply> {
    const id = ++this.seq;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        if (epoch === this.epoch) this.killWorker();
        resolve({ stdout: "", error: timeoutMessage, code: "timeout" });
      }, timeoutMs);
      this.pending.set(id, { resolve, timer, epoch });
      this.worker?.postMessage({ ...msg, id });
    });
  }

  private killWorker() {
    this.epoch += 1;
    const worker = this.worker;
    this.worker = null;
    worker?.terminate();
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      this.pending.delete(id);
      pending.resolve({ stdout: "", error: "Python run was interrupted", code: "runtime" });
    }
  }

  private dropReady() {
    this.ready = null;
    this.state = "cold";
  }

  async run(req: RunRequest): Promise<RunResult> {
    const started = performance.now();
    const finish = (partial: Omit<RunResult, "durationMs" | "stderr"> & { stderr?: string }): RunResult => ({
      stderr: "",
      ...partial,
      durationMs: Math.round(performance.now() - started),
    });
    try {
      await this.prepare();
    } catch (err) {
      return finish({
        error: `Could not load Python: ${(err as Error).message}`,
        stdout: "",
        tests: [],
        failure: "load",
      });
    }
    const timeoutMs = req.timeoutMs ?? 8000;
    const script = req.stdin !== undefined;
    const reply = await this.call(
      {
        type: "run",
        code: buildPythonHarness(req.code, script ? "" : req.tests, script ? { stdin: req.stdin } : undefined),
        packages: req.packages ?? [],
      },
      timeoutMs,
      `Timed out after ${Math.round(timeoutMs / 1000)}s. Infinite loop?`,
      this.epoch,
    );
    if (reply.code === "timeout") {
      this.dropReady();
      return finish({ error: reply.error ?? "Timed out", stdout: reply.stdout, tests: [], failure: "timeout" });
    }
    if (reply.error) {
      this.killWorker();
      this.dropReady();
      return finish({ error: reply.error, stdout: reply.stdout, tests: [], failure: "runtime" });
    }
    return finish(parseHarnessOutput(reply.stdout));
  }

  dispose() {
    this.killWorker();
    this.dropReady();
    this.warmed = false;
  }
}
