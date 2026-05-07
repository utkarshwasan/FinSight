# FinSight AI — Product Requirements Document (PRD)

## 1. Project Overview
**FinSight AI** is a real-time financial intelligence dashboard designed to provide retail traders with transparent, data-driven AI insights. The platform leverages a 5-node Agentic DAG (Directed Acyclic Graph) to research tickers, generate forecasts, and assess risk, all while enforcing strict citation standards to prevent AI hallucinations.

## 2. Target Audience
- Retail investors looking for quick, high-fidelity research.
- Traders who want to see the "reasoning" behind AI recommendations.
- Users who need real-time market data without expensive terminal subscriptions.

## 3. Core Features

### 3.1. Real-Time Market Dashboard
- **Live Ticks**: 15-second price updates via `yfinance` and WebSockets.
- **Watchlist**: Interactive list of symbols with live P&L and daily changes.
- **Candle Charts**: High-performance OHLCV visualization using `lightweight-charts`.

### 3.2. Agentic AI Research (The DAG)
- **5-Node Execution**:
    1. **MarketData**: Fetches price, history, and fundamentals.
    2. **News**: Aggregates headlines and sentiment via Finnhub.
    3. **Forecast**: Runs Holt-Winters statistical models for 7-day projections.
    4. **Risk**: Groq (Llama 3.3 70B) or Gemini 2.0 scoring based on market volatility and news sentiment.
    5. **Alert**: Final synthesis with human-readable advice and citation enforcement.
- **Transparency**: Live streaming of node status, token usage, and latency.

### 3.3. CitationGuard™
- **Verification**: Mandatory backend validation of all numeric claims.
- **Redaction**: Automatically blocks any unverified numbers from rendering in the UI.
- **Citations**: Clickable chips that link AI statements back to source data.

### 3.4. Portfolio Management
- **Positions**: Open and track holdings with live valuation.
- **Alerts**: Set price thresholds that fire real-time browser notifications (AlertToast).

## 4. Technical Requirements

### 4.1. Backend
- **Framework**: FastAPI (Async).
- **Database**: Postgres + TimescaleDB (for high-density time-series ticks).
- **LLM Engine**: Primary: Groq (Llama 3.3 70B); Fallback: Gemini 2.0 Flash.
- **Auth**: JWT-based session management with hardened 401/403 interceptors.

### 4.2. Frontend
- **Framework**: React 18 + Vite + TypeScript.
- **Styling**: TailwindCSS + shadcn/ui.
- **State**: Zustand (Store-based) + TanStack Query (Server-state).
- **Visuals**: React Flow for the DAG visualizer.

### 4.3. Infrastructure
- **Containerization**: Docker Compose (single-command setup).
- **CI/CD**: GitHub Actions for linting and testing.

## 5. Success Metrics
- **Latency**: AI research completion in <20s.
- **Accuracy**: 0% uncited numeric claims in production mode.
- **Uptime**: 99.9% WebSocket connectivity for price streaming.

## 6. Future Roadmap
- **Phase 4**: Multi-user scalability with Redis caching.
- **Phase 5**: Advanced Technical Indicators (RSI, MACD) on charts.
- **Phase 6**: Social sentiment scraping (X/Reddit integration).
