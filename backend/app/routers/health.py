from fastapi import APIRouter

from app.core.database import ping

router = APIRouter(tags=["health"])


@router.get("/status")
async def status():
    db_ok = await ping()
    return {
        "service": "vinylcloud-api",
        "status": "ok" if db_ok else "degraded",
        "db": "connected" if db_ok else "unreachable",
    }