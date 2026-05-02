from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List
from app.db import get_db
from app.api.deps import CurrentUser, DBDep
from app import models, schemas

router = APIRouter()


@router.get("/", response_model=List[schemas.PositionOut])
async def get_positions(db: DBDep, current_user: CurrentUser):
    result = await db.execute(
        select(models.Position).where(models.Position.user_id == current_user.id)
    )
    positions = result.scalars().all()

    # Compute server-side P&L using latest quote
    from sqlalchemy import select as select_func

    enriched = []
    for pos in positions:
        # Get latest price
        price_result = await db.execute(
            select_func(models.QuoteTick.price)
            .where(models.QuoteTick.symbol == pos.symbol)
            .order_by(models.QuoteTick.ts.desc())
            .limit(1)
        )
        current_price = price_result.scalar_one_or_none()

        if current_price:
            market_value = pos.quantity * current_price
            cost_basis = pos.quantity * pos.average_price
            unrealized_pnl = market_value - cost_basis
            unrealized_pnl_pct = (
                (unrealized_pnl / cost_basis) * 100 if cost_basis else 0
            )
        else:
            unrealized_pnl = None
            unrealized_pnl_pct = None
            current_price = None

        enriched.append(
            {
                **pos.__dict__,
                "unrealized_pnl": unrealized_pnl,
                "unrealized_pnl_pct": unrealized_pnl_pct,
                "current_price": current_price,
            }
        )

    return enriched


@router.post("/", response_model=schemas.Position, status_code=status.HTTP_201_CREATED)
async def create_position(
    position_in: schemas.PositionCreate, db: DBDep, current_user: CurrentUser
):
    if position_in.quantity <= 0:
        raise HTTPException(status_code=422, detail="Quantity must be positive")

    db_position = models.Position(**position_in.model_dump(), user_id=current_user.id)
    db.add(db_position)
    await db.commit()
    await db.refresh(db_position)
    return db_position


@router.delete("/{position_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_position(position_id: int, db: DBDep, current_user: CurrentUser):
    result = await db.execute(
        select(models.Position).where(
            models.Position.id == position_id,
            models.Position.user_id == current_user.id,
        )
    )
    db_position = result.scalar_one_or_none()
    if not db_position:
        raise HTTPException(status_code=404, detail="Position not found")

    await db.delete(db_position)
    await db.commit()
    return None
