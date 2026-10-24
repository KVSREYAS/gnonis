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
_ia_real = _ia_sys.stdout
_ia_sys.stdout = _ia_buf
_ia_err = None
_ia_results = []
try:
    exec(compile(${src}, "solution.py", "exec"), _ia_ns)
except BaseException as _e:
    _ia_err = "".join(_ia_tb.format_exception_only(type(_e), _e)).strip()
if _ia_err is None:
    _ia_before = set(_ia_ns)
    try:
        exec(compile(${tst}, "hidden_tests.py", "exec"), _ia_ns)
    except BaseException as _e:
        _ia_err = "hidden tests failed to load: " + "".join(_ia_tb.format_exception_only(type(_e), _e)).strip()
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
            _ia_results.append({"name": _label, "passed": False, "message": type(_e).__name__ + ": " + str(_e)})
_ia_sys.stdout = _ia_real
print("${RESULT_MARKER}" + _ia_json.dumps({"error": _ia_err, "stdout": _ia_buf.getvalue()[-4000:], "tests": _ia_results}))
`;
}

export function parseHarnessOutput(stdout: string): { error: string | null; stdout: string; tests: TestResult[] } {
  const line = stdout.split("\n").reverse().find((l) => l.startsWith(RESULT_MARKER));
  if (!line) return { error: "The runner produced no results (did the code exit early?)", stdout, tests: [] };
  try {
    const parsed = JSON.parse(line.slice(RESULT_MARKER.length));
    return { error: parsed.error ?? null, stdout: parsed.stdout ?? "", tests: parsed.tests ?? [] };
  } catch {
    return { error: "Could not read test results", stdout, tests: [] };
  }
}
