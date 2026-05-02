from app.agents.state import AgentState
from app.services.gemini_client import gemini_client
import json
import re


def _parse_risk_score(raw: str) -> float:
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.MULTILINE)
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

    try:
        score = _parse_risk_score(result)
    except ValueError as e:
        print(f"[risk] parse failed: {e}")
        score = 0.5  # graceful default

    state["risk_score"] = score
    return state
