import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import api_keys_col
from app.models.api_key import ApiKeyItem
from app.routers import api_keys, health, playlists, streaming
from app.services.object_storage import retry_pending_deletions


async def _seed_initial_key() -> None:
    """Bootstrap a first API key so a brand-new database is not locked out."""
    if not settings.init_api_key:
        return
    if await api_keys_col.count_documents({}) > 0:
        return
    key = ApiKeyItem(
        name="Default Web Embed Key",
        key=settings.init_api_key,
        created=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        requests=0,
        status="Active",
    )
    await api_keys_col.insert_one(key.model_dump())


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await _seed_initial_key()
    except Exception:
        pass

    cleanup_task = asyncio.create_task(_run_pending_cleanup())
    try:
        yield
    finally:
        cleanup_task.cancel()
        try:
            await cleanup_task
        except Exception:
            pass


async def _run_pending_cleanup() -> None:
    """Best-effort deferred B2 cleanup in the background; never blocks startup."""
    try:
        await retry_pending_deletions()
    except Exception:
        pass


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
