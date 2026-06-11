"use client";

import { useState } from "react";
import { GITHUB_URL, LINKEDIN_URL } from "@/components/SocialLinks";

export default function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.message.trim()) {
      setError("Please add your name and a message.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    // No backend yet: open the user's mail client with the message prefilled.
    const subject = encodeURIComponent(`Founders Room: message from ${form.name}`);
    const body = encodeURIComponent(`${form.message}\n\nFrom: ${form.name} (${form.email})`);
    window.location.href = `mailto:hello@foundersroom.app?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <div className="contact-grid">
      <div className="contact-intro">
        <h3>Let&apos;s talk</h3>
        <p>
          Questions, feedback, or want it for your team? Drop a note and it lands
          straight in our inbox. We read everything.
        </p>
        <div className="contact-socials">
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            GitHub →
          </a>
          <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer">
            LinkedIn →
          </a>
        </div>
      </div>

      <form className="contact-form" onSubmit={submit}>
        <label className="field">
          <span>Name</span>
          <input type="text" placeholder="Your name" value={form.name} onChange={set("name")} />
        </label>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            placeholder="you@company.com"
            value={form.email}
            onChange={set("email")}
          />
        </label>
        <label className="field">
          <span>Message</span>
          <textarea
            rows={5}
            placeholder="What's on your mind?"
            value={form.message}
            onChange={set("message")}
          />
        </label>
        {error && <div className="auth-error">{error}</div>}
        {sent && <div className="auth-notice">Thanks, your message is on its way.</div>}
        <button className="btn btn-gold contact-submit" type="submit">
          Send message
        </button>
      </form>
    </div>
  );
}
