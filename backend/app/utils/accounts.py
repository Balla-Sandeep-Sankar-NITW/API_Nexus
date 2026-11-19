"""Helpers shared by account deletion and project deletion."""
from datetime import date, datetime
from enum import Enum

from sqlalchemy.orm import Session

from app import models


def purge_project(db: Session, project: models.Project) -> None:
    """Delete a project and everything that points at it (no FK violations on Postgres)."""
    for plan in db.query(models.FreezePlan).filter(models.FreezePlan.project_id == project.id).all():
        db.delete(plan)  # steps cascade
    db.query(models.AuditLog).filter(models.AuditLog.project_id == project.id).delete(synchronize_session=False)
    db.query(models.GraphSnapshot).filter(models.GraphSnapshot.project_id == project.id).delete(synchronize_session=False)
    db.query(models.Notification).filter(models.Notification.project_id == project.id).delete(synchronize_session=False)
    db.flush()
    db.delete(project)  # members, nodes (+comments), edges, specs cascade


def delete_user_account(db: Session, user: models.User) -> dict:
    """Removes the account. Projects the user owns move to another leader when there is one,
    otherwise they are deleted. Returns counts for the audit trail / UI."""
    transferred = deleted = 0
    owned = db.query(models.Project).filter(models.Project.owner_id == user.id).all()
    for project in owned:
        successor = (
            db.query(models.ProjectMember)
            .filter(
                models.ProjectMember.project_id == project.id,
                models.ProjectMember.user_id != user.id,
                models.ProjectMember.role == models.RoleEnum.LEADER,
            )
            .order_by(models.ProjectMember.joined_at)
            .first()
        )
        if successor:
            project.owner_id = successor.user_id
            transferred += 1
        else:
            purge_project(db, project)
            deleted += 1
    db.flush()

    uid = user.id
    # Comments need an author; remove the user's own. Everything else just loses the reference.
    db.query(models.Comment).filter(models.Comment.author_id == uid).delete(synchronize_session=False)
    for model, col in (
        (models.AuditLog, "user_id"), (models.GraphNode, "created_by"), (models.GraphEdge, "created_by"),
        (models.GraphSnapshot, "created_by"), (models.FreezePlan, "created_by"), (models.OpenApiSpec, "imported_by"),
    ):
        db.query(model).filter(getattr(model, col) == uid).update({col: None}, synchronize_session=False)
    db.query(models.Notification).filter(models.Notification.user_id == uid).delete(synchronize_session=False)
    db.query(models.LoginEvent).filter(models.LoginEvent.user_id == uid).delete(synchronize_session=False)
    db.query(models.ProjectMember).filter(models.ProjectMember.user_id == uid).delete(synchronize_session=False)
    db.flush()
    db.delete(user)
    db.commit()
    return {"projects_transferred": transferred, "projects_deleted": deleted}


def row_to_dict(row) -> dict:
    out = {}
    for col in row.__table__.columns:
        v = getattr(row, col.name)
        if isinstance(v, Enum):
            v = v.value
        elif isinstance(v, (datetime, date)):
            v = v.isoformat()
        out[col.name] = v
    return out
