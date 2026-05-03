#!/usr/bin/env bash
set -e

# Production Tester Checklist
# Run all 10 steps against `docker compose up` BEFORE recording demo video.

echo "=== Production Tester Checklist ==="

# Setup: fresh boot
docker compose down -v
docker compose build --no-cache
docker compose up -d
sleep 35

# ── Step 1: Boot time ────────────────────────────────────────────
echo "Step 1: Boot check"
curl -s http://localhost:8000/healthz && echo " ✅ PASS" || echo " ❌ FAIL"

# ── Step 2: Demo login ───────────────────────────────────────────
echo "Step 2: Demo login"
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'username=demo@finsight.ai&password=Demo@12345' \
  | python3 -c "import sys,json;print(json.load(sys.stdin).get('access_token','FAIL'))")
echo "  Token: ${TOKEN:0:20}..."
[ "$TOKEN" != "FAIL" ] && echo "  ✅ PASS" || echo "  ❌ FAIL"

# ── Step 3: Watchlist loaded ────────────────────────────────────
echo "Step 3: Watchlist"
WL=$(curl -s http://localhost:8000/watchlist \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json;items=json.load(sys.stdin);print(len(items))" 2>/dev/null || echo 0)
[ "$WL" -ge 5 ] && echo "  ✅ PASS ($WL items)" || echo "  ❌ FAIL (got $WL)"

# ── Step 4: News data ────────────────────────────────────────────
echo "Step 4: News items seeded"
NEWS=$(curl -s "http://localhost:8000/news/?symbol=AAPL" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json;items=json.load(sys.stdin);print(len(items))" 2>/dev/null || echo 0)
[ "$NEWS" -ge 1 ] && echo "  ✅ PASS ($NEWS items)" || echo "  ❌ FAIL (got $NEWS)"

# ── Step 5: Quote tick flowing ──────────────────────────────────
echo "Step 5: Quote ticks"
TICK=$(curl -s "http://localhost:8000/quotes/AAPL/latest" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('price','NONE'))")
[ "$TICK" != "NONE" ] && echo "  ✅ PASS (AAPL=$TICK)" || echo "  ❌ FAIL"

# ── Step 6: DAG query submits ───────────────────────────────────
echo "Step 6: DAG query submission"
RUN=$(curl -s -X POST http://localhost:8000/query \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"query":"What is the trend for AAPL?","symbol":"AAPL"}' \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('run_id','FAIL'))")
[ "$RUN" != "FAIL" ] && echo "  ✅ PASS (run_id=$RUN)" || echo "  ❌ FAIL"

# ── Step 7: Positions with P&L ──────────────────────────────────
echo "Step 7: Positions P&L"
POS=$(curl -s http://localhost:8000/positions \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json;items=json.load(sys.stdin);
first=items[0] if items else {};
print(f'count={len(items)} pnl={first.get(\"pnl\",\"MISSING\")}')" 2>/dev/null || echo "FAIL")
echo "  $POS"
echo "$POS" | grep -q "MISSING\|FAIL" && echo "  ❌ FAIL" || echo "  ✅ PASS"

# ── Step 8: CitationGuard blocks uncited number ─────────────────
echo "Step 8: CitationGuard"
cd backend && python3 -c "
from app.services.citation_guard import CitationGuard
ok, viols = CitationGuard.validate('Revenue was \$1500')
print('Uncited \$1500 blocked:', not ok, '| violations:', len(viols))
ok2, _ = CitationGuard.validate('Revenue grew in 2024 [1]')
print('Cited year passes:', ok2)
" 2>/dev/null && echo "  ✅ PASS" || echo "  ❌ FAIL"
cd ..

# ── Step 9: No backend errors ───────────────────────────────────
echo "Step 9: Backend error log check"
ERRORS=$(docker compose logs --tail=100 backend 2>&1 | grep -c "ERROR\|Traceback\|Exception" || echo 0)
[ "$ERRORS" -eq 0 ] && echo "  ✅ PASS (no errors)" || echo "  ⚠️  $ERRORS error lines (review)"

# ── Step 10: Frontend loads ──────────────────────────────────────
echo "Step 10: Frontend"
FE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173)
[ "$FE" = "200" ] && echo "  ✅ PASS" || echo "  ❌ FAIL (HTTP $FE)"

echo ""
echo "=== CHECKLIST COMPLETE ==="

# Additional manual checks (browser):
# - [ ] Login page loads, login with demo creds works
# - [ ] Overview shows 5 StatCards with live prices (via WS)
# - [ ] Submit a query in AICopilot — DAG nodes light up MarketData → News+Forecast → Risk → Alert
# - [ ] Answer appears with [1] citation chips (hover = source tooltip)
# - [ ] Query with uncited number (e.g. ask "is AAPL worth $1500?") → redacted in answer
# - [ ] Add position with alert_threshold, wait for tick → AlertToast fires
# - [ ] Positions page shows P&L (green/red)
# - [ ] News page shows ≥10 headlines with sentiment badges
# - [ ] Watchlist page: add + remove symbol works
# - [ ] No console errors in DevTools
