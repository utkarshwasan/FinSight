from typing import Annotated, Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.auth import SECRET_KEY, ALGORITHM
from app import schemas, models
from sqlalchemy import select

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    token: Annotated[str, Depends(oauth2_scheme)]
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        token_data = schemas.TokenData(user_id=user_id)
    except JWTError:
        raise credentials_exception
    
    result = await db.execute(select(models.User).where(models.User.id == token_data.user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user

CurrentUser = Annotated[models.User, Depends(get_current_user)]
DBDep = Annotated[AsyncSession, Depends(get_db)]
