"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Credentials, signIn, signUp, validate } from "@/lib/auth";

export default function AuthCard({ mode }: { mode: "login" | "signup" }) {
  const isSignup = mode === "signup";
  const router = useRouter();
  const [form, setForm] = useState<Credentials>({ email: "", password: "", name: "" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof Credentials) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate(form, isSignup);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setNotice(null);
    setBusy(true);
    const result = isSignup ? await signUp(form) : await signIn(form);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    if (result.needsConfirmation) {
      setNotice("Account created. Check your email to confirm, then sign in.");
      return;
    }
    router.push("/");
  };

  return (
    <div className="auth-wrap">
      <Link href="/" className="auth-brand">
        <span className="mark" />
        Founders Room
      </Link>

      <form className="auth-card" onSubmit={submit}>
        <h1>{isSignup ? "Create your account" : "Welcome back"}</h1>
        <p className="auth-sub">
          {isSignup
            ? "Start pitching your concepts to the room."
            : "Sign in to pick up where the room left off."}
        </p>

        {isSignup && (
          <label className="field">
            <span>Name</span>
            <input
              type="text"
              autoComplete="name"
              placeholder="Ada Lovelace"
              value={form.name}
              onChange={set("name")}
            />
          </label>
        )}

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={form.email}
            onChange={set("email")}
          />
        </label>

        <label className="field">
          <span className="field-label-row">
            Password
            {!isSignup && (
              <Link className="field-link" href="/forgot-password">
                Forgot password?
              </Link>
            )}
          </span>
          <input
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            placeholder={isSignup ? "At least 8 characters" : "••••••••"}
            value={form.password}
            onChange={set("password")}
          />
        </label>

        {error && <div className="auth-error">{error}</div>}
        {notice && <div className="auth-notice">{notice}</div>}

        <button className="btn btn-gold auth-submit" type="submit" disabled={busy}>
          {busy ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
        </button>

        <div className="auth-switch">
          {isSignup ? (
            <>Already have an account? <Link href="/login">Sign in</Link></>
          ) : (
            <>New here? <Link href="/signup">Create an account</Link></>
          )}
        </div>
      </form>
    </div>
  );
}
