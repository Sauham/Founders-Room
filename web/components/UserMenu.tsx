"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { signOut } from "@/lib/auth";

interface Profile {
  name: string;
  email: string;
}

function initials(name: string, email: string): string {
  const source = name.trim() || email.trim();
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (letters || source[0] || "?").toUpperCase();
}

export default function UserMenu() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    const read = (user: { email?: string; user_metadata?: Record<string, unknown> } | null) =>
      setProfile(
        user
          ? {
              name: String(user.user_metadata?.name ?? ""),
              email: user.email ?? "",
            }
          : null
      );
    sb.auth.getSession().then(({ data }) => read(data.session?.user ?? null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) =>
      read(session?.user ?? null)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const logout = async () => {
    setBusy(true);
    await signOut();
    setOpen(false);
    setBusy(false);
    router.push("/");
  };

  if (!profile) {
    return (
      <>
        <Link className="btn btn-gold-soft nav-signin" href="/login">
          Sign in
        </Link>
        <Link className="btn btn-gold-soft" href="/signup">
          Sign up
        </Link>
      </>
    );
  }

  const label = profile.name || profile.email.split("@")[0];

  return (
    <div className="usermenu" ref={wrap}>
      <button
        className="usermenu-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="usermenu-avatar">{initials(profile.name, profile.email)}</span>
        <span className="usermenu-name">{label}</span>
        <svg className="usermenu-caret" width="10" height="6" viewBox="0 0 10 6" aria-hidden>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>

      {open && (
        <div className="usermenu-pop" role="menu">
          <div className="usermenu-head">
            <span className="usermenu-avatar lg">
              {initials(profile.name, profile.email)}
            </span>
            <div className="usermenu-id">
              <strong>{profile.name || "Founder"}</strong>
              <span>{profile.email}</span>
            </div>
          </div>
          <Link className="usermenu-item" href="/app" onClick={() => setOpen(false)}>
            Open the room
          </Link>
          <button className="usermenu-item danger" onClick={logout} disabled={busy}>
            {busy ? "Signing out…" : "Log out"}
          </button>
        </div>
      )}
    </div>
  );
}
