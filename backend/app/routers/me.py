from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_current_user

router = APIRouter(prefix="/api/me", tags=["me"])


@router.get("/notifications", response_model=list[schemas.NotificationOut])
def list_notifications(
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.Notification).filter(models.Notification.user_id == current_user.id)
    if unread_only:
        q = q.filter(models.Notification.read.is_(False))
    return q.order_by(models.Notification.created_at.desc()).limit(100).all()


@router.post("/notifications/{notification_id}/read", response_model=schemas.NotificationOut)
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    n = db.query(models.Notification).filter(
        models.Notification.id == notification_id, models.Notification.user_id == current_user.id
    ).first()
    if not n:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    n.read = True
    db.commit()
    db.refresh(n)
    return n


@router.post("/notifications/read-all", status_code=status.HTTP_200_OK)
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id, models.Notification.read.is_(False)
    ).update({"read": True})
    db.commit()
    return {"status": "ok"}


@router.get("/activity", response_model=list[schemas.AuditLogOut])
def recent_activity(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Audit log entries rolled up across every project the user belongs to,
    for the dashboard's recent-activity feed."""
    project_ids = [
        m.project_id
        for m in db.query(models.ProjectMember).filter(models.ProjectMember.user_id == current_user.id).all()
    ]
    if not project_ids:
        return []
    logs = (
        db.query(models.AuditLog)
        .filter(models.AuditLog.project_id.in_(project_ids))
        .order_by(models.AuditLog.created_at.desc())
        .limit(30)
        .all()
    )
    return logs
