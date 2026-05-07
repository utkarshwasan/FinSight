from app.agents.state import AgentState
from app.services.gemini_client import gemini_client
from app.services.citation_guard import CitationGuard
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
    """Risk node: NEVER raises. Defaults to risk_score=0.5 on any failure."""
    symbol = state["symbol"]
    news_data = state.get("news", []) or []
    sentiment = 0.0
    if news_data:
        sentiment = news_data[0].get("sentiment_score", 0.0)

    forecast_data = state.get("forecast", {}) or {}
    forecast_json = json.dumps(
        {k: v for k, v in forecast_data.items() if k != "forecast"},
        default=str
    )

    prompt = f"""
    Given the following data for {symbol}:
    Sentiment Score: {sentiment}
    Forecast summary: {forecast_json}

    Calculate a risk score between 0.0 (safe) and 1.0 (very risky).
    Return JSON with 'risk_score' and 'reasoning'.
    """

    score = 0.5  # default
    sanitized = ""
    try:
        result = await gemini_client.generate_content(prompt)
        sanitized = CitationGuard.sanitize(result or "")
        try:
            score = _parse_risk_score(result)
        except ValueError as e:
            print(f"[risk] parse failed: {e}")
            score = 0.5
    except Exception as e:
        print(f"[risk] gemini call failed: {e}")
        score = 0.5
        sanitized = ""

    state["risk_reasoning"] = sanitized
    state["risk_score"] = score
    return state
