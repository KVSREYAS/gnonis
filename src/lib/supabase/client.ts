import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

/** Browser client (a singleton inside @supabase/ssr), or null in local-only mode. */
export function createClient(): SupabaseClient | null {
  const env = supabaseEnv();
  return env ? createBrowserClient(env.url, env.key) : null;
}
