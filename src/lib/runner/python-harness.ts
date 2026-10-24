import type { TestResult } from "@/lib/grading";

export const RESULT_MARKER = "__IA_RESULTS__";

/**
 * Builds one self-contained Python script that runs the learner's code, then every test_* function
 * defined by the hidden tests, and prints a single JSON line prefixed with RESULT_MARKER. The same
 * script works in Pyodide, in CPython (CI) and on a remote sandbox.
 */
export function buildPythonHarness(code: string, tests: string): string {
  // JSON string literals are valid Python string literals.
  const src = JSON.stringify(code);
  const tst = JSON.stringify(tests);
  return `
import sys as _ia_sys, io as _ia_io, json as _ia_json, traceback as _ia_tb
_ia_ns = {"__name__": "__main__"}
_ia_buf = _ia_io.StringIO()
_ia_errbuf = _ia_io.StringIO()
_ia_real_out = _ia_sys.stdout
_ia_real_err = _ia_sys.stderr
_ia_sys.stdout = _ia_buf
_ia_sys.stderr = _ia_errbuf
_ia_err = None
_ia_results = []

def _ia_pretty(exc):
    frames = [f for f in _ia_tb.extract_tb(exc.__traceback__) if f.filename in ("solution.py", "hidden_tests.py")]
    head = ""
    if frames:
        head = "Traceback (most recent call last):\\n" + "".join(_ia_tb.format_list(frames))
    tail = "".join(_ia_tb.format_exception_only(type(exc), exc)).strip()
    return (head + tail).strip()

try:
    try:
        exec(compile(${src}, "solution.py", "exec"), _ia_ns)
    except BaseException as _e:
        _ia_err = _ia_pretty(_e)
    if _ia_err is None:
        _ia_before = set(_ia_ns)
        try:
            exec(compile(${tst}, "hidden_tests.py", "exec"), _ia_ns)
        except BaseException as _e:
            _ia_err = "hidden tests failed to load: " + _ia_pretty(_e)
        _ia_tests = [k for k in _ia_ns if k.startswith("test_") and callable(_ia_ns[k]) and (k not in _ia_before)]
        for _name in _ia_tests:
            _fn = _ia_ns[_name]
            _label = (_fn.__doc__ or _name).strip()
            try:
                _fn()
                _ia_results.append({"name": _label, "passed": True})
            except AssertionError as _e:
                _ia_results.append({"name": _label, "passed": False, "message": str(_e) or "assertion failed"})
            except BaseException as _e:
                _ia_results.append({"name": _label, "passed": False, "message": _ia_pretty(_e)})
finally:
    _ia_sys.stdout = _ia_real_out
    _ia_sys.stderr = _ia_real_err
print("${RESULT_MARKER}" + _ia_json.dumps({"error": _ia_err, "stdout": _ia_buf.getvalue()[-4000:], "stderr": _ia_errbuf.getvalue()[-2000:], "tests": _ia_results}))
`;
}

export function parseHarnessOutput(stdout: string): { error: string | null; stdout: string; tests: TestResult[] } {
  const line = stdout.split("\n").reverse().find((l) => l.startsWith(RESULT_MARKER));
  if (!line) return { error: "The runner produced no results (did the code exit early?)", stdout, tests: [] };
  try {
    const parsed = JSON.parse(line.slice(RESULT_MARKER.length)) as {
      error?: string | null;
      stdout?: string;
      stderr?: string;
      tests?: TestResult[];
    };
    const printed = parsed.stdout ?? "";
    const stderr = parsed.stderr ?? "";
    const combined = stderr ? (printed ? `${printed.endsWith("\n") ? printed : `${printed}\n`}${stderr}` : stderr) : printed;
    return { error: parsed.error ?? null, stdout: combined, tests: parsed.tests ?? [] };
  } catch {
    return { error: "Could not read test results", stdout, tests: [] };
  }
}
