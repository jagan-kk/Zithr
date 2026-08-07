import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class Track(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    artist: str
    album: str = "Unknown Album"
    duration: str = "3:00"
    spotify_uri: Optional[str] = None
    file_id: Optional[str] = None
    resolved_source: str = "Free Archive Audio"
    audio_url: str = "https://download.samplelib.com/mp3/sample-3s.mp3"
    file_size: str = "3.5 MB"
    status: str = "cached"
    bitrate: str = "320kbps"