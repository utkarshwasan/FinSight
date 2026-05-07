# FinSight AI — Real-Time Financial Insights Dashboard

> **5-agent DAG · Citation-enforced AI answers · Live streaming DAG visualizer**  
> Nebula9.ai Full Stack GenAI Intern Assessment — Project #5 · Submission: 8 May 2026

> ⚠️ **Educational use only.** Forecasts are illustrative and not investment advice. No real trading is performed. Data is delayed 15+ minutes from free-tier public APIs.

---

## What It Does

Type a natural-language question like _"Should I worry about TSLA today?"_ and watch five AI agents reason about it in real time:

```
MarketData ──► News   ──┐
             Forecast ──┤──► Risk ──► Alert
```

Every step streams token counts and latency to a live DAG visualizer. Every numeric claim in the answer is a **clickable citation chip** — uncited numbers are blocked from rendering by `CitationGuard`.

---

## Tech Stack

| Layer         | Technologies                                                            |
| ------------- | ----------------------------------------------------------------------- |
| **Backend**   | FastAPI · SQLAlchemy (async) · Alembic · Postgres + TimescaleDB         |
| **AI**        | **Groq (Llama 3.3 70B)** · Gemini 2.0 Flash · Holt-Winters forecasting  |
| **Data**      | yfinance · Finnhub · `quote_ticks` TimescaleDB hypertable               |
| **Auth**      | JWT (HS256, 60-min) · bcrypt (cost 12) · Google OAuth via authlib       |
| **Frontend**  | React 18 + Vite + TypeScript · TailwindCSS · shadcn/ui · TanStack Query |
| **Real-time** | WebSocket hub (per-user asyncio.Queue) · React Flow DAG visualizer      |
| **Charts**    | Recharts · lightweight-charts                                           |
| **State**     | Zustand                                                                 |
| **Infra**     | Docker Compose · Render · GitHub Actions (pytest + tsc + ruff)          |

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
GROQ_API_KEY=gsk_...          # Primary LLM (from https://console.groq.com/keys)
GEMINI_API_KEY=AIza...        # Fallback LLM (from https://aistudio.google.com/app/apikey)
FINNHUB_API_KEY=...           # Market News (from https://finnhub.io/register)
JWT_SECRET=...                # run: python -c "import secrets; print(secrets.token_hex(32))"
```

> **No API keys yet?** Set `DEMO_MODE=1` in `.env` to use fixture data — no external calls made.

### 2. Start everything

```bash
docker compose up --build
```

First boot takes ~60s (Postgres init + migrations + frontend build).

### 3. Open the app

| Service                | URL                           |
| ---------------------- | ----------------------------- |
| **Dashboard**          | http://localhost:5173         |
| **API docs (Swagger)** | http://localhost:8000/docs    |
| **Health check**       | http://localhost:8000/healthz |

### 4. Demo login

```
Email:    demo@finsight.ai
Password: Demo@12345
```

---

## Hardened Features (Production-Ready)

- **AI Resilience**: 5-tier exponential backoff for 429 "Rate Limit" errors in both Groq and Gemini clients.
- **Auth Hardening**: Global Axios interceptor handles 401/403 errors by clearing session storage and redirecting to login, preventing infinite loop "deadlocks".
- **Live Data Poller**: `quote_poller.py` fetches high-frequency ticks from `yfinance` every 15s and broadcasts them via WebSockets.
- **Time-Series Engine**: `quote_ticks` are stored in a TimescaleDB hypertable for efficient historical rendering and forecasting.

---

## Local Development (without Docker)

### Prerequisites

- **Python 3.12+** & [uv](https://docs.astral.sh/uv/)
- **Node.js 20+** & **pnpm**
- **PostgreSQL 15+** with [TimescaleDB extension](https://docs.timescale.com/self-hosted/latest/install/)

### 1. Database Setup

1.  Create a Postgres database named `finsight`.
2.  Enable TimescaleDB: `CREATE EXTENSION IF NOT EXISTS timescaledb;`.
3.  Ensure your `DATABASE_URL` in `.env` reflects your local credentials.

### 2. Backend Setup

```bash
cd backend
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8000
```

### 3. Frontend Setup

```bash
cd frontend
pnpm install
pnpm dev
```

Frontend runs on http://localhost:5173 and proxies `/api/*` to `:8000`.

---

## API Endpoints

| Method   | Path                       | Auth | Description                  |
| -------- | -------------------------- | ---- | ---------------------------- |
| `POST`   | `/auth/register`           | —    | Create account               |
| `POST`   | `/auth/login`              | —    | Email/password → JWT         |
| `GET`    | `/auth/google`             | —    | Google OAuth redirect        |
| `GET`    | `/watchlist`               | JWT  | List watchlist symbols       |
| `POST`   | `/watchlist`               | JWT  | Add symbol                   |
| `DELETE` | `/watchlist/{id}`          | JWT  | Remove symbol                |
| `GET`    | `/positions`               | JWT  | List positions with live P&L |
| `POST`   | `/positions`               | JWT  | Open position                |
| `DELETE` | `/positions/{id}`          | JWT  | Close position               |
| `GET`    | `/quotes/{symbol}/latest`  | JWT  | Latest price tick            |
| `GET`    | `/quotes/{symbol}/history` | JWT  | OHLCV history                |
| `GET`    | `/news/{symbol}`           | JWT  | Recent news + sentiment      |
| `POST`   | `/query/`                  | JWT  | Submit NL query → DAG run    |
| `GET`    | `/audit`                   | JWT  | Audit event log              |
| `WS`     | `/ws?token=<jwt>`          | JWT  | Real-time ticks + DAG events |
| `GET`    | `/healthz`                 | —    | Liveness check               |

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
       │  + Sentiment│          │  (fallback: HW) │
       └──────┬──────┘          └────────┬────────┘
              └────────────┬─────────────┘
                           ▼
                    ┌─────────────┐
                    │    Risk     │  Groq/Gemini scores 0.0–1.0
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │    Alert    │  fires toast if threshold crossed
                    └─────────────┘
```

Each node receives and mutates shared `AgentState`. The executor runs `News` and `Forecast` in parallel via `asyncio.gather`. Each step streams `{node, status, tokens, latency_ms, partial_output}` over WebSocket, powering the React Flow visualizer.

---

## Demo Walkthrough

1. Open http://localhost:5173 → login with `demo@finsight.ai / Demo@12345`
2. Overview dashboard shows 5 StatCards with live prices via WebSocket (updates every 15s)
3. Select a symbol from the watchlist (AAPL, NVDA, TSLA, MSFT, GOOGL pre-seeded)
4. In **AI Copilot**, type _"What is the trend for AAPL this week?"_ → click Run
5. Watch 5 DAG nodes light up sequentially (MarketData → News+Forecast → Risk → Alert)
6. Answer appears with `[1]`, `[2]` citation chips — hover to see source headline
7. Navigate to **Forecast** — 7-day chart with confidence intervals
8. Navigate to **Positions** — open a position with alert threshold set
9. Wait for next tick — AlertToast fires when threshold crossed
10. Navigate to **News** — headlines with sentiment badges (green/red)

---

## Getting API Keys

### Groq (Primary LLM)

1. Go to https://console.groq.com/keys
2. Create an API key.
3. Provides high-speed Llama 3.3 70B inference.

### Gemini (Fallback LLM)

1. Go to https://aistudio.google.com/app/apikey
2. Click **Create API key**.
3. Free tier: **15 req/min · 1M tokens/day**.

### Finnhub (Market News)

1. Go to https://finnhub.io/register
2. Sign up for a free account.
3. Dashboard → **API Key**.

---

## Environment Variables Reference

| Variable          | Required | Default       | Description                               |
| ----------------- | -------- | ------------- | ----------------------------------------- |
| `JWT_SECRET`      | ✅       | —             | ≥32-char random hex; signs all JWTs       |
| `GROQ_API_KEY`    | ✅\*     | —             | Groq Cloud API key (Primary)              |
| `GEMINI_API_KEY`  | ✅\*     | —             | Google AI Studio key (Fallback)           |
| `FINNHUB_API_KEY` | ✅\*     | —             | Finnhub market data key                   |
| `DATABASE_URL`    | ✅       | set by Docker | SQLAlchemy async Postgres URL             |
| `DEMO_MODE`       | —        | `0`           | `1` = fixture data, no external API calls |
| `SEED_DEMO_USER`  | —        | `1`           | Seed `demo@finsight.ai` on startup        |
| `RUN_POLLER`      | —        | `1`           | Start quote tick poller on startup        |

\*Not required when `DEMO_MODE=1`.

---

## User Guide

### 1. Market Awareness

- **Live StatCards**: The top row shows real-time prices for pre-seeded symbols. Watch for the "flash" effect (green for up, red for down) every 15 seconds.
- **Watchlist**: Add your favorite tickers to track them across sessions. The system automatically starts polling any symbol added to your watchlist.
- **Interactive Charts**: Click any ticker to see a high-performance candle chart. Use the time range selector (1D, 1W, 1M, 1Y) to view historical trends.

### 2. AI Copilot (The Research DAG)

- **Ask Anything**: Use the Sparkles icon to open the Copilot. Ask questions like _"Is NVDA a good buy?"_ or _"What are the risks for TSLA?"_.
- **Visualize the Logic**: As the AI works, you'll see the 5-node DAG light up. This shows you exactly where the data is coming from (MarketData -> News/Forecast -> Risk -> Alert).
- **Verify with Citations**: Every numeric claim in the AI's answer has a bracketed number (e.g., `[1]`). Hover over it to see the specific data point or news headline that supports the claim.

### 3. Portfolio & Alerts

- **Positions**: Navigate to the Positions page to record your holdings.
- **Smart Alerts**: Set a "Price Alert" threshold. When the live price crosses your target, a notification toast will appear instantly, even if you are on a different page.

---

## Project Structure

```
FinSight/
├── backend/
│   ├── app/
│   │   ├── agents/          # 5 DAG node implementations
│   │   ├── api/endpoints/   # FastAPI route handlers
│   │   ├── services/        # LLM, DB, and WebSocket logic
│   │   └── main.py          # App entry point
├── frontend/
│   ├── src/
│   │   ├── components/      # UI, DAG, and Chart components
│   │   ├── store/           # Zustand state management
│   │   └── lib/             # API client and citations
├── docs/                    # PRD, Design, and Compliance docs
└── docker-compose.yml       # Orchestration
```

---

## Architecture Decisions

| Decision       | Choice                     | Rationale                                                       |
| -------------- | -------------------------- | --------------------------------------------------------------- |
| DAG executor   | Hand-rolled (80 lines)     | LangGraph is heavy for 5 nodes; full control over WS streaming. |
| Forecasting    | Holt-Winters (statsmodels) | HW is lighter and sufficient for 7-day demo projections.        |
| Time-series DB | TimescaleDB hypertable     | High-density price storage partitioning.                        |
| LLM Provider   | Groq + Gemini              | Dual-provider support ensures 99.9% AI availability.            |

**Built for the future of verifiable financial intelligence.**
