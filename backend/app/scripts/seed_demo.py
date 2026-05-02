"""Seed demo data: watchlist + positions + quote ticks for a demo user."""

import asyncio
import os
import sys
from datetime import datetime, timezone, timedelta
import random

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost:5432/finsight"
).replace("postgresql+psycopg://", "postgresql+psycopg_async://")

DEMO_PRICES = {
    "AAPL": 189.30,
    "TSLA": 245.67,
    "NVDA": 875.20,
    "MSFT": 421.50,
    "GOOGL": 175.40,
}


async def seed_demo_user():
    sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))

    from sqlalchemy.ext.asyncio import (
        create_async_engine,
        AsyncSession,
        async_sessionmaker,
    )
    from sqlalchemy import select
    from app.models import User, WatchlistItem, Position, QuoteTick
    from app.auth import get_password_hash

    engine = create_async_engine(DATABASE_URL)
    SessionLocal = async_sessionmaker(
        engine, expire_on_commit=False, class_=AsyncSession
    )

    async with SessionLocal() as db:
        result = await db.execute(select(User).where(User.email == "demo@finsight.ai"))
        demo_user = result.scalar_one_or_none()
        if not demo_user:
            demo_user = User(
                email="demo@finsight.ai",
                hashed_password=get_password_hash("Demo@12345"),
                full_name="Demo User",
            )
            db.add(demo_user)
            await db.flush()
            print(f"Created demo user: {demo_user.email}")

        for symbol in DEMO_PRICES:
            r = await db.execute(
                select(WatchlistItem).where(
                    WatchlistItem.user_id == demo_user.id,
                    WatchlistItem.symbol == symbol,
                )
            )
            if not r.scalar_one_or_none():
                db.add(WatchlistItem(user_id=demo_user.id, symbol=symbol))

        demo_positions = [
            ("AAPL", 10, 175.0),
            ("NVDA", 5, 820.0),
            ("TSLA", 8, 230.0),
        ]
        for symbol, qty, avg_price in demo_positions:
            r = await db.execute(
                select(Position).where(
                    Position.user_id == demo_user.id,
                    Position.symbol == symbol,
                )
            )
            if not r.scalar_one_or_none():
                db.add(
                    Position(
                        user_id=demo_user.id,
                        symbol=symbol,
                        quantity=qty,
                        average_price=avg_price,
                    )
                )

        now = datetime.now(timezone.utc)
        for symbol, base_price in DEMO_PRICES.items():
            for day in range(30, 0, -1):
                ts = now - timedelta(days=day)
                price = round(base_price * (1 + random.uniform(-0.03, 0.03)), 2)
                db.add(
                    QuoteTick(
                        ts=ts,
                        symbol=symbol,
                        price=price,
                        volume=random.randint(1_000_000, 10_000_000),
                    )
                )

        await db.commit()
        print("Demo seed complete.")


if __name__ == "__main__":
    asyncio.run(seed_demo_user())
