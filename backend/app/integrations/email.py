"""Transactional email. Prefers Resend (HTTP — works from cloud hosts that block
outbound SMTP), falls back to SMTP (stdlib smtplib), else no-op returning False.
"""
from __future__ import annotations

import json
import smtplib
import ssl
import urllib.request
from email.message import EmailMessage

from app.core.config import get_settings

_SUBJECT = "Your Lumina Creators code"
_TEXT = (
    "Welcome to Lumina Creators!\n\nYour verification code is: {code}\n\n"
    "It expires in 15 minutes. If you didn't sign up, you can ignore this email."
)
_HTML = (
    '<div style="font-family:system-ui,sans-serif;max-width:440px;margin:auto">'
    '<h2 style="color:#16a34a">Verify your email</h2>'
    "<p>Welcome to Lumina Creators. Enter this code to finish signing up:</p>"
    '<p style="font-size:32px;font-weight:700;letter-spacing:6px;color:#111">{code}</p>'
    '<p style="color:#666;font-size:13px">Expires in 15 minutes. Didn\'t sign up? Ignore this email.</p></div>'
)


def _send_resend(to_email: str, code: str) -> bool:
    s = get_settings()
    body = json.dumps({
        "from": s.email_from or "Lumina Creators <onboarding@resend.dev>",
        "to": [to_email],
        "subject": f"{_SUBJECT}: {code}",
        "text": _TEXT.format(code=code),
        "html": _HTML.format(code=code),
    }).encode()
    req = urllib.request.Request(
        "https://api.resend.com/emails", data=body,
        headers={"Authorization": f"Bearer {s.resend_api_key}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.status < 300


def send_verification_code(to_email: str, code: str) -> bool:
    s = get_settings()
    if s.resend_api_key:
        return _send_resend(to_email, code)
    if not s.smtp_configured:
        return False
    msg = EmailMessage()
    msg["Subject"] = f"Your Lumina Creators code: {code}"
    msg["From"] = s.email_from or s.smtp_user
    msg["To"] = to_email
    msg.set_content(
        f"Welcome to Lumina Creators!\n\n"
        f"Your verification code is: {code}\n\n"
        f"It expires in 15 minutes. If you didn't sign up, you can ignore this email."
    )
    msg.add_alternative(
        f"""<div style="font-family:system-ui,sans-serif;max-width:440px;margin:auto">
          <h2 style="color:#16a34a">Verify your email</h2>
          <p>Welcome to Lumina Creators. Enter this code to finish signing up:</p>
          <p style="font-size:32px;font-weight:700;letter-spacing:6px;color:#111">{code}</p>
          <p style="color:#666;font-size:13px">Expires in 15 minutes. Didn't sign up? Ignore this email.</p>
        </div>""",
        subtype="html",
    )
    with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=15) as server:
        server.starttls(context=ssl.create_default_context())
        server.login(s.smtp_user, s.smtp_password)
        server.send_message(msg)
    return True
