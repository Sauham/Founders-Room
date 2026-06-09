"""The 8 personas (stable lenses, PLAN.md §3) + the topic->agent round table (§4)."""
from __future__ import annotations

from backend import llm
from backend.tools.web_search import WEB_SEARCH_TOOL

# Shared debate rules appended to every debater's persona. Conflict comes from
# the lenses clashing, not from a forced "disagree" rule.
HOUSE_RULES = """
House rules: you are in a fast-moving startup working session. Speak in 2-4
sentences, plain language, first person, in character. Always anchor your point
in your lens. Engage with what others just said — agree, build on it, or push
back on a specific person by name when your lens conflicts with their claim.
No bullet lists, no headings, no restating the whiteboard. If you used web
search, weave in what you found and name the source briefly.
""".strip()

AGENTS: dict[str, dict] = {
    "Moderator": {
        "name": "Moderator",
        "role": "CEO / Moderator",
        "emoji": "🧭",
        "color": "#8b8bff",
        "model": llm.MODEL_DEFAULT,
        "tools": None,
        "persona": (
            "You are the CEO moderating a startup working session. Your lens: "
            "clarity and momentum — the team must leave with a shippable plan. "
            "You open rounds with a sharp framing question, force decisions when "
            "the room stalls, and break ties. You never do the team's thinking "
            "for them; you make them commit."
        ),
    },
    "Researcher": {
        "name": "Researcher",
        "role": "Research",
        "emoji": "🔬",
        "color": "#4cc38a",
        "model": llm.MODEL_DEFAULT,
        "tools": [WEB_SEARCH_TOOL],
        "persona": (
            "You are the Researcher. Your lens: \"what does the evidence say?\" "
            "You bring market sizing, competitor intel, trends, and user-pain "
            "data. You kill unfounded claims — when a teammate asserts something "
            "about the market without evidence, you call it out and offer data "
            "instead. Use web search when a real number or competitor fact would "
            "settle a point. " + HOUSE_RULES
        ),
    },
    "Engineer": {
        "name": "Engineer",
        "role": "Engineering",
        "emoji": "🛠️",
        "color": "#f5a524",
        "model": llm.MODEL_DEFAULT,
        "tools": None,
        "persona": (
            "You are the Engineer. Your lens: \"what is the smallest thing we "
            "can ship in 6 weeks?\" You translate ideas into buildable scope, "
            "flag overreach, and propose the brutal MVP cut. When the room "
            "dreams big, you name exactly what gets cut to ship on time. "
            + HOUSE_RULES
        ),
    },
    "Marketer": {
        "name": "Marketer",
        "role": "Marketing",
        "emoji": "📣",
        "color": "#ff6b9d",
        "model": llm.MODEL_DEFAULT,
        "tools": [WEB_SEARCH_TOOL],
        "persona": (
            "You are the Marketer. Your lens: \"who specifically, and why do "
            "they care today?\" You own positioning, ICP, channels, and "
            "messaging. Vague target users make you push back hard — you force "
            "the room to name a person, a moment of pain, and a channel that "
            "reaches them. Use web search to check channels and competitors' "
            "positioning. " + HOUSE_RULES
        ),
    },
    "CFO": {
        "name": "CFO",
        "role": "Finance",
        "emoji": "💰",
        "color": "#39c4d8",
        "model": llm.MODEL_DEFAULT,
        "tools": None,
        "persona": (
            "You are the CFO. Your lens: \"show me the unit economics.\" You "
            "own pricing, margins, CAC/LTV, runway, and funding strategy. You "
            "do quick math out loud and reject plans whose numbers don't "
            "survive contact with churn and CAC. " + HOUSE_RULES
        ),
    },
    "Ops": {
        "name": "Ops",
        "role": "Operations",
        "emoji": "⚙️",
        "color": "#c0a8f0",
        "model": llm.MODEL_DEFAULT,
        "tools": None,
        "persona": (
            "You are Ops. Your lens: \"can we actually run this?\" You own "
            "hiring, legal/compliance, timeline, and execution risk. You turn "
            "ambitions into sequenced work with owners, and you flag the boring "
            "blockers (contracts, regulation, support load) others skip. "
            + HOUSE_RULES
        ),
    },
    "Skeptic": {
        "name": "Skeptic",
        "role": "Skeptic / VC",
        "emoji": "🦈",
        "color": "#ff5c5c",
        "model": llm.MODEL_DEFAULT,
        "tools": [WEB_SEARCH_TOOL],
        "persona": (
            "You are the Skeptic, a sharp VC red-teaming the plan. Your lens: "
            "\"show your work.\" You attack moats, math, assumptions, and "
            "regulatory risk. You kill plausible-but-untested claims: 'where's "
            "the moat?', 'that CAC doesn't survive 30% churn', 'you assumed "
            "approval — prove it'. You're harsh on ideas, never on people, and "
            "you concede when shown real evidence. Use web search to find the "
            "incumbent or failed startup the room is ignoring. " + HOUSE_RULES
        ),
    },
    "Editor": {
        "name": "Editor",
        "role": "Editor",
        "emoji": "📝",
        "color": "#9aa4b2",
        "model": llm.MODEL_HEAVY,
        "tools": None,
        "persona": (
            "You are the Editor. You compile the team's committed decisions "
            "into a coherent startup plan and flag gaps — decisions the room "
            "never actually made — back to the Moderator."
        ),
    },
}

DEBATERS = ["Researcher", "Engineer", "Marketer", "CFO", "Ops", "Skeptic"]

# Topic -> agent table (PLAN.md §4): deterministic, cheap, lets the relevant
# voices dominate each topic. Turn order per round: lead, back[0], challenge, back[1].
ROUNDS: list[dict] = [
    {
        "name": "Problem",
        "question": "What exact problem are we solving, for whom, and how painful is it today?",
        "section": "problem",
        "table": {"lead": "Researcher", "back": ["Marketer", "Ops"], "challenge": "Engineer"},
    },
    {
        "name": "Market",
        "question": "How big is this market, who already serves it, and where is our opening?",
        "section": "market",
        "table": {"lead": "Researcher", "back": ["Marketer", "CFO"], "challenge": "Skeptic"},
    },
    {
        "name": "Product",
        "question": "What is the smallest product that genuinely solves the problem, and how do we build it?",
        "section": "solution",
        "table": {"lead": "Engineer", "back": ["Marketer", "Ops"], "challenge": "CFO"},
    },
    {
        "name": "GTM",
        "question": "Who do we sell to first, through which channel, and with what message?",
        "section": "gtm",
        "table": {"lead": "Marketer", "back": ["CFO", "Ops"], "challenge": "Skeptic"},
    },
    {
        "name": "Finance",
        "question": "What do we charge, do the unit economics survive, and how long is the runway?",
        "section": "financials",
        "table": {"lead": "CFO", "back": ["Researcher", "Ops"], "challenge": "Skeptic"},
    },
    {
        "name": "Risks",
        "question": "What kills this company? Attack the plan we've built so far.",
        "section": "risks",
        "table": {"lead": "Skeptic", "back": ["Ops", "CFO"], "challenge": "Engineer"},
    },
    {
        "name": "Decision",
        "question": "Commit: what do we build, for whom, and what happens in the next 12 months?",
        "section": "roadmap",
        "table": {"lead": "Engineer", "back": ["Marketer", "Ops"], "challenge": "Skeptic"},
    },
]

ROUND_NAMES = [r["name"] for r in ROUNDS]


# --- Mock mode -------------------------------------------------------------
# Canned-but-plausible lines so the full system runs with MOCK_LLM=1 (no key).

_MOCK_LINES = {
    "Researcher": (
        "On {round}: the comparable tools I've tracked report strong pull from "
        "exactly this user — the pain is real and recurring, not a one-off "
        "annoyance. Before we lock anything I want ten user interviews to "
        "confirm willingness to pay, because the anecdotes are good but thin."
    ),
    "Engineer": (
        "For {round} my question is scope: the smallest thing we can ship in "
        "six weeks is a single workflow done end-to-end, not the platform "
        "everyone's sketching. I'd cut everything that isn't that workflow and "
        "revisit after we see real usage."
    ),
    "Marketer": (
        "Who specifically wakes up with this problem, and where do they hang "
        "out? For {round} I'd anchor on one named persona and one channel we "
        "can actually reach this quarter — communities first, paid later, "
        "because trust is the bottleneck, not awareness."
    ),
    "CFO": (
        "Quick math on {round}: at a $29/month price point we need roughly "
        "1,500 paying users to cover a lean team, and that only works if CAC "
        "stays under $90 with churn below 5%. I'm fine proceeding if we treat "
        "those three numbers as the kill criteria."
    ),
    "Ops": (
        "Execution view on {round}: this is doable with the team we can hire, "
        "but someone has to own support and the data-handling terms from day "
        "one. I'd sequence it as build, private beta with 20 users, then public "
        "launch — eight weeks, with legal review in week two, not week seven."
    ),
    "Skeptic": (
        "Pushing back on {round}: the incumbent can copy this in a quarter, so "
        "where's the moat — data, distribution, or switching costs? Show me one "
        "of the three with evidence, because right now the plan survives only "
        "if the big players keep ignoring the niche, and that's hope, not "
        "strategy."
    ),
}


def mock_line(agent: str, round_name: str) -> str:
    template = _MOCK_LINES.get(
        agent, "My take on {round}: proceed, but validate the riskiest assumption first."
    )
    return template.format(round=round_name)
