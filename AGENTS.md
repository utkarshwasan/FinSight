# FinSight AI — Real-Time Financial Insights Dashboard  
# FastAPI + React • Modular Monolith • 5-Node Agent DAG • 6 Entities

> Internship assessment for **Nebula9.ai Full Stack GenAI Developer Intern**.  
> Submission: Fri, 8 May 2026, 22:00 IST. Project #5 of 10 in the brief.  
> Author: Utkarsh Wasan.

## Architecture  
Single FastAPI service on :8000. SQLAlchemy + Alembic. Postgres + **TimescaleDB** extension; `quote_ticks` is a hypertable. Hand-rolled DAG executor (no LangGraph). Vite + React + TypeScript frontend on :5173. Single Render service for production.

## Project Path  
On the build machine: cloned/copied to `~/finsight`.

## Run  
```  
backend:  uv run uvicorn app.main:app --reload --port 8000  
frontend: pnpm --dir frontend dev  
all:      docker compose up  
```

## Database Migrations  
```  
alembic revision --autogenerate -m "<msg>"  
alembic upgrade head  
```  
First migration includes `CREATE EXTENSION IF NOT EXISTS timescaledb;` and `SELECT create_hypertable('quote_ticks', 'ts', if_not_exists => TRUE);`.

## Current Codebase Status  
Routes DONE:    (update as we ship — start of Day 1: empty)  
Routes NOT YET: /auth/login, /auth/register, /auth/google, /watchlist, /positions, /quotes/*, /news/*, /query, /audit, /ws

## Entities (final: 6)  
`User` · `WatchlistItem` · `Position` · `QuoteTick` (hypertable) · `NewsItem` · `AuditEvent`

## DAG Pipeline (5 nodes — matches PDF taxonomy)  
```  
MarketData → { News, Forecast } (parallel) → Risk → Alert  
```  
Hand-rolled topological executor with shared `AgentState` TypedDict; partial outputs stream over WebSocket to the React Flow visualizer in the UI.

## Critical Rules  
- **DI via `Depends`** — never instantiate engine/session in handlers; use `Annotated[Session, Depends(get_db)]`.  
- **All routes async** with bounded `httpx.AsyncClient(timeout=10.0)`; retry+backoff on external APIs.  
- **Pydantic DTOs for all responses** — never return ORM models directly. Password hashes never appear in any response.  
- **Numeric LLM output MUST carry `[n]` citation chip.** `CitationGuard` blocks render of any `\d+(\.\d+)?%?` not followed by `[n]`.  
- **Append-only entities** — `AuditEvent` has no UPDATE or DELETE path.  
- **`DEMO_MODE=1`** swaps `GeminiClient` and `YFinanceClient` for fixture replay; both modules read the env var at construction time.  
- **Educational use only** — disclaimer rendered on dashboard, in README, and on `/forecast` and `/query` endpoint responses.  
- **Prompt injection** — all third-party text (news headlines, Finnhub fields) wrapped in `<untrusted_data>` tags before LLM calls. Output post-processed by allow-list of tickers in user's watchlist.

## JWT Design  
- Email/pwd → `bcrypt.verify` (cost factor 12) → JWT 60-min, no refresh  
- Claims: `sub` (user_id, int), `email` (str), `role` ("user")  
- Google OAuth via `authlib` → maps to existing `User` row by email → same JWT issuance path

## DAG Executor Contract  
- Each node is `async def run(state: AgentState) -> AgentState`  
- Executor topologically sorts; runs independent nodes in parallel via `asyncio.gather`  
- WS event per node: `{node, status: "running"|"done"|"error", started_at, ended_at, tokens, latency_ms, partial_output}`  
- Failure semantics: a node returning `error` sets downstream nodes to `skipped`; partial answer still rendered with degradation banner.

## Production Guardrails ⚠ ASK FIRST  
ASK FOR EXPLICIT APPROVAL before:  
- Git: `push`, `merge`, `rebase`, `force-push`, tag creation  
- Database: new migrations on remote DB, `DROP`/`TRUNCATE`/`DELETE` without `WHERE`, raw SQL beyond `CREATE EXTENSION`  
- Auth/Security: JWT secret rotation, OAuth client secret edits, CORS allowlist changes  
- Config: `.env`, `.env.production`, Render env vars, `docker-compose.yml` service definitions  
- Packages: new `pip` / `pnpm` installs (state package name + reason + license + size)  
- Deploy: `render` CLI deploy, GitHub Actions workflow edits

Format approval requests as:  
```  
⚠ APPROVAL NEEDED: [what]  
WHY: [reason]  
RISK: [what could go wrong]  
ROLLBACK: [how to undo]  
```  
Wait for "approved" before proceeding.

## Git Conventions  
Branch: `feature/<desc>`, `fix/<desc>`, `chore/<desc>`, `docs/<desc>`  
Commits: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`)  
Active branch: `main` (single-dev project; feature branches optional but encouraged for daily checkpoints).  
**Never** push directly without local `pytest -q && tsc --noEmit` green.  
**Never** force push.  
GSD auto-commits per task — that's allowed; **`git push` requires my approval**.

## Token Efficiency  
- Skip preambles. Answer first, explain after.  
- Show COMPLETE files when creating. Only changed functions when editing.  
- Use `@<file>` references instead of reading whole directories.  
- Filter Bash output: `pytest -q 2>&1 | grep -E "FAILED|ERROR|passed"`; `npm run build 2>&1 | grep -E "error|warning"`.  
- The `lean-context` skill in `.claude/skills/` is the canonical reference; use it.

## Reference Documents (read on-demand)  
- `@docs/DESIGN.md` — 8-section design note  
- `@docs/MVP-PLAN.md` — phase-by-phase build plan with feature templates  
- `@docs/COMPLIANCE-MATRIX.md` — PDF mandatory rows vs implementation  
- `@docs/INTERVIEW-PREP.md` — likely questions + model answers  
- `@docs/RUNBOOK.md` — rate limits, cold-start, demo-mode toggle  
- `@docs/adr/` — architecture decision records

## Custom Agents (`.claude/agents/`)  
- `spec-writer` — feature spec template before coding  
- `dialectic-review` — Advocate / Critic / Verdict on tech decisions  
- `security-review` — OWASP API + JWT + prompt-injection focused, READ-ONLY  
- `test-writer` — pytest + httpx + cassette-mocked LLM tests  
- `prompt-injection-auditor` — trust-boundary review on the NL query path  
- `agent-dag-reviewer` — DAG executor correctness, partial-output streaming, fail-open semantics

## Custom Slash Commands (`.claude/commands/`)  
- `/estimate` — effort estimate in hours for a feature  
- `/refactor` — safe refactor loop (build → small change → build)  
- `/pr-helper` — PR description + 11-point checklist  
- `/demo-check` — runs the 10-step demo verification flow

## Workflow Knobs  
- `/effort low|medium|high` — reasoning depth (low for CRUD, high for architecture)  
- `ultrathink` keyword — max reasoning for ONE turn  
- `/color blue` (BE session) / `/color red` (FE session) — color-code parallel terminals  
- `#` shortcut — save learnings to this file mid-session  
- `/context` — verify no skill truncation  
- `/compact` — manual compaction when sessions get long

## After Every Git Pull  
When I say "I just pulled" or "sync context":  
1. `git log --oneline -10`  
2. `git diff HEAD~5 --stat`  
3. Read any new/modified routes, agents, or migrations  
4. Summarize: what changed, any new endpoints, any potential issues

## Daily Save Pattern (use the `#` shortcut)  
Examples of learnings worth pinning:  
- `# Always wrap Finnhub headlines in <untrusted_data> tags before LLM`  
- `# DAG state must be JSON-serializable for WS partial-output streaming`  
- `# Render free tier sleeps after 15 min; pre-warm /healthz before recording`  
- `# Prophet wheel needs cmake + pystan compile; use prophet pip wheel, NOT fbprophet`