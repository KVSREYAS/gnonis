"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Eye, EyeOff, Loader2, LogIn, MailCheck, UserPlus } from "lucide-react";
import { Scene } from "@/components/art";
import { useAuth, useProgress } from "@/components/providers";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  MAX_NAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  submitEmailPassword,
  type AuthMode,
  type AuthValues,
  type FieldErrors,
} from "@/lib/auth/email-password";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/supabase/redirect";
import { cn } from "@/lib/utils";

const CALLBACK_ERRORS: Record<string, string> = {
  "different-browser": "That sign-in was finished in a different browser from the one that started it. Try again from this device.",
  "missing-code": "That sign-in link is incomplete. Try again.",
};

function describeCallbackError(code: string | null): string | null {
  if (!code) return null;
  return CALLBACK_ERRORS[code] ?? `Sign-in failed: ${code}`;
}

function callbackUrl(next: string) {
  const url = new URL("/auth/callback", window.location.origin);
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

/** The GTA-style "BUSTED" banner for a failed sign-in or sign-up. */
function Busted({ message }: { message: string }) {
  return (
    <div role="alert" className="mt-4 rounded-lg border border-danger/70 bg-danger/10 px-4 py-3" data-testid="auth-error">
      <p className="font-display text-2xl leading-none tracking-widest text-danger">BUSTED</p>
      <p className="mt-1.5 text-base text-foreground">{message}</p>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-base text-foreground" data-testid="field-error">
      <AlertTriangle className="mt-1 size-4 shrink-0 text-danger" aria-hidden />
      {message}
    </p>
  );
}

const inputClass = cn(
  "mt-1.5 h-14 w-full rounded-lg border border-input bg-panel px-4 text-lg text-foreground placeholder:text-muted-foreground",
  "focus-visible:border-gold aria-invalid:border-danger",
);

const TABS: { mode: AuthMode; label: string }[] = [
  { mode: "signin", label: "Sign in" },
  { mode: "signup", label: "Create account" },
];

export function LoginScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNextPath(params.get("next"));
  const { configured, ready, user, signOut } = useAuth();
  const { flush } = useProgress();
  const id = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [mode, setMode] = useState<AuthMode>(params.get("mode") === "signup" ? "signup" : "signin");
  const [values, setValues] = useState<AuthValues>({ name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState<"google" | "form" | "signout" | null>(null);
  const [checkEmail, setCheckEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(() => describeCallbackError(params.get("error")));

  function switchMode(m: AuthMode) {
    setMode(m);
    setFieldErrors({});
    setError(null);
  }

  function onTabKey(e: React.KeyboardEvent, index: number) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const nextIndex = (index + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length;
    switchMode(TABS[nextIndex].mode);
    tabRefs.current[nextIndex]?.focus();
  }

  function setField(field: keyof AuthValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((f) => ({ ...f, [field]: undefined }));
  }

  async function google() {
    const client = createClient();
    if (!client) return;
    setBusy("google");
    setError(null);
    const { error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callbackUrl(next) } });
    if (error) {
      setError(`Google sign-in didn't start: ${error.message}`);
      setBusy(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const client = createClient();
    if (!client) return;
    setBusy("form");
    setError(null);
    const outcome = await submitEmailPassword(client.auth, mode, values, callbackUrl(next));
    setBusy(null);
    switch (outcome.kind) {
      case "invalid":
        setFieldErrors(outcome.errors);
        document.getElementById(`${id}-${Object.keys(outcome.errors)[0]}`)?.focus();
        return;
      case "error":
        setError(outcome.message);
        return;
      case "check-email":
        setCheckEmail(outcome.email);
        return;
      case "signed-in":
        router.replace(next);
    }
  }

  async function leave() {
    setBusy("signout");
    await flush();
    await signOut();
    setBusy(null);
  }

  const describedBy = (field: keyof AuthValues, hint?: string) =>
    [fieldErrors[field] ? `${id}-${field}-error` : null, hint].filter(Boolean).join(" ") || undefined;

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
                {user ? "SAVE LOADED" : mode === "signup" && !checkEmail ? "NEW SAVE FILE" : "SAVE YOUR GAME"}
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
              ) : checkEmail ? (
                <div role="status" data-testid="check-email">
                  <p className="mt-4 flex items-center gap-2 font-display text-2xl tracking-wide text-money-ink">
                    <MailCheck className="size-6" aria-hidden /> CHECK YOUR EMAIL
                  </p>
                  <p className="mt-2 text-lg text-foreground">
                    Your account is made. We sent a confirmation link to <strong className="break-all">{checkEmail}</strong>.
                  </p>
                  <p className="mt-2 text-base text-muted-foreground">Open it, then come back here and sign in. Check spam if it doesn&apos;t show up.</p>
                  <Button
                    variant="outline"
                    size="lg"
                    className="mt-6 w-full"
                    onClick={() => {
                      setCheckEmail(null);
                      switchMode("signin");
                    }}
                  >
                    Back to sign in
                  </Button>
                </div>
              ) : (
                <>
                  <div role="tablist" aria-label="Sign in or create an account" className="mt-5 grid grid-cols-2 rounded-lg border border-border bg-ink p-1">
                    {TABS.map((t, i) => (
                      <button
                        key={t.mode}
                        ref={(el) => {
                          tabRefs.current[i] = el;
                        }}
                        type="button"
                        role="tab"
                        id={`${id}-tab-${t.mode}`}
                        aria-selected={mode === t.mode}
                        aria-controls={`${id}-panel`}
                        tabIndex={mode === t.mode ? 0 : -1}
                        onClick={() => switchMode(t.mode)}
                        onKeyDown={(e) => onTabKey(e, i)}
                        className={cn(
                          "min-h-11 rounded-md px-2 font-display text-base tracking-wider whitespace-nowrap min-[400px]:text-lg",
                          mode === t.mode ? "bg-gold text-ink" : "text-muted-foreground hover:text-foreground",
                        )}
                        data-testid={`tab-${t.mode}`}
                      >
                        {t.label.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${mode}`}>
                    <p className="mt-4 text-lg text-foreground">
                      {mode === "signup"
                        ? "Make an account to keep your progress in sync between your PC and phone. Progress you made as a guest comes with you."
                        : "Welcome back. Sign in to load your save on this device. Progress you made as a guest comes with you."}
                    </p>

                    {error && <Busted message={error} />}

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
                      <span className="h-px flex-1 bg-border" /> OR USE EMAIL <span className="h-px flex-1 bg-border" />
                    </div>

                    <form onSubmit={submit} noValidate data-testid="auth-form" className="grid gap-4">
                      {mode === "signup" && (
                        <div>
                          <label htmlFor={`${id}-name`} className="block text-base font-bold text-foreground">
                            Display name
                          </label>
                          <input
                            id={`${id}-name`}
                            name="name"
                            autoComplete="nickname"
                            autoCapitalize="words"
                            maxLength={MAX_NAME_LENGTH}
                            enterKeyHint="next"
                            value={values.name}
                            onChange={(e) => setField("name", e.target.value)}
                            aria-invalid={!!fieldErrors.name}
                            aria-describedby={describedBy("name")}
                            className={inputClass}
                            data-testid="name-input"
                          />
                          <FieldError id={`${id}-name-error`} message={fieldErrors.name} />
                        </div>
                      )}

                      <div>
                        <label htmlFor={`${id}-email`} className="block text-base font-bold text-foreground">
                          Email
                        </label>
                        <input
                          id={`${id}-email`}
                          type="email"
                          name="email"
                          autoComplete={mode === "signup" ? "email" : "username"}
                          inputMode="email"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          enterKeyHint="next"
                          placeholder="you@example.com"
                          value={values.email}
                          onChange={(e) => setField("email", e.target.value)}
                          aria-invalid={!!fieldErrors.email}
                          aria-describedby={describedBy("email")}
                          className={inputClass}
                          data-testid="email-input"
                        />
                        <FieldError id={`${id}-email-error`} message={fieldErrors.email} />
                      </div>

                      <div>
                        <label htmlFor={`${id}-password`} className="block text-base font-bold text-foreground">
                          Password
                        </label>
                        <div className="relative">
                          <input
                            id={`${id}-password`}
                            type={showPassword ? "text" : "password"}
                            name="password"
                            autoComplete={mode === "signup" ? "new-password" : "current-password"}
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            enterKeyHint="go"
                            minLength={mode === "signup" ? MIN_PASSWORD_LENGTH : undefined}
                            value={values.password}
                            onChange={(e) => setField("password", e.target.value)}
                            aria-invalid={!!fieldErrors.password}
                            aria-describedby={describedBy("password", mode === "signup" ? `${id}-password-hint` : undefined)}
                            className={cn(inputClass, "pr-14")}
                            data-testid="password-input"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((s) => !s)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            aria-pressed={showPassword}
                            className="absolute top-1.5 right-1 grid size-12 place-items-center rounded-md text-muted-foreground hover:text-foreground"
                          >
                            {showPassword ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
                          </button>
                        </div>
                        {mode === "signup" && (
                          <p id={`${id}-password-hint`} className="mt-1.5 text-sm text-muted-foreground">
                            At least {MIN_PASSWORD_LENGTH} characters.
                          </p>
                        )}
                        <FieldError id={`${id}-password-error`} message={fieldErrors.password} />
                        {/* TODO: add "Forgot password?" (resetPasswordForEmail plus a reset page) once the project can send email via custom SMTP. */}
                      </div>

                      <Button
                        type="submit"
                        size="lg"
                        className="h-14 w-full font-display text-xl tracking-wider"
                        disabled={busy !== null}
                        data-testid="auth-submit"
                      >
                        {busy === "form" ? (
                          <Loader2 className="size-5 animate-spin" aria-hidden />
                        ) : mode === "signup" ? (
                          <UserPlus className="size-5" aria-hidden />
                        ) : (
                          <LogIn className="size-5" aria-hidden />
                        )}
                        {mode === "signup" ? "Create account" : "Sign in"}
                      </Button>
                    </form>
                  </div>

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
