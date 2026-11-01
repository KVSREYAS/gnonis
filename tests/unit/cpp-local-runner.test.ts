import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CPP_CHECK_HEADER, CPP_CODE_MAX, CPP_COMPILE_WALL_SEC, CPP_RUN_WALL_SEC, CPP_STDERR_MAX, CPP_STDOUT_MAX, CPP_STDIN_MAX, CPP_TESTS_MAX, translationUnit as tsUnit } from "@/lib/runner/cpp-harness";
import { LOCAL_RUNNER_HEADER, checkLocalRunner, parseLocalRunnerSettings } from "@/lib/runner/cpp-local-settings";
import {
  CHECK_HEADER,
  DEFAULT_CONTENT_ROOT,
  LIMITS,
  TOKEN_HEADER,
  findCompiler,
  interpretRun,
  isAllowedOrigin,
  loadCppExercise,
  resolveJob,
  startRunner,
  translationUnit,
} from "../../local-runner/gnosis-runner.mjs";

type Runner = Awaited<ReturnType<typeof startRunner>>;

const TOKEN = "test-token-0123456789abcdef";
const LESSON = "sample-bits-bytes/01-number-formats/03-field-kit";
const EXERCISE = "add-two";
let compiler: Awaited<ReturnType<typeof findCompiler>> = null;
const open: Runner[] = [];

beforeAll(async () => {
  compiler = await findCompiler();
});

afterAll(async () => {
  await Promise.all(open.map((runner) => runner.close()));
});

async function boot(timeouts?: { compileMs?: number; runMs?: number }) {
  const runner = await startRunner({ port: 0, token: TOKEN, contentRoot: DEFAULT_CONTENT_ROOT, compiler, timeouts });
  open.push(runner);
  return runner;
}

describe("local runner contract", () => {
  it("matches the sandbox header, limits, token header, and translation unit", () => {
    expect(CHECK_HEADER).toBe(CPP_CHECK_HEADER);
    expect(LIMITS).toMatchObject({
      code: CPP_CODE_MAX,
      tests: CPP_TESTS_MAX,
      stdin: CPP_STDIN_MAX,
      stdout: CPP_STDOUT_MAX,
      stderr: CPP_STDERR_MAX,
      compileMs: CPP_COMPILE_WALL_SEC * 1000,
      runMs: CPP_RUN_WALL_SEC * 1000,
    });
    expect(TOKEN_HEADER).toBe(LOCAL_RUNNER_HEADER);
    const code = "int marker(){return 1;}\n";
    const tests = "int main(){CHECK(marker()==1);return 0;}\n";
    expect(translationUnit(code, tests)).toBe(tsUnit(code, tests));
    expect(translationUnit(code, null)).toBe(tsUnit(code, null));
  });

  it("allows the production origin and localhost dev origins only", () => {
    expect(isAllowedOrigin("https://gnonis.vercel.app")).toBe(true);
    expect(isAllowedOrigin("http://localhost:4317")).toBe(true);
    expect(isAllowedOrigin("http://127.0.0.1:3000")).toBe(true);
    expect(isAllowedOrigin("http://[::1]:4317")).toBe(true);
    expect(isAllowedOrigin("https://evil.example")).toBe(false);
    expect(isAllowedOrigin("https://gnonis.vercel.app.evil.example")).toBe(false);
    expect(isAllowedOrigin("http://localhost.evil.example")).toBe(false);
    expect(isAllowedOrigin("null")).toBe(false);
  });

  it("reads hidden and sample tests from the course files", () => {
    const exercise = loadCppExercise(DEFAULT_CONTENT_ROOT, LESSON, EXERCISE);
    expect(exercise?.visibleTests).toContain("CHECK(add(2, 3) == 5)");
    expect(exercise?.tests).toContain("CHECK(add(-4, 10) == 6)");
    expect(exercise?.tests).not.toContain("return a + b");
    expect(loadCppExercise(DEFAULT_CONTENT_ROOT, LESSON, "missing")).toBeNull();
    const planned = resolveJob({ action: "submit", code: "int x;\n", lessonId: LESSON, exerciseId: EXERCISE }, DEFAULT_CONTENT_ROOT);
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.plan.graded).toBe(true);
    expect(planned.plan.source).toContain("CHECK(add(-4, 10) == 6)");
    expect(planned.plan.source).not.toContain("return a + b");
  });

  it("accepts samples, custom input, and submit modes", () => {
    const samples = resolveJob(
      { mode: "samples", code: "int x;\n", tests: "int main(){return 0;}\n", lessonId: LESSON, exerciseId: EXERCISE },
      DEFAULT_CONTENT_ROOT,
    );
    expect(samples.ok && samples.plan.graded).toBe(true);
    const stdin = resolveJob({ mode: "stdin", code: "int main(){return 0;}\n", stdin: "hi", lessonId: LESSON, exerciseId: EXERCISE }, DEFAULT_CONTENT_ROOT);
    expect(stdin.ok && stdin.plan.graded).toBe(false);
    if (stdin.ok) expect(stdin.plan.stdin).toBe("hi");
    expect(resolveJob({ action: "nope", code: "int x;\n", lessonId: LESSON, exerciseId: EXERCISE }, DEFAULT_CONTENT_ROOT).ok).toBe(false);
  });

  it("describes timeouts and check failures the way the UI already renders them", () => {
    expect(interpretRun({ graded: true, status: 124, signal: null, stdout: "", stderr: "", timedOut: true, runWallSec: 3 }).error).toMatch(/Timed out after 3s/);
    const failed = interpretRun({
      graded: true,
      status: 1,
      signal: null,
      stdout: "",
      stderr: "tests.cpp:3: CHECK failed: add(2, 3) == 5\n",
      timedOut: false,
      runWallSec: 3,
    });
    expect(failed.tests).toEqual([{ name: "checks", passed: false, message: "tests.cpp:3: CHECK failed: add(2, 3) == 5" }]);
    expect(interpretRun({ graded: true, status: 0, signal: null, stdout: "", stderr: "", timedOut: false, runWallSec: 3 }).tests[0].passed).toBe(true);
  });
});

describe("local runner server", () => {
  it("binds loopback, requires the token, and answers the private-network preflight", async () => {
    const runner = await boot();
    expect(runner.address).toBe("127.0.0.1");
    const health = await fetch(`http://127.0.0.1:${runner.port}/health`, { headers: { [TOKEN_HEADER]: TOKEN } });
    expect(health.status).toBe(200);
    const preflight = await fetch(`http://127.0.0.1:${runner.port}/run`, {
      method: "OPTIONS",
      headers: {
        origin: "https://gnonis.vercel.app",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type, x-gnosis-runner-token",
        "access-control-request-private-network": "true",
      },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe("https://gnonis.vercel.app");
    expect(preflight.headers.get("access-control-allow-private-network")).toBe("true");
    expect(preflight.headers.get("access-control-allow-headers")).toMatch(/x-gnosis-runner-token/);
    const evil = await fetch(`http://127.0.0.1:${runner.port}/run`, {
      method: "OPTIONS",
      headers: { origin: "https://evil.example", "access-control-request-method": "POST" },
    });
    expect(evil.status).toBe(403);
    expect(evil.headers.get("access-control-allow-origin")).toBeNull();
    const denied = await fetch(`http://127.0.0.1:${runner.port}/health`);
    expect(denied.status).toBe(401);
    const local = await fetch(`http://127.0.0.1:${runner.port}/health`, {
      headers: { origin: "http://localhost:4317", [TOKEN_HEADER]: TOKEN },
    });
    expect(local.headers.get("access-control-allow-origin")).toBe("http://localhost:4317");
    const probed = await checkLocalRunner({ enabled: true, port: runner.port, token: TOKEN });
    expect(probed.state).toBe("connected");
    expect(probed.detail.startsWith("Connected")).toBe(true);
  });

  it("compiles samples, custom input, submit, and a timeout", async ({ skip }) => {
    if (!compiler) {
      skip();
      return;
    }
    const runner = await boot({ compileMs: 10_000, runMs: 500 });
    const headers = { "content-type": "application/json", [TOKEN_HEADER]: TOKEN, origin: "http://127.0.0.1:4317" };
    const run = async (body: unknown) => {
      const response = await fetch(`http://127.0.0.1:${runner.port}/run`, { method: "POST", headers, body: JSON.stringify(body) });
      expect(response.ok).toBe(true);
      return response.json() as Promise<{ error: string | null; tests: { passed: boolean; message?: string }[]; stdout: string; failure: string | null }>;
    };
    const samples = await run({
      action: "run",
      runKind: "samples",
      code: "long long add(long long a, long long b) { return a + b; }\n",
      tests: "#include \"check.h\"\nint main(){ CHECK(add(2, 3) == 5); return 0; }\n",
      lessonId: LESSON,
      exerciseId: EXERCISE,
    });
    expect(samples.tests).toEqual([{ name: "checks", passed: true }]);
    expect(samples.failure).toBeNull();

    const input = await run({
      mode: "stdin",
      code: "#include <iostream>\n#include <string>\nint main(){ std::string s; std::getline(std::cin, s); std::cout << s; }\n",
      stdin: "local-ok",
      lessonId: LESSON,
      exerciseId: EXERCISE,
    });
    expect(input.stdout).toContain("local-ok");

    const submit = await run({ action: "submit", code: "long long add(long long a, long long b) { return 0; }\n", lessonId: LESSON, exerciseId: EXERCISE });
    expect(submit.tests[0]?.passed).toBe(false);
    expect(submit.tests[0]?.message).toMatch(/CHECK failed/);

    const passed = await run({
      action: "submit",
      code: "long long add(long long a, long long b) { return a + b; }\n",
      lessonId: LESSON,
      exerciseId: EXERCISE,
    });
    expect(passed.tests[0]?.passed).toBe(true);

    const hung = await run({
      mode: "stdin",
      code: "int main(){ volatile int x = 0; while (x == 0) {} }\n",
      lessonId: LESSON,
      exerciseId: EXERCISE,
    });
    expect(hung.failure).toBe("timeout");
    expect(hung.error).toMatch(/Timed out/);
  });
});

describe("runner settings", () => {
  it("parses the saved port and token and falls back to 8787", () => {
    expect(parseLocalRunnerSettings(null)).toEqual({ enabled: false, port: 8787, token: "" });
    expect(parseLocalRunnerSettings('{"enabled":true,"port":9000,"token":" abc "}')).toEqual({ enabled: true, port: 9000, token: "abc" });
    expect(parseLocalRunnerSettings('{"enabled":true,"port":0,"token":1}')).toEqual({ enabled: true, port: 8787, token: "" });
    expect(parseLocalRunnerSettings("nope")).toEqual({ enabled: false, port: 8787, token: "" });
  });
});
