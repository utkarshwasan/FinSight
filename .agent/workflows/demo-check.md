---
description: Workflow for demo-check
---
---  
description: Run the 10-step demo verification flow before recording the submission video.  
---

Walk through the 10-step demo flow and verify each step works end-to-end. Use `DEMO_MODE=1` for steps involving LLM/API calls. If a step fails, stop and report. **Do not proceed to recording** until all 10 steps pass.

## The 10 steps

```  
1.  Open hosted Render URL (or localhost:5173) → login form renders  
2.  Login with demo@finsight.ai / demo123 → dashboard loads in < 3s  
3.  Watchlist has 3 tickers (AAPL, NVDA, TSLA from seed) → live ticks visible  
4.  Type "Should I worry about TSLA today?" → DAG visualizer animates 5 nodes  
    (MarketData first, News + Forecast parallel, Risk, Alert)  
5.  Answer renders with [1][2][3] citations; hover on chip → news source tooltip  
6.  Confirm CitationGuard blocks uncited number (inject deliberate uncited numeric → UI shows redacted)  
7.  Click any red candle → DAG re-fires with timestamp scope → answer updates with new citations  
8.  Add Position(NVDA, 10 @ $920) → Holdings card appears → P&L re-renders on next tick  
9.  Threshold alert (pre-set NVDA > $950) fires → toast appears bottom-right  
10. Visit /audit → see last 5 AI calls with model, tokens, latency, cost_inr  
```

## Bonus steps

```  
11. Toggle DEMO_MODE off → re-run #4 with live Gemini → still works  
12. Open DevTools Network → confirm WS messages in <untrusted_data>-tagged shape  
13. Check /healthz → returns 200 with version + timestamp  
14. Canary: search news fixture for "PUMP_TOKEN" → confirm output never contains it  
15. Refresh browser mid-DAG-run → reconnect succeeds, no orphan running nodes  
```

## Output format

```markdown  
# Demo Check — <date>

| # | Step | Status | Notes |  
|---|---|---|---|  
| 1 | Open URL | ✓ | response 200, login form rendered |  
...

## Failures to fix before recording

## Pre-recording checklist (only when all 10 pass)  
- [ ] Render service pre-warmed via curl /healthz 30s before recording  
- [ ] DEMO_MODE=1 set in Render env vars  
- [ ] Browser zoom 100%, screen 1080p+, no notifications  
- [ ] DevTools open on Network tab  
- [ ] Demo seed user logged in in advance  
- [ ] OBS or Loom configured for 30 fps, 1080p, mic levels checked  
```

## Rules  
1. Stop on first failure.  
2. Use DEMO_MODE for recording.  
3. Cold-start Render with `/healthz` 30s before pressing record.  
4. Verify on the EXACT browser + zoom level you'll record on.