"""API Explorer: describe the operations in an imported spec, and send test requests.

Reading is open to everyone on the project. Sending requires member or leader, because it
makes real calls to real APIs, on the person's behalf, from this server."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.deps import require_project_role
from app.utils.openapi_operations import extract_operations
from app.utils.tryit import TryItError, send

router = APIRouter(prefix="/api/projects/{project_id}", tags=["explorer"])


class SpecInfo(BaseModel):
    id: str
    title: str
    version_label: str
    created_at: datetime


class OperationsResponse(BaseModel):
    spec: Optional[SpecInfo] = None        # None until an OpenAPI spec has been imported
    servers: list[dict] = []
    security_schemes: list[dict] = []
    operations: list[dict] = []


@router.get("/openapi/operations", response_model=OperationsResponse)
def list_operations(
    project_id: str,
    spec_id: Optional[str] = None,
    db: Session = Depends(get_db),
    _m: models.ProjectMember = Depends(require_project_role(models.RoleEnum.VIEWER)),
):
    """Every operation in the latest imported spec (or `spec_id`), ready to build a request form from."""
    q = db.query(models.OpenApiSpec).filter(models.OpenApiSpec.project_id == project_id)
    if spec_id:
        q = q.filter(models.OpenApiSpec.id == spec_id)
    spec = q.order_by(models.OpenApiSpec.created_at.desc()).first()
    if not spec:
        if spec_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Import version not found")
        return OperationsResponse()
    info = SpecInfo(id=spec.id, title=spec.title, version_label=spec.version_label, created_at=spec.created_at)
    return OperationsResponse(spec=info, **extract_operations(spec.raw_spec))


class TryItRequest(BaseModel):
    method: str = Field(max_length=10)
    url: str = Field(max_length=4000)
    headers: dict[str, str] = {}
    body: Optional[str] = Field(default=None, max_length=1_100_000)
    timeout_seconds: Optional[float] = Field(default=None, ge=1, le=30)


class TryItResponse(BaseModel):
    status: int
    reason: str
    elapsed_ms: int
    size_bytes: int
    truncated: bool
    content_type: Optional[str] = None
    headers: list[list[str]]
    body: Optional[str] = None      # None for binary responses
    binary: bool
    url: str


@router.post("/try-it", response_model=TryItResponse)
def try_it(
    project_id: str,
    payload: TryItRequest,
    membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.MEMBER)),
):
    try:
        return send(payload.method, payload.url, payload.headers, payload.body, payload.timeout_seconds, membership.user_id, project_id)
    except TryItError as err:
        raise HTTPException(err.status, err.message)
