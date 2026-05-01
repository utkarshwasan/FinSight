from datetime import datetime
from typing import List, Optional
from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, Boolean, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from .db import Base

class User(Base):
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[Optional[str]] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    watchlist_items: Mapped[List["WatchlistItem"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    positions: Mapped[List["Position"]] = relationship(back_populates="user", cascade="all, delete-orphan")

class WatchlistItem(Base):
    __tablename__ = "watchlist_items"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    symbol: Mapped[str] = mapped_column(String(20), index=True)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    user: Mapped["User"] = relationship(back_populates="watchlist_items")

class Position(Base):
    __tablename__ = "positions"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    symbol: Mapped[str] = mapped_column(String(20), index=True)
    quantity: Mapped[float] = mapped_column(Float)
    average_price: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    user: Mapped["User"] = relationship(back_populates="positions")

class QuoteTick(Base):
    __tablename__ = "quote_ticks"
    
    # ts is the primary time column for TimescaleDB hypertable
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True, server_default=func.now())
    symbol: Mapped[str] = mapped_column(String(20), primary_key=True, index=True)
    price: Mapped[float] = mapped_column(Float)
    volume: Mapped[Optional[int]] = mapped_column(Integer)

class NewsItem(Base):
    __tablename__ = "news_items"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True)
    headline: Mapped[str] = mapped_column(String(500))
    url: Mapped[str] = mapped_column(String(500))
    source: Mapped[str] = mapped_column(String(100))
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    sentiment_score: Mapped[Optional[float]] = mapped_column(Float)
    sentiment_label: Mapped[Optional[str]] = mapped_column(String(20)) # POSITIVE, NEGATIVE, NEUTRAL
    summary: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class AuditEvent(Base):
    __tablename__ = "audit_events"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(100), index=True) # login, query, forecast, dag_run
    payload: Mapped[dict] = mapped_column(type_=Text) # Store as JSON string or Text
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
