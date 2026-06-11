export interface Agent {
  name: string;
  role: string;
  monogram: string;
  color: string;
  lens: string;
  blurb: string;
}

/** Mirrors backend/agents/personas.py so the landing explains the real team. */
export const AGENTS: Agent[] = [
  {
    name: "Moderator",
    role: "CEO / Moderator",
    monogram: "MO",
    color: "#8b8bff",
    lens: "Clarity & momentum",
    blurb:
      "Runs the room. Opens each round with a sharp framing question, forces a decision when the team stalls, and breaks ties without ever doing the thinking for them.",
  },
  {
    name: "Researcher",
    role: "Research",
    monogram: "RE",
    color: "#4cc38a",
    lens: "What does the evidence say?",
    blurb:
      "Brings market sizing, competitor intel, and user-pain data, searching the web live to settle disputes. Kills unfounded claims with real numbers.",
  },
  {
    name: "Engineer",
    role: "Engineering",
    monogram: "EN",
    color: "#f5a524",
    lens: "Smallest thing shippable in 6 weeks",
    blurb:
      "Translates big ideas into buildable scope, flags overreach, and names exactly what gets cut to ship on time.",
  },
  {
    name: "Marketer",
    role: "Marketing",
    monogram: "MA",
    color: "#ff6b9d",
    lens: "Who specifically, and why today?",
    blurb:
      "Owns positioning, ICP, channels, and messaging. Forces the room to name a real person, a moment of pain, and a channel that actually reaches them.",
  },
  {
    name: "CFO",
    role: "Finance",
    monogram: "CF",
    color: "#39c4d8",
    lens: "Show me the unit economics",
    blurb:
      "Does the math out loud on pricing, margins, CAC/LTV, and runway, then rejects plans whose numbers don't survive churn and acquisition cost.",
  },
  {
    name: "Ops",
    role: "Operations",
    monogram: "OP",
    color: "#c0a8f0",
    lens: "Can we actually run this?",
    blurb:
      "Turns ambition into sequenced work with owners, and surfaces the boring blockers like contracts, compliance, and support load that others skip.",
  },
  {
    name: "Skeptic",
    role: "Skeptic / VC",
    monogram: "SK",
    color: "#ff5c5c",
    lens: "Show your work",
    blurb:
      "A sharp VC red-teaming the plan, attacking moats, math, and assumptions. Harsh on ideas, never on people, and concedes when shown real evidence.",
  },
  {
    name: "Editor",
    role: "Editor",
    monogram: "ED",
    color: "#9aa4b2",
    lens: "Coherent artifact",
    blurb:
      "Compiles the team's committed decisions into a validated, investor-ready plan and flags gaps, the decisions the room never actually made.",
  },
];
