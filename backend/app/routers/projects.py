from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_current_user, require_project_role, get_membership
from app.utils.audit import log_action
from app.utils.notify import notify
from app.auth import generate_secure_token

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _to_project_out(db: Session, project: models.Project, user_id: str) -> schemas.ProjectOut:
    membership = get_membership(db, project.id, user_id)
    return schemas.ProjectOut(
        id=project.id,
        name=project.name,
        description=project.description,
        status=project.status,
        owner_id=project.owner_id,
        created_at=project.created_at,
        updated_at=project.updated_at,
        my_role=membership.role.value if membership else None,
        node_count=len(project.nodes),
        edge_count=len(project.edges),
        member_count=len(project.members),
    )


@router.get("", response_model=list[schemas.ProjectOut])
def list_my_projects(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    memberships = db.query(models.ProjectMember).filter(models.ProjectMember.user_id == current_user.id).all()
    return [_to_project_out(db, m.project, current_user.id) for m in memberships]


@router.post("", response_model=schemas.ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: schemas.ProjectCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    project = models.Project(name=payload.name, description=payload.description, owner_id=current_user.id)
    db.add(project)
    db.flush()

    membership = models.ProjectMember(project_id=project.id, user_id=current_user.id, role=models.RoleEnum.LEADER)
    db.add(membership)
    log_action(db, project.id, current_user.id, "project.create", project.name)
    db.commit()
    db.refresh(project)
    return _to_project_out(db, project, current_user.id)


@router.get("/{project_id}", response_model=schemas.ProjectOut)
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    _membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.VIEWER)),
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return _to_project_out(db, project, current_user.id)


@router.patch("/{project_id}", response_model=schemas.ProjectOut)
def update_project(
    project_id: str,
    payload: schemas.ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    _membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.LEADER)),
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    if payload.name is not None:
        project.name = payload.name
    if payload.description is not None:
        project.description = payload.description
    log_action(db, project_id, current_user.id, "project.update", project.name)
    db.commit()
    db.refresh(project)
    return _to_project_out(db, project, current_user.id)


@router.patch("/{project_id}/archive", response_model=schemas.ProjectOut)
def archive_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    _membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.LEADER)),
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    project.status = "archived" if project.status == "active" else "active"
    log_action(db, project.id, current_user.id, "project.archive_toggle", project.status)
    db.commit()
    db.refresh(project)
    return _to_project_out(db, project, current_user.id)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
    _membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.LEADER)),
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if project.owner_id != _membership.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the project owner can delete this project")
    db.delete(project)
    db.commit()
    return None


# ---------- Shareable public read-only link ----------
@router.get("/{project_id}/share", response_model=schemas.ShareLinkOut)
def get_share_link(
    project_id: str,
    db: Session = Depends(get_db),
    _membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.LEADER)),
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    return schemas.ShareLinkOut(share_token=project.share_token, enabled=bool(project.share_token))


@router.post("/{project_id}/share", response_model=schemas.ShareLinkOut)
def create_share_link(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    _membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.LEADER)),
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    project.share_token = generate_secure_token()
    log_action(db, project_id, current_user.id, "project.share_enabled", project.name)
    db.commit()
    return schemas.ShareLinkOut(share_token=project.share_token, enabled=True)


@router.delete("/{project_id}/share", response_model=schemas.ShareLinkOut)
def revoke_share_link(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    _membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.LEADER)),
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    project.share_token = None
    log_action(db, project_id, current_user.id, "project.share_disabled", project.name)
    db.commit()
    return schemas.ShareLinkOut(share_token=None, enabled=False)


# ---------- Members ----------
@router.get("/{project_id}/members", response_model=list[schemas.MemberOut])
def list_members(
    project_id: str,
    db: Session = Depends(get_db),
    _membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.VIEWER)),
):
    members = db.query(models.ProjectMember).filter(models.ProjectMember.project_id == project_id).all()
    return [
        schemas.MemberOut(
            id=m.id, user_id=m.user_id, email=m.user.email, full_name=m.user.full_name,
            role=m.role, joined_at=m.joined_at,
        )
        for m in members
    ]


@router.post("/{project_id}/members", response_model=schemas.MemberOut, status_code=status.HTTP_201_CREATED)
def invite_member(
    project_id: str,
    payload: schemas.MemberInvite,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    _membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.LEADER)),
):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No user found with that email. They must register first.")
    existing = get_membership(db, project_id, user.id)
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "User is already a member of this project")

    member = models.ProjectMember(project_id=project_id, user_id=user.id, role=payload.role)
    db.add(member)
    log_action(db, project_id, current_user.id, "member.invite", user.email, {"role": payload.role.value})
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    notify(
        db, user.id, "member_added",
        f"{current_user.full_name} added you to \"{project.name}\" as {payload.role.value}",
        project_id=project_id, target=project.name,
    )
    db.commit()
    db.refresh(member)
    return schemas.MemberOut(
        id=member.id, user_id=user.id, email=user.email, full_name=user.full_name,
        role=member.role, joined_at=member.joined_at,
    )


@router.patch("/{project_id}/members/{member_id}", response_model=schemas.MemberOut)
def update_member_role(
    project_id: str,
    member_id: str,
    payload: schemas.MemberRoleUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    _membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.LEADER)),
):
    member = db.query(models.ProjectMember).filter(
        models.ProjectMember.id == member_id, models.ProjectMember.project_id == project_id
    ).first()
    if not member:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    member.role = payload.role
    log_action(db, project_id, current_user.id, "member.role_change", member.user.email, {"role": payload.role.value})
    notify(
        db, member.user_id, "role_change",
        f"{current_user.full_name} changed your role to {payload.role.value}",
        project_id=project_id, target=member.project.name if member.project else "",
    )
    db.commit()
    db.refresh(member)
    return schemas.MemberOut(
        id=member.id, user_id=member.user_id, email=member.user.email, full_name=member.user.full_name,
        role=member.role, joined_at=member.joined_at,
    )


@router.delete("/{project_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    project_id: str,
    member_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    _membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.LEADER)),
):
    member = db.query(models.ProjectMember).filter(
        models.ProjectMember.id == member_id, models.ProjectMember.project_id == project_id
    ).first()
    if not member:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    db.delete(member)
    log_action(db, project_id, current_user.id, "member.remove", member.user_id)
    db.commit()
    return None


# ---------- Audit log ----------
@router.get("/{project_id}/audit-log", response_model=list[schemas.AuditLogOut])
def get_audit_log(
    project_id: str,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    _membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.MEMBER)),
):
    page = max(1, page)
    page_size = min(max(1, page_size), 200)
    logs = (
        db.query(models.AuditLog)
        .filter(models.AuditLog.project_id == project_id)
        .order_by(models.AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return logs
