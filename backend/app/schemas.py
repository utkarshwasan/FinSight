from datetime import datetime
from typing import List, Optional, Any
from pydantic import BaseModel, EmailStr, ConfigDict, Field


class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=72)


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
    symbol: str = Field(pattern=r"^[A-Z0-9.\-]{1,10}$")


class WatchlistItemCreate(WatchlistItemBase):
    pass


class WatchlistItem(WatchlistItemBase):
    id: int
    user_id: int
    added_at: datetime
    model_config = ConfigDict(from_attributes=True)


class PositionBase(BaseModel):
    symbol: str = Field(pattern=r"^[A-Z0-9.\-]{1,10}$")
    quantity: float = Field(gt=0, lt=1e9)
    average_price: float = Field(gt=0, lt=1e9)
    alert_threshold: Optional[float] = None


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
