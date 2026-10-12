from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_secure_token,
)
from app.database import get_db
from app.deps import get_current_user
from app.utils.email import send_email, verification_email_body, reset_email_body

router = APIRouter(prefix="/api/auth", tags=["auth"])

RESET_TOKEN_TTL_MINUTES = 30


@router.post("/register", response_model=schemas.RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")

    user = models.User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        verification_token=generate_secure_token(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Registration deliberately does NOT return login tokens. The account
    # must be verified before its first login (enforced in /login below).
    subject, body = verification_email_body(user.full_name, user.verification_token)
    sent = send_email(user.email, subject, body)

    return schemas.RegisterResponse(
        message="Account created. Check your email to verify it, then log in.",
        email_sent=sent,
        verification_token=None if sent else user.verification_token,
    )


@router.post("/login", response_model=schemas.TokenPair)
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
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

    db.add(models.LoginEvent(user_id=user.id, success=True))
    db.commit()

    return schemas.TokenPair(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        user=schemas.UserOut.model_validate(user),
    )


@router.post("/refresh", response_model=schemas.TokenPair)
def refresh(refresh_token: str, db: Session = Depends(get_db)):
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token")
    user = db.query(models.User).filter(models.User.id == payload["sub"]).first()
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")

    return schemas.TokenPair(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        user=schemas.UserOut.model_validate(user),
    )


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
def login_history(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    events = (
        db.query(models.LoginEvent)
        .filter(models.LoginEvent.user_id == current_user.id)
        .order_by(models.LoginEvent.created_at.desc())
        .limit(50)
        .all()
    )
    return events


# ---------- Email verification ----------
# If SMTP is configured (see app/config.py), these send a real email and
# the token is never included in the API response. Without SMTP configured,
# the app runs in dev mode: the email is logged to the console and the
# token is returned directly so the flow stays testable.

@router.post("/resend-verification", response_model=schemas.VerificationTokenOut)
def resend_verification(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.is_verified:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This account is already verified")
    current_user.verification_token = generate_secure_token()
    db.commit()

    subject, body = verification_email_body(current_user.full_name, current_user.verification_token)
    sent = send_email(current_user.email, subject, body)

    return schemas.VerificationTokenOut(
        email_sent=sent,
        verification_token=None if sent else current_user.verification_token,
    )


@router.post("/resend-verification-by-email", response_model=schemas.ResendVerificationResponse)
def resend_verification_by_email(payload: schemas.ResendVerificationRequest, db: Session = Depends(get_db)):
    """Unauthenticated counterpart to /resend-verification, for the case
    where the person can't log in yet precisely because they're
    unverified - so they have no access token to call the authenticated
    version with. Deliberately vague response either way, same as
    password reset, so this can't be used to enumerate accounts."""
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    generic_message = "If an account with that email exists and isn't verified yet, a new verification link has been issued."
    if not user or user.is_verified:
        return schemas.ResendVerificationResponse(email_sent=False, verification_token=None, message=generic_message)

    user.verification_token = generate_secure_token()
    db.commit()

    subject, body = verification_email_body(user.full_name, user.verification_token)
    sent = send_email(user.email, subject, body)

    return schemas.ResendVerificationResponse(
        email_sent=sent,
        verification_token=None if sent else user.verification_token,
        message=generic_message,
    )


@router.post("/verify-email", response_model=schemas.UserOut)
def verify_email(payload: schemas.VerifyEmailRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.verification_token == payload.token).first()
    if not user:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired verification token")
    user.is_verified = True
    user.verification_token = None
    db.commit()
    db.refresh(user)
    return user


# ---------- Password reset ----------
@router.post("/request-password-reset", response_model=schemas.PasswordResetTokenOut)
def request_password_reset(payload: schemas.PasswordResetRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    generic_message = "If an account with that email exists, a reset link has been issued."
    if not user:
        # Deliberately vague response so this endpoint can't be used to
        # enumerate which emails have accounts.
        return schemas.PasswordResetTokenOut(email_sent=False, reset_token=None, message=generic_message)

    user.reset_token = generate_secure_token()
    user.reset_token_expires = datetime.utcnow() + timedelta(minutes=RESET_TOKEN_TTL_MINUTES)
    db.commit()

    subject, body = reset_email_body(user.full_name, user.reset_token)
    sent = send_email(user.email, subject, body)

    return schemas.PasswordResetTokenOut(
        email_sent=sent,
        reset_token=None if sent else user.reset_token,
        message=generic_message,
    )


@router.post("/reset-password", response_model=schemas.UserOut)
def reset_password(payload: schemas.PasswordResetConfirm, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.reset_token == payload.token).first()
    if not user or not user.reset_token_expires or user.reset_token_expires < datetime.utcnow():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired reset token")

    user.hashed_password = hash_password(payload.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()
    db.refresh(user)
    return user
