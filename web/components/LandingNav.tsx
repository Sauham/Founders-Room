"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const LINKS = [
  ["Home", "#top"],
  ["About", "#about"],
  ["How it works", "#how"],
  ["The team", "#team"],
  ["Pricing", "#pricing"],
  ["Contact", "#contact"],
];

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`nav${scrolled ? " nav-scrolled" : ""}`}>
      <a className="nav-brand" href="#top">
        <span className="mark" />
        Founders Room
      </a>

      <div className={`nav-links${open ? " nav-open" : ""}`}>
        {LINKS.map(([label, href]) => (
          <a key={href} href={href} onClick={() => setOpen(false)}>
            {label}
          </a>
        ))}
      </div>

      <div className="nav-actions">
        {scrolled && (
          <Link className="btn btn-gold nav-trynow" href="/app">
            Try now
          </Link>
        )}
        <Link className="btn btn-gold-soft nav-signin" href="/login">
          Sign in
        </Link>
        <Link className="btn btn-gold-soft" href="/signup">
          Sign up
        </Link>
        <button
          className="nav-burger"
          aria-label="Toggle menu"
          onClick={() => setOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </nav>
  );
}
