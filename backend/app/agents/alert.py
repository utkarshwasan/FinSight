from app.agents.state import AgentState
from app.services.gemini_client import gemini_client
from app.services.citation_guard import CitationGuard


def _build_alert_prompt(state: AgentState) -> tuple[str, list[dict]]:
    symbol = state["symbol"]
    query = state.get("query", "")
    news_items = state.get("news") or []
    forecast = state.get("forecast") or {}
    risk_score = state.get("risk_score", 0.0)

    errors = state.get("errors") or {}
    skipped = state.get("skipped") or []
    degraded = bool(errors) or bool(skipped)

    sources: list[dict] = []
    src_lines: list[str] = []

    # News sources
    for i, n in enumerate(news_items[:3], start=1):
        sources.append(
            {
                "n": i,
                "kind": "news",
                "headline": n.get("headline", ""),
                "url": n.get("url", ""),
            }
        )
        src_lines.append(f"[{i}] {n.get('headline', '')[:160]}")

    # Forecast source
    if forecast and "forecast" in forecast:
        n = len(sources) + 1
        mape = forecast.get("mape", 0)
        sources.append({"n": n, "kind": "forecast", "mape": mape})
        src_lines.append(
            f"[{n}] 7-day Holt-Winters forecast (MAPE={mape:.2f}%)"
        )

    # Risk score as a numbered source so the LLM can cite it properly
    risk_n = len(sources) + 1
    sources.append({"n": risk_n, "kind": "risk", "score": risk_score})
    src_lines.append(f"[{risk_n}] Risk assessment: score={risk_score:.2f} (0=safe, 1=high risk)")

    prompt = (
        f"You are a financial analyst answering: {query!r} about {symbol}.\n\n"
        "Rules (HARD):\n"
        "1. Every numeric claim MUST be followed by a citation in square brackets, e.g. '+5.2% [1]'.\n"
        "2. Cite ONLY from the numbered sources below — use [n] after every number you mention.\n"
        "3. Educational use only; not financial advice.\n"
        "4. ≤100 words.\n\n"
        "<untrusted_data>\n" + "\n".join(src_lines) + "\n</untrusted_data>\n\n"
        "Answer:"
    )
    if degraded:
        prompt += (
            f"\n\nNOTE: These stages had issues — {list(errors.keys()) + skipped}. "
            "State that the answer is partial."
        )
    return prompt, sources


async def run_alert_node(state: AgentState) -> AgentState:
    risk_score = state.get("risk_score", 0.0)

    # Alert threshold
    state["alert_triggered"] = risk_score > 0.8

    prompt, sources = _build_alert_prompt(state)
    try:
        answer = await gemini_client.generate_content(prompt)
    except Exception as e:
        print(f"[alert] LLM call failed: {e}")
        answer = (
            "AI analysis temporarily unavailable. "
            "Please review market data and news below. Educational use only — not financial advice."
        )

    sanitized = CitationGuard.sanitize(answer or "")
    # If sanitize redacted everything, emit a clean fallback rather than noise
    if not sanitized.strip() or sanitized.strip() == "_Note: some numeric claims were redacted because they lacked citation chips._":
        sanitized = (
            "AI analysis unavailable right now. "
            "Please check market data and news below. Educational use only."
        )

    state["answer"] = sanitized
    state["sources"] = sources
    return state
