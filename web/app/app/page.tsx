"use client";

import Link from "next/link";
import { useState } from "react";
import ChatPane from "@/components/ChatPane";
import PlanPane from "@/components/PlanPane";
import UserMenu from "@/components/UserMenu";
import { useSession } from "@/hooks/useSession";

const ROSTER = ["Moderator", "Engineer", "Marketer", "CFO", "Ops", "Skeptic", "Researcher"];

export default function AppPage() {
  const session = useSession();
  const [concept, setConcept] = useState("");

  // TEMP: sign-in gate removed while the auth/email flow bug is being fixed.
  // Restore the getCurrentUser() redirect to /login?next=/app once resolved.

  const pitch = () => {
    const c = concept.trim();
    if (c) session.start(c);
  };

  return (
    <div className="app">
      <header className="masthead">
        <Link className="wordmark" href="/">
          <span className="mark" />
          Founders Room
        </Link>
        <div className="statusline">{session.status}</div>
        <div className="masthead-actions">
          {session.done && (
            <button className="btn btn-ghost" onClick={session.exportPlan}>
              Export plan.md
            </button>
          )}
          <UserMenu />
        </div>
      </header>

      {!session.live ? (
        <main className="hero">
          <div className="overline">Your AI founding team</div>
          <h1>
            Pitch the room.
            <br />
            Walk out with a <em>plan</em>.
          </h1>
          <p className="sub">
            Seven specialists across engineering, marketing, finance, operations,
            research, and one professional skeptic debate your concept live and commit
            to a full startup plan, round by round.
          </p>
          <div className="hero-form">
            <input
              autoFocus
              maxLength={600}
              placeholder="Your rough concept, e.g. an app that helps freelancers price their work"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && pitch()}
            />
            <button className="btn btn-gold" onClick={pitch}>
              Pitch the room
            </button>
          </div>
          <div className="roster">
            {ROSTER.map((r) => (
              <span key={r}>
                <i />
                {r}
              </span>
            ))}
          </div>
        </main>
      ) : (
        <main className="session">
          <ChatPane
            items={session.items}
            agentsMeta={session.agentsMeta}
            onInterject={session.interject}
            disabled={session.replaying || session.done}
          />
          <PlanPane
            plan={session.plan}
            openQuestions={session.openQuestions}
            done={session.done}
          />
        </main>
      )}
    </div>
  );
}
