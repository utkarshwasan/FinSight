from app.agents.state import AgentState
from app.services.gemini_client import gemini_client

async def run_risk_node(state: AgentState) -> AgentState:
    symbol = state["symbol"]
    news_data = state.get("news", [])
    sentiment = 0.0
    if news_data:
        sentiment = news_data[0].get("sentiment_score", 0.0)
        
    forecast_data = state.get("forecast", {})
    
    prompt = f"""
    Given the following data for {symbol}:
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
