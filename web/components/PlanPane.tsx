"use client";

import { useEffect, useRef, useState } from "react";
import { SECTIONS } from "@/lib/api";

function Section({ title, body }: { title: string; body: string }) {
  const [flash, setFlash] = useState(false);
  const prev = useRef(body);

  useEffect(() => {
    if (body && body !== prev.current) {
      prev.current = body;
      setFlash(false);
      requestAnimationFrame(() => setFlash(true));
    }
  }, [body]);

  return (
    <div className={"plan-section" + (flash ? " updated" : "")}>
      <h3>{title}</h3>
      <div className={"sec-body" + (body ? "" : " empty")}>
        {body || "the room hasn't decided yet"}
      </div>
    </div>
  );
}

export default function PlanPane({
  plan,
  openQuestions,
  done,
}: {
  plan: Record<string, string>;
  openQuestions: string[];
  done: boolean;
}) {
  return (
    <aside className="plan-pane">
      <div className="pane-title">
        Startup Plan {!done && <span className="live-dot" title="updates live" />}
      </div>
      {SECTIONS.map(([key, title]) => (
        <Section key={key} title={title} body={plan[key] ?? ""} />
      ))}
      {openQuestions.length > 0 && (
        <div className="open-questions">
          <h3>Open Questions</h3>
          <ul>
            {openQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
