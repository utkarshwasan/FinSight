# FinSight AI: Ultimate Phase 2 Forensic Audit Report

**Status**: Phase 2 (Live API Mode) - **CRITICAL SYSTEMIC DEGRADATION**
**Date**: May 6, 2026
**Target**: Senior Development Team / Product Owner

---

## 1. Executive Summary
The transition to Phase 2 (Live) is **partially successful** at the infrastructure level (Live Price Polling, WebSockets, Auth) but **completely fails** at the presentation and intelligence layers. Large portions of the UI are still using hardcoded simulations, and the AI orchestration (DAG) is broken due to a crash in the News integration node.

---

## 2. Component Forensic Audit

### A. The "Holdings 0%" & StatCard Issues
- **Finding**: **Frontend Logic Bug**. 
- **Details**: In `Overview.tsx`, the `StatCard` components are rendered without the `change` prop. The component defaults to `0.00%`.
- **Live Status**: Prices are live, but the "performance" indicators are hardcoded to zero.
- **Holdings Table**: **WORKING**. P&L is correctly calculated using `livePrice` vs `average_price`.

### B. "The Great Simulation" (Hardcoded UI)
The following components were found to be **100% hardcoded simulations**, ignoring the backend:
1.  **CandleChart**: Uses a local `generateSeries` function to draw random SVG candles. It does not hit the API and is labeled "Demo" in the UI.
2.  **Markets Page**: Uses a local `setInterval` to "drift" static prices by random amounts. It does not reflect the prices seen on the Dashboard.
3.  **Market Hours**: Static text component showing fixed times (e.g., "10:32 ET" for NYSE).

### C. News Feed Stagnation
- **Finding**: **DB Persistence Failure & Node Crash**.
- **Observation**: The News Feed displays "Demo News 1 for AAPL" dated **May 3, 2026**.
- **Root Cause**: 
    1. The `News` node in the DAG is crashing in Live Mode (Red X).
    2. Because it crashes, no new news is ever persisted to the `news_items` table.
    3. The stale items currently in the DB were persisted during a previous run (May 3rd) when the system was in fallback mode.

### D. Agentic DAG Failure Trace
- **Failure Point**: `News` Node.
- **Impact**: Since `Risk` and `Alert` depend on news context, the final AI synthesis is either empty or heavily redacted by the **CitationGuard**.
- **System Behavior**: The DAG correctly identifies the failure and prevents the AI from "hallucinating" news it cannot see, but the end result is a non-functional intelligence layer.

---

## 3. Verified Live Infrastructure (Working)
- **Quote Poller**: Successfully fetching live prices for AAPL, NVDA, MSFT, etc., from `yfinance`.
- **WebSockets**: Stable bi-directional connection delivering live ticks to the client.
- **Authentication**: JWT rotation is functional (Verified by successful login and session persistence).
- **Price Alerts**: Real-time threshold monitoring is active and firing toast notifications.

---

## 4. Immediate Blockers & Bugs
1.  **[BUG]** `Overview.tsx`: Pass `change` and `volume` props to `StatCard`.
2.  **[BUG]** `HoldingsCard.tsx`: Integrate `initialPrices` to prevent P&L jumping from 0% on first tick.
3.  **[REFACTOR]** `CandleChart.tsx`: Remove simulation; implement `useQuery` to `/quotes/{symbol}/history`.
4.  **[REFACTOR]** `Markets.tsx`: Replace simulation with a backend-driven list (e.g., `/watchlist/all`).
5.  **[DEBUG]** `news.py`: Debug the News node crash. Suspect `genai` client initialization or a schema mismatch during DB persistence.

---

## 5. Final Assessment
The "skeleton" of the live app is solid, but the "flesh" (data integration) is still using props from the Phase 1 demo. To call Phase 2 a success, we must "cut the strings" of the simulations and bridge the backend data to the Chart and Markets pages.

**Audit Prepared By**: Antigravity (Advanced Agentic Coding)
**Risk Level**: HIGH (Inconsistent data between pages)
