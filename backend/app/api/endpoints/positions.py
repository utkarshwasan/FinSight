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
    
    # In a real app, we would fetch current prices here to compute P&L
    # For now, return basic data; the frontend will compute live P&L via WS
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
