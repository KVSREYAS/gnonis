import { afterEach, describe, expect, it } from "vitest";
import { sandboxCredentialMode } from "@/lib/runner/cpp-auth";
import { cppLimitMessage, cppUsageGate } from "@/lib/runner/cpp-limits";

const KEYS = ["VERCEL_TOKEN", "VERCEL_TEAM_ID", "VERCEL_PROJECT_ID", "VERCEL_OIDC_TOKEN", "VERCEL"] as const;

describe("cpp usage gate", () => {
  it("fails closed when the count is over the cap or the row says no", () => {
    expect(cppUsageGate({ runCount: 1, allowed: true, reason: "" }, 40)).toBe("ok");
    expect(cppUsageGate({ runCount: 41, allowed: true, reason: "" }, 40)).toBe("daily");
    expect(cppUsageGate({ runCount: 1, allowed: false, reason: "" }, 40)).toBe("daily");
    expect(cppUsageGate({ runCount: 1, allowed: true, reason: "daily" }, 40)).toBe("daily");
    expect(cppLimitMessage(40)).toMatch(/40/);
  });
});

describe("sandbox credentials", () => {
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  function clear() {
    for (const key of KEYS) delete process.env[key];
  }

  it("refuses to start a sandbox when nothing identifies the project", () => {
    clear();
    expect(sandboxCredentialMode()).toBe("missing");
  });

  it("accepts an explicit token trio, then an OIDC token, then a Vercel deployment", () => {
    clear();
    process.env.VERCEL_TOKEN = "t";
    process.env.VERCEL_TEAM_ID = "team";
    process.env.VERCEL_PROJECT_ID = "prj";
    expect(sandboxCredentialMode()).toBe("token");
    clear();
    process.env.VERCEL_OIDC_TOKEN = "oidc";
    expect(sandboxCredentialMode()).toBe("oidc");
    clear();
    process.env.VERCEL = "1";
    expect(sandboxCredentialMode()).toBe("vercel");
  });
});
