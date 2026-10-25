import type { TestResult } from "@/lib/grading";
import type { RunFailure, RunResult } from "@/lib/runner/types";

export type CppRunBody = {
  action: "run" | "submit";
  runKind?: "samples" | "stdin";
  code: string;
  lessonId: string;
  exerciseId: string;
  stdin?: string;
};

type CppJson = {
  error: string | null;
  stdout: string;
  stderr: string;
  tests: TestResult[];
  failure: RunFailure | null;
};

export async function requestCpp(body: CppRunBody): Promise<{ ok: true; result: RunResult } | { ok: false; message: string }> {
  const started = performance.now();
  let response: Response;
  try {
    response = await fetch("/api/code/cpp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: "Couldn't reach the C++ compiler. Check your connection and try again." };
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
