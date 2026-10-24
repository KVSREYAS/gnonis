import { describe, expect, it, vi } from "vitest";
import type { Session, User } from "@supabase/supabase-js";
import {
  friendlyAuthError,
  MIN_PASSWORD_LENGTH,
  submitEmailPassword,
  validateAuthForm,
  type PasswordAuth,
} from "@/lib/auth/email-password";

const good = { name: "Sreyas", email: "sreyas@example.com", password: "correct-horse" };
const user = { id: "u1", email: good.email } as User;
const session = { access_token: "t", refresh_token: "r", user } as Session;

function fakeAuth(result: Awaited<ReturnType<PasswordAuth["signUp"]>>): PasswordAuth & { signUp: ReturnType<typeof vi.fn>; signInWithPassword: ReturnType<typeof vi.fn> } {
  return { signUp: vi.fn(async () => result), signInWithPassword: vi.fn(async () => result) };
}

const authError = (message: string, code?: string, status = 400) =>
  Object.assign(new Error(message), { code, status, name: "AuthApiError", __isAuthError: true }) as never;

describe("validateAuthForm", () => {
  it("accepts a complete sign-up and sign-in", () => {
    expect(validateAuthForm("signup", good)).toEqual({});
    expect(validateAuthForm("signin", { ...good, name: "" })).toEqual({});
  });

  it(`requires passwords of at least ${MIN_PASSWORD_LENGTH} characters on sign-up`, () => {
    expect(validateAuthForm("signup", { ...good, password: "1234567" }).password).toMatch(/at least 8/);
    expect(validateAuthForm("signup", { ...good, password: "12345678" }).password).toBeUndefined();
  });

  it("does not apply the length rule to sign-in, so older passwords still work", () => {
    expect(validateAuthForm("signin", { ...good, password: "short" })).toEqual({});
    expect(validateAuthForm("signin", { ...good, password: "" }).password).toMatch(/enter your password/i);
  });

  it("needs a display name on sign-up only", () => {
    expect(validateAuthForm("signup", { ...good, name: "   " }).name).toBeTruthy();
    expect(validateAuthForm("signup", { ...good, name: "x".repeat(41) }).name).toMatch(/40/);
  });

  it("checks the email shape", () => {
    expect(validateAuthForm("signin", { ...good, email: "" }).email).toMatch(/enter your email/i);
    expect(validateAuthForm("signin", { ...good, email: "sreyas@" }).email).toMatch(/doesn't look like/);
    expect(validateAuthForm("signin", { ...good, email: "  sreyas@example.com " }).email).toBeUndefined();
  });
});

describe("friendlyAuthError", () => {
  it("explains common Supabase errors in plain words", () => {
    expect(friendlyAuthError({ message: "Invalid login credentials", code: "invalid_credentials" })).toMatch(/wrong email or password/i);
    expect(friendlyAuthError({ message: "User already registered", code: "user_already_exists" })).toMatch(/sign in instead/i);
    expect(friendlyAuthError({ message: "weak", code: "weak_password" })).toMatch(/too easy to guess/);
    expect(friendlyAuthError({ message: "Email not confirmed", code: "email_not_confirmed" })).toMatch(/confirmed/);
    expect(friendlyAuthError({ message: "slow down", status: 429 })).toMatch(/too many tries/i);
    expect(friendlyAuthError({ message: "Failed to fetch", status: 0 })).toMatch(/can't reach/i);
    expect(friendlyAuthError({ message: "Something odd" })).toBe("Something odd");
  });
});

describe("submitEmailPassword", () => {
  it("does not call Supabase when the form is invalid", async () => {
    const auth = fakeAuth({ data: { session, user }, error: null });
    const out = await submitEmailPassword(auth, "signup", { ...good, password: "short" });
    expect(out).toEqual({ kind: "invalid", errors: { password: expect.stringMatching(/at least 8/) } });
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("signs up with the display name in user metadata full_name and signs straight in", async () => {
    const auth = fakeAuth({ data: { session, user }, error: null });
    const out = await submitEmailPassword(auth, "signup", { ...good, name: "  Sreyas K ", email: " sreyas@example.com" }, "https://g/auth/callback?next=%2F");
    expect(out).toEqual({ kind: "signed-in" });
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "sreyas@example.com",
      password: good.password,
      options: { data: { full_name: "Sreyas K" }, emailRedirectTo: "https://g/auth/callback?next=%2F" },
    });
  });

  it("asks the player to check their email when sign-up returns no session", async () => {
    const auth = fakeAuth({ data: { session: null, user }, error: null });
    expect(await submitEmailPassword(auth, "signup", good)).toEqual({ kind: "check-email", email: good.email });
  });

  it("signs in with email and password", async () => {
    const auth = fakeAuth({ data: { session, user }, error: null });
    expect(await submitEmailPassword(auth, "signin", good)).toEqual({ kind: "signed-in" });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: good.email, password: good.password });
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("returns a friendly message for a wrong password", async () => {
    const auth = fakeAuth({ data: { session: null, user: null }, error: authError("Invalid login credentials", "invalid_credentials") });
    expect(await submitEmailPassword(auth, "signin", good)).toEqual({ kind: "error", message: expect.stringMatching(/wrong email or password/i) });
  });

  it("turns a thrown network failure into a message instead of crashing", async () => {
    const auth: PasswordAuth = {
      signUp: async () => {
        throw new TypeError("Failed to fetch");
      },
      signInWithPassword: async () => {
        throw new TypeError("Failed to fetch");
      },
    };
    expect(await submitEmailPassword(auth, "signin", good)).toEqual({ kind: "error", message: expect.stringMatching(/can't reach/i) });
  });
});
