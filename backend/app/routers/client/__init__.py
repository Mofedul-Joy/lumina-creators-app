"""Client (brand) realm router — READ-ONLY. All routes depend on get_current_client
and are scoped to campaigns.client_id. This router must never expose a mutation."""
from fastapi import APIRouter

from app.routers.client.auth import router as auth_router

router = APIRouter()
router.include_router(auth_router)

# Read-only dashboard sub-routers (stats, submissions) mount here (milestone 10).
