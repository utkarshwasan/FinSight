# FinSight AI — Real-Time Financial Insights Dashboard

> **5-agent DAG · Citation-enforced AI answers · Live streaming DAG visualizer**  
> Nebula9.ai Full Stack GenAI Intern Assessment — Project #5 · Submission: 8 May 2026

> ⚠️ **Educational use only.** Forecasts are illustrative and not investment advice. No real trading is performed. Data is delayed 15+ minutes from free-tier public APIs.

---

## What It Does

Type a natural-language question like *"Should I worry about TSLA today?"* and watch five AI agents reason about it in real time:

```
MarketData ──► News   ──┐
             Forecast ──┤──► Risk ──► Alert
```

Every step streams token counts and latency to a live DAG visualizer. Every numeric claim in the answer is a **clickable citation chip** — uncited numbers are blocked from rendering by `CitationGuard`.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | FastAPI · SQLAlchemy (async) · Alembic · Postgres + TimescaleDB |
| **AI** | Google Gemini 2.0 Flash · Holt-Winters forecasting · hand-rolled DAG executor |
| **Data** | yfinance · Finnhub · `quote_ticks` TimescaleDB hypertable |
| **Auth** | JWT (HS256, 60-min) · bcrypt (cost 12) · Google OAuth via authlib |
| **Frontend** | React 18 + Vite + TypeScript · TailwindCSS · shadcn/ui · TanStack Query |
| **Real-time** | WebSocket hub (per-user asyncio.Queue) · React Flow DAG visualizer |
| **Charts** | Recharts · lightweight-charts |
| **State** | Zustand |
| **Infra** | Docker Compose · Render · GitHub Actions (pytest + tsc + ruff) |

---

## Quickstart (Docker — recommended)

### Prerequisites
- Docker + Docker Compose v2
- API keys (2 minutes to get — see below)

### 1. Clone and configure

```bash
git clone https://github.com/utkarshwasan/FinSight.git
cd FinSight
cp .env.example .env
```

Open `.env` and fill in:

```dotenv
GEMINI_API_KEY=AIza...        # from https://aistudio.google.com/app/apikey
FINNHUB_API_KEY=...           # from https://finnhub.io/register → Dashboard → API Key
JWT_SECRET=...                # run: python -c "import secrets; print(secrets.token_hex(32))"
```

> **No API keys yet?** Set `DEMO_MODE=1` in `.env` to use fixture data — no external calls made.

### 2. Start everything

```bash
docker compose up --build
```

First boot takes ~60s (Postgres init + migrations + frontend build).

### 3. Open the app

| Service | URL |
|---|---|
| **Dashboard** | http://localhost:5173 |
| **API docs (Swagger)** | http://localhost:8000/docs |
| **Health check** | http://localhost:8000/healthz |

### 4. Demo login

```
Email:    demo@finsight.ai
Password: Demo@12345
```

---

## Local Development (without Docker)

### Backend

**Requirements:** Python 3.12+, [uv](https://docs.astral.sh/uv/), running Postgres with TimescaleDB

```bash
cd backend

# Install dependencies
uv sync

# Run migrations
uv run alembic upgrade head

# Start server (hot-reload)
uv run uvicorn app.main:app --reload --port 8000
```

### Frontend

**Requirements:** Node 20+, pnpm

```bash
# Install dependencies
pnpm --dir frontend install

# Start dev server (hot-reload)
pnpm --dir frontend dev
```

Frontend runs on http://localhost:5173 and proxies `/api/*` to `:8000`.

---

## Getting API Keys

### Gemini (Google AI Studio)
1. Go to https://aistudio.google.com/app/apikey
2. Click **Create API key** → select or create a project
3. Copy the key (starts with `AIza...`)
4. Free tier: **15 req/min · 1M tokens/day** — sufficient for demo

### Finnhub
1. Go to https://finnhub.io/register
2. Sign up with email (free account, no credit card)
3. Dashboard → **API Key** → copy your key
4. Free tier: **60 calls/min** — sufficient for demo

### JWT Secret
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_SECRET` | ✅ | — | ≥32-char random hex; signs all JWTs |
| `GEMINI_API_KEY` | ✅* | — | Google AI Studio key |
| `FINNHUB_API_KEY` | ✅* | — | Finnhub market data key |
| `DATABASE_URL` | ✅ | set by Docker | SQLAlchemy async Postgres URL |
| `DEMO_MODE` | — | `0` | `1` = fixture data, no external API calls |
| `SEED_DEMO_USER` | — | `1` | Seed `demo@finsight.ai` on startup |
| `RUN_POLLER` | — | `1` | Start quote tick poller on startup |
| `ALLOWED_ORIGINS` | — | localhost | CORS allowed origins (comma-separated) |
| `TIMESCALEDB_ENABLED` | — | `1` | `0` if running plain Postgres without extension |

*Not required when `DEMO_MODE=1`.

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | — | Create account |
| `POST` | `/auth/login` | — | Email/password → JWT |
| `GET` | `/auth/google` | — | Google OAuth redirect |
| `GET` | `/watchlist` | JWT | List watchlist symbols |
| `POST` | `/watchlist` | JWT | Add symbol |
| `DELETE` | `/watchlist/{id}` | JWT | Remove symbol |
| `GET` | `/positions` | JWT | List positions with live P&L |
| `POST` | `/positions` | JWT | Open position |
| `DELETE` | `/positions/{id}` | JWT | Close position |
| `GET` | `/quotes/{symbol}/latest` | JWT | Latest price tick |
| `GET` | `/quotes/{symbol}/history` | JWT | OHLCV history |
| `GET` | `/news/{symbol}` | JWT | Recent news + sentiment |
| `POST` | `/query/` | JWT | Submit NL query → DAG run |
| `GET` | `/audit` | JWT | Audit event log |
| `WS` | `/ws?token=<jwt>` | JWT | Real-time ticks + DAG events |
| `GET` | `/healthz` | — | Liveness check |

Full interactive docs: http://localhost:8000/docs

---

## 5-Node DAG Pipeline

```
                   ┌─────────────┐
                   │  MarketData │  fetches price + OHLCV history
                   └──────┬──────┘
              ┌────────────┴────────────┐
              ▼                         ▼
       ┌─────────────┐          ┌─────────────────┐
       │    News     │          │    Forecast      │  Holt-Winters 7-day
       │  + Sentiment│          │  (fallback: HW)  │
       └──────┬──────┘          └────────┬────────┘
              └────────────┬─────────────┘
                           ▼
                    ┌─────────────┐
                    │    Risk     │  Gemini scores 0.0–1.0
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │    Alert    │  fires toast if threshold crossed
                    └─────────────┘
```

Each node receives and mutates shared `AgentState`. The executor runs `News` and `Forecast` in parallel via `asyncio.gather`. Each step streams `{node, status, tokens, latency_ms, partial_output}` over WebSocket, powering the React Flow visualizer.

---

## Demo Walkthrough (10 steps)

1. Open http://localhost:5173 → login with `demo@finsight.ai / Demo@12345`
2. Overview dashboard shows 5 StatCards with live prices via WebSocket
3. Select a symbol from the watchlist (AAPL, NVDA, TSLA, MSFT, GOOGL pre-seeded)
4. In **AI Copilot**, type *"What is the trend for AAPL this week?"* → click Run
5. Watch 5 DAG nodes light up sequentially (MarketData → News+Forecast → Risk → Alert)
6. Answer appears with `[1]`, `[2]` citation chips — hover to see source headline
7. Navigate to **Forecast** — 7-day chart with confidence intervals
8. Navigate to **Positions** — open a position with alert threshold set
9. Wait for next tick — AlertToast fires when threshold crossed
10. Navigate to **News** — headlines with sentiment badges (green/red)

To run the automated checklist: `bash scripts/production_check.sh`

---

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| DAG executor | Hand-rolled (80 lines) | LangGraph is heavy for 5 nodes; full control over WS streaming. [ADR-0001](docs/adr/0001-handrolled-dag-vs-langgraph.md) |
| Forecasting | Holt-Winters (statsmodels) | Prophet wheel requires cmake compile; HW is lighter and sufficient for 7-day demo. [ADR-0002](docs/adr/0002-prophet-vs-lstm.md) |
| Time-series DB | TimescaleDB hypertable | Assessment requirement; `quote_ticks` partitioned by `ts` |
| Retrieval | Postgres ILIKE + Gemini re-rank | ~200 news items per ticker — no pgvector needed at this scale |
| Auth | JWT only (no refresh token) | Single-user 60-min session; refresh complexity not justified for assessment |

---

## Project Structure

```
FinSight/
├── backend/
│   ├── app/
│   │   ├── agents/          # 5 DAG node implementations
│   │   ├── api/endpoints/   # FastAPI route handlers
│   │   ├── models.py        # SQLAlchemy ORM (6 entities)
│   │   ├── schemas.py       # Pydantic DTOs
│   │   ├── services/        # gemini_client, finnhub_client, citation_guard, ws_hub
│   │   └── core/            # DAG executor, JWT, config
│   ├── migrations/          # Alembic revisions
│   └── tests/
├── frontend/
│   └── src/
│       ├── components/      # Dashboard, DAGVisualizer, AICopilot, Charts
│       ├── lib/             # api client, TanStack Query hooks
│       └── store/           # Zustand (wsStore, authStore)
├── docs/
│   ├── adr/                 # Architecture Decision Records
│   ├── DESIGN.md
│   └── COMPLIANCE-MATRIX.md
├── demo/
│   └── script.md            # Recorded demo script
├── scripts/
│   └── production_check.sh  # 10-step automated smoke test
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
├── render.yaml              # Render deployment config
└── .env.example
```

---

## License

MIT — see [LICENSE](LICENSE).

---

*Author: Utkarsh Wasan · utkarsh.wasan@cognizant.com*
