import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Form

from app.core.database import api_keys_col
from app.models.api_key import ApiKeyItem

router = APIRouter(prefix="/api-keys", tags=["api-keys"])


def _generate_key() -> str:
    return f"vcs_live_{uuid.uuid4().hex[:18]}"


@router.get("", response_model=List[ApiKeyItem])
async def get_api_keys():
    keys = await api_keys_col.find({}, {"_id": 0}).to_list(100)
    if not keys:
        default_key = ApiKeyItem(
            name="Default Web Embed Key",
            key=_generate_key(),
            created=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            requests=1420,
            status="Active",
        )
        await api_keys_col.insert_one(default_key.model_dump())
        keys = [default_key.model_dump()]
    return keys


@router.post("", response_model=ApiKeyItem)
async def create_api_key(name: str = Form("New Project Key")):
    new_key = ApiKeyItem(
        name=name,
        key=_generate_key(),
        created=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        requests=0,
        status="Active",
    )
    await api_keys_col.insert_one(new_key.model_dump())
    return new_key