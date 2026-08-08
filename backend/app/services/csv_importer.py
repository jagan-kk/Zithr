import asyncio
import uuid
from typing import List

from app.models.track import Track
from app.services.archive_resolver import resolve


def build_track_from_row(row, index: int) -> Track:
    title = row[0].strip() if len(row) > 0 else "Unknown Track"
    artist = row[1].strip() if len(row) > 1 else "Unknown Artist"
    album = row[2].strip() if len(row) > 2 else "CSV Import Album"
    uri = row[3].strip() if len(row) > 3 else f"spotify:track:{uuid.uuid4().hex[:12]}"

    return Track(
        title=title if title else "Untitled Track",
        artist=artist if artist else "Unknown Artist",
        album=album if album else "Imported Album",
        spotify_uri=uri,
    )


def fallback_track() -> Track:
    return Track(
        title="Imported CSV Song 1",
        artist="Spotify Artist",
        album="CSV Playlist",
    )


def parse_csv_rows(rows: List[List[str]]) -> List[Track]:
    tracks: List[Track] = []
    header_skipped = False

    for row in rows:
        if not row or len(row) == 0:
            continue
        joined_row = " ".join(row).lower()
        if not header_skipped and any(
            token in joined_row for token in ("track", "name", "artist", "uri")
        ):
            header_skipped = True
            continue
        tracks.append(build_track_from_row(row, len(tracks)))

    return tracks


async def resolve_tracks(tracks: List[Track], concurrency: int = 10) -> List[Track]:
    """Resolve real Internet Archive audio URLs for every imported track."""
    sem = asyncio.Semaphore(concurrency)

    async def _one(track: Track) -> None:
        if not track.artist or track.artist == "Unknown Artist":
            track.status = "pending"
            return
        async with sem:
            result = await resolve(track.title, track.artist)
        if result:
            track.audio_url = result["audio_url"]
            track.resolved_source = result["resolved_source"]
            track.file_size = result["file_size"]
            track.duration = result["duration"]
            track.status = result["status"]
        else:
            track.status = "pending"

    await asyncio.gather(*(_one(t) for t in tracks))
    return tracks
