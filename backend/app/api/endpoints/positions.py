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
async def create_position(pos: schemas.PositionCreate, user: CurrentUser, db: DBDep):
    if pos.quantity <= 0:
        raise HTTPException(status_code=422, detail="Quantity must be positive")

    db_pos = models.Position(
        user_id=user.id,
        symbol=pos.symbol.upper(),
        quantity=pos.quantity,
        average_price=pos.average_price,
    )
    db.add(db_pos)
    await db.commit()
    await db.refresh(db_pos)
    return db_pos


@router.delete("/{pos_id}", status_code=204)
async def delete_position(pos_id: int, user: CurrentUser, db: DBDep):
    result = await db.execute(
        select(models.Position).where(models.Position.id == pos_id)
    )
    pos = result.scalar_one_or_none()
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found")
    if pos.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your position")
    await db.delete(pos)
    await db.commit()
