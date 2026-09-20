import smtplib
from email.mime.text import MIMEText

from app.config import settings


def send_email(to_email: str, subject: str, body: str) -> bool:
    """Returns True if the email was actually sent via SMTP, False if the
    app is running in dev mode (no SMTP configured) or the send failed.
    Callers use this to decide whether to fall back to returning a token
    directly in the API response."""
    if not settings.smtp_host:
        print(f"[DEV MODE - no SMTP configured] Would send email to {to_email}\nSubject: {subject}\n{body}\n")
        return False

    try:
        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = settings.smtp_from_email
        msg["To"] = to_email

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            if settings.smtp_use_tls:
                server.starttls()
            if settings.smtp_username:
                server.login(settings.smtp_username, settings.smtp_password or "")
            server.sendmail(settings.smtp_from_email, [to_email], msg.as_string())
        return True
    except Exception as exc:
        print(f"[EMAIL ERROR] Failed to send to {to_email}: {exc}")
        return False


def verification_email_body(full_name: str, token: str) -> tuple[str, str]:
    link = f"{settings.frontend_base_url}/verify-email?token={token}"
    subject = "Verify your API Nexus email"
    body = f"Hi {full_name},\n\nVerify your email by opening this link:\n{link}\n\nIf you didn't create an API Nexus account, you can ignore this."
    return subject, body


def reset_email_body(full_name: str, token: str) -> tuple[str, str]:
    link = f"{settings.frontend_base_url}/reset-password?token={token}"
    subject = "Reset your API Nexus password"
    body = f"Hi {full_name},\n\nReset your password by opening this link:\n{link}\n\nThis link expires in 30 minutes. If you didn't request this, you can ignore this email."
    return subject, body
