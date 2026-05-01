from datetime import datetime
from typing import List, Optional
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
