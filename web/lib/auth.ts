import { getSupabase } from "@/lib/supabase";

/**
 * Auth client backed by Supabase Auth (hosted Postgres + password hashing,
 * sessions, and JWTs handled for us). The UI only calls signIn / signUp and
 * stays unaware of the backend. Swap getSupabase() for another provider here
 * without touching the pages.
 */

export interface AuthResult {
  ok: boolean;
  error?: string;
  /** Signup succeeded but the user must confirm their email before signing in. */
  needsConfirmation?: boolean;
}

export interface Credentials {
  email: string;
  password: string;
  name?: string;
}

const NOT_CONFIGURED =
  "Auth isn't configured yet. Add NEXT_PUBLIC_SUPABASE_URL and " +
  "NEXT_PUBLIC_SUPABASE_ANON_KEY to web/.env.local.";

export async function signIn(creds: Credentials): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: NOT_CONFIGURED };
  const { error } = await sb.auth.signInWithPassword({
    email: creds.email,
    password: creds.password,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signUp(creds: Credentials): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: NOT_CONFIGURED };
  const { data, error } = await sb.auth.signUp({
    email: creds.email,
    password: creds.password,
    options: { data: { name: creds.name ?? "" } },
  });
  if (error) return { ok: false, error: error.message };
  // With email confirmation enabled (Supabase default), no session is returned
  // until the user clicks the link in their inbox.
  if (!data.session) return { ok: true, needsConfirmation: true };
  return { ok: true };
}

export async function signOut(): Promise<void> {
  await getSupabase()?.auth.signOut();
}

export async function resetPassword(email: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: NOT_CONFIGURED };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/login` : undefined;
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Minimal client-side validation shared by both forms. */
export function validate(creds: Credentials, isSignup: boolean): string | null {
  if (isSignup && !creds.name?.trim()) return "Please enter your name.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(creds.email)) return "Enter a valid email address.";
  if (creds.password.length < 8) return "Password must be at least 8 characters.";
  return null;
}
