"""
seed_demo.py — Idempotent demo data seeder.
Safe to run multiple times (all inserts are guarded).
"""

import asyncio
import os
import random
from datetime import datetime, timedelta, timezone


from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


from app.models import NewsItem, Position, QuoteTick, User, WatchlistItem


pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


DATABASE_URL = (
    os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://postgres:postgres@localhost:5432/finsight",
    )
    .replace("postgresql+psycopg://", "postgresql+psycopg_async://")
    .replace("postgresql://", "postgresql+psycopg_async://")
)


DEMO_EMAIL = "demo@finsight.ai"
DEMO_PASSWORD = "Demo@12345"


DEMO_PRICES: dict[str, float] = {
    "AAPL": 178.50,
    "NVDA": 875.00,
    "TSLA": 225.00,
    "MSFT": 415.00,
    "GOOGL": 172.00,
}


DEMO_POSITIONS = [
    {
        "symbol": "AAPL",
        "quantity": 10.0,
        "average_price": 175.00,
        "alert_threshold": 185.00,
    },
    {
        "symbol": "NVDA",
        "quantity": 5.0,
        "average_price": 820.00,
        "alert_threshold": 900.00,
    },
    {
        "symbol": "TSLA",
        "quantity": 8.0,
        "average_price": 230.00,
        "alert_threshold": None,
    },
]


DEMO_NEWS = [
    {
        "symbol": "AAPL",
        "headline": "Apple reports record iPhone sales in Q1 2026",
        "source": "Reuters",
        "url": "https://reuters.com/demo/aapl-q1-2026",
        "sentiment_score": 0.82,
        "published_at": datetime.now(timezone.utc) - timedelta(hours=2),
    },
    {
        "symbol": "AAPL",
        "headline": "Apple Vision Pro sees slower-than-expected adoption",
        "source": "Bloomberg",
        "url": "https://bloomberg.com/demo/aapl-vision-pro",
        "sentiment_score": -0.35,
        "published_at": datetime.now(timezone.utc) - timedelta(hours=5),
    },
    {
        "symbol": "NVDA",
        "headline": "NVIDIA's Blackwell GPU demand outpaces supply chain capacity",
        "source": "CNBC",
        "url": "https://cnbc.com/demo/nvda-blackwell",
        "sentiment_score": 0.75,
        "published_at": datetime.now(timezone.utc) - timedelta(hours=3),
    },
    {
        "symbol": "NVDA",
        "headline": "AI chip export restrictions weigh on NVIDIA outlook",
        "source": "Wall Street Journal",
        "url": "https://wsj.com/demo/nvda-export",
        "sentiment_score": -0.55,
        "published_at": datetime.now(timezone.utc) - timedelta(hours=8),
    },
    {
        "symbol": "TSLA",
        "headline": "Tesla Model 3 Highland deliveries surge in Europe",
        "source": "Electrek",
        "url": "https://electrek.co/demo/tsla-model3",
        "sentiment_score": 0.68,
        "published_at": datetime.now(timezone.utc) - timedelta(hours=1),
    },
    {
        "symbol": "TSLA",
        "headline": "Tesla faces regulatory scrutiny over Autopilot claims",
        "source": "FT",
        "url": "https://ft.com/demo/tsla-autopilot",
        "sentiment_score": -0.62,
        "published_at": datetime.now(timezone.utc) - timedelta(hours=12),
    },
    {
        "symbol": "MSFT",
        "headline": "Microsoft Azure OpenAI Service hits 1M enterprise customers",
        "source": "TechCrunch",
        "url": "https://techcrunch.com/demo/msft-azure-openai",
        "sentiment_score": 0.90,
        "published_at": datetime.now(timezone.utc) - timedelta(hours=4),
    },
    {
        "symbol": "MSFT",
        "headline": "Microsoft Copilot+ PCs see strong early sales momentum",
        "source": "The Verge",
        "url": "https://theverge.com/demo/msft-copilot",
        "sentiment_score": 0.72,
        "published_at": datetime.now(timezone.utc) - timedelta(hours=6),
    },
    {
        "symbol": "GOOGL",
        "headline": "Google Gemini Ultra outperforms GPT-4 on enterprise benchmarks",
        "source": "VentureBeat",
        "url": "https://venturebeat.com/demo/googl-gemini",
        "sentiment_score": 0.85,
        "published_at": datetime.now(timezone.utc) - timedelta(hours=7),
    },
    {
        "symbol": "GOOGL",
        "headline": "EU antitrust probe targets Google Search ad practices",
        "source": "Reuters",
        "url": "https://reuters.com/demo/googl-eu",
        "sentiment_score": -0.48,
        "published_at": datetime.now(timezone.utc) - timedelta(hours=9),
    },
    {
        "symbol": "AAPL",
        "headline": "Apple's Services segment revenue crosses $25B quarterly milestone",
        "source": "Barrons",
        "url": "https://barrons.com/demo/aapl-services",
        "sentiment_score": 0.78,
        "published_at": datetime.now(timezone.utc) - timedelta(hours=10),
    },
    {
        "symbol": "NVDA",
        "headline": "NVIDIA announces $10B buyback amid strong data center growth",
        "source": "MarketWatch",
        "url": "https://marketwatch.com/demo/nvda-buyback",
        "sentiment_score": 0.88,
        "published_at": datetime.now(timezone.utc) - timedelta(hours=14),
    },
    {
        "symbol": "TSLA",
        "headline": "Tesla Cybertruck production reaches 2,000 units per week",
        "source": "InsideEVs",
        "url": "https://insideevs.com/demo/tsla-cybertruck",
        "sentiment_score": 0.55,
        "published_at": datetime.now(timezone.utc) - timedelta(hours=16),
    },
    {
        "symbol": "MSFT",
        "headline": "Microsoft Teams reaches 350M daily active users",
        "source": "ZDNet",
        "url": "https://zdnet.com/demo/msft-teams",
        "sentiment_score": 0.65,
        "published_at": datetime.now(timezone.utc) - timedelta(hours=18),
    },
    {
        "symbol": "GOOGL",
        "headline": "Google Cloud Platform captures 15% market share in Q1 2026",
        "source": "CRN",
        "url": "https://crn.com/demo/googl-cloud",
        "sentiment_score": 0.70,
        "published_at": datetime.now(timezone.utc) - timedelta(hours=20),
    },
    {
        "symbol": "AAPL",
        "headline": "Apple Intelligence features driving upgrade cycle in Asia Pacific",
        "source": "Nikkei",
        "url": "https://nikkei.com/demo/aapl-asia",
        "sentiment_score": 0.80,
        "published_at": datetime.now(timezone.utc) - timedelta(hours=22),
    },
    {
        "symbol": "NVDA",
        "headline": "NVIDIA H200 GPUs now shipping to 40 cloud partners globally",
        "source": "ServeTheHome",
        "url": "https://servethehome.com/demo/nvda-h200",
        "sentiment_score": 0.82,
        "published_at": datetime.now(timezone.utc) - timedelta(hours=24),
    },
    {
        "symbol": "TSLA",
        "headline": "Tesla Full Self-Driving V13 enters supervised beta testing",
        "source": "Teslarati",
        "url": "https://teslarati.com/demo/tsla-fsd-v13",
        "sentiment_score": 0.60,
        "published_at": datetime.now(timezone.utc) - timedelta(hours=26),
    },
    {
        "symbol": "MSFT",
        "headline": "Microsoft GitHub Copilot Enterprise adoption grows 300% YoY",
        "source": "SDTimes",
        "url": "https://sdtimes.com/demo/msft-copilot-enterprise",
        "sentiment_score": 0.88,
        "published_at": datetime.now(timezone.utc) - timedelta(hours=28),
    },
    {
        "symbol": "GOOGL",
        "headline": "Alphabet stock hits 52-week high on strong ad revenue recovery",
        "source": "Investopedia",
        "url": "https://investopedia.com/demo/googl-ad-revenue",
        "sentiment_score": 0.75,
        "published_at": datetime.now(timezone.utc) - timedelta(hours=30),
    },
]


async def seed(engine=None) -> None:
    """Entry point called by main.py lifespan."""
    await seed_demo_user(engine)


async def seed_demo_user(engine=None) -> None:
    if engine is None:
        engine = create_async_engine(DATABASE_URL, echo=False)
    session_factory = async_sessionmaker(
        engine, expire_on_commit=False, class_=AsyncSession
    )

    async with session_factory() as session:
        # ── Demo user ──────────────────────────────────────────────────
        existing = await session.scalar(select(User).where(User.email == DEMO_EMAIL))
        if not existing:
            user = User(
                email=DEMO_EMAIL,
                hashed_password=pwd_ctx.hash(DEMO_PASSWORD),
            )
            session.add(user)
            await session.flush()  # get user.id
        else:
            user = existing
            print("Demo user already exists, skipping user creation.")

        user_id = user.id

        # ── Watchlist items ────────────────────────────────────────────
        for symbol in DEMO_PRICES:
            wl_exists = await session.scalar(
                select(WatchlistItem).where(
                    WatchlistItem.user_id == user_id,
                    WatchlistItem.symbol == symbol,
                )
            )
            if not wl_exists:
                session.add(WatchlistItem(user_id=user_id, symbol=symbol))

        # ── Positions ─────────────────────────────────────────────────
        for pos in DEMO_POSITIONS:
            pos_exists = await session.scalar(
                select(Position).where(
                    Position.user_id == user_id,
                    Position.symbol == pos["symbol"],
                )
            )
            if not pos_exists:
                session.add(
                    Position(
                        user_id=user_id,
                        symbol=pos["symbol"],
                        quantity=pos["quantity"],
                        average_price=pos["average_price"],
                        alert_threshold=pos.get("alert_threshold"),
                    )
                )

        # ── Quote ticks (30-day history, idempotent) ──────────────────
        now = datetime.now(timezone.utc)
        for symbol, base_price in DEMO_PRICES.items():
            # Only insert if symbol has no historical rows at all
            existing_tick = await session.scalar(
                select(QuoteTick).where(QuoteTick.symbol == symbol).limit(1)
            )
            if existing_tick is None:
                price = base_price
                for days_ago in range(30, 0, -1):
                    for hour in [9, 12, 15]:
                        ts = now - timedelta(days=days_ago, hours=-hour)
                        price = price * (1 + random.uniform(-0.02, 0.02))
                        session.add(
                            QuoteTick(symbol=symbol, price=round(price, 2), ts=ts)
                        )

        # ── News items (20 items, idempotent by URL) ──────────────────
        for item in DEMO_NEWS:
            news_exists = await session.scalar(
                select(NewsItem).where(NewsItem.url == item["url"])
            )
            if not news_exists:
                session.add(
                    NewsItem(
                        symbol=item["symbol"],
                        headline=item["headline"],
                        source=item["source"],
                        url=item["url"],
                        sentiment_score=item["sentiment_score"],
                        published_at=item["published_at"],
                    )
                )

        await session.commit()
        print(
            f"Seed complete: demo user id={user_id}, "
            f"{len(DEMO_PRICES)} watchlist, {len(DEMO_POSITIONS)} positions, "
            f"{len(DEMO_NEWS)} news items."
        )


if __name__ == "__main__":
    asyncio.run(seed_demo_user())
