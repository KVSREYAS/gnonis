import { SANDBOX_UNAVAILABLE_MESSAGE, isSandboxAuthError, sandboxCreateCredentials, sandboxCredentialMode } from "@/lib/runner/cpp-auth";
import { cppJobFiles, interpretCppOutput, type CppInterpreted, type CppPlan } from "@/lib/runner/cpp-harness";

const SANDBOX_TIMEOUT_MS = 45_000;
const COMMAND_TIMEOUT_MS = 25_000;

const INSTALL_COMPILER = `
set -euo pipefail
if command -v g++ >/dev/null 2>&1; then
  g++ --version
  exit 0
fi
if command -v dnf >/dev/null 2>&1; then
  dnf install -y gcc-c++
elif command -v microdnf >/dev/null 2>&1; then
  microdnf install -y gcc-c++
elif command -v apt-get >/dev/null 2>&1; then
  apt-get update
  apt-get install -y g++
else
  echo "This sandbox image has no g++ and no package manager." >&2
  exit 1
fi
g++ --version
`;

export type SandboxRun =
  | { ok: true; result: CppInterpreted }
  | { ok: false; unavailable: true; message: string };

/**
 * Compile and run one C++ job in a fresh Vercel Sandbox.
 * Network stays closed while learner code runs. A snapshot with g++ already
 * installed (CPP_SANDBOX_SNAPSHOT_ID) avoids installing a compiler per run.
 */
export async function runCppInSandbox(plan: CppPlan): Promise<SandboxRun> {
  if (sandboxCredentialMode() === "missing") return { ok: false, unavailable: true, message: SANDBOX_UNAVAILABLE_MESSAGE };

  const { Sandbox } = await import("@vercel/sandbox");
  const snapshotId = process.env.CPP_SANDBOX_SNAPSHOT_ID?.trim();
  const credentials = sandboxCreateCredentials();
  let sandbox: Awaited<ReturnType<typeof Sandbox.create>> | null = null;
  try {
    const common = {
      timeout: SANDBOX_TIMEOUT_MS,
      persistent: false as const,
      resources: { vcpus: 1 },
      networkPolicy: "deny-all" as const,
      ...credentials,
    };
    sandbox = await Sandbox.create(snapshotId ? { ...common, source: { type: "snapshot", snapshotId } } : common);

    const haveCompiler = await commandOk(sandbox, "bash", ["-lc", "command -v g++"], 10_000);
    if (!haveCompiler) {
      const installed = await installCompiler(sandbox);
      if (!installed.ok) return { ok: false, unavailable: true, message: installed.message };
    }

    const files = cppJobFiles(plan).map((file) => ({
      path: `/tmp/gnosis/${file.path}`,
      content: file.content,
      mode: file.mode,
    }));
    await sandbox.writeFiles(files);
    const ran = await sandbox.runCommand({
      cmd: "bash",
      args: ["/tmp/gnosis/run.sh"],
      cwd: "/tmp/gnosis",
      timeoutMs: COMMAND_TIMEOUT_MS,
    });
    const stdout = await ran.stdout();
    return { ok: true, result: interpretCppOutput(plan, stdout) };
  } catch (error) {
    if (isSandboxAuthError(error)) return { ok: false, unavailable: true, message: SANDBOX_UNAVAILABLE_MESSAGE };
    console.error("cpp sandbox failed", error instanceof Error ? error.message : error);
    return {
      ok: false,
      unavailable: true,
      message: "The C++ sandbox didn't start. Try again in a moment. If this keeps happening, check that Sandbox and OIDC are enabled for the Vercel project.",
    };
  } finally {
    await sandbox?.stop().catch(() => undefined);
  }
}

async function installCompiler(sandbox: {
  update: (params: { networkPolicy: "allow-all" | "deny-all" }) => Promise<unknown>;
  runCommand: (params: { cmd: string; args: string[]; sudo?: boolean; timeoutMs?: number }) => Promise<{ exitCode: number; stderr: () => Promise<string> }>;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (process.env.CPP_SANDBOX_INSTALL !== "1") {
    return {
      ok: false,
      message:
        "This sandbox has no g++. Set CPP_SANDBOX_SNAPSHOT_ID to a snapshot with gcc-c++ installed (see scripts/cpp-sandbox-snapshot.ts). CPP_SANDBOX_INSTALL=1 installs the compiler on every run, which is slower and may hit the function time limit.",
    };
  }
  try {
    await sandbox.update({ networkPolicy: "allow-all" });
    const installed = await sandbox.runCommand({ cmd: "bash", args: ["-lc", INSTALL_COMPILER], sudo: true, timeoutMs: 40_000 });
    await sandbox.update({ networkPolicy: "deny-all" });
    if (installed.exitCode !== 0) {
      const detail = (await installed.stderr()).slice(0, 500);
      console.error("g++ install failed", detail);
      return { ok: false, message: "The sandbox couldn't install g++. Use a snapshot that already has the compiler." };
    }
    return { ok: true };
  } catch (error) {
    console.error("g++ install failed", error instanceof Error ? error.message : error);
    return { ok: false, message: "The sandbox couldn't install g++. Use a snapshot that already has the compiler." };
  }
}

async function commandOk(
  sandbox: { runCommand: (cmd: string, args: string[], opts: { timeoutMs: number }) => Promise<{ exitCode: number }> },
  cmd: string,
  args: string[],
  timeoutMs: number,
): Promise<boolean> {
  try {
    const result = await sandbox.runCommand(cmd, args, { timeoutMs });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}
