"""Seed local-dev admin and client accounts (idempotent).

Usage:  .venv/bin/python scripts/seed_dev.py
Prints the dev credentials it ensures exist. Safe to re-run.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.session import get_engine
from app.models.identity import Admin, Client, Creator

ADMIN_EMAIL = "admin@lumina.dev"
ADMIN_PASSWORD = "admin12345"
CLIENT_EMAIL = "client@lumina.dev"
CLIENT_PASSWORD = "client12345"
CREATOR_EMAIL = "creator@lumina.dev"
CREATOR_PASSWORD = "creator12345"


def main() -> None:
    # Guard: never reset known-weak dev passwords against a production database.
    from app.core.config import get_settings

    if get_settings().is_production and "--force-dev-seed" not in sys.argv:
        raise SystemExit(
            "Refusing to seed dev accounts: ENVIRONMENT is not development. "
            "Pass --force-dev-seed to override (do NOT do this on a real database)."
        )
    db = Session(get_engine())
    try:
        admin = db.execute(select(Admin).where(Admin.email == ADMIN_EMAIL)).scalar_one_or_none()
        if admin is None:
            db.add(Admin(email=ADMIN_EMAIL, password_hash=hash_password(ADMIN_PASSWORD)))
            print(f"created admin  {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
        else:
            admin.password_hash = hash_password(ADMIN_PASSWORD)
            print(f"admin exists   {ADMIN_EMAIL} (password reset to dev default)")

        client = db.execute(select(Client).where(Client.email == CLIENT_EMAIL)).scalar_one_or_none()
        if client is None:
            db.add(
                Client(
                    email=CLIENT_EMAIL,
                    password_hash=hash_password(CLIENT_PASSWORD),
                    name="Lumina Demo Brand",
                )
            )
            print(f"created client {CLIENT_EMAIL} / {CLIENT_PASSWORD}")
        else:
            client.password_hash = hash_password(CLIENT_PASSWORD)
            print(f"client exists  {CLIENT_EMAIL} (password reset to dev default)")

        creator = db.execute(select(Creator).where(Creator.email == CREATOR_EMAIL)).scalar_one_or_none()
        if creator is None:
            db.add(
                Creator(
                    email=CREATOR_EMAIL,
                    password_hash=hash_password(CREATOR_PASSWORD),
                    status="active",
                    signup_source="seed",
                    email_verified=True,
                )
            )
            print(f"created creator {CREATOR_EMAIL} / {CREATOR_PASSWORD}")
        else:
            creator.password_hash = hash_password(CREATOR_PASSWORD)
            creator.email_verified = True
            creator.status = "active"
            print(f"creator exists {CREATOR_EMAIL} (password reset to dev default)")

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
