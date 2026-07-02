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
from app.models.identity import Admin, Client

ADMIN_EMAIL = "admin@lumina.dev"
ADMIN_PASSWORD = "admin12345"
CLIENT_EMAIL = "client@lumina.dev"
CLIENT_PASSWORD = "client12345"


def main() -> None:
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

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
