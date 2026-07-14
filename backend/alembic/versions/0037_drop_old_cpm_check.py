"""Drop the leftover cpm_rate > 0 check (0036's matcher missed it).

Postgres renders the old unnamed check as `(cpm_rate > (0)::numeric)`, so 0036's
`ILIKE '%> 0%'` matched nothing and only ADDED the >= 0 constraint alongside the
old > 0 one — leaving cpm_rate=0 still rejected. Drop every cpm_rate check that
uses `>` but not `>=` (i.e. the old strict one), keeping chk_campaigns_cpm_rate_nonneg.

Revision ID: 0037_drop_old_cpm_check
Revises: 0036_cpm_rate_nonneg
"""
from typing import Union

from alembic import op

revision: str = "0037_drop_old_cpm_check"
down_revision: Union[str, None] = "0036_cpm_rate_nonneg"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        DECLARE cname text;
        BEGIN
          FOR cname IN
            SELECT conname FROM pg_constraint
            WHERE conrelid = 'campaigns'::regclass
              AND contype = 'c'
              AND conname <> 'chk_campaigns_cpm_rate_nonneg'
              AND pg_get_constraintdef(oid) ILIKE '%cpm_rate%'
              AND pg_get_constraintdef(oid) LIKE '%>%'
              AND pg_get_constraintdef(oid) NOT LIKE '%>=%'
          LOOP
            EXECUTE 'ALTER TABLE campaigns DROP CONSTRAINT ' || quote_ident(cname);
          END LOOP;
        END $$;
        """
    )


def downgrade() -> None:
    # Non-reversible cleanup; recreating the strict constraint could fail if any
    # cpm_rate=0 rows now exist. No-op.
    pass
