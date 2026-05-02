import os
import asyncio
from datetime import datetime, timezone
from typing import Optional
import yfinance as yf
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost:5432/finsight"
).replace("postgresql+psycopg://", "postgresql+psycopg_async://")

DEMO_MODE = os.getenv("DEMO_MODE", "0") == "1"
POLL_INTERVAL = 15  # seconds

# Fixture data for DEMO_MODE
DEMO_FIXTURES: dict[str, float] = {
    "AAPL": 189.30,
    "TSLA": 245.67,
    "NVDA": 875.20,
    "MSFT": 421.50,
    "GOOGL": 175.40,
    "BTC-USD": 98432.12,
}


async def fetch_price(symbol: str) -> Optional[float]:
    if DEMO_MODE:
        import random

        base = DEMO_FIXTURES.get(symbol, 100.0)
        return round(base * (1 + random.uniform(-0.002, 0.002)), 2)

    for attempt in range(3):
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.fast_info
            return float(info.last_price)
        except Exception:
            if attempt < 2:
                await asyncio.sleep(1.0 * (2**attempt))
            else:
                return None


async def poll_loop(symbols: list[str]):
    """Background polling loop. Runs in the worker process."""
    from app.services.ws_hub import ws_hub

    engine = create_async_engine(DATABASE_URL, echo=False)
    SessionLocal = async_sessionmaker(
        engine, expire_on_commit=False, class_=AsyncSession
    )

    from app.models import QuoteTick

    while True:
        async with SessionLocal() as db:
            for symbol in symbols:
                price = await fetch_price(symbol)
                if price is None:
                    continue

                tick = QuoteTick(
                    ts=datetime.now(timezone.utc),
                    symbol=symbol,
                    price=price,
                    volume=None,
                )
                db.add(tick)

                # Broadcast to all WS subscribers
                await ws_hub.broadcast(
                    {
                        "type": "quote_tick",
                        "symbol": symbol,
                        "price": price,
                        "ts": tick.ts.isoformat(),
                    }
                )

            try:
                await db.commit()
            except Exception as e:
                await db.rollback()
                print(f"Poller DB error: {e}")

        await asyncio.sleep(POLL_INTERVAL)
