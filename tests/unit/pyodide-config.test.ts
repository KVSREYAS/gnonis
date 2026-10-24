import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PYODIDE_VERSION,
  PYODIDE_WORKER_URL,
  contentSecurityPolicy,
  pyodideCspOrigins,
  pyodideIndexUrls,
  pyodideModuleUrl,
  pyodideScriptUrl,
} from "@/lib/runner/pyodide-config";

const workerSource = fs.readFileSync(path.join(process.cwd(), "public/workers/pyodide-worker.js"), "utf8");

describe("pyodide config", () => {
  it("pins one real 0.x stable release and builds every CDN URL from it", () => {
    expect(PYODIDE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(PYODIDE_VERSION).not.toBe("314.0.7");
    const urls = pyodideIndexUrls();
    expect(urls).toEqual([
      `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`,
      `https://cdn.jsdelivr.net/npm/pyodide@${PYODIDE_VERSION}/`,
      `https://unpkg.com/pyodide@${PYODIDE_VERSION}/`,
    ]);
    expect(pyodideScriptUrl(urls[0])).toBe(`${urls[0]}pyodide.js`);
    expect(pyodideModuleUrl(urls[2])).toBe(`${urls[2]}pyodide.mjs`);
    expect(pyodideCspOrigins()).toEqual(["https://cdn.jsdelivr.net", "https://unpkg.com"]);
  });

  it("puts an env override first without dropping the pinned fallbacks", () => {
    const previous = process.env.NEXT_PUBLIC_PYODIDE_INDEX_URL;
    process.env.NEXT_PUBLIC_PYODIDE_INDEX_URL = "https://example.test/pyodide";
    try {
      const urls = pyodideIndexUrls();
      expect(urls[0]).toBe("https://example.test/pyodide/");
      expect(urls).toContain(`https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`);
      expect(pyodideCspOrigins()).toContain("https://example.test");
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_PYODIDE_INDEX_URL;
      else process.env.NEXT_PUBLIC_PYODIDE_INDEX_URL = previous;
    }
  });

  it("allows the runtime origins, workers, and wasm in the content security policy", () => {
    const policy = contentSecurityPolicy({ supabaseUrl: "https://example.supabase.co" });
    expect(policy).toContain("script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com");
    expect(policy).toContain("worker-src 'self' blob: https://cdn.jsdelivr.net https://unpkg.com");
    expect(policy).toContain("connect-src 'self' https://cdn.jsdelivr.net https://unpkg.com https://example.supabase.co wss://example.supabase.co");
    const dev = contentSecurityPolicy({ dev: true });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).toContain("ws://localhost:*");
  });

  it("keeps the worker free of a hardcoded version and able to load either way", () => {
    expect(PYODIDE_WORKER_URL).toBe("/workers/pyodide-worker.js");
    expect(workerSource).not.toMatch(/314\.0\.7|0\.29\.5|pyodide\/v\d/);
    expect(workerSource).toContain("importScripts");
    expect(workerSource).toContain("pyodide.mjs");
    expect(workerSource).toContain("loadPackagesFromImports");
    expect(workerSource).toContain("loadPackage");
    expect(workerSource).toContain('typeof importScripts !== "function"');
    expect(workerSource).not.toMatch(/^\s*export[\s{]/m);
  });
});

describe("pyodide CDN", () => {
  const urls = pyodideIndexUrls();

  it("serves a classic pyodide.js with HTTP 200 on every fallback", async () => {
    for (const indexUrl of urls) {
      const response = await fetch(pyodideScriptUrl(indexUrl));
      expect(response.status, indexUrl).toBe(200);
      const body = await response.text();
      expect(body).toContain("loadPyodide");
      expect(body).not.toContain("Classic web workers are not supported");
      expect(body.slice(0, 80)).not.toMatch(/^\s*export\s/);
    }
  }, 60_000);

  it("serves the wasm and stdlib next to the primary loader", async () => {
    const indexUrl = urls[0];
    for (const file of ["pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json", "pyodide.mjs"]) {
      const response = await fetch(`${indexUrl}${file}`, { headers: { Range: "bytes=0-15" } });
      expect([200, 206], file).toContain(response.status);
    }
  }, 60_000);
});
