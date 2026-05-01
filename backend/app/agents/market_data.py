from app.agents.state import AgentState
from app.services.quote_poller import fetch_price
from datetime import datetime, timezone

async def run_market_data_node(state: AgentState) -> AgentState:
    symbol = state["symbol"]
    # Fetch latest price
    price = await fetch_price(symbol)
    
    # In a real scenario, we'd pull 30d history from DB here.
    # For now, we mock history for the forecast.
    import pandas as pd
    from datetime import timedelta
    import random
    
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
