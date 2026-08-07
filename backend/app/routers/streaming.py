from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
import httpx

from app.core.database import fs_bucket, fs_files_col, playlists_col

router = APIRouter(prefix="/stream", tags=["streaming"])

PASS_THROUGH_HEADERS = {"content-range", "content-length", "accept-ranges", "content-type"}
CHUNK_SIZE = 256 * 1024

# Long-lived client: stays open while the response body is being consumed,
# so the stream isn't truncated when the request would otherwise close.
_client = httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0), follow_redirects=True)


async def find_track(track_id: str) -> dict | None:
    cursor = playlists_col.find({}, {"_id": 0, "tracks": 1})
    async for playlist in cursor:
        for track in playlist.get("tracks", []):
            if track.get("id") == track_id:
                return track
    return None


async def grid_stream(file_obj: ObjectId, start: int, end_excl: int):
    """Yield bytes from a user-uploaded file stored in GridFS."""
    grid_in = await fs_bucket.open_download_stream(file_obj)
    grid_in.seek(start)
    remaining = end_excl - start
    while remaining > 0:
        chunk = await grid_in.read(min(CHUNK_SIZE, remaining))
        if not chunk:
            break
        remaining -= len(chunk)
        yield chunk


async def remote_stream(request) -> None:
    """Yield upstream remote audio bytes while keeping the client connection open."""
    async with _client.stream("GET", request.url, headers=request.headers) as upstream:
        async for chunk in upstream.aiter_bytes():
            yield chunk


@router.get("/file/{file_id}")
async def serve_uploaded_file(file_id: str, request: Request):
    """Serve a locally uploaded audio file with Range support."""
    if not ObjectId.is_valid(file_id):
        raise HTTPException(status_code=404, detail="Invalid file id")

    meta = await fs_files_col.find_one({"_id": ObjectId(file_id)})
    if not meta:
        raise HTTPException(status_code=404, detail="File not found")

    total = meta.get("length", 0)
    content_type = meta.get("content_type") or "audio/mpeg"
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

    return StreamingResponse(
        grid_stream(ObjectId(file_id), start, end + 1),
        status_code=status_code,
        headers=headers,
    )


@router.get("/proxy/{track_id}")
async def stream_proxy(track_id: str, request: Request):
    track = await find_track(track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    # User-uploaded songs are stored in GridFS.
    if track.get("file_id"):
        return await serve_uploaded_file(track["file_id"], request)

    audio_url = track.get("audio_url")
    if not audio_url:
        raise HTTPException(status_code=404, detail="No audio source")

    forward_headers = {}
    if request.headers.get("range"):
        forward_headers["Range"] = request.headers["range"]

    stream_req = _client.build_request("GET", audio_url, headers=forward_headers)

    head = await _client.send(_client.build_request("HEAD", audio_url))
    if head.status_code in (404, 403):
        raise HTTPException(status_code=404, detail="Audio source unavailable")

    response_headers = {
        k: v for k, v in head.headers.items() if k.lower() in PASS_THROUGH_HEADERS
    }

    return StreamingResponse(
        remote_stream(stream_req),
        status_code=200,
        headers=response_headers,
        media_type=response_headers.get("content-type", "audio/mpeg"),
    )