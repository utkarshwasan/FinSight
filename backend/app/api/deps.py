from typing import Annotated, Generator
import os
from datetime import datetime, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.auth import SECRET_KEY, ALGORITHM
from app import schemas, models
from sqlalchemy import select

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

DEMO_USER_ID = 1


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    token: Annotated[str, Depends(oauth2_scheme)],
) -> schemas.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = int(user_id_str)
    except (JWTError, ValueError):
        raise credentials_exception

    if os.getenv("DEMO_MODE") == "1" and user_id == DEMO_USER_ID:
        return schemas.User(
            id=DEMO_USER_ID,
            email="demo@finsight.ai",
            full_name="Demo User",
            is_active=True,
            created_at=datetime(2025, 1, 1, tzinfo=timezone.utc),
        )

    result = await db.execute(select(models.User).where(models.User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user


CurrentUser = Annotated[schemas.User, Depends(get_current_user)]
DBDep = Annotated[AsyncSession, Depends(get_db)]
