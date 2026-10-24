/* Python runtime worker.
 * Loaded as a classic worker (no { type: "module" }) so iPhone Safari can importScripts pyodide.js.
 * The same file is also a module worker: importScripts is missing there, so we import pyodide.mjs.
 * The version and CDN list live in src/lib/runner/pyodide-config.ts and arrive as indexURL. */
const moduleWorker = typeof importScripts !== "function";
let pyodide = null;
let out = [];

function withSlash(indexURL) {
  return indexURL.endsWith("/") ? indexURL : indexURL + "/";
}

function fail(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function loadRuntime(indexURL) {
  const base = withSlash(String(indexURL || ""));
  if (!moduleWorker) {
    try {
      importScripts(base + "pyodide.js");
    } catch (err) {
      throw fail(String((err && err.message) || err), "script");
    }
    if (typeof self.loadPyodide !== "function") {
      throw fail("pyodide.js did not define loadPyodide", "script");
    }
    try {
      return await self.loadPyodide({ indexURL: base });
    } catch (err) {
      const message = String((err && err.message) || err);
      const classicRejected = /Classic web workers are not supported|importScripts/.test(message);
      throw fail(message, classicRejected ? "script" : "runtime");
    }
  }
  let mod;
  try {
    mod = await import(base + "pyodide.mjs");
  } catch (err) {
    throw fail(String((err && err.message) || err), "script");
  }
  if (typeof mod.loadPyodide !== "function") {
    throw fail("pyodide.mjs did not export loadPyodide", "script");
  }
  return mod.loadPyodide({ indexURL: base });
}

self.onmessage = async (event) => {
  const data = event.data || {};
  const id = data.id;
  try {
    if (data.type === "init") {
      if (!pyodide) {
        pyodide = await loadRuntime(data.indexURL);
        pyodide.setStdout({ batched: (line) => out.push(String(line)) });
        pyodide.setStderr({ batched: (line) => out.push(String(line)) });
      }
      self.postMessage({ id, stdout: "" });
      return;
    }
    if (data.type === "run") {
      if (!pyodide) throw fail("Python is not loaded", "runtime");
      out = [];
      const code = String(data.code || "");
      const packages = Array.isArray(data.packages) ? data.packages.filter((name) => typeof name === "string" && name) : [];
      if (packages.length) await pyodide.loadPackage(packages);
      await pyodide.loadPackagesFromImports(code);
      await pyodide.runPythonAsync(code);
      self.postMessage({ id, stdout: out.join("\n") });
      return;
    }
    self.postMessage({ id, error: "unknown message", code: "runtime" });
  } catch (err) {
    self.postMessage({
      id,
      stdout: out.join("\n"),
      error: String((err && err.message) || err),
      code: err && err.code === "script" ? "script" : "runtime",
    });
  }
};
