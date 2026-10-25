/**
 * Build a Vercel Sandbox snapshot that already has g++.
 *
 *   npx tsx scripts/cpp-sandbox-snapshot.ts
 *
 * Reads .env.local when present (does not override variables already set).
 * Prints CPP_SANDBOX_SNAPSHOT_ID=... on success. Set that on the Vercel project.
 * snapshot() stops the sandbox. This script does not stop it a second time.
 */
import fs from "node:fs";
import path from "node:path";
import { sandboxCreateCredentials, sandboxCredentialMode } from "../src/lib/runner/cpp-auth";

function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const INSTALL = `
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

async function main() {
  loadEnvFile(path.resolve(".env.local"));
  loadEnvFile(path.resolve(".env"));
  if (sandboxCredentialMode() === "missing") {
    console.error("No sandbox credentials. Run `npx vercel link` and `npx vercel env pull`, or set VERCEL_TOKEN, VERCEL_TEAM_ID, and VERCEL_PROJECT_ID.");
    process.exit(1);
  }
  const { Sandbox } = await import("@vercel/sandbox");
  const credentials = sandboxCreateCredentials();
  const sandbox = await Sandbox.create({
    timeout: 5 * 60 * 1000,
    networkPolicy: "allow-all",
    resources: { vcpus: 1 },
    ...credentials,
  });
  let snapshotted = false;
  try {
    const installed = await sandbox.runCommand({ cmd: "bash", args: ["-lc", INSTALL], sudo: true, timeoutMs: 180_000 });
    if (installed.exitCode !== 0) {
      console.error(await installed.stderr());
      process.exit(1);
    }
    await sandbox.writeFiles([
      {
        path: "/tmp/hello.cpp",
        content: '#include <iostream>\nint main(){std::cout<<"ok\\n";}\n',
      },
    ]);
    const compiled = await sandbox.runCommand({
      cmd: "g++",
      args: ["-std=c++20", "-O2", "-o", "/tmp/hello", "/tmp/hello.cpp"],
      timeoutMs: 60_000,
    });
    if (compiled.exitCode !== 0) {
      console.error(await compiled.stderr());
      process.exit(1);
    }
    const ran = await sandbox.runCommand({ cmd: "/tmp/hello", timeoutMs: 10_000 });
    const hello = (await ran.stdout()).trim();
    if (ran.exitCode !== 0 || hello !== "ok") {
      console.error(`hello world failed (${ran.exitCode}): ${hello}`);
      process.exit(1);
    }
    const machine = await sandbox.runCommand({ cmd: "g++", args: ["-dumpmachine"], timeoutMs: 10_000 });
    const triple = (await machine.stdout()).trim();
    if (!triple.startsWith("x86_64")) {
      console.error(`g++ target is ${triple || "unknown"}. C++ exercises need x86-64 (SSE2, <emmintrin.h>).`);
      process.exit(1);
    }
    await sandbox.writeFiles([
      {
        path: "/tmp/sse.cpp",
        content: `#include <emmintrin.h>\n#include <cstdio>\nint main(){__m128i v=_mm_set1_epi32(21);__m128i w=_mm_add_epi32(v,v);std::printf("%d\\n",_mm_cvtsi128_si32(w));}\n`,
      },
    ]);
    const sse = await sandbox.runCommand({
      cmd: "g++",
      args: ["-std=c++20", "-O2", "-o", "/tmp/sse", "/tmp/sse.cpp"],
      timeoutMs: 60_000,
    });
    if (sse.exitCode !== 0) {
      console.error(await sse.stderr());
      process.exit(1);
    }
    const snap = await sandbox.snapshot({ expiration: 0 });
    snapshotted = true;
    console.log(`CPP_SANDBOX_SNAPSHOT_ID=${snap.snapshotId}`);
  } finally {
    if (!snapshotted) await sandbox.stop().catch(() => undefined);
  }
}

void main();
