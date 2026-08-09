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
from pathlib import Path
from typing import Optional

import boto3
from bson import ObjectId
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import settings
from app.core.database import fs_bucket, fs_files_col

logger = logging.getLogger(__name__)

B2_ID_PREFIX = "b2:"
CHUNK_SIZE = 256 * 1024

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


async def store_audio(filename: str, data: bytes, content_type: str) -> dict:
    """Persist audio bytes in B2 (preferred) or GridFS (fallback).

    Returns ``{"file_id": ..., "storage": "b2"|"gridfs", "resolved_source": ...}``.
    """
    client = _get_s3_client()
    if client is not None:
        try:
            key = _make_object_key(filename)
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
    return meta.get("length", 0), meta.get("content_type") or "audio/mpeg"


async def stream_audio(file_id: str, start: int, end_excl: int):
    """Yield bytes of ``file_id`` in the range ``[start, end_excl)``."""
    if is_b2_ref(file_id):
        client = _get_s3_client()
        key = file_id[len(B2_ID_PREFIX):]
        resp = await asyncio.to_thread(
            client.get_object,
            Bucket=settings.backblaze_bucket,
            Key=key,
            Range=f"bytes={start}-{end_excl - 1}",
        )
        body = resp["Body"]
        try:
            remaining = end_excl - start
            while remaining > 0:
                chunk = await asyncio.to_thread(body.read, min(CHUNK_SIZE, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk
        finally:
            await asyncio.to_thread(body.close)
        return

    grid_files = await fs_bucket.open_download_stream(ObjectId(file_id))
    grid_files.seek(start)
    remaining = end_excl - start
    while remaining > 0:
        chunk = await grid_files.read(min(CHUNK_SIZE, remaining))
        if not chunk:
            break
        remaining -= len(chunk)
        yield chunk


async def delete_audio(file_id: str) -> None:
    """Remove the stored object/file, ignoring errors (best-effort)."""
    try:
        if is_b2_ref(file_id):
            client = _get_s3_client()
            if client is None:
                return
            key = file_id[len(B2_ID_PREFIX):]
            await asyncio.to_thread(
                client.delete_object,
                Bucket=settings.backblaze_bucket,
                Key=key,
            )
        elif ObjectId.is_valid(file_id):
            await fs_bucket.delete(ObjectId(file_id))
    except Exception as exc:
        logger.debug("delete_audio failed for %s: %s", file_id, exc)


def _make_object_key(filename: str) -> str:
    ext = Path(filename or "song").suffix or ".mp3"
    return f"uploads/{uuid.uuid4().hex}{ext}"