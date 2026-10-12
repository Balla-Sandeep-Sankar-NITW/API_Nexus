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


def notify_owners(db: Session, project_id: str, nodes, exclude_user_id: str, type: str, make_message, target: str = ""):
    """Notify project members who are the declared owner of any of `nodes`.

    A node's owner_contact is free text; it only triggers a notification when it
    matches a project member's email (case-insensitive). Each member gets one
    notification covering all of their nodes. make_message(labels) builds the text.
    """
    members = (
        db.query(models.ProjectMember.user_id, models.User.email)
        .join(models.User, models.User.id == models.ProjectMember.user_id)
        .filter(models.ProjectMember.project_id == project_id)
        .all()
    )
    user_by_email = {email.lower(): user_id for user_id, email in members}
    owned: dict[str, list[str]] = {}
    for n in nodes:
        contact = (n.owner_contact or "").strip().lower()
        user_id = user_by_email.get(contact)
        if user_id and user_id != exclude_user_id:
            owned.setdefault(user_id, []).append(n.label)
    for user_id, labels in owned.items():
        notify(db, user_id, type, make_message(labels), project_id=project_id, target=target)
