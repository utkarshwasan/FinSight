import asyncio
from app.agents.state import AgentState
from app.services.prophet_service import get_forecast


async def run_forecast_node(state: AgentState) -> AgentState:
    market_data = state.get("market_data", {})
    history_df = market_data.get("history_df")

    if history_df is not None and not history_df.empty:
        forecast_result = await asyncio.to_thread(get_forecast, history_df, 7)
        state["forecast"] = forecast_result
    else:
        state["forecast"] = {"error": "No history available"}

    return state
