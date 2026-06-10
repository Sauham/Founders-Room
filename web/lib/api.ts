export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"
).replace(/\/$/, "");

export function wsUrl(): string {
  return API_URL.replace(/^http/, "ws") + "/ws";
}

export const SECTIONS: [string, string][] = [
  ["problem", "Problem"],
  ["target_user", "Target User"],
  ["solution", "Solution"],
  ["market", "Market & Competitors"],
  ["business_model", "Business Model & Pricing"],
  ["gtm", "Go-to-Market"],
  ["financials", "Financial Sketch"],
  ["roadmap", "12-Month Roadmap"],
  ["risks", "Key Risks & Open Questions"],
];

export interface AgentMeta {
  name: string;
  role?: string;
  emoji?: string;
  color?: string;
}

export interface SessionSummary {
  id: string;
  concept: string;
  created?: string;
  spent_usd?: number;
}

/** One server event, live (WebSocket) or replayed (sessions JSON). */
export interface RoomEvent {
  type: string;
  [key: string]: unknown;
}

export interface ChatItem {
  kind: "round" | "system" | "bubble";
  id: number;
  // round
  round?: string;
  question?: string;
  // system
  text?: string;
  // bubble
  agent?: string;
  body?: string;
  typing?: boolean;
  decision?: boolean;
  searching?: boolean;
  searched?: boolean;
}
