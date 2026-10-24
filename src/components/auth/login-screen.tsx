"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { ArrowLeft, Loader2, Mail, MailCheck } from "lucide-react";
import { Scene } from "@/components/art";
import { useAuth, useProgress } from "@/components/providers";
import { Button, buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/supabase/redirect";
import { cn } from "@/lib/utils";

const ERRORS: Record<string, string> = {
  "different-browser":
    "That link was opened in a different browser from the one that asked for it. Ask for a new link below, then open it on this device. On iPhone, if your mail app opens links inside itself, press and hold the link and choose Open in Safari.",
  "missing-code": "That sign-in link is incomplete. Ask for a new one below.",
};

function describeError(code: string | null): string | null {
  if (!code) return null;
  return ERRORS[code] ?? `Sign-in failed: ${code}`;
}

function callbackUrl(next: string) {
  const url = new URL("/auth/callback", window.location.origin);
  // Always present, so an email template can append `&token_hash=...` to {{ .RedirectTo }}.
  url.searchParams.set("next", next);
  return url.toString();
}

export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={className}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function LoginScreen() {
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const { configured, ready, user, signOut } = useAuth();
  const { flush } = useProgress();
  const emailId = useId();

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"google" | "email" | "signout" | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(() => describeError(params.get("error")));

  async function google() {
    const client = createClient();
    if (!client) return;
    setBusy("google");
    setError(null);
    const { error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callbackUrl(next) } });
    if (error) {
      setError(`Google sign-in failed: ${error.message}`);
      setBusy(null);
    }
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    const client = createClient();
    const address = email.trim();
    if (!client || !address) return;
    setBusy("email");
    setError(null);
    const { error } = await client.auth.signInWithOtp({ email: address, options: { emailRedirectTo: callbackUrl(next) } });
    setBusy(null);
    if (error) {
      setError(error.status === 429 ? "Too many links sent. Wait a minute, then try again." : `Couldn't send the link: ${error.message}`);
      return;
    }
    setSentTo(address);
  }

  async function leave() {
    setBusy("signout");
    await flush();
    await signOut();
    setBusy(null);
  }

  return (
    <div className="flex flex-1 flex-col">
      <section
        className="relative isolate flex min-h-[calc(100dvh-3rem)] flex-col justify-center overflow-hidden sm:min-h-[calc(100dvh-3.5rem)]"
        data-testid="login-screen"
      >
        <Scene art="pier" className="absolute inset-0 -z-10 h-full w-full" />
        <div className="decor absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/70 to-ink/20" />

        <div className="mx-auto w-full max-w-md px-4 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6">
          <Link href={next} className="tap mb-4 inline-flex items-center gap-1.5 rounded-lg bg-ink/90 px-3 text-base font-bold text-foreground">
            <ArrowLeft className="size-5" aria-hidden /> Back
          </Link>

          <div className="overflow-hidden rounded-xl border border-border bg-ink/95">
            <div className="sunset h-1.5" aria-hidden />
            <div className="p-5 sm:p-7">
              <p className="text-sm font-bold tracking-widest text-gold-ink uppercase">Gnosis · Save game</p>
              <h1 className="mt-1 font-display text-5xl leading-none tracking-wide text-foreground">
                {user ? "SAVE LOADED" : "SAVE YOUR GAME"}
              </h1>

              {!configured ? (
                <>
                  <p className="mt-3 text-lg text-foreground">Accounts aren&apos;t switched on for this copy of Gnosis.</p>
                  <p className="mt-2 text-base text-muted-foreground">Your progress is saved in this browser and you can keep playing.</p>
                  <Link href={next} className={buttonVariants({ size: "lg", className: "mt-6 h-14 w-full font-display text-xl tracking-wider" })}>
                    Keep playing
                  </Link>
                </>
              ) : !ready ? (
                <p className="mt-4 flex items-center gap-2 text-lg text-muted-foreground" role="status">
                  <Loader2 className="size-5 animate-spin" aria-hidden /> Loading…
                </p>
              ) : user ? (
                <>
                  <p className="mt-3 text-lg text-foreground">
                    Signed in as <strong className="break-all">{user.email ?? user.name}</strong>. Your progress syncs to every device you sign in on.
                  </p>
                  <Link href={next} className={buttonVariants({ size: "lg", className: "mt-6 h-14 w-full font-display text-xl tracking-wider" })}>
                    Continue
                  </Link>
                  <Button variant="ghost" className="mt-2 w-full" onClick={leave} disabled={busy !== null}>
                    {busy === "signout" ? "Signing out…" : "Sign out"}
                  </Button>
                </>
              ) : sentTo ? (
                <div role="status" data-testid="magic-link-sent">
                  <p className="mt-4 flex items-center gap-2 font-display text-2xl tracking-wide text-money-ink">
                    <MailCheck className="size-6" aria-hidden /> CHECK YOUR EMAIL
                  </p>
                  <p className="mt-2 text-lg text-foreground">
                    We sent a sign-in link to <strong className="break-all">{sentTo}</strong>.
                  </p>
                  <p className="mt-2 text-base text-muted-foreground">
                    Open it on this device, in this browser. It can take a minute to arrive, so check spam too.
                  </p>
                  <Button variant="outline" size="lg" className="mt-6 w-full" onClick={() => setSentTo(null)}>
                    Use a different email
                  </Button>
                </div>
              ) : (
                <>
                  <p className="mt-3 text-lg text-foreground">
                    Sign in to keep your progress in sync between your PC and phone. Progress you made as a guest comes with you.
                  </p>

                  {error && (
                    <p role="alert" className="mt-4 rounded-lg border border-danger/60 bg-danger/10 px-3 py-2 text-base text-foreground">
                      {error}
                    </p>
                  )}

                  <Button
                    size="lg"
                    variant="outline"
                    className="mt-5 h-14 w-full gap-3 bg-white text-lg font-bold text-[#141414] hover:bg-white/90 hover:text-[#141414] dark:bg-white dark:hover:bg-white/90"
                    onClick={google}
                    disabled={busy !== null}
                    data-testid="google-signin"
                  >
                    {busy === "google" ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <GoogleIcon className="size-6" />}
                    Continue with Google
                  </Button>

                  <div className="my-5 flex items-center gap-3 text-sm font-bold tracking-widest text-muted-foreground" aria-hidden>
                    <span className="h-px flex-1 bg-border" /> OR <span className="h-px flex-1 bg-border" />
                  </div>

                  <form onSubmit={sendLink}>
                    <label htmlFor={emailId} className="block text-base font-bold text-foreground">
                      Email
                    </label>
                    <input
                      id={emailId}
                      type="email"
                      name="email"
                      required
                      autoComplete="email"
                      inputMode="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="send"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={cn(
                        "mt-1.5 h-14 w-full rounded-lg border border-input bg-panel px-4 text-lg text-foreground placeholder:text-muted-foreground",
                        "focus-visible:border-gold",
                      )}
                      data-testid="email-input"
                    />
                    <Button
                      type="submit"
                      size="lg"
                      className="mt-3 h-14 w-full font-display text-xl tracking-wider"
                      disabled={busy !== null}
                      data-testid="email-submit"
                    >
                      {busy === "email" ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Mail className="size-5" aria-hidden />}
                      Email me a sign-in link
                    </Button>
                  </form>

                  <p className="mt-6 border-t border-border pt-4 text-base text-muted-foreground">
                    No account needed to play.{" "}
                    <Link href={next} className="font-bold text-gold-ink underline underline-offset-4">
                      Keep playing as a guest
                    </Link>{" "}
                    and your progress stays on this device.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
