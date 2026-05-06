import pandas as pd
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from app.models import QuoteTick
from app.agents.state import AgentState


async def run_market_data_node(state: AgentState) -> AgentState:
    symbol = state["symbol"]
    session_factory = state.get("_session_factory")
    # NOTE: Do NOT emit dag_events here — the executor wraps every node
    # in _safe_run and handles running/done/error events. Emitting here
    # would produce duplicate events in the DAGVisualizer.

    # 1. Fetch latest price from poller
    from app.services.quote_poller import fetch_price

    try:
        latest_price = await fetch_price(symbol)
        if latest_price is None:
            raise ValueError(f"No price for {symbol}")
    except Exception as e:
        raise  # Let executor handle error emission + state recording

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

    # 3. Fall back to synthetic if DB empty (e.g., first boot before poller seeds data)
    is_synthetic = False
    if history_df is None or len(history_df) < 5:
        import random
        is_synthetic = True
        print(f"[MarketData] WARNING: insufficient real history for {symbol}, generating synthetic baseline")

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
        "is_synthetic_history": is_synthetic,
    }

    return state
