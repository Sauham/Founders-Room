"""End-to-end smoke test: drives a full session over the real WebSocket.

Run the server with MOCK_LLM=1 first, then: python scripts/ws_smoke.py
Verifies the full event protocol, the @-mention interjection path, plan
publishing, completion, and session persistence. Exits non-zero on failure.
"""
from __future__ import annotations

import asyncio
import json
import sys
from collections import Counter

import websockets

URL = "ws://127.0.0.1:8000/ws"
REQUIRED = [
    "session_started", "round_start", "turn_start", "token", "turn_end",
    "round_decision", "plan_update", "whiteboard", "session_complete",
]


async def main() -> int:
    counts: Counter = Counter()
    session_id = None
    plan_sections = set()
    interjected = False
    saw_user_echo = False
    saw_routed_reply = False

    async with websockets.connect(URL, max_size=2**22) as ws:
        await ws.send(json.dumps({
            "type": "start",
            "concept": "an app that helps freelancers price their work",
        }))
        async for raw in ws:
            ev = json.loads(raw)
            counts[ev["type"]] += 1

            if ev["type"] == "session_started":
                session_id = ev["session_id"]
                assert len(ev["agents"]) == 8, f"expected 8 agents, got {len(ev['agents'])}"
            if ev["type"] == "plan_update":
                plan_sections.add(ev["section"])
            if ev["type"] == "chat" and ev["agent"] == "You":
                saw_user_echo = True
            # interject with an @mention partway through round 2
            if ev["type"] == "round_start" and ev["round"] == "Market" and not interjected:
                interjected = True
                await ws.send(json.dumps({
                    "type": "user_message",
                    "text": "@engineer what about a mobile app instead of web?",
                }))
            if (saw_user_echo and not saw_routed_reply
                    and ev["type"] == "turn_start" and ev["agent"] == "Engineer"):
                saw_routed_reply = True
            if ev["type"] == "session_complete":
                assert ev["markdown"].startswith("# Startup Plan"), "markdown missing"
                assert ev["plan"]["problem"], "plan.problem empty"
                break
            if ev["type"] == "error":
                print(f"FAIL: server error event: {ev['message']}")
                return 1

    missing = [t for t in REQUIRED if counts[t] == 0]
    print("event counts:", dict(counts))
    print("plan sections updated:", sorted(plan_sections))
    if missing:
        print(f"FAIL: missing event types: {missing}")
        return 1
    if not saw_user_echo:
        print("FAIL: user interjection never echoed")
        return 1
    if not saw_routed_reply:
        print("FAIL: @engineer mention did not route an Engineer turn")
        return 1
    if len(plan_sections) < 7:
        print(f"FAIL: only {len(plan_sections)} plan sections updated")
        return 1

    # persistence + export endpoints
    import urllib.request
    sessions = json.loads(urllib.request.urlopen(
        "http://127.0.0.1:8000/api/sessions").read())
    assert any(s["id"] == session_id for s in sessions), "session not persisted"
    md = urllib.request.urlopen(
        f"http://127.0.0.1:8000/api/sessions/{session_id}/plan.md").read().decode()
    assert md.startswith("# Startup Plan"), "plan.md export broken"
    replay = json.loads(urllib.request.urlopen(
        f"http://127.0.0.1:8000/api/sessions/{session_id}").read())
    assert len(replay["events"]) > 50, "replay events missing"

    print(f"PASS: full session OK (id={session_id}, "
          f"{len(replay['events'])} events persisted, replay + export endpoints OK)")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
