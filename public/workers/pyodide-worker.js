/* Module worker: Pyodide 314 refuses classic workers (importScripts). */
let pyodide = null;
let out = [];

self.onmessage = async (e) => {
  const { id, type } = e.data || {};
  try {
    if (type === "init") {
      if (!pyodide) {
        const indexURL = e.data.indexURL.endsWith("/") ? e.data.indexURL : `${e.data.indexURL}/`;
        const { loadPyodide } = await import(`${indexURL}pyodide.mjs`);
        pyodide = await loadPyodide({ indexURL });
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
