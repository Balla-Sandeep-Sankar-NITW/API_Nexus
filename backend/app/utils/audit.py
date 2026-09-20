from sqlalchemy.orm import Session

from app import models


def log_action(db: Session, project_id: str, user_id: str | None, action: str, target: str = "", meta: dict | None = None):
    entry = models.AuditLog(project_id=project_id, user_id=user_id, action=action, target=target, meta=meta or {})
    db.add(entry)
    # caller is responsible for db.commit()
