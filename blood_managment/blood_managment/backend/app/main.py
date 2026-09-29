
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import create_database_tables
from app import models  # noqa: F401
from app.routers import (
    admin,
    auth,
    donors,
    matching,
    requirements,
    responses,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.AUTO_CREATE_TABLES:
        await create_database_tables()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    debug=settings.DEBUG,
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://blood-donation-management-prince-8dae.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(donors.router, prefix=settings.API_V1_PREFIX)
app.include_router(requirements.router, prefix=settings.API_V1_PREFIX)
app.include_router(matching.router, prefix=settings.API_V1_PREFIX)
app.include_router(responses.router, prefix=settings.API_V1_PREFIX)
app.include_router(admin.router, prefix=settings.API_V1_PREFIX)


# Health check endpoint
@app.get("/health", tags=["health"])
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": settings.APP_NAME}
