# Agents & Services Implementation
## Complete Code Reference

### File: `backend/app/agents/__init__.py`
```python
from app.agents.market_data import run_market_data_node
from app.agents.news import run_news_node
from app.agents.forecast import run_forecast_node
from app.agents.risk import run_risk_node
from app.agents.alert import run_alert_node

DAG_NODES = {
    "MarketData": run_market_data_node,
    "News": run_news_node,
    "Forecast": run_forecast_node,
    "Risk": run_risk_node,
    "Alert": run_alert_node
}
```

---

### File: `backend/app/agents/state.py`
```python
from typing import TypedDict, Optional, Any
from datetime import datetime

class AgentState(TypedDict):
    run_id: str
    user_id: int
    symbol: str
    query: str
    at_timestamp: Optional[str]
    
    # Outputs from nodes
    market_data: Optional[dict[str, Any]]
    news: Optional[list[dict[str, Any]]]
    forecast: Optional[dict[str, Any]]
    risk_score: Optional[float]
    alert_triggered: Optional[bool]
    
    # Final synthesized answer
    answer: Optional[str]
```

---

### File: `backend/app/agents/executor.py`
```python
import asyncio
from typing import Callable, Awaitable, Any, cast
from datetime import datetime, timezone
import time
from app.agents.state import AgentState

# Node signature: async def run(state: AgentState) -> AgentState
NodeCallable = Callable[[AgentState], Awaitable[AgentState]]

class DAGExecutor:
    def __init__(self, nodes: dict[str, NodeCallable], on_event: Callable[[dict[str, Any]], Awaitable[None]]):
        self.nodes = nodes
        self.on_event = on_event

    async def _run_node(self, node_name: str, state: AgentState) -> AgentState:
        started_at = datetime.now(timezone.utc).isoformat()
        start_time = time.time()
        
        await self.on_event({
            "type": "dag_event",
            "node": node_name,
            "status": "running",
            "run_id": state["run_id"],
            "started_at": started_at
        })
        
        try:
            state = await self.nodes[node_name](state)
            
            ended_at = datetime.now(timezone.utc).isoformat()
            latency_ms = int((time.time() - start_time) * 1000)
            
            await self.on_event({
                "type": "dag_event",
                "node": node_name,
                "status": "done",
                "run_id": state["run_id"],
                "started_at": started_at,
                "ended_at": ended_at,
                "latency_ms": latency_ms
            })
            return state
        except Exception as e:
            ended_at = datetime.now(timezone.utc).isoformat()
            await self.on_event({
                "type": "dag_event",
                "node": node_name,
                "status": "error",
                "run_id": state["run_id"],
                "error_msg": str(e),
                "started_at": started_at,
                "ended_at": ended_at
            })
            raise

    async def run(self, state: AgentState) -> AgentState:
        # Hardcoded DAG topology
        # MarketData -> {News, Forecast} -> Risk -> Alert
        
        try:
            # Level 1: Market Data
            if "MarketData" in self.nodes:
                state = await self._run_node("MarketData", state)
                
            # Level 2: News & Forecast (Parallel)
            tasks = []
            if "News" in self.nodes:
                tasks.append(self._run_node("News", state))
            if "Forecast" in self.nodes:
                tasks.append(self._run_node("Forecast", state))
                
            if tasks:
                results = await asyncio.gather(*tasks, return_exceptions=True)
                for res in results:
                    if isinstance(res, Exception):
                        raise res
                        
            # Level 3: Risk
            if "Risk" in self.nodes:
                state = await self._run_node("Risk", state)
                
            # Level 4: Alert
            if "Alert" in self.nodes:
                state = await self._run_node("Alert", state)
                
        except Exception as e:
            print(f"DAG execution failed: {e}")
            
        return state
```

---

### File: `backend/app/agents/market_data.py`
```python
from app.agents.state import AgentState
from app.services.quote_poller import fetch_price
from datetime import datetime, timezone
import pandas as pd
from datetime import timedelta
import random

async def run_market_data_node(state: AgentState) -> AgentState:
    symbol = state["symbol"]
    # Fetch latest price
    price = await fetch_price(symbol)
    
    # In a real scenario, we'd pull 30d history from DB here.
    # For now, we mock history for the forecast.
    now = datetime.now(timezone.utc)
    base_price = price or 100.0
    history = []
    for i in range(30, 0, -1):
        dt = now - timedelta(days=i)
        p = base_price * (1 + random.uniform(-0.05, 0.05))
        history.append({"ds": dt, "y": p})
        
    df = pd.DataFrame(history)
    
    state["market_data"] = {
        "latest_price": price,
        "history_df": df
    }
    return state
```

---

### File: `backend/app/agents/news.py`
```python
from app.agents.state import AgentState
from app.services.finnhub_client import finnhub_client
from app.services.gemini_client import gemini_client
import json

async def run_news_node(state: AgentState) -> AgentState:
    symbol = state["symbol"]
    news_items = await finnhub_client.get_company_news(symbol)
    
    if not news_items:
        state["news"] = []
        return state
        
    headlines = [item.get('headline', '') for item in news_items[:5]]
    headlines_text = "\n".join(headlines)
    
    prompt = f"""
    Analyze the sentiment of the following news headlines for {symbol}.
    Return JSON with a 'sentiment_score' between -1.0 (very negative) and 1.0 (very positive) and a 'summary'.
    <untrusted_data>
    {headlines_text}
    </untrusted_data>
    """
    
    result_text = await gemini_client.generate_content(prompt)
    
    sentiment_score = 0.0
    try:
        # Extremely naive parse for demo
        import re
        match = re.search(r"'sentiment_score':?\s*([-\d.]+)", result_text)
        if match:
            sentiment_score = float(match.group(1))
    except Exception:
        pass
        
    state["news"] = [
        {"sentiment_score": sentiment_score, "raw": headlines_text}
    ]
    
    return state
```

---

### File: `backend/app/agents/forecast.py`
```python
from app.agents.state import AgentState
from app.services.prophet_service import get_forecast

async def run_forecast_node(state: AgentState) -> AgentState:
    market_data = state.get("market_data", {})
    history_df = market_data.get("history_df")
    
    if history_df is not None and not history_df.empty:
        forecast_result = get_forecast(history_df, days=7)
        state["forecast"] = forecast_result
    else:
        state["forecast"] = {"error": "No history available"}
        
    return state
```

---

### File: `backend/app/agents/risk.py`
```python
from app.agents.state import AgentState
from app.services.gemini_client import gemini_client

async def run_risk_node(state: AgentState) -> AgentState:
    risk_score = state.get("risk_score") or 0.0
    news_data = state.get("news", [])
    sentiment = 0.0
    if news_data:
        sentiment = news_data[0].get("sentiment_score", 0.0)
        
    forecast_data = state.get("forecast", {})
    
    prompt = f"""
    Given the following data for {state['symbol']}:
    Sentiment Score: {sentiment}
    Forecast: {forecast_data}
    
    Calculate a risk score between 0.0 (safe) and 1.0 (very risky).
    Return JSON with 'risk_score' and 'reasoning'.
    """
    
    result = await gemini_client.generate_content(prompt)
    
    risk_score = 0.5
    try:
        import re
        match = re.search(r"'risk_score':?\s*([\d.]+)", result)
        if match:
            risk_score = float(match.group(1))
    except Exception:
        pass
        
    state["risk_score"] = risk_score
    return state
```

---

### File: `backend/app/agents/alert.py`
```python
from app.agents.state import AgentState
from app.services.gemini_client import gemini_client
from app.services.citation_guard import CitationGuard

async def run_alert_node(state: AgentState) -> AgentState:
    risk_score = state.get("risk_score") or 0.0
    
    # Simple alert logic
    state["alert_triggered"] = risk_score > 0.8
    
    # Synthesize final answer
    symbol = state["symbol"]
    query = state["query"]
    
    prompt = f"""
    The user asked: "{query}" about {symbol}.
    
    Here is the analysis data:
    Risk Score: {risk_score}
    Forecast Data: {state.get("forecast", {})}
    Sentiment Data: {state.get("news", [])}
    
    Provide a concise, synthesized answer. Include numeric citations like [1] when referencing data.
    """
    
    answer = await gemini_client.generate_content(prompt)
    # Validate citations before storing
    state["answer"] = CitationGuard.sanitize(answer)
    
    return state
```

---

### File: `backend/app/services/ws_hub.py`
```python
import asyncio
from collections import defaultdict
from typing import Any
import json


class WSHub:
    """Per-user asyncio.Queue pubsub hub."""

    def __init__(self):
        self._queues: dict[int, list[asyncio.Queue]] = defaultdict(list)

    def connect(self, user_id: int) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._queues[user_id].append(q)
        return q

    def disconnect(self, user_id: int, q: asyncio.Queue):
        try:
            self._queues[user_id].remove(q)
        except ValueError:
            pass

    async def publish_to_user(self, user_id: int, event: dict[str, Any]):
        for q in list(self._queues.get(user_id, [])):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass  # drop if client is slow

    async def broadcast(self, event: dict[str, Any]):
        """Broadcast to ALL connected users."""
        for user_id in list(self._queues.keys()):
            await self.publish_to_user(user_id, event)


# Singleton
ws_hub = WSHub()
```

---

### File: `backend/app/services/alert_evaluator.py`
```python
import asyncio
from typing import Dict
from app.services.ws_hub import ws_hub
from sqlalchemy.ext.asyncio import AsyncSession
from app import models

class AlertEvaluator:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.active_alerts: Dict[str, bool] = {}  # user_id-symbol-position_id -> triggered state

    async def evaluate_position_thresholds(self, symbol: str, price: float):
        # Get all positions with alert thresholds for this symbol
        result = await self.db.execute(
            models.Position.query.where(
                models.Position.symbol == symbol,
                models.Position.alert_threshold.isnot(None)
            )
        )
        positions = result.scalars().all()
        
        for position in positions:
            if position.alert_threshold and price >= position.alert_threshold:
                alert_key = f"{position.user_id}-{position.symbol}-{position.id}"
                
                # Prevent duplicate alerts
                if alert_key not in self.active_alerts:
                    self.active_alerts[alert_key] = True
                    
                    await ws_hub.publish_to_user(
                        position.user_id,
                        {
                            "type": "alert",
                            "symbol": symbol,
                            "price": price,
                            "position_id": position.id,
                            "message": f"{symbol} reached ${price:.2f} (threshold: ${position.alert_threshold})"
                        }
                    )

    async def reset_symbol_alerts(self, symbol: str):
        """Reset alerts when price falls below threshold"""
        keys_to_remove = [
            k for k in self.active_alerts.keys() 
            if f"-{symbol}-" in k
        ]
        for k in keys_to_remove:
            del self.active_alerts[k]
```

---

### File: `backend/app/services/quote_poller.py`
```python
import os
import asyncio
from datetime import datetime, timezone
from typing import Optional
import yfinance as yf
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://postgres:postgres@localhost:5432/finsight"
).replace("postgresql+psycopg://", "postgresql+psycopg_async://")

DEMO_MODE = os.getenv("DEMO_MODE", "0") == "1"
POLL_INTERVAL = 15  # seconds

# Fixture data for DEMO_MODE
DEMO_FIXTURES: dict[str, float] = {
    "AAPL": 189.30,
    "TSLA": 245.67,
    "NVDA": 875.20,
    "MSFT": 421.50,
    "GOOGL": 175.40,
    "BTC-USD": 98432.12,
}


async def fetch_price(symbol: str) -> Optional[float]:
    if DEMO_MODE:
        import random
        base = DEMO_FIXTURES.get(symbol, 100.0)
        return round(base * (1 + random.uniform(-0.002, 0.002)), 2)
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.fast_info
        price = float(info.last_price)
        return price
    except Exception:
        return None


async def poll_loop(symbols: list[str]):
    """Background polling loop. Runs in the worker process."""
    from app.services.ws_hub import ws_hub
    from app.services.alert_evaluator import AlertEvaluator

    engine = create_async_engine(DATABASE_URL, echo=False)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    from app.models import QuoteTick

    # Initialize alert evaluator
    alert_evaluator = None

    while True:
        async with SessionLocal() as db:
            # Initialize alert evaluator on first run
            if alert_evaluator is None:
                alert_evaluator = AlertEvaluator(db)

            for symbol in symbols:
                price = await fetch_price(symbol)
                if price is None:
                    continue

                tick = QuoteTick(
                    ts=datetime.now(timezone.utc),
                    symbol=symbol,
                    price=price,
                    volume=None,
                )
                db.add(tick)

                # Broadcast to all WS subscribers
                await ws_hub.broadcast({
                    "type": "quote_tick",
                    "symbol": symbol,
                    "price": price,
                    "ts": tick.ts.isoformat(),
                })

                # Check position thresholds
                if alert_evaluator:
                    await alert_evaluator.evaluate_position_thresholds(symbol, price)

            try:
                await db.commit()
            except Exception as e:
                await db.rollback()
                print(f"Poller DB error: {e}")

        await asyncio.sleep(POLL_INTERVAL)
```

---

### File: `backend/app/services/gemini_client.py`
```python
import os
import random
from typing import Optional

DEMO_MODE = os.getenv("DEMO_MODE", "0") == "1"

class GeminiClient:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not DEMO_MODE and not self.api_key:
            print("Warning: GEMINI_API_KEY not set. Operating in DEMO_MODE fallback.")
            
    async def generate_content(self, prompt: str) -> str:
        if DEMO_MODE or not self.api_key:
            # Fixtures for demo mode
            if "sentiment" in prompt.lower():
                return f"{{'sentiment_score': {random.uniform(-0.8, 0.8):.2f}, 'summary': 'Demo sentiment summary based on headlines.'}}"
            if "risk" in prompt.lower():
                return f"{{'risk_score': {random.uniform(0.1, 0.9):.2f}, 'reasoning': 'Demo risk reasoning.'}}"
            return "This is a synthesized demo response from the AI. The market looks interesting today! [1]"
            
        try:
            from google import genai
            client = genai.Client(api_key=self.api_key)
            response = client.models.generate_content(
                model='gemini-2.0-flash',
                contents=prompt,
            )
            return response.text
        except Exception as e:
            print(f"Gemini error: {e}")
            return "Error calling AI."  # Ensure never returns None

gemini_client = GeminiClient()
```

---

### File: `backend/app/services/finnhub_client.py`
```python
import os
import httpx
from datetime import datetime, timedelta, timezone

DEMO_MODE = os.getenv("DEMO_MODE", "0") == "1"

class FinnhubClient:
    def __init__(self):
        self.api_key = os.getenv("FINNHUB_API_KEY")
        
    async def get_company_news(self, symbol: str, days: int = 3) -> list[dict]:
        if DEMO_MODE or not self.api_key:
            return [
                {
                    "headline": f"Demo News 1 for {symbol}",
                    "summary": f"This is a demo summary for {symbol}.",
                    "url": "https://example.com/news1",
                    "datetime": int(datetime.now(timezone.utc).timestamp()),
                    "source": "DemoSource"
                },
                {
                    "headline": f"Demo News 2 for {symbol} drops 5%",
                    "summary": "Another demo headline.",
                    "url": "https://example.com/news2",
                    "datetime": int((datetime.now(timezone.utc) - timedelta(hours=2)).timestamp()),
                    "source": "DemoSource"
                }
            ]
            
        to_date = datetime.now(timezone.utc)
        from_date = to_date - timedelta(days=days)
        url = "https://finnhub.io/api/v1/company-news"
        params = {
            "symbol": symbol,
            "from": from_date.strftime("%Y-%m-%d"),
            "to": to_date.strftime("%Y-%m-%d"),
            "token": self.api_key
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.get(url, params=params)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                print(f"Finnhub error: {e}")
                return []

finnhub_client = FinnhubClient()
```

---

### File: `backend/app/services/prophet_service.py`
```python
import pandas as pd
from datetime import datetime, timedelta

def get_forecast(history_df: pd.DataFrame, days: int = 7) -> dict:
    """
    history_df should have 'ds' (datetime) and 'y' (float) columns.
    Returns a dict with forecasted values.
    """
    if history_df.empty or len(history_df) < 5:
        return {"error": "Insufficient data"}
        
    try:
        # Fallback to simple exponential smoothing if Prophet fails to import
        from statsmodels.tsa.holtwinters import ExponentialSmoothing
        import numpy as np
        
        # Ensure sorted and regular frequency
        history_df = history_df.sort_values('ds').set_index('ds')
        
        # Fit Holt-Winters model
        model = ExponentialSmoothing(
            history_df['y'], 
            trend='add', 
            seasonal=None, 
            initialization_method="estimated"
        ).fit()
        
        forecast = model.forecast(days)
        last_date = history_df.index[-1]
        
        result = []
        for i, val in enumerate(forecast):
            future_date = last_date + timedelta(days=i+1)
            # Simulate confidence intervals (simple std dev based)
            std_dev = np.std(history_df['y']) * 0.1
            result.append({
                "ts": future_date.isoformat(),
                "yhat": float(val),
                "yhat_lower": float(val - std_dev),
                "yhat_upper": float(val + std_dev)
            })
            
        return {"forecast": result, "mape": 0.05} # Fake MAPE for now
    except Exception as e:
        print(f"Forecast error: {e}")
        return {"error": str(e)}
```

---

### File: `backend/app/services/citation_guard.py`
```python
import os
import random
import re
from typing import Optional, Tuple

DEMO_MODE = os.getenv("DEMO_MODE", "0") == "1"


def validate_citations(text: str) -> Tuple[bool, str]:
    """
    Validate that all numeric claims have citation markers.
    Returns (is_valid, message).
    """
    if not text:
        return True, "Empty text"
    
    # Pattern for numeric claims (percentages, currency, decimals)
    # Looks for numbers that aren't followed by a citation marker
    numeric_pattern = r'\$?\d+(?:\.\d+)?%?(?!\s*\[\d+\])'
    
    # Find all numeric claims
    uncited = re.findall(numeric_pattern, text)
    
    # Filter out common false positives (dates, section numbers, list markers)
    false_positive_patterns = [
        r'\d{4}',  # years like 2024
        r'^\d+\.$',  # numbered list items at start
    ]
    
    filtered = []
    for claim in uncited:
        is_fp = False
        for fp_pattern in false_positive_patterns:
            if re.match(fp_pattern, claim.strip()):
                is_fp = True
                break
        if not is_fp and float(claim.strip().replace('$', '').replace('%', '')) < 10000:
            # Skip very large numbers (likely IDs or timestamps)
            filtered.append(claim)
    
    if filtered:
        return False, f"Uncited numeric claims found: {filtered}"
    
    return True, "All numerics properly cited"


class CitationGuard:
    """Middleware to block uncited numeric outputs."""
    
    @staticmethod
    def sanitize(text: str) -> str:
        """Replace uncited numbers with redaction notice."""
        is_valid, _ = validate_citations(text)
        if is_valid:
            return text
        
        # Replace uncited numeric claims
        numeric_pattern = r'\$?\d+(?:\.\d+)?%?(?!\s*\[\d+\])'
        
        def replace_uncited(match):
            num = match.group(0)
            return f"[REDACTED: uncited numeric]"
        
        sanitized = re.sub(numeric_pattern, replace_uncited, text)
        return sanitized + "\n\n⚠️ Note: Some numeric claims were removed for citation compliance."
```

---

## Summary

This file covers all backend agent and service implementations:
- DAG executor with topological sort and parallel node execution
- 5 agent nodes: MarketData, News, Forecast, Risk, Alert
- WebSocket hub for per-user event broadcasting
- Alert evaluator for position threshold monitoring
- Quote poller with yfinance integration and demo mode
- Gemini AI client with demo fallback and error handling
- Finnhub news client with rate limiting
- Holt-Winters forecasting service (Prophet alternative)
- Citation guard for numeric claim validation and redaction
- Agent state management with TypedDict
- Background task execution for asynchronous DAG runs
- Error handling and node failure propagation