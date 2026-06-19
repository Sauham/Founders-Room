"use client";

import { useCallback, useRef, useState } from "react";
import {
  API_URL,
  AgentMeta,
  ChatItem,
  RoomEvent,
  SessionSummary,
  wsUrl,
} from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

interface SessionState {
  items: ChatItem[];
  plan: Record<string, string>;
  openQuestions: string[];
  status: string;
  live: boolean;
  replaying: boolean;
  done: boolean;
  spentUsd: number | null;
}

const INITIAL: SessionState = {
  items: [],
  plan: {},
  openQuestions: [],
  status: "",
  live: false,
  replaying: false,
  done: false,
  spentUsd: null,
};

let nextId = 1;

export function useSession() {
  const [state, setState] = useState<SessionState>(INITIAL);
  const agentsMeta = useRef<Record<string, AgentMeta>>({});
  const ws = useRef<WebSocket | null>(null);
  const finalMarkdown = useRef("");

  const handle = useCallback((ev: RoomEvent) => {
    setState((s) => {
      switch (ev.type) {
        case "session_started": {
          for (const a of (ev.agents as AgentMeta[]) ?? []) {
            agentsMeta.current[a.name] = a;
          }
          return { ...s, status: `The room is live: “${ev.concept}”` };
        }
        case "round_start":
          return {
            ...s,
            items: [
              ...s.items,
              {
                kind: "round",
                id: nextId++,
                round: String(ev.round),
                question: String(ev.question),
              },
            ],
          };
        case "turn_start":
          return {
            ...s,
            items: [
              ...s.items,
              {
                kind: "bubble",
                id: nextId++,
                agent: String(ev.agent),
                body: "",
                typing: true,
              },
            ],
          };
        case "token": {
          const items = [...s.items];
          for (let i = items.length - 1; i >= 0; i--) {
            const it = items[i];
            if (it.kind === "bubble" && it.agent === ev.agent && it.typing) {
              items[i] = { ...it, body: (it.body ?? "") + String(ev.text) };
              break;
            }
          }
          return { ...s, items };
        }
        case "tool_use": {
          const items = [...s.items];
          for (let i = items.length - 1; i >= 0; i--) {
            const it = items[i];
            if (it.kind === "bubble" && it.agent === ev.agent && it.typing) {
              items[i] = { ...it, searching: true };
              break;
            }
          }
          return { ...s, items };
        }
        case "turn_end": {
          const items = [...s.items];
          for (let i = items.length - 1; i >= 0; i--) {
            const it = items[i];
            if (it.kind === "bubble" && it.agent === ev.agent && it.typing) {
              items[i] = {
                ...it,
                typing: false,
                body: String(ev.text),
                searching: false,
                searched: it.searching,
              };
              break;
            }
          }
          return { ...s, items };
        }
        case "chat":
          return {
            ...s,
            items: [
              ...s.items,
              {
                kind: "bubble",
                id: nextId++,
                agent: String(ev.agent),
                body: String(ev.text),
              },
            ],
          };
        case "round_decision": {
          const items = [...s.items];
          for (let i = items.length - 1; i >= 0; i--) {
            const it = items[i];
            if (it.kind === "bubble" && it.agent === "Moderator") {
              items[i] = { ...it, decision: true };
              break;
            }
          }
          return { ...s, items };
        }
        case "plan_update":
          return {
            ...s,
            plan: { ...s.plan, [String(ev.section)]: String(ev.content) },
          };
        case "whiteboard":
          return { ...s, openQuestions: (ev.open_questions as string[]) ?? [] };
        case "status":
          return {
            ...s,
            status: String(ev.message),
            items: [
              ...s.items,
              { kind: "system", id: nextId++, text: String(ev.message) },
            ],
          };
        case "session_complete": {
          finalMarkdown.current = String(ev.markdown ?? "");
          const spent = ev.spent_usd != null ? Number(ev.spent_usd) : null;
          return {
            ...s,
            done: true,
            spentUsd: spent,
            status: "The plan is complete.",
            items: [
              ...s.items,
              {
                kind: "system",
                id: nextId++,
                text: "The team is done. The full plan is in the panel.",
              },
            ],
          };
        }
        case "error":
          return {
            ...s,
            status: `Error: ${ev.message}`,
            items: [
              ...s.items,
              { kind: "system", id: nextId++, text: `⚠ ${ev.message}` },
            ],
          };
        default:
          return s;
      }
    });
  }, []);

  const start = useCallback(
    async (concept: string) => {
      setState({ ...INITIAL, live: true, status: "Convening the room…" });
      const token = await getAccessToken();
      const sock = new WebSocket(wsUrl());
      ws.current = sock;
      sock.onopen = () =>
        sock.send(JSON.stringify({ type: "start", concept, token }));
      sock.onmessage = (e) => handle(JSON.parse(e.data));
      sock.onclose = () =>
        setState((s) =>
          s.done ? s : { ...s, status: "Connection closed." }
        );
      sock.onerror = () =>
        setState((s) => ({
          ...s,
          status: "Connection error. Is the backend running?",
        }));
    },
    [handle]
  );

  const interject = useCallback((text: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: "user_message", text }));
    }
  }, []);

  const replay = useCallback(
    async (sid: string) => {
      const res = await fetch(`${API_URL}/api/sessions/${sid}`);
      const data = await res.json();
      setState({ ...INITIAL, live: true, replaying: true, status: "Replaying session…" });
      for (const ev of data.events ?? []) {
        handle(ev as RoomEvent);
        await new Promise((r) =>
          setTimeout(r, ev.type === "token" ? 8 : ev.type === "turn_start" ? 150 : 350)
        );
      }
      setState((s) => ({ ...s, replaying: false, status: "Replay finished." }));
    },
    [handle]
  );

  const exportPlan = useCallback(() => {
    const blob = new Blob([finalMarkdown.current], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "startup-plan.md";
    a.click();
    URL.revokeObjectURL(a.href);
  }, []);

  const loadSessions = useCallback(async (): Promise<SessionSummary[]> => {
    try {
      const res = await fetch(`${API_URL}/api/sessions`);
      return await res.json();
    } catch {
      return [];
    }
  }, []);

  return {
    ...state,
    agentsMeta: agentsMeta.current,
    start,
    interject,
    replay,
    exportPlan,
    loadSessions,
  };
}
