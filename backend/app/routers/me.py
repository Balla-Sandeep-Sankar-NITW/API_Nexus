from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_current_user
from app.utils.timeparse import to_naive_utc

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
    page: int = 1,
    page_size: int = 30,
    since: Optional[datetime] = None,   # inclusive
    until: Optional[datetime] = None,   # exclusive
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Audit log entries rolled up across every project the user belongs to,
    for the dashboard's history panel. Optionally limited to a period, and paged."""
    page = max(1, page)
    page_size = min(max(1, page_size), 200)
    project_ids = [
        m.project_id
        for m in db.query(models.ProjectMember).filter(models.ProjectMember.user_id == current_user.id).all()
    ]
    if not project_ids:
        return []
    q = db.query(models.AuditLog).filter(models.AuditLog.project_id.in_(project_ids))
    if since:
        q = q.filter(models.AuditLog.created_at >= to_naive_utc(since))
    if until:
        q = q.filter(models.AuditLog.created_at < to_naive_utc(until))
    return q.order_by(models.AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()


# Dismissing a notification deletes it. Register the collection route and the
# item route; "read" above only flags it.
@router.delete("/notifications/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notification(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    n = db.query(models.Notification).filter(
        models.Notification.id == notification_id, models.Notification.user_id == current_user.id
    ).first()
    if not n:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    db.delete(n)
    db.commit()
    return None


@router.delete("/notifications", status_code=status.HTTP_200_OK)
def clear_notifications(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    deleted = db.query(models.Notification).filter(models.Notification.user_id == current_user.id).delete(synchronize_session=False)
    db.commit()
    return {"deleted": deleted}
