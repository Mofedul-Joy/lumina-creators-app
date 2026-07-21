"""Allow nullable follower counts and add niches index.

Revision ID: 0042
Revises: 0041
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0042"
down_revision: Union[str, None] = "0041"
branch_labels = None
depends_on = None


# 0001_baseline declared the follower_count check inline and unnamed, so its real
# name in Postgres depends on how the DDL was emitted (`social_accounts_check` vs
# `social_accounts_follower_count_check`). Drop whichever check on the table
# mentions follower_count rather than guessing and failing the deploy.
_DROP_FOLLOWER_CHECKS = """
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'social_accounts'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%follower_count%'
  LOOP
    EXECUTE format('ALTER TABLE social_accounts DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
"""


def upgrade() -> None:
    op.execute(_DROP_FOLLOWER_CHECKS)
    op.alter_column(
        "social_accounts",
        "follower_count",
        existing_type=sa.Integer(),
        nullable=True,
        server_default=None,
    )
    op.create_check_constraint(
        "social_accounts_follower_count_check",
        "social_accounts",
        "follower_count IS NULL OR follower_count >= 0",
    )
    op.create_index(
        "idx_profiles_niches",
        "creator_profiles",
        ["niches"],
        postgresql_using="gin",
    )


def downgrade() -> None:
    op.drop_index("idx_profiles_niches", table_name="creator_profiles")
    op.execute(_DROP_FOLLOWER_CHECKS)
    op.execute("UPDATE social_accounts SET follower_count = 0 WHERE follower_count IS NULL")
    op.alter_column(
        "social_accounts",
        "follower_count",
        existing_type=sa.Integer(),
        nullable=False,
        server_default=sa.text("0"),
    )
    op.create_check_constraint(
        "social_accounts_follower_count_check",
        "social_accounts",
        "follower_count >= 0",
    )
