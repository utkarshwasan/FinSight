import os
import asyncio
import time as _time
from datetime import datetime, timezone
from typing import Optional
import yfinance as yf
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select

# Alert cooldown: (user_id, symbol) → last_fired monotonic timestamp
# Prevents toast spam — fires at most once per 5 minutes per user/symbol pair
_alert_cooldown: dict[tuple[int, str], float] = {}
ALERT_COOLDOWN_SECONDS = 300

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

    async def _check_alerts(symbol: str, price: float) -> None:
        """Check position thresholds and fire alert events."""
        try:
            from sqlalchemy import select
            from app.models import Position

            async with SessionLocal() as session:
                positions = (
                    (
                        await session.execute(
                            select(Position).where(
                                Position.symbol == symbol,
                                Position.alert_threshold.is_not(None),
                                Position.alert_threshold <= price,
                            )
                        )
                    )
                    .scalars()
                    .all()
                )

                now_mono = _time.monotonic()
                for pos in positions:
                    key = (pos.user_id, symbol)
                    last_fired = _alert_cooldown.get(key, 0)
                    if now_mono - last_fired < ALERT_COOLDOWN_SECONDS:
                        continue  # Already fired recently — skip
                    _alert_cooldown[key] = now_mono
                    await ws_hub.publish_to_user(
                        pos.user_id,
                        {
                            "type": "alert",
                            "symbol": symbol,
                            "price": price,
                            "threshold": pos.alert_threshold,
                            "message": f"{symbol} hit ${price:.2f} ≥ your alert threshold ${pos.alert_threshold:.2f}",
                        },
                    )
        except Exception as e:
            print(f"[AlertCheck] {e}")

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
                # Check alerts
                await _check_alerts(symbol, price)

            try:
                await db.commit()
            except Exception as e:
                await db.rollback()
                print(f"Poller DB error: {e}")

        await asyncio.sleep(POLL_INTERVAL)
