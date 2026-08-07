import uuid
from typing import List

from app.models.track import Track


SAMPLE_AUDIO_URLS = [
    "https://download.samplelib.com/mp3/sample-3s.mp3",
    "https://download.samplelib.com/mp3/sample-6s.mp3",
    "https://download.samplelib.com/mp3/sample-9s.mp3",
]


def resolve_audio_url(index: int) -> str:
    return SAMPLE_AUDIO_URLS[index % len(SAMPLE_AUDIO_URLS)]


def build_track_from_row(row, index: int) -> Track:
    title = row[0].strip() if len(row) > 0 else "Unknown Track"
    artist = row[1].strip() if len(row) > 1 else "Unknown Artist"
    album = row[2].strip() if len(row) > 2 else "CSV Import Album"
    uri = row[3].strip() if len(row) > 3 else f"spotify:track:{uuid.uuid4().hex[:12]}"

    return Track(
        title=title if title else "Untitled Track",
        artist=artist if artist else "Unknown Artist",
        album=album if album else "Imported Album",
        duration="3:15",
        spotify_uri=uri,
        resolved_source="Free Archive Resolver (100% Free)",
        audio_url=resolve_audio_url(index),
        file_size="3.8 MB",
        status="cached",
        bitrate="320kbps",
    )


def fallback_track() -> Track:
    return Track(
        title="Imported CSV Song 1",
        artist="Spotify Artist",
        album="CSV Playlist",
        duration="3:00",
        audio_url=SAMPLE_AUDIO_URLS[0],
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