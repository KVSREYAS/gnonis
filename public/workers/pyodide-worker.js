/* Classic worker: loads Pyodide on first "init" and executes harness scripts. */
let pyodide = null;
let out = [];

self.onmessage = async (e) => {
  const { id, type } = e.data || {};
  try {
    if (type === "init") {
      if (!pyodide) {
        importScripts(e.data.indexURL + "pyodide.js");
        pyodide = await self.loadPyodide({ indexURL: e.data.indexURL });
        pyodide.setStdout({ batched: (s) => out.push(s) });
        pyodide.setStderr({ batched: (s) => out.push(s) });
      }
      self.postMessage({ id, stdout: "" });
      return;
    }
    if (type === "run") {
      out = [];
      await pyodide.runPythonAsync(e.data.code);
      self.postMessage({ id, stdout: out.join("\n") });
      return;
    }
    self.postMessage({ id, error: "unknown message" });
  } catch (err) {
    self.postMessage({ id, stdout: out.join("\n"), error: String((err && err.message) || err) });
  }
};
