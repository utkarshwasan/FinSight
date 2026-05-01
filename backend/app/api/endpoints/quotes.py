import os
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from sqlalchemy import select, desc
from app.api.deps import DBDep
from app import schemas, models

router = APIRouter()

DEMO_MODE = os.getenv("DEMO_MODE", "0") == "1"


@router.get("/{symbol}/latest", response_model=schemas.QuoteTick)
async def get_latest_quote(symbol: str, db: DBDep):
    result = await db.execute(
        select(models.QuoteTick)
        .where(models.QuoteTick.symbol == symbol.upper())
        .order_by(desc(models.QuoteTick.ts))
        .limit(1)
    )
    tick = result.scalar_one_or_none()
    if not tick:
        raise HTTPException(status_code=404, detail=f"No quote data for {symbol}")
    return tick


@router.get("/{symbol}/history", response_model=list[schemas.QuoteTick])
async def get_quote_history(symbol: str, period: str = "1mo", db: DBDep = None):
    # Map period to days
    period_map = {"1d": 1, "1wk": 7, "1mo": 30, "3mo": 90, "1y": 365}
    days = period_map.get(period, 30)

    from sqlalchemy import text
    from datetime import timedelta

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(models.QuoteTick)
        .where(
            models.QuoteTick.symbol == symbol.upper(),
            models.QuoteTick.ts >= cutoff
        )
        .order_by(models.QuoteTick.ts)
    )
    ticks = result.scalars().all()
    if not ticks:
        raise HTTPException(status_code=404, detail=f"No history for {symbol}")
    return ticks
