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
    1.  **Fetch**: Pulls live price and fundamental data.
    2.  **News**: Scrapes latest headlines and social sentiment.
    3.  **Forecast**: Runs statistical models for price projection.
    4.  **Synthesize**: Cross-references all findings into a coherent report.
    5.  **Verify**: The "Police" node that kills the response if a claim lacks a citation.

### D. CitationGuard
- **Problem Solved**: Inaccurate data.
- **Mechanism**: Every numeric claim (e.g., "AAPL is up 2.4%") must have a corresponding citation tag. If the AI hallucinates a number, CitationGuard catches it before you ever see it.

---

## 4. Advanced Configuration (Phase 2)

To transition from Demo data to Live Production data:
1.  Set `DEMO_MODE=0` in `.env`.
2.  Add your `GEMINI_API_KEY` (from Google AI Studio).
3.  Add your `FINNHUB_API_KEY` (from Finnhub.io).
4.  Restart the containers: `docker compose up -d`.

---

## 5. Troubleshooting

- **StatCards show $0.00**: Ensure the `backend` container is running and healthy. The system fetches initial prices on load and then waits for the 15s ticker pulse.
- **DAG is stuck on "Fetch"**: Check your internet connection. In Demo Mode, this usually clears in 2-3 seconds.
- **Login Failed**: Ensure you have run the seeding script (automatic on first launch). If not, run:
  ```bash
  docker compose exec backend uv run python -m app.scripts.seed_demo
  ```

---

## 6. Project Philosophy
FinSight AI is built to be **Modular** and **Agentic**. Each node in our DAG is an independent worker, allowing you to swap "News" for a "Social Media" scraper or "Forecast" for a "Quantum Model" without breaking the rest of the pipeline.

**Built for the future of decentralized, verifiable financial intelligence.**
