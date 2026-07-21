"""Application settings, loaded from environment / .env."""
from decimal import Decimal
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
    # Access is short-ish but auto-refreshed by the client; refresh is long so a
    # user who returns to the browser stays signed in. Refresh rotates on every
    # use, so an active user is effectively logged in indefinitely.
    jwt_access_ttl_min: int = 60
    jwt_refresh_ttl_days: int = 60
    google_client_id: str = ""
    google_client_secret: str = ""

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

    # When true, browser uploads go THROUGH this API (which streams them to R2)
    # instead of directly to R2. Avoids needing an R2 bucket CORS policy — the
    # browser only ever talks to this API, which already allows the app origin.
    upload_proxy: bool = False

    # --- email for verification codes ---
    # Prefer an HTTP provider (Resend) — cloud hosts like Render block outbound SMTP.
    resend_api_key: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    email_from: str = ""  # defaults to smtp_user if empty
    # When email can't be delivered, gate the whole verification step off so signup
    # still works. Flip on once a working email provider is configured.
    require_email_verification: bool = True

    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_host and self.smtp_user and self.smtp_password)

    @property
    def email_configured(self) -> bool:
        return bool(self.resend_api_key) or self.smtp_configured

    # --- Apify scraping (view/like/comment counts on submitted posts) ---
    apify_api_token: str = ""
    apify_poll_interval_sec: int = 5
    apify_run_timeout_sec: int = 600
    # How often the worker re-enqueues a fresh scrape for already-scraped, still-live
    # submissions so view counts keep climbing after the initial scrape.
    scrape_refresh_interval_hours: int = 24

    @property
    def apify_configured(self) -> bool:
        return bool(self.apify_api_token)

    # --- Stock images (auto campaign banner when the admin doesn't upload one) ---
    # Pexels: free, high-quality, generous limits (200 req/hr, 20k/mo), no
    # attribution required. Leave blank to disable auto-fetch — campaigns then
    # fall back to the client-side niche/gradient thumbnail.
    pexels_api_key: str = ""

    @property
    def stock_images_configured(self) -> bool:
        return bool(self.pexels_api_key)

    # --- Payouts ---
    # Minimum accumulated (verified, unpaid) earnings a creator must reach before
    # they can request a payout. Admin-overridable via env.
    # Rhys 2026-07-21: platform-wide minimum payout dropped from $25 to $5.
    min_payout_amount: Decimal = Decimal("5")

    # --- frontend base URL (for building absolute links, e.g. client share pages) ---
    frontend_url: str = "https://lumina-creators-app.vercel.app"

    # --- CORS (comma-separated origins) ---
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() not in ("development", "dev", "test", "local")

    @property
    def r2_configured(self) -> bool:
        return bool(self.r2_endpoint and self.r2_access_key_id and self.r2_secret_access_key)

    _INSECURE_SECRETS = {"", "dev-insecure-change-me", "change-me", "secret"}

    def validate_for_runtime(self) -> None:
        """Fail fast on misconfiguration that is dangerous in production.

        Called once at app startup. In dev these are warnings-by-omission; in
        prod they are hard errors so we never boot with a forgeable JWT secret
        or an accidental ephemeral-disk upload store.
        """
        if not self.is_production:
            return
        problems: list[str] = []
        if self.jwt_secret in self._INSECURE_SECRETS or len(self.jwt_secret) < 32:
            problems.append("JWT_SECRET must be set to a strong random value (>=32 chars) in production")
        if not self.database_url:
            problems.append("DATABASE_URL must be set in production")
        if not self.r2_configured:
            problems.append("R2 storage must be configured in production (local-disk fallback is dev-only)")
        if problems:
            raise RuntimeError("Invalid production configuration:\n  - " + "\n  - ".join(problems))


@lru_cache
def get_settings() -> Settings:
    return Settings()
