"""Sign in with GitHub. Free to run: create an OAuth App in GitHub developer settings."""
import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app import models
from app.auth import create_access_token, create_refresh_token, create_state_token, decode_token, hash_password
from app.config import settings
from app.database import get_db
from app.utils import ratelimit

router = APIRouter(prefix="/api/auth/github", tags=["auth"])

AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
TOKEN_URL = "https://github.com/login/oauth/access_token"


def _callback_url(request: Request) -> str:
    base = (settings.backend_base_url or str(request.base_url)).rstrip("/")
    return f"{base}/api/auth/github/callback"


def _fail(message: str) -> RedirectResponse:
    return RedirectResponse(f"{settings.frontend_base_url}/login?{urlencode({'error': message})}", status_code=302)


@router.get("/login", dependencies=[Depends(ratelimit.limit("github-login", 30, 600))])
def github_login(request: Request, switch: bool = False):
    if not settings.github_enabled:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "GitHub sign-in is not set up on this server")
    params = {
        "client_id": settings.github_client_id,
        "redirect_uri": _callback_url(request),
        "scope": "read:user user:email",
        "state": create_state_token(secrets.token_urlsafe(8)),
        "allow_signup": "true",
    }
    if switch:
        # Makes GitHub show its account chooser, so people can pick or add a different account.
        params["prompt"] = "select_account"
    return RedirectResponse(f"{AUTHORIZE_URL}?{urlencode(params)}", status_code=302)


@router.get("/callback", dependencies=[Depends(ratelimit.limit("github-callback", 30, 600))])
def github_callback(request: Request, code: str = "", state: str = "", error: str = "", db: Session = Depends(get_db)):
    if not settings.github_enabled:
        return _fail("GitHub sign-in is not set up on this server.")
    if error or not code:
        return _fail("GitHub sign-in was cancelled.")
    st = decode_token(state)
    if not st or st.get("type") != "oauth_state":
        return _fail("That sign-in attempt expired. Please try again.")

    try:
        with httpx.Client(timeout=10, headers={"Accept": "application/json"}) as client:
            tok = client.post(TOKEN_URL, data={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": _callback_url(request),
            }).json()
            access = tok.get("access_token")
            if not access:
                return _fail("GitHub did not accept the sign-in. Please try again.")
            auth = {"Authorization": f"Bearer {access}", "X-GitHub-Api-Version": "2022-11-28"}
            gh_user = client.get("https://api.github.com/user", headers=auth).json()
            emails = client.get("https://api.github.com/user/emails", headers=auth).json()
    except Exception:  # noqa: BLE001
        return _fail("Could not reach GitHub. Please try again.")

    verified = [e for e in emails if isinstance(e, dict) and e.get("verified")] if isinstance(emails, list) else []
    primary = next((e for e in verified if e.get("primary")), verified[0] if verified else None)
    gh_id = str(gh_user.get("id") or "")
    if not primary or not gh_id:
        return _fail("Your GitHub account needs a verified email address.")
    email = primary["email"].lower()

    user = db.query(models.User).filter(models.User.github_id == gh_id).first()
    if not user:
        user = db.query(models.User).filter(models.User.email == email).first()
        if user:
            user.github_id = gh_id              # same verified email: link the accounts
            user.is_verified = True
        else:
            user = models.User(
                email=email,
                full_name=(gh_user.get("name") or gh_user.get("login") or email.split("@")[0])[:120],
                hashed_password=hash_password(secrets.token_urlsafe(32)),   # unusable until they set one
                password_set=False,
                is_verified=True,
                github_id=gh_id,
            )
            db.add(user)
    if not user.is_active:
        return _fail("This account is disabled.")
    db.flush()
    db.add(models.LoginEvent(user_id=user.id, success=True))
    db.commit()
    db.refresh(user)

    tv = user.token_version or 0
    fragment = urlencode({"access_token": create_access_token(user.id, tv), "refresh_token": create_refresh_token(user.id, tv)})
    # Tokens travel in the URL fragment: it is never sent to a server or written to logs.
    return RedirectResponse(f"{settings.frontend_base_url}/auth/callback#{fragment}", status_code=302)