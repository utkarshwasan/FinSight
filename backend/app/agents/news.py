from app.agents.state import AgentState
from app.services.finnhub_client import finnhub_client
from datetime import datetime, timezone
import hashlib


def _textblob_sentiment(headlines: list[str]) -> float:
    """Average TextBlob polarity across headlines. Returns -1.0..1.0."""
    try:
        from textblob import TextBlob  # lazy import — only used here
        if not headlines:
            return 0.0
        scores = [TextBlob(h).sentiment.polarity for h in headlines]
        return round(sum(scores) / len(scores), 4)
    except Exception as e:
        print(f"[news] TextBlob sentiment failed: {e}")
        return 0.0


async def run_news_node(state: AgentState) -> AgentState:
    """News node: NEVER raises. On any failure returns empty news + sentiment=0.0.
    Uses TextBlob (no API calls) for sentiment — zero rate-limit risk."""
    symbol = state["symbol"]
    score = 0.0
    headlines: list[str] = []

    try:
        news_items = await finnhub_client.get_company_news(symbol)
        headlines = [
            item.get("headline", "")
            for item in (news_items or [])[:5]
            if item.get("headline")
        ]
    except Exception as e:
        print(f"[news] finnhub fetch failed: {e}")
        headlines = []

    if headlines:
        score = _textblob_sentiment(headlines)

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
                                source="Finnhub",
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
        }
        for h in headlines[:3]
    ] or [{"sentiment_score": score}]
    state["sentiment"] = score
    return state
