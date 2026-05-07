from app.agents.state import AgentState
from app.services.finnhub_client import finnhub_client
from app.services.gemini_client import gemini_client
from app.services.citation_guard import CitationGuard
from datetime import datetime, timezone
import hashlib
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
    """News node: NEVER raises. On any failure, returns state with empty news + sentiment=0.0
    and logs the cause. Downstream Risk/Alert nodes can run on degraded state."""
    symbol = state["symbol"]
    score = 0.0
    headlines: list[str] = []
    sanitized_summary = ""

    try:
        news_items = await finnhub_client.get_company_news(symbol)
        headlines = [item.get("headline", "") for item in (news_items or [])[:5] if item.get("headline")]

        if headlines:
            headlines_text = "\n".join(headlines)
            prompt = f"""
            Analyze the sentiment of the following news headlines for {symbol}.
            Return JSON with a 'sentiment_score' between -1.0 (very negative) and 1.0 (very positive) and a 'summary'.
            <untrusted_data>
            {headlines_text}
            </untrusted_data>
            """
            try:
                result_text = await gemini_client.generate_content(prompt)
                sanitized_summary = CitationGuard.sanitize(result_text or "")
                try:
                    score = _parse_sentiment(result_text)
                except ValueError as e:
                    print(f"[news] sentiment parse failed: {e}")
                    score = 0.0
            except Exception as e:
                print(f"[news] gemini call failed: {e}")
                score = 0.0
                sanitized_summary = ""
    except Exception as e:
        print(f"[news] finnhub fetch failed: {e}")
        headlines = []

    # ── Persist to DB (best-effort, never raises) ─────────────────────
    session_factory = state.get("_session_factory")
    if session_factory and headlines:
        from sqlalchemy import select as sa_select
        from app.models import NewsItem
        try:
            async with session_factory() as db_session:
                for headline in headlines[:5]:
                    truncated = headline[:500]
                    existing = await db_session.scalar(
                        sa_select(NewsItem).where(
                            NewsItem.symbol == symbol,
                            NewsItem.headline == truncated,
                        )
                    )
                    if not existing:
                        headline_hash = hashlib.md5(
                            f"{symbol}:{headline}".encode()
                        ).hexdigest()[:12]
                        db_session.add(
                            NewsItem(
                                symbol=symbol,
                                headline=truncated,
                                url=f"https://finnhub.io/news/{symbol}/{headline_hash}",
                                source="Gemini/Finnhub",
                                sentiment_score=score,
                                published_at=datetime.now(timezone.utc),
                            )
                        )
                await db_session.commit()
        except Exception as e:
            print(f"[news] DB persist failed (non-fatal): {e}")

    # Build state["news"]
    state["news"] = [
        {
            "headline": h,
            "url": f"https://finnhub.io/news/{symbol}/{hashlib.md5(f'{symbol}:{h}'.encode()).hexdigest()[:12]}",
            "sentiment_score": score,
            "raw": sanitized_summary,
        }
        for h in headlines[:3]
    ] or [{"sentiment_score": score, "raw": sanitized_summary}]
    state["sentiment"] = score
    return state
