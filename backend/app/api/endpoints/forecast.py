from fastapi import APIRouter, Depends, HTTPException
from app.api.deps import CurrentUser, DBDep
from app import schemas
from app.services.prophet_service import get_forecast
from app.services.quote_poller import fetch_price
from datetime import datetime, timezone, timedelta
import pandas as pd
import random

router = APIRouter()

@router.get("/{symbol}", response_model=schemas.ForecastOut)
async def get_symbol_forecast(symbol: str, current_user: CurrentUser):
    # In a real app, fetch 30d history from DB
    now = datetime.now(timezone.utc)
    price = await fetch_price(symbol) or 100.0
    
    history = []
    for i in range(30, 0, -1):
        dt = now - timedelta(days=i)
        p = price * (1 + random.uniform(-0.05, 0.05))
        history.append({"ds": dt, "y": p})
        
    df = pd.DataFrame(history)
    result = get_forecast(df, days=7)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
        
    return result
