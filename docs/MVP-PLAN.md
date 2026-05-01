```markdown  
# MVP Plan — FinSight AI

The master execution doc for the 4-day build. Phases run in order; each Feature has steps, files touched, tests, done-when criteria, and a fallback ladder. GSD orchestrates per-phase milestones — see commands embedded below.

> **Total budget:** 4 focused days ≈ 40h productive coding + 4h video/polish. Buffer is built in via fallback ladders, not slack time.  
> **Ship-or-cut philosophy:** every Feature has a "drop to" version. If a Feature's hard hours run out, take the fallback and move on.

---

## Phase 0 — Pre-build setup (on the new machine, ~3h)

Done **before** Day 1 starts. Most of this is a one-time toolchain install. If you're sliding it into Day 1 morning, budget 3 hours and don't start coding until Phase 0 is green.

### 0.1 — System prerequisites

**Goal:** every command-line tool we need is on PATH.

**Steps:**  
1. Verify Python ≥ 3.12: `python --version`  
2. Verify Node ≥ 22 LTS: `node --version`  
3. Install Docker Desktop (Windows: WSL2 backend); verify `docker --version`  
4. Install `uv`: `pip install uv && uv --version`  
5. Install `pnpm`: `npm i -g pnpm && pnpm --version`  
6. Install GitHub CLI: `winget install GitHub.cli` (Win) or `brew install gh` (mac); `gh auth login`  
7. Install Git Bash (Windows) — required for our `.sh` hooks; usually shipped with Git for Windows

**Done when:** all six tools print versions without error.  
**Fallback:** if Docker Desktop won't install, use a Codespace or Render Dev Environment for the build (slower, but unblocked).

### 0.2 — Install Claude Code + authenticate

**Steps:**  
1. `npm install -g @anthropic-ai/claude-code`  
2. `claude --version` → expect 2.1.x or higher  
3. `claude` → opens browser; sign in (Cognizant SSO if applicable, else Claude.ai); `/exit`

**Done when:** `claude` opens a prompt with no auth error.

### 0.3 — Copy the bundle

**Goal:** `finsight/` lands on the build machine.

**Option A (OneDrive):** sign in to OneDrive on the build machine; the folder syncs to `~/OneDrive/Project/finsight/` (or wherever your OneDrive root is).

**Option B (git clone):**  
```bash  
gh repo create utkarshwasan/finsight --public --clone --source=<this folder>  
# OR if already pushed:  
gh repo clone utkarshwasan/finsight ~/finsight  
```

**Done when:** `cd <finsight folder> && ls .claude/agents/` lists 6 agent files.

### 0.4 — Wave 1 plugin install

```bash  
cd <finsight folder>  
claude  
/plugin marketplace add shinpr/claude-code-workflows  
/plugin install dev-workflows@claude-code-workflows  
/plugin install dev-workflows-frontend@claude-code-workflows  
/plugin install superpowers@claude-plugins-official  
/plugin install ralph-loop@claude-plugins-official  
/reload-plugins  
/context        # verify no skill truncation  
```

**Done when:** `/context` shows ~50+ agents loaded, no "Showing X of Y skills" warning.

### 0.5 — Wave 1.5 GSD install

```bash  
/exit  
npx get-shit-done-cc@latest  
# Prompt: Runtime = Claude Code; Location = Local (current project only)  
echo ".planning/" >> .gitignore  
echo ".claude/get-shit-done/" >> .gitignore  
claude  
/gsd:help  
```

**Done when:** `/gsd:help` lists `/gsd:new-milestone`, `/gsd:plan-phase`, `/gsd:execute-phase`, `/gsd:verify-work`, `/gsd:quick`.

### 0.6 — Wave 3 MCPs

```bash  
claude mcp add github -- npx -y @modelcontextprotocol/server-github  
claude mcp add context7 -- npx -y @upstash/context7-mcp  
```

Set `GITHUB_TOKEN` env var first (generate at https://github.com/settings/tokens, scopes: `repo`, `read:org`).

**Done when:** Claude Code shows GitHub + Context7 MCP servers as connected.

### 0.7 — Set application env vars

```bash  
cp .env.example .env  
# Edit .env. Get free keys:  
#   GEMINI_API_KEY     → https://aistudio.google.com/apikey  
#   FINNHUB_API_KEY    → https://finnhub.io/register   (60 req/min free)  
#   JWT_SECRET         → python -c "import secrets; print(secrets.token_hex(32))"  
```

**Done when:** all required keys present in `.env`; no placeholder strings remain.

### 0.8 — Smoke `docker compose up`

**Goal:** Postgres + TimescaleDB starts; backend stub responds; frontend stub serves.

We don't have backend/frontend code yet, so this step *will* fail until Day 1 Feature 1.1 lands. **Treat 0.8 as deferred to end of Feature 1.1.**

### 0.9 — Bootstrap GSD codebase awareness

```bash  
claude  
/gsd:map-codebase  
```

GSD spawns 4 parallel agents to build `.planning/codebase/` index. Run once at start.

**Done when:** `.planning/codebase/` directory has a stack.md, conventions.md, and concerns.md.

### 0.10 — Phase-0 verification checklist

- [ ] All 6 prerequisites installed (`docker`, `uv`, `pnpm`, `gh`, `python`, `node`)  
- [ ] Claude Code authenticated; `/context` clean  
- [ ] `finsight/` folder accessible with all 6 agents and 4 commands  
- [ ] Wave 1 plugins installed; no truncation  
- [ ] GSD installed; `/gsd:help` works  
- [ ] GitHub + Context7 MCPs connected  
- [ ] `.env` has real GEMINI_API_KEY, FINNHUB_API_KEY, JWT_SECRET  
- [ ] `.planning/` exists and is gitignored  
- [ ] `git init` done; first commit `chore: bootstrap finsight from claude code bundle`  
- [ ] You have NOT yet started writing source code

---

## Phase 1 — Foundation (Day 1, ~10h)

**Theme:** make sure something runs end-to-end before any wow-shot work. By bedtime: login works, quotes flow into the DB, the FE displays a number from the BE.

**GSD command sequence:**  
```  
/gsd:new-milestone  
> Foundation: auth + 6 entities + yfinance polling + WS quote stream + FE login + smoke deploy

/gsd:discuss-phase 1   # optional — lock in any open decisions  
/gsd:plan-phase 1  
/gsd:execute-phase 1  
/gsd:verify-work 1  
```

### Feature 1.1 — Repo + Compose scaffold (1.0h)

**Goal:** `docker compose up` brings up postgres-timescale + a backend stub that returns 200 on `/healthz` + a frontend stub at :5173.

**Files:**  
- `docker-compose.yml` (postgres-timescale, backend, frontend, optional worker)  
- `Dockerfile.backend` (multi-stage: build with uv, run with uvicorn)  
- `Dockerfile.frontend` (multi-stage: build with pnpm, serve with vite preview)  
- `backend/pyproject.toml` (deps: fastapi, uvicorn, sqlalchemy, alembic, psycopg, pydantic, pydantic-settings, python-jose, bcrypt, authlib, httpx, yfinance, finnhub-python, google-genai, prophet, pandas, numpy)  
- `frontend/package.json` (deps: react, react-dom, vite, typescript, tailwindcss, @radix-ui/* via shadcn, @tanstack/react-query, recharts, lightweight-charts, reactflow, zustand, reconnecting-websocket)  
- `backend/app/main.py` (FastAPI app + `/healthz` route only)  
- `frontend/src/main.tsx`, `App.tsx` (single "FinSight AI loading…" page)

**Steps:**  
1. `mkdir backend frontend`  
2. Init backend: `cd backend && uv init && uv add fastapi uvicorn sqlalchemy alembic psycopg pydantic pydantic-settings python-jose bcrypt authlib httpx yfinance finnhub-python google-genai prophet pandas numpy slowapi`  
3. Init frontend: `cd frontend && pnpm create vite . --template react-ts && pnpm add tailwindcss @tanstack/react-query recharts lightweight-charts reactflow zustand reconnecting-websocket`  
4. `pnpm dlx shadcn@latest init` and add: button, card, input, table, toast, badge, tooltip, sheet  
5. Set up Tailwind (`tailwind.config.ts`, `index.css`)  
6. Write minimal `main.py` with `/healthz`  
7. Write `docker-compose.yml` with Postgres-Timescale image (`timescale/timescaledb:latest-pg16`)  
8. Write `Dockerfile.backend` and `Dockerfile.frontend`  
9. `docker compose up --build` — fix until green

**Tests to add:** `backend/tests/test_health.py::test_healthz_returns_200`

**Done when:** `curl localhost:8000/healthz` returns `{"status":"ok"}` AND `curl localhost:5173` returns the loading page AND `docker compose ps` shows 3 services healthy.

**Fallback ladder:**  
- If Docker Compose fails on Windows networking → run backend + frontend natively (`uv run uvicorn ...` and `pnpm dev`), only Postgres in Docker  
- If TimescaleDB image fails to pull → temporarily use vanilla `postgres:16`; add hypertable as ADR exception, plan to swap on Day 4

**Reuse:** Vite + shadcn scaffold is borrowed from default templates; cite in `CREDITS.md` if any > 10 LOC.

### Feature 1.2 — Postgres + TimescaleDB extension + hypertable (0.5h)

**Goal:** the `quote_ticks` table is a TimescaleDB hypertable; Alembic migrations run cleanly.

**Files:**  
- `backend/alembic.ini`  
- `backend/migrations/env.py` (read DATABASE_URL from settings)  
- `backend/migrations/versions/0001_initial_schema.py` (creates extension + 6 tables + hypertable)

**Steps:**  
1. `cd backend && uv run alembic init migrations`  
2. Edit `alembic.ini` to read URL from env via Pydantic Settings  
3. `uv run alembic revision -m "initial schema"` (NOT `--autogenerate` — models not written yet)  
4. Edit the generated `versions/0001_*.py` upgrade():  
   ```python  
   op.execute("CREATE EXTENSION IF NOT EXISTS timescaledb;")  
   op.create_table("users", ...)  
   op.create_table("watchlist_items", ...)  
   op.create_table("positions", ...)  
   op.create_table("quote_ticks", ...)  
   op.create_table("news_items", ...)  
   op.create_table("audit_events", ...)  
   op.execute("SELECT create_hypertable('quote_ticks', 'ts', if_not_exists => TRUE);")  
   ```  
5. `docker compose exec backend uv run alembic upgrade head`  
6. Verify: `docker compose exec postgres-timescale psql -U finsight -c "\dx"` shows timescaledb; `\d quote_ticks` shows it's a hypertable.

**Tests:** none for migrations directly; covered by integration tests in 1.4+

**Done when:** `alembic current` reports `0001_initial_schema (head)` AND `\d+ quote_ticks` shows hypertable metadata.

**Fallback:** if hypertable creation fails (extension missing), drop to plain table; add ADR-0003 explaining the deviation; revisit Day 4.

### Feature 1.3 — SQLAlchemy models for 6 entities (1.0h)

**Goal:** ORM mappings for User, WatchlistItem, Position, QuoteTick, NewsItem, AuditEvent.

**Files:**  
- `backend/app/models/__init__.py`  
- `backend/app/models/user.py`  
- `backend/app/models/watchlist.py`  
- `backend/app/models/position.py`  
- `backend/app/models/quote_tick.py`  
- `backend/app/models/news_item.py`  
- `backend/app/models/audit_event.py`  
- `backend/app/db.py` (engine, SessionLocal, `get_db` Depends)

**Steps:**  
1. Define each model using SQLAlchemy 2.0 `DeclarativeBase`  
2. Composite PK on `quote_ticks` (ts, symbol)  
3. FK from watchlist_items, positions, audit_events to users with `ondelete="CASCADE"` (ok at this scale)  
4. `Base.metadata` imported in `migrations/env.py` for future autogenerate  
5. `get_db()` as a generator yielding a Session; type hint `Annotated[Session, Depends(get_db)]`

**Tests:** `tests/test_models.py::test_user_model_round_trips`, `::test_quote_tick_composite_pk`

**Done when:** `pytest tests/test_models.py -q` passes; ORM can read/write each table.

**Fallback:** none needed — straight ORM work.

### Feature 1.4 — JWT email/password auth (2.0h)

**Goal:** `POST /auth/register`, `POST /auth/login`, `GET /users/me` all working with JWT bearer tokens; bcrypt password hashing.

**Files:**  
- `backend/app/auth/__init__.py`  
- `backend/app/auth/jwt.py` (encode/decode, 60-min expiry, HS256, no refresh)  
- `backend/app/auth/passwords.py` (bcrypt hash/verify, cost=12)  
- `backend/app/auth/deps.py` (`get_current_user` Depends)  
- `backend/app/routes/auth.py` (`/auth/register`, `/auth/login`)  
- `backend/app/routes/users.py` (`/users/me`)  
- `backend/app/schemas/auth.py` (`RegisterIn`, `LoginIn`, `TokenOut`)  
- `backend/app/schemas/user.py` (`UserOut` — no password hash)

**Steps:**  
1. `RegisterIn` Pydantic with email + password (min_length=8)  
2. `register()` → hash password, insert user, return `TokenOut`  
3. `login()` → fetch user, bcrypt verify, return `TokenOut`  
4. `jwt.encode_token(user_id, email)` returns dict `{access_token, token_type, expires_in}`  
5. `jwt.decode_token(token)` raises `HTTPException(401)` on invalid/expired  
6. `get_current_user` Depends → `Annotated[User, Depends(get_current_user)]`  
7. `/users/me` returns `UserOut`; protected by `get_current_user`

**Tests:**  
- `test_register_creates_user`  
- `test_register_duplicate_email_returns_409`  
- `test_login_with_valid_credentials_returns_token`  
- `test_login_with_wrong_password_returns_401`  
- `test_users_me_without_token_returns_401`  
- `test_users_me_with_expired_token_returns_401`  
- `test_users_me_with_valid_token_returns_user`

**Done when:** all 7 tests pass; can `curl -X POST /auth/register`, then `/auth/login`, then `/users/me` with the token.

**Fallback:** if bcrypt build fails on Windows, use `argon2-cffi` instead (still secure; document switch).

**Reuse:** JWT pattern is concept-ported from EduLearn (cite in CREDITS.md as internal carry-over).

### Feature 1.5 — yfinance polling worker + `/quotes/{symbol}/latest` route (2.0h)

**Goal:** a background loop fetches recent quote ticks every 15 seconds and writes to `quote_ticks`; a route returns the latest tick for a symbol.

**Files:**  
- `backend/app/services/yfinance_client.py` (wrapper with `DEMO_MODE` switch)  
- `backend/app/services/quote_poller.py` (the 15s loop, callable as a worker)  
- `backend/app/scripts/run_poller.py` (entry point: `python -m app.scripts.run_poller`)  
- `backend/app/routes/quotes.py` (`GET /quotes/{symbol}/latest`, `GET /quotes/{symbol}/history?period=1mo`)  
- `backend/app/schemas/quote.py` (`QuoteTickOut`)  
- `docker-compose.yml` worker service

**Steps:**  
1. `YFinanceClient.history(symbol, period)` returns DataFrame (live) or fixture replay (DEMO_MODE)  
2. `quote_poller.poll_loop(symbols: list[str])` async — every 15s, fetch latest, upsert into quote_ticks, emit WS event  
3. `run_poller.py` reads watchlist symbols from DB, runs `poll_loop`  
4. Add `worker` service to docker-compose.yml: same image as backend, command = `python -m app.scripts.run_poller`  
5. Routes:  
   - `GET /quotes/{symbol}/latest` → most recent quote_tick  
   - `GET /quotes/{symbol}/history?period=1mo` → 30d daily closes (used by Forecast Day 2)

**Tests:**  
- `test_yfinance_client_demo_mode_returns_fixture`  
- `test_quote_poller_writes_to_db`  
- `test_quotes_latest_returns_most_recent`  
- `test_quotes_latest_for_unknown_symbol_returns_404`

**Done when:** worker container running for 60s populates ~4 quote_ticks rows; `curl /quotes/AAPL/latest` returns JSON.

**Fallback:**  
- If yfinance is rate-limited / flaky → use Finnhub `/quote` instead (already have key); document swap  
- If background worker is too complex on Render free tier → run poller as part of backend startup (single process); document trade-off in ADR-0003

### Feature 1.6 — React + Vite scaffold + login + protected dashboard route (1.5h)

**Goal:** unauth users see login; authed users see dashboard skeleton showing `/users/me` data and a placeholder for the watchlist.

**Files:**  
- `frontend/src/main.tsx`  
- `frontend/src/App.tsx` (router setup)  
- `frontend/src/pages/Login.tsx`  
- `frontend/src/pages/Dashboard.tsx`  
- `frontend/src/lib/api.ts` (axios instance with interceptor for Bearer token)  
- `frontend/src/lib/auth-store.ts` (Zustand store: `{token, user, login, logout}`)  
- `frontend/src/components/ProtectedRoute.tsx`

**Steps:**  
1. `react-router-dom` already installed (or add it)  
2. `auth-store.ts`: Zustand store; persists token to `localStorage`  
3. `api.ts`: axios.create with `baseURL = import.meta.env.VITE_API_BASE`; interceptor adds `Authorization: Bearer <token>`  
4. `Login.tsx`: shadcn Card + form; on submit → `api.post('/auth/login')` → store token → navigate to /dashboard  
5. `ProtectedRoute.tsx`: if no token, redirect to /login  
6. `Dashboard.tsx`: fetch `/users/me` via TanStack Query → render greeting + placeholder

**Tests:** Vitest can wait until Day 3 polish; smoke-test manually.

**Done when:** in browser, unauth → redirected to /login; submit credentials → land on /dashboard with username displayed.

**Fallback:** if shadcn init breaks on Windows, use raw Tailwind + minimal HTML — ugly but functional.

### Feature 1.7 — Smoke deploy backend to Render (1.5h)

**Goal:** the FastAPI service runs on Render free tier; `/healthz` is reachable from the public internet.

**Steps:**  
1. Push current code to GitHub: `gh repo create utkarshwasan/finsight --public --source=. --push`  
2. Create Render account if not yet; link GitHub  
3. Render dashboard → New Web Service → connect repo → root directory = `backend`  
4. Set build command: `pip install uv && uv sync --frozen`  
5. Set start command: `uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT`  
6. Add env vars: `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `FINNHUB_API_KEY`, `CORS_ORIGINS`  
7. Create Postgres on Render (free) OR use a free Supabase/Neon Postgres with TimescaleDB enabled  
8. Run alembic upgrade as a one-off shell: Render dashboard → Shell → `alembic upgrade head`  
9. Visit the Render URL `/healthz` — expect 200

**Done when:** public Render URL responds; can register + login from a curl outside docker.

**Fallback:**  
- If Render's free Postgres lacks TimescaleDB → use Neon (https://neon.tech) which supports TimescaleDB extension on free tier  
- If both block → ship with vanilla Postgres on Render, document deviation in ADR-0003, run TimescaleDB only locally for the demo video

### Phase 1 exit gate (verify before Day 2)

- [ ] `pytest -q` green (5+ tests)  
- [ ] `docker compose up` brings up 3 services healthy  
- [ ] `curl localhost:8000/healthz` returns 200  
- [ ] `curl localhost:5173` returns the React shell  
- [ ] `curl -X POST /auth/register` then `/auth/login` succeed  
- [ ] Worker has populated `quote_ticks` (`SELECT count(*) FROM quote_ticks` > 0)  
- [ ] Frontend login flow works in browser  
- [ ] Render URL public; `/healthz` returns 200 from outside the dev machine  
- [ ] Render Postgres has the schema (alembic upgrade ran)  
- [ ] Git committed; pushed to origin

If any are red, **do not start Phase 2.** Fix Phase 1 first.

---

## Phase 2 — Wow shots (Day 2, ~11h)

**Theme:** the differentiating features that make the demo video memorable. By bedtime: typing an NL query causes 5 nodes to light up and an answer to render with citation chips, plus candlestick + forecast overlay + Holdings P&L are all visible.

**GSD:**  
```  
/gsd:new-milestone  
> Wow shots: WebSocket fan-out + DAG visualizer + 5-node executor + NL query + Holdings P&L + candlestick + Prophet forecast

/gsd:plan-phase 2  
/gsd:execute-phase 2  
/gsd:verify-work 2  
```

### Feature 2.1 — WebSocket route + in-process pubsub (1.5h)

**Goal:** clients subscribe to `/ws`; backend can broadcast `quote_tick`, `dag_event`, `alert` messages.

**Files:**  
- `backend/app/routes/ws.py` (FastAPI WebSocket endpoint)  
- `backend/app/services/ws_hub.py` (per-connection asyncio.Queue, `broadcast()`, `publish_to_user()`)  
- `frontend/src/lib/ws.ts` (reconnecting-websocket wrapper, event dispatcher)  
- `frontend/src/lib/ws-store.ts` (Zustand: `{connected, subscribe, dagEvents, quoteTicks, alerts}`)

**Steps:**  
1. `WSHub` class: dict of `user_id → list[asyncio.Queue]`  
2. `/ws` endpoint: authenticate via query-string token (FastAPI WS doesn't carry headers easily); add connection's queue to hub; relay messages to client; on disconnect, remove queue  
3. Client side: `connect(token)` → opens `ws://...?token=<jwt>`; `onmessage` dispatches to Zustand store by event type  
4. Update `quote_poller` to call `ws_hub.broadcast({type: "quote_tick", ...})` after each upsert

**Tests:**  
- `test_ws_authenticated_connection_succeeds`  
- `test_ws_unauthenticated_connection_returns_403`  
- `test_quote_tick_event_reaches_subscribed_client`

**Done when:** open `/dashboard` in browser, see live ticks updating without page refresh.

**Fallback:** if WS over WSS on Render is flaky, fall back to polling `/quotes/{symbol}/latest` every 3s; document trade-off; mention in interview.

**Reuse:** WS fan-out pattern from Nexus.ai (cite in CREDITS.md).

### Feature 2.2 — React Flow DAG visualizer component (2.5h)

**Goal:** a `<DAGVisualizer>` React component that displays 5 nodes (MarketData, News, Forecast, Risk, Alert) with edges, and updates each node's visual state from `dag_event` WS messages.

**Files:**  
- `frontend/src/components/DAGVisualizer.tsx`  
- `frontend/src/components/AgentNode.tsx` (custom React Flow node)  
- `frontend/src/lib/dag-store.ts` (Zustand: `{nodes, edges, applyEvent(event)}`)  
- `frontend/src/lib/types.ts` (DAG event types matching backend)

**Steps:**  
1. Define static layout: 5 nodes in a fixed graph (MarketData → News, MarketData → Forecast, News → Risk, Forecast → Risk, Risk → Alert)  
2. `AgentNode` renders: name, status badge (idle/running/done/error), token count + latency on hover  
3. `dag-store.applyEvent()`: on `running` → set node status, animate; on `done` → set tokens/latency/cost; on `error` → red badge  
4. React Flow `<ReactFlow>` with custom nodeTypes, fitView, no controls (read-only graph)  
5. Edges: `animated: true` while source node is running

**Tests:** Vitest snapshot of `<AgentNode>` in each state.

**Done when:** manually pushing test events to dag-store causes the visualizer to animate correctly.

**Fallback:** if React Flow is too heavy/breaks, drop to a hand-rolled 5-circle SVG with framer-motion transitions; functionally equivalent for demo.

**Reuse:** node-state pattern adopted from `virattt/ai-hedge-fund` (cite in CREDITS.md).

### Feature 2.3 — Hand-rolled DAG executor + 5 agent nodes (3.0h)

**Goal:** typing an NL query triggers a backend DAG run; each node executes (MarketData first, News + Forecast in parallel, then Risk, then Alert); each node emits WS events; the synthesized answer is sent back.

**Files:**  
- `backend/app/agents/__init__.py`  
- `backend/app/agents/state.py` (`AgentState` TypedDict)  
- `backend/app/agents/executor.py` (topological sort, asyncio.gather, WS event emit)  
- `backend/app/agents/market_data.py`  
- `backend/app/agents/news.py`  
- `backend/app/agents/forecast.py`  
- `backend/app/agents/risk.py`  
- `backend/app/agents/alert.py`  
- `backend/app/services/gemini_client.py` (with DEMO_MODE switch)  
- `backend/app/services/finnhub_client.py`  
- `backend/app/services/prophet_service.py`  
- `backend/app/routes/query.py` (`POST /query`)  
- `backend/app/prompts/news_sentiment.md`, `risk_synthesis.md`, etc.

**Steps:**  
1. Implement `executor.run_dag(nodes, state, on_event)` — see `docs/adr/0001`  
2. Each node implements `async def run(state) -> state`; emits events via `on_event` callback  
3. `MarketDataNode`: fetches last 30 days from yfinance, recent quotes from quote_ticks  
4. `NewsNode`: Finnhub news for symbol + Gemini sentiment scoring per headline (one batched call)  
5. `ForecastNode`: Prophet fit on 30d closes, 7-day projection, MAPE on holdout  
6. `RiskNode`: Gemini call combining vol + sentiment → risk score 0-1  
7. `AlertNode`: check if any user threshold tripped; emit WS alert if so  
8. `POST /query` endpoint: starts a run, returns 202 with `run_id`; events stream over WS

**Tests:**  
- `test_executor_topological_order_correct`  
- `test_executor_runs_siblings_in_parallel`  
- `test_executor_failed_node_marks_downstream_skipped`  
- `test_market_data_node_returns_recent_quotes`  
- `test_news_node_with_demo_fixture_returns_sentiment`  
- `test_forecast_node_with_30d_history_produces_projection`  
- `test_risk_node_combines_vol_and_sentiment`  
- `test_alert_node_fires_when_threshold_crossed`  
- Cassette files in `tests/cassettes/` for each LLM call

**Done when:** `curl -X POST /query -d '{"query":"...", "symbol":"AAPL"}'` returns 202; WS receives 5 dag_event messages; final synthesized answer is on the WS.

**Fallback:**  
- If Prophet build fails → swap to `statsmodels.tsa.holtwinters.ExponentialSmoothing` (no dep change; works on the same DataFrame). Document in ADR-0002 update.  
- If parallel execution introduces race conditions → fall back to sequential; document in ADR; the demo still works.

### Feature 2.4 — Position entity + Holdings card + live P&L (1.5h)

**Goal:** users can add a Position (symbol, qty, avg_cost); the dashboard shows a Holdings card that recomputes unrealized P&L on every quote tick.

**Files:**  
- `backend/app/routes/positions.py` (`POST /positions`, `GET /positions`, `DELETE /positions/{id}`)  
- `backend/app/schemas/position.py` (`PositionIn`, `PositionOut`)  
- `frontend/src/components/HoldingsCard.tsx`  
- `frontend/src/components/AddPositionForm.tsx`  
- `frontend/src/lib/queries/positions.ts` (TanStack Query hooks)

**Steps:**  
1. Backend: 3 routes (create, list, delete); ownership check (user_id from `get_current_user`)  
2. `PositionOut` includes computed `unrealized_pnl_pct` if a recent quote_tick exists  
3. Frontend: `HoldingsCard` subscribes to `quote_tick` WS events for held symbols and recomputes P&L client-side (faster than backend roundtrip)  
4. Form for adding new position via shadcn Sheet

**Tests:**  
- `test_create_position_persists`  
- `test_create_position_with_negative_qty_returns_422`  
- `test_list_positions_returns_only_own`  
- `test_delete_position_owned_by_other_user_returns_403`

**Done when:** add NVDA 10 @ $920 in UI → card appears showing live P&L that updates with each tick.

**Fallback:** if P&L math is buggy under DEMO_MODE (fixture quotes don't match real prices), default to "—" with a tooltip "P&L unavailable in demo mode."

### Feature 2.5 — Candlestick chart + Prophet forecast overlay (1.5h)

**Goal:** clicking a watchlist ticker shows a candlestick chart with the last 30 days plus a forecast cone overlay for the next 7 days.

**Files:**  
- `frontend/src/components/CandleChart.tsx` (lightweight-charts wrapper)  
- `frontend/src/components/ForecastOverlay.tsx`  
- `frontend/src/lib/queries/quotes.ts` (history hook)  
- `frontend/src/lib/queries/forecast.ts` (forecast hook)  
- `backend/app/routes/forecast.py` (`GET /forecast/{symbol}`)  
- `backend/app/schemas/forecast.py` (`ForecastOut`)

**Steps:**  
1. Backend: `GET /forecast/{symbol}` calls `prophet_service.forecast(history_df)` → returns array of `{ts, yhat, yhat_lower, yhat_upper}` + MAPE  
2. Frontend: `CandleChart` uses lightweight-charts; subscribes to live ticks for the open candle; renders historical candles  
3. `ForecastOverlay`: line + shaded band on the same chart for `yhat_lower..yhat_upper`  
4. If MAPE > 15% → hide overlay, show "insufficient signal" badge instead

**Tests:**  
- `test_forecast_endpoint_returns_7_days`  
- `test_forecast_with_insufficient_history_returns_400`  
- `test_forecast_high_mape_response_marked_unreliable`

**Done when:** click AAPL in watchlist → chart shows 30d candles + 7d forecast cone (or "insufficient signal" banner).

**Fallback:** if lightweight-charts is finicky, fall back to Recharts `ComposedChart` with `Area` + `Line`. Less authentic but cleaner.

### Feature 2.6 — NL query bar wired to DAG (1.0h)

**Goal:** a text input on the dashboard sends queries to `POST /query` and shows the streaming answer.

**Files:**  
- `frontend/src/components/NLQueryBar.tsx`  
- `frontend/src/components/AnswerPanel.tsx`  
- `frontend/src/lib/queries/query.ts`

**Steps:**  
1. `NLQueryBar`: shadcn Input + submit button; on submit → POST `/query` → store `run_id` in dag-store  
2. WS subscriber filters `dag_event` for matching `run_id` → updates DAG visualizer  
3. Final synthesized answer event → `AnswerPanel` renders with citations  
4. Loading state: visualizer pulses while DAG runs; answer panel shows skeleton

**Tests:** smoke test manually.

**Done when:** type "Should I worry about TSLA today?" → DAG visualizer animates 5 nodes → answer renders.

### Feature 2.7 — UI design tokens via ui-ux-pro-max (0.5h)

**Goal:** lock the accent color, chart palette, and heading font pairing for the rest of the build, without rewriting the surface ladder.

**Files:**  
- `frontend/src/styles/tokens.ts` (new)  
- `frontend/tailwind.config.ts` (extend `theme.colors.accent`, `theme.fontFamily.heading`)

**Steps:**  
1. In Claude Code (Wave 2 ui-ux-pro-max already installed), paste the scoped prompt from `docs/UI-INSPIRATION.md` §8.  
2. Capture the output: 1 accent hex, 5 chart-palette hexes, 1 font pairing.  
3. Write `tokens.ts` exporting these constants; reference from Tailwind config.  
4. Commit; do NOT touch tokens again this build.

**Done when:** `tokens.ts` exports `ACCENT`, `CHART_PALETTE`, `HEADING_FONT`; the dashboard uses them.  
**Fallback:** if ui-ux-pro-max output looks off (e.g., low contrast), fall back to Tailwind `sky-500` accent + 5-color sequential palette `[sky, emerald, amber, fuchsia, rose]`. Document in CREDITS.md.

### Feature 2.8 — High-impact UI polish (1.5h)

**Goal:** ship the three "product taste" patterns from `docs/UI-INSPIRATION.md` §6.

**Files:**  
- `frontend/src/components/dag/PulseRing.tsx` — Framer Motion expanding ring on active DAG nodes  
- `frontend/src/components/CandleChart.tsx` — add cursor-following crosshair overlay (top-left card with OHLC + change%)  
- `frontend/src/components/HoldingsCard.tsx` — number-flash animation on P&L tick

**Steps:**  
1. PulseRing: `<motion.div animate={{ scale: [1, 1.4], opacity: [0.6, 0] }} transition={{ duration: 1.2, repeat: Infinity }} />` overlay on running React Flow nodes.  
2. Crosshair card: lightweight-charts `subscribeCrosshairMove` → render absolute-positioned shadcn `Card` with OHLC + change% in `tabular-nums`.  
3. P&L flash: Framer Motion key on `lastPrice`; `animate={{ backgroundColor: pnl>0 ? '#26a69a26' : '#ef535026' }}` decaying to transparent over 250 ms.  
4. Verify all three on the running app.

**Done when:** DAG fires → nodes pulse with expanding ring; hovering candle shows OHLC overlay; quote tick flashes the P&L row.  
**Fallback:** if Framer Motion bundle is heavy, drop the pulse ring (keep just the React Flow Node Status Indicator) and the P&L flash; ship just the crosshair (the highest-leverage of the three).

### Phase 2 HARD ship-or-cut gate

- [ ] React Flow DAG visualizer animates on real WS events  
- [ ] NL query end-to-end flow works (typed → DAG fires → answer renders)  
- [ ] Candlestick chart with forecast overlay renders for 3 seeded tickers  
- [ ] Holdings card shows live P&L on quote ticks  
- [ ] Demo flow steps 1-7 from `/demo-check` pass  
- [ ] `pytest -q` green (15+ tests)

**If any of the first 4 are red by end of Day 2: drop "Explain this candle" feature from Day 3, defer Google OAuth to documented stub, focus Day 3 entirely on hardening what exists.**

---

## Phase 3 — Differentiators (Day 3, ~10h)

**Theme:** the polish that elevates from "complete" to "memorable."

**GSD:**  
```  
/gsd:new-milestone  
> Differentiators: citations + Explain this candle + threshold alert + audit log + OAuth

/gsd:plan-phase 3  
/gsd:execute-phase 3  
/gsd:verify-work 3  
```

### Feature 3.1 — Citation chips + numeric blocker (2.0h)

**Goal:** every numeric claim in the synthesized answer renders as `"42% [3]"` with a hoverable source card; uncited numerics are blocked from rendering.

**Files:**  
- `frontend/src/components/CitationChip.tsx`  
- `frontend/src/lib/citation-guard.ts`  
- `backend/app/services/citation_guard.py` (mirror logic on BE for defense in depth)

**Steps:**  
1. Backend: when synthesize step builds the answer, embed citations like `[news:42]` or `[quote:AAPL:2026-04-29]`  
2. Backend regex: any output `\d+(\.\d+)?%?` not followed by `[...]` → log warning, replace with `[REDACTED]`  
3. Frontend `CitationChip`: parse `[news:42]` → render as `<sup>[3]</sup>` with hover-card showing news headline + URL  
4. Frontend regex: same as backend, last line of defense (cite Perplexity-Clone pattern)

**Tests:**  
- `test_citation_guard_blocks_uncited_percentage`  
- `test_citation_guard_allows_cited_number`  
- `test_citation_resolves_to_existing_news_item`  
- Frontend Vitest snapshot of CitationChip with/without source

**Done when:** demo flow step 5 from `/demo-check` passes; manually inject an uncited number → confirm it's redacted.

**Reuse:** Perplexity-Clone citation chip pattern (cite in CREDITS.md).

### Feature 3.2 — News feed + Gemini sentiment chips (1.5h)

**Goal:** clicking a watchlist ticker shows a list of 5 recent news items with colored sentiment badges (-1 red → 0 grey → +1 green).

**Files:**  
- `frontend/src/components/NewsList.tsx`  
- `frontend/src/components/SentimentBadge.tsx`  
- `frontend/src/lib/queries/news.ts`  
- `backend/app/routes/news.py` (`GET /news/{symbol}?limit=5`)

**Steps:**  
1. News is already populated by NewsNode runs + a separate scheduled refresh (every 1h or on watchlist add)  
2. `GET /news/{symbol}` returns last 5 ordered by `published_at desc`  
3. `SentimentBadge`: shadcn Badge with color from sentiment_score (red ≤ -0.3, grey, green ≥ +0.3)  
4. `NewsList`: renders 5 items with headline, source, published_at, badge, link

**Tests:** `test_news_list_returns_5_most_recent`, `test_sentiment_badge_colors`

**Done when:** clicking AAPL shows 5 headlines with sentiment chips.

### Feature 3.3 — "Explain this candle" click handler (1.0h)

**Goal:** clicking any candle on the chart re-fires the DAG with that timestamp scope; the answer updates.

**Files:**  
- `frontend/src/components/CandleChart.tsx` (add click handler)  
- `backend/app/routes/query.py` (extend `POST /query` with optional `at_timestamp` param)  
- `backend/app/agents/state.py` (extend AgentState with optional `at_timestamp`)  
- `backend/app/agents/news.py` (filter news ≤ at_timestamp)  
- `backend/app/agents/forecast.py` (use only data ≤ at_timestamp)

**Steps:**  
1. Click handler on CandleChart: emits a synthesized query "Explain {symbol} on {date}"  
2. Backend nodes filter inputs by `at_timestamp` if present  
3. Visualizer re-fires; answer panel shows new content with day-specific citations

**Tests:** `test_query_with_at_timestamp_constrains_news_window`

**Done when:** click any candle → DAG fires → answer is about that day specifically.

**Fallback:** if Day-2 ship-or-cut gate failed, this feature is dropped entirely.

### Feature 3.4 — One firing threshold alert + WS toast (1.0h)

**Goal:** when NVDA crosses $950 (pre-seeded threshold), a toast appears in the UI.

**Files:**  
- `backend/app/agents/alert.py` (already exists; verify it triggers from poller events too, not only DAG runs)  
- `backend/app/services/alert_evaluator.py` (poller-side: on each tick, check thresholds for that user/symbol)  
- `frontend/src/components/AlertToast.tsx`  
- `backend/app/scripts/seed_demo.py` (seed user's threshold = $950 for NVDA)

**Steps:**  
1. On every quote_tick poll, AlertEvaluator checks if any active threshold flipped  
2. If flipped → emit WS `alert` event with details  
3. Frontend WS subscriber → toast bottom-right via shadcn `useToast()`

**Tests:** `test_alert_fires_on_threshold_cross`, `test_alert_does_not_fire_twice`

**Done when:** seeded threshold + a tick that crosses it → toast visible.

### Feature 3.5 — Audit log middleware + admin shadcn table (1.5h)

**Goal:** every AI call writes a row to `audit_events`; `/audit` page shows the last 50 in a table.

**Files:**  
- `backend/app/middleware/audit.py` (FastAPI middleware? OR explicit calls in agent nodes — pick the simpler)  
- `backend/app/routes/audit.py` (`GET /audit?limit=50`)  
- `frontend/src/pages/Audit.tsx`  
- `frontend/src/components/AuditTable.tsx`

**Steps:**  
1. Each agent node, after a Gemini call, computes `prompt_hash = sha256(prompt)`, gets `usage_metadata`, computes `cost_inr` (Gemini 2.0 Flash pricing × token count × USD-INR rate from a constant)  
2. Insert into `audit_events`: user_id, run_id, node, model, prompt_hash, tokens_in, tokens_out, latency_ms, cost_inr, ts  
3. `GET /audit` returns last 50 for current user, shaped as `AuditEventOut`  
4. Frontend page: shadcn Table with columns: ts, node, model, tokens_in, tokens_out, latency, cost_inr; sortable

**Tests:**  
- `test_audit_event_written_on_gemini_call`  
- `test_audit_event_only_visible_to_owner`  
- `test_audit_event_no_update_path` (confirm no UPDATE/DELETE method exists on the model service)

**Done when:** run a query → visit /audit → see 4-5 fresh rows (one per node).

### Feature 3.6 — Google OAuth via authlib (3.0h, timeboxed)

**Goal:** the login page has a "Sign in with Google" button that completes OAuth and issues a FinSight JWT.

**Files:**  
- `backend/app/auth/oauth.py`  
- `backend/app/routes/auth.py` (extend with `/auth/google/login`, `/auth/google/callback`)  
- `frontend/src/pages/Login.tsx` (add button)

**Steps:**  
1. Register OAuth client at https://console.cloud.google.com → get client ID + secret → add to `.env` and Render env  
2. authlib `OAuth().register('google', ...)` with discovery URL  
3. `/auth/google/login` redirects to Google  
4. `/auth/google/callback` receives code → exchanges for ID token → upserts User → returns same `TokenOut`  
5. Frontend: button links to `/auth/google/login`

**Tests:** `test_oauth_callback_creates_user_if_not_exists`, `test_oauth_callback_returns_jwt`

**Done when:** click "Sign in with Google" in browser → Google consent → land on /dashboard authenticated.

**Fallback:** at hour 10:00 (end of day), if OAuth is broken:  
- Ship a documented stub: button visible, on click shows tooltip "OAuth coming soon — use email/password for now"  
- Add an entry to "What I'd build with two more weeks" in README  
- Move on; do not let OAuth eat Day 4

### Phase 3 exit gate

- [ ] All 6 standout features either shipped OR explicitly stubbed-and-documented  
- [ ] Demo flow steps 1-10 from `/demo-check` pass  
- [ ] `pytest -q` green (25+ tests)  
- [ ] Audit log table populates on every NL query  
- [ ] Threshold alert toast fires  
- [ ] No outstanding 🔴 in COMPLIANCE-MATRIX.md  
- [ ] Code committed; pushed; Render auto-redeployed

---

## Phase 4 — Polish + submit (Day 4, ~10h)

**Theme:** what makes the submission feel professional. No new features.

**GSD:** prefer `/gsd:quick "<task>"` for these small atomic tasks.

### Feature 4.1 — Render deploy hardening (2.0h)

**Goal:** Render production deployment is reliable enough to demo live and survive interview.

**Steps:**  
1. Add `worker` service on Render (background worker dyno) for the poller — separate from web service  
2. Verify CORS allow-list points to the deployed FE URL exactly (no trailing slash, https)  
3. Add WS sticky session config if Render supports it (free tier: just hope; Starter: $7 enables sticky)  
4. Add UptimeRobot ping on `/healthz` every 5 min to keep service warm  
5. Verify alembic migrations ran: `Render Shell → alembic current`

**Done when:** open hosted URL in incognito → /healthz returns 200; WS connects; everything from the demo flow works on the public URL.

### Feature 4.2 — Demo-mode fixture pack (1.5h)

**Goal:** `DEMO_MODE=1` produces deterministic agent output; recordings always work.

**Steps:**  
1. Run `python -m app.scripts.record_demo_fixtures` against live APIs with 3 NL queries pre-defined  
2. Inspect saved `cache/*.json` files for sanity (no PII, no API keys leaked)  
3. `git add backend/app/services/demo_fixtures/cache/`  
4. Commit  
5. Set `DEMO_MODE=1` in Render env vars  
6. Re-test the 10-step demo flow on hosted URL with DEMO_MODE on

**Done when:** demo flow from production URL is fully deterministic.

### Feature 4.3 — Documentation pass (1.5h)

**Steps:**  
1. Update `README.md`: paste hosted URL, add demo GIF (record a 10s screen capture), update "What I'd build with two more weeks"  
2. Update `CREDITS.md` with every borrowed snippet  
3. Verify `docs/DESIGN.md` matches actual implementation (no drift)  
4. Verify `docs/COMPLIANCE-MATRIX.md` shows all green  
5. Spell-check, link-check (gh actions can run linkcheck)

**Done when:** all documentation reflects the shipped state of the code.

### Feature 4.4 — Video record + edit (3.0h)

**Steps:**  
1. Run `/demo-check` — confirm all 10 steps green  
2. Pre-warm `/healthz` 30s before pressing record  
3. Open `demo/script.md` in a side window  
4. Record take 1: full 4 minutes, no cuts  
5. Watch take 1; identify what to fix  
6. Record take 2 with fixes  
7. (Optional) take 3 if take 2 is flat  
8. Trim dead air > 1s in editor (Loom or any free editor)  
9. Add chapter markers  
10. Upload to YouTube (Unlisted) or Loom  
11. Paste URL into README

**Done when:** video < 5min, opens with DAG firing, closes with the rehearsed 30-sec pitch.

### Feature 4.5 — Bug bash on demo flow (1.0h)

**Steps:**  
1. Open hosted URL in 3 different browsers  
2. Run all 10 demo-check steps in each  
3. Run prompt-injection canary test  
4. Try edge cases: missing token, expired token, invalid symbol, symbol with no news, market closed  
5. Open DevTools Network tab; confirm no leaked secrets, no 500s

**Done when:** all 10 steps pass in Chrome AND Firefox; no console errors; no 500s.

### Feature 4.6 — Final deploy verify (0.5h)

**Steps:**  
1. Run `git log --oneline | wc -l` → should be 30+ commits across 7+ days  
2. Run `git push` (the only push of the week — get user approval per CLAUDE.md guardrails)  
3. Render auto-redeploys; wait for build  
4. Hit `/healthz` → 200  
5. Hit `/auth/login` with seed creds → token  
6. Run one full DAG via UI

**Done when:** everything green on the deploy hash that matches HEAD.

### Feature 4.7 — Submit to Google Form (0.5h)

**Steps:**  
1. Open submission form (URL in user's email)  
2. Paste GitHub repo URL (public)  
3. Paste video URL (YouTube unlisted or Loom)  
4. Paste hosted Render URL  
5. Fill any free-text fields with the README's first paragraph  
6. Submit  
7. Take a screenshot of the submission confirmation  
8. Email yourself the screenshot for record

**Done when:** form submitted; confirmation screenshot saved.

### Phase 4 exit gate (final compliance)

- [ ] All rows in `docs/COMPLIANCE-MATRIX.md` show ✅ or ⚪ (no 🔴, no 🟡 unreviewed)  
- [ ] README first screen has hero GIF + hosted link + 60-sec quickstart  
- [ ] `docs/DESIGN.md` exists, 8 sections, < 4 pages  
- [ ] 2 ADRs exist with full Decision + Consequences sections  
- [ ] `CREDITS.md` covers every borrowed snippet > 10 LOC  
- [ ] Video < 5 min, opens with DAG firing, no face-cam intro, recorded 30-sec close  
- [ ] Render hosted link clicks through to a working dashboard  
- [ ] `DEMO_MODE=1` produces deterministic output  
- [ ] GitHub commit history dated across ≥ 7 days  
- [ ] CI green (pytest, tsc, ruff)  
- [ ] Form submitted; confirmation saved  
- [ ] No `.env` in git history (`git log -S 'GEMINI_API_KEY' --all` → empty)

---

## Phase 5 — Interview prep (post-submission, ~3h)

**Theme:** if shortlisted, you walk in cold and present without nerves.

### 5.1 — Rehearse the 5 weapon answers (1.5h)

Out loud, twice each, while looking at the dashboard:

1. **DAG callback (Visual Workflow Orchestrator)** — `INTERVIEW-PREP.md` Q4  
2. **WebSockets callback (Nexus.ai)** — Q8  
3. **Gemini multimodal callback (VoxRay)** — Q6  
4. **Security callback (DoS disclosure)** — Q5  
5. **Production rigor callback (EduLearn audit)** — embedded in Q1, Q9

Time each answer. None should run > 60 seconds.

### 5.2 — 2-hour study list (1.5h)

These are the topics where the interviewer can push you into a corner. Spend 30 min on each:

1. **Prophet's additive model math** — read [Prophet paper §3](https://peerj.com/preprints/3190/). Memorize: trend (piecewise linear, Laplace prior on changepoints) + seasonality (Fourier) + holiday + error.  
2. **Prompt-injection taxonomy** — read [Simon Willison's catalog](https://simonwillison.net/series/prompt-injection/). Map each known attack to D1-D7 in your defenses.  
3. **JWT rotation patterns** — be able to explain *why* FinSight has only access tokens, and what would change with refresh tokens.

Optional 4th hour:  
4. **Brush up on Pydantic v2 changes** — Field validators, model_config, model_dump_json. Reviewers love a "why Pydantic v2 not v1" question.

---

## Final checklists (one place to scan)

### Compliance checklist (must all be green)

| # | Item | Status |  
|---|---|---|  
| 1 | All PDF mandatory rows in COMPLIANCE-MATRIX.md show ✅ |  |  
| 2 | README first screen: hero GIF + hosted link + quickstart |  |  
| 3 | `docs/DESIGN.md` exists, 8 sections, ≤ 4 pages |  |  
| 4 | 2 ADRs exist with full Decision + Consequences |  |  
| 5 | `CREDITS.md` covers every borrowed snippet |  |  
| 6 | Video < 5min, opens with DAG firing |  |  
| 7 | Render hosted link works on cold-start clean browser |  |  
| 8 | DEMO_MODE=1 produces deterministic output |  |  
| 9 | GitHub commit history dated across ≥ 7 days |  |  
| 10 | CI green: pytest + tsc + ruff |  |

### 10-step demo verification flow (run before recording)

| # | Step | Pass |  
|---|---|---|  
| 1 | Open hosted URL → login → dashboard loads in < 3s |  |  
| 2 | Watchlist has 3 seeded tickers → live ticks visible |  |  
| 3 | Type "Should I worry about TSLA today?" → DAG animates 5 nodes |  |  
| 4 | Answer renders with [1][2][3] citations; hover shows news source |  |  
| 5 | Confirm uncited numeric is blocked from rendering |  |  
| 6 | Click red candle → DAG re-fires with timestamp scope |  |  
| 7 | Add Position(NVDA, 10 @ $920) → Holdings card shows live P&L |  |  
| 8 | Threshold alert (NVDA > $950) fires → toast appears |  |  
| 9 | Visit /audit → last 5 AI calls with model + tokens + cost_inr |  |  
| 10 | Toggle DEMO_MODE off → re-run #3 with live Gemini → still works |  |

---

## Risk ledger (top 7 risks + mitigation + fallback)

| # | Risk | Likelihood | Impact | Mitigation | Fallback |  
|---|---|---|---|---|---|  
| 1 | Render free-tier cold start kills WS mid-demo | High | Demo unwatchable | Pre-warm via curl + UptimeRobot ping | Record video locally; share Loom |  
| 2 | Gemini free-tier 429 mid-recording | Medium | Demo breaks | DEMO_MODE=1 for video | Fixture replay; live mode for one Q&A |  
| 3 | Prophet build fails in Docker | Medium | Forecast feature dead | Use prophet wheels (not fbprophet) | Swap to statsmodels ARIMA; document |  
| 4 | OAuth callback URI mismatch on Render | High | OAuth doesn't work | Day-3 timebox | Stub button; document; ship Day 4 |  
| 5 | TimescaleDB extension missing on Render Postgres | Medium | Hypertable feature dead | Use Neon (supports TS extension on free) | Vanilla Postgres + index; document deviation |  
| 6 | NL query path hallucinates uncited numbers | Medium | Reviewer sees a wrong number on camera | CitationGuard backend + frontend | Block render entirely; show "redacted" |  
| 7 | Plagiarism suspicion on a borrowed pattern | Low | Disqualification | CREDITS.md with permalinks; commits across 7 days | Cite during interview proactively |

---

## What this plan is NOT

- A specification of every line of code — that's the job of `spec-writer` agent and the dev session  
- A guarantee — fallback ladders exist because Day 2 will not look exactly like Day 2 in plan  
- An interview script — see `INTERVIEW-PREP.md` for that  
- A retrospective — write that in the README's "what I'd build with two more weeks" section

## What this plan IS

- The single source of truth for what ships and when  
- The basis for `/gsd:plan-phase` invocations  
- The compliance contract: when each row in COMPLIANCE-MATRIX.md flips to ✅, this plan was successful  
- The fallback choreography: when X breaks, I drop to Y, document in ADR-N, and move on

---

**Built:** 2026-04-29 by Utkarsh Wasan with assistance from Claude Code (Anthropic).  
**License:** MIT.  
**Next step:** Phase 0 starts on the build machine. Good luck.  
```