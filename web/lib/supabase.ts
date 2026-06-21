import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Lazily-created browser Supabase client. Returns null when the env vars are
 * missing so the UI can show a friendly "auth not configured" message instead
 * of crashing. Set these in web/.env.local (and in Vercel):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
let client: SupabaseClient | null = null;

// These two values are safe to expose in browser code. Supabase's anon key is
// intended for public clients; the secret service_role key stays backend-only.
const PUBLIC_SUPABASE_URL = "https://okaysbkhtqaiydtbzznp.supabase.co";
const PUBLIC_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rYXlzYmtodHFhaXlkdGJ6em5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExOTkyMTcsImV4cCI6MjA5Njc3NTIxN30.5Flf0GOrVszeXZ_Wn9q0WAZZtcgEd9Zrd5uLfYS9Gc8";

export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  client = createClient(url, anon);
  return client;
}
