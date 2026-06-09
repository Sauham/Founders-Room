"""The Room + round-based, table-driven orchestration loop (PLAN.md §4)."""
from __future__ import annotations

import asyncio
import json
import os
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path

from backend import llm
from backend.agents import moderator, personas
from backend.agents.base import Agent
from backend.state import ChatMessage, StartupPlan
from backend.tools import save_to_plan

MAX_TURNS_PER_ROUND = int(os.getenv("MAX_TURNS_PER_ROUND", "4"))
GLOBAL_TURN_CAP = int(os.getenv("GLOBAL_TURN_CAP", "40"))

SESSIONS_DIR = Path(__file__).resolve().parent.parent / "sessions"


@dataclass
class Room:
    concept: str
    session_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    messages: list[ChatMessage] = field(default_factory=list)
    decisions: list[str] = field(default_factory=list)
    open_questions: list[str] = field(default_factory=list)
    plan: StartupPlan = field(default_factory=StartupPlan)
    events: list[dict] = field(default_factory=list)
    user_queue: asyncio.Queue = field(default_factory=asyncio.Queue)
    meter: llm.CostMeter = field(default_factory=llm.CostMeter)
    turns_taken: int = 0
    created: float = field(default_factory=time.time)

    def whiteboard_text(self) -> str:
        lines = []
        if self.decisions:
            lines.append("Decisions:")
            lines += [f"- {d}" for d in self.decisions]
        if self.open_questions:
            lines.append("Open questions:")
            lines += [f"- {q}" for q in self.open_questions]
        return "\n".join(lines) or "(nothing committed yet)"

    def record(self, agent: str, text: str, round_name: str = "") -> None:
        self.messages.append(ChatMessage(agent=agent, text=text, round=round_name))


def save_session(room: Room) -> None:
    SESSIONS_DIR.mkdir(exist_ok=True)
    data = {
        "concept": room.concept,
        "created": room.created,
        "spent_usd": round(room.meter.spent_usd, 4),
        "plan": room.plan.model_dump(),
        "events": room.events,
    }
    path = SESSIONS_DIR / f"{room.session_id}.json"
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


async def run_session(room: Room, send) -> None:
    async def emit(event: dict) -> None:
        room.events.append(event)
        try:
            await send(event)
        except Exception:
            pass  # client gone — keep running so the transcript still gets saved

    agents = {name: Agent(personas.AGENTS[name]) for name in personas.DEBATERS}

    try:
        await emit({
            "type": "session_started",
            "session_id": room.session_id,
            "concept": room.concept,
            "agents": [
                {"name": a["name"], "role": a["role"], "emoji": a["emoji"], "color": a["color"]}
                for a in personas.AGENTS.values()
            ],
        })

        queue = deque(personas.ROUNDS)
        completed: list[dict] = []
        requeued = False  # one Editor loop-back per session (cost bound)

        try:
            while queue:
                if room.turns_taken >= GLOBAL_TURN_CAP:
                    await emit({"type": "status",
                                "message": "Global turn cap reached — moving straight to the final plan."})
                    break
                rnd = queue.popleft()
                await _run_round(room, rnd, agents, emit)
                if rnd not in completed:
                    completed.append(rnd)

                if not requeued and queue:
                    gap = await save_to_plan.gap_check(
                        room, [r["name"] for r in completed], [r["name"] for r in queue]
                    )
                    if gap:
                        target = next(r for r in completed if r["name"] == gap.gap_round)
                        requeued = True
                        queue.appendleft(target)
                        note = gap.note or "a committed decision is missing something load-bearing"
                        msg = f"Reading the plan back, we have a gap: {note} Reopening {gap.gap_round}."
                        room.record("Editor", msg)
                        await emit({"type": "chat", "agent": "Editor", "text": msg})
        except llm.BudgetExceeded as e:
            await emit({"type": "status", "message": f"💸 {e} Compiling the plan from what was decided."})

        # Final compile (Opus, validated StartupPlan)
        await emit({"type": "status", "message": "Editor is compiling the final plan…"})
        try:
            room.plan = await save_to_plan.compile_plan(room)
        except llm.BudgetExceeded:
            pass  # budget died mid-compile — ship the live-built plan as-is
        for key in type(room.plan).model_fields:
            if key == "sources":
                continue
            content = getattr(room.plan, key)
            if content:
                await emit({"type": "plan_update", "section": key, "content": content})

        await emit({
            "type": "session_complete",
            "session_id": room.session_id,
            "plan": room.plan.model_dump(),
            "markdown": room.plan.to_markdown(room.concept),
            "spent_usd": round(room.meter.spent_usd, 4),
        })
    except asyncio.CancelledError:
        raise
    except Exception as e:  # surface anything unexpected to the UI, then persist
        await emit({"type": "error", "message": f"{type(e).__name__}: {e}"})
    finally:
        save_session(room)


async def _run_round(room: Room, rnd: dict, agents: dict[str, Agent], emit) -> None:
    name = rnd["name"]
    await emit({"type": "round_start", "round": name, "question": rnd["question"]})

    open_text = await moderator.open_round(room, rnd, emit)
    room.record("Moderator", open_text, name)

    table = rnd["table"]
    order = [table["lead"], table["back"][0], table["challenge"], *table["back"][1:]]
    order = order[:MAX_TURNS_PER_ROUND]

    i = 0
    while i < len(order) and room.turns_taken < GLOBAL_TURN_CAP:
        override = await _drain_user_queue(room, emit, name)
        speaker = override or order[i]
        if override is None:
            i += 1
        directive = (
            f"You are {speaker}. The user (the founder) just spoke — respond to "
            f"them directly, then tie it back to this round."
            if override else ""
        )
        text = await agents[speaker].respond(room, rnd, emit, directive=directive)
        room.record(speaker, text, name)
        room.turns_taken += 1

        # Probe for consensus/deadlock once most of the table has spoken
        if 3 <= i < len(order):
            verdict = await moderator.check_consensus(room, rnd)
            if verdict != "continue":
                await emit({"type": "status",
                            "message": f"Moderator detected {verdict} — closing the round."})
                break

    await _drain_user_queue(room, emit, name, respond=False)

    decision = await moderator.summarize_round(room, rnd, emit)
    room.record("Moderator", decision, name)
    room.decisions.append(f"{name}: {decision}")
    await emit({"type": "round_decision", "round": name, "decision": decision})

    # Editor publishes the section live; the panel fills in as decisions land
    setattr(room.plan, rnd["section"], decision)
    await emit({"type": "plan_update", "section": rnd["section"], "content": decision})

    await moderator.scribe_update(room)
    await emit({"type": "whiteboard",
                "decisions": room.decisions, "open_questions": room.open_questions})
    save_session(room)  # checkpoint after every round


async def _drain_user_queue(room: Room, emit, round_name: str, respond: bool = True) -> str | None:
    """Pull pending founder interjections into the room. Returns an agent name to
    route the next turn to when the last message @-mentions one (PLAN.md §4)."""
    override = None
    while not room.user_queue.empty():
        text = room.user_queue.get_nowait()
        room.record("You", text, round_name)
        await emit({"type": "chat", "agent": "You", "text": text})
        if respond:
            for agent_name in personas.DEBATERS:
                if f"@{agent_name.lower()}" in text.lower():
                    override = agent_name
                    break
    return override
