"""Relax campaigns cpm_rate check from > 0 to >= 0.

Fixed / per_hour / per_post campaigns don't pay on views, so cpm_rate is
irrelevant and 0 is a legitimate value there. The old CHECK (cpm_rate > 0)
rejected those with a DB-level 500. Drop the old (auto-named) constraint by
lookup — its Postgres-generated name isn't stable to hardcode — and add a
named cpm_rate >= 0 in its place. The app layer still requires cpm_rate > 0
for cpm/mixed campaigns.

Revision ID: 0036_cpm_rate_nonneg
Revises: 0035_drop_self_password_check
"""
from typing import Union

from alembic import op

revision: str = "0036_cpm_rate_nonneg"
down_revision: Union[str, None] = "0035_drop_self_password_check"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop whatever the old "cpm_rate > 0" check is named (unnamed → Postgres
    # auto-generated), then add the relaxed, explicitly-named constraint.
    op.execute(
        """
        DO $$
        DECLARE cname text;
        BEGIN
          SELECT conname INTO cname
          FROM pg_constraint
          WHERE conrelid = 'campaigns'::regclass
            AND contype = 'c'
            AND pg_get_constraintdef(oid) ILIKE '%cpm_rate%'
            AND pg_get_constraintdef(oid) ILIKE '%> 0%'
            AND pg_get_constraintdef(oid) NOT ILIKE '%>= 0%'
          LIMIT 1;
          IF cname IS NOT NULL THEN
            EXECUTE 'ALTER TABLE campaigns DROP CONSTRAINT ' || quote_ident(cname);
          END IF;
        END $$;
        """
    )
    op.create_check_constraint("chk_campaigns_cpm_rate_nonneg", "campaigns", "cpm_rate >= 0")


def downgrade() -> None:
    op.drop_constraint("chk_campaigns_cpm_rate_nonneg", "campaigns", type_="check")
    op.create_check_constraint("chk_campaigns_cpm_rate_positive", "campaigns", "cpm_rate > 0")
