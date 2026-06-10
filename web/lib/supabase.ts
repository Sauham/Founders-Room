import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Lazily-created browser Supabase client. Returns null when the env vars are
 * missing so the UI can show a friendly "auth not configured" message instead
 * of crashing. Set these in web/.env.local (and in Vercel):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  client = createClient(url, anon);
  return client;
}
