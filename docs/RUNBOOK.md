# Runbook — FinSight AI

## Free-tier API limits

| API | Limit | What happens at limit | Mitigation |  
|---|---|---|---|  
| Gemini 2.0 Flash | 15 RPM, 1M TPM, 1500 RPD | 429 RESOURCE_EXHAUSTED | DEMO_MODE=1 for recording |  
| Finnhub free | 60 calls/min | 429 | Cache news 5 minutes per symbol |  
| yfinance | unofficial; ~2k/day | quietly returns empty | Use only for historical OHLC |  
| Render free tier | 750 hours/month, sleeps after 15 min | cold start ≈ 30s | Pre-warm with curl /healthz 30s before recording |

## Pre-recording checklist

```bash  
# 1. Set DEMO_MODE on Render  
render env set DEMO_MODE=1 --service finsight-backend

# 2. Pre-warm 30s before recording  
curl https://finsight-backend.onrender.com/healthz  
curl https://finsight-frontend.onrender.com/

# 3. Refresh fixture cache if stale (>7 days)  
DEMO_MODE=0 uv run python -m app.scripts.record_demo_fixtures  
git add backend/app/services/demo_fixtures/cache/  
git commit -m "chore: refresh demo fixtures"  
```

## Demo-mode toggle

```bash  
DEMO_MODE=0   # default — uses live Gemini + yfinance  
DEMO_MODE=1   # uses fixture replay (required for video recording and CI tests)  
```

When DEMO_MODE=1:  
- GeminiClient.call() reads from cache/gemini_<prompt_hash>.json  
- YFinanceClient.history() reads from cache/yfinance_<symbol>_<period>.json  
- FinnhubClient.company_news() reads from cache/finnhub_news_<symbol>.json  
- Missing fixture → raises MissingFixtureError(prompt_hash) → test fails loudly

## Common breakages

### Prophet won't install in Docker  
Fix: Use `prophet>=1.1.5` from PyPI (pre-built wheels). NOT `fbprophet`.

### TimescaleDB extension fails to load  
Fix: Docker image must be `timescale/timescaledb:latest-pg16`, not `postgres:16`.

### Render WebSocket disconnects every minute  
Fix: Keep /healthz polled from FE every 60s, or upgrade to Starter ($7/month).

### OAuth callback returns 400 on Render  
Fix: GOOGLE_OAUTH_REDIRECT_URI must match what's registered in Google Cloud Console exactly.

### CORS blocks frontend in production  
Fix: Set `CORS_ORIGINS=https://finsight-frontend.onrender.com` (no trailing slash, no wildcard).

### Free-tier rate limit (Gemini) hit during dev  
Fix: Switch to DEMO_MODE=1 temporarily, or wait 60s. In tests, use cassettes.

## Performance budgets

| Path | Target p95 | Action if exceeded |  
|---|---|---|  
| GET /healthz | < 50ms | Investigate cold start |  
| GET /watchlist | < 200ms | Check N+1 queries |  
| POST /query (full DAG) | < 6s | Profile per-node timing in audit log |  
| WebSocket message latency | < 200ms | Check fan-out queue depth |  
| Frontend FCP | < 1.5s | Audit bundle size; lazy-load DAG visualizer |

## If the demo breaks live during the interview

1. Don't panic. Acknowledge: "Looks like Render is cold-starting — let me show you the recorded video instead."  
2. Have YouTube/Loom link copy-pasted in your notes.  
3. Show the GitHub repo and walk the architecture while the URL warms up.  
4. Lean on the audit log — "Here's what the run looked like last time it ran."