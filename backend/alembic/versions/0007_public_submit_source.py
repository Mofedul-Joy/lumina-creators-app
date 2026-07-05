"""add 'public_submit' to signup_source — the public campaign-entry funnel

Revision ID: 0007_public_submit_source
Revises: 0006_suspicious_flags
"""
from typing import Union

from alembic import op

revision: str = "0007_public_submit_source"
down_revision: Union[str, None] = "0006_suspicious_flags"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE cannot run inside Alembic's implicit transaction
    # on Postgres (it must not be used and queried in the same transaction it
    # was added in) — commit first so this runs in its own autocommit statement.
    op.execute("COMMIT")
    op.execute("ALTER TYPE signup_source ADD VALUE IF NOT EXISTS 'public_submit'")


def downgrade() -> None:
    # Postgres has no ALTER TYPE ... DROP VALUE — removing an enum value means
    # rebuilding the type from scratch, which isn't worth it for a downgrade
    # path. Leaving the value in place on downgrade is harmless (unused).
    pass
