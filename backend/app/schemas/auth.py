"""Auth request/response schemas. Email kept as str (no email-validator dep — ponytail)."""
from typing import Optional  # ponytail: Pydantic evals field types at runtime; 3.9 can't eval `str | None`

from pydantic import BaseModel


class LoginIn(BaseModel):
    email: str
    password: str


class GoogleAuthIn(BaseModel):
    code: str
    create: bool = False


class SignupIn(BaseModel):
    email: str
    password: Optional[str] = None   # optional: email-first flow sets it after OTP
    # Present when the creator arrived from an admin invite link.
    invite: Optional[str] = None


class SetPasswordIn(BaseModel):
    email: str
    password: str


class SignupOut(BaseModel):
    status: str = "verification_sent"  # or "ok" when email verification is disabled
    email: Optional[str] = None
    dev_code: Optional[str] = None  # present only outside production (local/E2E)
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_type: str = "bearer"


class VerifyEmailIn(BaseModel):
    email: str
    code: str


class ResendCodeIn(BaseModel):
    email: str


class ResendOut(BaseModel):
    status: str = "ok"
    dev_code: Optional[str] = None


class RefreshIn(BaseModel):
    refresh_token: str


class TokenOut(BaseModel):
    status: str = "ok"
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class CreatorLoginOut(BaseModel):
    """Password login may report that the account exists but has no password yet."""
    status: str  # "ok" | "password_not_set"
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    email: Optional[str] = None


class CheckEmailOut(BaseModel):
    exists: bool
    password_set: bool


class MeOut(BaseModel):
    id: str
    email: str
