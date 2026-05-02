import os
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from app.api.deps import DBDep
from app import schemas, models, auth
from sqlalchemy import select

router = APIRouter()

DEMO_EMAIL = "demo@finsight.ai"
DEMO_PASSWORD = "Demo@12345"
DEMO_USER_ID = 1


@router.post("/register", response_model=schemas.User)
async def register(user_in: schemas.UserCreate, db: DBDep):
    result = await db.execute(
        select(models.User).where(models.User.email == user_in.email)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    db_user = models.User(
        email=user_in.email,
        hashed_password=auth.get_password_hash(user_in.password),
        full_name=user_in.full_name,
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user


@router.post("/login", response_model=schemas.Token)
async def login(
    db: DBDep,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
):
    if os.getenv("DEMO_MODE") == "1":
        if (
            form_data.username == DEMO_EMAIL
            and form_data.password == DEMO_PASSWORD
        ):
            token = auth.create_access_token(
                data={"sub": str(DEMO_USER_ID), "email": DEMO_EMAIL}
            )
            return {"access_token": token, "token_type": "bearer"}
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    result = await db.execute(
        select(models.User).where(models.User.email == form_data.username)
    )
    user = result.scalar_one_or_none()

    if not user or not auth.verify_password(
        form_data.password, user.hashed_password or ""
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    access_token = auth.create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}
