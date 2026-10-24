export type SupabaseEnv = { url: string; key: string };

/**
 * Supabase settings, or null when they are not set. Without them the app runs in local-only mode:
 * no sign-in, progress stays in localStorage. The `process.env.NEXT_PUBLIC_*` reads must stay
 * literal so Next.js can inline them into the browser bundle.
 */
export function supabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  return url && key ? { url, key } : null;
}

export const isSupabaseConfigured = () => supabaseEnv() !== null;
