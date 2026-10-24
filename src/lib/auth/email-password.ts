import type { AuthError, Session, User } from "@supabase/supabase-js";

export type AuthMode = "signin" | "signup";
export type AuthValues = { name: string; email: string; password: string };
export type FieldErrors = Partial<Record<keyof AuthValues, string>>;

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_NAME_LENGTH = 40;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Checks the form before anything is sent. Returns an empty object when it's good to go. */
export function validateAuthForm(mode: AuthMode, values: AuthValues): FieldErrors {
  const errors: FieldErrors = {};
  const name = values.name.trim();
  const email = values.email.trim();
  if (mode === "signup") {
    if (!name) errors.name = "Pick a name. It shows on your player card.";
    else if (name.length > MAX_NAME_LENGTH) errors.name = `Keep your name to ${MAX_NAME_LENGTH} characters or fewer.`;
  }
  if (!email) errors.email = "Enter your email address.";
  else if (!EMAIL_RE.test(email)) errors.email = "That doesn't look like an email address.";
  if (!values.password) errors.password = "Enter your password.";
  else if (mode === "signup" && values.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return errors;
}

/** Turns a Supabase Auth error into something a player can act on. */
export function friendlyAuthError(error: Pick<AuthError, "message"> & { code?: string; status?: number }): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Wrong email or password. Check them and try again.";
    case "user_already_exists":
    case "email_exists":
      return "There's already an account with that email. Sign in instead.";
    case "weak_password":
      return `That password is too easy to guess. Use at least ${MIN_PASSWORD_LENGTH} characters and mix in numbers or symbols.`;
    case "email_not_confirmed":
      return "This account still needs its email confirmed. Open the link we emailed you, then sign in.";
    case "email_address_invalid":
      return "That email address can't be used. Try a different one.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many tries. Wait a minute, then try again.";
    case "signup_disabled":
    case "email_provider_disabled":
      return "Creating accounts with email is switched off right now. Try Continue with Google.";
  }
  if (error.status === 429) return "Too many tries. Wait a minute, then try again.";
  if (error.status === 0 || /fetch|network/i.test(error.message)) {
    return "Can't reach the save server. Check your connection and try again.";
  }
  return error.message || "Something went wrong. Try again.";
}

type AuthResult = { data: { session: Session | null; user: User | null }; error: AuthError | null };

/** The two calls the form makes. Matches `supabase.auth`. */
export type PasswordAuth = {
  signUp(credentials: {
    email: string;
    password: string;
    options?: { data?: object; emailRedirectTo?: string };
  }): Promise<AuthResult>;
  signInWithPassword(credentials: { email: string; password: string }): Promise<AuthResult>;
};

export type AuthOutcome =
  | { kind: "signed-in" }
  | { kind: "check-email"; email: string }
  | { kind: "invalid"; errors: FieldErrors }
  | { kind: "error"; message: string };

/**
 * Validates, then signs up or signs in. Sign-up stores the display name as `full_name` in user
 * metadata, which the profile trigger copies into `profiles.display_name`. With "Confirm email"
 * off, sign-up returns a session straight away. If it doesn't, the player is asked to check their email.
 */
export async function submitEmailPassword(
  auth: PasswordAuth,
  mode: AuthMode,
  values: AuthValues,
  emailRedirectTo?: string,
): Promise<AuthOutcome> {
  const errors = validateAuthForm(mode, values);
  if (Object.keys(errors).length > 0) return { kind: "invalid", errors };
  const email = values.email.trim();
  try {
    const { data, error } =
      mode === "signup"
        ? await auth.signUp({
            email,
            password: values.password,
            options: { data: { full_name: values.name.trim() }, ...(emailRedirectTo ? { emailRedirectTo } : {}) },
          })
        : await auth.signInWithPassword({ email, password: values.password });
    if (error) return { kind: "error", message: friendlyAuthError(error) };
    if (data.session) return { kind: "signed-in" };
    return mode === "signup" ? { kind: "check-email", email } : { kind: "error", message: "Sign-in didn't finish. Try again." };
  } catch (e) {
    return { kind: "error", message: friendlyAuthError({ message: e instanceof Error ? e.message : String(e), status: 0 }) };
  }
}
