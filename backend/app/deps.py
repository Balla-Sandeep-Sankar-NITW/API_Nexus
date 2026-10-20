from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.auth import decode_token
from app.database import get_db
from app import models

bearer_scheme = HTTPBearer(auto_error=False)

# Role hierarchy: higher number = more privilege
ROLE_RANK = {
    models.RoleEnum.VIEWER: 0,
    models.RoleEnum.MEMBER: 1,
    models.RoleEnum.LEADER: 2,
}


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    payload = decode_token(creds.credentials)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user = db.query(models.User).filter(models.User.id == payload["sub"]).first()
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")
    return user


def get_membership(db: Session, project_id: str, user_id: str) -> models.ProjectMember | None:
    return (
        db.query(models.ProjectMember)
        .filter(models.ProjectMember.project_id == project_id, models.ProjectMember.user_id == user_id)
        .first()
    )


def require_project_role(min_role: models.RoleEnum):
    """
    Returns a dependency that verifies the current user is a member of
    :project_id (path param) with at least :min_role privilege.
    Raises 403 if the user lacks permission, 404 if not a member at all.
    """

    def dependency(
        project_id: str,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user),
    ) -> models.ProjectMember:
        membership = get_membership(db, project_id, current_user.id)
        if membership is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found or access denied")
        if ROLE_RANK[membership.role] < ROLE_RANK[min_role]:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"This action requires '{min_role.value}' role or higher; you have '{membership.role.value}'",
            )
        return membership

    return dependency
