"""Object storage abstraction.

Uploaded audio lives in Backblaze B2 (S3-compatible) when configured, otherwise it
falls back to MongoDB GridFS. Every stored file is referenced by a ``file_id``:

- GridFS: the `str(ObjectId)` of the file.
- B2: ``"b2:<object key>"``.
"""

import asyncio
import io
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator, Optional

import boto3
from bson import ObjectId
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import settings
from app.core.database import fs_bucket, fs_files_col, pending_deletions_col

logger = logging.getLogger(__name__)

B2_ID_PREFIX = "b2:"
CHUNK_SIZE = 256 * 1024
B2_RETRY_BATCH_SIZE = 20
B2_DELETE_TIMEOUT = 30.0


class _B2Body:
    """Async wrapper around an already-ranged boto3 StreamingBody."""

    __slots__ = ("_body", "remaining")

    def __init__(self, body, remaining: int):
        self._body = body
        self.remaining = remaining

    async def read(self, size: int) -> bytes:
        return await asyncio.to_thread(self._body.read, size)

    async def close(self) -> None:
        await asyncio.to_thread(self._body.close)


class _GridFSFile:
    """Async wrapper around an already-seeked GridFS download stream."""

    __slots__ = ("_stream", "remaining")

    def __init__(self, stream, remaining: int):
        self._stream = stream
        self.remaining = remaining

    async def read(self, size: int) -> bytes:
        return await self._stream.read(size)

    async def close(self) -> None:
        pass

_s3_client = None


def _get_s3_client():
    """Return a lazily-created S3 client, or None when B2 is not configured."""
    if not settings.backblaze_configured:
        return None
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            "s3",
            endpoint_url=settings.backblaze_endpoint_url,
            region_name="us-east-1",
            aws_access_key_id=settings.backblaze_key_id,
            aws_secret_access_key=settings.backblaze_api_key,
        )
    return _s3_client


def is_b2_ref(file_id: Optional[str]) -> bool:
    return bool(file_id) and file_id.startswith(B2_ID_PREFIX)


async def _enqueue_deletion(file_id: str) -> None:
    """Best-effort persist a B2 key that still needs deleting for later retries."""
    try:
        await pending_deletions_col.update_one(
            {"file_id": file_id},
            {
                "$setOnInsert": {
                    "file_id": file_id,
                    "attempts": 0,
                    "created_at": datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )
    except Exception as exc:
        logger.warning("failed to enqueue deferred deletion for %s: %s", file_id, exc)


async def store_audio(filename: str, data: bytes, content_type: str) -> dict:
    """Persist audio bytes in B2 (preferred) or GridFS (fallback).

    Returns ``{"file_id": ..., "storage": "b2"|"gridfs", "resolved_source": ...}``.
    """
    client = _get_s3_client()
    if client is not None:
        key = _make_object_key(filename)
        try:
            await asyncio.to_thread(
                client.put_object,
                Bucket=settings.backblaze_bucket,
                Key=key,
                Body=data,
                ContentType=content_type,
            )
            return {
                "file_id": f"{B2_ID_PREFIX}{key}",
                "storage": "b2",
                "resolved_source": "Backblaze B2",
            }
        except (ClientError, BotoCoreError) as exc:
            logger.warning("Backblaze upload failed (%s); falling back to GridFS", exc)
            # put_object is ambiguous: the key may be stored server-side already,
            # so retain it and schedule a compensating cleanup.
            await _enqueue_deletion(f"{B2_ID_PREFIX}{key}")

    grid_id = await fs_bucket.upload_from_stream(
        filename or "song",
        io.BytesIO(data),
        metadata={"content_type": content_type, "filename": filename or "song"},
    )
    return {
        "file_id": str(grid_id),
        "storage": "gridfs",
        "resolved_source": "User Upload (GridFS)",
    }


async def file_size_and_type(file_id: str) -> tuple[int, str]:
    """Return ``(size_bytes, content_type)`` for a stored file."""
    if is_b2_ref(file_id):
        client = _get_s3_client()
        key = file_id[len(B2_ID_PREFIX):]
        resp = await asyncio.to_thread(
            client.head_object,
            Bucket=settings.backblaze_bucket,
            Key=key,
        )
        return (
            int(resp.get("ContentLength", 0)),
            resp.get("ContentType") or "audio/mpeg",
        )

    meta = await fs_files_col.find_one({"_id": ObjectId(file_id)})
    if not meta:
        raise FileNotFoundError(file_id)
    return meta.get("length", 0), meta.get("metadata", {}).get("content_type") or "audio/mpeg"


async def open_audio(file_id: str, start: int, end_excl: int):
    """Open and validate stored audio for byte range ``[start, end_excl)``.

    Returns a wrapper exposing async ``read(size)``/``close()`` that is already
    positioned at ``start``, or raises ``FileNotFoundError`` when the object
    cannot be opened.
    """
    remaining = max(end_excl - start, 0)
    if is_b2_ref(file_id):
        client = _get_s3_client()
        if client is None:
            raise FileNotFoundError(file_id)
        key = file_id[len(B2_ID_PREFIX):]
        try:
            resp = await asyncio.to_thread(
                client.get_object,
                Bucket=settings.backblaze_bucket,
                Key=key,
                Range=f"bytes={start}-{end_excl - 1}",
            )
        except (ClientError, BotoCoreError) as exc:
            logger.warning("Backblaze open failed for %s: %s", file_id, exc)
            raise FileNotFoundError(file_id) from exc
        return _B2Body(resp["Body"], remaining)

    try:
        grid_files = await fs_bucket.open_download_stream(ObjectId(file_id))
    except Exception as exc:
        logger.warning("GridFS open failed for %s: %s", file_id, exc)
        raise FileNotFoundError(file_id) from exc
    grid_files.seek(start)
    return _GridFSFile(grid_files, remaining)


async def stream_audio(opened) -> Iterator[bytes]:
    """Yield the byte range of a file already opened by ``open_audio``."""
    try:
        while opened.remaining > 0:
            chunk = await opened.read(min(CHUNK_SIZE, opened.remaining))
            if not chunk:
                break
            opened.remaining -= len(chunk)
            yield chunk
    finally:
        await opened.close()


async def delete_audio(file_id: str) -> None:
    """Remove the stored object/file (best-effort).

    B2 deletion failures are persisted so ``retry_pending_deletions`` can retry;
    a missing object (404) is treated as already cleaned up.
    """
    try:
        if is_b2_ref(file_id):
            client = _get_s3_client()
            if client is None:
                await _enqueue_deletion(file_id)
                return
            key = file_id[len(B2_ID_PREFIX):]
            try:
                await asyncio.to_thread(
                    client.delete_object,
                    Bucket=settings.backblaze_bucket,
                    Key=key,
                )
            except ClientError as exc:
                if exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode") == 404:
                    logger.debug("B2 object %s already gone", file_id)
                else:
                    await _enqueue_deletion(file_id)
            except BotoCoreError as exc:
                logger.debug("B2 delete failed for %s: %s", file_id, exc)
                await _enqueue_deletion(file_id)
        elif ObjectId.is_valid(file_id):
            await fs_bucket.delete(ObjectId(file_id))
    except Exception as exc:
        logger.warning("delete_audio failed for %s: %s", file_id, exc)


async def retry_pending_deletions(batch_size: int = B2_RETRY_BATCH_SIZE) -> None:
    """Best-effort cleanup of deferred B2 deletions recorded in Mongo.

    Processes only a bounded batch per call, timing out each delete operation;
    successes are removed, failures stay queued for the next pass.
    """
    client = _get_s3_client()
    if client is None:
        return
    cursor = pending_deletions_col.find({}).limit(batch_size)
    async for doc in cursor:
        file_id = doc.get("file_id")
        if not file_id:
            continue
        key = file_id[len(B2_ID_PREFIX):] if is_b2_ref(file_id) else file_id
        try:
            await asyncio.wait_for(
                asyncio.to_thread(
                    client.delete_object,
                    Bucket=settings.backblaze_bucket,
                    Key=key,
                ),
                timeout=B2_DELETE_TIMEOUT,
            )
        except asyncio.TimeoutError:
            logger.warning("retry pending delete timed out for %s", file_id)
            continue
        except ClientError as exc:
            if exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode") != 404:
                logger.warning("retry pending delete failed for %s: %s", file_id, exc)
                continue
        except BotoCoreError as exc:
            logger.warning("retry pending delete failed for %s: %s", file_id, exc)
            continue
        await pending_deletions_col.delete_one({"_id": doc["_id"]})


def _make_object_key(filename: str) -> str:
    ext = Path(filename or "song").suffix or ".mp3"
    return f"uploads/{uuid.uuid4().hex}{ext}"