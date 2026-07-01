"""FastAPI application factory.

Router layout is AUDIENCE-FIRST because the audience is the security boundary:
  /api/creator/*  -> get_current_creator
  /api/admin/*    -> get_current_admin
  /api/client/*   -> get_current_client (read-only)
  /*              -> public (health only)
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.routers.admin import router as admin_router
from app.routers.client import router as client_router
from app.routers.creator import router as creator_router
from app.routers.public.health import router as health_router


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version=settings.version)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Consistent error shape: {"detail": "..."}
    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:  # pragma: no cover
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})

    # public (health only)
    app.include_router(health_router)
    # audience realms
    app.include_router(creator_router, prefix="/api/creator")
    app.include_router(admin_router, prefix="/api/admin")
    app.include_router(client_router, prefix="/api/client")

    return app


app = create_app()
