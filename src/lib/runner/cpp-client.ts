import type { TestResult } from "@/lib/grading";
import { LOCAL_RUNNER_HEADER } from "@/lib/runner/cpp-local-settings";
import type { RunFailure, RunResult } from "@/lib/runner/types";

export type CppRunBody = {
  action: "run" | "submit";
  runKind?: "samples" | "stdin";
  code: string;
  lessonId: string;
  exerciseId: string;
  stdin?: string;
  /**
   * Sample check.h tests. Sent only to the local runner for Run samples.
   * Submit omits this so hidden tests stay in the repo the runner reads.
   */
  tests?: string;
};

export type CppLocalTarget = { origin: string; token: string };

type CppJson = {
  error: string | null;
  stdout: string;
  stderr: string;
  tests: TestResult[];
  failure: RunFailure | null;
};

export async function requestCpp(
  body: CppRunBody,
  target?: CppLocalTarget | null,
): Promise<{ ok: true; result: RunResult } | { ok: false; message: string }> {
  const started = performance.now();
  if (target && !target.token.trim()) {
    return { ok: false, message: "Paste the pairing token from the runner window." };
  }
  let response: Response;
  try {
    response = await fetch(target ? `${target.origin.replace(/\/$/, "")}/run` : "/api/code/cpp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(target ? { [LOCAL_RUNNER_HEADER]: target.token.trim() } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    return {
      ok: false,
      message: target
        ? "Couldn't reach the runner on this PC. Start it with node local-runner/gnosis-runner.mjs and check the port."
        : "Couldn't reach the C++ compiler. Check your connection and try again.",
    };
  }
  if (!response.ok) {
    const message = (await response.text()).trim() || "The C++ compiler didn't answer.";
    return { ok: false, message };
  }
  const json = (await response.json()) as CppJson;
  return {
    ok: true,
    result: {
      error: json.error,
      stdout: json.stdout ?? "",
      stderr: json.stderr ?? "",
      tests: json.tests ?? [],
      failure: json.failure ?? undefined,
      durationMs: Math.round(performance.now() - started),
    },
  };
}
