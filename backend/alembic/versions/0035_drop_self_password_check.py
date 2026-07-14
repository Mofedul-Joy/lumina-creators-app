"""Drop chk_self_signup_has_password.

The email-first creator signup verifies the OTP BEFORE a password is set, so a
self-signup account is briefly password-less between verify-email and
set-password. Login routes such accounts to set-password, so integrity is kept
in the app layer instead of the constraint.

Revision ID: 0035_drop_self_password_check
Revises: 0034_campaign_example_videos
"""
from typing import Union

from alembic import op

revision: str = "0035_drop_self_password_check"
down_revision: Union[str, None] = "0034_campaign_example_videos"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("chk_self_signup_has_password", "creators", type_="check")


def downgrade() -> None:
    op.create_check_constraint(
        "chk_self_signup_has_password", "creators",
        "signup_source <> 'self' OR password_hash IS NOT NULL",
    )
