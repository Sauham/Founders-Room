# Changelog

Every change made while building Founders Room, with the reasoning behind it.
Built 2026-06-10, following [PLAN.md](../PLAN.md) phases 0–5 in one pass.

---

## Phase 0 — Skeleton + cost gate

### Added `scripts/cost_check.py` (the Phase 0 acceptance gate)
**Why:** PLAN.md §9 makes cost a gate, not an afterthought. The script prices a
full 7-round session from the actual prompt sizes and the current per-model
pricing (Sonnet $3/$15, Opus $5/$25, Haiku $1/$5 per MTok).
**Result: ~$0.60 projected per session — 30% of the $2 gate. PASS.** Model
routing needed no rework before building further.

### Added `backend/llm.py` — single Anthropic touchpoint
**Why:** one module owns model routing, so nobody accidentally calls Opus for a
debate turn. `stream_text()` streams tokens to a callback (the live-typing
feel), surfaces `server_tool_use` blocks (so the UI can show "searching the
web…" instead of stalling — PLAN.md §5), collects web-search result URLs as
plan sources, and re-sends on `pause_turn` so server-side tool loops finish.
`parse_structured()` wraps `messages.parse()` for validated pydantic output.
- **Model IDs:** `claude-sonnet-4-6` / `claude-opus-4-8` / `claude-haiku-4-5`.
  *Deviation:* PLAN.md wrote the Haiku ID with a date suffix
  (`claude-haiku-4-5-20251001`); current API guidance is to use bare aliases,
  so the alias is used.
- **`CostMeter`:** accumulates real spend from API `usage` objects (including
  discounted cache reads) and raises `BudgetExceeded` at `SESSION_BUDGET_USD`.
  The projection script estimates; the meter enforces.
- **`MOCK_LLM=1` mode** *(addition to the plan)*: streams canned debate through
  the whole real pipeline with zero API calls. Added because (a) the UI can be
  demoed for free, (b) the full system can be tested end-to-end in CI or on a
  machine with no key — which is exactly how it was verified here.

## Phase 1 — Table-driven moderator with 8 personas

### Added `backend/state.py` — typed everything
**Why:** PLAN.md §6: the plan is a *validated* `StartupPlan` schema, never
free-form text that gets parsed. Also `Verdict` (consensus probe), `GapCheck`
(editor loop-back), and `WhiteboardUpdate` (scribe) so every structured LLM
call is schema-enforced at the API layer. `StartupPlan.to_markdown()` renders
the export *from* the validated object.

### Added `backend/agents/personas.py` — 8 stable-lens personas + round table
**Why each choice:**
- **Stable lenses instead of forced disagreement** (PLAN.md §3): each persona
  has one sentence it never stops asking ("smallest thing shippable in 6
  weeks?", "show me the unit economics", "who specifically and why today?").
  Conflict emerges where lenses collide; forced "disagree with one prior
  point" reads as bickering.
- **Skeptic/VC agent** baked in — attacks moats, math, assumptions; *leads*
  the Risks round and challenges in Market/GTM/Finance. The single biggest
  lever on final-artifact quality.
- **`ROUND_TABLE`** (§4): 7 rounds, each with lead / backers / challenger by
  topic. Deterministic and free — no LLM "who speaks next" call. Turn order:
  lead → back[0] → challenge → back[1], so the challenger lands mid-round
  where there's something to attack.
- *Deviation:* PLAN.md's table had the Moderator "lead" the Decision round.
  The Moderator already opens and closes every round, so the Decision round's
  debate lead went to the Engineer (what do we build) with Skeptic challenging.
- **Mock lines** per persona for `MOCK_LLM=1`.

### Added `backend/agents/base.py` — Agent class + streamed turns
**Why:** one `stream_turn()` helper emits the `turn_start → token* → tool_use?
→ turn_end` event sequence every speaking role uses, so Moderator and debaters
stream identically. Agents see the **whiteboard + last 8 raw messages only**
(PLAN.md §4 cost/focus bound), and persona system prompts carry
`cache_control` so prompt caching engages if they grow.

### Added `backend/agents/moderator.py` — open / consensus / summarize + Scribe
- `open_round` (Sonnet, 150 tok): brisk framing, hands the floor to the lead.
- `check_consensus` (Haiku, structured `Verdict`): probed only after most of
  the table has spoken — bounds round length without paying for a probe after
  every turn.
- `summarize_round` (**Opus** — one of the two quality-critical spots, §2):
  weighs the round, commits a "Decision: …", explicitly logs unresolved
  Skeptic objections.
- `scribe_update` (Haiku, structured `WhiteboardUpdate`): compresses decisions
  to one line each, carries open questions verbatim, hard caps (10/6) so the
  whiteboard can't grow unboundedly. The Scribe is an explicit named role per
  the plan — debuggable, not an invisible 8th agent.

## Phase 2 — Rounds, loop-back, replay

### Added `backend/orchestrator.py` — the heart
- **Round loop as a work queue, not a pipeline** (§4): the Editor's gap check
  can push a completed round back onto the front of the queue. Limited to
  **one loop-back per session** — cost bound; a room that re-litigates forever
  is a bug, not a feature.
- **Caps everywhere:** `MAX_TURNS_PER_ROUND=4`, `GLOBAL_TURN_CAP=40`, plus the
  CostMeter. `BudgetExceeded` mid-debate skips to compiling the plan from
  whatever was decided — the user always gets an artifact.
- **Interjections** drain between turns; `@agent` mentions override the next
  speaker with a directive to answer the founder directly (§4).
- **Editor publishes live:** each round's committed decision lands in its plan
  section immediately (`plan_update` event) — the right panel fills as the
  debate runs, per §1/§3 ("Editor publishes continuously").
- **Checkpoint after every round** to `sessions/<id>.json` (events + plan +
  spend) — this one file powers reload *and* replay.
- Client-gone sends are swallowed so a disconnected browser doesn't kill the
  session before it persists.

### Added `backend/main.py` — FastAPI + WebSocket + replay/export APIs
**Why:** WS protocol is two client messages (`start`, `user_message`) and ~12
server event types — listed in README. Replay (`/api/sessions/{id}`) is nearly
free given checkpointing (§9 Phase 2). `plan.md` export renders from the
validated plan. Session-id paths are regex-validated (no traversal), inputs
capped at 600 chars.

## Phase 3 — Tools

### Added `backend/tools/web_search.py`
**Why:** PLAN.md §7 — Anthropic's **built-in** `web_search` server tool
(`web_search_20260209`), no hand-rolled HTTP, native citations. `max_uses: 2`
per turn bounds latency and cost. Wired to Researcher, Marketer, and Skeptic.
Result URLs flow into `plan.sources`.

### Added `backend/tools/save_to_plan.py` — Editor behaviors
*Deviation from the plan's letter, not its spirit:* `save_to_plan` was sketched
as a client tool; it's implemented as **structured output** (`messages.parse`)
instead — validation happens at the API layer and there's no tool-loop to
maintain. Two functions:
- `gap_check` (Haiku): flags a completed round with a load-bearing hole
  (no target user named, no price set, cross-round contradiction). Prompted
  that "usually the answer is null" so it doesn't loop-back recreationally.
- `compile_plan` (**Opus** — the other quality-critical spot): compiles the
  whiteboard into the full validated `StartupPlan`; instructed to use *only*
  what the team decided (no invented numbers) and to fold open questions into
  risks. Web-search sources are preserved from the live plan.

### Editor per-round section content comes from the Moderator's Opus summary
**Why (cost/architecture deviation):** the plan implied a separate Editor LLM
call per round. The Moderator's round summary *is* the committed decision, so
it feeds the live panel directly; the Editor's LLM budget is spent where it
adds something: gap checks + final compile. Saves ~7 Opus calls per session.

## Phase 4 — Frontend & UX

### Added `frontend/` — vanilla HTML/CSS/JS, no build step
*Deviation (plan-sanctioned):* PLAN.md §7 offered "Vite + React + Tailwind (or
vanilla — keep it light)". Vanilla won: zero toolchain, served directly by
FastAPI, one less failure mode for anyone cloning the repo.
- Chat pane: color-coded avatars, per-agent typing bubbles with a blinking
  caret, round headers, decision highlighting, system lines.
- **`tool_use` chips** ("🔎 Researcher is searching the web…") so server-tool
  stalls read as texture, not lag (§5).
- Plan panel: 9 sections with "the room hasn't decided yet" placeholders and a
  green flash on update; open-questions box from `whiteboard` events.
- Founder interjection bar with `@mention` hint; export button downloads the
  final Markdown; replay dropdown plays any saved session (tokens at 8ms).

## Phase 5 — Hardening (largely folded into the above)

- Hard budget (`CostMeter` + `BudgetExceeded` graceful degradation),
  per-round/global turn caps, `pause_turn` continuation cap (3), web-search
  `max_uses` cap — all in earlier sections.
- SDK's built-in retry (2× exponential backoff) relied on for 429/5xx rather
  than a hand-rolled retry loop — per current SDK guidance.
- Session save in `finally` — even a crashed session persists its transcript.
- Unexpected exceptions surface to the UI as an `error` event instead of a
  silent hang.

## Phase 6 — Post-build hardening & React frontend (2026-06-10)

Changes made after the first real-API sessions surfaced issues the mock
pipeline couldn't.

### Fixed: truncated structured-output JSON crashed live sessions
**Found:** real sessions died with
`ValidationError ... Invalid JSON: EOF while parsing a string` from both the
Scribe (`WhiteboardUpdate`) and the Editor's gap check (`GapCheck`).
**Cause:** the model hit `max_tokens` mid-JSON, so `messages.parse()` received
a string that ended without its closing quote/brackets. The schemas were never
the problem — the response was simply cut off.
**Fix (two parts):**
- Raised the caps that were too tight for a full whiteboard: `scribe_update`
  600 → **2000**, `gap_check` 150 → **500**.
- Made `parse_structured()` degrade gracefully: it now catches
  `pydantic.ValidationError` around `messages.parse()`, logs a warning, and
  returns `None`. All three callers (`scribe_update`, `gap_check`,
  `compile_plan`) already treat `None` as a clean fallback, so a single
  truncated call costs that one compression/gap-flag instead of crashing the
  whole session. *Caveat:* a truncated call isn't billed to the `CostMeter`
  (no `usage` object is returned when the SDK raises).

### Changed: explicit `max_retries=4` on the Anthropic client
**Why:** bursty multi-agent rounds fire many calls back-to-back and were
tripping 429 rate limits. The async client now uses `max_retries=4` so
transient 429/5xx are absorbed with exponential backoff instead of failing a
turn. (Supersedes the earlier "rely on the SDK's 2× default" note.)

### Added: `web/` — Next.js (React + TypeScript) frontend for Vercel
**Why:** deployment target is Vercel for the frontend + Render for the backend,
two separate origins. The original `frontend/` (vanilla HTML/JS served by
FastAPI) can't deploy to Vercel as a framework app, so a parallel Next.js app
was added. **`frontend/` is intentionally kept** — it still works as the
zero-build local option served at `:8000`; `web/` is the deployable client.
- App Router (`app/`), client-side `useSession` hook owning the WebSocket,
  `ChatPane` + `PlanPane` components, ported 1:1 from the vanilla event handling
  (same ~12 server event types, replay, `@mention` interject, plan.md export).
- **Design:** black & gold product styling (Playfair Display + Inter, gold
  reserved as an accent for decisions/rounds/CTAs) to read as a real product
  rather than a generated template.
- Backend base URL is read from `NEXT_PUBLIC_API_URL`; the WS URL is derived
  from it (`http→ws`, `https→wss`), so the same build works locally and on Vercel.
- Fonts are loaded via `<link>` to Google Fonts rather than `next/font` — the
  build environment couldn't fetch fonts at build time (TLS), and `<link>`
  resolves at runtime in the browser. Verified with a clean `next build`.

### Added: CORS middleware on the FastAPI backend
**Why:** the React client runs on a different origin (`localhost:3000` in dev,
Vercel in prod) than the API. `CORSMiddleware` reads allowed origins from
`CORS_ORIGINS` (default `localhost:3000`/`127.0.0.1:3000`); set it to the Vercel
URL on Render. The vanilla `frontend/` is same-origin and unaffected.

### Removed: Next.js dev tools indicator
**Why:** the floating "N" dev overlay (dev-only, never in production) was noise.
Set `devIndicators: false` in `web/next.config.mjs` to turn it off.

### Added: login / signup pages with Supabase Auth
**Why:** the app needs user accounts; Supabase was chosen over MongoDB because
it provides hosted Postgres **and** a full auth system (password hashing,
sessions, JWTs, email confirmation) out of the box — no auth code to hand-roll.
- **`web/app/login` + `web/app/signup`** render a shared `AuthCard` (name/email/
  password, client-side validation, error + "confirm your email" notices,
  busy state). Header gains **Sign in / Sign up** links.
- **`web/lib/supabase.ts`** lazily creates the browser client and returns `null`
  when env vars are absent, so the form shows a friendly "auth not configured"
  message instead of crashing.
- **`web/lib/auth.ts`** is the single auth touchpoint (`signIn`/`signUp`/
  `signOut`); the pages never reference Supabase directly, so swapping providers
  later is a one-file change. Signup detects email-confirmation mode and tells
  the user to check their inbox.
- Config via `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (anon key is browser-safe; the `service_role` key must never ship to the
  client). No SQL/table setup required — Supabase Auth owns `auth.users`.
- *Scope note:* this is client-side auth only. The FastAPI backend does not yet
  verify the Supabase JWT — wiring per-user session ownership is a later step.

---

## Verification (all run on this build)

| Check | Result |
|---|---|
| `py_compile` all backend modules | ✅ clean |
| `scripts/cost_check.py` (Phase 0 gate) | ✅ **$0.60 projected / $2.00 gate** |
| `scripts/ws_smoke.py` — full session over real WebSocket (mock mode) | ✅ 7 rounds, 43 turns, 1,691 token events, 9/9 plan sections, `@engineer` interjection routed to an Engineer turn, 1,818 events persisted |
| Replay + `plan.md` export endpoints | ✅ |
| Browser test (preview): pitch → live debate → plan fills → export click | ✅ |

**Not verified here:** a real-API session — no `ANTHROPIC_API_KEY` exists in
this environment. The real path uses the documented SDK surface (streaming,
`messages.parse`, `web_search_20260209`, `pause_turn`); run one cheap session
with your key as the first real-world check.

## Bugs found & fixed during verification

### `[hidden]` attribute defeated by author CSS
**Found:** browser screenshot showed the concept bar still visible mid-session.
**Cause:** `#concept-bar { display:flex }` (and `#layout { display:grid }`)
override the UA stylesheet rule that makes the HTML `hidden` attribute work.
**Fix:** `[hidden] { display:none !important; }` reset at the top of
`style.css`. Re-verified in the browser: concept bar now hides on session
start.

## Known limitations (deliberate prototype scope)

- One live session per WebSocket connection; no auth, no DB (PLAN.md §2 scope).
- Mock mode's consensus probe always says "continue", so mock rounds run all
  4 turns (richer demo); real sessions can end rounds early.
- Replay re-renders events client-side at fixed pacing rather than original
  timing.
