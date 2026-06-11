"use client";

import Image from "next/image";
import Link from "next/link";
import LandingNav from "@/components/LandingNav";
import Reveal from "@/components/Reveal";
import SocialLinks from "@/components/SocialLinks";
import ContactForm from "@/components/ContactForm";
import { AGENTS } from "@/lib/agents";

const STEPS = [
  {
    n: "01",
    title: "Pitch a rough concept",
    body: "One sentence is enough. No deck, no formatting, just the idea you can't stop thinking about.",
  },
  {
    n: "02",
    title: "Watch the room debate",
    body: "Eight specialists argue it out live across seven structured rounds, streaming their reasoning token by token, searching the web, and pushing back on each other by name.",
  },
  {
    n: "03",
    title: "Steer it any time",
    body: "Interject mid-debate. Use @engineer or @cfo to put a question straight to one specialist. It's your room.",
  },
  {
    n: "04",
    title: "Walk out with a plan",
    body: "The Editor compiles every committed decision into a validated, investor-ready startup plan that you can export as Markdown.",
  },
];

const PRICING = [
  {
    name: "Explorer",
    price: "$0",
    cadence: "forever",
    blurb: "Kick the tires on the full experience.",
    features: ["3 sessions / month", "All 8 specialists", "Live debate + plan export", "Community support"],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Founder",
    price: "$29",
    cadence: "/ month",
    blurb: "For people actually shipping something.",
    features: [
      "Unlimited sessions",
      "Web-search citations",
      "Session history & replay",
      "Priority model routing",
      "Email support",
    ],
    cta: "Go Founder",
    featured: true,
  },
  {
    name: "Team",
    price: "Let's talk",
    cadence: "",
    blurb: "Shared rooms for the whole company.",
    features: ["Everything in Founder", "Shared workspaces", "Custom personas", "SSO & admin", "Dedicated support"],
    cta: "Contact us",
    featured: false,
  },
];

export default function Landing() {
  return (
    <div id="top" className="landing">
      <LandingNav />

      {/* ---------- hero ---------- */}
      <header className="lhero">
        <div className="lhero-bg" />
        <div className="lhero-inner">
          <Reveal>
            <div className="overline">Your AI founding team</div>
          </Reveal>
          <Reveal delay={80}>
            <h1>
              Pitch the room.
              <br />
              Walk out with a <em>plan</em>.
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="lhero-sub">
              Eight specialist AI agents spanning engineering, marketing, finance,
              operations, research, a CEO, an editor, and one professional skeptic
              debate your startup idea live and hand you a validated plan.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="lhero-cta">
              <Link className="btn btn-gold btn-lg" href="/app">
                Try it now, free
              </Link>
              <a className="btn btn-ghost btn-lg" href="#how">
                See how it works
              </a>
            </div>
          </Reveal>
          <Reveal delay={320}>
            <SocialLinks />
          </Reveal>
        </div>
      </header>

      {/* ---------- about ---------- */}
      <section id="about" className="section">
        <div className="section-split">
          <Reveal className="split-text">
            <div className="kicker">About</div>
            <h2>Most AI tools hide the thinking. This one shows the whole argument.</h2>
            <p>
              Founders Room isn&apos;t a chatbot that spits out a generic business plan.
              It&apos;s a room full of opinionated specialists who <strong>disagree</strong>:
              a Researcher who kills unfounded claims with data, a CFO who refuses to
              let the math slide, and a VC-grade Skeptic whose entire job is to find
              what breaks your company.
            </p>
            <p>
              The conflict is the point. Real decisions come from real tension, and the
              final plan is stronger because every claim survived a fight. You see all
              of it happen, and you can jump in whenever you want.
            </p>
          </Reveal>
          <Reveal className="split-media" delay={120}>
            <Image
              src="/boardroom.png"
              alt="An AI founding team debating around a table"
              width={1024}
              height={683}
              className="framed"
              priority
            />
          </Reveal>
        </div>
      </section>

      {/* ---------- how it works ---------- */}
      <section id="how" className="section section-alt">
        <Reveal>
          <div className="section-head">
            <div className="kicker">How it works</div>
            <h2>From a half-formed idea to a real plan in one sitting</h2>
          </div>
        </Reveal>
        <div className="steps">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 90} className="step">
              <div className="step-n">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- the team ---------- */}
      <section id="team" className="section">
        <Reveal>
          <div className="section-head">
            <div className="kicker">The team</div>
            <h2>Eight specialists, eight stubborn points of view</h2>
            <p className="section-lead">
              Each agent carries one lens it never stops applying. Conflict emerges
              where those lenses collide, not because anyone is told to disagree.
            </p>
          </div>
        </Reveal>
        <div className="agent-grid">
          {AGENTS.map((a, i) => (
            <Reveal key={a.name} delay={(i % 4) * 70} className="agent-card">
              <div className="agent-top">
                <span className="agent-mono" style={{ borderColor: a.color, color: a.color }}>
                  {a.monogram}
                </span>
                <div>
                  <div className="agent-name">{a.name}</div>
                  <div className="agent-role">{a.role}</div>
                </div>
              </div>
              <div className="agent-lens" style={{ color: a.color }}>
                “{a.lens}”
              </div>
              <p className="agent-blurb">{a.blurb}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- pricing ---------- */}
      <section id="pricing" className="section section-alt">
        <Reveal>
          <div className="section-head">
            <div className="kicker">Pricing</div>
            <h2>Start free. Upgrade when the room earns it.</h2>
          </div>
        </Reveal>
        <div className="price-grid">
          {PRICING.map((p, i) => (
            <Reveal key={p.name} delay={i * 90} className={`price-card${p.featured ? " featured" : ""}`}>
              {p.featured && <div className="price-badge">Most popular</div>}
              <div className="price-name">{p.name}</div>
              <div className="price-amount">
                {p.price} <span>{p.cadence}</span>
              </div>
              <p className="price-blurb">{p.blurb}</p>
              <ul className="price-features">
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <Link
                className={`btn ${p.featured ? "btn-gold" : "btn-ghost"} price-cta`}
                href={p.cta === "Contact us" ? "#contact" : "/app"}
              >
                {p.cta}
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- contact ---------- */}
      <section id="contact" className="section">
        <Reveal>
          <div className="section-head">
            <div className="kicker">Contact</div>
            <h2>Get in touch</h2>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <ContactForm />
        </Reveal>
      </section>

      {/* ---------- footer ---------- */}
      <footer className="lfooter">
        <div className="lfooter-inner">
          <a className="nav-brand" href="#top">
            <span className="mark" />
            Founders Room
          </a>
          <SocialLinks size={20} />
          <div className="lfooter-copy">
            © {new Date().getFullYear()} Founders Room. Built for founders who argue back.
          </div>
        </div>
      </footer>
    </div>
  );
}
