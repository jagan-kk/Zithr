from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import api_keys, health, playlists, streaming


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="VinylCloud API",
    description="VinylCloud & Live Streamer — playlist management, CSV import, streaming proxy and API keys.",
    version="1.0.0",
    lifespan=lifespan,
)

api_router_prefix = "/api"
app.include_router(playlists.router, prefix=api_router_prefix)
app.include_router(api_keys.router, prefix=api_router_prefix)
app.include_router(streaming.router, prefix=api_router_prefix)
app.include_router(health.router, prefix=api_router_prefix)


@app.get("/", tags=["meta"])
async def root():
    return {"message": "VinylCloud & Live Streamer API is running"}


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)
