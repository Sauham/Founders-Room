"use client";

import Link from "next/link";
import { useState } from "react";
import { resetPassword } from "@/lib/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await resetPassword(email);
    setBusy(false);
    if (result.ok) {
      setSent(true);
    } else {
      setError(result.error ?? "Something went wrong.");
    }
  };

  return (
    <div className="auth-wrap">
      <Link href="/" className="auth-brand">
        <span className="mark" />
        Founders Room
      </Link>

      <form className="auth-card" onSubmit={submit}>
        <h1>Reset your password</h1>
        <p className="auth-sub">
          Enter the email on your account and we&apos;ll send you a secure link to set
          a new password.
        </p>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        {error && <div className="auth-error">{error}</div>}
        {sent && (
          <div className="auth-notice">
            If an account exists for that email, a reset link is on its way. Check your
            inbox.
          </div>
        )}

        <button className="btn btn-gold auth-submit" type="submit" disabled={busy || sent}>
          {busy ? "Sending…" : "Send reset link"}
        </button>

        <div className="auth-switch">
          Remembered it? <Link href="/login">Back to sign in</Link>
        </div>
      </form>
    </div>
  );
}
