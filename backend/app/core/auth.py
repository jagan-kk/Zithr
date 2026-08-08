import asyncio
import hmac
from typing import Optional

from fastapi import Header, HTTPException, Query, status

from app.core.database import api_keys_col


def _safe_eq(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


async def require_api_key(
    x_api_key: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
    key: Optional[str] = Query(default=None),
) -> dict:
    """Require a valid API key, accepted as X-Api-Key header, Bearer token, or ?key= param.

    The query-param form lets a plain <audio src="...?key=..."> element work without headers.
    """
    candidate: Optional[str] = None
    if x_api_key:
        candidate = x_api_key.strip()
    elif authorization:
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() == "bearer" and token:
            candidate = token.strip()
    elif key:
        candidate = key.strip()

    if not candidate:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing API key")

    doc = await api_keys_col.find_one({"key": candidate})
    if not doc or not _safe_eq(doc.get("key", ""), candidate) or doc.get("status", "Active") != "Active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing API key")

    async def _increment_requests() -> None:
        try:
            await api_keys_col.update_one({"_id": doc["_id"]}, {"$inc": {"requests": 1}})
        except Exception:
            pass

    asyncio.create_task(_increment_requests())
    return doc