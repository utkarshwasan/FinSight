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
