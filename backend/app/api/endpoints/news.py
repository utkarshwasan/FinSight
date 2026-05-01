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
