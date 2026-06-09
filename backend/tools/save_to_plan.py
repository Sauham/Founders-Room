"""Editor publishing: per-round gap checks + final validated StartupPlan compile.

The live plan panel is fed by Moderator round decisions (orchestrator sets the
section as each round commits); the Editor adds two LLM behaviors on top:
  - gap_check (Haiku): flags a completed round the team should reopen
  - compile_plan (Opus): the final structured-output compile (PLAN.md §6)
"""
from __future__ import annotations

from backend import llm
from backend.agents import personas
from backend.state import GapCheck, StartupPlan

_EDITOR = personas.AGENTS["Editor"]


async def gap_check(room, completed: list[str], remaining: list[str]) -> GapCheck | None:
    """Flag a completed round with a load-bearing hole. Returns None when clean."""
    result = await llm.parse_structured(
        system=(
            _EDITOR["persona"]
            + " Only flag a gap when a committed decision is missing something "
            "load-bearing (no target user named, no price set, contradiction "
            "between rounds). gap_round must be EXACTLY one of the completed "
            "round names, or null. Rounds still scheduled will cover their own "
            "topics — never flag those."
        ),
        prompt=(
            f"Startup concept: {room.concept}\n\n"
            f"Whiteboard:\n{room.whiteboard_text()}\n\n"
            f"Completed rounds: {', '.join(completed)}\n"
            f"Still scheduled: {', '.join(remaining) or '(none)'}\n\n"
            "Is there a gap worth reopening a completed round for? Usually the "
            "answer is null."
        ),
        output_format=GapCheck,
        model=llm.MODEL_LIGHT,
        max_tokens=150,
        meter=room.meter,
        mock_value=GapCheck(gap_round=None),
    )
    if result and result.gap_round in completed:
        return result
    return None


async def compile_plan(room) -> StartupPlan:
    """Final compile (Opus, validated schema). Falls back to the live plan on mock."""
    decisions = "\n".join(room.decisions)
    plan = await llm.parse_structured(
        system=(
            _EDITOR["persona"]
            + " Write each section as 2-5 sentences of tight, concrete prose in "
            "markdown (inline bold ok, no headings). Use ONLY what the team "
            "decided — do not invent numbers or facts they didn't state. Fold "
            "unresolved open questions into the risks section. Leave the "
            "sources list empty; it is tracked separately."
        ),
        prompt=(
            f"Startup concept: {room.concept}\n\n"
            f"Committed decisions:\n{decisions}\n\n"
            f"Open questions:\n" + "\n".join(room.open_questions)
            + "\n\nCompile the full startup plan."
        ),
        output_format=StartupPlan,
        model=llm.MODEL_HEAVY,
        max_tokens=2000,
        meter=room.meter,
        mock_value=_mock_plan(room),
    )
    if plan is None:
        return room.plan
    plan.sources = room.plan.sources  # keep web_search citations
    return plan


def _mock_plan(room) -> StartupPlan:
    plan = room.plan.model_copy()
    if not plan.target_user:
        plan.target_user = "One named persona the team committed to in the Problem round (mock)."
    if not plan.business_model:
        plan.business_model = "$29/month subscription, kill criteria: CAC < $90, churn < 5% (mock)."
    return plan
