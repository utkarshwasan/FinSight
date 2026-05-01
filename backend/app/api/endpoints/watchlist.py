from fastapi import APIRouter, HTTPException
from sqlalchemy import select
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
    # Check duplicate
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
