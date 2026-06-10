"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ChatPane from "@/components/ChatPane";
import PlanPane from "@/components/PlanPane";
import { SessionSummary } from "@/lib/api";
import { useSession } from "@/hooks/useSession";

const ROSTER = ["Moderator", "Engineer", "Marketer", "CFO", "Ops", "Skeptic", "Researcher"];

export default function Home() {
  const session = useSession();
  const [concept, setConcept] = useState("");
  const [pastSessions, setPastSessions] = useState<SessionSummary[]>([]);

  useEffect(() => {
    session.loadSessions().then(setPastSessions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pitch = () => {
    const c = concept.trim();
    if (c) session.start(c);
  };

  return (
    <div className="app">
      <header className="masthead">
        <div className="wordmark">
          <span className="mark" />
          Founders Room
        </div>
        <div className="statusline">{session.status}</div>
        <div className="masthead-actions">
          {pastSessions.length > 0 && (
            <select
              defaultValue=""
              onChange={(e) => e.target.value && session.replay(e.target.value)}
            >
              <option value="">Replay a session…</option>
              {pastSessions.slice(0, 20).map((s) => (
                <option key={s.id} value={s.id}>
                  {String(s.concept).slice(0, 48)}
                </option>
              ))}
            </select>
          )}
          {session.done && (
            <button className="btn btn-ghost" onClick={session.exportPlan}>
              Export plan.md
            </button>
          )}
          {!session.live && (
            <>
              <Link className="btn btn-ghost" href="/login">
                Sign in
              </Link>
              <Link className="btn btn-gold" href="/signup">
                Sign up
              </Link>
            </>
          )}
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
            Seven specialists — engineering, marketing, finance, operations, research,
            and one professional skeptic — debate your concept live and commit to a
            full startup plan, round by round.
          </p>
          <div className="hero-form">
            <input
              autoFocus
              maxLength={600}
              placeholder="Your rough concept — e.g. an app that helps freelancers price their work"
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
