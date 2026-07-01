"""Public health checks — the ONLY public routes (closed marketplace)."""
from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import get_engine

router = APIRouter(tags=["public"])


@router.get("/health")
def health() -> dict:
    s = get_settings()
    return {"status": "ok", "service": s.app_name, "version": s.version, "environment": s.environment}


@router.get("/health/db")
def health_db() -> dict:
    """Verifies DB connectivity. Returns 200 with status 'unconfigured' if no DB set yet."""
    if not get_settings().database_url:
        return {"status": "unconfigured", "detail": "DATABASE_URL not set"}
    try:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception as exc:  # pragma: no cover - surfaced to caller
        return {"status": "error", "detail": str(exc)}
