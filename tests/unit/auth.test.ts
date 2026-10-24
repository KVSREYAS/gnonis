import { afterEach, describe, expect, it, vi } from "vitest";
import { supabaseEnv } from "@/lib/supabase/env";
import { safeNextPath } from "@/lib/supabase/redirect";

afterEach(() => vi.unstubAllEnvs());

describe("supabaseEnv", () => {
  it("is null unless both variables are set", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    expect(supabaseEnv()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    expect(supabaseEnv()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", " sb_publishable_x ");
    expect(supabaseEnv()).toEqual({ url: "https://x.supabase.co", key: "sb_publishable_x" });
  });
});

describe("safeNextPath", () => {
  it("allows same-site paths only", () => {
    expect(safeNextPath("/courses/a/b")).toBe("/courses/a/b");
    expect(safeNextPath("/courses?x=1")).toBe("/courses?x=1");
    for (const bad of [null, "", "https://evil.example", "//evil.example", "/\\evil.example", "courses", "/login", "/auth/callback"]) {
      expect(safeNextPath(bad)).toBe("/");
    }
  });
});
