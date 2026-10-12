from datetime import date, datetime
from typing import Optional, Any

from pydantic import BaseModel, EmailStr, Field

from app.models import RoleEnum, NodeTypeEnum, EdgeTypeEnum, FreezeStatusEnum


# ---------- Auth ----------
class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    is_verified: bool = False

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=120)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class RegisterResponse(BaseModel):
    message: str
    email_sent: bool
    # Only populated when email_sent is False (dev mode / SMTP not
    # configured) - once real email delivery works, the token is never
    # returned over the API. Registration no longer returns login tokens:
    # the account must be verified before it can log in.
    verification_token: Optional[str] = None


class VerifyEmailRequest(BaseModel):
    token: str


class VerificationTokenOut(BaseModel):
    email_sent: bool
    verification_token: Optional[str] = None


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class ResendVerificationResponse(BaseModel):
    email_sent: bool
    verification_token: Optional[str] = None
    message: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetTokenOut(BaseModel):
    email_sent: bool
    reset_token: Optional[str] = None
    message: str


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class LoginEventOut(BaseModel):
    id: str
    success: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Projects ----------
class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = ""


class ProjectOut(BaseModel):
    id: str
    name: str
    description: str
    status: str
    owner_id: str
    created_at: datetime
    updated_at: datetime
    my_role: Optional[str] = None
    node_count: int = 0
    edge_count: int = 0
    member_count: int = 0

    class Config:
        from_attributes = True


class MemberInvite(BaseModel):
    email: EmailStr
    role: RoleEnum = RoleEnum.MEMBER


class MemberOut(BaseModel):
    id: str
    user_id: str
    email: str
    full_name: str
    role: RoleEnum
    joined_at: datetime

    class Config:
        from_attributes = True


class MemberRoleUpdate(BaseModel):
    role: RoleEnum


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None


class ShareLinkOut(BaseModel):
    share_token: Optional[str] = None
    enabled: bool


# ---------- OpenAPI import ----------
class OpenApiImportRequest(BaseModel):
    spec: dict[str, Any]
    version_label: str = "v1"


class OpenApiRawImportRequest(BaseModel):
    raw_text: str
    format: str = "auto"  # "json" | "yaml" | "auto"
    version_label: str = "v1"


class ImportSummary(BaseModel):
    spec_id: str
    title: str
    nodes_created: int
    edges_created: int
    endpoints_found: int
    schemas_found: int
    security_schemes_found: int


class ImportPreview(BaseModel):
    title: str
    endpoints_found: int
    schemas_found: int
    security_schemes_found: int
    endpoint_list: list[str]
    schema_list: list[str]
    security_scheme_list: list[str]
    warnings: list[str] = []


# ---------- Graph ----------
class NodeCreate(BaseModel):
    label: str = Field(min_length=1, max_length=200)
    node_type: NodeTypeEnum = NodeTypeEnum.CUSTOM
    description: str = ""
    method: Optional[str] = None
    path: Optional[str] = None
    pos_x: int = 0
    pos_y: int = 0
    owner_team: Optional[str] = Field(default=None, max_length=120)
    owner_contact: Optional[str] = Field(default=None, max_length=200)


class NodeUpdate(BaseModel):
    label: Optional[str] = None
    description: Optional[str] = None
    pos_x: Optional[int] = None
    pos_y: Optional[int] = None
    node_type: Optional[NodeTypeEnum] = None
    owner_team: Optional[str] = Field(default=None, max_length=120)
    owner_contact: Optional[str] = Field(default=None, max_length=200)
    deprecated: Optional[bool] = None
    sunset_date: Optional[date] = None
    deprecation_note: Optional[str] = Field(default=None, max_length=500)


class NodeOut(BaseModel):
    id: str
    label: str
    node_type: NodeTypeEnum
    description: str
    method: Optional[str]
    path: Optional[str]
    pos_x: int
    pos_y: int
    freeze_status: FreezeStatusEnum
    is_permanently_frozen: bool
    source: str
    owner_team: Optional[str] = None
    owner_contact: Optional[str] = None
    deprecated: bool = False
    sunset_date: Optional[date] = None
    deprecation_note: Optional[str] = None
    created_by: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class EdgeCreate(BaseModel):
    source_node_id: str
    target_node_id: str
    edge_type: EdgeTypeEnum = EdgeTypeEnum.DEPENDS_ON
    description: str = ""


class EdgeOut(BaseModel):
    id: str
    source_node_id: str
    target_node_id: str
    edge_type: EdgeTypeEnum
    description: str
    source_origin: str
    created_by: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class EdgeUpdate(BaseModel):
    edge_type: Optional[EdgeTypeEnum] = None
    description: Optional[str] = None


class GraphOut(BaseModel):
    nodes: list[NodeOut]
    edges: list[EdgeOut]


# ---------- Impact / Freeze ----------
class ImpactRequest(BaseModel):
    node_id: str
    direction: str = "dependents"   # "dependents" (who depends on this) | "dependencies" (what this depends on)
    depth: Optional[int] = None      # None = unlimited
    edge_types: Optional[list[EdgeTypeEnum]] = None  # "change impact mode" - restrict traversal to these edge types


class AffectedNode(BaseModel):
    node_id: str
    label: str
    depth: int                       # 1 = direct, 2+ = indirect
    path: list[str]                  # chain of labels from source to this node


class ImpactResult(BaseModel):
    source_node_id: str
    direction: str
    affected: list[AffectedNode]
    direct_count: int
    indirect_count: int
    total_affected: int


class FreezeApplyRequest(BaseModel):
    node_id: str
    direction: str = "dependents"
    depth: Optional[int] = None
    edge_types: Optional[list[EdgeTypeEnum]] = None
    permanent: bool = False


class UnfreezeRequest(BaseModel):
    node_id: str


# ---------- What-if simulation ----------
class SimulateRequest(BaseModel):
    node_id: str
    mode: str = "removal"   # "removal" | "failure"
    direction: str = "dependents"
    depth: Optional[int] = None


class SimulateResult(BaseModel):
    node_id: str
    mode: str
    affected: list[AffectedNode]
    orphaned: list[AffectedNode]   # subset of affected that would lose ALL of their dependencies
    total_affected: int
    total_orphaned: int


# ---------- Freeze plan ----------
class FreezePlanCreate(BaseModel):
    node_id: str
    direction: str = "dependents"
    depth: Optional[int] = None


class FreezePlanStepOut(BaseModel):
    id: str
    node_id: str
    label: str
    depth: int
    order_index: int
    status: str

    class Config:
        from_attributes = True


class FreezePlanOut(BaseModel):
    id: str
    target_node_id: str
    direction: str
    created_by: Optional[str]
    created_at: datetime
    steps: list[FreezePlanStepOut]

    class Config:
        from_attributes = True


class FreezePlanStepUpdate(BaseModel):
    status: str = Field(pattern="^(pending|frozen|testing|verified|unfrozen)$")


# ---------- Comments ----------
class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)
    is_suggestion: bool = False


class CommentOut(BaseModel):
    id: str
    node_id: str
    author_id: str
    author_name: str
    body: str
    mentioned_user_ids: list[str] = []
    is_suggestion: bool = False
    suggestion_status: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SuggestionReview(BaseModel):
    approve: bool


# ---------- OpenAPI version history ----------
class SpecVersionOut(BaseModel):
    id: str
    version_label: str
    title: str
    imported_by: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class SpecDiffResult(BaseModel):
    from_version: str
    to_version: str
    endpoints_added: list[str]
    endpoints_removed: list[str]
    schemas_added: list[str]
    schemas_removed: list[str]
    security_schemes_added: list[str]
    security_schemes_removed: list[str]


# ---------- Dependency path explorer ----------
class PathRequest(BaseModel):
    source_node_id: str
    target_node_id: str
    direction: str = "dependencies"  # which way to search


class PathResult(BaseModel):
    reachable: bool
    path: list[str] = []          # node ids, source -> target
    path_labels: list[str] = []
    length: int = 0

class AuditLogOut(BaseModel):
    id: str
    user_id: Optional[str]
    action: str
    target: str
    meta: dict
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Notifications ----------
class NotificationOut(BaseModel):
    id: str
    project_id: Optional[str]
    type: str
    message: str
    target: str
    read: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Graph snapshots ----------
class SnapshotCreate(BaseModel):
    label: str = Field(min_length=1, max_length=200)


class SnapshotOut(BaseModel):
    id: str
    label: str
    node_count: int
    edge_count: int
    created_by: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class SnapshotDiff(BaseModel):
    nodes_added: list[str]
    nodes_removed: list[str]
    edges_added: int
    edges_removed: int


# ---------- Findings ----------
class Finding(BaseModel):
    id: str
    severity: str  # "high" | "medium" | "low"
    title: str
    description: str
    remediation: str
    node_id: Optional[str] = None
    node_label: Optional[str] = None


class FindingsResponse(BaseModel):
    findings: list[Finding]
    high_count: int
    medium_count: int
    low_count: int


# ---------- Risk score ----------
class RiskFactor(BaseModel):
    label: str
    points: int
    detail: str


class NodeRisk(BaseModel):
    node_id: str
    label: str
    node_type: str
    score: int                 # 0-100
    level: str                 # "low" | "medium" | "high" | "critical"
    dependents_direct: int
    dependents_total: int
    factors: list[RiskFactor]


class RiskResponse(BaseModel):
    nodes: list[NodeRisk]      # highest score first
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    owned_count: int           # nodes with an owner team or contact
    total_nodes: int


# ---------- Security view ----------
class SecurityEndpoint(BaseModel):
    node_id: str
    label: str


class SecurityScheme(BaseModel):
    node_id: str
    label: str
    description: str
    endpoint_count: int


class SensitiveSchema(BaseModel):
    node_id: str
    label: str
    category: str              # "credentials" | "payment" | "personal"
    endpoint_count: int
    exposed_endpoints: list[SecurityEndpoint]   # use it with NO auth requirement


class SecurityResponse(BaseModel):
    endpoints_total: int
    endpoints_protected: int
    coverage_percent: int
    unprotected: list[SecurityEndpoint]
    schemes: list[SecurityScheme]
    sensitive_schemas: list[SensitiveSchema]
    exposed_sensitive_count: int


# ---------- Removal check ----------
class RemovalDependent(BaseModel):
    node_id: str
    label: str
    edge_type: str


class RemovalCheck(BaseModel):
    node_id: str
    label: str
    verdict: str               # "safe" | "blocked"
    reasons: list[str]
    direct_dependents: list[RemovalDependent]
    total_dependents: int
    would_be_orphaned: list[str]   # labels of nodes left with no dependencies at all


# ---------- Deprecations ----------
class DeprecatedNode(BaseModel):
    node_id: str
    label: str
    node_type: str
    sunset_date: Optional[date]
    days_left: Optional[int]
    note: Optional[str]
    owner_team: Optional[str]
    owner_contact: Optional[str]
    status: str                # "safe_to_remove" | "in_use" | "overdue"
    direct_dependents: list[SecurityEndpoint]
    total_dependents: int


# ---------- Time travel ----------
class TimelineNode(BaseModel):
    id: str
    label: str
    node_type: str
    description: str = ""
    method: Optional[str] = None
    path: Optional[str] = None
    pos_x: int = 0
    pos_y: int = 0
    freeze_status: str = "active"
    is_permanently_frozen: bool = False
    source: str = "snapshot"


class TimelineEdge(BaseModel):
    id: str
    source_node_id: str
    target_node_id: str
    edge_type: str
    description: str = ""


class TimelineFrame(BaseModel):
    id: str
    label: str
    created_at: datetime
    nodes: list[TimelineNode]
    edges: list[TimelineEdge]
