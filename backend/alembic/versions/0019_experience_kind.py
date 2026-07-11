"""Experiences become creator-authored: typed + auto-verified.

0014 created `creator_experiences` as an admin-read-only résumé table
(title/org/url). Feature 3 lets creators add their own, so an entry now carries
its type (organic UGC / UGC paid ad / professional role) and a verified flag.
Auto-verified on add — there is no manual review step.

Revision ID: 0019_experience_kind
Revises: 0018_social_verification
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0019_experience_kind"
down_revision: Union[str, None] = "0018_social_verification"
branch_labels = None
depends_on = None

KINDS = ("organic_ugc", "ugc_paid_ad", "professional_role")


def upgrade() -> None:
    # Existing rows predate the concept and were all résumé-style roles.
    op.add_column(
        "creator_experiences",
        sa.Column(
            "kind",
            sa.Text(),
            nullable=False,
            server_default="professional_role",
        ),
    )
    op.add_column(
        "creator_experiences",
        sa.Column("verified", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_check_constraint(
        "chk_experience_kind",
        "creator_experiences",
        sa.column("kind").in_(KINDS),
    )


def downgrade() -> None:
    op.drop_constraint("chk_experience_kind", "creator_experiences", type_="check")
    op.drop_column("creator_experiences", "verified")
    op.drop_column("creator_experiences", "kind")
