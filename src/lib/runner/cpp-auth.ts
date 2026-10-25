/**
 * Vercel Sandbox authenticates with an OIDC token on deployments, or with an
 * explicit token plus team and project ids. Calling the SDK without either
 * can hang a local dev server in a device-login prompt, so check first.
 */
export type SandboxCredentialMode = "token" | "oidc" | "vercel" | "missing";

export function sandboxCredentialMode(): SandboxCredentialMode {
  const token = process.env.VERCEL_TOKEN?.trim();
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  if (token && teamId && projectId) return "token";
  if (process.env.VERCEL_OIDC_TOKEN?.trim()) return "oidc";
  // On Vercel the OIDC token is sometimes only on the request, not in env.
  if (process.env.VERCEL) return "vercel";
  return "missing";
}

export function sandboxCreateCredentials(): { token: string; teamId: string; projectId: string } | undefined {
  if (sandboxCredentialMode() !== "token") return undefined;
  return {
    token: process.env.VERCEL_TOKEN!.trim(),
    teamId: process.env.VERCEL_TEAM_ID!.trim(),
    projectId: process.env.VERCEL_PROJECT_ID!.trim(),
  };
}

export const SANDBOX_UNAVAILABLE_MESSAGE =
  "C++ compiles on a Vercel Sandbox (g++), and this environment can't reach it. On Vercel, enable OIDC for the project so deployments receive a token. Locally, run `npx vercel link` and `npx vercel env pull`, then restart the dev server.";

export function isSandboxAuthError(error: unknown): boolean {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  return /oidc/i.test(name) || /OIDC|VERCEL_OIDC_TOKEN|Could not get credentials/i.test(message);
}
