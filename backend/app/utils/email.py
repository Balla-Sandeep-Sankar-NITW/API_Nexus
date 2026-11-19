"""Outgoing email.

Render's free plan blocks SMTP ports (25/465/587), so the primary path is an HTTPS API
(Brevo, free plan: 300/day). SMTP stays as an optional fallback for paid hosts or local use.
"""
import html
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

from app.config import settings

BREVO_URL = "https://api.brevo.com/v3/smtp/email"


def email_enabled() -> bool:
    if settings.brevo_api_key and settings.email_from_address:
        return True
    return bool(settings.smtp_host)


def send_email(to_email: str, subject: str, text: str, html_body: str | None = None) -> bool:
    """Returns True when the provider accepted the message. Never raises, so it is safe in a
    background task. Failures are logged without the message body (it contains a secret link)."""
    if not email_enabled():
        if settings.is_dev:
            print(f"[DEV MODE - no email provider] To: {to_email}\nSubject: {subject}\n{text}\n")
        return False

    if settings.brevo_api_key and settings.email_from_address:
        try:
            res = httpx.post(
                BREVO_URL,
                headers={"api-key": settings.brevo_api_key, "accept": "application/json"},
                json={
                    "sender": {"name": settings.email_from_name, "email": settings.email_from_address},
                    "to": [{"email": to_email}],
                    "subject": subject,
                    "textContent": text,
                    **({"htmlContent": html_body} if html_body else {}),
                },
                timeout=10,
            )
            if res.status_code in (200, 201, 202):
                return True
            print(f"[EMAIL ERROR] Brevo rejected the message ({res.status_code}): {res.text[:200]}")
            return False
        except Exception as exc:  # noqa: BLE001
            print(f"[EMAIL ERROR] Brevo request failed: {exc}")
            return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.smtp_from_email
        msg["To"] = to_email
        msg.attach(MIMEText(text, "plain"))
        if html_body:
            msg.attach(MIMEText(html_body, "html"))
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            if settings.smtp_use_tls:
                server.starttls()
            if settings.smtp_username:
                server.login(settings.smtp_username, settings.smtp_password or "")
            server.sendmail(settings.smtp_from_email, [to_email], msg.as_string())
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"[EMAIL ERROR] SMTP send failed: {exc}")
        return False


def _layout(heading: str, lines: list[str], button: str, link: str, note: str) -> tuple[str, str]:
    text = f"{heading}\n\n" + "\n\n".join(lines) + f"\n\n{button}: {link}\n\n{note}\n"
    paras = "".join(f'<p style="margin:0 0 14px;line-height:1.55">{html.escape(l)}</p>' for l in lines)
    page = f"""<!doctype html><html><body style="margin:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#0f1b2d">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border:1px solid #dde5f0;border-radius:8px">
<tr><td style="padding:28px">
<div style="font-weight:700;font-size:15px;color:#2358d0;margin-bottom:18px">API Nexus</div>
<h1 style="font-size:20px;margin:0 0 14px">{html.escape(heading)}</h1>{paras}
<p style="margin:22px 0"><a href="{html.escape(link)}" style="background:#2358d0;color:#fff;text-decoration:none;padding:11px 20px;border-radius:6px;font-weight:600;display:inline-block">{html.escape(button)}</a></p>
<p style="margin:0 0 6px;font-size:12px;color:#526078;word-break:break-all">Or paste this link into your browser:<br>{html.escape(link)}</p>
<p style="margin:14px 0 0;font-size:12px;color:#526078">{html.escape(note)}</p>
</td></tr></table></td></tr></table></body></html>"""
    return text, page


def verification_email(full_name: str, token: str) -> tuple[str, str, str]:
    link = f"{settings.frontend_base_url}/verify-email?token={token}"
    text, page = _layout(
        "Verify your email",
        [f"Hi {full_name},", "Confirm your email address to finish setting up your API Nexus account. The link works for 24 hours."],
        "Verify email", link, "If you didn't create an account, you can ignore this message.",
    )
    return "Verify your API Nexus email", text, page


def reset_email(full_name: str, token: str) -> tuple[str, str, str]:
    link = f"{settings.frontend_base_url}/reset-password?token={token}"
    text, page = _layout(
        "Reset your password",
        [f"Hi {full_name},", "Use the button below to choose a new password. The link works for 30 minutes."],
        "Choose a new password", link, "If you didn't ask for this, you can ignore this message. Your password stays the same.",
    )
    return "Reset your API Nexus password", text, page
