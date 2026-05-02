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
    if forecast and "forecast" in forecast:
        n = len(sources) + 1
        sources.append({"n": n, "kind": "forecast", "mape": forecast.get("mape")})
        src_lines.append(
            f"[{n}] 7-day Holt-Winters forecast (MAPE={forecast.get('mape', 0):.2f})"
        )

    prompt = (
        f"You are a financial analyst answering: {query!r} about {symbol}.\n\n"
        "Rules (HARD):\n"
        "1. Every numeric claim MUST be followed by a numeric citation in square brackets, e.g. '+5.2% [1]'.\n"
        "2. Cite ONLY from the sources below; never invent a source number.\n"
        "3. Educational use only; not financial advice.\n"
        "4. ≤120 words.\n\n"
        f"Risk score: {risk_score:.2f}\n\n"
        "<untrusted_data>\n" + "\n".join(src_lines) + "\n</untrusted_data>\n\n"
        "Answer:"
    )
    if degraded:
        prompt += f"\n\nNOTE: The following stages had issues — {list(errors.keys()) + skipped}. State that the answer is partial."
    return prompt, sources


async def run_alert_node(state: AgentState) -> AgentState:
    risk_score = state.get("risk_score", 0.0)

    errors = state.get("errors") or {}
    skipped = state.get("skipped") or []
    degraded = bool(errors) or bool(skipped)

    # Simple alert logic
    state["alert_triggered"] = risk_score > 0.8

    prompt, sources = _build_alert_prompt(state)
    answer = await gemini_client.generate_content(prompt)
    state["answer"] = CitationGuard.sanitize(answer or "")
    state["sources"] = sources

    return state
