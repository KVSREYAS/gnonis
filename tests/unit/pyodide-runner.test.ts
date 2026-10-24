import { afterEach, describe, expect, it, vi } from "vitest";
import { PyodideRunner } from "@/lib/runner/pyodide-runner";
import { PYODIDE_VERSION, pyodideIndexUrls } from "@/lib/runner/pyodide-config";
import { RESULT_MARKER } from "@/lib/runner/python-harness";

type Reply = { id: number; stdout?: string; error?: string; code?: string };

class FakeWorker {
  static made: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: { message?: string; preventDefault?: () => void }) => void) | null = null;
  terminated = false;
  messages: Array<Record<string, unknown>> = [];

  constructor(
    readonly url: string,
    readonly options?: { type?: string },
  ) {
    FakeWorker.made.push(this);
  }

  postMessage(data: Record<string, unknown>) {
    this.messages.push(data);
    queueMicrotask(() => {
      if (this.terminated || !this.onmessage) return;
      const id = data.id as number;
      if (data.type === "init") {
        const indexURL = String(data.indexURL);
        const classic = this.options?.type !== "module";
        if (indexURL.includes("fail-classic") && classic) {
          this.onmessage({ data: { id, error: "Failed to execute 'importScripts'", code: "script" } } as MessageEvent);
          return;
        }
        if (indexURL.includes("down")) {
          this.onmessage({ data: { id, error: "network down", code: "script" } } as MessageEvent);
          return;
        }
        this.onmessage({ data: { id, stdout: "" } } as MessageEvent);
        return;
      }
      if (data.type === "run") {
        if (String(data.code).includes("HANG")) return;
        const payload: Reply = {
          id,
          stdout: `${RESULT_MARKER}${JSON.stringify({ error: null, stdout: "ok", tests: [{ name: "adds", passed: true }] })}`,
        };
        this.onmessage({ data: payload } as MessageEvent);
      }
    });
  }

  terminate() {
    this.terminated = true;
  }
}

describe("PyodideRunner", () => {
  afterEach(() => {
    FakeWorker.made = [];
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_PYODIDE_INDEX_URL;
  });

  function install() {
    vi.stubGlobal("Worker", FakeWorker);
  }

  it("loads once with a classic worker and reuses that runtime", async () => {
    install();
    const runner = new PyodideRunner();
    await runner.prepare();
    await runner.prepare();
    expect(FakeWorker.made).toHaveLength(1);
    expect(FakeWorker.made[0].options?.type).toBeUndefined();
    expect(FakeWorker.made[0].url).toBe("/workers/pyodide-worker.js");
    expect(FakeWorker.made[0].messages[0]).toMatchObject({
      type: "init",
      indexURL: `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`,
    });
    expect(runner.isReady()).toBe(true);
    expect(runner.isWarmed()).toBe(true);
    const result = await runner.run({ language: "python", code: "def add(a, b):\n    return a + b\n", tests: "def test_add():\n    assert add(1, 2) == 3\n" });
    expect(result.failure).toBeUndefined();
    expect(result.tests).toEqual([{ name: "adds", passed: true }]);
    expect(result.stdout).toBe("ok");
    expect(FakeWorker.made).toHaveLength(1);
    runner.dispose();
  });

  it("falls back to a module worker when importScripts fails, then to the next CDN", async () => {
    install();
    process.env.NEXT_PUBLIC_PYODIDE_INDEX_URL = "https://cdn.example/fail-classic/";
    const runner = new PyodideRunner();
    await runner.prepare();
    expect(FakeWorker.made.map((worker) => worker.options?.type ?? "classic")).toEqual(["classic", "module"]);
    expect(String(FakeWorker.made[1].messages[0].indexURL)).toContain("fail-classic");
    expect(pyodideIndexUrls()[0]).toContain("fail-classic");
    runner.dispose();
  });

  it("skips a CDN that fails both worker modes and recovers on the next run", async () => {
    install();
    process.env.NEXT_PUBLIC_PYODIDE_INDEX_URL = "https://cdn.example/down/";
    const runner = new PyodideRunner();
    await runner.prepare();
    const modes = FakeWorker.made.map((worker) => worker.options?.type ?? "classic");
    expect(modes.slice(0, 2)).toEqual(["classic", "module"]);
    expect(String(FakeWorker.made.at(-1)?.messages[0].indexURL)).toContain(`v${PYODIDE_VERSION}`);
    const before = FakeWorker.made.length;
    const timedOut = await runner.run({
      language: "python",
      code: "HANG",
      tests: "",
      timeoutMs: 40,
    });
    expect(timedOut.failure).toBe("timeout");
    expect(timedOut.error).toMatch(/Infinite loop/);
    expect(runner.isReady()).toBe(false);
    expect(runner.isWarmed()).toBe(true);
    expect(FakeWorker.made[before - 1]?.terminated).toBe(true);
    const again = await runner.run({ language: "python", code: "print(1)", tests: "" });
    expect(again.tests[0]?.passed).toBe(true);
    expect(FakeWorker.made.length).toBeGreaterThan(before + 1);
    runner.dispose();
  });
});
