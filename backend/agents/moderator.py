"""Moderator behaviors: open rounds, consensus/deadlock detection, round summaries.

Speaker selection itself is table-driven (personas.ROUNDS) and lives in the
orchestrator — no LLM call needed to pick who talks next.
"""
from __future__ import annotations

from backend import llm
from backend.agents import personas
from backend.agents.base import stream_turn
from backend.state import Verdict, WhiteboardUpdate

_MOD = personas.AGENTS["Moderator"]


async def open_round(room, rnd: dict, emit) -> str:
    lead = rnd["table"]["lead"]
    prompt = (
        f"Startup concept: {room.concept}\n\n"
        f"Whiteboard so far:\n{room.whiteboard_text()}\n\n"
        f"Open the '{rnd['name']}' round. The framing question is: {rnd['question']}\n"
        f"In 1-2 sentences, set up the round in your own words and hand the floor "
        f"to {lead}. Be brisk."
    )
    return await stream_turn(
        room,
        emit,
        "Moderator",
        system=_MOD["persona"],
        prompt=prompt,
        model=llm.MODEL_DEFAULT,
        max_tokens=150,
        mock_text=f"New round: {rnd['name']}. {rnd['question']} {lead}, take the lead.",
    )


async def check_consensus(room, rnd: dict) -> str:
    """Cheap Haiku probe: continue, consensus, or deadlock. Bounds round length."""
    recent = "\n".join(f"[{m.agent}] {m.text}" for m in room.messages[-4:])
    verdict = await llm.parse_structured(
        system=(
            "You judge whether a startup team's debate round should continue. "
            "Answer 'consensus' only if the speakers clearly converged on a "
            "position; 'deadlock' if they are repeating the same disagreement "
            "without new arguments; otherwise 'continue'."
        ),
        prompt=f"Round topic: {rnd['question']}\n\nLast messages:\n{recent}",
        output_format=Verdict,
        model=llm.MODEL_LIGHT,
        max_tokens=50,
        meter=room.meter,
        mock_value=Verdict(status="continue"),
    )
    return verdict.status if verdict else "continue"


async def summarize_round(room, rnd: dict, emit) -> str:
    """Commit a decision for the round. Opus — one of the two quality-critical spots."""
    round_msgs = [m for m in room.messages if m.round == rnd["name"]]
    transcript = "\n".join(f"[{m.agent}] {m.text}" for m in round_msgs)
    prompt = (
        f"Startup concept: {room.concept}\n\n"
        f"Round '{rnd['name']}' question: {rnd['question']}\n\n"
        f"Full round discussion:\n{transcript}\n\n"
        "Close this round by committing the team to a decision. Weigh the "
        "strongest arguments (including the Skeptic's objections — note any "
        "that remain unresolved). 2-4 sentences, starting with 'Decision:'. "
        "Be concrete: names, numbers, and scope where the team provided them."
    )
    return await stream_turn(
        room,
        emit,
        "Moderator",
        system=_MOD["persona"],
        prompt=prompt,
        model=llm.MODEL_HEAVY,
        max_tokens=350,
        mock_text=(
            f"Decision: on {rnd['name']}, we commit to the focused option the room "
            f"converged on, with the Skeptic's strongest objection logged as an "
            f"open risk to validate in the next two weeks."
        ),
    )


async def scribe_update(room) -> None:
    """Scribe (Haiku): compress committed decisions, keep open questions verbatim."""
    update = await llm.parse_structured(
        system=(
            "You are the Scribe for a startup working session. Maintain the "
            "whiteboard: compress each committed decision to one tight line "
            "(keep names and numbers), and carry forward open questions "
            "verbatim, adding any new unresolved objections from the latest "
            "decision. Maximum 10 decisions and 6 open questions."
        ),
        prompt=(
            f"Current decisions:\n" + "\n".join(room.decisions)
            + "\n\nCurrent open questions:\n" + "\n".join(room.open_questions)
        ),
        output_format=WhiteboardUpdate,
        model=llm.MODEL_LIGHT,
        max_tokens=600,
        meter=room.meter,
        mock_value=WhiteboardUpdate(
            decisions=list(room.decisions),
            open_questions=["Validate willingness to pay with 10 user interviews."],
        ),
    )
    if update:
        room.decisions = update.decisions[:10]
        room.open_questions = update.open_questions[:6]
