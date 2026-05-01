import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://postgres:postgres@localhost:5432/finsight"
)

# psycopg3 needs +psycopg_async for async driver
ASYNC_DATABASE_URL = (
    _DATABASE_URL
    .replace("postgresql+psycopg://", "postgresql+psycopg_async://")
    .replace("postgresql://", "postgresql+psycopg_async://")
)

engine = create_async_engine(ASYNC_DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
