from sqlalchemy.orm import Session

from app import models


def notify(db: Session, user_id: str, type: str, message: str, project_id: str | None = None, target: str = ""):
    n = models.Notification(user_id=user_id, project_id=project_id, type=type, message=message, target=target)
    db.add(n)
    # caller is responsible for db.commit()


def notify_project_members(db: Session, project_id: str, exclude_user_id: str, type: str, message: str, target: str = ""):
    """Notify every member of a project except the actor who triggered the event."""
    members = db.query(models.ProjectMember).filter(models.ProjectMember.project_id == project_id).all()
    for m in members:
        if m.user_id == exclude_user_id:
            continue
        notify(db, m.user_id, type, message, project_id=project_id, target=target)
