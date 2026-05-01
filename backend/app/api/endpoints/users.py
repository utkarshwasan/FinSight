from fastapi import APIRouter
from app.api.deps import CurrentUser
from app import schemas

router = APIRouter()


@router.get("/me", response_model=schemas.User)
async def get_me(user: CurrentUser):
    return user
