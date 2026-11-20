import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_secure_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.utils import ratelimit
from app.utils.accounts import delete_user_account, row_to_dict
from app.utils.email import email_enabled, reset_email, send_email, verification_email

router = APIRouter(prefix="/api/auth", tags=["auth"])

RESET_TOKEN_TTL_MINUTES = 30
VERIFY_TOKEN_TTL_HOURS = 24
HOUR = 3600


def _pair(user: models.User) -> schemas.TokenPair:
    tv = user.token_version or 0
    return schemas.TokenPair(
        access_token=create_access_token(user.id, tv),
        refresh_token=create_refresh_token(user.id, tv),
        user=schemas.UserOut.model_validate(user),
    )


def _issue_verification(db: Session, user: models.User, background: BackgroundTasks) -> str | None:
    """Creates a fresh verification token and queues the email. Returns the raw token only in
    development with no email provider; in every other case the token leaves only by email."""
    raw = generate_secure_token()
    user.verification_token = hash_token(raw)
    user.verification_token_expires = datetime.utcnow() + timedelta(hours=VERIFY_TOKEN_TTL_HOURS)
    db.commit()
    subject, text, page = verification_email(user.full_name, raw)
    background.add_task(send_email, user.email, subject, text, page)
    return raw if (settings.is_dev and not email_enabled()) else None


@router.get("/config", response_model=schemas.AuthConfig)
def auth_config():
    """Lets the login page show only the sign-in options this server actually has."""
    return schemas.AuthConfig(github=settings.github_enabled, email=email_enabled())


@router.post(
    "/register",
    response_model=schemas.RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(ratelimit.limit("register", 8, HOUR))],
)
def register(payload: schemas.UserCreate, background: BackgroundTasks, db: Session = Depends(get_db)):
    # The answer is identical whether or not the email is already registered, so this
    # endpoint can't be used to find out who has an account.
    email = payload.email.lower()
    generic = "Check your email for a verification link, then log in."
    existing = db.query(models.User).filter(models.User.email == email).first()
    token = None
    if existing:
        if not existing.is_verified and existing.password_set:
            token = _issue_verification(db, existing, background)
    else:
        user = models.User(
            email=email,
            full_name=payload.full_name.strip(),
            hashed_password=hash_password(payload.password),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        token = _issue_verification(db, user, background)
    return schemas.RegisterResponse(message=generic, email_sent=email_enabled(), verification_token=token)


@router.post("/login", response_model=schemas.TokenPair)
def login(payload: schemas.UserLogin, request: Request, db: Session = Depends(get_db)):
    email = payload.email.lower()
    window = settings.login_window_minutes * 60
    key = f"login-fail:{ratelimit.client_ip(request)}:{email}"
    if ratelimit.count(key, window) >= settings.login_max_failures:
        raise ratelimit.too_many(ratelimit.retry_after(key, window))

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        ratelimit.record(key)
        if user:
            db.add(models.LoginEvent(user_id=user.id, success=False))
            db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is disabled")
    if not user.is_verified:
        db.add(models.LoginEvent(user_id=user.id, success=False))
        db.commit()
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Please verify your email before logging in. Check your inbox, or request a new verification link.",
        )

    ratelimit.clear(key)
    db.add(models.LoginEvent(user_id=user.id, success=True))
    db.commit()
    return _pair(user)


@router.post("/refresh", response_model=schemas.TokenPair, dependencies=[Depends(ratelimit.limit("refresh", 120, HOUR))])
def refresh(payload: schemas.RefreshRequest, db: Session = Depends(get_db)):
    data = decode_token(payload.refresh_token)
    if not data or data.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token")
    user = db.query(models.User).filter(models.User.id == data["sub"]).first()
    if not user or not user.is_active or (data.get("tv") or 0) != (user.token_version or 0):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")
    return _pair(user)


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=schemas.UserOut)
def update_me(
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if payload.full_name is not None:
        current_user.full_name = payload.full_name
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/login-history", response_model=list[schemas.LoginEventOut])
def login_history(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return (
        db.query(models.LoginEvent)
        .filter(models.LoginEvent.user_id == current_user.id)
        .order_by(models.LoginEvent.created_at.desc())
        .limit(50)
        .all()
    )


# ---------- Email verification ----------
@router.post("/resend-verification", response_model=schemas.VerificationTokenOut,
             dependencies=[Depends(ratelimit.limit("resend", 6, HOUR))])
def resend_verification(
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.is_verified:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This account is already verified")
    token = _issue_verification(db, current_user, background)
    return schemas.VerificationTokenOut(email_sent=email_enabled(), verification_token=token)


@router.post("/resend-verification-by-email", response_model=schemas.ResendVerificationResponse,
             dependencies=[Depends(ratelimit.limit("resend", 6, HOUR))])
def resend_verification_by_email(
    payload: schemas.ResendVerificationRequest, background: BackgroundTasks, db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.email == payload.email.lower()).first()
    generic = "If an account with that email exists and isn't verified yet, a new verification link is on its way."
    token = None
    if user and not user.is_verified and user.password_set:
        token = _issue_verification(db, user, background)
    return schemas.ResendVerificationResponse(email_sent=email_enabled(), verification_token=token, message=generic)


@router.post("/verify-email", response_model=schemas.UserOut, dependencies=[Depends(ratelimit.limit("verify", 30, HOUR))])
def verify_email(payload: schemas.VerifyEmailRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.verification_token == hash_token(payload.token)).first()
    if not user or (user.verification_token_expires and user.verification_token_expires < datetime.utcnow()):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This verification link is invalid or has expired. Request a new one.")
    user.is_verified = True
    user.verification_token = None
    user.verification_token_expires = None
    db.commit()
    db.refresh(user)
    return user


# ---------- Password reset ----------
@router.post("/request-password-reset", response_model=schemas.PasswordResetTokenOut,
             dependencies=[Depends(ratelimit.limit("reset", 6, HOUR))])
def request_password_reset(
    payload: schemas.PasswordResetRequest, background: BackgroundTasks, db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.email == payload.email.lower()).first()
    generic = "If an account with that email exists, a reset link is on its way."
    token = None
    if user and user.is_active:
        raw = generate_secure_token()
        user.reset_token = hash_token(raw)
        user.reset_token_expires = datetime.utcnow() + timedelta(minutes=RESET_TOKEN_TTL_MINUTES)
        db.commit()
        subject, text, page = reset_email(user.full_name, raw)
        background.add_task(send_email, user.email, subject, text, page)
        if settings.is_dev and not email_enabled():
            token = raw
    return schemas.PasswordResetTokenOut(email_sent=email_enabled(), reset_token=token, message=generic)


@router.post("/reset-password", response_model=schemas.UserOut, dependencies=[Depends(ratelimit.limit("reset-confirm", 20, HOUR))])
def reset_password(payload: schemas.PasswordResetConfirm, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.reset_token == hash_token(payload.token)).first()
    if not user or not user.reset_token_expires or user.reset_token_expires < datetime.utcnow():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This reset link is invalid or has expired. Request a new one.")
    user.hashed_password = hash_password(payload.new_password)
    user.password_set = True
    user.is_verified = True          # they just proved they control the inbox
    user.reset_token = None
    user.reset_token_expires = None
    user.token_version = (user.token_version or 0) + 1   # signs out every existing session
    db.commit()
    db.refresh(user)
    return user


# ---------- Account management ----------
@router.post("/change-password", response_model=schemas.TokenPair)
def change_password(
    payload: schemas.ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.password_set:
        if not payload.current_password or not verify_password(payload.current_password, current_user.hashed_password):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your current password is incorrect")
    current_user.hashed_password = hash_password(payload.new_password)
    current_user.password_set = True
    current_user.token_version = (current_user.token_version or 0) + 1
    db.commit()
    db.refresh(current_user)
    return _pair(current_user)   # this device stays signed in, every other one is signed out


@router.post("/logout-all", response_model=schemas.TokenPair)
def logout_all(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    current_user.token_version = (current_user.token_version or 0) + 1
    db.commit()
    db.refresh(current_user)
    return _pair(current_user)


@router.get("/export")
def export_my_data(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Everything the app holds about the person, as JSON they can download."""
    uid = current_user.id
    memberships = db.query(models.ProjectMember).filter(models.ProjectMember.user_id == uid).all()
    projects = []
    for m in memberships:
        p = m.project
        entry = {"id": p.id, "name": p.name, "description": p.description, "status": p.status, "my_role": m.role.value}
        if p.owner_id == uid:
            entry["nodes"] = [row_to_dict(n) for n in p.nodes]
            entry["edges"] = [row_to_dict(e) for e in p.edges]
        projects.append(entry)
    user = row_to_dict(current_user)
    for secret in ("hashed_password", "verification_token", "reset_token", "reset_token_expires", "verification_token_expires"):
        user.pop(secret, None)
    return {
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "account": user,
        "projects": projects,
        "comments": [row_to_dict(c) for c in db.query(models.Comment).filter(models.Comment.author_id == uid).all()],
        "sign_in_history": [row_to_dict(e) for e in db.query(models.LoginEvent).filter(models.LoginEvent.user_id == uid).all()],
        "notifications": [row_to_dict(n) for n in db.query(models.Notification).filter(models.Notification.user_id == uid).all()],
    }


@router.post("/delete-account", status_code=status.HTTP_200_OK)
def delete_account(
    payload: schemas.DeleteAccountRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if payload.confirm_email.strip().lower() != current_user.email.lower():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Type your account email exactly to confirm")
    if current_user.password_set and not (payload.password and verify_password(payload.password, current_user.hashed_password)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your password is incorrect")
    return delete_user_account(db, current_user)
