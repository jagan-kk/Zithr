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
    storage: str = "gridfs"
    resolved_source: str = "Internet Archive"
    audio_url: str = ""
    file_size: str = ""
    status: str = "pending"
    bitrate: str = ""