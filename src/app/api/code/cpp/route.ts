import { z } from "zod";
import { findCodeExercise } from "@/lib/content/loader";
import { SANDBOX_UNAVAILABLE_MESSAGE, sandboxCredentialMode } from "@/lib/runner/cpp-auth";
import { planCpp } from "@/lib/runner/cpp-harness";
import { cppDailyLimit, cppLimitMessage, cppUsageGate, type CppUsageRow } from "@/lib/runner/cpp-limits";
import { runCppInSandbox } from "@/lib/runner/cpp-sandbox";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  action: z.enum(["run", "submit"]),
  runKind: z.enum(["samples", "stdin"]).optional(),
  code: z.string().max(24_000),
  lessonId: z.string().regex(/^[a-z0-9]+(?:[/-][a-z0-9]+)*$/).max(200),
  exerciseId: z.string().regex(/^[a-z0-9-]+$/).max(80),
  stdin: z.string().max(8_000).optional(),
});

function plain(message: string, status: number) {
  return new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

function usageRow(data: unknown): CppUsageRow | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  if (typeof record.run_count !== "number" || typeof record.allowed !== "boolean") return null;
  return {
    runCount: record.run_count,
    allowed: record.allowed,
    reason: typeof record.reason === "string" ? record.reason : "",
  };
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return plain("That request didn't look right.", 400);
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return plain("That request didn't look right.", 400);

  const supabase = await createClient();
  if (!supabase) return plain("Sign in to run C++. The compiler runs on the server.", 401);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return plain("Sign in to run C++. The compiler runs on the server.", 401);

  const exercise = findCodeExercise(parsed.data.lessonId, parsed.data.exerciseId);
  if (!exercise || exercise.language !== "cpp") return plain("That C++ exercise isn't in the course.", 404);

  const plan = planFor(parsed.data, exercise.visibleTests, exercise.tests);
  if (!plan.ok) return plain(plan.message, 400);

  if (sandboxCredentialMode() === "missing") return plain(SANDBOX_UNAVAILABLE_MESSAGE, 503);

  const limit = cppDailyLimit();
  const { data: usageData, error: usageError } = await supabase.rpc("increment_cpp_run_usage", { p_limit: limit });
  if (usageError) {
    console.error("cpp usage rpc failed", usageError);
    return plain("C++ runs aren't ready yet. Apply supabase/migrations/20261025120000_cpp_run_usage.sql in Supabase, then try again.", 503);
  }
  const row = usageRow(usageData);
  if (!row) return plain("C++ runs aren't ready yet. Apply supabase/migrations/20261025120000_cpp_run_usage.sql in Supabase, then try again.", 503);
  if (cppUsageGate(row, limit) !== "ok") return plain(cppLimitMessage(limit), 429);

  const ran = await runCppInSandbox(plan.plan);
  if (!ran.ok) return plain(ran.message, 503);

  const passed = ran.result.tests.filter((test) => test.passed).length;
  return Response.json({
    error: ran.result.error,
    stdout: ran.result.stdout,
    stderr: ran.result.stderr,
    tests: ran.result.tests,
    passed,
    total: ran.result.tests.length,
    failure: ran.result.failure ?? null,
    used: row.runCount,
    limit,
  });
}

function planFor(
  body: z.infer<typeof bodySchema>,
  visibleTests: string | undefined,
  hiddenTests: string,
): ReturnType<typeof planCpp> {
  if (body.action === "submit") return planCpp({ code: body.code, tests: hiddenTests, mode: "tests" });
  if (body.runKind === "stdin") return planCpp({ code: body.code, mode: "stdin", stdin: body.stdin ?? "" });
  if (!visibleTests) return { ok: false, message: "This exercise has no sample tests. Use custom input." };
  return planCpp({ code: body.code, tests: visibleTests, mode: "tests" });
}
