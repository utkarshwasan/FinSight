from app.agents.state import AgentState


def _compute_risk(sentiment: float, mape: float) -> float:
    """Deterministic risk formula — no API call needed.

    sentiment: -1.0 (bearish) .. +1.0 (bullish)
    mape:      0.0 = perfect forecast .. higher = more uncertain

    risk = 0.65 * sentiment_component + 0.35 * forecast_component
      sentiment_component: maps [-1,+1] → [1,0]  (bad sentiment = high risk)
      forecast_component:  mape/50 capped at 1.0  (high forecast error = high risk)
    """
    sentiment_component = (-sentiment + 1.0) / 2.0          # 0.0 (bullish) → 1.0 (bearish)
    forecast_component = min(abs(mape) / 50.0, 1.0)         # 50% MAPE → max risk
    score = 0.65 * sentiment_component + 0.35 * forecast_component
    return round(max(0.0, min(1.0, score)), 4)


async def run_risk_node(state: AgentState) -> AgentState:
    """Risk node: NEVER raises. Deterministic formula — zero API calls."""
    news_data = state.get("news") or []
    sentiment = 0.0
    if news_data:
        sentiment = float(news_data[0].get("sentiment_score", 0.0))

    forecast_data = state.get("forecast") or {}
    mape = float(forecast_data.get("mape", 10.0))  # default 10% MAPE if unknown

    score = _compute_risk(sentiment, mape)
    reasoning = (
        f"Deterministic formula: sentiment={sentiment:.4f}, mape={mape:.2f}% → "
        f"risk_score={score:.4f} "
        f"(65% sentiment weight + 35% forecast uncertainty weight)"
    )

    state["risk_score"] = score
    state["risk_reasoning"] = reasoning
    return state
