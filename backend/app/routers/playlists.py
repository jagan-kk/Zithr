import csv
import io
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.core.database import fs_bucket, playlists_col
from app.models.playlist import Playlist
from app.models.track import Track
from app.services.csv_importer import fallback_track, parse_csv_rows

router = APIRouter(prefix="/playlists", tags=["playlists"])


@router.get("", response_model=List[Playlist])
async def get_playlists():
    playlists = await playlists_col.find({}, {"_id": 0}).to_list(100)
    return playlists


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
    """Upload one or more audio files into an existing playlist (stored in GridFS)."""
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
        grid_id = await fs_bucket.upload_from_stream(
            f.filename or "song",
            io.BytesIO(data),
            metadata={"content_type": content_type, "filename": f.filename or "song"},
        )
        stem = Path(f.filename or "Untitled").stem or "Untitled"
        tracks.append(
            Track(
                title=stem,
                artist=artist or "Unknown Artist",
                album="User Upload",
                duration="",
                resolved_source="User Upload (GridFS)",
                audio_url=f"/api/stream/file/{grid_id}",
                file_id=str(grid_id),
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


@router.delete("/{playlist_id}")
async def delete_playlist(playlist_id: str):
    res = await playlists_col.delete_one({"id": playlist_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return {"status": "success", "deleted_id": playlist_id}