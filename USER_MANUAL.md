# FinSight AI — Production User Manual

Welcome to **FinSight AI**, a next-generation financial intelligence platform that combines real-time market data with a transparent, agentic AI reasoning engine.

This manual covers everything from initial setup to advanced feature usage, explaining the "why" behind our design choices and the problems we solve for modern traders.

---

## 1. The Vision: Why FinSight AI?

### The Problem
Retail traders today face two major hurdles:
1.  **Information Overload**: Too many news sources, price movements, and indicators to track manually.
2.  **AI Black Boxes**: Most AI tools give "answers" without explaining how they got there or proving their data is current.

### The Solution
FinSight AI solves this with:
- **Transparent Reasoning**: A 5-node Agent DAG (Directed Acyclic Graph) that visualizes every step of the AI's research.
- **CitationGuard**: A strict verification layer that blocks any AI claim that isn't backed by a verifiable data source.
- **Real-Time Pulse**: High-frequency price streaming and alert systems built on TimescaleDB.

---

## 2. Getting Started

### Prerequisites
- **Docker Desktop** (v24+)
- **Git**

### Installation
1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/utkarshwasan/FinSight.git
    cd FinSight
    ```
2.  **Configure Environment**:
    - Copy `.env.example` to `.env`.
    - For initial testing, keep `DEMO_MODE=1` (no API keys required).
3.  **Launch the Platform**:
    ```bash
    docker compose up --build -d
    ```
4.  **Access the Dashboard**:
    - URL: `http://localhost:5173`
    - Login: `demo@finsight.ai` / `Demo@12345`

---

## 2.1. Advanced: Manual Setup (Non-Docker)

If you prefer to run the project without Docker (e.g., for faster hot-reloads or specific debugging), follow these steps.

### A. System Requirements
- **Python 3.12+**
- **Node.js 20+**
- **pnpm** (Install via `npm install -g pnpm`)
- **PostgreSQL 15+** with the **TimescaleDB Extension** installed.

### B. Database Preparation
1.  Ensure Postgres is running.
2.  Create a database named `finsight`.
3.  Execute the following SQL to enable the time-series engine:
    ```sql
    CREATE EXTENSION IF NOT EXISTS timescaledb;
    ```

### C. Backend Setup
1.  **Install `uv`** (Recommended Python manager):
    ```bash
    powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
    ```
2.  **Sync Dependencies**:
    ```bash
    cd backend
    uv sync
    ```
3.  **Run Migrations**:
    ```bash
    uv run alembic upgrade head
    ```
4.  **Start Server**:
    ```bash
    uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    ```

### D. Frontend Setup
1.  **Install Dependencies**:
    ```bash
    cd frontend
    pnpm install
    ```
2.  **Start Dev Server**:
    ```bash
    pnpm dev
    ```
    The frontend will be available at `http://localhost:5173`.

---

## 3. Core Features & Problem Solving

### A. The Dashboard (Market Awareness)
- **Problem Solved**: The need to see your entire portfolio and market status at a glance without switching tabs.
- **Features**:
    - **Live StatCards**: Top-row cards that "flash" green/red in real-time as prices fluctuate.
    - **Interactive Candle Charts**: High-performance visualizations with 7-day AI forecasts.
    - **Market Hours**: Live status indicators for global exchanges (NYSE, NASDAQ, LSE, etc.).

### B. AI Copilot (Deep Research)
- **Problem Solved**: Researching a ticker usually takes 20 minutes of searching. AI Copilot does it in 15 seconds.
- **How to Use**:
    - Click the **Sparkles icon** to open the Copilot.
    - Ask questions like: *"Explain the sentiment for NVDA"* or *"What is the 7-day outlook for AAPL?"*.
    - Click **Run**.

### C. The Agent DAG (Trust & Transparency)
- **Problem Solved**: "Hallucinations" and "Black Box" reasoning.
- **What it is**: As the AI thinks, the **Agent DAG** visualizes the 5 nodes:
    1.  **MarketData**: Pulls live price and OHLCV history from `yfinance`.
    2.  **News**: Aggregates latest headlines and sentiment from **Finnhub**.
    3.  **Forecast**: Runs Holt-Winters statistical models for 7-day price projection.
    4.  **Risk**: Scores 0.0–1.0 risk using **Groq (Llama 3.3 70B)** or **Gemini 2.0 Flash**.
    5.  **Alert**: Final synthesis with human-readable advice and citation enforcement.

### D. CitationGuard
- **Problem Solved**: Inaccurate data.
- **Mechanism**: Every numeric claim (e.g., "AAPL is up 2.4%") must have a corresponding citation tag. If the AI hallucinates a number, CitationGuard catches it before you ever see it.

### E. Smart Alerts
- **Problem Solved**: Manually monitoring price thresholds.
- **How it Works**: Set an alert threshold on any position. When the live price crosses your target, a notification toast appears instantly via WebSocket, even if you're on a different page.

---

## 4. Live Configuration (Production Mode)

To transition from Demo data to Live Production data:

### Step 1: Configure `.env`
Set the following variables in your `.env` file:

```dotenv
DEMO_MODE=0
SEED_DEMO_USER=1
RUN_POLLER=1

# Primary AI Provider: Groq (Llama 3.3 70B)
GROQ_API_KEY=gsk_...          # Get from https://console.groq.com/keys

# Fallback AI Provider: Gemini 2.0 Flash
GEMINI_API_KEY=AIza...         # Get from https://aistudio.google.com/app/apikey

# Market News & Sentiment
FINNHUB_API_KEY=...            # Get from https://finnhub.io/register

# Security
JWT_SECRET=...                 # Generate: python -c "import secrets; print(secrets.token_hex(32))"
```

### Step 2: Restart the Containers
```bash
docker compose down
docker compose up --build -d
```

### Step 3: Verify Live Data
1. Login to the dashboard at `http://localhost:5173`.
2. Watch the StatCards "flash" green/red every 15 seconds as live prices stream in.
3. Open AI Copilot and run a query like *"What is the news sentiment for NVDA?"*.
4. Verify the DAG executes with real data (check the 5 nodes lighting up in sequence).

---

## 5. API Endpoints Reference

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

---

## 6. Hardened Production Features

- **AI Resilience**: 5-tier exponential backoff (5s, 10s, 20s, 40s, 80s) for 429 "Rate Limit" errors in both Groq and Gemini clients.
- **Auth Hardening**: Global Axios interceptor handles 401/403 errors by clearing session storage and redirecting to login, preventing infinite loop "deadlocks".
- **Live Data Poller**: `quote_poller.py` fetches high-frequency ticks from `yfinance` every 15s and broadcasts them via WebSockets to all connected clients.
- **Time-Series Engine**: `quote_ticks` are stored in a **TimescaleDB hypertable** for efficient historical rendering and Holt-Winters forecasting.
- **Citation Enforcement**: Backend `CitationGuard` validates all LLM output before it is sent to the frontend. Any numeric claim without a `[citation]` is redacted.
- **Demo Mode**: Full fixture replay for offline development — no external API calls required.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| StatCards show `$0.00` | Backend not healthy | Check `docker compose ps` and restart with `docker compose up -d` |
| StatCards flash but prices don't change | Poller not running | Verify `RUN_POLLER=1` in `.env` |
| DAG stuck on "Fetch" | Network / rate limit | Check API keys are valid; wait 60s and retry |
| AI Copilot returns degraded answer | LLM provider down | System auto-switches between Groq and Gemini; check logs |
| Login redirects to login page | Expired JWT | Clear browser localStorage; re-login |
| AlertToast not firing | Threshold not set | Set alert threshold in Positions page |

### Diagnostic Commands
```bash
# View backend logs
docker compose logs -f backend

# View frontend logs
docker compose logs -f frontend

# Restart a specific service
docker compose restart backend

# Run seeding script manually
docker compose exec backend uv run python -m app.scripts.seed_demo
```

---

## 8. Project Philosophy
FinSight AI is built to be **Modular** and **Agentic**. Each node in our DAG is an independent worker, allowing you to swap "News" for a "Social Media" scraper or "Forecast" for a "Quantum Model" without breaking the rest of the pipeline.

**Built for the future of decentralized, verifiable financial intelligence.**
