import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
import httpx

from app.core.auth import require_api_key
from app.core.database import playlists_col
from app.services.archive_resolver import resolve as resolve_archive
from app.services.object_storage import file_size_and_type, open_audio, stream_audio

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stream", tags=["streaming"], dependencies=[Depends(require_api_key)])

PASS_THROUGH_HEADERS = {"content-range", "content-length", "accept-ranges", "content-type"}
CHUNK_SIZE = 256 * 1024

_proxy_client: httpx.AsyncClient | None = None


def _get_proxy_client() -> httpx.AsyncClient:
    """Return a lazily-initialised async httpx client for the proxy stream."""
    global _proxy_client
    if _proxy_client is None or _proxy_client.is_closed:
        _proxy_client = httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0), follow_redirects=True)
    return _proxy_client


async def close_proxy_client() -> None:
    global _proxy_client
    if _proxy_client is not None and not _proxy_client.is_closed:
        await _proxy_client.aclose()
        _proxy_client = None

# In-memory lazy-resolution cache: track_id -> audio_url ("" = negative).
_lazy_cache: dict = {}
_lazy_inflight: set = set()


async def find_track(track_id: str) -> tuple[dict | None, int | None, dict | None]:
    cursor = playlists_col.find({})
    async for playlist in cursor:
        tracks = playlist.get("tracks", [])
        for i, track in enumerate(tracks):
            if track.get("id") == track_id:
                return playlist, i, track
    return None, None, None


async def _lazy_resolve(playlist: dict, idx: int, track: dict) -> str:
    """Resolve a pending track to a real audio URL on demand, caching the result."""
    track_id = track.get("id")
    if track_id in _lazy_cache:
        return _lazy_cache[track_id] or ""

    while track_id in _lazy_inflight:
        await asyncio.sleep(0.2)
    if track_id in _lazy_cache:
        return _lazy_cache[track_id] or ""

    _lazy_inflight.add(track_id)
    try:
        result = await resolve_archive(track.get("title", ""), track.get("artist", ""))
    finally:
        _lazy_inflight.discard(track_id)

    url = result["audio_url"] if result else ""
    _lazy_cache[track_id] = url
    if url:
        track["audio_url"] = url
        track["resolved_source"] = result.get("resolved_source", "Internet Archive")
        if result.get("duration"):
            track["duration"] = result["duration"]
        track["status"] = "cached"
        await playlists_col.update_one(
            {"_id": playlist["_id"]},
            {"$set": {f"tracks.{idx}": track}},
        )
    return url


async def serve_uploaded_file(file_id: str, request: Request):
    """Serve a locally uploaded audio file (B2 or GridFS) with Range support."""
    if not file_id:
        raise HTTPException(status_code=404, detail="Invalid file id")

    try:
        total, content_type = await file_size_and_type(file_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except Exception:
        raise HTTPException(status_code=404, detail="File not found")

    start, end = 0, max(total - 1, 0)
    status_code = 200
    headers = {"content-type": content_type, "accept-ranges": "bytes"}

    range_header = request.headers.get("range")
    if range_header:
        try:
            spec = range_header.replace("bytes=", "").split("-")
            start = int(spec[0]) if spec[0] else 0
            end = int(spec[1]) if len(spec) > 1 and spec[1] else total - 1
            end = min(end, total - 1)
            start = min(start, end)
            status_code = 206
            headers["content-range"] = f"bytes {start}-{end}/{total}"
            headers["content-length"] = str(end - start + 1)
        except Exception:
            headers["content-length"] = str(total)
    else:
        headers["content-length"] = str(total)

    try:
        opened = await open_audio(file_id, start, end + 1)
    except Exception:
        raise HTTPException(status_code=404, detail="File not found")

    return StreamingResponse(
        stream_audio(opened),
        status_code=status_code,
        headers=headers,
    )


@router.get("/proxy/{track_id}")
async def stream_proxy(track_id: str, request: Request):
    playlist, idx, track = await find_track(track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    # User-uploaded songs are stored in B2 or GridFS.
    if track.get("file_id"):
        return await serve_uploaded_file(track["file_id"], request)

    audio_url = track.get("audio_url")
    if not audio_url:
        audio_url = await _lazy_resolve(playlist, idx, track)
    if not audio_url:
        raise HTTPException(status_code=404, detail="No audio source")

    forward_headers = {}
    if request.headers.get("range"):
        forward_headers["Range"] = request.headers["range"]

    try:
        cm = _get_proxy_client().stream("GET", audio_url, headers=forward_headers)
        upstream = await cm.__aenter__()
    except Exception as exc:
        logger.warning("upstream connect failed for %s: %s", audio_url, exc)
        raise HTTPException(status_code=502, detail="Upstream unavailable")

    if upstream.status_code not in (200, 206):
        try:
            await cm.__aexit__(None, None, None)
        except Exception:
            pass
        raise HTTPException(status_code=502, detail=f"Upstream returned {upstream.status_code}")

    response_headers = {
        k: v for k, v in upstream.headers.items() if k.lower() in PASS_THROUGH_HEADERS
    }
    if "content-type" not in response_headers:
        response_headers["content-type"] = "audio/mpeg"

    async def gen():
        try:
            async for chunk in upstream.aiter_bytes():
                yield chunk
        except Exception as exc:
            logger.warning("upstream stream dropped for %s: %s", audio_url, exc)
        finally:
            try:
                await cm.__aexit__(None, None, None)
            except Exception:
                pass

    return StreamingResponse(
        gen(),
        status_code=200,
        headers=response_headers,
        media_type=response_headers.get("content-type", "audio/mpeg"),
    )