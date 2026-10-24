import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/supabase/redirect";

/**
 * Lands Google OAuth and email magic links. Handles the PKCE `code` (default) and the `token_hash`
 * form (if the email template is changed to link here with `token_hash` and `type`).
 */
/** The origin the browser used. `nextUrl` can report `localhost` behind `next start -H` or a proxy, which would drop the new cookies. */
function publicOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return request.nextUrl.origin;
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(/:$/, "");
  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.nextUrl.pathname + request.nextUrl.search, publicOrigin(request));
  const next = safeNextPath(url.searchParams.get("next"));
  const supabase = await createClient();
  if (!supabase) return NextResponse.redirect(new URL(next, url));

  const fail = (reason: string) => {
    const to = new URL("/login", url);
    to.searchParams.set("error", reason);
    if (next !== "/") to.searchParams.set("next", next);
    return NextResponse.redirect(to);
  };

  const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (providerError) return fail(providerError);

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail(error.code === "pkce_code_verifier_not_found" || /verifier/i.test(error.message) ? "different-browser" : error.message);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return fail(error.message);
  } else {
    return fail("missing-code");
  }

  return NextResponse.redirect(new URL(next, url));
}
