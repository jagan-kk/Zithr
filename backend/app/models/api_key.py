import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field


class ApiKeyItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    key: str
    created: str
    requests: int = 0
    status: str = "Active"