from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from app.api.deps import CurrentUser, DBDep
from app import schemas, models
from app.services.prophet_service import get_forecast
from datetime import datetime, timezone, timedelta
import pandas as pd

router = APIRouter()


@router.get("/{symbol}", response_model=schemas.ForecastOut)
async def get_symbol_forecast(symbol: str, current_user: CurrentUser, db: DBDep):
    """Forecast next 7 days using REAL 30-day QuoteTick history from DB.
    Falls back gracefully if history is sparse."""
    symbol_u = symbol.upper()
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)

    rows = (
        await db.execute(
            select(models.QuoteTick.ts, models.QuoteTick.price)
            .where(
                models.QuoteTick.symbol == symbol_u,
                models.QuoteTick.ts >= cutoff,
            )
            .order_by(models.QuoteTick.ts)
        )
    ).all()

    if not rows or len(rows) < 5:
        raise HTTPException(
            status_code=409,
            detail=f"Insufficient history for {symbol_u}: need >=5 ticks in last 30d, have {len(rows)}. Wait for poller to accumulate data.",
        )

    history_df = pd.DataFrame(
        [{"ds": r.ts.replace(tzinfo=None), "y": float(r.price)} for r in rows]
    )

    result = get_forecast(history_df, days=7)

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result
