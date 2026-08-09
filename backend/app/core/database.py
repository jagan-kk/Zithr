from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket

from app.core.config import settings

_client = None
_db = None
_cache: dict = {}


def _ensure_init():
    global _client, _db
    if _client is None:
        _client = AsyncIOMotorClient(
            settings.mongo_url,
            serverSelectionTimeoutMS=settings.server_selection_timeout_ms,
        )
        _db = _client[settings.db_name]


def __getattr__(name: str):
    _LAZY = frozenset({
        "client",
        "db",
        "playlists_col",
        "api_keys_col",
        "pending_deletions_col",
        "fs_bucket",
        "fs_files_col",
    })
    if name in _LAZY:
        _ensure_init()
        if name not in _cache:
            if name == "client":
                _cache[name] = _client
            elif name == "db":
                _cache[name] = _db
            elif name == "playlists_col":
                _cache[name] = _db.playlists
            elif name == "api_keys_col":
                _cache[name] = _db.api_keys
            elif name == "pending_deletions_col":
                _cache[name] = _db.pending_deletions
            elif name == "fs_bucket":
                _cache[name] = AsyncIOMotorGridFSBucket(_db)
            elif name == "fs_files_col":
                _cache[name] = _db["fs.files"]
        return _cache[name]
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


async def ping() -> bool:
    """Return True when MongoDB is reachable, False otherwise (no exceptions)."""
    _ensure_init()
    try:
        await _client.admin.command("ping")
        return True
    except Exception:
        return False
