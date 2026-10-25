import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { cppJobFiles, interpretCppOutput, type CppInterpreted, type CppPlan } from "@/lib/runner/cpp-harness";

const BINS = ["g++", "g++-13", "g++-12", "g++-11"];

export function findGpp(): string | null {
  for (const bin of BINS) {
    const found = spawnSync(bin, ["--version"], { encoding: "utf8" });
    if (found.status === 0) return bin;
  }
  return null;
}

/** Compile and run a plan with the system g++. Used by validate:content and unit tests. */
export function executeCppPlan(plan: CppPlan): CppInterpreted {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gnosis-cpp-"));
  try {
    for (const file of cppJobFiles(plan)) {
      const full = path.join(dir, file.path);
      fs.writeFileSync(full, file.content);
      if (file.mode) fs.chmodSync(full, file.mode);
    }
    const ran = spawnSync("bash", [path.join(dir, "run.sh")], {
      encoding: "utf8",
      timeout: 30_000,
      maxBuffer: 2_000_000,
      cwd: dir,
    });
    if (ran.error && (ran.error as NodeJS.ErrnoException).code === "ETIMEDOUT") {
      return { error: "Timed out.", stdout: ran.stdout ?? "", stderr: ran.stderr ?? "", tests: [], failure: "timeout" };
    }
    return interpretCppOutput(plan, ran.stdout ?? "");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
