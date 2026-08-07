import uuid
from datetime import datetime, timezone
from typing import List

from pydantic import BaseModel, ConfigDict, Field

from app.models.track import Track


class Playlist(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    source: str = "spotify_csv_import"
    track_count: int
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    tracks: List[Track] = []