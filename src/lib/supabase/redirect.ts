/** Only same-site paths are allowed after sign-in, so `?next=` can't bounce users to another origin. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (next.startsWith("/auth/") || next.startsWith("/login")) return "/";
  return next;
}
