# FinSight AI — Interview Presentation Script

> **Purpose:** What you say live in the interview room when presenting your project.  
> **Not** the demo video script (see `demo/script.md` for that).  
> **Target length:** 8–10 minutes spoken. Pause at `[SHOW]` cues to share screen or point to diagram.  
> **Rule:** Speak naturally. Read this to internalize the arc — do NOT read word-for-word in the room.

---

## Pre-flight Checklist (Before You Enter)

- [ ] Browser tab open: `http://localhost:5173` (or Render URL) — logged in as demo user
- [ ] Second tab: `README.md` DAG diagram visible
- [ ] Third tab: `backend/app/agents/executor.py` open in VS Code
- [ ] DEMO_MODE=1 set — no live API dependencies
- [ ] Know these numbers cold: **6 entities, 5 nodes, 200 lines, 15 seconds, 60 minutes, 12 (bcrypt)**

---

## Structure

| Block | Time | Purpose |
|---|---|---|
| Self-introduction | ~1 min | Credibility, prior projects, what FinSight is |
| Project overview | ~2 min | Stack justification, architecture, module map |
| Technical deep-dive | ~4 min | DAG executor, CitationGuard, WebSocket pipeline |
| Trade-off moment | ~1 min | One ADR — DAG hand-rolled vs LangGraph |
| Closing | ~1 min | Three differentiators + ask |

---

## Part 1 — Self-Introduction (~1 min)

> *Note: Start confidently. Don't rush. This 60 seconds sets the tone. Make eye contact.*

---

[YOU]  Good morning / good afternoon. My name is Utkarsh Wasan. I'm submitting FinSight AI as Project Number 5 of the Nebula9.ai Full Stack GenAI Developer Internship assessment.

A quick word on my background before I walk through the project: I've shipped a Gemini 2.0 Flash multimodal pipeline in production on VoxRay AI — Whisper for transcription, ResNet50V2 for visual analysis — so the LLM integration in FinSight was low-risk territory for me. I've also built a DAG executor with Kahn's topological sort and cycle detection from scratch in my Visual Workflow Orchestrator project — which is exactly the pattern I reused here. And I've shipped production WebSockets for real-time collaboration on Nexus.ai. FinSight combines all three of those into a single financial application.

I'll spend about eight minutes giving you a complete walkthrough — architecture first, then the technical decisions, then the parts I'm most proud of and most honest about.

---

## Part 2 — Project Overview (~2 min)

> *Note: Pull up the dashboard. Let it breathe for 5 seconds before you talk.*

---

[YOU]  What you're looking at is a real-time financial insights dashboard. The core thesis is simple: you type a natural-language question about a stock — I'll use "Should I worry about TSLA today?" — and instead of getting a black-box answer, you watch five AI agents reason about it live in a directed acyclic graph.

`[SHOW: DAG diagram from README — or point to the React Flow visualizer on screen]`

The pipeline is: MarketData runs first, fetching price history from our TimescaleDB hypertable. Then News and Forecast run in parallel — `asyncio.gather` in Python — News calling Gemini for sentiment, Forecast running Holt-Winters for a 7-day projection. Then Risk combines them. Then Alert synthesizes the final answer and checks whether any position threshold was crossed.

Every step streams partial outputs over WebSocket, so those nodes light up one by one as each agent finishes.

`[SHOW: dashboard with DAG nodes — type a query and let it run]`

The stack is: FastAPI on the backend — async-native, Pydantic v2, native WebSocket support. SQLAlchemy 2.0 async with a single Postgres database extended by TimescaleDB. Gemini 2.0 Flash as the LLM. React 18 with Vite, Zustand for streaming state, React Flow for the DAG visualizer, TanStack Query for REST state. Docker Compose for local spin-up, single Render service in production.

There are six entities: User, WatchlistItem, Position, QuoteTick — which is the hypertable — NewsItem, and AuditEvent.

---

## Part 3 — Technical Deep-Dive (~4 min)

> *Note: This is the centrepiece. Slow down. Three sub-sections: DAG executor, CitationGuard, WebSocket. Don't rush.*

---

### 3a — The DAG Executor

[YOU]  Let me go into the part I'm most proud of — the DAG executor.

`[SHOW: backend/app/agents/executor.py — scroll to the run() method]`

The executor is a `DAGExecutor` class, about 200 lines. It receives a dict of node names to async functions, and an `on_event` callback for WebSocket streaming. The execution order is fixed for this topology: MarketData runs first with `required=True` — meaning if it fails, I immediately mark everything else as skipped and return a degraded answer. Then `asyncio.gather` runs News and Forecast concurrently. Then Risk. Then Alert.

Each node runs through `_safe_run`. This method records `started_at`, calls the node function, catches any exception into `state['errors']`, and emits a `dag_event` WebSocket frame with status — running, done, or error — plus the node's partial output at the moment it finishes. That's what causes the React Flow nodes to light up in real time.

The shared state is an `AgentState` TypedDict with `total=False` — every field is optional — because nodes accumulate state progressively. If News fails, `state['news']` is never set. Downstream nodes check with `state.get('news')` before reading. This fail-open design means a single node failure produces a degraded answer, not a crash.

Why hand-rolled instead of LangGraph? I'll come back to that in the trade-off section. Short answer: streaming control.

---

### 3b — CitationGuard

[YOU]  The second differentiator is CitationGuard.

The problem with LLM financial output is uncited claims. "TSLA dropped 4.2%" — according to what source? I built a two-sided enforcement layer.

`[SHOW: backend/app/services/citation_guard.py]`

Server-side: after every Gemini call, `CitationGuard.sanitize(text)` runs. The regex — `r"(?<!\[)\$?\d+(?:\.\d+)?%?(?!\s*\[\d+\])"` — finds any number not immediately followed by a `[n]` citation chip. Two carve-outs prevent false positives: years 1900 to 2099, and ordered list markers. Violations are replaced end-to-start with `[REDACTED: uncited numeric]`.

Client-side: `citation-guard.tsx` runs the same regex in the browser before React renders the answer. Double enforcement — server-side catches LLM issues, client-side catches delivery gaps.

The citation sources — NewsItem and QuoteTick row IDs — are built by the Alert node and sent with the answer. The chips `[1]`, `[2]` are hover-able in the UI, showing the exact headline or price tick the number came from.

`[SHOW: AICopilot panel with a rendered answer — hover over a citation chip]`

---

### 3c — WebSocket Pipeline

[YOU]  The third piece is the real-time layer.

When you click Run in the AI Copilot, `POST /query` returns a 202 immediately with a `run_id`. The DAG runs in a FastAPI BackgroundTask — a separate execution context with its own DB session factory, not the request-scoped session which closes when the 202 returns.

As each node finishes, the executor calls `ws_hub.publish_to_user(user_id, event)`. The `WSHub` maintains an `asyncio.Queue` per WebSocket connection. The WS endpoint loops `await queue.get()` and sends JSON to the browser.

In the browser, the Zustand `wsStore` dispatches each event: `dag_event` messages append to `dagEvents` (capped at 50), `quote_tick` messages update `quoteTicks` by symbol key, and `query_complete` stores the answer in `answersByRun` keyed by `run_id`. The DAGVisualizer filters `dagEvents` by the current `run_id` and rebuilds the status map on every update — which is why nodes turn green the moment they finish.

`[SHOW: browser DevTools WebSocket frames — or DAG nodes firing live]`

The in-process hub is correct for a single Render instance. The production upgrade is Redis Streams with consumer groups — documented in my improvement list.

---

## Part 4 — Trade-off Moment (~1 min)

> *Note: Pick exactly ONE trade-off. Don't list all of them. This one is the strongest.*

---

`[SHOW: docs/adr/0001-handrolled-dag-vs-langgraph.md in VS Code]`

[YOU]  Let me show you one architectural decision I documented formally.

I considered LangGraph for the agent layer and rejected it. Here's my reasoning, which I wrote up in Architecture Decision Record 0001.

For five nodes with a fixed topology and no conditional edges, LangGraph adds ~200 lines of framework configuration for the same result. The critical constraint was that I needed every node to emit WebSocket events at the moment it finished — running, done, error — with the node's partial output. LangGraph's streaming model abstracts the execution loop in a way that would require unwrapping its event bus to achieve this.

My executor is explicit: you can read `_safe_run` and understand exactly when events fire. I had built the same topological pattern in my Visual Workflow Orchestrator, so the implementation risk was zero.

I noted in the ADR that LangGraph becomes the right choice above roughly 15 nodes, or when the DAG needs conditional edges or human-in-the-loop interruption. I'd make that switch if FinSight grew to that scale.

`[Pause one second. Let the answer settle.]`

---

## Part 5 — Closing (~1 min)

> *Note: This is the last thing they hear. Budget 60 seconds. Do NOT rush. Make eye contact.*

---

[YOU]  Let me close with three things I want you to remember about this submission.

One: it's a DAG, not a chatbot. Five agents run with real dependencies, in parallel where possible, and you can watch every step in a live visualizer. That transparency is the design, not a nice-to-have.

Two: every numeric claim is citation-enforced. CitationGuard runs server-side and client-side. Uncited numbers are blocked, not warned about. The audit log stores a SHA-256 of every prompt so the output is verifiable after the fact.

Three: I'm honest about what's missing. The MAPE is a placeholder. Google OAuth is architected but not wired. Rate limiting is documented but not deployed. I'd rather ship those gaps in week one of the internship than pretend they're done.

I'd love to bring this approach — build observable, build auditable, be honest about trade-offs — to your team.

Thank you. I'm happy to take any questions.

---

## Anticipated Follow-up Questions & One-line Bridges

*Be ready for these immediately after the presentation. Don't pause more than 2 seconds before answering.*

| Question | One-line opener |
|---|---|
| "Why Holt-Winters and not Prophet?" | *"Prophet needs cmake compilation — too heavy for a 4-day build. Holt-Winters from statsmodels gives the same output shape in milliseconds."* |
| "How does CitationGuard handle edge cases?" | *"Year carve-out for 1900–2099, list-marker carve-out for 1. 2. 3. — those are structural numbers, not claims."* |
| "What breaks first at 500 users?" | *"Gemini free tier — 15 req/min, 3 calls per DAG run. That's a request queue problem, not an architecture problem."* |
| "Why not pgvector for news?" | *"Two hundred items per ticker. ILIKE is sub-millisecond at that corpus. pgvector earns its keep when I add earnings-call transcripts."* |
| "Is the audit log tamper-proof?" | *"Tamper-evident at the SQL level — append-only enforced by the service layer, no UPDATE or DELETE path. Hash-chaining would add Merkle trees with no detectability gain at this scale."* |
| "Why HS256 and not RS256?" | *"Single service, shared secret. RS256 is for multiple services verifying tokens without sharing a secret. Not applicable here."* |
| "Can you swap Gemini for GPT-4?" | *"One new file, one env var. The LLM client is behind a service interface; prompts are model-agnostic."* |
| "Did you test it?" | *"pytest for the backend (services and endpoints), tsc --noEmit for TypeScript, ruff for lint — all run in GitHub Actions on every push."* |

---

## Things NOT to Say Unprompted

- Don't mention the MAPE is fake unless asked.
- Don't mention rate limiting is not wired unless asked.
- Don't mention Google OAuth is not implemented unless asked.
- Don't say "monolith" without adding "modular" — "modular monolith, one FastAPI service."
- Don't list all 7 prompt-injection defenses unless asked — hit D1, D3, D7, drop the canary callback.
- Don't say "LangGraph is bad." Say "different tool, different scale."

---

## If You Have Time (Bonus Moments)

Only add these if the interviewer is engaged and time allows:

**"Explain this candle" feature:** Click a red candle on the chart. The DAG re-fires scoped to that timestamp — MarketData and News filter to that historical window. It gives a causal explanation for any price move.

**Audit log page:** Navigate to `/audit`. Show the token count, latency_ms, and `prompt_hash` columns. *"Every LLM call is logged — cost in INR, model used, and a SHA-256 of the prompt. If the model produces something surprising, you have the fingerprint."*

**DEMO_MODE:** Show the env var. *"Set DEMO_MODE=1 and no external calls are made — deterministic fixture data, zero rate-limit exposure. Required for recording a consistent demo."*
