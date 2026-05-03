# FinSight AI

> **Real-time financial insights with a live 5-agent reasoning trace — built for analysts who don't trust black boxes.**

🔗 **Live demo:** [TBD — paste Render URL after Day 4 deploy]  
📺 **Walkthrough:** [TBD — paste 4-min YouTube/Loom link after recording]

---

## What this is

A real-time financial insights dashboard that streams market data, generates grounded summaries with **citation enforcement**, and shows you exactly **which AI agents reasoned about your query** in a live DAG visualizer. Built as Project #5 of the Nebula9.ai Full Stack GenAI Intern assessment.

**The differentiator:** when you type a question like *"Should I worry about TSLA today?"*, you watch 5 agents (MarketData → News + Forecast in parallel → Risk → Alert) light up in real time, with token counts and latency per node. Every numeric claim in the answer is a clickable citation chip — uncited numbers are blocked from rendering.

> ⚠ **Educational use only.** Forecasts are illustrative, not investment advice. No real trading is performed. Data is delayed 15+ minutes from public free-tier APIs.

## Architecture

```  
graph TD  
    subgraph Frontend [React + Vite + TypeScript]  
        UI[Dashboard]  
        DAG[React Flow DAG Visualizer]  
        CG[CitationGuard]  
    end  
    subgraph Backend [FastAPI]  
        WS[WebSocket Hub]  
        EX[DAG Executor - topological sort]  
        EX --> N1[MarketData]  
        EX --> N2[News]  
        EX --> N3[Forecast]  
        EX --> N4[Risk]  
        EX --> N5[Alert]  
        AUD[Audit Middleware]  
    end  
    subgraph Data [Postgres + TimescaleDB]  
        T1[(quote_ticks hypertable)]  
        T2[(news_items)]  
        T3[(positions, watchlist, users, audit_events)]  
    end  
    subgraph External [Free-tier APIs]  
        Y[yfinance]  
        F[Finnhub]  
        G[Gemini 2.0 Flash]  
    end  
```

## Quick Start

### Prerequisites
- Docker + Docker Compose
- API keys (see §API Keys section below)

### 1. Clone & configure
```bash
git clone https://github.com/utkarshwasan/FinSight.git
cd FinSight
cp .env.example .env
# Edit .env: set GEMINI_API_KEY, FINNHUB_API_KEY, JWT_SECRET
```

### 2. Run
```bash
docker compose up --build
```

### 3. Access
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000/docs
- **Demo login:** `demo@finsight.ai` / `Demo@12345`

### 4. API Keys

| Key | Where to get | Free tier |
|-----|-------------|-----------|
| `GEMINI_API_KEY` | https://aistudio.google.com/app/apikey | 1M tokens/day |
| `FINNHUB_API_KEY` | https://finnhub.io/register | 60 calls/min |
| `JWT_SECRET` | `python -c "import secrets; print(secrets.token_hex(32))"` | — |

> **No API keys?** Set `DEMO_MODE=1` in `.env` to use fixture data.

### Educational Disclaimer
FinSight AI is built for educational and demonstration purposes only.
**Not financial advice.** Do not make investment decisions based on outputs.

To record the demo with deterministic outputs, set `DEMO_MODE=1` in `.env` before `docker compose up`.

You can also run the automated production tester checklist: `scripts/production_check.sh`.

## Tech Stack

**Backend:** FastAPI · SQLAlchemy + Alembic · Postgres + TimescaleDB · python-jose (JWT) · authlib (Google OAuth) · bcrypt · yfinance · Finnhub · google-genai (Gemini 2.0 Flash) · Prophet · websockets

**Frontend:** React + Vite + TypeScript · TailwindCSS · shadcn/ui · TanStack Query · React Flow · Recharts + lightweight-charts · Zustand

**Infra:** Docker Compose · Render · GitHub Actions (pytest + tsc + ruff)

## Key Trade-offs

1. **Hand-rolled DAG executor over LangGraph** — 80 lines of `asyncio.gather` + topological sort. *(See ADR-0001.)*  
2. **Prophet over LSTM/Transformer** — 7-day naive baseline, 30-day training window, MAPE auto-hide above 15%. *(See ADR-0002.)*  
3. **Keyword retrieval over pgvector RAG** — corpus is ~200 news items per ticker. Plain Postgres `ILIKE` + Gemini re-rank is enough.  
4. **TimescaleDB hypertable on `quote_ticks` only** — satisfies the brief's "time-series database" requirement.  
5. **Single user role** — RBAC is a brief requirement *"where applicable"*. A single-user research dashboard doesn't need multi-role.

## What I'd build with two more weeks

- **LLM eval harness** — golden NL queries with expected citations + assertions on numeric correctness  
- **Earnings-call transcript RAG** — pgvector earns its keep here  
- **Redis Streams** for durable WebSocket fan-out  
- **Forecast back-testing** — show MAPE on rolling 30-day windows  
- **Real-money paper trading** — Position model already supports it

## License  
MIT — see LICENSE.