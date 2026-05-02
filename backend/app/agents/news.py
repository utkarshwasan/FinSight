from app.agents.state import AgentState
from app.services.finnhub_client import finnhub_client
from app.services.gemini_client import gemini_client
from app.services.citation_guard import CitationGuard
import json
import re


def _parse_sentiment(raw: str) -> float:
    """Extract sentiment_score from LLM response. Fail loud on parse errors."""
    if not raw:
        raise ValueError("Empty LLM response")
    # Strip markdown fences if present
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.MULTILINE)
    try:
        data = json.loads(cleaned)
        score = float(data["sentiment_score"])
    except (json.JSONDecodeError, KeyError, TypeError):
        # Fallback regex — match number after "sentiment_score":
        m = re.search(r'"sentiment_score"\s*:\s*(-?\d+(?:\.\d+)?)', cleaned)
        if not m:
            raise ValueError(f"Could not parse sentiment from: {raw[:200]}")
        score = float(m.group(1))
    if not -1.0 <= score <= 1.0:
        raise ValueError(f"sentiment_score out of range: {score}")
    return score


async def run_news_node(state: AgentState) -> AgentState:
    symbol = state["symbol"]
    news_items = await finnhub_client.get_company_news(symbol)

    if not news_items:
        state["news"] = []
        return state

    headlines = [item.get("headline", "") for item in news_items[:5]]
    headlines_text = "\n".join(headlines)

    prompt = f"""
    Analyze the sentiment of the following news headlines for {symbol}.
    Return JSON with a 'sentiment_score' between -1.0 (very negative) and 1.0 (very positive) and a 'summary'.
    <untrusted_data>
    {headlines_text}
    </untrusted_data>
    """

    result_text = await gemini_client.generate_content(prompt)

    try:
        score = _parse_sentiment(result_text)
    except ValueError as e:
        print(f"[news] parse failed: {e}")
        score = 0.0  # graceful default, but logged

    state["news"] = [
        {"sentiment_score": score, "raw": CitationGuard.sanitize(result_text)}
    ]
    state["sentiment"] = score

    return state
