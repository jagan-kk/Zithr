from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket

from app.core.config import settings

client: AsyncIOMotorClient = AsyncIOMotorClient(
    settings.mongo_url,
    serverSelectionTimeoutMS=settings.server_selection_timeout_ms,
)
db = client[settings.db_name]

playlists_col = db.playlists
api_keys_col = db.api_keys
fs_bucket = AsyncIOMotorGridFSBucket(db)
fs_files_col = db["fs.files"]


async def ping() -> bool:
    """Return True when MongoDB is reachable, False otherwise (no exceptions)."""
    try:
        await client.admin.command("ping")
        return True
    except Exception:
        return False