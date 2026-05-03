import pandas as pd
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from app.models import QuoteTick


async def run_market_data_node(state: "AgentState") -> "AgentState":
    symbol = state["symbol"]
    on_event = state.get("on_event")
    session_factory = state.get("_session_factory")

    if on_event:
        await on_event(
            {
                "type": "dag_event",
                "node": "MarketData",
                "status": "running",
                "run_id": state["run_id"],
            }
        )

    # 1. Fetch latest price from poller
    from app.services.quote_poller import fetch_price

    try:
        latest_price = await fetch_price(symbol)
        if latest_price is None:
            raise ValueError(f"No price for {symbol}")
    except Exception as e:
        state.setdefault("errors", {})["MarketData"] = str(e)
        if on_event:
            await on_event(
                {
                    "type": "dag_event",
                    "node": "MarketData",
                    "status": "error",
                    "run_id": state["run_id"],
                    "error_msg": str(e),
                }
            )
        return state

    # 2. Read 30-day history from DB
    history_df = None
    if session_factory:
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(days=30)
            async with session_factory() as session:
                rows = (
                    await session.execute(
                        select(QuoteTick.ts, QuoteTick.price)
                        .where(QuoteTick.symbol == symbol, QuoteTick.ts >= cutoff)
                        .order_by(QuoteTick.ts)
                    )
                ).all()
            if rows:
                history_df = pd.DataFrame(
                    [
                        {"ds": r.ts.replace(tzinfo=None), "y": float(r.price)}
                        for r in rows
                    ]
                )
        except Exception as e:
            print(f"[MarketData] DB history read failed: {e}")

    # 3. Fall back to synthetic if DB empty (e.g., first boot before poller runs)
    if history_df is None or len(history_df) < 5:
        import random

        prices = []
        p = latest_price
        now = datetime.now(timezone.utc)
        for i in range(30, 0, -1):
            p = p * (1 + random.uniform(-0.02, 0.02))
            prices.append(
                {"ds": (now - timedelta(days=i)).replace(tzinfo=None), "y": round(p, 2)}
            )
        history_df = pd.DataFrame(prices)

    state["market_data"] = {
        "latest_price": latest_price,
        "history_df": history_df,
    }

    if on_event:
        await on_event(
            {
                "type": "dag_event",
                "node": "MarketData",
                "status": "done",
                "run_id": state["run_id"],
                "partial_output": f"Price: ${latest_price:.2f} | History: {len(history_df)} rows",
                "latency_ms": 0,
                "tokens": 0,
            }
        )

    return state
