from datetime import datetime, timedelta, timezone
import hashlib
import secrets

from jose import jwt, JWTError
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def generate_secure_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """Emailed tokens are stored hashed, so a database leak can't be replayed."""
    return hashlib.sha256(token.encode()).hexdigest()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _create_token(subject: str, expires_delta: timedelta, token_type: str, token_version: int = 0) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": subject, "type": token_type, "tv": token_version or 0, "iat": now, "exp": now + expires_delta}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: str, token_version: int = 0) -> str:
    return _create_token(user_id, timedelta(minutes=settings.access_token_expire_minutes), "access", token_version)


def create_refresh_token(user_id: str, token_version: int = 0) -> str:
    return _create_token(user_id, timedelta(days=settings.refresh_token_expire_days), "refresh", token_version)


def create_state_token(nonce: str) -> str:
    """Short-lived signed value that ties a GitHub redirect to the browser that started it."""
    return _create_token(nonce, timedelta(minutes=10), "oauth_state")


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
