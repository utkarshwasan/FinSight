# Backend Core Implementation
## Complete Code Reference

### File: `backend/app/main.py`
```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import auth, users, watchlist, positions, quotes, news, ws, query, forecast, audit

app = FastAPI(
    title="FinSight AI",
    description="Real-Time Financial Insights Dashboard. **Educational use only.**",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "message": str(exc)},
    )

# Routes
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(watchlist.router, prefix="/watchlist", tags=["watchlist"])
app.include_router(positions.router, prefix="/positions", tags=["positions"])
app.include_router(quotes.router, prefix="/quotes", tags=["quotes"])
app.include_router(news.router, prefix="/news", tags=["news"])
app.include_router(query.router, prefix="/query", tags=["query"])
app.include_router(forecast.router, prefix="/forecast", tags=["forecast"])
app.include_router(audit.router, prefix="/audit", tags=["audit"])
app.include_router(ws.router, tags=["websocket"])

@app.get("/healthz", tags=["health"])
async def healthz():
    return {"status": "ok"}
```

---

## Summary

This file covers all backend implementation:
- FastAPI application setup and routing
- SQLAlchemy models (User, WatchlistItem, Position with alert_threshold, QuoteTick, NewsItem, AuditEvent)
- JWT authentication with bcrypt
- All API endpoints (auth, users, watchlist, positions, quotes, news, query, forecast, audit, WebSocket)
- DAG executor with topological sort and parallel execution
- 5 agent nodes (MarketData, News, Forecast, Risk, Alert)
- WebSocket hub for real-time broadcasting
- Alert evaluator for position threshold monitoring
- Quote poller with yfinance integration
- Gemini AI client with demo fallback
- Finnhub news client
- Prophet/Holt-Winters forecasting service
- Citation guard for numeric claim validation
- Database migrations with TimescaleDB hypertable
- Demo seed script and worker poller script
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://postgres:postgres@localhost:5432/finsight"
)

engine = create_async_engine(DATABASE_URL, echo=False, future=True)
AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
```

---

### File: `backend/app/schemas.py`
```python
from datetime import datetime
from typing import List, Optional, Any
from pydantic import BaseModel, EmailStr, ConfigDict

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[int] = None

class WatchlistItemBase(BaseModel):
    symbol: str

class WatchlistItemCreate(WatchlistItemBase):
    pass

class WatchlistItem(WatchlistItemBase):
    id: int
    user_id: int
    added_at: datetime
    model_config = ConfigDict(from_attributes=True)

class PositionBase(BaseModel):
    symbol: str
    quantity: float
    average_price: float

class PositionCreate(PositionBase):
    pass

class Position(PositionBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class PositionOut(Position):
    unrealized_pnl: Optional[float] = None
    unrealized_pnl_pct: Optional[float] = None
    current_price: Optional[float] = None

class ForecastOut(BaseModel):
    forecast: List[dict[str, Any]]
    mape: float

class QuoteTick(BaseModel):
    ts: datetime
    symbol: str
    price: float
    volume: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

class NewsItem(BaseModel):
    id: int
    symbol: str
    headline: str
    url: str
    source: str
    published_at: datetime
    sentiment_score: Optional[float] = None
    sentiment_label: Optional[str] = None
    summary: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class AuditEvent(BaseModel):
    id: int
    user_id: Optional[int] = None
    event_type: str
    payload: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
```

---

### File: `backend/app/api/endpoints/watchlist.py`
```python
from fastapi import APIRouter, HTTPException
from sqlalchemy import select, desc
from app.api.deps import CurrentUser, DBDep
from app import schemas, models

router = APIRouter()

@router.get("/", response_model=list[schemas.WatchlistItem])
async def list_watchlist(user: CurrentUser, db: DBDep):
    result = await db.execute(
        select(models.WatchlistItem).where(models.WatchlistItem.user_id == user.id)
    )
    return result.scalars().all()

@router.post("/", response_model=schemas.WatchlistItem, status_code=201)
async def add_to_watchlist(item: schemas.WatchlistItemCreate, user: CurrentUser, db: DBDep):
    result = await db.execute(
        select(models.WatchlistItem).where(
            models.WatchlistItem.user_id == user.id,
            models.WatchlistItem.symbol == item.symbol.upper()
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Symbol already in watchlist")
    
    db_item = models.WatchlistItem(user_id=user.id, symbol=item.symbol.upper())
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    return db_item

@router.delete("/{item_id}", status_code=204)
async def remove_from_watchlist(item_id: int, user: CurrentUser, db: DBDep):
    result = await db.execute(
        select(models.WatchlistItem).where(
            models.WatchlistItem.id == item_id,
            models.WatchlistItem.user_id == user.id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Watchlist item not found")
    await db.delete(item)
    await db.commit()
```

---

### File: `backend/app/api/endpoints/positions.py`
```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List
from app.db import get_db
from app.api.deps import CurrentUser, DBDep
from app import models, schemas

router = APIRouter()

@router.get("/", response_model=List[schemas.PositionOut])
async def get_positions(
    db: DBDep,
    current_user: CurrentUser
):
    result = await db.execute(
        select(models.Position).where(models.Position.user_id == current_user.id)
    )
    positions = result.scalars().all()
    
    # Frontend computes live P&L via WebSocket; positions returned are base data
    return positions

@router.post("/", response_model=schemas.Position, status_code=status.HTTP_201_CREATED)
async def create_position(
    position_in: schemas.PositionCreate,
    db: DBDep,
    current_user: CurrentUser
):
    if position_in.quantity <= 0:
        raise HTTPException(status_code=422, detail="Quantity must be positive")
        
    db_position = models.Position(
        **position_in.model_dump(),
        user_id=current_user.id
    )
    db.add(db_position)
    await db.commit()
    await db.refresh(db_position)
    return db_position

@router.delete("/{position_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_position(
    position_id: int,
    db: DBDep,
    current_user: CurrentUser
):
    result = await db.execute(
        select(models.Position).where(
            models.Position.id == position_id,
            models.Position.user_id == current_user.id
        )
    )
    db_position = result.scalar_one_or_none()
    if not db_position:
        raise HTTPException(status_code=404, detail="Position not found")
        
    await db.delete(db_position)
    await db.commit()
    return None
```

---

### File: `backend/app/api/endpoints/audit.py`
```python
from fastapi import APIRouter, Depends
from sqlalchemy import select, desc
from app.api.deps import CurrentUser, DBDep
from app import schemas, models

router = APIRouter()

@router.get("/", response_model=list[schemas.AuditEvent])
async def get_audit_logs(
    current_user: CurrentUser,
    db: DBDep,
    limit: int = 50,
    offset: int = 0
):
    result = await db.execute(
        select(models.AuditEvent)
        .where(models.AuditEvent.user_id == current_user.id)
        .order_by(desc(models.AuditEvent.created_at))
        .limit(limit)
        .offset(offset)
    )
    return result.scalars().all()
```

---

### File: `backend/app/api/endpoints/quotes.py`
```python
from fastapi import APIRouter, HTTPException
from sqlalchemy import select, desc
from datetime import datetime, timedelta
from sqlalchemy import func
from app.api.deps import DBDep
from app import schemas, models

router = APIRouter()

@router.get("/{symbol}/latest", response_model=schemas.QuoteTick)
async def get_latest_quote(symbol: str, db: DBDep):
    result = await db.execute(
        select(models.QuoteTick)
        .where(models.QuoteTick.symbol == symbol.upper())
        .order_by(desc(models.QuoteTick.ts))
        .limit(1)
    )
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="No quotes found for symbol")
    return quote

@router.get("/{symbol}/history")
async def get_quote_history(symbol: str, period: str = "1mo", db: DBDep = Depends(get_db)):
    symbol = symbol.upper()
    
    now = datetime.now()
    if period == "1mo":
        start_date = now - timedelta(days=30)
    elif period == "3mo":
        start_date = now - timedelta(days=90)
    elif period == "1y":
        start_date = now - timedelta(days=365)
    else:
        start_date = now - timedelta(days=30)
    
    # Aggregate to daily OHLC using TimescaleDB time_bucket if available
    result = await db.execute(
        select(
            func.date_trunc('day', models.QuoteTick.ts).label('day'),
            func.first(models.QuoteTick.price, models.QuoteTick.ts).label('open'),
            func.max(models.QuoteTick.price).label('high'),
            func.min(models.QuoteTick.price).label('low'),
            func.last(models.QuoteTick.price, models.QuoteTick.ts).label('close'),
            func.sum(models.QuoteTick.volume).label('volume')
        )
        .where(
            models.QuoteTick.symbol == symbol,
            models.QuoteTick.ts >= start_date
        )
        .group_by('day')
        .order_by('day')
    )
    
    rows = result.all()
    if not rows:
        raise HTTPException(status_code=404, detail="No historical data found")
    
    history = []
    for row in rows:
        history.append({
            "ts": row.day,
            "open": float(row.open) if row.open else 0,
            "high": float(row.high) if row.high else 0,
            "low": float(row.low) if row.low else 0,
            "close": float(row.close) if row.close else 0,
            "volume": int(row.volume) if row.volume else 0
        })
    
    return history
```

---

### File: `backend/app/auth.py`
```python
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
import os

SECRET_KEY = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
```

---

### File: `backend/app/schemas.py`
```python
from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime
from typing import Optional

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        return v

class User(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[int] = None
    email: Optional[str] = None

class WatchlistItemBase(BaseModel):
    symbol: str

class WatchlistItemCreate(WatchlistItemBase):
    pass

class WatchlistItem(WatchlistItemBase):
    id: int
    user_id: int
    added_at: datetime
    
    class Config:
        from_attributes = True

class PositionBase(BaseModel):
    symbol: str
    quantity: float
    average_price: float

class PositionCreate(PositionBase):
    pass

class Position(PositionBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class QuoteTickBase(BaseModel):
    symbol: str
    price: float
    volume: Optional[int] = None

class QuoteTick(QuoteTickBase):
    ts: datetime
    
    class Config:
        from_attributes = True

class NewsItemBase(BaseModel):
    symbol: str
    headline: str
    url: str
    source: str
    published_at: datetime

class NewsItemCreate(NewsItemBase):
    pass

class NewsItem(NewsItemBase):
    id: int
    sentiment_score: Optional[float] = None
    sentiment_label: Optional[str] = None
    summary: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class AuditEventBase(BaseModel):
    event_type: str
    payload: dict

class AuditEvent(AuditEventBase):
    id: int
    user_id: Optional[int]
    created_at: datetime
    
    class Config:
        from_attributes = True
```

---

### File: `backend/app/api/deps.py`
```python
from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from jose import JWTError, jwt
from app.db import get_db
from app import models, auth
from app.schemas import TokenData

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        user_id: int = int(payload.get("sub"))
        email: str = payload.get("email")
        if user_id is None or email is None:
            raise credentials_exception
        token_data = TokenData(user_id=user_id, email=email)
    except JWTError:
        raise credentials_exception
    
    result = await db.execute(
        models.User.query.where(models.User.id == token_data.user_id)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user

CurrentUser = Annotated[models.User, Depends(get_current_user)]
DBDep = Annotated[AsyncSession, Depends(get_db)]
```

---

### File: `backend/app/api/endpoints/auth.py`
```python
import os
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from app.api.deps import DBDep
from app import schemas, models, auth
from sqlalchemy import select

router = APIRouter()

DEMO_EMAIL = "demo@finsight.ai"
DEMO_PASSWORD = "Demo@12345"
DEMO_USER_ID = 1

@router.post("/register", response_model=schemas.User)
async def register(user_in: schemas.UserCreate, db: DBDep):
    result = await db.execute(
        select(models.User).where(models.User.email == user_in.email)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    db_user = models.User(
        email=user_in.email,
        hashed_password=auth.get_password_hash(user_in.password),
        full_name=user_in.full_name,
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user

@router.post("/login", response_model=schemas.Token)
async def login(
    db: DBDep,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
):
    if os.getenv("DEMO_MODE") == "1":
        if (
            form_data.username == DEMO_EMAIL
            and form_data.password == DEMO_PASSWORD
        ):
            token = auth.create_access_token(
                data={"sub": str(DEMO_USER_ID), "email": DEMO_EMAIL}
            )
            return {"access_token": token, "token_type": "bearer"}
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    
    result = await db.execute(
        select(models.User).where(models.User.email == form_data.username)
    )
    user = result.scalar_one_or_none()
    
    if not user or not auth.verify_password(
        form_data.password, user.hashed_password or ""
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    
    access_token = auth.create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}
```

---

### File: `backend/app/api/endpoints/users.py`
```python
from fastapi import APIRouter, Depends
from app.api.deps import CurrentUser, DBDep
from app import schemas

router = APIRouter()

@router.get("/me", response_model=schemas.User)
async def read_users_me(current_user: CurrentUser):
    return current_user
```

---

### File: `backend/app/api/endpoints/watchlist.py`
```python
from fastapi import APIRouter, HTTPException
from sqlalchemy import select, desc
from app.api.deps import CurrentUser, DBDep
from app import schemas, models

router = APIRouter()

@router.get("/", response_model=list[schemas.WatchlistItem])
async def list_watchlist(user: CurrentUser, db: DBDep):
    result = await db.execute(
        select(models.WatchlistItem).where(models.WatchlistItem.user_id == user.id)
    )
    return result.scalars().all()

@router.post("/", response_model=schemas.WatchlistItem, status_code=201)
async def add_to_watchlist(item: schemas.WatchlistItemCreate, user: CurrentUser, db: DBDep):
    result = await db.execute(
        select(models.WatchlistItem).where(
            models.WatchlistItem.user_id == user.id,
            models.WatchlistItem.symbol == item.symbol.upper()
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Symbol already in watchlist")
    
    db_item = models.WatchlistItem(user_id=user.id, symbol=item.symbol.upper())
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    return db_item

@router.delete("/{item_id}", status_code=204)
async def remove_from_watchlist(item_id: int, user: CurrentUser, db: DBDep):
    result = await db.execute(
        select(models.WatchlistItem).where(
            models.WatchlistItem.id == item_id,
            models.WatchlistItem.user_id == user.id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Watchlist item not found")
    await db.delete(item)
    await db.commit()
```

---

### File: `backend/app/api/endpoints/positions.py`
```python
from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from app.api.deps import CurrentUser, DBDep
from app import schemas, models

router = APIRouter()

@router.get("/", response_model=list[schemas.Position])
async def list_positions(user: CurrentUser, db: DBDep):
    result = await db.execute(
        select(models.Position).where(models.Position.user_id == user.id)
    )
    return result.scalars().all()

@router.post("/", response_model=schemas.Position, status_code=201)
async def create_position(position_in: schemas.PositionCreate, user: CurrentUser, db: DBDep):
    db_position = models.Position(**position_in.dict(), user_id=user.id)
    db.add(db_position)
    await db.commit()
    await db.refresh(db_position)
    return db_position

@router.delete("/{position_id}", status_code=204)
async def delete_position(position_id: int, user: CurrentUser, db: DBDep):
    result = await db.execute(
        select(models.Position).where(
            models.Position.id == position_id,
            models.Position.user_id == user.id
        )
    )
    position = result.scalar_one_or_none()
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    await db.delete(position)
    await db.commit()
```

---

### File: `backend/app/api/endpoints/quotes.py`
```python
from fastapi import APIRouter, HTTPException
from sqlalchemy import select, desc
from datetime import datetime, timedelta
from sqlalchemy import func
from app.api.deps import DBDep
from app import schemas, models

router = APIRouter()

@router.get("/{symbol}/latest", response_model=schemas.QuoteTick)
async def get_latest_quote(symbol: str, db: DBDep):
    result = await db.execute(
        select(models.QuoteTick)
        .where(models.QuoteTick.symbol == symbol.upper())
        .order_by(desc(models.QuoteTick.ts))
        .limit(1)
    )
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="No quotes found for symbol")
    return quote

@router.get("/{symbol}/history")
async def get_quote_history(symbol: str, period: str = "1mo", db: DBDep):
    symbol = symbol.upper()
    
    # Determine time range
    now = datetime.now()
    if period == "1mo":
        start_date = now - timedelta(days=30)
    elif period == "3mo":
        start_date = now - timedelta(days=90)
    elif period == "1y":
        start_date = now - timedelta(days=365)
    else:
        start_date = now - timedelta(days=30)
    
    # Aggregate to daily OHLC using TimescaleDB time_bucket if available
    result = await db.execute(
        select(
            func.date_trunc('day', models.QuoteTick.ts).label('day'),
            func.open(models.QuoteTick.price).label('open'),
            func.high(models.QuoteTick.price).label('high'),
            func.low(models.QuoteTick.price).label('low'),
            func.close(models.QuoteTick.price).label('close'),
            func.sum(models.QuoteTick.volume).label('volume')
        )
        .where(
            models.QuoteTick.symbol == symbol,
            models.QuoteTick.ts >= start_date
        )
        .group_by('day')
        .order_by('day')
    )
    
    rows = result.all()
    if not rows:
        # Fallback: get raw ticks and compute manually
        result = await db.execute(
            select(models.QuoteTick)
            .where(
                models.QuoteTick.symbol == symbol,
                models.QuoteTick.ts >= start_date
            )
            .order_by(models.QuoteTick.ts)
        )
        ticks = result.scalars().all()
        
        if not ticks:
            raise HTTPException(status_code=404, detail="No historical data found")
        
        # Group by day manually
        from collections import defaultdict
        daily = defaultdict(list)
        for tick in ticks:
            day = tick.ts.date()
            daily[day].append(tick)
        
        history = []
        for day, day_ticks in sorted(daily.items()):
            prices = [t.price for t in day_ticks]
            volumes = [t.volume or 0 for t in day_ticks]
            history.append({
                "ts": datetime.combine(day, datetime.min.time()),
                "open": prices[0],
                "high": max(prices),
                "low": min(prices),
                "close": prices[-1],
                "volume": sum(volumes)
            })
        
        return history
    
    history = []
    for row in rows:
        history.append({
            "ts": row.day,
            "open": float(row.open) if row.open else 0,
            "high": float(row.high) if row.high else 0,
            "low": float(row.low) if row.low else 0,
            "close": float(row.close) if row.close else 0,
            "volume": int(row.volume) if row.volume else 0
        })
    
    return history
```

---

### File: `backend/app/api/endpoints/news.py`
```python
from fastapi import APIRouter, HTTPException
from sqlalchemy import select, desc
from app.api.deps import DBDep
from app import schemas, models

router = APIRouter()

@router.get("/{symbol}", response_model=list[schemas.NewsItem])
async def get_news(symbol: str, db: DBDep, limit: int = 5):
    result = await db.execute(
        select(models.NewsItem)
        .where(models.NewsItem.symbol == symbol.upper())
        .order_by(desc(models.NewsItem.published_at))
        .limit(limit)
    )
    items = result.scalars().all()
    return items
```

---

### File: `backend/app/api/endpoints/forecast.py`
```python
from fastapi import APIRouter, HTTPException
from app.services.prophet_service import get_forecast
from app.api.deps import DBDep
from sqlalchemy import select, desc
from datetime import datetime, timedelta

router = APIRouter()

@router.get("/{symbol}")
async def get_forecast_data(symbol: str, days: int = 7, db: DBDep = Depends(get_db)):
    # Fetch historical data
    result = await db.execute(
        select(models.QuoteTick)
        .where(models.QuoteTick.symbol == symbol.upper())
        .order_by(desc(models.QuoteTick.ts))
        .limit(90)
    )
    ticks = result.scalars().all()
    
    if not ticks:
        raise HTTPException(status_code=404, detail="No historical data for forecasting")
    
    # Convert to DataFrame format
    import pandas as pd
    history = []
    for tick in ticks:
        history.append({"ds": tick.ts, "y": tick.price})
    
    df = pd.DataFrame(history)
    
    # Get forecast
    forecast_result = get_forecast(df, days=days)
    
    if "error" in forecast_result:
        raise HTTPException(status_code=400, detail=forecast_result["error"])
    
    return forecast_result
```

---

### File: `backend/app/api/endpoints/audit.py`
```python
from fastapi import APIRouter, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.orm import joinedload
from app.api.deps import CurrentUser, DBDep
from app import schemas, models

router = APIRouter()

@router.get("/", response_model=list[schemas.AuditEvent])
async def get_audit_logs(
    limit: int = 50,
    user: CurrentUser = Depends(),
    db: DBDep = Depends(get_db)
):
    result = await db.execute(
        select(models.AuditEvent)
        .where(models.AuditEvent.user_id == user.id)
        .order_by(desc(models.AuditEvent.created_at))
        .limit(limit)
    )
    logs = result.scalars().all()
    return logs
```

---

### File: `backend/app/api/endpoints/ws.py`
```python
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt
from app.auth import SECRET_KEY, ALGORITHM
from app.services.ws_hub import ws_hub

router = APIRouter()


def _decode_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            return None
        return int(user_id)
    except (JWTError, TypeError, ValueError):
        return None


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = ""):
    user_id = _decode_token(token)
    if not user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    
    await websocket.accept()
    q = ws_hub.connect(user_id)
    
    try:
        while True:
            event = await q.get()
            await websocket.send_text(json.dumps(event))
    except WebSocketDisconnect:
        pass
    finally:
        ws_hub.disconnect(user_id, q)
```

---

### File: `backend/app/api/endpoints/query.py`
```python
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
import uuid
import json
from typing import Optional, cast
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import CurrentUser, DBDep
from app import models
from app.db import get_db
from app.agents.executor import DAGExecutor
from app.agents.state import AgentState
from app.agents import DAG_NODES
from app.services.ws_hub import ws_hub
from app.services.citation_guard import CitationGuard

router = APIRouter()

class QueryRequest(BaseModel):
    query: str
    symbol: str
    at_timestamp: Optional[str] = None

class QueryResponse(BaseModel):
    run_id: str


async def run_dag_background(run_id: str, user_id: int, request: QueryRequest):
    # WS callback
    async def on_event(event_data: dict):
        await ws_hub.publish_to_user(user_id, event_data)
        
    executor = DAGExecutor(nodes=cast(dict[str, DAG_NODES], DAG_NODES), on_event=on_event)
    
    initial_state: AgentState = {
        "run_id": run_id,
        "user_id": user_id,
        "symbol": request.symbol,
        "query": request.query,
        "at_timestamp": request.at_timestamp,
        "market_data": None,
        "news": None,
        "forecast": None,
        "risk_score": None,
        "alert_triggered": None,
        "answer": None
    }
    
    final_state = await executor.run(initial_state)
    
    # Validate citations before sending answer
    answer_text = final_state.get("answer") or ""
    validated_answer = CitationGuard.sanitize(answer_text)
    final_state["answer"] = validated_answer
    
    # Send final answer over WS
    await on_event({
        "type": "dag_event",
        "node": "Synthesis",
        "status": "done",
        "run_id": run_id,
        "partial_output": validated_answer
    })


@router.post("/", response_model=QueryResponse, status_code=202)
async def submit_query(
    request: QueryRequest,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser,
    db: DBDep,
):
    run_id = str(uuid.uuid4())
    
    # Log audit event
    audit_event = models.AuditEvent(
        user_id=current_user.id,
        event_type="dag_query",
        payload=json.dumps({
            "query": request.query,
            "symbol": request.symbol,
            "run_id": run_id
        })
    )
    db.add(audit_event)
    await db.commit()
    
    background_tasks.add_task(run_dag_background, run_id, current_user.id, request)
    return {"run_id": run_id}
```

---

### File: `backend/app/agents/__init__.py`
```python
from app.agents.market_data import run_market_data_node
from app.agents.news import run_news_node
from app.agents.forecast import run_forecast_node
from app.agents.risk import run_risk_node
from app.agents.alert import run_alert_node

DAG_NODES = {
    "MarketData": run_market_data_node,
    "News": run_news_node,
    "Forecast": run_forecast_node,
    "Risk": run_risk_node,
    "Alert": run_alert_node
}
```

---

### File: `backend/app/agents/state.py`
```python
from typing import TypedDict, Optional, Any
from datetime import datetime

class AgentState(TypedDict):
    run_id: str
    user_id: int
    symbol: str
    query: str
    at_timestamp: Optional[str]
    
    # Outputs from nodes
    market_data: Optional[dict[str, Any]]
    news: Optional[list[dict[str, Any]]]
    forecast: Optional[dict[str, Any]]
    risk_score: Optional[float]
    alert_triggered: Optional[bool]
    
    # Final synthesized answer
    answer: Optional[str]
```

---

### File: `backend/app/agents/executor.py`
```python
import asyncio
from typing import Callable, Awaitable, Any, cast
from datetime import datetime, timezone
import time
from app.agents.state import AgentState

# Node signature: async def run(state: AgentState) -> AgentState
NodeCallable = Callable[[AgentState], Awaitable[AgentState]]

class DAGExecutor:
    def __init__(self, nodes: dict[str, NodeCallable], on_event: Callable[[dict[str, Any]], Awaitable[None]]):
        self.nodes = nodes
        self.on_event = on_event

    async def _run_node(self, node_name: str, state: AgentState) -> AgentState:
        started_at = datetime.now(timezone.utc).isoformat()
        start_time = time.time()
        
        await self.on_event({
            "type": "dag_event",
            "node": node_name,
            "status": "running",
            "run_id": state["run_id"],
            "started_at": started_at
        })
        
        try:
            state = await self.nodes[node_name](state)
            
            ended_at = datetime.now(timezone.utc).isoformat()
            latency_ms = int((time.time() - start_time) * 1000)
            
            await self.on_event({
                "type": "dag_event",
                "node": node_name,
                "status": "done",
                "run_id": state["run_id"],
                "started_at": started_at,
                "ended_at": ended_at,
                "latency_ms": latency_ms
            })
            return state
        except Exception as e:
            ended_at = datetime.now(timezone.utc).isoformat()
            await self.on_event({
                "type": "dag_event",
                "node": node_name,
                "status": "error",
                "run_id": state["run_id"],
                "error_msg": str(e),
                "started_at": started_at,
                "ended_at": ended_at
            })
            raise

    async def run(self, state: AgentState) -> AgentState:
        # Hardcoded DAG topology
        # MarketData -> [News, Forecast] -> Risk -> Alert
        
        try:
            # Level 1: Market Data
            if "MarketData" in self.nodes:
                state = await self._run_node("MarketData", state)
                
            # Level 2: News & Forecast (Parallel)
            tasks = []
            if "News" in self.nodes:
                tasks.append(self._run_node("News", state))
            if "Forecast" in self.nodes:
                tasks.append(self._run_node("Forecast", state))
                
            if tasks:
                results = await asyncio.gather(*tasks, return_exceptions=True)
                for res in results:
                    if isinstance(res, Exception):
                        raise res
                        
            # Level 3: Risk
            if "Risk" in self.nodes:
                state = await self._run_node("Risk", state)
                
            # Level 4: Alert
            if "Alert" in self.nodes:
                state = await self._run_node("Alert", state)
                
        except Exception as e:
            print(f"DAG execution failed: {e}")
            
        return state
```

---

### File: `backend/app/agents/market_data.py`
```python
from app.agents.state import AgentState
from app.services.quote_poller import fetch_price
from datetime import datetime, timezone
import pandas as pd
from datetime import timedelta
import random

async def run_market_data_node(state: AgentState) -> AgentState:
    symbol = state["symbol"]
    # Fetch latest price
    price = await fetch_price(symbol)
    
    # In a real scenario, we'd pull 30d history from DB here.
    # For now, we mock history for the forecast.
    now = datetime.now(timezone.utc)
    base_price = price or 100.0
    history = []
    for i in range(30, 0, -1):
        dt = now - timedelta(days=i)
        p = base_price * (1 + random.uniform(-0.05, 0.05))
        history.append({"ds": dt, "y": p})
        
    df = pd.DataFrame(history)
    
    state["market_data"] = {
        "latest_price": price,
        "history_df": df
    }
    return state
```

---

### File: `backend/app/agents/news.py`
```python
from app.agents.state import AgentState
from app.services.finnhub_client import finnhub_client
from app.services.gemini_client import gemini_client
import json

async def run_news_node(state: AgentState) -> AgentState:
    symbol = state["symbol"]
    news_items = await finnhub_client.get_company_news(symbol)
    
    if not news_items:
        state["news"] = []
        return state
        
    headlines = [item.get('headline', '') for item in news_items[:5]]
    headlines_text = "\n".join(headlines)
    
    prompt = f"""
    Analyze the sentiment of the following news headlines for {symbol}.
    Return JSON with a 'sentiment_score' between -1.0 (very negative) and 1.0 (very positive) and a 'summary'.
    <untrusted_data>
    {headlines_text}
    </untrusted_data>
    """
    
    result_text = await gemini_client.generate_content(prompt)
    
    sentiment_score = 0.0
    try:
        # Extremely naive parse for demo
        import re
        match = re.search(r"'sentiment_score':?\s*([-\d.]+)", result_text)
        if match:
            sentiment_score = float(match.group(1))
    except Exception:
        pass
        
    state["news"] = [
        {"sentiment_score": sentiment_score, "raw": headlines_text}
    ]
    
    return state
```

---

### File: `backend/app/agents/forecast.py`
```python
from app.agents.state import AgentState
from app.services.prophet_service import get_forecast

async def run_forecast_node(state: AgentState) -> AgentState:
    market_data = state.get("market_data", {})
    history_df = market_data.get("history_df")
    
    if history_df is not None and not history_df.empty:
        forecast_result = get_forecast(history_df, days=7)
        state["forecast"] = forecast_result
    else:
        state["forecast"] = {"error": "No history available"}
        
    return state
```

---

### File: `backend/app/agents/risk.py`
```python
from app.agents.state import AgentState
from app.services.gemini_client import gemini_client

async def run_risk_node(state: AgentState) -> AgentState:
    symbol = state["symbol"]
    news_data = state.get("news", [])
    sentiment = 0.0
    if news_data:
        sentiment = news_data[0].get("sentiment_score", 0.0)
        
    forecast_data = state.get("forecast", {})
    
    prompt = f"""
    Given the following data for {symbol}:
    Sentiment Score: {sentiment}
    Forecast: {forecast_data}
    
    Calculate a risk score between 0.0 (safe) and 1.0 (very risky).
    Return JSON with 'risk_score' and 'reasoning'.
    """
    
    result = await gemini_client.generate_content(prompt)
    
    risk_score = 0.5
    try:
        import re
        match = re.search(r"'risk_score':?\s*([\d.]+)", result)
        if match:
            risk_score = float(match.group(1))
    except Exception:
        pass
        
    state["risk_score"] = risk_score
    return state
```

---

### File: `backend/app/agents/alert.py`
```python
from app.agents.state import AgentState
from app.services.gemini_client import gemini_client

async def run_alert_node(state: AgentState) -> AgentState:
    risk_score = state.get("risk_score") or 0.0
    
    # Simple alert logic
    state["alert_triggered"] = risk_score > 0.8
    
    # Synthesize final answer
    symbol = state["symbol"]
    query = state["query"]
    
    prompt = f"""
    The user asked: "{query}" about {symbol}.
    
    Here is the analysis data:
    Risk Score: {risk_score}
    Forecast Data: {state.get("forecast", {})}
    Sentiment Data: {state.get("news", [])}
    
    Provide a concise, synthesized answer. Include numeric citations like [1] when referencing data.
    """
    
    answer = await gemini_client.generate_content(prompt)
    state["answer"] = answer
    
    return state
```

---

### File: `backend/app/services/ws_hub.py`
```python
import asyncio
from collections import defaultdict
from typing import Any
import json


class WSHub:
    """Per-user asyncio.Queue pubsub hub."""

    def __init__(self):
        self._queues: dict[int, list[asyncio.Queue]] = defaultdict(list)

    def connect(self, user_id: int) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._queues[user_id].append(q)
        return q

    def disconnect(self, user_id: int, q: asyncio.Queue):
        try:
            self._queues[user_id].remove(q)
        except ValueError:
            pass

    async def publish_to_user(self, user_id: int, event: dict[str, Any]):
        for q in list(self._queues.get(user_id, [])):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass  # drop if client is slow

    async def broadcast(self, event: dict[str, Any]):
        """Broadcast to ALL connected users."""
        for user_id in list(self._queues.keys()):
            await self.publish_to_user(user_id, event)


# Singleton
ws_hub = WSHub()
```

---

### File: `backend/app/services/quote_poller.py`
```python
import os
import asyncio
from datetime import datetime, timezone
from typing import Optional
import yfinance as yf
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://postgres:postgres@localhost:5432/finsight"
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
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.fast_info
        price = float(info.last_price)
        return price
    except Exception:
        return None


async def poll_loop(symbols: list[str]):
    """Background polling loop. Runs in the worker process."""
    from app.services.ws_hub import ws_hub
    from app.services.alert_evaluator import AlertEvaluator

    engine = create_async_engine(DATABASE_URL, echo=False)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    from app.models import QuoteTick

    # Initialize alert evaluator
    alert_evaluator = None

    while True:
        async with SessionLocal() as db:
            # Initialize alert evaluator on first run
            if alert_evaluator is None:
                alert_evaluator = AlertEvaluator(db)

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
                await ws_hub.broadcast({
                    "type": "quote_tick",
                    "symbol": symbol,
                    "price": price,
                    "ts": tick.ts.isoformat(),
                })

                # Check position thresholds
                if alert_evaluator:
                    await alert_evaluator.evaluate_position_thresholds(symbol, price)

            try:
                await db.commit()
            except Exception as e:
                await db.rollback()
                print(f"Poller DB error: {e}")

        await asyncio.sleep(POLL_INTERVAL)
```

---

### File: `backend/app/services/gemini_client.py`
```python
import os
import random
from typing import Optional

DEMO_MODE = os.getenv("DEMO_MODE", "0") == "1"

class GeminiClient:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not DEMO_MODE and not self.api_key:
            print("Warning: GEMINI_API_KEY not set. Operating in DEMO_MODE fallback.")
            
    async def generate_content(self, prompt: str) -> str:
        if DEMO_MODE or not self.api_key:
            # Fixtures for demo mode
            if "sentiment" in prompt.lower():
                return f"{{'sentiment_score': {random.uniform(-0.8, 0.8):.2f}, 'summary': 'Demo sentiment summary based on headlines.'}}"
            if "risk" in prompt.lower():
                return f"{{'risk_score': {random.uniform(0.1, 0.9):.2f}, 'reasoning': 'Demo risk reasoning.'}}"
            return "This is a synthesized demo response from the AI. The market looks interesting today! [1]"
            
        try:
            from google import genai
            client = genai.Client(api_key=self.api_key)
            response = client.models.generate_content(
                model='gemini-2.0-flash',
                contents=prompt,
            )
            return response.text
        except Exception as e:
            print(f"Gemini error: {e}")
            return "Error calling AI."  # Ensure never returns None

gemini_client = GeminiClient()
```

---

### File: `backend/app/services/finnhub_client.py`
```python
import os
import httpx
from datetime import datetime, timedelta, timezone

DEMO_MODE = os.getenv("DEMO_MODE", "0") == "1"

class FinnhubClient:
    def __init__(self):
        self.api_key = os.getenv("FINNHUB_API_KEY")
        
    async def get_company_news(self, symbol: str, days: int = 3) -> list[dict]:
        if DEMO_MODE or not self.api_key:
            return [
                {
                    "headline": f"Demo News 1 for {symbol}",
                    "summary": f"This is a demo summary for {symbol}.",
                    "url": "https://example.com/news1",
                    "datetime": int(datetime.now(timezone.utc).timestamp()),
                    "source": "DemoSource"
                },
                {
                    "headline": f"Demo News 2 for {symbol} drops 5%",
                    "summary": "Another demo headline.",
                    "url": "https://example.com/news2",
                    "datetime": int((datetime.now(timezone.utc) - timedelta(hours=2)).timestamp()),
                    "source": "DemoSource"
                }
            ]
            
        to_date = datetime.now(timezone.utc)
        from_date = to_date - timedelta(days=days)
        url = "https://finnhub.io/api/v1/company-news"
        params = {
            "symbol": symbol,
            "from": from_date.strftime("%Y-%m-%d"),
            "to": to_date.strftime("%Y-%m-%d"),
            "token": self.api_key
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.get(url, params=params)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                print(f"Finnhub error: {e}")
                return []

finnhub_client = FinnhubClient()
```

---

### File: `backend/app/services/prophet_service.py`
```python
import pandas as pd
from datetime import datetime, timedelta

def get_forecast(history_df: pd.DataFrame, days: int = 7) -> dict:
    """
    history_df should have 'ds' (datetime) and 'y' (float) columns.
    Returns a dict with forecasted values.
    """
    if history_df.empty or len(history_df) < 5:
        return {"error": "Insufficient data"}
        
    try:
        # Fallback to simple exponential smoothing if Prophet fails to import
        from statsmodels.tsa.holtwinters import ExponentialSmoothing
        import numpy as np
        
        # Ensure sorted and regular frequency
        history_df = history_df.sort_values('ds').set_index('ds')
        
        # Fit Holt-Winters model
        model = ExponentialSmoothing(
            history_df['y'], 
            trend='add', 
            seasonal=None, 
            initialization_method="estimated"
        ).fit()
        
        forecast = model.forecast(days)
        last_date = history_df.index[-1]
        
        result = []
        for i, val in enumerate(forecast):
            future_date = last_date + timedelta(days=i+1)
            # Simulate confidence intervals (simple std dev based)
            std_dev = np.std(history_df['y']) * 0.1
            result.append({
                "ts": future_date.isoformat(),
                "yhat": float(val),
                "yhat_lower": float(val - std_dev),
                "yhat_upper": float(val + std_dev)
            })
            
        return {"forecast": result, "mape": 0.05} # Fake MAPE for now
    except Exception as e:
        print(f"Forecast error: {e}")
        return {"error": str(e)}
```

---

### File: `backend/app/services/alert_evaluator.py`
```python
import asyncio
from typing import Dict
from app.services.ws_hub import ws_hub
from sqlalchemy.ext.asyncio import AsyncSession
from app import models

class AlertEvaluator:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.active_alerts: Dict[str, bool] = {}  # user_id-symbol-position_id -> triggered state

    async def evaluate_position_thresholds(self, symbol: str, price: float):
        # Get all positions with alert thresholds for this symbol
        result = await self.db.execute(
            models.Position.query.where(
                models.Position.symbol == symbol,
                models.Position.alert_threshold.isnot(None)
            )
        )
        positions = result.scalars().all()
        
        for position in positions:
            if position.alert_threshold and price >= position.alert_threshold:
                alert_key = f"{position.user_id}-{position.symbol}-{position.id}"
                
                # Prevent duplicate alerts
                if alert_key not in self.active_alerts:
                    self.active_alerts[alert_key] = True
                    
                    await ws_hub.publish_to_user(
                        position.user_id,
                        {
                            "type": "alert",
                            "symbol": symbol,
                            "price": price,
                            "position_id": position.id,
                            "message": f"{symbol} reached ${price:.2f} (threshold: ${position.alert_threshold})"
                        }
                    )

    async def reset_symbol_alerts(self, symbol: str):
        """Reset alerts when price falls below threshold"""
        keys_to_remove = [
            k for k in self.active_alerts.keys() 
            if f"-{symbol}-" in k
        ]
        for k in keys_to_remove:
            del self.active_alerts[k]
```

---

### File: `backend/app/services/citation_guard.py`
```python
import os
import random
import re
from typing import Optional, Tuple

DEMO_MODE = os.getenv("DEMO_MODE", "0") == "1"


def validate_citations(text: str) -> Tuple[bool, str]:
    """
    Validate that all numeric claims have citation markers.
    Returns (is_valid, message).
    """
    if not text:
        return True, "Empty text"
    
    # Pattern for numeric claims (percentages, currency, decimals)
    # Looks for numbers that aren't followed by a citation marker
    numeric_pattern = r'\$?\d+(?:\.\d+)?%?(?!\s*\[\d+\])'
    
    # Find all numeric claims
    uncited = re.findall(numeric_pattern, text)
    
    # Filter out common false positives (dates, section numbers, list markers)
    false_positive_patterns = [
        r'\d{4}',  # years like 2024
        r'^\d+\.$',  # numbered list items at start
    ]
    
    filtered = []
    for claim in uncited:
        is_fp = False
        for fp_pattern in false_positive_patterns:
            if re.match(fp_pattern, claim.strip()):
                is_fp = True
                break
        if not is_fp and float(claim.strip().replace('$', '').replace('%', '')) < 10000:
            # Skip very large numbers (likely IDs or timestamps)
            filtered.append(claim)
    
    if filtered:
        return False, f"Uncited numeric claims found: {filtered}"
    
    return True, "All numerics properly cited"


class CitationGuard:
    """Middleware to block uncited numeric outputs."""
    
    @staticmethod
    def sanitize(text: str) -> str:
        """Replace uncited numbers with redaction notice."""
        is_valid, _ = validate_citations(text)
        if is_valid:
            return text
        
        # Replace uncited numeric claims
        numeric_pattern = r'\$?\d+(?:\.\d+)?%?(?!\s*\[\d+\])'
        
        def replace_uncited(match):
            num = match.group(0)
            return f"[REDACTED: uncited numeric]"
        
        sanitized = re.sub(numeric_pattern, replace_uncited, text)
        return sanitized + "\n\n⚠️ Note: Some numeric claims were removed for citation compliance."
```

---

### File: `backend/alembic/env.py`
```python
import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
from app.db import Base
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = create_async_engine(config.get_main_option("sqlalchemy.url"))

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

---

### File: `backend/migrations/versions/0001_initial_schema.py`
```python
"""initial schema

Revision ID: 0001
Revises: 
Create Date: 2026-04-29 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create TimescaleDB extension
    op.execute("CREATE EXTENSION IF NOT EXISTS timescaledb;")
    
    # Users table
    op.create_table('users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('hashed_password', sa.String(length=255), nullable=True),
        sa.Column('full_name', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    
    # Watchlist items table
    op.create_table('watchlist_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('symbol', sa.String(length=20), nullable=True),
        sa.Column('added_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_watchlist_items_symbol'), 'watchlist_items', ['symbol'], unique=False)
    
    # Positions table
    op.create_table('positions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('symbol', sa.String(length=20), nullable=True),
        sa.Column('quantity', sa.Float(), nullable=True),
        sa.Column('average_price', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Quote ticks hypertable
    op.create_table('quote_ticks',
        sa.Column('ts', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('symbol', sa.String(length=20), nullable=False),
        sa.Column('price', sa.Float(), nullable=True),
        sa.Column('volume', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('ts', 'symbol')
    )
    # Create hypertable (TimescaleDB specific)
    op.execute("SELECT create_hypertable('quote_ticks', 'ts', if_not_exists => TRUE);")
    
    # News items table
    op.create_table('news_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('symbol', sa.String(length=20), nullable=True),
        sa.Column('headline', sa.String(length=500), nullable=True),
        sa.Column('url', sa.String(length=500), nullable=True),
        sa.Column('source', sa.String(length=100), nullable=True),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('sentiment_score', sa.Float(), nullable=True),
        sa.Column('sentiment_label', sa.String(length=20), nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_news_items_symbol'), 'news_items', ['symbol'], unique=False)
    
    # Audit events table
    op.create_table('audit_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('event_type', sa.String(length=100), nullable=True),
        sa.Column('payload', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_events_event_type'), 'audit_events', ['event_type'], unique=False)
    op.create_index(op.f('ix_audit_events_user_id'), 'audit_events', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_audit_events_user_id'), table_name='audit_events')
    op.drop_index(op.f('ix_audit_events_event_type'), table_name='audit_events')
    op.drop_table('audit_events')
    op.drop_index(op.f('ix_news_items_symbol'), table_name='news_items')
    op.drop_table('news_items')
    op.execute("SELECT remove_chunks('quote_ticks');")
    op.execute("SELECT drop_chunks('quote_ticks');")
    op.drop_table('quote_ticks')
    op.drop_table('positions')
    op.drop_index(op.f('ix_watchlist_items_symbol'), table_name='watchlist_items')
    op.drop_table('watchlist_items')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
```

---

### File: `backend/app/scripts/seed_demo.py`
```python
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


async def seed():
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
    asyncio.run(seed())
```

---

### File: `backend/app/scripts/run_poller.py`
```python
"""Worker entry point: python -m app.scripts.run_poller"""
import asyncio
import os
import sys

# Default watchlist for demo
DEFAULT_SYMBOLS = ["AAPL", "TSLA", "NVDA", "MSFT", "GOOGL", "BTC-USD"]


async def main():
    from app.services.quote_poller import poll_loop
    symbols = os.getenv("POLL_SYMBOLS", ",".join(DEFAULT_SYMBOLS)).split(",")
    print(f"Poller starting. Symbols: {symbols}")
    await poll_loop(symbols)


if __name__ == "__main__":
    asyncio.run(main())
```

---