import type { Page, Request } from "@playwright/test";

/** Where the accounts build thinks Supabase lives. Nothing listens there; tests intercept it in the browser. */
export const FAKE_SUPABASE_URL = "http://127.0.0.1:54399";

const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");

export function fakeSession(email: string, fullName: string) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const user = {
    id: "11111111-2222-3333-4444-555555555555",
    aud: "authenticated",
    role: "authenticated",
    email,
    user_metadata: { full_name: fullName },
    app_metadata: { provider: "email" },
    identities: [{ id: "x" }],
    created_at: new Date().toISOString(),
  };
  const jwt = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: user.id, exp, role: "authenticated", email, aud: "authenticated" })}.sig`;
  return { access_token: jwt, refresh_token: "fake-refresh", expires_in: 3600, expires_at: exp, token_type: "bearer", user };
}

type Reply = { status: number; body: unknown };

export type FakeSupabase = {
  signups: Record<string, unknown>[];
  signins: Record<string, unknown>[];
  progressWrites: unknown[];
};

/**
 * Answers the Auth and REST calls the app makes. `signup` / `signin` decide what those endpoints
 * return. Progress starts empty and accepts upserts.
 */
export async function mockSupabase(
  page: Page,
  opts: { signup?: (body: Record<string, unknown>) => Reply; signin?: (body: Record<string, unknown>) => Reply } = {},
): Promise<FakeSupabase> {
  const calls: FakeSupabase = { signups: [], signins: [], progressWrites: [] };
  let profileName: string | null = null;

  await page.route(`${FAKE_SUPABASE_URL}/**`, async (route) => {
    const req: Request = route.request();
    const url = new URL(req.url());
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
    if (req.method() === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" },
      });
    }

    if (url.pathname === "/auth/v1/signup") {
      const body = req.postDataJSON();
      calls.signups.push(body);
      const reply = opts.signup?.(body) ?? { status: 200, body: fakeSession(body.email, body.data?.full_name ?? "") };
      profileName = (body.data?.full_name as string) ?? null;
      return json(reply.status, reply.body);
    }
    if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "password") {
      const body = req.postDataJSON();
      calls.signins.push(body);
      const reply = opts.signin?.(body) ?? { status: 200, body: fakeSession(body.email, "Returning Player") };
      return json(reply.status, reply.body);
    }
    if (url.pathname === "/rest/v1/profiles") {
      const row = profileName ? { display_name: profileName } : null;
      const wantsObject = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
      if (wantsObject) return row ? json(200, row) : json(406, { code: "PGRST116", message: "0 rows" });
      return json(200, row ? [row] : []);
    }
    if (url.pathname === "/rest/v1/progress") {
      if (req.method() === "GET") {
        const wantsObject = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
        return wantsObject ? json(406, { code: "PGRST116", message: "0 rows" }) : json(200, []);
      }
      calls.progressWrites.push(req.postDataJSON());
      return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*" }, body: "" });
    }
    return json(200, {});
  });
  return calls;
}
