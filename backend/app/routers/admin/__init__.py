"""Admin realm router. All routes here will depend on get_current_admin."""
from fastapi import APIRouter

from app.routers.admin.auth import router as auth_router
from app.routers.admin.campaigns import router as campaigns_router
from app.routers.admin.clients import router as clients_router
from app.routers.admin.creators import router as creators_router
from app.routers.admin.stats import router as stats_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(creators_router)
router.include_router(campaigns_router)
router.include_router(clients_router)
router.include_router(stats_router)

# submissions-verify, payouts, audit mount here as built.
