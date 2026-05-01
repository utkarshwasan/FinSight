from fastapi import APIRouter, Depends
from sqlalchemy import select, desc
from typing import List
from app.api.deps import CurrentUser, DBDep
from app import models, schemas

router = APIRouter()

@router.get("/", response_model=List[schemas.AuditEvent])
async def get_audit_logs(
    db: DBDep,
    current_user: CurrentUser,
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
