"""Client (brand) realm router — READ-ONLY. All routes depend on get_current_client
and are scoped to campaigns.client_id. This router must never expose a mutation."""
from fastapi import APIRouter

from app.routers.client.auth import router as auth_router
from app.routers.client.campaigns import router as campaigns_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(campaigns_router)
