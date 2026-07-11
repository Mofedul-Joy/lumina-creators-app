"""Creator realm router. All routes here will depend on get_current_creator."""
from fastapi import APIRouter

from app.routers.creator.auth import router as auth_router
from app.routers.creator.campaigns import router as campaigns_router
from app.routers.creator.me import router as me_router
from app.routers.creator.notifications import router as notifications_router
from app.routers.creator.profile import router as profile_router
from app.routers.creator.submissions import router as submissions_router
from app.routers.creator.uploads import router as uploads_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(profile_router)
router.include_router(uploads_router)
router.include_router(campaigns_router)
router.include_router(submissions_router)
router.include_router(me_router)  # /me/gamification (Feature 7)
router.include_router(notifications_router)

# earnings sub-router mounts here as built.
