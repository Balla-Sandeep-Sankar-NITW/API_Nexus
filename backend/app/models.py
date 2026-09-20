import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, DateTime, ForeignKey, Enum, Boolean, Text, JSON, Integer, UniqueConstraint
)
from sqlalchemy.orm import relationship

from app.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class RoleEnum(str, enum.Enum):
    LEADER = "leader"
    MEMBER = "member"
    VIEWER = "viewer"


class NodeTypeEnum(str, enum.Enum):
    API = "api"
    SCHEMA = "schema"
    AUTH = "auth"
    SERVICE = "service"
    DATABASE = "database"
    EXTERNAL = "external"
    CUSTOM = "custom"


class EdgeTypeEnum(str, enum.Enum):
    USES_SCHEMA = "uses_schema"
    USES_AUTH = "uses_auth"
    DEPENDS_ON = "depends_on"
    CALLS = "calls"
    CUSTOM = "custom"


class FreezeStatusEnum(str, enum.Enum):
    ACTIVE = "active"
    FROZEN = "frozen"
    IMPACTED = "impacted"


class FreezePlanStepStatusEnum(str, enum.Enum):
    PENDING = "pending"
    FROZEN = "frozen"
    TESTING = "testing"
    VERIFIED = "verified"
    UNFROZEN = "unfrozen"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    verification_token = Column(String, nullable=True, index=True)
    reset_token = Column(String, nullable=True, index=True)
    reset_token_expires = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    memberships = relationship("ProjectMember", back_populates="user", cascade="all, delete-orphan")


class LoginEvent(Base):
    __tablename__ = "login_events"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    success = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    type = Column(String, nullable=False)   # mention | role_change | member_added | node_frozen | spec_imported | suggestion
    message = Column(String, nullable=False)
    target = Column(String, default="")
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    status = Column(String, default="active")  # active | archived
    share_token = Column(String, nullable=True, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    nodes = relationship("GraphNode", back_populates="project", cascade="all, delete-orphan")
    edges = relationship("GraphEdge", back_populates="project", cascade="all, delete-orphan")
    specs = relationship("OpenApiSpec", back_populates="project", cascade="all, delete-orphan")


class ProjectMember(Base):
    __tablename__ = "project_members"
    __table_args__ = (UniqueConstraint("project_id", "user_id", name="uq_project_user"),)

    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    role = Column(Enum(RoleEnum), nullable=False, default=RoleEnum.MEMBER)
    joined_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="members")
    user = relationship("User", back_populates="memberships")


class OpenApiSpec(Base):
    __tablename__ = "openapi_specs"

    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    version_label = Column(String, default="v1")
    raw_spec = Column(JSON, nullable=False)
    title = Column(String, default="")
    imported_by = Column(String, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="specs")


class GraphNode(Base):
    __tablename__ = "graph_nodes"

    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    label = Column(String, nullable=False)
    node_type = Column(Enum(NodeTypeEnum), nullable=False, default=NodeTypeEnum.CUSTOM)
    description = Column(Text, default="")
    method = Column(String, nullable=True)      # for API nodes: GET/POST/etc
    path = Column(String, nullable=True)         # for API nodes
    pos_x = Column(Integer, default=0)
    pos_y = Column(Integer, default=0)
    freeze_status = Column(Enum(FreezeStatusEnum), default=FreezeStatusEnum.ACTIVE)
    is_permanently_frozen = Column(Boolean, default=False)
    source = Column(String, default="manual")    # "openapi" | "manual"
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="nodes")
    comments = relationship("Comment", back_populates="node", cascade="all, delete-orphan")


class GraphEdge(Base):
    __tablename__ = "graph_edges"

    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    source_node_id = Column(String, ForeignKey("graph_nodes.id"), nullable=False)
    target_node_id = Column(String, ForeignKey("graph_nodes.id"), nullable=False)
    edge_type = Column(Enum(EdgeTypeEnum), nullable=False, default=EdgeTypeEnum.DEPENDS_ON)
    description = Column(Text, default="")
    source_origin = Column(String, default="manual")  # "openapi" | "manual"
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="edges")


class Comment(Base):
    __tablename__ = "comments"

    id = Column(String, primary_key=True, default=gen_uuid)
    node_id = Column(String, ForeignKey("graph_nodes.id"), nullable=False)
    author_id = Column(String, ForeignKey("users.id"), nullable=False)
    body = Column(Text, nullable=False)
    mentioned_user_ids = Column(JSON, default=list)
    is_suggestion = Column(Boolean, default=False)
    suggestion_status = Column(String, nullable=True)  # pending | approved | rejected
    created_at = Column(DateTime, default=datetime.utcnow)

    node = relationship("GraphNode", back_populates="comments")


class GraphSnapshot(Base):
    __tablename__ = "graph_snapshots"

    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    label = Column(String, nullable=False)
    nodes_json = Column(JSON, nullable=False)
    edges_json = Column(JSON, nullable=False)
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class FreezePlan(Base):
    __tablename__ = "freeze_plans"

    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    target_node_id = Column(String, ForeignKey("graph_nodes.id"), nullable=False)
    direction = Column(String, default="dependents")
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    steps = relationship("FreezePlanStep", back_populates="plan", cascade="all, delete-orphan", order_by="FreezePlanStep.order_index")


class FreezePlanStep(Base):
    __tablename__ = "freeze_plan_steps"

    id = Column(String, primary_key=True, default=gen_uuid)
    plan_id = Column(String, ForeignKey("freeze_plans.id"), nullable=False)
    node_id = Column(String, ForeignKey("graph_nodes.id"), nullable=False)
    label = Column(String, nullable=False)
    depth = Column(Integer, default=1)
    order_index = Column(Integer, default=0)
    status = Column(Enum(FreezePlanStepStatusEnum), default=FreezePlanStepStatusEnum.PENDING)

    plan = relationship("FreezePlan", back_populates="steps")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)       # e.g. "node.create", "spec.import", "node.freeze"
    target = Column(String, default="")
    meta = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
