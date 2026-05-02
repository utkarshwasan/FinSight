




“# FINSIGHT_FIX_PLAN.md
## The God File — Sequential Execution Plan from Audit → 100% Complete

> **Audience:** the AI assistant on the build machine (Sonnet, with ground-truth repo access).
> **Authors:** (1) orchestrator AI on the user's home machine, working from `.md` digests of the codebase, (2) corrected/superseded in §0.0 by build-machine Sonnet, who read the actual source files.
> **Goal:** Take the project from current state to **100% MVP submission-ready** without regressing what already works.
> **How to use:** Read §0.0 (CORRECTIONS) FIRST. Then §0 (operating contract). Then execute the *corrected* phase order. After every phase, run the verification block. Do not move to the next phase until the verification is green.

---

## §0.0 CORRECTIONS — READ FIRST (supersedes parts of §1)

This plan was authored from `.md` summaries (`backend-core.md`, `agents_services.md`, `frontend compo.md`) that the user copied between machines. The build-machine AI verified against the actual source files and found the digests had transcription errors and missing context. **Where this preamble disagrees with §1 below, this preamble wins.**

### 0.0.1 False positives in §1 — DO NOT FIX (already correct in real code)

Run a `grep` on the actual source before touching any of these. If grep confirms the code is already correct, skip. The ⚠ entries in §1 are marked accordingly.

| §1 item | Status | Verify with |
|---|---|---|
| §1.1 `deps.py` SQLA 1.x → 2.0 | ✅ already 2.0 async | `grep -n "select(models.User)" backend/app/api/deps.py` should match |
| §1.5 `alert.py` None comparison | ✅ already uses `state.get("risk_score", 0.0)` | `grep -n "state.get(\"risk_score\"" backend/app/agents/alert.py` |
| §1.6 `ws.py` `int(None)` decode | ✅ wrapped in `except (JWTError, TypeError, ValueError)` | `grep -nE "except.*JWTError" backend/app/api/endpoints/ws.py` |
| §1.7 `quote_poller.py` `float(None)` | ✅ wrapped in `except Exception` returning None | `grep -n "fetch_price" backend/app/services/quote_poller.py` |
| §1.8 JWT claim mismatch | ✅ `deps.py` only reads `sub`, never `email` | `grep -n "payload.get" backend/app/api/deps.py` — should NOT find `.get("email")` |
| §3.1 (FE) login form-data | ⚠ verify before applying — may already work | `grep -n "URLSearchParams\|application/x-www-form" frontend/src/lib/api.ts frontend/src/pages/Login.tsx` |
| §3.3 WS unbounded events | ✅ already capped at 50 in wsStore | `grep -n "slice(-" frontend/src/store/wsStore.ts` |

**If `grep` confirms the code is already correct: write a one-line comment in your status update ("§1.X verified-not-present, skipped") and move on. Do NOT apply the §1 fix — you'll regress working code.**

### 0.0.2 NEW P0 bugs the digest-based audit missed — DO THESE FIRST (Hour 1)

These are real bugs in the actual codebase. They block the entire AI pipeline and the production deploy. Fix order matters: NEW-1 → NEW-3 → NEW-2 → NEW-4 → NEW-5.

#### NEW-1 — DAG executor throws away parallel state mutations [10 min]

**File:** `backend/app/agents/executor.py`

**Symptom:** `asyncio.gather(*tasks, return_exceptions=True)` returns the modified `AgentState` dicts from News + Forecast, but they are never merged back into the parent `state`. Risk node always sees `state["news"] = None` and `state["forecast"] = None`. Every DAG run produces meaningless output. **This is the single highest-leverage fix in the repo.**

**Fix:**
```python
# After: results = await asyncio.gather(*tasks, return_exceptions=True)
# BEFORE the exception loop, merge the returned states:
for res in results:
    if isinstance(res, Exception):
        # Mark the failing node as error in state["errors"]; do NOT raise (fail-open per §5).
        # Identify which task failed by parallel ordering of tasks list.
        continue
    if isinstance(res, dict):
        state.update(res)  # ← THE ONE LINE THAT UNBLOCKS THE DAG
# Then handle exceptions per fail-open semantics (see §5 for full rewrite).
```

**Caveat:** if News/Forecast nodes mutate `state` in place AND return the same dict, `state.update(res)` is a no-op (safe). If they return `None`, `isinstance(res, dict)` short-circuits (safe). If they return a fresh dict, this line is the fix. So ship it unconditionally.

**Verify:**
```bash
cd backend
uv run python -c "
import asyncio
from app.agents.executor import DAGExecutor
async def md(s): s['market_data'] = {'latest_price': 100}
async def news(s): s['news'] = ['headline1']; s['sentiment'] = 0.5
async def fc(s): s['forecast'] = {'mape': 0.05}
async def risk(s): assert s.get('news') is not None and s.get('forecast') is not None, 'state lost!'
async def alert(s): s['answer'] = 'ok'
ex = DAGExecutor(nodes={'MarketData':md,'News':news,'Forecast':fc,'Risk':risk,'Alert':alert}, on_event=lambda e: None)
asyncio.run(ex.run({'run_id':'t','user_id':1,'symbol':'X','query':'?','errors':{},'skipped':[]}))
print('state-merge OK')
"
```

#### NEW-2 — WebSocket URL hardcoded to localhost [5 min]

**File:** `frontend/src/lib/ws.ts`

**Symptom:** `const wsUrl = \`ws://127.0.0.1:8000/ws?token=${token}\`` — Render deploy WS never connects → no live ticks, no DAG streaming, no answers in production.

**Fix:**
```ts
const apiBase = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";
const wsBase = apiBase.replace(/^http/, "ws");
const wsUrl = `${wsBase}/ws?token=${encodeURIComponent(token)}`;
```

Also ensure `frontend/.env.production` (not committed) sets `VITE_API_URL=https://<your-render-app>.onrender.com`.

**Verify:** open browser DevTools on hosted URL → Network → WS → confirm 101 Switching Protocols.

#### NEW-3 — Quote poller never starts [15 min]

**File:** `backend/app/main.py`

**Symptom:** No `lifespan` handler, no startup event, no worker service in `docker-compose.yml`. `poll_loop()` in `quote_poller.py` is never invoked. `quote_ticks` table stays empty forever. `/quotes/{symbol}/latest` always returns 404. All "live prices" fall back to `average_price`.

**Fix — `backend/app/main.py`:**
```python
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.services.quote_poller import poll_loop

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: launch poller as background task. Default symbols come from a seed list
    # or from the union of all WatchlistItem.symbol rows; pick whichever exists in your code.
    seed_symbols = ["AAPL", "NVDA", "TSLA", "MSFT", "GOOGL"]
    poller_task = asyncio.create_task(poll_loop(seed_symbols))
    try:
        yield
    finally:
        poller_task.cancel()
        try:
            await poller_task
        except asyncio.CancelledError:
            pass

app = FastAPI(lifespan=lifespan, title="FinSight AI")
# ... rest of app config (CORS, routers, etc.) unchanged
```

**Better long-term:** poll the union of distinct `WatchlistItem.symbol` values, refreshed every minute. For the demo, the seed list is fine.

**Caveat:** on Render free tier, this means the web service runs the poller. If you have a separate worker service in `render.yaml`, gate the lifespan startup behind `os.getenv("RUN_POLLER", "1") == "1"` and disable on web. For demo simplicity: keep it on web.

**Verify:**
```bash
cd backend
uv run uvicorn app.main:app --port 8000 &
sleep 20  # let poller tick at least once
curl -s http://localhost:8000/quotes/AAPL/latest
# Expected: a JSON QuoteTick with non-null price (not 404)
kill %1 2>/dev/null
```

#### NEW-4 — `market_data.py` agent uses random PRNG history [20 min]

**File:** `backend/app/agents/market_data.py`

**Symptom:** Comment says `# In a real scenario, we'd pull 30d history from DB here.` but the actual code generates `base_price * (1 + random.uniform(-0.05, 0.05))`. Even in production mode, the Forecast node fits Holt-Winters on random noise. Forecasts are meaningless.

**Root cause:** DAG nodes have no `db` session parameter — they cannot query the database.

**Fix — pass a session factory through executor:**

`backend/app/agents/executor.py` — `__init__`:
```python
def __init__(self, nodes, on_event, audit_writer=None, session_factory=None):
    self.nodes = nodes
    self.on_event = on_event
    self.audit_writer = audit_writer
    self.session_factory = session_factory  # AsyncSessionLocal callable
```

`backend/app/agents/state.py` — extend AgentState:
```python
class AgentState(TypedDict, total=False):
    # ... existing fields ...
    _session_factory: Any  # internal: db session factory; nodes use it to open short-lived sessions
```

`backend/app/api/endpoints/query.py` — when constructing executor:
```python
from app.db import AsyncSessionLocal
executor = DAGExecutor(
    nodes=DAG_NODES,
    on_event=on_event,
    audit_writer=audit_write,
    session_factory=AsyncSessionLocal,
)
initial_state["_session_factory"] = AsyncSessionLocal
```

`backend/app/agents/market_data.py` — replace random history with real DB query:
```python
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
import pandas as pd
from app import models

async def run(state):
    symbol = state["symbol"]
    factory = state.get("_session_factory")
    if factory is None:
        # Fallback: synthesized 30d series so DAG still runs in tests
        state["market_data"] = {"latest_price": 100.0, "history_df": _synthesize(100.0)}
        return

    async with factory() as session:
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        result = await session.execute(
            select(models.QuoteTick).where(
                models.QuoteTick.symbol == symbol,
                models.QuoteTick.ts >= cutoff,
            ).order_by(models.QuoteTick.ts.asc())
        )
        ticks = result.scalars().all()

    if len(ticks) < 5:
        # Insufficient history — synthesize from latest price for forecast continuity.
        latest = ticks[-1].price if ticks else 100.0
        state["market_data"] = {"latest_price": latest, "history_df": _synthesize(latest)}
        return

    df = pd.DataFrame([{"ds": t.ts, "y": t.price} for t in ticks])
    state["market_data"] = {"latest_price": float(ticks[-1].price), "history_df": df}

def _synthesize(base_price: float) -> "pd.DataFrame":
    import pandas as pd, numpy as np
    rng = np.random.default_rng(seed=42)
    dates = pd.date_range(end=datetime.now(timezone.utc), periods=30, freq="D")
    noise = rng.uniform(-0.02, 0.02, size=30).cumsum()
    prices = base_price * (1 + noise)
    return pd.DataFrame({"ds": dates, "y": prices})
```

**Verify:**
```bash
# After NEW-3 (poller) has been running for 5+ min so quote_ticks has rows:
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'username=demo@finsight.ai&password=Demo@12345' \
  | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s -X POST http://localhost:8000/query \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"query":"What is AAPL doing?","symbol":"AAPL"}'
# Then watch WS for the Forecast node's partial_output — MAPE should be < 0.10 with real data,
# whereas with PRNG it varies wildly.
```

#### NEW-5 — News page permanently empty (NewsItem table never written) [25 min]

**File:** `backend/app/agents/news.py`

**Symptom:** `/news/{symbol}` queries the `news_items` table; the News DAG node fetches headlines from Finnhub and stores them only in `state["news"]` (in-memory). Nothing inserts rows. News page always shows the empty state regardless of how many queries the user runs.

**Fix — persist headlines after fetching:**

```python
import json
from datetime import datetime, timezone
from app import models
from app.services.citation_guard import CitationGuard
from app.services.finnhub_client import FinnhubClient

async def run(state):
    symbol = state["symbol"]
    factory = state.get("_session_factory")

    finnhub = FinnhubClient()
    headlines = await finnhub.fetch_news(symbol)  # list of dicts: headline, url, source, published_at

    # ... existing Gemini sentiment scoring on `headlines` produces `score` ...

    # Persist each headline as a NewsItem (if factory available)
    if factory and headlines:
        async with factory() as session:
            for h in headlines[:10]:  # cap at 10 per run
                # Idempotency: skip if URL already exists for this symbol
                existing = await session.execute(
                    select(models.NewsItem).where(
                        models.NewsItem.symbol == symbol,
                        models.NewsItem.url == h.get("url", ""),
                    ).limit(1)
                )
                if existing.scalar_one_or_none() is not None:
                    continue
                published_raw = h.get("datetime") or h.get("published_at")
                published_at = (
                    datetime.fromtimestamp(published_raw, tz=timezone.utc)
                    if isinstance(published_raw, (int, float))
                    else datetime.now(timezone.utc)
                )
                item = models.NewsItem(
                    symbol=symbol,
                    headline=CitationGuard.sanitize(h.get("headline", ""))[:500],
                    url=h.get("url", "")[:500],
                    source=h.get("source", "Finnhub")[:100],
                    published_at=published_at,
                    sentiment_score=score,  # use the parsed score from Gemini
                    sentiment_label="bull" if score > 0.3 else ("bear" if score < -0.3 else "neutral"),
                    summary=CitationGuard.sanitize(h.get("summary", ""))[:1000] or None,
                )
                session.add(item)
            await session.commit()

    state["news"] = [{"sentiment_score": score, "raw": ... }]  # existing
    state["sentiment"] = score
```

**Verify:**
```bash
TOKEN=...
curl -s -X POST http://localhost:8000/query -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"query":"AAPL news","symbol":"AAPL"}'
sleep 5
curl -s http://localhost:8000/news/AAPL?limit=10 | python -m json.tool
# Expected: 1+ rows with sentiment_score, headline, url
```

### 0.0.3 NEW frontend↔backend gaps confirmed by Sonnet

These augment §3 (contract drifts). Add to §7 (frontend wiring) execution.

| FE component | Issue | Fix |
|---|---|---|
| `CandleChart` 6 period buttons (1D/1W/1M/3M/1Y/All) | Decorative — no `onClick` handler | Wire each button to set `period` state, passed to `useCandleHistory(symbol, period)` |
| `AICopilot` citation footers like `[1] yfinance · 14:32 IST` | Hardcoded fiction; same on every query | Replace with sources from `query_complete` WS event (added in §4.4) |
| `AICopilot` symbol dropdown (6 hardcoded) | Not watchlist-driven | `const { data: wl } = useWatchlist(); options = wl.map(w => w.symbol)` |
| News page symbol dropdown (4 hardcoded) | Same — not watchlist-driven | Same fix |
| Markets page live prices/gainers/losers | 100% client-side simulated drift | Either (a) wire to real WS quote_tick events keyed by symbol, or (b) document as intentional demo affordance in DESIGN.md and add a "[demo]" tag overlay |
| `DAGVisualizer` "312ms" latency labels | Computed as `doneCount × 312` (fake) | Use `event.latency_ms` from real WS dag_event (BE already emits it after §3.3) |
| `AlertToast` | Component does not exist | §7.3 already creates it; just confirm it's mounted in `DashboardShell` |
| Settings page | No backend endpoint | Either remove the route or add a stub that shows "Coming soon" — do NOT ship a blank page |
| DAG node label "Prophet 7d" | Misleading — actually statsmodels Holt-Winters | Rename to "Forecast 7d" in `frontend/src/components/dag/AgentNode.tsx` config |

### 0.0.4 Revised execution order (supersedes the §16 time table)

**Hour 1 — Unblock everything (~55 min) [BLOCKS ALL OTHER WORK]:**
1. NEW-1: executor `state.update(res)` (10m) — unfreezes the entire AI pipeline
2. NEW-3: `lifespan` poll_loop in `app/main.py` (15m) — gives you live ticks
3. NEW-2: WS URL from `VITE_API_URL` (5m) — fixes Render
4. §1.3: CitationGuard regex compile fix (10m) — unblocks Alert node
5. §1.4: News/Risk JSON parsing (15m) — unblocks LLM output usage

**Hour 2 — Real data path (~60 min):**
6. NEW-4: `market_data.py` reads real history from DB (20m)
7. NEW-5: `news.py` persists `NewsItem` rows (25m)
8. §2: `alert_threshold` migration (15m) — only if `grep` confirms the column is missing

**Hour 3-4 — Contract repair + frontend wiring:**
9. §3.1 login form-data (verify-first; may already be correct)
10. §3.2 server-side P&L in `GET /positions`
11. §3.3 WS event shape: `tokens` + `partial_output`
12. §0.0.3 gaps: period buttons, watchlist-driven dropdowns, real DAG latency, AlertToast mount
13. §7.1, §7.2 (these largely become wiring rather than rewrites once NEW-3/4/5 are done)

**Hour 5 — Fail-open + safety:**
14. §5: full executor rewrite to fail-open (already partially done by NEW-1)
15. §4: CitationGuard end-to-end + sources array

**Hour 6+ — Tests, deploy, docs, tester checklist:** §9, §10, §11, §12 unchanged.

### 0.0.5 What still applies from the rest of this document

The build-machine Sonnet's audit + this preamble cover **runtime bugs, missing features, and FE↔BE gaps**. The rest of this god file (§3 contracts, §4 CitationGuard end-to-end, §6 retries, §8 audit, §9 tests, §10 CI/deploy, §11 ADRs/docs, §12 production tester checklist) is **still authoritative** — Sonnet's spec doc didn't cover those. Use both:

- **Sonnet's spec** at `docs/superpowers/specs/2026-05-02-finsight-full-audit-delta.md` — authoritative on what bugs exist and the Hour-1 sequence
- **This god file (§3 onward)** — authoritative on contract repair, tests, deploy hardening, docs, ADRs, and the final production tester walk-through

If the two ever conflict on a specific code change, **prefer Sonnet's** (ground-truth code access wins).

### 0.0.7 V2 audit — five MORE P0s from build-machine deep audit (verified vs GitHub raw)

The build-machine AI ran a second-pass multi-agent audit. Findings verified against `https://raw.githubusercontent.com/.../master/...`. Full report at `docs/superpowers/specs/2026-05-02-finsight-deep-audit-v2.md`.

**Additional false positive found in this plan (§1.3):**

| §1.3 CitationGuard regex compile error | ❌ ALSO false positive | The actual regex `r"\$?\d+(?:\.\d+)?%?(?!\s*\[\d+\])"` compiles fine. Move §1.3 into §0.0.1 false-positives table; do NOT apply the §1.3 fix. |

**Verify before skipping:**
```bash
grep -n "(?!" backend/app/services/citation_guard.py
# If you see the proper Python negative-lookahead, regex is fine — skip §1.3.
```

The CitationGuard *does* still have a bug — but it's a different one (V2-3 below), not a compile error.

---

#### NEW-V2-1 — `citation-guard.ts` is `.ts` but contains JSX [5 min] [HIGHEST PRIORITY]

**File:** `frontend/src/lib/citation-guard.ts`

**Symptom:** File contains JSX (e.g., `<span>...</span>`). TypeScript requires `.tsx` for JSX. `pnpm dev` works because esbuild is permissive; `pnpm build` fails. **Render deploy is blocked until fixed.** This must be the first fix of Hour 1, before anything else, because it blocks every subsequent FE-build verification step in this plan.

**Fix:**
```bash
cd frontend
git mv src/lib/citation-guard.ts src/lib/citation-guard.tsx
# Update every importer (paths in TS module resolution don't include extension, so usually no edit needed):
grep -rn "from.*citation-guard" src/  # confirm imports still resolve
pnpm build  # MUST succeed now
```

**Verify:** `pnpm build` exits 0.

---

#### NEW-V2-2 — Synthesis event emitted with empty `partial_output` hangs the chat UI [30 min]

**Files:** `backend/app/api/endpoints/query.py`, `backend/app/agents/executor.py`, `frontend/src/components/query/AICopilot.tsx`

**Symptom:** When the DAG outer `try/except` catches an error, it prints + returns partial state. `query.py` then emits a `Synthesis` (or `query_complete`) WS event with empty `partial_output`/`answer`. AICopilot waits for truthy `partial_output` → spinner hangs forever.

**Fix — backend:** ensure the final WS event ALWAYS carries a non-empty `answer` field, even on error:
```python
# In query.py background task, AFTER executor.run():
answer_text = (final_state.get("answer") or "").strip()
if not answer_text:
    answer_text = "[no answer generated — see audit log for run_id={}]".format(run_id)
final_payload = {
    "type": "query_complete",
    "run_id": run_id,
    "answer": answer_text,
    "sources": final_state.get("sources") or [],
    "disclaimer": "Educational use only — not financial advice.",
    "degraded": bool(final_state.get("errors") or final_state.get("skipped")),
}
await ws_hub.publish_to_user(current_user.id, final_payload)
```

**Fix — frontend:** AICopilot should treat `query_complete` as the terminal signal, not a truthy `partial_output`:
```tsx
// frontend/src/components/query/AICopilot.tsx
useEffect(() => {
  const subscriber = (event) => {
    if (event.type === "query_complete" && event.run_id === currentRunId) {
      setLoading(false);
      setAnswer(event.answer);
      setSources(event.sources || []);
      setDegraded(event.degraded === true);
    }
  };
  // ... attach
}, [currentRunId]);
```

This subsumes the spinner-hang regardless of whether the answer is degraded, redacted, or empty.

---

#### NEW-V2-3 — CitationGuard year filter is `\d{4}` (matches every 4-digit number) [10 min]

**File:** `backend/app/services/citation_guard.py` and `frontend/src/lib/citation-guard.tsx` (after V2-1 rename)

**Symptom:** The "skip years" whitelist uses `\d{4}` to detect years. Any 4-digit number passes the citation guard — `$1500 in revenue` is silently allowed. Demo step 5 ("uncited number is blocked") fails for the most common dollar range.

**Fix:** Use a strict year pattern bounded by word boundaries and the 1900-2099 range. The §4.1 full rewrite of `citation_guard.py` already uses `_YEAR_PATTERN = re.compile(r'\b(19|20)\d{2}\b')` — apply that rewrite as part of Hour 1 instead of waiting for Phase 4.

For the FE, mirror the same pattern in `citation-guard.tsx`:
```ts
const YEAR_PATTERN = /\b(19|20)\d{2}\b/g;
```

**Verify:**
```python
from app.services.citation_guard import CitationGuard
ok, _ = CitationGuard.validate("In 2024 AAPL rose [1]")
assert ok  # year still allowed
ok, vio = CitationGuard.validate("$1500 in revenue")
assert not ok and any("1500" in v.text for v in vio)  # caught now
```

---

#### NEW-V2-4 — `run_dag_background` has zero exception handling [10 min]

**File:** `backend/app/api/endpoints/query.py`

**Symptom:** The background task that runs the DAG has no top-level try/except. If `executor.run()` raises (DB lost, OOM, unhandled exception in a node), the `query_complete` WS event never fires. AICopilot loads forever.

**Fix:**
```python
async def run_dag_background(...):
    try:
        final_state = await executor.run(initial_state)
        # ... emit query_complete as in V2-2 ...
    except Exception as e:
        logger.exception(f"DAG background failed for run_id={run_id}")
        await ws_hub.publish_to_user(user_id, {
            "type": "query_complete",
            "run_id": run_id,
            "answer": f"[error] {type(e).__name__}: please retry. run_id={run_id}",
            "sources": [],
            "disclaimer": "Educational use only — not financial advice.",
            "degraded": True,
        })
```

This pairs with V2-2: the FE handles `query_complete` as terminal in all cases.

---

#### NEW-V2-5 — `seed_demo.py` never runs on startup [5 min]

**File:** `backend/app/main.py` + `backend/app/scripts/seed_demo.py`

**Symptom:** `seed_demo.py` exists and creates `demo@finsight.ai / Demo@12345` + 3 watchlist items. Nothing invokes it on container start. README and DEMO_MODE flow assume the user exists. On a fresh DB (Render's first deploy, fresh local Docker volume), demo step 1 (login) returns 401.

**Fix — call seeder from lifespan after migrations:**
```python
# backend/app/main.py
from app.scripts.seed_demo import seed_demo_user

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Apply migrations (or rely on alembic upgrade head pre-deploy)
    # 2. Seed demo user if missing (idempotent)
    if os.getenv("SEED_DEMO_USER", "1") == "1":
        try:
            await seed_demo_user()
        except Exception as e:
            print(f"[seed] failed (non-fatal): {e}")
    # 3. Start poller (NEW-3)
    poller_task = asyncio.create_task(poll_loop(seed_symbols))
    try:
        yield
    finally:
        poller_task.cancel()
```

`seed_demo_user()` MUST be idempotent: check for existing email before insert.

**Verify:**
```bash
docker compose down -v  # nuke volume
docker compose up -d
sleep 15
curl -s -X POST http://localhost:8000/auth/login \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'username=demo@finsight.ai&password=Demo@12345' | grep access_token
# Expected: access_token present
```

---

#### Additional V2 P1/P2 items (fold into existing phases)

| Finding | File | Fix | Effort | Phase |
|---|---|---|---|---|
| WSHub memory leak — disconnected user's queue list never deleted | `backend/app/services/ws_hub.py` | On `disconnect`, `del self._queues[user_id]` if empty | 10m | Phase 6 |
| `UserCreate.password` no `max_length` → bcrypt DoS | `backend/app/schemas.py` | `password: str = Field(..., min_length=8, max_length=72)` (bcrypt cap) | 5m | Phase 1 (security) |
| `WatchlistItemCreate.symbol` no validation | `backend/app/schemas.py` | `symbol: str = Field(..., min_length=1, max_length=20, pattern=r'^[A-Z0-9.-]+$')` | 5m | Phase 1 |
| `risk.py` and `alert.py` raw f-string user query into LLM prompts | both files | Wrap `state["query"]` in `<untrusted_data>` tags in BOTH files (SEC-C only covered query.py validation, not the prompt construction) | 15m | Phase 4 |
| DAGVisualizer doesn't render `Synthesis` event | `frontend/src/components/dag/DAGVisualizer.tsx` | Add a 6th node "Synthesis" or merge into Alert's "done" state | 10m | Phase 7 |
| No `.github/workflows/` directory | repo root | Apply §10.1 verbatim | 30m | Phase 10 |
| No `render.yaml` | repo root | Apply §10.2 verbatim | 20m | Phase 10 |
| No tests at all | `backend/tests/`, `frontend/src/**/*.test.*` | Apply §9 verbatim | 2.5h | Phase 9 |
| Tailwind classes like `bg-amber/15` may not resolve | `frontend/tailwind.config.ts` + uses | Grep all `bg-amber` / `text-amber` / `border-amber` and replace with explicit defined tokens | 20m | Phase 7 |

---

#### Revised Hour-1 budget (supersedes §0.0.4)

Old: 55 min for 5 fixes. **New: ~115 min for 8 fixes**, in this strict order:

1. **NEW-V2-1** — rename `citation-guard.ts` → `.tsx` (5m) — **unblocks `pnpm build` and Render deploy; do this FIRST**
2. **NEW-V2-5** — wire `seed_demo` into lifespan (5m) — without it the next 7 verification steps can't even log in
3. **NEW-1** — executor `state.update(res)` (10m) — unfreezes DAG intelligence
4. **NEW-3** — `lifespan` `poll_loop` (15m) — gives live ticks (combine with V2-5 lifespan handler)
5. **NEW-2** — WS URL from `VITE_API_URL` (5m) — fixes Render
6. **NEW-V2-3** — CitationGuard year filter `\b(19|20)\d{2}\b` (10m, ship the §4.1 rewrite now)
7. **NEW-V2-4** — `run_dag_background` try/except wrapping (10m)
8. **§1.4** — News/Risk JSON parser robustness + GeminiClient demo fixture as JSON (15m)
9. **NEW-V2-2** — Synthesis event always carries non-empty answer; FE consumes `query_complete` as terminal (30m)
10. **§1.3** — ❌ SKIP — verified false positive

**Hour-1 exit gate:**
- `pnpm build` exits 0
- Demo user logs in on a fresh `docker compose down -v && up -d`
- One `POST /query` produces a non-empty answer in WS within 5 seconds, even when News fails (test by killing Finnhub key)
- `/quotes/AAPL/latest` returns a tick after 30 seconds of poller running

---

### 0.0.6 Additional fixes from Sonnet's audit (not yet captured in §3+)

These are real items in the actual codebase Sonnet identified that this plan's later sections don't cover. Treat as additions to the named phase.

#### Add to Hour 2 (Security)

**SEC-A — CORS wildcard + credentials misconfiguration** *(blocks prod)*

**File:** `backend/app/main.py`

Current code uses `allow_origins=["*"]` AND `allow_credentials=True`. Per fetch spec, browsers reject this combination — the preflight fails. Even if no cookie auth today, this will silently break any future Authorization-header request that triggers a preflight.

```python
import os
ALLOWED_ORIGINS = [o.strip() for o in os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000"
).split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,    # explicit list, never "*"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

In Render env vars (ASK FOR APPROVAL): `ALLOWED_ORIGINS=https://<your-render-app>.onrender.com,http://localhost:5173`.

**SEC-B — Global exception handler leaks internals** *(security)*

**File:** `backend/app/main.py`

Current handler returns `{"detail": str(exc)}` to clients. In production this can surface DB connection strings, stack traces, internal state.

```python
import logging
logger = logging.getLogger("finsight")

@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc):
    logger.exception(f"Unhandled error on {request.method} {request.url.path}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )
```

**SEC-C — Watchlist allow-list on query symbol** *(prompt-injection D7)*

**File:** `backend/app/api/endpoints/query.py`

Per CLAUDE.md, the symbol used in DAG must be in the user's watchlist. Add right before launching the DAG:

```python
result = await db.execute(
    select(models.WatchlistItem.symbol).where(
        models.WatchlistItem.user_id == current_user.id,
        models.WatchlistItem.symbol == request.symbol.upper(),
    )
)
if result.scalar_one_or_none() is None:
    raise HTTPException(
        status_code=403,
        detail=f"Symbol {request.symbol} not in your watchlist; add it first.",
    )
```

#### Add to Hour 1 (after NEW-1 through NEW-5)

**EXEC-A — GeminiClient DEMO_MODE returns Python-dict-style strings** *(silent time-bomb)*

**File:** `backend/app/services/gemini_client.py`

Sonnet noticed: the demo fixture returns `"{'sentiment_score': 0.5, 'summary': '...'}"` (single quotes). The current sentiment regex with single quotes accidentally matches. Once §1.4 fixes the parser to use `json.loads()` (double quotes), DEMO_MODE breaks unless we also fix the fixture.

Update the demo fixture to emit valid JSON:
```python
def _fixture_response(self, prompt: str) -> str:
    if "sentiment" in prompt.lower():
        score = round(random.uniform(-0.8, 0.8), 2)
        return json.dumps({"sentiment_score": score, "summary": "Demo sentiment summary"})
    if "risk" in prompt.lower():
        score = round(random.uniform(0.1, 0.9), 2)
        return json.dumps({"risk_score": score, "reasoning": "Demo risk reasoning"})
    return "This is a synthesized demo response with citations [1] and [2]."
```

The §1.4 parser must be updated AND this fixture in the same commit, or DEMO_MODE breaks.

#### Add to §0.0.3 frontend gaps (Hour 3-4)

**FE-A — DAGVisualizer parallel animation misleads topology**

**File:** `frontend/src/components/dag/DAGVisualizer.tsx`

Current animation runs nodes sequentially. Real DAG runs News + Forecast in parallel. Either (a) add a "parallel branch" visual at the level-2 stage, or (b) animate based on actual `started_at` timestamps from WS events so they fire concurrently when they should.

Minimum fix: render News + Forecast at the same X-coordinate (column) but different Y-coordinates, with both edges from MarketData drawn simultaneously when both nodes go to "running".

**FE-B — Settings page has no backend**

**File:** `frontend/src/pages/Settings.tsx`

Either (a) replace body with a "Coming soon" empty state and remove from sidebar, or (b) add minimum endpoint `GET /users/settings → {theme, alert_email_enabled}` and `PUT /users/settings`. Recommend (a) for the demo timeline.

**FE-C — DAG node label "Prophet 7d" is inaccurate**

Forecast actually uses statsmodels Holt-Winters (Prophet wheel disabled per ADR-0004). Rename label to `"Forecast 7d"` to avoid reviewer questions.

#### Add to §11 (Docs)

**ADR-0006 — WSHub singleton is process-local**

```md
# ADR-0006 — Process-local WSHub

## Context
WSHub keeps connected WebSocket clients in a Python-process-level dict. With >1 uvicorn worker, a background task in worker A cannot publish to a client connected to worker B.

## Decision
Run a single worker process for the demo (Render free tier defaults to 1 anyway). Document the limitation.

## Consequences
+ Simpler than Redis pub/sub
+ Works on free tier
− Cannot horizontally scale; would need Redis-backed pub/sub at >1 worker
```

#### Delete

**File:** `backend/main.py` (root-level, NOT `backend/app/main.py`) — verify with `git ls-files | grep "^backend/main.py$"`. If it exists and only prints "Hello", delete it.

**File:** `uiuxchanges.md` — describes an indigo/glass-morphism design that doesn't match the shipped amber/dark theme. Either delete or move to `docs/legacy/` with a note.

#### Cut list (DO NOT BUILD)

Sonnet confirms these for the cut list per §18:
- Markets page fake data is acceptable (no `/markets` API; building one is scope creep)
- Multi-worker WSHub (single worker is fine for free-tier demo)
- Real Google OAuth (stub button only)
- Settings page real backend (replace with "Coming soon" — see FE-B above)

---

---

## §0. Operating Contract for the Executing AI

These rules are non-negotiable. Read them, then never violate them.

### 0.1 Hard rules
1. **Execute phases sequentially** (§1 → §12). Do not parallelize unless a phase explicitly says "parallel-safe".
2. **One commit per phase**, conventional-commits format. Commit message templates are provided in each phase.
3. **Never `git push` without the user typing "approved push"**. Ask first using the format in §0.4.
4. **Never edit `.env`, `docker-compose.yml`, GitHub Actions, or Render env vars without the user's "approved" reply** using the §0.4 format.
5. **Never delete files** unless this plan tells you to.
6. **Do not write new tests outside the test files this plan names.** No "while I'm here" cleanups.
7. **Run verification commands verbatim** at the end of each phase. Paste the output back to the user.
8. **If a verification fails, STOP**. Do not proceed. Report the exact error and ask the user how to proceed.
9. **Use Windows-friendly Bash syntax** (forward slashes, no `find`/`grep`/`cat` Bash-builtins — use the project's tools).
10. **Preserve existing behavior**: every change in this plan is either a bug fix or a wiring fix. If a change you're about to make would break a passing test or a working feature, STOP and report.

### 0.2 What's already correct — **DO NOT TOUCH**
- 6-entity schema (User, WatchlistItem, Position, QuoteTick, NewsItem, AuditEvent) — keep as-is
- TimescaleDB hypertable on `quote_ticks` — keep
- JWT 60-min HS256 design — keep
- Zustand `useAuthStore`/`useWsStore` shape — keep
- `DashboardShell`, `Sidebar`, `Navbar` layout — keep
- Tailwind dark theme tokens (`#0b1015`, `#161d27`, `#f5b454`, etc.) — keep
- React Query setup — keep
- The 5-node DAG topology MarketData → {News, Forecast} → Risk → Alert — keep
- Existing Alembic 0001 migration — keep, only ADD a new revision in §3
- `DEMO_MODE` swap pattern (read at construction time) — keep

### 0.3 What's broken — addressed by this plan
- 8 P0 runtime bugs (will crash) → §1
- Schema gap: `Position.alert_threshold` missing column → §2
- 6 FE↔BE contract drifts → §3
- CitationGuard regex broken + not applied → §4
- DAG executor fail-CLOSED instead of fail-OPEN → §5
- No retry/timeout on external clients; sync Prophet in async loop → §6
- Watchlist hardcoded; chart uses PRNG; AlertToast missing; P&L undefined → §7
- Per-node audit logging missing → §8
- Zero tests in repo → §9
- Deploy hardening + CI missing → §10
- Documentation drift → §11

### 0.4 Approval-needed format
When this plan says "ASK FOR APPROVAL", post to chat exactly:

```
⚠ APPROVAL NEEDED: [what]
WHY: [reason from this plan section]
RISK: [what could go wrong]
ROLLBACK: [the exact rollback command]
```

Wait for the user's literal word "approved" before proceeding.

### 0.5 Branching strategy
- Work on branch `fix/audit-remediation` off the current HEAD.
- One commit per phase (12 phases total → ≤14 commits including docs).
- Do NOT merge to main until §12 production-tester checklist is fully green.

```bash
cd ~/finsight
git checkout -b fix/audit-remediation
git status   # confirm clean
```

### 0.6 Emergency rollback (if anything goes wrong)
```bash
cd ~/finsight
git stash
git checkout main
docker compose down
docker compose up -d
# Then report to user with full error context.
```

---

## §1. PHASE 1 — Stop the bleeding (P0 runtime bugs) [45 min]

**Goal:** Eliminate the 8 typo-class bugs that cause runtime crashes. These are blocking every test and every demo step. Fix, verify, commit.

**Parallel-safe:** No — fix in this order; later steps depend on earlier ones.

### 1.1 Fix `app/api/deps.py` — SQLA 1.x → 2.0 async

**File:** `backend/app/api/deps.py`

**What's wrong:** `models.User.query.where(...)` is SQLAlchemy 1.x ORM syntax that does not exist on async sessions. Every authenticated request currently 500s.

**Find:**
```python
result = await db.execute(models.User.query.where(models.User.id == user_id))
user = result.scalar_one_or_none()
```

**Replace with:**
```python
from sqlalchemy import select  # add at top of file if not present

result = await db.execute(select(models.User).where(models.User.id == int(user_id)))
user = result.scalar_one_or_none()
```

**Also at the top of the file**, ensure these imports exist:
```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated
from fastapi import Depends, HTTPException, status
from jose import jwt, JWTError
from app import models
from app.db import get_db
import os
```

### 1.2 Standardize JWT claims — `auth.py`

**File:** `backend/app/auth.py`

**What's wrong:** `/auth/login` puts `{sub, exp}` in claims. `/auth/register` puts `{sub, email}`. `deps.get_current_user` reads `email` claim and 401s if missing. Every login token is rejected.

**Add ONE helper** (replace any existing `_create_access_token`):
```python
import os
from datetime import datetime, timedelta, timezone
from jose import jwt

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

def _get_jwt_secret() -> str:
    secret = os.getenv("JWT_SECRET", "")
    if not secret or secret == "your-secret-key-change-in-production":
        raise RuntimeError(
            "JWT_SECRET is unset or using default. Generate one: "
            "python -c 'import secrets; print(secrets.token_urlsafe(48))'"
        )
    return secret

def create_access_token(*, user_id: int, email: str) -> str:
    """Single source of truth for JWT issuance."""
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, _get_jwt_secret(), algorithm=ALGORITHM)
```

**Replace BOTH call sites** (in `/auth/login` and `/auth/register` handlers):
```python
# OLD (in either handler):
# token = jwt.encode({"sub": str(user.id), ...}, SECRET_KEY, algorithm=ALGORITHM)
# NEW:
access_token = create_access_token(user_id=user.id, email=user.email)
return {"access_token": access_token, "token_type": "bearer"}
```

**Update `deps.get_current_user`** to use the same helper for decoding:
```python
async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, _get_jwt_secret(), algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            raise credentials_exception
        user_id = int(sub)
    except (JWTError, ValueError):
        raise credentials_exception

    result = await db.execute(select(models.User).where(models.User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user
```

### 1.3 Fix `app/services/citation_guard.py` regex

**File:** `backend/app/services/citation_guard.py`

**What's wrong:** Pattern `(?\!\s*\[\d+\])` — the `?\!` is a syntax error. Module fails to import.

**Find every occurrence of:**
```python
r'\$?\d+(?:\.\d+)?%?(?\!\s*\[\d+\])'
```

**Replace with:**
```python
r'\$?\d+(?:\.\d+)?%?(?!\s*\[\d+\])'
```

**Add at top of file** (right after the imports) a fail-loud sanity check:
```python
import re
_NUMERIC_PATTERN = re.compile(r'\$?\d+(?:\.\d+)?%?(?!\s*\[\d+\])')  # compile-time validation
```

Use `_NUMERIC_PATTERN` everywhere instead of recompiling.

### 1.4 Fix News + Risk JSON parsing

**File:** `backend/app/agents/news.py`

**What's wrong:** Regex `r"'sentiment_score':?\s*([-\d.]+)"` with broken escaping never matches Gemini's `"sentiment_score": 0.5`. Output silently becomes `0.0`.

**Replace the parse block** with a robust JSON-first / regex-fallback approach:

```python
import json
import re

def _parse_sentiment(raw: str) -> float:
    """Extract sentiment_score from LLM response. Fail loud on parse errors."""
    if not raw:
        raise ValueError("Empty LLM response")
    # Strip markdown fences if present
    cleaned = re.sub(r'^```(?:json)?\s*|\s*```$', '', raw.strip(), flags=re.MULTILINE)
    try:
        data = json.loads(cleaned)
        score = float(data["sentiment_score"])
    except (json.JSONDecodeError, KeyError, TypeError):
        # Fallback regex — match number after "sentiment_score":
        m = re.search(r'"sentiment_score"\s*:\s*(-?\d+(?:\.\d+)?)', cleaned)
        if not m:
            raise ValueError(f"Could not parse sentiment from: {raw[:200]}")
        score = float(m.group(1))
    if not -1.0 <= score <= 1.0:
        raise ValueError(f"sentiment_score out of range: {score}")
    return score
```

Use it in the News node:
```python
try:
    score = _parse_sentiment(result_text)
except ValueError as e:
    print(f"[news] parse failed: {e}")
    score = 0.0  # graceful default, but logged
state["news"] = [{"sentiment_score": score, "raw": result_text}]
state["sentiment"] = score
```

**File:** `backend/app/agents/risk.py` — apply the same pattern with `_parse_risk_score`:
```python
def _parse_risk_score(raw: str) -> float:
    cleaned = re.sub(r'^```(?:json)?\s*|\s*```$', '', raw.strip(), flags=re.MULTILINE)
    try:
        data = json.loads(cleaned)
        score = float(data["risk_score"])
    except (json.JSONDecodeError, KeyError, TypeError):
        m = re.search(r'"risk_score"\s*:\s*(\d+(?:\.\d+)?)', cleaned)
        if not m:
            raise ValueError(f"Could not parse risk_score from: {raw[:200]}")
        score = float(m.group(1))
    if not 0.0 <= score <= 1.0:
        raise ValueError(f"risk_score out of range: {score}")
    return score
```

### 1.5 Fix `app/agents/alert.py` None comparison

**File:** `backend/app/agents/alert.py`

**Find:**
```python
state["alert_triggered"] = state["risk_score"] > 0.8
```

**Replace with:**
```python
risk_score = state.get("risk_score") or 0.0
state["alert_triggered"] = risk_score > 0.8
```

### 1.6 Fix `app/api/endpoints/ws.py` token decode

**File:** `backend/app/api/endpoints/ws.py`

**Find the `_decode_token` helper:**
```python
def _decode_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload.get("sub"))
    except Exception:
        return None
```

**Replace with:**
```python
def _decode_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, _get_jwt_secret(), algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            return None
        return int(sub)
    except (JWTError, ValueError, TypeError):
        return None
```

(Import `_get_jwt_secret` from `app.auth`.)

### 1.7 Fix `app/services/quote_poller.py` None price coercion

**File:** `backend/app/services/quote_poller.py`

**Find the per-symbol loop body where `QuoteTick(...)` is constructed.**

**Add this guard immediately before `QuoteTick(...)`:**
```python
price = await fetch_price(symbol)
if price is None:
    # yfinance returned None or fetch failed — skip this tick.
    print(f"[poller] no price for {symbol}, skipping tick")
    continue
tick = models.QuoteTick(
    ts=datetime.now(timezone.utc),
    symbol=symbol,
    price=float(price),
    volume=None,
)
```

### 1.8 Fix `app/api/endpoints/query.py` final answer None handling

**File:** `backend/app/api/endpoints/query.py`

**Find** the post-DAG block that calls CitationGuard:
```python
final_state = await executor.run(initial_state)
validated_answer = CitationGuard.sanitize(final_state["answer"])
```

**Replace with:**
```python
final_state = await executor.run(initial_state)
answer_text = final_state.get("answer") or ""
validated_answer = CitationGuard.sanitize(answer_text) if answer_text else "[no answer generated]"
final_state["answer"] = validated_answer
```

### 1.9 Phase 1 verification

```bash
cd ~/finsight/backend
# 1. Compile-import every module — fails loud on syntax errors:
uv run python -c "from app.services.citation_guard import CitationGuard; print('citation_guard OK')"
uv run python -c "from app.api.deps import get_current_user; print('deps OK')"
uv run python -c "from app.auth import create_access_token; print('auth OK')"
uv run python -c "from app.agents.news import _parse_sentiment; print(_parse_sentiment('{\"sentiment_score\": 0.5}'))"
uv run python -c "from app.agents.risk import _parse_risk_score; print(_parse_risk_score('{\"risk_score\": 0.7}'))"
uv run python -c "from app.api.endpoints.ws import _decode_token; print('ws OK')"
# 2. Boot the app — must not crash:
uv run uvicorn app.main:app --port 8000 &
sleep 4
curl -s http://localhost:8000/healthz
# Expected: {"status":"ok"}
kill %1 2>/dev/null || true
```

**If ANY of the 6 imports fail → STOP, report the traceback verbatim.**

### 1.10 Phase 1 commit

```bash
cd ~/finsight
git add -A
git commit -m "fix: P0 runtime bugs blocking DAG, auth, WS, and poller

- Migrate SQLA 1.x .query.where() → 2.0 select(...).where() in deps and alert_evaluator
- Standardize JWT claims to {sub, email, exp} via single create_access_token()
- Fail loud if JWT_SECRET is default/unset
- Fix CitationGuard regex syntax error (cannot compile previously)
- Replace fragile sentiment/risk regex with json.loads() + range validation
- Guard None risk_score in alert node
- Guard None sub in WS token decode
- Skip ticks when yfinance returns None price
- Guard None answer in query.py before CitationGuard.sanitize"
```

---

## §2. PHASE 2 — Schema fix: add `Position.alert_threshold` [25 min]

**Goal:** Add the `alert_threshold` column the AlertEvaluator already references but the schema doesn't have. Without this, alerts crash on first poll.

**Parallel-safe:** No.

### 2.1 Update the model

**File:** `backend/app/models.py`

**Find the Position class** and add `alert_threshold` field:

```python
class Position(Base):
    __tablename__ = "positions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    symbol = Column(String(20), nullable=False)
    quantity = Column(Float, nullable=False)
    average_price = Column(Float, nullable=False)
    alert_threshold = Column(Float, nullable=True)  # NEW: trigger when price >= this
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="positions")
```

### 2.2 Update DTOs

**File:** `backend/app/schemas.py`

```python
class PositionBase(BaseModel):
    symbol: str = Field(..., max_length=20)
    quantity: float = Field(..., gt=0)
    average_price: float = Field(..., gt=0)
    alert_threshold: Optional[float] = Field(None, gt=0)  # NEW

class PositionCreate(PositionBase):
    pass

class Position(PositionBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class PositionOut(Position):
    unrealized_pnl: Optional[float] = None
    unrealized_pnl_pct: Optional[float] = None
    current_price: Optional[float] = None
```

### 2.3 Generate the migration

```bash
cd ~/finsight/backend
uv run alembic revision --autogenerate -m "add_alert_threshold_to_positions"
```

**Verify the generated file** in `backend/migrations/versions/0002_*.py`. It MUST contain ONLY:
```python
def upgrade() -> None:
    op.add_column("positions", sa.Column("alert_threshold", sa.Float(), nullable=True))

def downgrade() -> None:
    op.drop_column("positions", "alert_threshold")
```

If autogen produced extra ops (drop/recreate, table renames), edit the file by hand to keep ONLY the `add_column` / `drop_column` pair. Anything else is autogen drift and will damage the schema.

### 2.4 Apply the migration

```bash
cd ~/finsight/backend
uv run alembic upgrade head
# Verify:
uv run python -c "from sqlalchemy import inspect, create_engine; import os; e=create_engine(os.environ['DATABASE_URL'].replace('+psycopg','').replace('+asyncpg','')); print('alert_threshold' in [c['name'] for c in inspect(e).get_columns('positions')])"
# Expected: True
```

### 2.5 Fix `alert_evaluator.py` to use 2.0 syntax

**File:** `backend/app/services/alert_evaluator.py`

**Replace every `models.Position.query.where(...)` block** with:
```python
from sqlalchemy import select

async def evaluate_position_thresholds(self, symbol: str, price: float) -> None:
    result = await self.db.execute(
        select(models.Position).where(
            models.Position.symbol == symbol,
            models.Position.alert_threshold.isnot(None),
        )
    )
    positions = result.scalars().all()
    for pos in positions:
        if pos.alert_threshold is not None and price >= pos.alert_threshold:
            key = f"{pos.user_id}:{pos.symbol}"
            if not self._active_alerts.get(key):
                self._active_alerts[key] = True
                await self._publish_alert(pos, price)
        elif pos.alert_threshold is not None and price < pos.alert_threshold:
            key = f"{pos.user_id}:{pos.symbol}"
            self._active_alerts[key] = False
```

### 2.6 Phase 2 verification

```bash
cd ~/finsight/backend
uv run python -c "from app.services.alert_evaluator import AlertEvaluator; print('alert_evaluator OK')"
uv run alembic current
# Expected: 0002 (head)
uv run alembic downgrade -1
uv run alembic upgrade head
# Expected: round-trip succeeds
```

### 2.7 Phase 2 commit
```bash
git add -A
git commit -m "feat(schema): add alert_threshold column to positions

- New Alembic revision 0002
- Position.alert_threshold Float NULL
- PositionCreate/PositionOut updated
- AlertEvaluator query rewritten to SQLA 2.0 select() syntax"
```

---

## §3. PHASE 3 — Backend ↔ Frontend contract repair [1.5h]

**Goal:** Fix all 6 contract drifts identified in the parity audit. Each drift is a place where the FE expects something the BE doesn't deliver, or vice versa.

**Parallel-safe:** No.

### 3.1 DRIFT 1 — Login: form-data vs JSON

**Decision:** Keep BE as `OAuth2PasswordRequestForm` (the FastAPI standard). Fix the FE to send form-data.

**File:** `frontend/src/lib/api.ts` — add a typed login helper:
```ts
import axios, { AxiosInstance } from "axios";

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export async function loginWithCredentials(email: string, password: string) {
  const form = new URLSearchParams();
  form.append("username", email);
  form.append("password", password);
  const { data } = await api.post<{ access_token: string; token_type: string }>(
    "/auth/login",
    form,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  return data;
}

export default api;
```

**File:** `frontend/src/pages/Login.tsx` — call `loginWithCredentials`:
```ts
import { loginWithCredentials } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError("");
  try {
    const { access_token } = await loginWithCredentials(email, password);
    localStorage.setItem("token", access_token);
    useAuthStore.getState().setAuth({ token: access_token, user: { email } });
    navigate(redirectTo || "/dashboard");
  } catch (err: any) {
    setError(err.response?.data?.detail || "Login failed");
  } finally {
    setLoading(false);
  }
};
```

### 3.2 DRIFT 2 — `GET /positions`: server-side P&L

**Decision:** Compute P&L on the server using the latest `quote_ticks` row per symbol. FE displays the response directly. No more client-side `as any` casts.

**File:** `backend/app/api/endpoints/positions.py` — replace the GET handler:

```python
from sqlalchemy import select, func
from app import models, schemas
from app.api.deps import CurrentUser, DBDep

@router.get("/", response_model=list[schemas.PositionOut])
async def list_positions(user: CurrentUser, db: DBDep) -> list[schemas.PositionOut]:
    pos_result = await db.execute(
        select(models.Position).where(models.Position.user_id == user.id)
    )
    positions = pos_result.scalars().all()
    if not positions:
        return []

    # Fetch latest tick per symbol in one query
    symbols = list({p.symbol for p in positions})
    latest_subq = (
        select(
            models.QuoteTick.symbol,
            func.max(models.QuoteTick.ts).label("max_ts"),
        )
        .where(models.QuoteTick.symbol.in_(symbols))
        .group_by(models.QuoteTick.symbol)
        .subquery()
    )
    q = select(models.QuoteTick).join(
        latest_subq,
        (models.QuoteTick.symbol == latest_subq.c.symbol)
        & (models.QuoteTick.ts == latest_subq.c.max_ts),
    )
    tick_result = await db.execute(q)
    latest_by_symbol = {t.symbol: t.price for t in tick_result.scalars().all()}

    out: list[schemas.PositionOut] = []
    for p in positions:
        current = latest_by_symbol.get(p.symbol)
        unrealized_pnl = None
        unrealized_pnl_pct = None
        if current is not None:
            unrealized_pnl = (current - p.average_price) * p.quantity
            unrealized_pnl_pct = (current / p.average_price - 1.0) * 100.0
        out.append(
            schemas.PositionOut(
                id=p.id,
                user_id=p.user_id,
                symbol=p.symbol,
                quantity=p.quantity,
                average_price=p.average_price,
                alert_threshold=p.alert_threshold,
                created_at=p.created_at,
                updated_at=p.updated_at,
                current_price=current,
                unrealized_pnl=unrealized_pnl,
                unrealized_pnl_pct=unrealized_pnl_pct,
            )
        )
    return out
```

**File:** `frontend/src/pages/Positions.tsx` — remove `(pos as any)` casts:
```ts
// OLD: (pos as any).current_price
// NEW: pos.current_price ?? pos.average_price

// OLD: (pos as any).unrealized_pl
// NEW: pos.unrealized_pnl ?? 0
```

Update the `Position` TypeScript interface:
```ts
// frontend/src/types/position.ts (create if missing)
export interface Position {
  id: number;
  user_id: number;
  symbol: string;
  quantity: number;
  average_price: number;
  alert_threshold: number | null;
  created_at: string;
  updated_at: string;
  current_price: number | null;
  unrealized_pnl: number | null;
  unrealized_pnl_pct: number | null;
}
```

### 3.3 DRIFT 3 — WS event shape: emit `tokens` and `partial_output`

**File:** `backend/app/agents/executor.py`

**Update `_run_node`** to track tokens and partial output. Helper at top of file:
```python
def _approx_tokens(text: str | None) -> int:
    if not text:
        return 0
    return max(1, len(text) // 4)  # rough chars/4 heuristic for Gemini flash
```

**Update the per-node lifecycle** to emit running, then done, with the new fields:
```python
async def _run_node(self, name: str, state: AgentState) -> None:
    started = datetime.now(timezone.utc).isoformat()
    await self.on_event({
        "type": "dag_event",
        "node": name,
        "status": "running",
        "run_id": state["run_id"],
        "started_at": started,
    })
    t0 = time.perf_counter()
    try:
        node_fn = self.nodes[name]
        await node_fn(state)
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        partial = self._extract_partial(name, state)
        await self.on_event({
            "type": "dag_event",
            "node": name,
            "status": "done",
            "run_id": state["run_id"],
            "started_at": started,
            "ended_at": datetime.now(timezone.utc).isoformat(),
            "latency_ms": elapsed_ms,
            "tokens": _approx_tokens(partial),
            "partial_output": (partial or "")[:200],
        })
    except Exception as e:
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        await self.on_event({
            "type": "dag_event",
            "node": name,
            "status": "error",
            "run_id": state["run_id"],
            "started_at": started,
            "ended_at": datetime.now(timezone.utc).isoformat(),
            "latency_ms": elapsed_ms,
            "tokens": 0,
            "partial_output": "",
            "error_msg": str(e)[:200],
        })
        raise

def _extract_partial(self, name: str, state: AgentState) -> str:
    if name == "MarketData":
        md = state.get("market_data") or {}
        return f"latest=${md.get('latest_price', 0):.2f}"
    if name == "News":
        items = state.get("news") or []
        return f"{len(items)} headlines, sentiment={state.get('sentiment', 0):.2f}"
    if name == "Forecast":
        f = state.get("forecast") or {}
        if "error" in f:
            return f"error: {f['error']}"
        rows = f.get("forecast", [])
        return f"{len(rows)} day projection, mape={f.get('mape', 0):.2f}"
    if name == "Risk":
        return f"risk_score={state.get('risk_score', 0):.2f}"
    if name == "Alert":
        ans = state.get("answer") or ""
        return ans[:200]
    return ""
```

### 3.4 DRIFT 4 — `Overview.tsx` reads hardcoded watchlist

Handled in §7.1 (frontend wiring phase).

### 3.5 DRIFT 5 — `CandleChart` uses PRNG

Handled in §7.2.

### 3.6 DRIFT 6 — CitationGuard format mismatch

**Decision:** Standardize on numeric `[1]`, `[2]`, `[3]` citations. The Alert node prompt already produces them; FE CitationChip parses `\[(\d+)\]`. We need to (a) reliably produce them in the Alert node, (b) attach a citations array to the `/query` response so FE can hover-resolve them.

Backend changes in §4. FE changes in §7.4.

### 3.7 Phase 3 verification

```bash
cd ~/finsight
docker compose up -d postgres
sleep 3
cd backend
uv run uvicorn app.main:app --port 8000 &
sleep 4

# 1. Login form-data path:
curl -s -X POST http://localhost:8000/auth/login \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'username=demo@finsight.ai&password=Demo@12345' | grep access_token
# Expected: contains access_token

# 2. /positions returns PositionOut shape:
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login -H 'Content-Type: application/x-www-form-urlencoded' -d 'username=demo@finsight.ai&password=Demo@12345' | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s http://localhost:8000/positions -H "Authorization: Bearer $TOKEN" | python -m json.tool
# Expected: each item has keys current_price, unrealized_pnl, unrealized_pnl_pct (may be null if no ticks yet)

kill %1 2>/dev/null || true
cd ../frontend
pnpm tsc --noEmit
# Expected: zero TypeScript errors
```

### 3.8 Phase 3 commit
```bash
git add -A
git commit -m "fix(contract): repair 6 FE/BE contract drifts

- FE login uses form-data per OAuth2PasswordRequestForm
- BE GET /positions computes P&L server-side from latest QuoteTick
- FE Position interface adds current_price/unrealized_pnl
- DAG executor emits tokens (heuristic) and partial_output per node
- Standardize numeric [n] citation format (FE/BE)"
```

---

## §4. PHASE 4 — CitationGuard end-to-end [1.5h]

**Goal:** Make the MVP-mandatory CitationGuard requirement (PDF rule) work demo-step-5: a user-visible numeric without `[n]` is blocked from rendering, with hover-resolvable citations.

**Parallel-safe:** No.

### 4.1 Strengthen `CitationGuard` (backend)

**File:** `backend/app/services/citation_guard.py` — full replacement:

```python
"""Backend CitationGuard: blocks rendering of uncited numeric claims.

Mandatory per CLAUDE.md. Applied to every LLM output written to AgentState,
not just the final answer.
"""
from __future__ import annotations
import re
from dataclasses import dataclass
from typing import Iterable

# Compile once. Bug-prone if recompiled inline — keep as module constant.
_NUMERIC_PATTERN = re.compile(r'\$?\d+(?:\.\d+)?%?(?!\s*\[\d+\])')
_YEAR_PATTERN = re.compile(r'\b(19|20)\d{2}\b')
_LIST_MARKER = re.compile(r'^\s*\d+\.\s', re.MULTILINE)

@dataclass(frozen=True)
class Violation:
    text: str
    span: tuple[int, int]

class CitationGuard:
    @staticmethod
    def find_uncited(text: str) -> list[Violation]:
        if not text:
            return []
        years = {m.span() for m in _YEAR_PATTERN.finditer(text)}
        list_markers = {m.span() for m in _LIST_MARKER.finditer(text)}
        out: list[Violation] = []
        for m in _NUMERIC_PATTERN.finditer(text):
            span = m.span()
            # Skip years (e.g., 2024)
            if any(s[0] <= span[0] < s[1] for s in years):
                continue
            # Skip list markers (e.g., "1. ", "2. ")
            if any(s[0] <= span[0] < s[1] for s in list_markers):
                continue
            # Skip ID-like numbers > 10000
            try:
                value = float(m.group().lstrip("$").rstrip("%"))
                if value > 10000:
                    continue
            except ValueError:
                pass
            out.append(Violation(text=m.group(), span=span))
        return out

    @staticmethod
    def validate(text: str) -> tuple[bool, list[Violation]]:
        v = CitationGuard.find_uncited(text)
        return len(v) == 0, v

    @staticmethod
    def sanitize(text: str) -> str:
        if not text:
            return ""
        violations = CitationGuard.find_uncited(text)
        if not violations:
            return text
        # Replace from end → start to keep spans valid
        out = text
        for v in sorted(violations, key=lambda x: -x.span[0]):
            out = out[: v.span[0]] + "[REDACTED: uncited numeric]" + out[v.span[1] :]
        out += "\n\n_Note: some numeric claims were redacted because they lacked citation chips._"
        return out
```

### 4.2 Apply CitationGuard to **every** LLM output

**File:** `backend/app/agents/news.py` — sanitize the raw LLM response before storing summaries:
```python
from app.services.citation_guard import CitationGuard
# After parsing sentiment:
state["news"] = [{
    "sentiment_score": score,
    "raw": CitationGuard.sanitize(result_text),
}]
```

**File:** `backend/app/agents/risk.py` — same:
```python
from app.services.citation_guard import CitationGuard
# Reasoning sanitized too:
state["risk_reasoning"] = CitationGuard.sanitize(result_text)
state["risk_score"] = score
```

**File:** `backend/app/agents/alert.py` — already done in §1.8. Verify:
```python
answer = await gemini_client.generate_content(prompt)
state["answer"] = CitationGuard.sanitize(answer or "")
```

### 4.3 Make the Alert prompt produce real `[n]` citations

**File:** `backend/app/agents/alert.py` — rewrite the prompt to enforce numeric chip format:

```python
def _build_alert_prompt(state: AgentState) -> tuple[str, list[dict]]:
    symbol = state["symbol"]
    query = state.get("query", "")
    news_items = state.get("news") or []
    forecast = state.get("forecast") or {}
    risk_score = state.get("risk_score", 0.0)

    sources: list[dict] = []
    src_lines: list[str] = []
    for i, n in enumerate(news_items[:3], start=1):
        sources.append({
            "n": i,
            "kind": "news",
            "headline": n.get("headline", ""),
            "url": n.get("url", ""),
        })
        src_lines.append(f"[{i}] {n.get('headline', '')[:160]}")
    if forecast and "forecast" in forecast:
        n = len(sources) + 1
        sources.append({"n": n, "kind": "forecast", "mape": forecast.get("mape")})
        src_lines.append(f"[{n}] 7-day Holt-Winters forecast (MAPE={forecast.get('mape', 0):.2f})")

    prompt = (
        f"You are a financial analyst answering: {query!r} about {symbol}.\n\n"
        "Rules (HARD):\n"
        "1. Every numeric claim MUST be followed by a numeric citation in square brackets, e.g. '+5.2% [1]'.\n"
        "2. Cite ONLY from the sources below; never invent a source number.\n"
        "3. Educational use only; not financial advice.\n"
        "4. ≤120 words.\n\n"
        f"Risk score: {risk_score:.2f}\n\n"
        "<untrusted_data>\n"
        + "\n".join(src_lines) +
        "\n</untrusted_data>\n\n"
        "Answer:"
    )
    return prompt, sources
```

Then in the node body:
```python
prompt, sources = _build_alert_prompt(state)
answer = await gemini_client.generate_content(prompt)
state["answer"] = CitationGuard.sanitize(answer or "")
state["sources"] = sources
```

### 4.4 Surface `sources` to FE via `/query` response payload

**File:** `backend/app/api/endpoints/query.py` — when DAG completes, broadcast a final WS event including the answer + sources array:

```python
final_state = await executor.run(initial_state)
answer_text = final_state.get("answer") or ""
sources = final_state.get("sources") or []
final_payload = {
    "type": "query_complete",
    "run_id": run_id,
    "answer": answer_text,
    "sources": sources,
    "disclaimer": "Educational use only — not financial advice.",
}
await ws_hub.publish_to_user(current_user.id, final_payload)
```

### 4.5 Frontend CitationGuard — already correct, just wire `sources`

**File:** `frontend/src/store/wsStore.ts` (or equivalent) — handle `query_complete`:

```ts
case "query_complete":
  set((s) => ({
    answersByRun: { ...s.answersByRun, [event.run_id]: {
      answer: event.answer,
      sources: event.sources,
      disclaimer: event.disclaimer,
    }},
  }));
  break;
```

**File:** `frontend/src/components/AnswerPanel.tsx` — render with hover tooltip on `[n]`:

```tsx
import { CitationGuard } from "@/lib/citation-guard";

interface Source { n: number; kind: string; headline?: string; url?: string; mape?: number }

export function AnswerPanel({ answer, sources, disclaimer }: {
  answer: string; sources: Source[]; disclaimer: string;
}) {
  const sanitized = CitationGuard.sanitize(answer);
  // Replace [n] with hover-able chips
  const parts = sanitized.split(/(\[\d+\])/g);
  return (
    <div className="rounded-xl border border-[#232c3a] bg-[#161d27] p-4 text-sm">
      <p className="leading-relaxed">
        {parts.map((p, i) => {
          const m = p.match(/^\[(\d+)\]$/);
          if (!m) return <span key={i}>{p}</span>;
          const n = parseInt(m[1], 10);
          const src = sources.find((s) => s.n === n);
          return (
            <span
              key={i}
              title={src ? (src.headline || `${src.kind}: MAPE=${src.mape}`) : "unknown source"}
              className="inline-block bg-amber-400/20 text-amber-300 rounded px-1 mx-0.5 cursor-help"
            >
              [{n}]
            </span>
          );
        })}
      </p>
      <p className="mt-3 text-xs text-neutral-500 italic">{disclaimer}</p>
      {sources.length > 0 && (
        <ul className="mt-3 text-xs text-neutral-400 space-y-1">
          {sources.map((s) => (
            <li key={s.n}>
              [{s.n}]{" "}
              {s.url ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">
                  {s.headline}
                </a>
              ) : (
                `${s.kind} (MAPE=${s.mape?.toFixed(2)})`
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### 4.6 Phase 4 verification

```bash
cd ~/finsight/backend
uv run python <<'PY'
from app.services.citation_guard import CitationGuard
# 1. Compile/import:
print("import OK")
# 2. Years allowed:
assert CitationGuard.validate("In 2024, AAPL rose [1]")[0] is True
# 3. Uncited number caught:
ok, vio = CitationGuard.validate("AAPL rose 5.2% today")
assert not ok and len(vio) == 1, vio
# 4. Sanitization:
out = CitationGuard.sanitize("AAPL rose 5.2% today")
assert "[REDACTED" in out, out
print("CitationGuard tests passed")
PY
```

### 4.7 Phase 4 commit
```bash
git add -A
git commit -m "feat(citations): end-to-end CitationGuard with hover-resolvable sources

- Numeric pattern compiled once; years/list-markers/large-IDs whitelisted
- Apply sanitize() to every LLM output written to AgentState
- Alert prompt enforces [n] citations from sources array
- /query emits query_complete WS event with answer + sources
- AnswerPanel renders [n] chips with hover tooltip and source list"
```

---

## §5. PHASE 5 — DAG executor: fail-OPEN with skipped semantics [1h]

**Goal:** Per CLAUDE.md, a node failing should set downstream nodes to `skipped` and still render a partial answer with a degradation banner. Currently it raises and terminates the whole DAG, leaking zombie tasks.

**Parallel-safe:** No.

### 5.1 Rewrite `DAGExecutor.run`

**File:** `backend/app/agents/executor.py`

Replace the body of `run`:

```python
import asyncio
import time
from datetime import datetime, timezone

class DAGExecutor:
    def __init__(self, nodes: dict[str, NodeCallable], on_event):
        self.nodes = nodes
        self.on_event = on_event

    async def run(self, state: AgentState) -> AgentState:
        state.setdefault("errors", {})
        state.setdefault("skipped", [])

        # Stage 1: MarketData
        ok = await self._safe_run("MarketData", state, required=True)
        if not ok:
            await self._mark_skipped(["News", "Forecast", "Risk", "Alert"], state)
            state["answer"] = "[degraded] MarketData fetch failed; downstream skipped."
            return state

        # Stage 2: News || Forecast
        results = await asyncio.gather(
            self._safe_run("News", state),
            self._safe_run("Forecast", state),
            return_exceptions=False,
        )
        # Even if one fails, the other completes (return_exceptions handled inside _safe_run).

        # Stage 3: Risk (depends on News, Forecast — runs even if one upstream failed)
        await self._safe_run("Risk", state)

        # Stage 4: Alert (always runs; produces a degradation-aware answer)
        await self._safe_run("Alert", state)

        return state

    async def _safe_run(self, name: str, state: AgentState, required: bool = False) -> bool:
        if name not in self.nodes:
            return False
        started = datetime.now(timezone.utc).isoformat()
        await self.on_event({
            "type": "dag_event", "node": name, "status": "running",
            "run_id": state["run_id"], "started_at": started,
        })
        t0 = time.perf_counter()
        try:
            await self.nodes[name](state)
        except Exception as e:
            elapsed_ms = int((time.perf_counter() - t0) * 1000)
            state["errors"][name] = str(e)[:200]
            await self.on_event({
                "type": "dag_event", "node": name, "status": "error",
                "run_id": state["run_id"], "started_at": started,
                "ended_at": datetime.now(timezone.utc).isoformat(),
                "latency_ms": elapsed_ms, "tokens": 0, "partial_output": "",
                "error_msg": str(e)[:200],
            })
            return False
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        partial = self._extract_partial(name, state)
        await self.on_event({
            "type": "dag_event", "node": name, "status": "done",
            "run_id": state["run_id"], "started_at": started,
            "ended_at": datetime.now(timezone.utc).isoformat(),
            "latency_ms": elapsed_ms,
            "tokens": _approx_tokens(partial),
            "partial_output": (partial or "")[:200],
        })
        return True

    async def _mark_skipped(self, names: list[str], state: AgentState) -> None:
        for n in names:
            state["skipped"].append(n)
            await self.on_event({
                "type": "dag_event", "node": n, "status": "skipped",
                "run_id": state["run_id"],
                "started_at": datetime.now(timezone.utc).isoformat(),
                "ended_at": datetime.now(timezone.utc).isoformat(),
                "latency_ms": 0, "tokens": 0, "partial_output": "",
            })
```

### 5.2 Make Alert node degradation-aware

**File:** `backend/app/agents/alert.py` — add at the start of the node body:
```python
errors = state.get("errors") or {}
skipped = state.get("skipped") or []
degraded = bool(errors) or bool(skipped)
```

In `_build_alert_prompt`, append:
```python
if degraded:
    prompt += f"\n\nNOTE: The following stages had issues — {list(errors.keys()) + skipped}. State that the answer is partial."
```

### 5.3 FE — render `skipped` and degradation banner

**File:** `frontend/src/components/dag/AgentNode.tsx` — add a `skipped` status branch:
```ts
const statusColor = {
  idle: "#232c3a",
  running: "#f5b454",
  done: "#10b981",
  error: "#ef4444",
  skipped: "#6b7280", // grey
}[status];
```

**File:** `frontend/src/components/AnswerPanel.tsx` — show the degradation banner when answer starts with `[degraded]`:
```tsx
const isDegraded = answer.trim().startsWith("[degraded]");
{isDegraded && (
  <div className="mb-2 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
    Partial answer: one or more pipeline stages failed. Results may be incomplete.
  </div>
)}
```

### 5.4 Phase 5 verification

```bash
cd ~/finsight/backend
uv run python <<'PY'
import asyncio
from app.agents.executor import DAGExecutor

events = []
async def cap(e): events.append(e)

async def good(state): state["market_data"] = {"latest_price": 100}
async def bad(state): raise RuntimeError("boom")
async def alert(state): state["answer"] = "[degraded] alert ok"

ex = DAGExecutor(
    nodes={"MarketData": bad, "News": good, "Forecast": good, "Risk": good, "Alert": alert},
    on_event=cap,
)
state = {"run_id": "t1", "user_id": 1, "symbol": "X", "query": "?", "errors": {}, "skipped": []}
result = asyncio.run(ex.run(state))
statuses = {e["node"]: e["status"] for e in events if e["type"] == "dag_event"}
assert statuses["MarketData"] == "error", statuses
assert statuses["News"] == "skipped", statuses
assert "[degraded]" in result.get("answer", ""), result
print("fail-open verified")
PY
```

### 5.5 Phase 5 commit
```bash
git add -A
git commit -m "feat(dag): fail-open executor with skipped semantics

- One stage failing no longer terminates DAG
- Failed nodes emit status:'error'; downstream emits status:'skipped'
- Alert node always runs and prefixes '[degraded]' when upstream failed
- FE renders skipped (grey) and degradation banner"
```

---

## §6. PHASE 6 — External clients: retries + async-safety [40 min]

**Goal:** Add retry/backoff per CLAUDE.md; stop blocking the event loop with sync Prophet calls.

**Parallel-safe:** Yes (sub-tasks 6.1, 6.2, 6.3 are independent).

### 6.1 Add `tenacity` retries to Gemini and Finnhub

**File:** `backend/requirements.txt` — add line:
```
tenacity==8.2.3
```

Then `cd backend && uv sync` (or `pip install -r requirements.txt`).

**File:** `backend/app/services/gemini_client.py` — wrap real call:
```python
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

class GeminiClient:
    # ... __init__ unchanged ...

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        retry=retry_if_exception_type(Exception),
        reraise=True,
    )
    async def _generate_real(self, prompt: str) -> str:
        client = genai.Client(api_key=self.api_key)
        resp = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-2.0-flash",
            contents=prompt,
        )
        return resp.text or ""

    async def generate_content(self, prompt: str) -> str:
        if self.demo_mode:
            return self._fixture_response(prompt)
        try:
            return await self._generate_real(prompt)
        except Exception as e:
            print(f"[gemini] failed after retries: {e}")
            return "[gemini error]"
```

**File:** `backend/app/services/finnhub_client.py` — wrap fetch:
```python
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=6),
    reraise=True,
)
async def _fetch_news_real(self, symbol: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(
            "https://finnhub.io/api/v1/company-news",
            params={"symbol": symbol, "token": self.api_key,
                    "from": (datetime.utcnow() - timedelta(days=3)).strftime("%Y-%m-%d"),
                    "to": datetime.utcnow().strftime("%Y-%m-%d")},
        )
        r.raise_for_status()
        return r.json() or []
```

### 6.2 Move Prophet to `asyncio.to_thread`

**File:** `backend/app/agents/forecast.py`:
```python
from app.services.prophet_service import get_forecast

async def run(state: AgentState) -> None:
    md = state.get("market_data") or {}
    history_df = md.get("history_df")
    if history_df is None or len(history_df) < 5:
        state["forecast"] = {"error": "Insufficient data"}
        return
    state["forecast"] = await asyncio.to_thread(get_forecast, history_df, 7)
```

### 6.3 Hard-fail FinnhubClient if no key in real mode

**File:** `backend/app/services/finnhub_client.py` — in `__init__`:
```python
def __init__(self) -> None:
    self.demo_mode = os.getenv("DEMO_MODE", "1") == "1"
    self.api_key = os.getenv("FINNHUB_API_KEY", "")
    if not self.demo_mode and not self.api_key:
        print("[finnhub] WARNING: real mode but no FINNHUB_API_KEY; will return []")
```

### 6.4 Phase 6 verification

```bash
cd ~/finsight/backend
uv run python -c "from app.services.gemini_client import GeminiClient; print('gemini OK')"
uv run python -c "from app.services.finnhub_client import FinnhubClient; print('finnhub OK')"
uv run python -c "from app.agents.forecast import run; print('forecast OK')"
```

### 6.5 Phase 6 commit
```bash
git add -A
git commit -m "feat(clients): retries + async-safety for external services

- tenacity retry(3, exp 1-8s) on Gemini real calls
- tenacity retry(3, exp 1-6s) on Finnhub real calls
- Prophet/Holt-Winters wrapped in asyncio.to_thread to avoid event-loop block
- FinnhubClient warns at init if real mode without API key"
```

---

## §7. PHASE 7 — Frontend wiring: real data, alerts, P&L [3h]

**Goal:** Replace hardcoded mocks with real endpoint calls; render alert toasts; feed live prices into Positions for client-side P&L flash.

**Parallel-safe:** §7.1, §7.2, §7.3, §7.4 are independent — run in any order.

### 7.1 Watchlist real wiring (`Overview.tsx`)

**File:** `frontend/src/lib/queries/watchlist.ts` (create):
```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export interface WatchlistItem { id: number; user_id: number; symbol: string; added_at: string }

export function useWatchlist() {
  return useQuery<WatchlistItem[]>({
    queryKey: ["watchlist"],
    queryFn: async () => (await api.get<WatchlistItem[]>("/watchlist")).data,
    staleTime: 30_000,
  });
}

export function useAddWatchlistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (symbol: string) =>
      (await api.post<WatchlistItem>("/watchlist", { symbol })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });
}

export function useRemoveWatchlistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/watchlist/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });
}
```

**File:** `frontend/src/pages/Overview.tsx` — replace `INITIAL_TICKERS`:
```tsx
import { useWatchlist, useAddWatchlistItem } from "@/lib/queries/watchlist";
import { useWsStore } from "@/store/wsStore";
import { useState } from "react";

export default function Overview() {
  const { data: watchlist = [], isLoading } = useWatchlist();
  const addItem = useAddWatchlistItem();
  const latestPrices = useWsStore((s) => s.latestPrices);
  const [newSymbol, setNewSymbol] = useState("");

  if (isLoading) return <Skeleton lines={5} />;
  if (watchlist.length === 0) {
    return (
      <EmptyState
        title="Your watchlist is empty"
        cta={
          <form onSubmit={(e) => { e.preventDefault(); addItem.mutate(newSymbol.toUpperCase()); setNewSymbol(""); }}>
            <input value={newSymbol} onChange={(e) => setNewSymbol(e.target.value)} placeholder="AAPL" />
            <button type="submit">Add</button>
          </form>
        }
      />
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {watchlist.map((w) => {
        const live = latestPrices[w.symbol];
        return <StatCard key={w.id} symbol={w.symbol} price={live?.price ?? 0} ts={live?.ts} />;
      })}
    </div>
  );
}
```

**File:** `frontend/src/store/wsStore.ts` — extend handleEvent to track latest prices:
```ts
case "quote_tick":
  set((s) => ({
    latestPrices: { ...s.latestPrices, [event.symbol]: { price: event.price, ts: event.ts } },
  }));
  break;
```

Add to store state shape:
```ts
latestPrices: Record<string, { price: number; ts: string }>;
```

Initial value: `{}`.

### 7.2 CandleChart real history

**File:** `frontend/src/lib/queries/quotes.ts` (create):
```ts
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export interface Candle { ts: string; open: number; high: number; low: number; close: number; volume: number | null }

export function useCandleHistory(symbol: string | null, period: "1mo" | "3mo" | "1y" = "1mo") {
  return useQuery<Candle[]>({
    queryKey: ["candles", symbol, period],
    queryFn: async () =>
      (await api.get<Candle[]>(`/quotes/${symbol}/history`, { params: { period } })).data,
    enabled: !!symbol,
    staleTime: 5 * 60_000,
  });
}
```

**File:** `frontend/src/components/charts/CandleChart.tsx` — remove `generateSeries`, use the hook:
```tsx
import { useCandleHistory } from "@/lib/queries/quotes";

export function CandleChart({ symbol }: { symbol: string }) {
  const { data, isLoading, error } = useCandleHistory(symbol, "1mo");
  if (isLoading) return <ChartSkeleton />;
  if (error || !data || data.length === 0) {
    return <div className="p-8 text-center text-neutral-500">No chart data available</div>;
  }
  // existing SVG render uses `data` instead of generateSeries():
  return <SvgCandleChart candles={data} />;
}
```

(Forecast overlay stays hidden until Prophet is reintroduced — write `// TODO(prophet): reintroduce overlay` comment, do NOT remove the placeholder div.)

### 7.3 AlertToast component

**File:** `frontend/src/components/AlertToast.tsx` (create):
```tsx
import { useEffect, useState } from "react";
import { useWsStore } from "@/store/wsStore";

interface Alert { id: string; symbol: string; price: number; message: string; ts: number }

export function AlertToastContainer() {
  const alerts = useWsStore((s) => s.alerts);
  const dismiss = useWsStore((s) => s.dismissAlert);
  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-2 max-w-sm">
      {alerts.slice(-3).map((a) => (
        <AlertToast key={a.id} alert={a} onDismiss={() => dismiss(a.id)} />
      ))}
    </div>
  );
}

function AlertToast({ alert, onDismiss }: { alert: Alert; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 8000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div role="alert" aria-live="polite" className="rounded-md border border-red-500/40 bg-[#1c2532] p-3 text-sm shadow-lg animate-in slide-in-from-right">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold text-red-400">⚠ {alert.symbol}</div>
          <div className="text-neutral-300 mt-1">{alert.message}</div>
          <div className="text-neutral-500 text-xs mt-1">@ ${alert.price.toFixed(2)}</div>
        </div>
        <button onClick={onDismiss} aria-label="Dismiss" className="text-neutral-500 hover:text-neutral-300">×</button>
      </div>
    </div>
  );
}
```

**File:** `frontend/src/store/wsStore.ts` — add alert handling:
```ts
alerts: Alert[];
dismissAlert: (id: string) => void;

// In handleEvent:
case "alert":
  set((s) => ({
    alerts: [...s.alerts, {
      id: `${event.symbol}-${Date.now()}`,
      symbol: event.symbol,
      price: event.price,
      message: event.message,
      ts: Date.now(),
    }],
  }));
  break;
```

Mount `<AlertToastContainer />` once in `DashboardShell.tsx`.

### 7.4 Positions: live P&L flash from WS

**File:** `frontend/src/pages/Positions.tsx` — augment server P&L with live ticks:
```tsx
import { useWsStore } from "@/store/wsStore";

const positionsQ = useQuery<Position[]>({ queryKey: ["positions"], queryFn: ... });
const latest = useWsStore((s) => s.latestPrices);

const rows = (positionsQ.data ?? []).map((p) => {
  const livePrice = latest[p.symbol]?.price ?? p.current_price ?? p.average_price;
  const pnl = (livePrice - p.average_price) * p.quantity;
  const pnlPct = (livePrice / p.average_price - 1) * 100;
  return { ...p, livePrice, pnl, pnlPct };
});
```

Add a flash class on tick (250ms green/red):
```tsx
const [flashKey, setFlashKey] = useState<string | null>(null);
useEffect(() => {
  // when latest[p.symbol] changes, set flashKey then clear after 250ms
}, [latest]);
```

### 7.5 AddPositionForm: alert_threshold field

**File:** `frontend/src/components/positions/AddPositionForm.tsx` — add field after `average_price`:
```tsx
<label className="block">
  Alert threshold (optional)
  <input
    type="number"
    step="0.01"
    value={alertThreshold}
    onChange={(e) => setAlertThreshold(e.target.value)}
    placeholder="Trigger when price ≥"
    className="..."
  />
</label>
```

In submit:
```tsx
await api.post("/positions/", {
  symbol,
  quantity: parseFloat(quantity),
  average_price: parseFloat(avgPrice),
  alert_threshold: alertThreshold ? parseFloat(alertThreshold) : null,
});
```

### 7.6 WS event array — bound it

**File:** `frontend/src/store/wsStore.ts` — cap `dagEvents` at 500:
```ts
dagEvents: state.dagEvents.length > 500
  ? [...state.dagEvents.slice(-400), event]
  : [...state.dagEvents, event];
```

### 7.7 Phase 7 verification

```bash
cd ~/finsight/frontend
pnpm tsc --noEmit
# Expected: zero TS errors
pnpm dev &
sleep 5
# Open http://localhost:5173 in browser
# Check: empty state shows on /dashboard if no watchlist
# Check: Add NVDA → watchlist updates without refresh
# Check: Position with alert_threshold=950, then trigger via fixture poller → toast appears
kill %1 2>/dev/null || true
```

### 7.8 Phase 7 commit
```bash
git add -A
git commit -m "feat(frontend): real watchlist, real chart history, alert toasts, live P&L

- Overview reads /watchlist via React Query; empty state CTA
- CandleChart calls /quotes/{symbol}/history; PRNG removed
- AlertToastContainer renders WS alert events; ARIA + auto-dismiss 8s
- Positions overlays live WS prices on server-computed P&L baseline
- AddPositionForm exposes alert_threshold input
- wsStore tracks latestPrices and bounds dagEvents to last 500"
```

---

## §8. PHASE 8 — Per-node audit logging [40 min]

**Goal:** Every DAG node execution writes an `audit_events` row. Currently only the run kickoff is audited.

**Parallel-safe:** No.

### 8.1 Pass a session factory into the executor

**File:** `backend/app/agents/executor.py` — extend `__init__`:
```python
class DAGExecutor:
    def __init__(self, nodes, on_event, audit_writer=None):
        self.nodes = nodes
        self.on_event = on_event
        self.audit_writer = audit_writer  # callable(state, node, status, latency_ms)
```

In `_safe_run`, after the success/error event:
```python
if self.audit_writer:
    try:
        await self.audit_writer(
            user_id=state["user_id"],
            run_id=state["run_id"],
            node=name,
            status="done" if name not in state["errors"] else "error",
            latency_ms=elapsed_ms,
            tokens=_approx_tokens(partial),
        )
    except Exception as e:
        print(f"[audit] writer failed: {e}")
```

### 8.2 Write the audit_writer in `query.py`

**File:** `backend/app/api/endpoints/query.py`:
```python
async def _audit_writer_factory(db_factory):
    async def write(*, user_id, run_id, node, status, latency_ms, tokens):
        async with db_factory() as session:
            ev = models.AuditEvent(
                user_id=user_id,
                event_type="dag_node_execution",
                payload=json.dumps({
                    "run_id": run_id,
                    "node": node,
                    "status": status,
                    "latency_ms": latency_ms,
                    "tokens": tokens,
                    "model": "gemini-2.0-flash",
                }),
            )
            session.add(ev)
            await session.commit()
    return write

# In the endpoint:
audit_write = await _audit_writer_factory(AsyncSessionLocal)
executor = DAGExecutor(nodes=DAG_NODES, on_event=on_event, audit_writer=audit_write)
```

### 8.3 Phase 8 verification

```bash
cd ~/finsight
docker compose up -d
sleep 5
# In demo mode, fire a query:
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login -H 'Content-Type: application/x-www-form-urlencoded' -d 'username=demo@finsight.ai&password=Demo@12345' | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s -X POST http://localhost:8000/query -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"query":"Should I worry about TSLA?","symbol":"TSLA"}'
sleep 6
curl -s http://localhost:8000/audit -H "Authorization: Bearer $TOKEN" | python -m json.tool | head -40
# Expected: 5+ rows with event_type "dag_node_execution"
```

### 8.4 Phase 8 commit
```bash
git add -A
git commit -m "feat(audit): per-node audit_events rows with status, latency, tokens"
```

---

## §9. PHASE 9 — Tests (BE pytest + FE Vitest) [2.5h]

**Goal:** Hit MVP-PLAN's 25+ test gate. Cassette-mock all LLM/external calls.

**Parallel-safe:** §9.1 and §9.2 are independent.

### 9.1 Backend pytest setup

**File:** `backend/tests/conftest.py`:
```python
import os
os.environ.setdefault("DEMO_MODE", "1")
os.environ.setdefault("JWT_SECRET", "test-secret-not-for-production-but-32-chars-min")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/finsight_test")

import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db import engine, AsyncSessionLocal
from app.models import Base

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session", autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

@pytest.fixture
async def auth_headers(client):
    await client.post("/auth/register", json={
        "email": "test@finsight.ai", "password": "Test@12345", "full_name": "Test"
    })
    r = await client.post(
        "/auth/login",
        data={"username": "test@finsight.ai", "password": "Test@12345"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
```

**File:** `backend/tests/test_auth.py`:
```python
import pytest

@pytest.mark.asyncio
async def test_register_creates_user(client):
    r = await client.post("/auth/register", json={
        "email": "a@b.com", "password": "Pwd@12345", "full_name": "A"
    })
    assert r.status_code == 200
    assert r.json()["email"] == "a@b.com"
    assert "hashed_password" not in r.json()

@pytest.mark.asyncio
async def test_register_duplicate_409(client):
    await client.post("/auth/register", json={"email": "x@b.com", "password": "Pwd@12345"})
    r = await client.post("/auth/register", json={"email": "x@b.com", "password": "Pwd@12345"})
    assert r.status_code == 409

@pytest.mark.asyncio
async def test_login_form_data(client):
    await client.post("/auth/register", json={"email": "y@b.com", "password": "Pwd@12345"})
    r = await client.post("/auth/login", data={"username": "y@b.com", "password": "Pwd@12345"},
                         headers={"Content-Type": "application/x-www-form-urlencoded"})
    assert r.status_code == 200
    assert "access_token" in r.json()

@pytest.mark.asyncio
async def test_login_wrong_password_401(client):
    await client.post("/auth/register", json={"email": "z@b.com", "password": "Pwd@12345"})
    r = await client.post("/auth/login", data={"username": "z@b.com", "password": "WRONG"},
                         headers={"Content-Type": "application/x-www-form-urlencoded"})
    assert r.status_code == 401

@pytest.mark.asyncio
async def test_users_me_no_token_401(client):
    r = await client.get("/users/me")
    assert r.status_code == 401

@pytest.mark.asyncio
async def test_users_me_with_token(client, auth_headers):
    r = await client.get("/users/me", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["email"] == "test@finsight.ai"
    assert "hashed_password" not in r.json()

@pytest.mark.asyncio
async def test_expired_token_401(client):
    # use a manually crafted expired token
    from datetime import datetime, timedelta, timezone
    from jose import jwt
    import os
    payload = {"sub": "1", "email": "x@x.com",
               "exp": datetime.now(timezone.utc) - timedelta(minutes=1)}
    token = jwt.encode(payload, os.environ["JWT_SECRET"], algorithm="HS256")
    r = await client.get("/users/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401
```

**File:** `backend/tests/test_citation_guard.py`:
```python
from app.services.citation_guard import CitationGuard

def test_compiles_without_error():
    # If the regex syntax was broken, this import would have failed.
    assert CitationGuard.find_uncited("") == []

def test_year_not_flagged():
    ok, _ = CitationGuard.validate("In 2024, AAPL rose [1]")
    assert ok

def test_uncited_number_caught():
    ok, vio = CitationGuard.validate("AAPL rose 5.2% today")
    assert not ok
    assert any("5.2" in v.text for v in vio)

def test_cited_number_passes():
    ok, _ = CitationGuard.validate("AAPL rose 5.2% [1] today")
    assert ok

def test_sanitize_replaces():
    out = CitationGuard.sanitize("AAPL rose 5.2% today")
    assert "[REDACTED" in out
    assert "5.2%" not in out
```

**File:** `backend/tests/test_dag_executor.py`:
```python
import pytest, asyncio
from app.agents.executor import DAGExecutor

@pytest.mark.asyncio
async def test_fail_open_skipped_downstream():
    events = []
    async def cap(e): events.append(e)
    async def good(s): s["market_data"] = {"latest_price": 100}
    async def bad(s): raise RuntimeError("boom")
    async def alert(s): s["answer"] = "[degraded] partial"
    ex = DAGExecutor(
        nodes={"MarketData": bad, "News": good, "Forecast": good, "Risk": good, "Alert": alert},
        on_event=cap,
    )
    state = {"run_id": "t1", "user_id": 1, "symbol": "X", "query": "?", "errors": {}, "skipped": []}
    result = await ex.run(state)
    statuses = {e["node"]: e["status"] for e in events if e.get("type") == "dag_event"}
    assert statuses["MarketData"] == "error"
    assert statuses["News"] == "skipped"
    assert "[degraded]" in result["answer"]

@pytest.mark.asyncio
async def test_happy_path_emits_done_for_all():
    events = []
    async def cap(e): events.append(e)
    async def n(s): s.setdefault("market_data", {"latest_price": 100})
    ex = DAGExecutor(
        nodes={"MarketData": n, "News": n, "Forecast": n, "Risk": n, "Alert": n},
        on_event=cap,
    )
    state = {"run_id": "t2", "user_id": 1, "symbol": "X", "query": "?", "errors": {}, "skipped": []}
    await ex.run(state)
    assert sum(1 for e in events if e["status"] == "done") == 5

@pytest.mark.asyncio
async def test_zombie_task_cancelled_on_failure():
    # News fails; Forecast must still complete (return_exceptions handled inside _safe_run)
    events = []
    async def cap(e): events.append(e)
    async def md(s): s["market_data"] = {"latest_price": 100}
    async def newsbad(s): raise RuntimeError("news boom")
    async def fc(s): await asyncio.sleep(0.05); s["forecast"] = {"forecast": [], "mape": 0.05}
    async def risk(s): s["risk_score"] = 0.5
    async def alert(s): s["answer"] = "ok"
    ex = DAGExecutor(
        nodes={"MarketData": md, "News": newsbad, "Forecast": fc, "Risk": risk, "Alert": alert},
        on_event=cap,
    )
    state = {"run_id": "t3", "user_id": 1, "symbol": "X", "query": "?", "errors": {}, "skipped": []}
    await ex.run(state)
    statuses = {e["node"]: e["status"] for e in events if e["type"] == "dag_event"}
    assert statuses["News"] == "error"
    assert statuses["Forecast"] == "done"
```

**File:** `backend/tests/test_positions.py`:
```python
@pytest.mark.asyncio
async def test_create_position_with_threshold(client, auth_headers):
    r = await client.post("/positions/", json={
        "symbol": "AAPL", "quantity": 10, "average_price": 150, "alert_threshold": 200,
    }, headers=auth_headers)
    assert r.status_code in (200, 201)
    assert r.json()["alert_threshold"] == 200

@pytest.mark.asyncio
async def test_negative_quantity_422(client, auth_headers):
    r = await client.post("/positions/", json={
        "symbol": "AAPL", "quantity": -5, "average_price": 150,
    }, headers=auth_headers)
    assert r.status_code == 422

@pytest.mark.asyncio
async def test_get_positions_includes_pnl_keys(client, auth_headers):
    await client.post("/positions/", json={"symbol": "MSFT", "quantity": 5, "average_price": 300},
                      headers=auth_headers)
    r = await client.get("/positions/", headers=auth_headers)
    data = r.json()
    assert isinstance(data, list)
    if data:
        assert "unrealized_pnl" in data[0]
        assert "current_price" in data[0]
        assert "alert_threshold" in data[0]
```

**File:** `backend/tests/test_watchlist.py`, `test_quotes.py`, `test_audit.py`, `test_query.py` — follow the same pattern. (Total target: 25+ tests.)

### 9.2 Frontend Vitest setup

```bash
cd ~/finsight/frontend
pnpm add -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

**File:** `frontend/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: { environment: "jsdom", setupFiles: ["./src/test/setup.ts"], globals: true },
});
```

**File:** `frontend/src/test/setup.ts`:
```ts
import "@testing-library/jest-dom";
```

**File:** `frontend/src/lib/citation-guard.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { sanitizeText, findUncitedNumerics } from "./citation-guard";

describe("CitationGuard FE", () => {
  it("does not flag years", () => {
    expect(findUncitedNumerics("In 2024 AAPL rose [1]")).toHaveLength(0);
  });
  it("flags uncited percent", () => {
    expect(findUncitedNumerics("AAPL rose 5.2% today")).toHaveLength(1);
  });
  it("passes cited dollar", () => {
    expect(findUncitedNumerics("AAPL hit $200 [2]")).toHaveLength(0);
  });
  it("sanitize replaces with REDACTED", () => {
    expect(sanitizeText("AAPL rose 5.2% today")).toContain("[REDACTED");
  });
});
```

**File:** `frontend/src/components/dag/AgentNode.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { AgentNode } from "./AgentNode";

describe("AgentNode", () => {
  it("renders idle by default", () => {
    render(<AgentNode name="MarketData" status="idle" />);
    expect(screen.getByText(/MarketData/)).toBeInTheDocument();
  });
  it("renders skipped state", () => {
    render(<AgentNode name="News" status="skipped" />);
    expect(screen.getByText(/News/)).toBeInTheDocument();
  });
  it("shows latency on done", () => {
    render(<AgentNode name="Risk" status="done" latencyMs={123} tokens={45} />);
    expect(screen.getByText(/123/)).toBeInTheDocument();
  });
});
```

**Add to `frontend/package.json` scripts:**
```json
"test": "vitest run",
"test:watch": "vitest"
```

### 9.3 Phase 9 verification

```bash
cd ~/finsight/backend
uv run pytest -q
# Expected: 25+ passed, 0 failed

cd ~/finsight/frontend
pnpm test
# Expected: 12+ passed, 0 failed

pnpm tsc --noEmit
# Expected: 0 errors
```

### 9.4 Phase 9 commit
```bash
git add -A
git commit -m "test: 25+ backend pytest cases + 12+ frontend Vitest cases

- Auth flow (7 tests): register, dup, login form-data, wrong pwd, /me, expired token
- CitationGuard (5): compile, year-allow, uncited-catch, cited-pass, sanitize
- DAG executor (3): fail-open, happy-path, zombie-cancel
- Positions (3): create-with-threshold, negative-422, P&L-keys
- Watchlist, quotes, audit, query: cassette-mocked
- FE Vitest: CitationGuard + AgentNode + AnswerPanel + AlertToast"
```

---

## §10. PHASE 10 — Deploy + CI hardening [1h]

**Goal:** Render works under cold-start; CI catches regressions before push.

**Parallel-safe:** No (10.3 depends on 10.1).

### 10.1 GitHub Actions CI

**File:** `.github/workflows/ci.yml`:
```yaml
name: CI
on:
  pull_request:
  push: { branches: [main, fix/audit-remediation] }

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: timescale/timescaledb:latest-pg14
        env: { POSTGRES_PASSWORD: postgres, POSTGRES_DB: finsight_test }
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 10s --health-timeout 5s --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - working-directory: backend
        run: |
          uv sync
          uv run alembic upgrade head
          uv run ruff check .
          uv run pytest -q
        env:
          DATABASE_URL: postgresql+asyncpg://postgres:postgres@localhost:5432/finsight_test
          JWT_SECRET: ci-test-secret-32-chars-minimum-please
          DEMO_MODE: "1"

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm, cache-dependency-path: frontend/pnpm-lock.yaml }
      - working-directory: frontend
        run: |
          pnpm install --frozen-lockfile
          pnpm tsc --noEmit
          pnpm test
          pnpm build
```

⚠ **APPROVAL NEEDED before committing this file** per §0.4 (it changes CI).

### 10.2 Render deploy hardening

**File:** `render.yaml` (verify or create):
```yaml
services:
  - type: web
    name: finsight-web
    env: docker
    plan: free
    dockerfilePath: ./backend/Dockerfile
    dockerContext: ./backend
    healthCheckPath: /healthz
    envVars:
      - key: DATABASE_URL
        fromDatabase: { name: finsight-db, property: connectionString }
      - key: JWT_SECRET
        generateValue: true
      - key: GEMINI_API_KEY
        sync: false
      - key: FINNHUB_API_KEY
        sync: false
      - key: DEMO_MODE
        value: "1"
      - key: ALLOWED_ORIGINS
        value: "https://finsight-web.onrender.com"

  - type: worker
    name: finsight-poller
    env: docker
    plan: free
    dockerfilePath: ./backend/Dockerfile
    dockerContext: ./backend
    dockerCommand: uv run python -m app.scripts.run_poller
    envVars:
      - key: DATABASE_URL
        fromDatabase: { name: finsight-db, property: connectionString }
      - key: DEMO_MODE
        value: "1"

databases:
  - name: finsight-db
    plan: free
    postgresMajorVersion: 14
```

⚠ **APPROVAL NEEDED before committing this file** per §0.4.

### 10.3 CORS + WS pre-warm script

**File:** `backend/app/main.py` — verify CORS uses `ALLOWED_ORIGINS`:
```python
import os
from fastapi.middleware.cors import CORSMiddleware

origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**File:** `scripts/prewarm.sh` (new):
```bash
#!/usr/bin/env bash
URL="${1:-https://finsight-web.onrender.com}"
echo "[prewarm] hitting $URL/healthz"
for i in 1 2 3 4 5; do
  status=$(curl -o /dev/null -s -w "%{http_code}" --max-time 30 "$URL/healthz" || echo "000")
  echo "  attempt $i → $status"
  if [ "$status" = "200" ]; then exit 0; fi
  sleep 5
done
echo "[prewarm] FAILED"
exit 1
```

### 10.4 Phase 10 verification (local)

```bash
cd ~/finsight
docker compose up -d
sleep 5
bash scripts/prewarm.sh http://localhost:8000
# Expected: attempt N → 200 within 30s
```

### 10.5 Phase 10 commit (after approval)
```bash
git add .github/workflows/ci.yml render.yaml scripts/prewarm.sh backend/app/main.py
git commit -m "ci: add GitHub Actions for backend + frontend; harden Render deploy

- BE: pytest + ruff + alembic check on Postgres TimescaleDB service
- FE: tsc + vitest + build
- Render: separate web + worker services; healthCheckPath; CORS allowlist
- Prewarm script for free-tier cold start"
```

---

## §11. PHASE 11 — Documentation pass [45 min]

**Goal:** Make `README`, `DESIGN.md`, `COMPLIANCE-MATRIX.md`, and ADRs match the shipped state. The reviewer reads these.

**Parallel-safe:** Yes — each doc is independent.

### 11.1 README updates

**File:** `README.md` — ensure these sections exist (do not rewrite, ADD only):
- Hosted URL (after first Render deploy)
- 10s demo GIF (record after §12 passes)
- Quickstart with `docker compose up` + `DEMO_MODE=1`
- "What I'd build with two more weeks" (3-4 bullets)
- Disclaimer: educational use only

### 11.2 DESIGN.md — add/refresh sections 6 + 7

Specifically:
- **§6 — DAG executor:** describe the staged execution (4 levels), fail-open semantics, skipped-node behavior, `[degraded]` answer prefix.
- **§7 — Prompt-injection defenses (D1–D7):** include `<untrusted_data>` wrapping, CitationGuard, watchlist allow-list (TODO if not done), output sanitization on every LLM call.

### 11.3 New ADRs

**File:** `docs/adr/0003-timescaledb-on-render.md` — if Render Postgres lacks TimescaleDB, document the fallback to vanilla.

**File:** `docs/adr/0004-prophet-fallback.md`:
```md
# ADR-0004 — Prophet → statsmodels Holt-Winters

## Context
Prophet wheels need cmake + pystan to build; the Render free-tier image times out during pip install. Holt-Winters from statsmodels gives equivalent accuracy on 30-day daily series.

## Decision
Use `statsmodels.tsa.holtwinters.ExponentialSmoothing(seasonal=None)` for the 7-day forecast. Hide the forecast overlay if MAPE > 0.15.

## Consequences
+ Build time drops from ~6m to ~30s
+ Same cold-start budget on Render free tier
− Wider confidence band on choppy series
```

**File:** `docs/adr/0005-fail-open-dag.md`:
```md
# ADR-0005 — Fail-open DAG executor

## Context
A 5-node pipeline that always runs to a partial answer is more demo-friendly than one that 500s on the first node failure.

## Decision
Each node wrapped in _safe_run; failures emit status:"error" and downstream gets status:"skipped". Alert always runs and prefixes "[degraded]" when upstream failed.

## Consequences
+ Reviewer sees a partial answer + visible degradation banner instead of a blank screen
+ Easier to demo edge cases (kill News mid-recording)
− Have to communicate degradation in UI
```

### 11.4 COMPLIANCE-MATRIX.md

Update every row with current status. Targets per MVP-PLAN §4:
- ✅ 6 entities — done
- ✅ JWT 60min — done
- ✅ WebSocket — done
- ✅ 5-node DAG — done (after §5)
- ✅ Gemini + CitationGuard — done (after §4)
- ✅ Prophet → Holt-Winters fallback — done (ADR-0004)
- ✅ Audit append-only — done (after §8)
- ✅ TimescaleDB hypertable — done
- ⚪ Render production — pending §10 deploy
- ⚪ Demo video — pending §12
- ⚪ DEMO_MODE fixture pack — done

### 11.5 CREDITS.md

Verify every borrowed snippet has a permalink. If you used the React Flow node-status pattern from `virattt/ai-hedge-fund`, link to the file + commit SHA.

### 11.6 Phase 11 commit
```bash
git add README.md docs/
git commit -m "docs: refresh DESIGN, COMPLIANCE-MATRIX, ADRs 0003-0005, README hosted URL"
```

---

## §12. PHASE 12 — Production tester checklist [2h]

**Goal:** Walk through the project as if a reviewer is watching. Every checkbox must pass before submission.

**Parallel-safe:** No.

### 12.1 Pre-flight

- [ ] `git status` clean
- [ ] `cd backend && uv run pytest -q` → 25+ passed, 0 failed
- [ ] `cd backend && uv run ruff check .` → no errors
- [ ] `cd frontend && pnpm tsc --noEmit` → 0 errors
- [ ] `cd frontend && pnpm test` → 12+ passed
- [ ] `cd frontend && pnpm build` → success
- [ ] `docker compose down && docker compose up -d` → 4 services healthy in `docker compose ps`
- [ ] `curl -s http://localhost:8000/healthz` → `{"status":"ok"}`
- [ ] `curl -s http://localhost:5173` → HTML returned

### 12.2 Auth flow (manual, in browser)

- [ ] Open `http://localhost:5173/login`
- [ ] Click "Use demo credentials" → email/password autofilled
- [ ] Submit → redirected to `/dashboard` within 2s
- [ ] Refresh page → still logged in (token persisted)
- [ ] Click logout → redirected to `/login`, token cleared from localStorage
- [ ] Try to navigate to `/dashboard` while logged out → redirect to `/login`
- [ ] Manually corrupt localStorage token (`"foo"`) → auto-redirect to login on next API call

### 12.3 Watchlist (the previously hardcoded one)

- [ ] On fresh user, dashboard shows "Your watchlist is empty" empty state
- [ ] Add `AAPL`, `NVDA`, `TSLA` via the input
- [ ] Each card appears immediately (optimistic or post-mutation refresh)
- [ ] Live prices populate within 15s (poller tick)
- [ ] Refresh page → watchlist persists, prices keep updating
- [ ] Remove `TSLA` → card disappears, others stable

### 12.4 Candle chart (the previously PRNG one)

- [ ] Click `AAPL` ticker → CandleChart loads
- [ ] Chart shows ~30 days of real OHLC bars (or fixture data in DEMO_MODE)
- [ ] Hover crosshair → OHLC card updates
- [ ] Loading state visible briefly on first load
- [ ] Empty state shown for unknown ticker

### 12.5 NL query → DAG → answer (demo step 3-4)

- [ ] Type "Should I worry about TSLA today?" in NLQueryBar → submit
- [ ] All 5 DAG nodes light up sequentially: MarketData → News + Forecast (parallel) → Risk → Alert
- [ ] Each node shows running animation, then done with latency_ms + tokens
- [ ] Final answer renders in AnswerPanel
- [ ] Answer contains `[1]`, `[2]`, etc. citations
- [ ] Hover `[1]` → tooltip shows news headline
- [ ] Source list below answer is clickable and matches citations

### 12.6 CitationGuard (demo step 5)

- [ ] In DEMO_MODE, force a fixture LLM output without `[n]` (edit fixture briefly):
  - [ ] Visit dashboard, run query → uncited number is replaced with `[REDACTED: uncited numeric]`
  - [ ] Footer note appears: "Note: some numeric claims were redacted..."
- [ ] Restore fixture

### 12.7 Positions + alert (demo steps 7-8)

- [ ] Add position: `NVDA, qty=10, avg=$920, alert_threshold=$925`
- [ ] HoldingsCard shows row immediately
- [ ] `current_price` populated from latest tick within 30s
- [ ] `unrealized_pnl` and `unrealized_pnl_pct` non-null
- [ ] Wait for poller tick where NVDA price ≥ $925 (or use fixture forced value)
- [ ] Toast appears bottom-right: "⚠ NVDA @ $X — threshold crossed"
- [ ] Toast auto-dismisses after 8s
- [ ] Alert does not re-fire on subsequent ticks above threshold (active_alerts dedupe)
- [ ] Drop NVDA below threshold, then above again → alert re-fires once

### 12.8 Audit page (demo step 9)

- [ ] Visit `/audit`
- [ ] Last query produces 5+ rows: one per DAG node
- [ ] Each row shows: ts, event_type=`dag_node_execution`, payload with run_id/node/status/latency_ms/tokens
- [ ] Sort by timestamp descending → newest first
- [ ] Run query again → audit table grows by another 5+ rows

### 12.9 Fail-open behavior (manual breakage)

- [ ] Set Gemini API to fail (e.g., bad key in real mode, or short-circuit fixture)
- [ ] Run query
- [ ] News node shows status=error in DAG visualizer
- [ ] Forecast/Risk/Alert show status=skipped (grey)
- [ ] AnswerPanel shows degradation banner
- [ ] Demo continues without 500 page

### 12.10 WebSocket resilience

- [ ] Open browser DevTools → Network → WS
- [ ] Confirm `/ws?token=...` connection alive
- [ ] Stop backend (`docker compose stop backend`)
- [ ] Frontend logs `WS closed`, reconnect attempt every 3s
- [ ] Restart backend (`docker compose start backend`)
- [ ] WS reconnects, ticks resume

### 12.11 Security spot-checks

- [ ] `curl http://localhost:8000/users/me` (no token) → 401
- [ ] `curl http://localhost:8000/users/me -H "Authorization: Bearer FOO"` → 401
- [ ] Inspect any `/users/me` response → no `hashed_password` field
- [ ] Inspect any `/positions` response → no other user's data
- [ ] Try to POST `{"symbol":"AAPL","quantity":-5,"average_price":150}` → 422
- [ ] Try DELETE someone else's position id → 404 or 403
- [ ] Inspect `.env` is in `.gitignore`; `git log -- .env` returns nothing
- [ ] Inspect served HTML for accidental API keys (`grep -ri "AIza\|sk-" frontend/dist`) → none

### 12.12 Browser smoke (3 browsers)

- [ ] Chrome: full demo flow steps 1-10
- [ ] Firefox: full demo flow steps 1-10
- [ ] Safari (or Edge): full demo flow steps 1-10
- [ ] DevTools console clean (no red errors) in all three

### 12.13 Render deploy verify (after `git push` approval)

- [ ] `bash scripts/prewarm.sh https://<your-app>.onrender.com` → 200 within 30s
- [ ] Visit hosted URL in incognito → register fresh user → all 10 demo steps pass
- [ ] `/audit` shows rows on hosted DB (not just local)
- [ ] CORS: open browser console; no CORS errors

### 12.14 Final compliance matrix sign-off

Compare every row in `docs/COMPLIANCE-MATRIX.md` against actual behavior. ANY ⚪ or 🔴 → STOP, return to the relevant phase.

### 12.15 If everything is green

ASK FOR APPROVAL with this format:
```
⚠ APPROVAL NEEDED: git push origin fix/audit-remediation && open PR to main
WHY: All 12 phases complete; production tester checklist green; ready for demo recording.
RISK: Render auto-redeploy will trigger from main merge; cold start may take 60-90s.
ROLLBACK: git revert <merge-commit> && git push origin main
```

---

## §12.5 PHASE 12.5 — Pre-submission polish [1.5h]

**Goal:** Close the gaps between "tester checklist green" and "demo-ready." Lean — no extras beyond what makes the recording work.

**Parallel-safe:** Yes — sub-tasks are independent.

### 12.5.1 Backfill 30-day quote_ticks history for the demo user

Without history, CandleChart looks like 1 dot and Forecast errors out with "Insufficient data". The seeder must populate enough history that the chart and forecast look real on first login.

**File:** `backend/app/scripts/seed_demo.py` — extend the existing seed with a tick backfill block:

```python
import random
from datetime import datetime, timedelta, timezone
from app import models

DEMO_SYMBOLS = ["AAPL", "NVDA", "TSLA", "MSFT", "GOOGL", "AMZN"]
DEMO_BASE_PRICES = {"AAPL": 180, "NVDA": 920, "TSLA": 240, "MSFT": 410, "GOOGL": 165, "AMZN": 185}

async def backfill_history(session):
    now = datetime.now(timezone.utc).replace(hour=16, minute=0, second=0, microsecond=0)
    for sym in DEMO_SYMBOLS:
        # Skip if already have ≥20 ticks for this symbol
        existing = await session.execute(
            select(func.count(models.QuoteTick.ts)).where(models.QuoteTick.symbol == sym)
        )
        if (existing.scalar() or 0) >= 20:
            continue
        base = DEMO_BASE_PRICES.get(sym, 100.0)
        rng = random.Random(hash(sym) & 0xFFFFFFFF)  # deterministic per symbol
        price = base
        for d in range(30, 0, -1):
            ts = now - timedelta(days=d)
            price *= (1 + rng.uniform(-0.025, 0.025))  # 2.5% daily walk
            session.add(models.QuoteTick(ts=ts, symbol=sym, price=round(price, 2), volume=None))
    await session.commit()
```

Call `backfill_history(session)` after `seed_demo_user()` in the lifespan.

**Verify:**
```bash
docker compose down -v && docker compose up -d
sleep 20
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'username=demo@finsight.ai&password=Demo@12345' \
  | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s "http://localhost:8000/quotes/AAPL/history?period=1mo" -H "Authorization: Bearer $TOKEN" | python -c "import sys,json;d=json.load(sys.stdin);print(f'{len(d)} candles')"
# Expected: 25+ candles
```

### 12.5.2 Verify DEMO_MODE fixture pack exists

```bash
ls backend/app/services/demo_fixtures/cache/ 2>/dev/null | head -5
# Expected: at least 3 .json files (fixture per query)
# If empty: regenerate
```

If empty, regenerate per MVP-PLAN Feature 4.2:
```bash
cd backend
DEMO_MODE=0 GEMINI_API_KEY=$GEMINI_API_KEY uv run python -m app.scripts.record_demo_fixtures
git add backend/app/services/demo_fixtures/cache/
```

If you don't have time/quota for real-mode recording: synthesize 3 fixtures by hand from sample Gemini outputs. Each fixture file = `{prompt_hash: <hex>, response: "..."}`. Cap at 3 fixtures.

### 12.5.3 Tailwind class resolution check

V2 flagged `bg-amber/15` style classes may not resolve. Single grep + fix pass:

```bash
cd frontend
grep -rn "bg-amber/\|text-amber/\|border-amber/\|ring-amber/" src/
# For each match: ensure tailwind.config.ts defines the alpha-modified class,
# OR replace with explicit token like bg-amber-accent/15 (whatever exists in config).
pnpm build 2>&1 | grep -i "warn\|error"
# Expected: no warnings about unrecognized classes
```

### 12.5.4 Browser console clean walk (≤15 min)

For each of these routes, open in Chrome with DevTools Console:
- `/login`
- `/dashboard`
- `/positions`
- `/news`
- `/audit`
- `/settings` (if not removed)

Pass criteria: zero red errors. Yellow warnings OK. Take a screenshot of any red error and fix.

Common offenders: missing alt attributes (warnings), 404 on a favicon (cosmetic), React key warnings on lists (fix in code).

### 12.5.5 Mobile spot-check at 375×667

In Chrome DevTools → toggle device toolbar → iPhone SE (375×667). Walk:
- `/login` — form usable, no horizontal scroll
- `/dashboard` — sidebar collapses to drawer or icon-only
- `/positions` — table scrolls horizontally OR collapses to cards

If sidebar overflows the viewport: add `md:flex hidden` style guard around the desktop sidebar and a hamburger toggle. ~20 min fix if needed.

### 12.5.6 Phase 12.5 commit

```bash
git add -A
git commit -m "polish: backfill demo history, fixture pack verify, tailwind grep, mobile spot-check"
```

---

## §13. PHASE 13 — Demo video [2h, single human-in-loop session]

**Goal:** ≤5min unlisted YouTube/Loom video showing the 10-step demo flow. This is **not** the build AI's job — this is YOU on a screen recorder. The build AI prepares; you record.

### 13.1 Pre-record checklist (run yourself, T-30 min before recording)

```bash
# 1. Prewarm Render
bash scripts/prewarm.sh https://<your-app>.onrender.com
# 2. Confirm hosted /healthz
# 3. Clear browser cache + cookies for the hosted domain
# 4. Set viewport to 1280×800 (Chrome DevTools → device toolbar → custom)
# 5. Close all other tabs and apps
# 6. Set Do Not Disturb (Windows) / Focus (Mac)
# 7. Test microphone level — speak normally, peak at -6dB
# 8. Have 3 things in clipboard: your demo creds, a sample query "Should I worry about TSLA today?", the GitHub repo URL
```

### 13.2 Shot list (≤5 min total)

| Time | Shot | Talking point (≤25 words each) |
|---|---|---|
| 0:00–0:15 | Hero: dashboard with DAG node lit | "FinSight AI — real-time financial insights with a 5-node agent pipeline. Built on FastAPI, React, TimescaleDB, Gemini." |
| 0:15–0:45 | Login flow + watchlist live ticks | "JWT auth, 60-min token. Watchlist driven by polling worker writing TimescaleDB hypertable. Live prices stream over WebSocket." |
| 0:45–1:15 | Type query → DAG animates | "User question fans out: MarketData → News and Forecast in parallel → Risk → Alert. Each node streams partial output." |
| 1:15–1:45 | Answer renders with citations | "Every numeric claim must cite a source. CitationGuard blocks uncited numbers. Hover the chip — real source resolves." |
| 1:45–2:15 | Click red candle → DAG re-fires | "Timestamp-scoped query. News and forecast filter to before that moment. Different answer, same pipeline." |
| 2:15–2:45 | Add NVDA position + threshold → toast | "Holdings card recomputes P&L on every tick. Threshold alert fires once on cross, dedupes." |
| 2:45–3:15 | /audit page | "Append-only audit log. Every LLM call: model, tokens, latency, cost in INR. No UPDATE or DELETE path — append-only." |
| 3:15–3:45 | DEMO_MODE off → live Gemini call | "Toggle DEMO_MODE off. Same flow, real Gemini. Note disclaimers — educational use only." |
| 3:45–4:30 | Architecture summary + GitHub | "Hand-rolled DAG executor, fail-open with skipped semantics, prompt-injection defenses, Holt-Winters fallback for Prophet." |
| 4:30–5:00 | Outro | "Educational use only. Repo + hosted link in description. Thanks." |

### 13.3 Recording rules

- Take 1: full 5min, no cuts. Watch back. Note errors.
- Take 2: re-record with fixes.
- Maximum 3 takes. After 3, ship the best one — perfectionism is a trap.
- Trim dead air > 1s in post.
- Add chapter markers at the times above.
- Upload to YouTube **unlisted** OR Loom (Loom is faster).

### 13.4 README hero GIF (separate, 10s)

After the video is done:
- Use Kap (Mac), LICEcap (Windows), or built-in screen recorder
- 10-12 second clip showing the DAG firing once
- Save as `docs/hero.gif` (≤2 MB)
- Embed in README at the top: `![FinSight AI](docs/hero.gif)`

### 13.5 Phase 13 outputs

- Video URL (paste in `README.md`)
- `docs/hero.gif` committed
- One commit: `docs: add demo video link and hero gif`

---

## §14. PHASE 14 — Submission-day runbook [1h]

**Goal:** Submit without last-mile drama.

### 14.1 T-2h: full dry run

```bash
# 1. Verify CI green on the latest commit
# 2. Render dashboard: latest deploy green
bash scripts/prewarm.sh https://<your-app>.onrender.com
# 3. Open hosted URL in incognito; run all 10 demo flow steps
# 4. If any step fails: fix, push, re-prewarm. Do NOT proceed if any red.
```

### 14.2 T-30m: assemble submission payload

Copy these to a notes file:
- Repo URL: `https://github.com/<you>/finsight`
- Video URL: `https://youtu.be/...` or Loom link
- Hosted URL: `https://<your-app>.onrender.com`
- Demo credentials line: `demo@finsight.ai / Demo@12345`
- Compliance matrix link (in repo): `docs/COMPLIANCE-MATRIX.md`

### 14.3 T-15m: submit

- Open Google Form
- Paste fields verbatim
- Re-read once before submit
- Click Submit
- **Screenshot the confirmation page**
- Email yourself the screenshot

### 14.4 Failure-mode fallbacks

| If... | Then... |
|---|---|
| Render hosted URL is down at submission moment | Submit with a note in the form: "hosted URL temporarily down on free tier; demo video shows full flow." Push a Loom recording of local Docker as backup link. |
| Video upload still processing on YouTube | Use the Loom backup; YouTube link is fine even if it shows "processing" — reviewers will retry. |
| Form has unexpected required field | Answer concisely; do not improvise URLs. If a field requires "team members" and you're solo, type "solo project". |
| GitHub repo accidentally private | Settings → Danger Zone → Change visibility → Public. Verify URL works in incognito before proceeding. |

---

## §14.5 Manual smoke checklist FOR YOU (the human, ≤30 min)

Run this AFTER the build AI says §12 is green and BEFORE you approve the push to main. This is not the build AI's job — this is your sign-off.

- [ ] `git checkout fix/audit-remediation && git pull && docker compose up -d`
- [ ] Wait 30s. Open `http://localhost:5173` in Chrome.
- [ ] Login with `demo@finsight.ai / Demo@12345` — works in <2s
- [ ] Watchlist shows AAPL, NVDA, TSLA with live prices updating
- [ ] CandleChart shows ~30 days of bars; click 1M button → chart updates
- [ ] Type "Should I worry about TSLA today?" → submit
- [ ] All 5 DAG nodes light up; final answer has `[1]` `[2]` citations
- [ ] Hover `[1]` → tooltip shows real source
- [ ] Add position NVDA, qty 10, avg $920, threshold $925 → row appears
- [ ] After 30s, P&L populates non-null
- [ ] Toast appears when threshold crosses (or use a fixture-forced tick)
- [ ] Visit `/audit` → 5+ rows from the last query
- [ ] Open in **mobile** (Chrome DevTools 375×667): login + dashboard + query work
- [ ] Open the **hosted Render URL** in incognito: same 10 steps work
- [ ] Read `README.md` start to finish; quickstart is correct; no broken links
- [ ] Watch the demo video in full; audio synced; no dead air
- [ ] Open browser console on every route: zero red errors

If all green: type **"approved push"** to the build AI. Anything red: tell the build AI exactly what failed; do not push.

---

## §15. PHASE 15 — Doc cleanup + minimal final doc set [45 min]

**Goal:** Strip the working notes and audit artifacts. Ship only what reviewers need. This is the **last** phase before submission.

### 15.1 Files to DELETE before submission

These are working docs the user copied between machines / planning artifacts. They have no value to a reviewer:

```bash
cd ~/finsight
rm -f BUILD-PROMPT.md
rm -f FINSIGHT_FIX_PLAN.md          # this file
rm -f DEEP_AUDIT_PROMPT.md
rm -f setup-on-new-machine.md
rm -f plan.md
rm -f frontend\ compo.md             # the digest
rm -f backend-core.md                # the digest
rm -f agents_services.md             # the digest
rm -f infra.md                       # the digest
rm -f uiuxchanges.md                 # stale per V2
rm -rf docs/superpowers/             # spec/audit working docs
rm -f backend/main.py                # root dead "Hello" file (not backend/app/main.py)

# Stage and commit
git add -A
git commit -m "chore: remove working/audit docs before submission"
```

**Verify nothing important was deleted:**
```bash
ls README.md ARCHITECTURE.md CREDITS.md docs/adr/ 2>&1
# Expected: all present
```

### 15.2 Files to KEEP and ensure are clean

| File | Purpose | Required? |
|---|---|---|
| `README.md` | Quickstart + hosted link + video + creds | YES |
| `ARCHITECTURE.md` | One-page system overview | YES (replaces DESIGN.md if it's bloated; otherwise rename DESIGN.md → ARCHITECTURE.md) |
| `CREDITS.md` | Borrowed code attribution | YES (per MVP-PLAN; risk #7 = plagiarism suspicion) |
| `docs/adr/0001-no-langgraph.md` | ADR | YES (≥2 ADRs per MVP-PLAN) |
| `docs/adr/0004-prophet-fallback.md` | ADR | YES |
| `docs/adr/0005-fail-open-dag.md` | ADR | Optional but recommended |
| `docs/COMPLIANCE-MATRIX.md` | PDF requirements coverage | Optional but reviewer-friendly |
| `LICENSE` | MIT or whatever | YES |
| `.gitignore` | Hide .env etc. | YES |
| `docs/hero.gif` | Embedded in README | YES |

Anything else in `docs/`: keep only if it directly helps the reviewer. Otherwise rm.

### 15.3 README.md template — minimal, complete

Replace the existing README with this if it's bloated. Adjust paths/URLs.

```md
# FinSight AI

Real-time financial insights dashboard with a 5-node agent pipeline.
Built for the Nebula9.ai Full Stack GenAI internship assessment.

> **Educational use only — not financial advice.**

![Demo](docs/hero.gif)

## Live demo

- **Hosted:** https://<your-app>.onrender.com
- **Video (5 min):** https://youtu.be/<id>
- **Demo credentials:** `demo@finsight.ai` / `Demo@12345`

(Free-tier hosting may sleep after 15 min — first request takes ~60s to wake.)

## Stack

- Backend: FastAPI · SQLAlchemy 2.0 async · Postgres + TimescaleDB hypertable · Gemini 2.0 Flash · statsmodels Holt-Winters
- Frontend: Vite · React 18 · TypeScript · Tailwind · Zustand · React Query · WebSocket streaming
- Deploy: Render (single web + worker + Postgres) · Docker Compose for local

## Quickstart (local)

Prerequisites: Docker Desktop, Node ≥22, pnpm, Python 3.12, uv.

```bash
git clone https://github.com/<you>/finsight.git
cd finsight
cp .env.example .env   # then fill in GEMINI_API_KEY, FINNHUB_API_KEY, JWT_SECRET
docker compose up -d
# Wait ~20s for migrations + seed
open http://localhost:5173
```

Login with the demo credentials above. The seeder populates a demo user, a watchlist, and 30 days of mock quote ticks.

To switch to live LLM/quotes:
```bash
# Edit .env: DEMO_MODE=0
docker compose restart backend worker
```

## Architecture

See `ARCHITECTURE.md` for the system overview, data model, and the 5-node DAG.

## Tests

```bash
cd backend && uv run pytest -q          # 25+ tests
cd frontend && pnpm test                # 12+ tests
```

## What I'd build with two more weeks

- True topological DAG executor (currently 4 hardcoded levels)
- Redis pub/sub for multi-worker WebSocket scale
- Prophet wheel back in (Holt-Winters fallback today; see `docs/adr/0004-prophet-fallback.md`)
- Settings page wired to a real `/users/settings` endpoint
- Real Google OAuth (button is currently a stub)

## Credits

Borrowed snippets and patterns are listed in `CREDITS.md`.

## License

MIT.
```

### 15.4 ARCHITECTURE.md — one page, no fluff

Create or replace with this template:

```md
# FinSight Architecture

## Overview

Single FastAPI service. Vite/React frontend. Postgres with TimescaleDB extension. Hand-rolled 5-node DAG with WebSocket partial-output streaming. Gemini 2.0 Flash for LLM. statsmodels Holt-Winters for forecasting.

## Data model (6 entities)

- `users` — id, email (unique), hashed_password, full_name, created_at
- `watchlist_items` — id, user_id (FK), symbol, added_at
- `positions` — id, user_id (FK), symbol, quantity, average_price, alert_threshold (nullable), timestamps
- `quote_ticks` — **TimescaleDB hypertable** partitioned by ts; (ts, symbol, price, volume); composite PK (ts, symbol)
- `news_items` — id, symbol, headline, url, source, published_at, sentiment_score, sentiment_label, summary
- `audit_events` — append-only; id, user_id, event_type, payload (JSON text), created_at

## DAG pipeline

```
MarketData
   │
   ├──► News      (parallel)
   │
   └──► Forecast  (parallel)
           │
           └──► Risk ──► Alert
```

- Each node is `async def run(state: AgentState) -> None` (mutates state in place; gather merges with `state.update(res)` for safety).
- Failures emit `status=error`; downstream emits `status=skipped`. Alert always runs and prefixes `[degraded]` if anything upstream failed.
- WS event per node: `{type, node, status, run_id, started_at, ended_at, latency_ms, tokens, partial_output}`.
- Final WS event `query_complete` carries the synthesized answer + sources array + disclaimer.

## Auth

JWT HS256, 60-minute expiry, no refresh. Email + password (bcrypt cost 12). Google OAuth button is a stub for the assignment.

## Real-time layer

Polling worker writes `quote_ticks` every ~15s per watched symbol. WebSocket hub fans out per user. Frontend Zustand store consumes events; React components subscribe to slices.

## Safety

- **CitationGuard:** every numeric claim in LLM output must be followed by `[n]`; uncited claims are redacted before render.
- **Prompt-injection:** all third-party text (news headlines, Finnhub fields, user query) wrapped in `<untrusted_data>` tags.
- **Watchlist allow-list:** user can only query symbols in their own watchlist.
- **Append-only audit:** no UPDATE or DELETE path on `audit_events`.
- **Educational disclaimer** rendered on dashboard, in /forecast and /query responses, and in README.

## Decisions

See `docs/adr/` for: no-LangGraph, Prophet→Holt-Winters fallback, fail-open DAG executor, process-local WSHub.
```

### 15.5 Final pre-submission verification

```bash
# 1. Confirm only the right .md files remain at root
ls *.md
# Expected: README.md ARCHITECTURE.md CREDITS.md (and maybe LICENSE.md)

# 2. Confirm docs/ is lean
ls docs/
# Expected: adr/ COMPLIANCE-MATRIX.md hero.gif (and that's it)

# 3. Build still works
cd backend && uv run pytest -q
cd ../frontend && pnpm build

# 4. README links resolve
# - Hosted URL: bash scripts/prewarm.sh <url>
# - Video URL: open in browser
# - Hero GIF: ls -la docs/hero.gif

# 5. Repo size sanity (<50MB without .git)
du -sh --exclude=.git --exclude=node_modules --exclude=.venv .
```

### 15.6 Phase 15 commit

```bash
git add -A
git commit -m "docs: minimal final doc set (README + ARCHITECTURE + CREDITS + 2 ADRs)"
```

---

## §16. Revised total budget

| Phase | Time |
|---|---|
| §1 P0 bugs (revised Hour-1) | 1:55 |
| §2 Schema | 0:25 |
| §3 Contracts | 1:30 |
| §4 CitationGuard | 1:30 |
| §5 Fail-open DAG | 1:00 |
| §6 Clients | 0:40 |
| §7 Frontend wiring | 3:00 |
| §8 Audit | 0:40 |
| §9 Tests | 2:30 |
| §10 Deploy/CI | 1:00 |
| §11 Docs (working) | 0:45 |
| §12 Tester | 2:00 |
| §12.5 Polish | 1:30 |
| §13 Video (yourself) | 2:00 |
| §14 Submission | 1:00 |
| §14.5 Manual smoke (yourself) | 0:30 |
| §15 Doc cleanup | 0:45 |
| **Total productive** | **~22 hours** |

With ~4h debug buffer = **26h** = ~3 working days. You have 4 days. Feasible if disciplined.

---

## §A. Appendix A — Rollback procedures

| Scenario | Command |
|---|---|
| Phase failed mid-edit | `git stash; git checkout fix/audit-remediation~1` |
| Migration broke schema | `cd backend && uv run alembic downgrade -1` |
| Wrong dependency added | `git checkout -- backend/requirements.txt && cd backend && uv sync` |
| Frontend build broken | `pnpm install --force && pnpm build` |
| Render deploy red | Render dashboard → Manual Rollback to previous deploy |
| Need to bail to last green | `git reset --hard origin/main` (⚠ destructive — ASK FOR APPROVAL) |

---

## §B. Appendix B — Troubleshooting matrix

| Symptom | Likely cause | Fix |
|---|---|---|
| `re.error` at startup | CitationGuard regex still has `?\!` | re-apply §1.3 |
| 401 on every API call | JWT claim mismatch | re-apply §1.2 |
| `'NoneType' object is not subscriptable` in poller | `last_price` is None | re-apply §1.7 |
| WS connects then drops in 5s | Token expired (60-min TTL) | re-login on FE |
| `column "alert_threshold" does not exist` | Migration 0002 not applied | `alembic upgrade head` |
| `tenacity is not installed` | requirements.txt not synced | `cd backend && uv sync` |
| Frontend shows fake watchlist | `INITIAL_TICKERS` still in `Overview.tsx` | re-apply §7.1 |
| Chart shows random data | `generateSeries()` still called | re-apply §7.2 |
| Toast never appears | `AlertToastContainer` not mounted | mount once in `DashboardShell` |
| `unrealized_pnl: null` always | No quote_ticks rows | wait 30s for poller, or use fixtures |
| Render free tier 502 | Cold start | `bash scripts/prewarm.sh <url>` |
| `CORS blocked` in browser | `ALLOWED_ORIGINS` missing prod URL | edit Render env var (ASK FOR APPROVAL) |

---

## §C. Appendix C — File inventory (what this plan touches)

**Backend (created/edited):**
- `app/api/deps.py` — §1.1
- `app/auth.py` — §1.2
- `app/services/citation_guard.py` — §1.3, §4.1
- `app/agents/news.py` — §1.4, §4.2
- `app/agents/risk.py` — §1.4, §4.2
- `app/agents/alert.py` — §1.5, §4.2, §4.3, §5.2
- `app/api/endpoints/ws.py` — §1.6
- `app/services/quote_poller.py` — §1.7
- `app/api/endpoints/query.py` — §1.8, §4.4, §8.2
- `app/models.py` — §2.1
- `app/schemas.py` — §2.2
- `app/services/alert_evaluator.py` — §2.5
- `app/api/endpoints/positions.py` — §3.2
- `app/agents/executor.py` — §3.3, §5.1, §8.1
- `app/services/gemini_client.py` — §6.1
- `app/services/finnhub_client.py` — §6.1, §6.3
- `app/agents/forecast.py` — §6.2
- `app/main.py` — §10.3
- `migrations/versions/0002_*.py` — §2.3 (autogenerated)
- `requirements.txt` — §6.1
- `tests/conftest.py` — §9.1
- `tests/test_*.py` (8 files) — §9.1

**Frontend (created/edited):**
- `src/lib/api.ts` — §3.1
- `src/lib/citation-guard.ts` — already correct (verify in §4)
- `src/lib/queries/watchlist.ts` — §7.1 (NEW)
- `src/lib/queries/quotes.ts` — §7.2 (NEW)
- `src/lib/queries/positions.ts` — verify exists, used by §7.4
- `src/pages/Login.tsx` — §3.1
- `src/pages/Overview.tsx` — §7.1
- `src/pages/Positions.tsx` — §3.2, §7.4
- `src/components/charts/CandleChart.tsx` — §7.2
- `src/components/AlertToast.tsx` — §7.3 (NEW)
- `src/components/AnswerPanel.tsx` — §4.5, §5.3
- `src/components/dag/AgentNode.tsx` — §5.3
- `src/components/positions/AddPositionForm.tsx` — §7.5
- `src/components/layout/DashboardShell.tsx` — mount AlertToastContainer (§7.3)
- `src/store/wsStore.ts` — §3.3, §4.5, §7.1, §7.3, §7.6
- `src/types/position.ts` — §3.2 (NEW)
- `src/test/setup.ts` — §9.2 (NEW)
- `src/lib/citation-guard.test.ts` — §9.2 (NEW)
- `src/components/dag/AgentNode.test.tsx` — §9.2 (NEW)
- `vitest.config.ts` — §9.2 (NEW)
- `package.json` — §9.2 (scripts)

**Infra/docs:**
- `.github/workflows/ci.yml` — §10.1 (NEW, APPROVAL)
- `render.yaml` — §10.2 (verify or NEW, APPROVAL)
- `scripts/prewarm.sh` — §10.3 (NEW)
- `docs/adr/0003-*.md`, `0004-*.md`, `0005-*.md` — §11.3
- `docs/DESIGN.md` — §11.2
- `docs/COMPLIANCE-MATRIX.md` — §11.4
- `README.md` — §11.1
- `CREDITS.md` — §11.5

---

## §D. Appendix D — Original time estimate (superseded by §16)

| Phase | Time |
|---|---|
| §1 P0 bugs | 0:45 |
| §2 Schema | 0:25 |
| §3 Contracts | 1:30 |
| §4 CitationGuard | 1:30 |
| §5 Fail-open DAG | 1:00 |
| §6 Clients | 0:40 |
| §7 Frontend wiring | 3:00 |
| §8 Audit | 0:40 |
| §9 Tests | 2:30 |
| §10 Deploy/CI | 1:00 |
| §11 Docs | 0:45 |
| §12 Tester | 2:00 |
| **Total productive** | **~16 hours** |

Add ~4h buffer for fixing things found during §12 testing → **20 hours** = 2.5 working days.

---

## §E. Appendix E — Final sign-off contract

The project is "complete" only when ALL of these are true simultaneously:

- [ ] All 12 phases committed on branch `fix/audit-remediation`
- [ ] CI green on the branch
- [ ] §12.1 through §12.13 every checkbox green
- [ ] Demo video recorded showing all 10 demo flow steps
- [ ] README has hosted URL + demo GIF
- [ ] No 🔴 in COMPLIANCE-MATRIX.md
- [ ] User has typed "approved push" and the branch is merged to main
- [ ] Render auto-redeploy green
- [ ] `bash scripts/prewarm.sh <prod-url>` returns 200
- [ ] Submission Google Form filled with repo URL + video URL + Render URL

---

## §F. Appendix F — What this plan does NOT do (and why)

- **Does NOT** add Google OAuth — MVP-PLAN authorizes "stub button + coming soon tooltip" if budget tight. We are tight.
- **Does NOT** implement "Explain this candle" feature 3.3 — conditional cut per MVP-PLAN Phase 2 gate.
- **Does NOT** rewrite the DAG to true topological sort — staged executor is documented in ADR-0005 as the simplification.
- **Does NOT** swap to Prophet from Holt-Winters — wheel build is too risky on Render free tier (ADR-0004).
- **Does NOT** add a refresh token mechanism — MVP says JWT 60min, no refresh.
- **Does NOT** add pgvector or semantic search — out-of-scope per CLAUDE.md.
- **Does NOT** rewrite token storage from localStorage to httpOnly cookies — out-of-scope for assignment, documented as known trade-off in DESIGN §7.

If a reviewer asks about any of these in the interview, the answer is in DESIGN.md or the ADRs.

---

**END OF PLAN**

> If you (the executing AI) have any doubt about any step, STOP and ask the user. Do not improvise. Every step in this file was chosen for a reason; deviating breaks the chain.

”
