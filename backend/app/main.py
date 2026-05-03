import asyncio
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import (
    auth,
    users,
    watchlist,
    positions,
    quotes,
    news,
    ws,
    query,
    forecast,
    audit,
)
from app.services.quote_poller import poll_loop
from app.scripts.seed_demo import seed_demo_user


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Apply migrations (or rely on alembic upgrade head pre-deploy)
    # 2. Seed demo user if missing (idempotent)
    if os.getenv("SEED_DEMO_USER", "1") == "1":
        try:
            await seed_demo_user()
        except Exception as e:
            print(f"[seed] failed (non-fatal): {e}")
    # 3. Start poller (NEW-3)
    seed_symbols = ["AAPL", "NVDA", "TSLA", "MSFT", "GOOGL"]
    poller_task = asyncio.create_task(poll_loop(seed_symbols))
    try:
        yield
    finally:
        poller_task.cancel()
        try:
            await poller_task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    lifespan=lifespan,
    title="FinSight AI",
    description="Real-Time Financial Insights Dashboard. **Educational use only.**",
    version="1.0.0",
)

ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000"
    ).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "message": str(exc)},
    )


# Routes
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(watchlist.router, prefix="/watchlist", tags=["watchlist"])
app.include_router(positions.router, prefix="/positions", tags=["positions"])
app.include_router(quotes.router, prefix="/quotes", tags=["quotes"])
app.include_router(news.router, prefix="/news", tags=["news"])
app.include_router(query.router, prefix="/query", tags=["query"])
app.include_router(forecast.router, prefix="/forecast", tags=["forecast"])
app.include_router(audit.router, prefix="/audit", tags=["audit"])
app.include_router(ws.router, tags=["websocket"])


@app.get("/healthz", tags=["health"])
async def healthz():
    return {"status": "ok"}
