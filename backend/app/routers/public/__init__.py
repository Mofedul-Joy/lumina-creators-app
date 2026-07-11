"""Public (unauthenticated) realm router — health checks, the campaign-entry
funnel, the local-dev upload target, and the client-facing read-only
share report (Feature 6, BUILD_SPEC.md §3.7)."""
from fastapi import APIRouter

from app.routers.public.campaigns import router as campaigns_router
from app.routers.public.health import router as health_router
from app.routers.public.invites import router as invites_router
from app.routers.public.report import router as report_router
from app.routers.public.uploads_local import router as uploads_local_router

router = APIRouter()
router.include_router(health_router)
router.include_router(uploads_local_router)
router.include_router(campaigns_router, prefix="/api")
router.include_router(report_router, prefix="/api")
router.include_router(invites_router, prefix="/api")
