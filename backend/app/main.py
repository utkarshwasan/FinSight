from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import auth, users, watchlist, positions, quotes, news, ws, query, forecast, audit

app = FastAPI(
    title="FinSight AI",
    description="Real-Time Financial Insights Dashboard — Nebula9.ai Assessment. **Educational use only.**",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
