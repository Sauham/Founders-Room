"use client";

import { useEffect, useRef, useState } from "react";
import { AgentMeta, ChatItem } from "@/lib/api";

function initials(name: string): string {
  if (name === "You") return "YOU";
  return name.slice(0, 2).toUpperCase();
}

function Bubble({ item, meta }: { item: ChatItem; meta?: AgentMeta }) {
  const isYou = item.agent === "You";
  const cls =
    "bubble" +
    (isYou ? " you" : "") +
    (item.typing ? " typing" : "") +
    (item.decision ? " decision" : "");
  return (
    <div className={cls}>
      <div
        className="avatar"
        style={meta?.color ? { borderColor: meta.color, color: meta.color } : undefined}
      >
        {initials(item.agent ?? "")}
      </div>
      <div className="content">
        <div className="who">
          <span style={meta?.color ? { color: meta.color } : undefined}>
            {item.agent}
          </span>
          <span className="role">{isYou ? "Founder" : meta?.role ?? ""}</span>
        </div>
        <div className="body">
          {item.decision && <span className="decision-tag">Committed decision</span>}
          {item.decision && <br />}
          {item.body}
        </div>
        {(item.searching || item.searched) && (
          <span className="tool-chip">
            {item.searching ? "Searching the web…" : "Searched the web"}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ChatPane({
  items,
  agentsMeta,
  onInterject,
  disabled,
}: {
  items: ChatItem[];
  agentsMeta: Record<string, AgentMeta>;
  onInterject: (text: string) => void;
  disabled: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    onInterject(text);
    setDraft("");
  };

  return (
    <section className="chat-pane">
      <div className="chat-scroll" ref={scrollRef}>
        {items.map((item) => {
          if (item.kind === "round")
            return (
              <div className="round-header" key={item.id}>
                <b>Round — {item.round}</b>
                <div>{item.question}</div>
              </div>
            );
          if (item.kind === "system")
            return (
              <div className="system-line" key={item.id}>
                {item.text}
              </div>
            );
          return (
            <Bubble
              key={item.id}
              item={item}
              meta={item.agent ? agentsMeta[item.agent] : undefined}
            />
          );
        })}
      </div>
      <div className="interject-bar">
        <input
          value={draft}
          maxLength={600}
          disabled={disabled}
          placeholder="Interject any time — use @engineer, @cfo… to address someone"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button className="btn btn-gold" onClick={send} disabled={disabled}>
          Send
        </button>
      </div>
    </section>
  );
}
