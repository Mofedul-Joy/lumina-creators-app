"""Application settings, loaded from environment / .env."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- app ---
    app_name: str = "Lumina Creators API"
    version: str = "0.1.0"
    environment: str = "development"

    # --- database ---
    # e.g. postgresql+psycopg://user:pass@host:5432/dbname  (empty in local dev is OK)
    database_url: str = ""

    # --- auth ---
    jwt_secret: str = "dev-insecure-change-me"
    jwt_access_ttl_min: int = 15
    jwt_refresh_ttl_days: int = 7

    # --- object storage (Cloudflare R2 / S3-compatible) ---
    r2_endpoint: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = ""
    r2_public_base: str = ""  # optional public URL base for finalized objects
    upload_url_ttl_sec: int = 3600
    max_upload_bytes: int = 512 * 1024 * 1024  # 512 MB

    # --- local-dev storage fallback (used when R2 is not configured) ---
    # Files land on local disk and upload URLs point back at this API.
    api_public_url: str = "http://localhost:8000"
    local_storage_dir: str = ".tmp/storage"

    # --- CORS (comma-separated origins) ---
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
