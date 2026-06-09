"""Agent class: persona + context assembly + streamed responses."""
from __future__ import annotations

from backend import llm
from backend.agents import personas

RECENT_WINDOW = 8  # raw messages each speaker sees; older context lives on the whiteboard


async def stream_turn(
    room,
    emit,
    agent_name: str,
    *,
    system: str,
    prompt: str,
    model: str,
    max_tokens: int,
    tools: list | None = None,
    mock_text: str = "",
) -> str:
    """Stream one turn to the UI as turn_start / token / tool_use / turn_end events."""
    await emit({"type": "turn_start", "agent": agent_name})

    async def on_token(text: str):
        await emit({"type": "token", "agent": agent_name, "text": text})

    async def on_tool(tool_name: str):
        await emit({"type": "tool_use", "agent": agent_name, "tool": tool_name})

    sources: list[str] = []
    text = await llm.stream_text(
        system=system,
        prompt=prompt,
        model=model,
        max_tokens=max_tokens,
        tools=tools,
        meter=room.meter,
        on_token=on_token,
        on_tool=on_tool,
        sources_out=sources,
        mock_text=mock_text,
    )
    await emit({"type": "turn_end", "agent": agent_name, "text": text})
    for url in sources:
        if url not in room.plan.sources:
            room.plan.sources.append(url)
    return text


class Agent:
    def __init__(self, meta: dict):
        self.name: str = meta["name"]
        self.persona: str = meta["persona"]
        self.model: str = meta["model"]
        self.tools: list | None = meta["tools"]

    def build_prompt(self, room, rnd: dict, directive: str = "") -> str:
        recent = room.messages[-RECENT_WINDOW:]
        transcript = "\n".join(f"[{m.agent}] {m.text}" for m in recent) or "(no discussion yet)"
        parts = [
            f"Startup concept: {room.concept}",
            "",
            f"Whiteboard — committed decisions and open questions:\n{room.whiteboard_text()}",
            "",
            f"Current round: {rnd['name']} — {rnd['question']}",
            "",
            f"Recent discussion:\n{transcript}",
            "",
            directive
            or f"You are {self.name}. Give your take on this round now, applying your lens.",
        ]
        return "\n".join(parts)

    async def respond(self, room, rnd: dict, emit, directive: str = "") -> str:
        return await stream_turn(
            room,
            emit,
            self.name,
            system=self.persona,
            prompt=self.build_prompt(room, rnd, directive),
            model=self.model,
            max_tokens=350,
            tools=self.tools,
            mock_text=personas.mock_line(self.name, rnd["name"]),
        )
