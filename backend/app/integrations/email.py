"""Transactional email. Prefers Resend (HTTP — works from cloud hosts that block
outbound SMTP), falls back to SMTP (stdlib smtplib), else no-op returning False.

`_send` carries the transport (Resend → SMTP → no-op); each public sender only
supplies subject + bodies.
"""
from __future__ import annotations

import json
import smtplib
import ssl
import urllib.request
from email.message import EmailMessage

from app.core.config import get_settings


def _send_resend(to_email: str, subject: str, text: str, html: str) -> bool:
    s = get_settings()
    body = json.dumps({
        "from": s.email_from or "Lumina Creators <onboarding@resend.dev>",
        "to": [to_email],
        "subject": subject,
        "text": text,
        "html": html,
    }).encode()
    req = urllib.request.Request(
        "https://api.resend.com/emails", data=body,
        headers={"Authorization": f"Bearer {s.resend_api_key}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.status < 300


def _send(to_email: str, subject: str, text: str, html: str) -> bool:
    """True if the mail was handed to a transport. False when nothing is
    configured — callers treat that as 'couldn't email', never as an error."""
    s = get_settings()
    if s.resend_api_key:
        return _send_resend(to_email, subject, text, html)
    if not s.smtp_configured:
        return False
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = s.email_from or s.smtp_user
    msg["To"] = to_email
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")
    with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=15) as server:
        server.starttls(context=ssl.create_default_context())
        server.login(s.smtp_user, s.smtp_password)
        server.send_message(msg)
    return True


def send_verification_code(to_email: str, code: str) -> bool:
    text = (
        f"Welcome to Lumina Creators!\n\nYour verification code is: {code}\n\n"
        "It expires in 15 minutes. If you didn't sign up, you can ignore this email."
    )
    html = (
        '<div style="font-family:system-ui,sans-serif;max-width:440px;margin:auto">'
        '<h2 style="color:#16a34a">Verify your email</h2>'
        "<p>Welcome to Lumina Creators. Enter this code to finish signing up:</p>"
        f'<p style="font-size:32px;font-weight:700;letter-spacing:6px;color:#111">{code}</p>'
        '<p style="color:#666;font-size:13px">Expires in 15 minutes. Didn\'t sign up? Ignore this email.</p></div>'
    )
    return _send(to_email, f"Your Lumina Creators code: {code}", text, html)


def send_creator_invite(to_email: str, link: str) -> bool:
    text = (
        "You've been invited to join Lumina Creators.\n\n"
        "Get paid per 1,000 views for posting to your own socials. "
        f"Accept your invite here:\n{link}\n\n"
        "If you weren't expecting this, you can ignore this email."
    )
    html = (
        '<div style="font-family:system-ui,sans-serif;max-width:440px;margin:auto">'
        '<h2 style="color:#16a34a">You\'re invited to Lumina Creators</h2>'
        "<p>Get paid per 1,000 views for posting to your own socials. "
        "Accept your invite to create an account and set up your profile.</p>"
        f'<p><a href="{link}" style="display:inline-block;background:#16a34a;color:#fff;'
        'text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">'
        "Accept invite</a></p>"
        f'<p style="color:#666;font-size:13px">Or paste this link into your browser:<br>{link}</p>'
        '<p style="color:#666;font-size:13px">Weren\'t expecting this? You can ignore this email.</p></div>'
    )
    return _send(to_email, "You're invited to join Lumina Creators", text, html)
