"""Anthropic client wrapper: model routing, streaming, structured output, cost metering.

Model routing (PLAN.md §2/§10):
  - Sonnet 4.6  -> default for agent debate turns (fast enough to feel live)
  - Opus 4.8    -> only where synthesis quality matters: round summaries + final compile
  - Haiku 4.5   -> cheap mechanical calls: scribe, consensus checks, gap checks
"""
from __future__ import annotations

import asyncio
import os
import re
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()

MODEL_DEFAULT = "claude-sonnet-4-6"
MODEL_HEAVY = "claude-opus-4-8"
MODEL_LIGHT = "claude-haiku-4-5"

# USD per million tokens: (input, output)
PRICING = {
    MODEL_DEFAULT: (3.00, 15.00),
    MODEL_HEAVY: (5.00, 25.00),
    MODEL_LIGHT: (1.00, 5.00),
}

MOCK = os.getenv("MOCK_LLM", "0") == "1"

_client = None


def get_client():
    global _client
    if _client is None:
        import anthropic

        _client = anthropic.AsyncAnthropic()
    return _client


class BudgetExceeded(RuntimeError):
    pass


@dataclass
class CostMeter:
    """Tracks real spend from API usage objects; raises once the ceiling is hit."""

    budget_usd: float = float(os.getenv("SESSION_BUDGET_USD", "2.00"))
    spent_usd: float = 0.0
    calls: int = 0

    def add(self, model: str, usage) -> None:
        inp, out = PRICING.get(model, PRICING[MODEL_DEFAULT])
        cache_read = getattr(usage, "cache_read_input_tokens", None) or 0
        self.spent_usd += (
            usage.input_tokens * inp
            + usage.output_tokens * out
            + cache_read * inp * 0.1
        ) / 1_000_000
        self.calls += 1

    def check(self) -> None:
        if self.spent_usd >= self.budget_usd:
            raise BudgetExceeded(
                f"Session budget of ${self.budget_usd:.2f} reached "
                f"(spent ${self.spent_usd:.2f} across {self.calls} calls)."
            )


async def _stream_mock(text: str, on_token) -> str:
    for chunk in re.findall(r"\S+\s*", text):
        if on_token:
            await on_token(chunk)
        await asyncio.sleep(0.015)
    return text


async def stream_text(
    *,
    system: str,
    prompt: str,
    model: str = MODEL_DEFAULT,
    max_tokens: int = 400,
    tools: list | None = None,
    meter: CostMeter | None = None,
    on_token=None,
    on_tool=None,
    sources_out: list | None = None,
    mock_text: str = "",
) -> str:
    """Stream one assistant turn over `on_token`; returns the full text.

    Server-side web_search support: server_tool_use blocks surface via on_tool
    (so the UI can show "searching the web…"), result URLs are collected into
    sources_out, and pause_turn responses are re-sent so the server-side tool
    loop can finish.
    """
    if MOCK:
        return await _stream_mock(mock_text, on_token)

    client = get_client()
    system_blocks = [
        {"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}
    ]
    messages: list[dict] = [{"role": "user", "content": prompt}]
    parts: list[str] = []

    for _ in range(3):  # pause_turn continuations for server-side tools
        kwargs: dict = dict(
            model=model,
            max_tokens=max_tokens,
            system=system_blocks,
            messages=messages,
        )
        if tools:
            kwargs["tools"] = tools
        async with client.messages.stream(**kwargs) as stream:
            async for event in stream:
                if event.type == "content_block_start":
                    block = event.content_block
                    if block.type == "server_tool_use" and on_tool:
                        await on_tool(block.name)
                elif (
                    event.type == "content_block_delta"
                    and event.delta.type == "text_delta"
                ):
                    parts.append(event.delta.text)
                    if on_token:
                        await on_token(event.delta.text)
            final = await stream.get_final_message()

        if sources_out is not None:
            for block in final.content:
                if getattr(block, "type", "") == "web_search_tool_result":
                    results = getattr(block, "content", None) or []
                    if isinstance(results, list):
                        for r in results:
                            url = getattr(r, "url", None)
                            if url and url not in sources_out:
                                sources_out.append(url)

        if meter:
            meter.add(model, final.usage)
            meter.check()
        if final.stop_reason == "pause_turn":
            messages = messages + [{"role": "assistant", "content": final.content}]
            continue
        break
    return "".join(parts)


async def parse_structured(
    *,
    system: str,
    prompt: str,
    output_format,
    model: str = MODEL_LIGHT,
    max_tokens: int = 800,
    meter: CostMeter | None = None,
    mock_value=None,
):
    """Validated structured output via messages.parse(); returns a pydantic instance."""
    if MOCK:
        return mock_value

    client = get_client()
    resp = await client.messages.parse(
        model=model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": prompt}],
        output_format=output_format,
    )
    if meter:
        meter.add(model, resp.usage)
        meter.check()
    return resp.parsed_output
