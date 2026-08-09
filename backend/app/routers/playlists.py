import csv
import io
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.core.auth import require_api_key
from app.core.database import playlists_col
from app.models.playlist import Playlist
from app.models.track import Track
from app.services.csv_importer import fallback_track, parse_csv_rows
from app.services.object_storage import delete_audio, store_audio

router = APIRouter(prefix="/playlists", tags=["playlists"], dependencies=[Depends(require_api_key)])


class TrackDeleteRequest(BaseModel):
    track_ids: List[str]


class CreatePlaylistRequest(BaseModel):
    name: str


class ReorderRequest(BaseModel):
    ids: List[str]


async def _next_position() -> int:
    count = await playlists_col.count_documents({})
    return count


@router.get("", response_model=List[Playlist])
async def get_playlists():
    playlists = await playlists_col.find({}, {"_id": 0}).to_list(200)
    playlists.sort(
        key=lambda p: (
            p.get("position") if isinstance(p.get("position"), int) else 10**9,
            p.get("created_at", ""),
        )
    )
    return playlists


@router.post("/reorder")
async def reorder_playlists(req: ReorderRequest):
    """Persist a full playlist ordering (id at index i becomes position i)."""
    if not req.ids:
        return {"status": "ok", "reordered": 0}
    for i, playlist_id in enumerate(req.ids):
        await playlists_col.update_one(
            {"id": playlist_id},
            {"$set": {"position": i}},
        )
    return {"status": "ok", "reordered": len(req.ids)}


@router.get("/{playlist_id}", response_model=Playlist)
async def get_playlist(playlist_id: str):
    playlist = await playlists_col.find_one({"id": playlist_id}, {"_id": 0})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return playlist


@router.post("", response_model=Playlist)
async def create_playlist(req: CreatePlaylistRequest):
    """Create an empty playlist to upload songs into."""
    title = req.name.strip() or "New Playlist"
    new_playlist = Playlist(
        title=title, source="manual", track_count=0, position=await _next_position(), tracks=[]
    )
    await playlists_col.insert_one(new_playlist.model_dump())
    return new_playlist


@router.post("/upload-csv", response_model=Playlist)
async def upload_csv(
    file: UploadFile = File(...),
    playlist_name: Optional[str] = Form("Imported Spotify Playlist"),
):
    content = await file.read()
    decoded = content.decode("utf-8", errors="ignore")
    rows = list(csv.reader(io.StringIO(decoded)))

    tracks = parse_csv_rows(rows)
    if not tracks:
        tracks.append(fallback_track())

    new_playlist = Playlist(
        title=playlist_name if playlist_name else file.filename.replace(".csv", ""),
        source="spotify_csv_import",
        track_count=len(tracks),
        position=await _next_position(),
        tracks=tracks,
    )

    await playlists_col.insert_one(new_playlist.model_dump())
    return new_playlist


@router.post("/{playlist_id}/tracks/upload", response_model=Playlist)
async def upload_track_files(
    playlist_id: str,
    files: List[UploadFile] = File(...),
    artist: Optional[str] = Form(None),
):
    """Upload one or more audio files into an existing playlist (B2 or GridFS)."""
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    playlist = await playlists_col.find_one({"id": playlist_id})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    tracks = []
    for f in files:
        data = await f.read()
        if not data:
            continue
        content_type = f.content_type or "audio/mpeg"
        stored = await store_audio(f.filename or "song", data, content_type)
        stem = Path(f.filename or "Untitled").stem or "Untitled"
        tracks.append(
            Track(
                title=stem,
                artist=artist or "Unknown Artist",
                album="User Upload",
                duration="",
                resolved_source=stored["resolved_source"],
                audio_url=f"/api/stream/file/{stored['file_id']}",
                file_id=stored["file_id"],
                storage=stored["storage"],
                file_size=f"{len(data) / 1048576:.1f} MB",
                status="cached",
                bitrate="128kbps",
            )
        )

    await playlists_col.update_one(
        {"id": playlist_id},
        {
            "$push": {"tracks": {"$each": [t.model_dump() for t in tracks]}},
            "$inc": {"track_count": len(tracks)},
        },
    )

    updated = await playlists_col.find_one({"id": playlist_id}, {"_id": 0})
    return Playlist.model_validate(updated)


@router.delete("/tracks")
async def delete_tracks(payload: TrackDeleteRequest):
    """Remove tracks (across all playlists) and free their object storage."""
    ids = set(payload.track_ids)
    if not ids:
        return {"deleted": 0}

    deleted = 0
    cursor = playlists_col.find({})
    async for playlist in cursor:
        remaining = []
        changed = False
        for t in playlist.get("tracks", []):
            if t.get("id") in ids:
                deleted += 1
                changed = True
                file_id = t.get("file_id")
                if file_id:
                    await delete_audio(file_id)
            else:
                remaining.append(t)
        if changed:
            await playlists_col.update_one(
                {"_id": playlist["_id"]},
                {"$set": {"tracks": remaining, "track_count": len(remaining)}},
            )
    return {"deleted": deleted}


@router.delete("/{playlist_id}")
async def delete_playlist(playlist_id: str):
    playlist = await playlists_col.find_one({"id": playlist_id})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    for t in playlist.get("tracks", []):
        file_id = t.get("file_id")
        if file_id:
            await delete_audio(file_id)

    await playlists_col.delete_one({"_id": playlist["_id"]})
    return {"status": "success", "deleted_id": playlist_id}