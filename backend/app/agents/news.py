from app.agents.state import AgentState
from app.services.finnhub_client import finnhub_client
from app.services.gemini_client import gemini_client
from app.services.citation_guard import CitationGuard
from datetime import datetime, timezone
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

    # ── Persist to DB ─────────────────────────────────────────────────
    session_factory = state.get("_session_factory")
    if session_factory and headlines:
        from sqlalchemy import select as sa_select
        from app.models import NewsItem

        try:
            async with session_factory() as db_session:
                for i, headline in enumerate(headlines[:5]):  # persist top 5
                    # Idempotent: skip if same headline+symbol already stored
                    existing = await db_session.scalar(
                        sa_select(NewsItem).where(
                            NewsItem.symbol == symbol,
                            NewsItem.headline == headline[:500],
                        )
                    )
                    if not existing:
                        db_session.add(
                            NewsItem(
                                user_id=state.get("user_id"),
                                symbol=symbol,
                                headline=headline[:500],
                                source="Gemini/Finnhub",
                                sentiment_score=score,
                                published_at=datetime.now(timezone.utc),
                            )
                        )
                await db_session.commit()
        except Exception as e:
            print(f"[News] DB persist failed (non-fatal): {e}")

    state["news"] = [
        {"sentiment_score": score, "raw": CitationGuard.sanitize(result_text)}
    ]
    state["sentiment"] = score

    return state
