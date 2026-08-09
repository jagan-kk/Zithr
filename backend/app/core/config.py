from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(ROOT_DIR / ".env"), extra="ignore")

    mongo_url: str = Field(alias="MONGO_URL")
    db_name: str = Field(alias="DB_NAME")
    cors_origins: str = "*"
    server_selection_timeout_ms: int = 10000
    init_api_key: str | None = Field(default=None, alias="INIT_API_KEY")

    backblaze_key_id: str | None = Field(default=None, alias="BACKBLAZE_KEY_ID")
    backblaze_api_key: str | None = Field(default=None, alias="BACKBLAZE_API_KEY")
    backblaze_bucket: str | None = Field(default=None, alias="BACKBLAZE_BUCKET")
    backblaze_endpoint: str | None = Field(default=None, alias="BACKBLAZE_ENDPOINT")

    @property
    def backblaze_configured(self) -> bool:
        return bool(
            self.backblaze_key_id
            and self.backblaze_api_key
            and self.backblaze_bucket
            and self.backblaze_endpoint_url
        )

    @property
    def backblaze_endpoint_url(self) -> str | None:
        endpoint = (self.backblaze_endpoint or "").strip()
        if not endpoint.startswith("https://"):
            return None
        return endpoint.rstrip("/")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
