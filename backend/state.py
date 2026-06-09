"""Typed message, whiteboard, and plan schemas (PLAN.md §6: validated, not parsed)."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    agent: str
    text: str
    round: str = ""


class Verdict(BaseModel):
    """Moderator consensus/deadlock probe (Haiku)."""

    status: Literal["continue", "consensus", "deadlock"]


class GapCheck(BaseModel):
    """Editor's per-round gap flag. gap_round names a completed round to reopen."""

    gap_round: Optional[str] = None
    note: str = ""


class WhiteboardUpdate(BaseModel):
    """Scribe output: compressed decisions + open questions kept verbatim."""

    decisions: list[str]
    open_questions: list[str]


# Section keys, display titles, and which round publishes each one live.
SECTIONS: list[tuple[str, str]] = [
    ("problem", "Problem"),
    ("target_user", "Target user"),
    ("solution", "Solution"),
    ("market", "Market & competitors"),
    ("business_model", "Business model & pricing"),
    ("gtm", "Go-to-market"),
    ("financials", "Financial sketch"),
    ("roadmap", "12-month roadmap"),
    ("risks", "Key risks & open questions"),
]


class StartupPlan(BaseModel):
    problem: str = ""
    target_user: str = ""
    solution: str = ""
    market: str = ""
    business_model: str = ""
    gtm: str = ""
    financials: str = ""
    roadmap: str = ""
    risks: str = ""
    sources: list[str] = Field(default_factory=list)

    def to_markdown(self, concept: str) -> str:
        lines = [f"# Startup Plan", "", f"**Concept:** {concept}", ""]
        for key, title in SECTIONS:
            body = getattr(self, key).strip()
            if body:
                lines += [f"## {title}", "", body, ""]
        if self.sources:
            lines += ["## Sources", ""]
            lines += [f"- {u}" for u in self.sources]
            lines.append("")
        return "\n".join(lines)
