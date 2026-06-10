"""FastAPI app: WebSocket session endpoint, static frontend, replay + export APIs."""
from __future__ import annotations

import asyncio
import json
import os
import re
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

from backend.orchestrator import SESSIONS_DIR, Room, run_session
from backend.state import StartupPlan

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"

MAX_INPUT_CHARS = 600
_SID = re.compile(r"^[a-f0-9]{12}$")

app = FastAPI(title="Founders Room")

# The React frontend is served from a different origin (localhost:3000 in dev,
# Vercel in prod). Set CORS_ORIGINS on Render, e.g.
# CORS_ORIGINS=https://founders-room.vercel.app
_cors = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors.split(",") if o.strip()],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=FRONTEND / "src"), name="static")


@app.get("/")
async def index():
    return FileResponse(FRONTEND / "index.html")


@app.get("/api/sessions")
async def list_sessions():
    out = []
    if SESSIONS_DIR.exists():
        for f in sorted(SESSIONS_DIR.glob("*.json"),
                        key=lambda p: p.stat().st_mtime, reverse=True):
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
                out.append({
                    "id": f.stem,
                    "concept": data.get("concept", ""),
                    "created": data.get("created"),
                    "spent_usd": data.get("spent_usd"),
                })
            except (json.JSONDecodeError, OSError):
                continue
    return out


def _load_session(sid: str) -> dict | None:
    if not _SID.match(sid):
        return None
    path = SESSIONS_DIR / f"{sid}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


@app.get("/api/sessions/{sid}")
async def get_session(sid: str):
    data = _load_session(sid)
    if data is None:
        return JSONResponse({"error": "not found"}, status_code=404)
    return JSONResponse(data)


@app.get("/api/sessions/{sid}/plan.md")
async def get_plan_markdown(sid: str):
    data = _load_session(sid)
    if data is None:
        return PlainTextResponse("not found", status_code=404)
    plan = StartupPlan(**data.get("plan", {}))
    return PlainTextResponse(plan.to_markdown(data.get("concept", "")),
                             media_type="text/markdown")


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    room: Room | None = None
    task: asyncio.Task | None = None
    send_lock = asyncio.Lock()

    async def send(event: dict) -> None:
        async with send_lock:
            await ws.send_json(event)

    try:
        while True:
            data = await ws.receive_json()
            kind = data.get("type")
            if kind == "start" and task is None:
                concept = str(data.get("concept", "")).strip()[:MAX_INPUT_CHARS]
                if not concept:
                    await send({"type": "error", "message": "Tell the room your concept first."})
                    continue
                room = Room(concept=concept)
                task = asyncio.create_task(run_session(room, send))
            elif kind == "user_message" and room is not None:
                text = str(data.get("text", "")).strip()[:MAX_INPUT_CHARS]
                if text:
                    room.user_queue.put_nowait(text)
    except WebSocketDisconnect:
        pass
    finally:
        if task and not task.done():
            task.cancel()
