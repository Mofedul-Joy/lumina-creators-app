"""One-off: ensure a demo admin account exists on this environment. Meant to
run as a Render job (`python scripts/seed_staging_demo.py`) — safe to re-run,
never touches anything else. Not gated on ENVIRONMENT since this branch's
staging deploy has no seed data at all yet and isn't the real production DB."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import get_engine
from app.models import Admin
from sqlalchemy.orm import Session

ADMIN_EMAIL = "admin@lumina-demo.test"
ADMIN_PASSWORD = "DemoAdmin!2026"


def main() -> None:
    db = Session(get_engine())
    try:
        admin = db.execute(select(Admin).where(Admin.email == ADMIN_EMAIL)).scalar_one_or_none()
        if admin is None:
            db.add(Admin(email=ADMIN_EMAIL, password_hash=hash_password(ADMIN_PASSWORD), role="owner"))
            print(f"created admin {ADMIN_EMAIL}")
        else:
            admin.password_hash = hash_password(ADMIN_PASSWORD)
            print(f"admin already existed {ADMIN_EMAIL}, password reset to demo default")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
