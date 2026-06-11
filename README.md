# Founders Room — AI Startup Team Simulator

> Pitch a rough concept. Eight specialized AI agents argue about it live in
> one room — Researcher, Engineer, Marketer, CFO, Ops, a red-teaming Skeptic,
> a CEO moderator, and an Editor — for seven structured rounds, while the
> Editor compiles a validated startup plan that fills in on screen as they
> argue. You can interject at any time.


---

## Why this exists

Most "AI does X for you" tools hide the reasoning. **Founders Room shows the
team thinking.** You watch a Researcher push back on a Marketer, a Skeptic
dismantle a moat claim, a CFO demand the math — and you can interrupt them at
any time.

The output isn't a free-form essay parsed after the fact. The Editor emits a
**pydantic-validated `StartupPlan`** schema; Markdown is rendered *from* the
validated object. Every claim sourced from the web carries a citation.

## Highlights

- **8 stable-lens agents.** Researcher, Engineer, Marketer, CFO, Ops, Skeptic
  (VC-style red-teamer), CEO/Moderator, Editor. They argue because their
  priors collide, not because they're prompted to disagree.
- **7-round structured debate.** Problem → Market → Product → GTM → Finance →
  Risks → Decision. **Table-driven** turn order — no LLM "who speaks next?"
  call, so debate is cheap and predictable.
- **Live token streaming** to the browser over a single WebSocket. You watch
  each agent type their reply. Web-search calls render as
  `🔎 Researcher is searching the web…` chips so server-tool stalls read as
  texture, not lag.
- **Editor publishes continuously.** The right pane fills section-by-section
  as each round closes, with a green flash on commit. Open questions are
  tracked separately.
- **Founder interjections.** Type any time mid-debate; use `@engineer`,
  `@cfo`, etc. to route your question to a specific agent's next turn.
- **Built-in `web_search`.** Researcher, Marketer, and Skeptic cite real
  sources via Anthropic's native `web_search_20260209` server tool — no
  hand-rolled HTTP, native citations.
- **Hard cost ceiling.** A `CostMeter` tracks real spend per session and
  stops at `SESSION_BUDGET_USD` (default $2). Projected cost is **~$0.60 per
  session**.
- **Mock mode.** `MOCK_LLM=1` runs the entire real pipeline (orchestrator,
  rounds, whiteboard, plan, replay) on canned debate. Zero API calls.
- **Session replay.** Every session is checkpointed to JSON; play back any
  past session from the header dropdown.
- **Markdown export** of the final plan, straight from the validated schema.

## What it looks like

- **Left pane — the room.** Color-coded agents stream out their arguments
  token by token, search the web mid-sentence, push back on each other by
  name, and commit decisions round by round.
- **Right pane — the plan.** Nine sections (Problem · Target user · Solution
  · Market · Business model · GTM · Financials · Roadmap · Risks) fill in
  live as each round closes. Open questions the room couldn't settle are
  tracked separately.
- **You're the founder.** Interject any time; use `@engineer`, `@cfo`, etc.
  to route your question to a specific agent.
- **At the end**, the Editor compiles a validated plan, exportable as
  Markdown. Every past session can be replayed from the header dropdown.

> _Drop a screenshot or GIF of the running app here (e.g. `docs/demo.gif`)
> to make the README pop on GitHub._

## Quick start

### Prerequisites

- Python **3.11+** (3.12 recommended)
- An Anthropic API key — get one at <https://platform.claude.com>

### Run a real session

```bash
git clone https://github.com/<you>/founders-room.git
cd founders-room

python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt

cp .env.example .env              # then put your ANTHROPIC_API_KEY in .env

.venv/bin/uvicorn backend.main:app --port 8000
```

Open <http://127.0.0.1:8000>, type a concept, hit **Pitch the room →**.
This serves the zero-build vanilla `frontend/` straight from FastAPI — the
quickest way to run locally.

### Run the React frontend (`web/`)

There are **two frontends** (see [Two frontends](#two-frontends)). To run the
Next.js client against the same backend, keep the backend running as above,
then in a second terminal:

```bash
cd web
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL defaults to 127.0.0.1:8000
npm install
npm run dev
```

Open <http://localhost:3000>. The **marketing landing page** lives at `/`
(hero, About, How it works, the team, pricing, contact) and the **live product**
is at `/app`; the "Try now" buttons link there. Auth pages are at `/login`,
`/signup`, and `/forgot-password`. The React app talks to the FastAPI backend
over the URL in `NEXT_PUBLIC_API_URL`, so CORS must allow `localhost:3000` (it
does by default, see `CORS_ORIGINS`).

> **Tip:** when running a live session, start the backend **without**
> `--reload`. The auto-reloader restarts the server on any file save, which
> drops the active WebSocket and kills the in-progress debate. Use `--reload`
> only while editing backend code.

### Run the free mock-mode demo (no API key)

```bash
MOCK_LLM=1 .venv/bin/uvicorn backend.main:app --port 8000
```

Mock mode streams canned-but-plausible debate through the **full real
pipeline** (orchestrator, rounds, whiteboard, plan, replay) with zero API
calls. Useful for trying the UI, running CI, or hacking on the orchestrator
without burning credits.

## Two frontends

The repo ships **two** clients against the same FastAPI backend — pick based on
what you're doing:

| | `frontend/` | `web/` |
|---|---|---|
| Stack | vanilla HTML/CSS/JS | Next.js (React + TypeScript) |
| Build step | none | `npm run build` |
| How it runs | served by FastAPI at `:8000` | own dev/prod server at `:3000` |
| Origin vs API | same-origin | cross-origin (needs `CORS_ORIGINS`) |
| Best for | quick local runs, CI, zero toolchain | the deployable product (Vercel) |

Both speak the identical WebSocket protocol, so they're interchangeable at
runtime. `frontend/` is the fastest way to poke at the system locally; `web/`
is what you deploy.

## Deploying (Vercel + Render)

The intended split is **frontend on Vercel, backend on Render**:

- **Backend → Render.** Deploy the Python app with
  `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`. Set env vars in
  Render's dashboard: `ANTHROPIC_API_KEY`, `SESSION_BUDGET_USD`, the turn caps,
  and `CORS_ORIGINS=https://<your-app>.vercel.app`. The local `.env` file is
  gitignored and never ships.
- **Frontend → Vercel.** Import the repo, set **Root Directory** to `web`, and
  add `NEXT_PUBLIC_API_URL=https://<your-app>.onrender.com` plus the two
  `NEXT_PUBLIC_SUPABASE_*` vars (see [Authentication](#authentication-supabase)).
  Next.js is auto-detected; no extra build config needed.
- **Note:** Render's free tier sleeps on idle and may drop a long-running
  WebSocket mid-session; use a paid instance (or a keep-alive) for real demos.

## How it works

```
Browser ◄── WebSocket events ──► FastAPI
 (chat + plan panel)              │
                                  ▼
                       Orchestrator (the "room")
                       7 rounds: Problem → Market → Product →
                       GTM → Finance → Risks → Decision
                                  │
        ┌─────────────────────────┼──────────────────────────┐
        ▼                         ▼                          ▼
  Debaters (Sonnet 4.6)    Moderator opens rounds,     Editor (Opus 4.8)
  table-driven turns,      detects consensus (Haiku),  gap-checks rounds,
  stable-lens personas,    commits decisions (Opus)    compiles validated
  web_search built-in                                  StartupPlan schema
                                  │
                       Scribe (Haiku) compresses the
                       whiteboard between rounds
```

### The agents

| Agent | Role | Pushes for | Tools |
|-------|------|------------|-------|
| **CEO / Moderator** | Runs the room, frames each round, commits decisions, breaks ties | Clarity, momentum, a shippable plan | — |
| **Researcher** | Market sizing, competitors, trends, user pain | Evidence; kills unfounded claims | `web_search` |
| **Engineer** | Feasibility, scope, MVP cut | Smallest buildable thing; flags overreach | — |
| **Marketer** | Positioning, ICP, channels, messaging | Demand & differentiation | `web_search` |
| **CFO** | Pricing, unit economics, runway, funding | Does the math survive? | — |
| **Ops** | Hiring, legal, timeline, execution risk | Can we actually run this? | — |
| **Skeptic / VC** | Red-teams the plan — moats, math, assumptions, regulatory risk | "Show your work" | `web_search` |
| **Editor** | Publishes plan after each round; flags gaps; final compile | Coherent artifact; surfaces missing decisions | structured output |

Plus the **Scribe** (Haiku, named role) who compresses the whiteboard
between rounds — explicit and debuggable, hard-capped at 10 decisions and
6 open questions so the whiteboard can't grow unboundedly.

### The round table

Each round has a deterministic lead, two backers, and a challenger:

| # | Round | Lead | Backers | Challenger |
|---|-------|------|---------|------------|
| 1 | Problem  | Researcher | Marketer, Skeptic | Engineer |
| 2 | Market   | Researcher | Marketer, CFO     | Skeptic  |
| 3 | Product  | Engineer   | Marketer, Ops     | CFO      |
| 4 | GTM      | Marketer   | CFO, Ops          | Skeptic  |
| 5 | Finance  | CFO        | Researcher, Ops   | Skeptic  |
| 6 | Risks    | Skeptic    | Ops, CFO          | Engineer |
| 7 | Decision | Engineer   | (all)             | Skeptic  |

Turn order in each round: **lead → backer[0] → challenger → backer[1]**, so
the challenger lands mid-round where there's something to attack.

### The orchestration loop

```text
for round in queue:                          # graph, not pipeline
    moderator.open_round(topic)              # Sonnet, ~150 tok
    for turn in range(MAX_TURNS_PER_ROUND):
        speaker = next_from_table(round, turn)
        msg = speaker.respond(whiteboard, last_8_messages)   # streamed
        if user_interjected: route (with @-mention if present)
        if half_table_spoken and moderator.consensus(): break
    decision = moderator.summarize_round()   # Opus — quality-critical
    editor.publish_section(decision)         # plan panel updates live
    scribe.update_whiteboard()               # Haiku, structured
    if editor.gap_check() flags: requeue once   # max 1 loop-back/session
final_plan = editor.compile()                # Opus, validated StartupPlan
```

Why the design choices:

- **Rounds are a graph, not a pipeline.** If GTM reveals the target user is
  wrong, the Editor's `gap_check` can re-queue Market — but **only once per
  session** as a cost bound. A room that re-litigates forever is a bug, not
  a feature.
- **Whiteboard, not transcripts.** The Scribe maintains a compressed
  decision log; agents see the whiteboard plus only the **last 8 raw
  messages**. Bounds cost; keeps focus.
- **Stable lenses, not forced disagreement.** Each persona has one sentence
  it never stops asking ("smallest thing shippable in 6 weeks?", "show me
  unit economics", "who *specifically* and why *today*?"). Conflict is real,
  not theatrical.
- **Skeptic baked in.** Attacks moats, math, and assumptions in every round
  and *leads* the Risks round. The single biggest lever on artifact quality.
- **Graceful degradation on budget.** `BudgetExceeded` mid-debate skips to
  compiling the plan from whatever was decided — the user always gets an
  artifact.

### Model routing

| Model | Used for | Why |
|-------|----------|-----|
| `claude-sonnet-4-6` | Debate turns, round opens | Fast enough to feel live, smart enough for the roles, ~5× cheaper than Opus |
| `claude-opus-4-8`   | Moderator's round summary, Editor's final compile | The two spots where synthesis quality genuinely matters |
| `claude-haiku-4-5`  | Scribe, consensus probe, gap check | Cheap, mechanical, schema-validated calls |

System prompts use `cache_control: ephemeral` so prompt caching engages
once personas grow. The SDK's built-in 2× exponential backoff handles
transient 429/5xx; `pause_turn` continuations are capped at 3 so
server-side tool loops always terminate.

### The final artifact

The Editor emits a **pydantic-validated `StartupPlan`** (`messages.parse`,
not free-form Markdown that gets parsed):

```
Problem · Target user · Solution · Market size & competitors ·
Business model & pricing · Go-to-market ·
Financial sketch (unit economics, runway) ·
12-month roadmap · Key risks & open questions
```

Markdown is rendered *from* the validated object via
`StartupPlan.to_markdown()`. Every claim sourced from `web_search` carries
a source link in `plan.sources`. Open questions the room couldn't settle
are folded into Risks rather than silently dropped.

## Configuration (`.env`)

| Variable | Default | Meaning |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Required for real sessions. Get one at <https://platform.claude.com> |
| `MOCK_LLM` | `0` | `1` = canned debate, zero API calls — runs the whole real pipeline |
| `SESSION_BUDGET_USD` | `2.00` | Hard per-session spend ceiling. Past this, the session compiles a plan from whatever was decided |
| `MAX_TURNS_PER_ROUND` | `4` | Debate turns per round |
| `GLOBAL_TURN_CAP` | `40` | Total debate turns per session |
| `CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated origins allowed to call the API. Set to your Vercel URL in production |

The React frontend (`web/`) has its own `.env.local`:

| Variable | Default | Meaning |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:8000` | Base URL of the FastAPI backend (no trailing slash). The WebSocket URL is derived from it. Set to your Render URL in production |
| `NEXT_PUBLIC_SUPABASE_URL` | — | Supabase project URL (Project Settings → API). Required for login/signup |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — | Supabase anon public key — browser-safe. **Never** put the `service_role` key here |

### Authentication (Supabase)

`web/` ships `/login`, `/signup`, and `/forgot-password` pages backed by
**Supabase Auth** (hosted Postgres + password hashing, sessions, JWTs, and
password-reset emails handled for you). To enable it:

1. Create a project at <https://supabase.com> (free tier is fine).
2. Copy the **Project URL** and **anon public** key from Project Settings → API.
3. Put both in `web/.env.local` (see the table above), then restart `npm run dev`.

No SQL or table setup is needed — Supabase Auth manages its own `auth.users`
table, so signup/login work immediately. By default a confirmation email is
sent (the signup form shows a "check your email" notice); toggle **Auth →
Email → Confirm email** off in the dashboard for instant login while testing.
Sessions are stored client-side; the auth layer is isolated in
`web/lib/auth.ts`, so swapping providers later means editing one file.

## API surface

### HTTP

| Route | What |
|---|---|
| `GET /` | The single-page app |
| `GET /api/sessions` | Past sessions (id, concept, created_at) |
| `GET /api/sessions/{id}` | Full event log — powers replay |
| `GET /api/sessions/{id}/plan.md` | The validated plan rendered as Markdown |

Session-id paths are regex-validated (no traversal); user input is capped
at 600 chars.

### WebSocket (`/ws`)

**Client → server**

```json
{"type": "start", "concept": "an app that helps freelancers price their work"}
{"type": "user_message", "text": "@engineer focus on B2B"}
```

**Server → client events**

| Event | Fields | Meaning |
|---|---|---|
| `session_started`   | `session_id`               | Session created and persisted |
| `round_start`       | `round, question`          | New round opened by the Moderator |
| `turn_start`        | `agent`                    | Agent is about to speak |
| `token`             | `agent, text`              | Streaming token (live typing bubble) |
| `tool_use`          | `agent, tool`              | Server tool kicked off (e.g. `web_search`) |
| `turn_end`          | `agent, text`              | Final committed message for the turn |
| `chat`              | `agent, text`              | Non-streamed line (Editor / system / `You`) |
| `round_decision`    | `round, decision`          | Moderator's committed decision (Opus) |
| `plan_update`       | `section, content`         | Right panel section commits live |
| `whiteboard`        | `decisions, open_questions`| Scribe summary refresh |
| `status`            | `message`                  | Soft notice (budget, gap-check loop-back, …) |
| `session_complete`  | `plan`                     | Full validated `StartupPlan` payload |
| `error`             | `message`                  | Unexpected failure surfaced to UI |

## Repository layout

```
founders-room/
├── backend/
│   ├── main.py              # FastAPI app + WebSocket endpoint + replay/export APIs
│   ├── orchestrator.py      # Room, round loop, turn table, interjections, checkpointing
│   ├── llm.py               # Anthropic wrapper: model routing, streaming, CostMeter
│   ├── state.py             # ChatMessage, Verdict, GapCheck, WhiteboardUpdate, StartupPlan (pydantic)
│   ├── agents/
│   │   ├── base.py          # Agent class + streamed turns (turn_start → token* → tool_use? → turn_end)
│   │   ├── personas.py      # 8 personas, ROUND_TABLE, mock lines
│   │   └── moderator.py     # open_round / check_consensus / summarize_round / Scribe
│   └── tools/
│       ├── web_search.py    # built-in web_search server tool spec (web_search_20260209)
│       └── save_to_plan.py  # Editor: gap_check (Haiku) + compile_plan (Opus, validated)
├── frontend/                # vanilla HTML/CSS/JS — no build step, served by FastAPI (local)
├── web/                     # Next.js (React + TS) frontend, deploys to Vercel
│   ├── app/                 # App Router: landing (/), /app, /login, /signup, /forgot-password
│   ├── components/          # LandingNav, Reveal, SocialLinks, ContactForm, ChatPane, PlanPane, AuthCard
│   ├── hooks/useSession.ts  # WebSocket client + event handling + replay/export
│   ├── lib/                 # api.ts, agents.ts (team data), auth.ts + supabase.ts (auth)
│   └── public/              # generated black & gold landing imagery
├── scripts/
│   ├── cost_check.py        # Phase 0 cost gate — projects $/session from real prompt sizes
│   └── ws_smoke.py          # full end-to-end WebSocket session test
├── sessions/                # saved transcripts (JSON) — powers reload + replay
├── PLAN.md                  # the original design doc; every "why" is here
├── CHANGELOG.md             # every change made while building, with rationale
├── .env.example
└── requirements.txt
```

## Verification & testing

```bash
.venv/bin/python scripts/cost_check.py    # Phase 0 cost gate
# → ~$0.60 projected per session (30% of the $2 ceiling) — PASS

# in another terminal, with the server running under MOCK_LLM=1:
.venv/bin/python scripts/ws_smoke.py      # full end-to-end smoke test
# → 7 rounds, 43 turns, 1,691 token events, 9/9 plan sections,
#   `@engineer` interjection routed to an Engineer turn,
#   1,818 events persisted, replay + plan.md export verified
```

The smoke test drives a complete session over the real WebSocket in mock
mode and asserts every event type, the `@agent` interjection routing, all
9 plan sections committed, session persistence, the replay endpoint, and
the `plan.md` export.

**Not yet verified in this build:** a real-API session — no
`ANTHROPIC_API_KEY` was available in the build environment. The real path
uses the documented SDK surface (streaming, `messages.parse`,
`web_search_20260209`, `pause_turn`); run one cheap session with your key
as the first real-world check.

## Cost & budget

- **Projected:** ~$0.60 per session — Sonnet for ~40 debate turns, two
  Opus calls (round summaries + final compile), several Haiku calls
  (Scribe, consensus probe, gap check).
- **Enforced:** `CostMeter` accumulates real spend from API `usage`
  (including discounted cache reads) and raises `BudgetExceeded` at
  `SESSION_BUDGET_USD`. Mid-session blowups degrade gracefully — the
  remaining debate is skipped and a plan is compiled from whatever was
  decided. **The user always gets an artifact.**
- **Bounded everywhere:** `MAX_TURNS_PER_ROUND` (4),
  `GLOBAL_TURN_CAP` (40), `web_search.max_uses` (2/turn), `pause_turn`
  continuations (3), one Editor loop-back per session.

See `scripts/cost_check.py` for the projection — Phase 0 made cost a gate,
not an afterthought.

## Design decisions

The full reasoning lives in [PLAN.md](PLAN.md) (the original design doc)
and [CHANGELOG.md](CHANGELOG.md) (every change with rationale). The big
ones:

- **Table-driven turn-taking** over LLM-judged speaker selection — faster,
  cheaper, deterministic. Free-for-all and round-robin both rejected as too
  flat.
- **Stable-lens personas** over forced disagreement — conflict from priors,
  not prompts.
- **Skeptic + red-team posture** baked in from day one.
- **Editor publishes continuously** — both the live UX and loop-back
  behavior depend on it.
- **Scribe-maintained whiteboard** over full-transcript-to-every-agent —
  explicit, debuggable, bounded.
- **Validated `StartupPlan` schema** over Markdown that gets parsed.
- **Built-in `web_search`** over hand-rolled HTTP — native citations,
  fewer dependencies.
- **Cost is a Phase 0 gate**, not a Phase 5 afterthought.
- **In-memory + JSON persistence** for the prototype; the transcript JSON
  doubles as the replay source.

## Known limitations (deliberate prototype scope)

- One live session per WebSocket connection; no auth, no DB.
- Mock mode's consensus probe always says "continue", so mock rounds run
  all 4 turns (richer demo); real sessions can end rounds early.
- Replay re-renders events client-side at fixed pacing rather than at the
  original wall-clock timing.

## Roadmap

- A real-API verification run as the first real-world check.
- Multiple live sessions per connection; named/saved rooms.
- Optional SQLite persistence so `sessions/` can survive deploys.
- Hand-raise speaker selection (parallel Haiku scoring) as an upgrade
  path on top of the table.
- `.docx` / `.pdf` export from the validated `StartupPlan`.

## Contributing

PRs welcome. Before opening one, please:

1. Run `scripts/cost_check.py` and confirm the projection is still under
   the gate.
2. Run `scripts/ws_smoke.py` against a `MOCK_LLM=1` server.
3. Add a `CHANGELOG.md` entry that explains the **why**, not just the what.


