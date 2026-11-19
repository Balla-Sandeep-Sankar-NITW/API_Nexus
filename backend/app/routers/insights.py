"""Read-only analysis over a project's graph: risk, security, removal safety,
deprecations and the snapshot timeline.

Everything here is derived from the graph as it stands (plus ownership and
deprecation fields on nodes). The heuristics are deliberately simple and
explainable: each risk score comes with the factors that produced it, and the
security view is name- and structure-based, not a security audit.
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import require_project_role
from app.utils.graph_analysis import Edge as AnalysisEdge, compute_impact, find_orphaned

router = APIRouter(prefix="/api/projects/{project_id}", tags=["insights"])

VIEWER = models.RoleEnum.VIEWER

# ---------- shared helpers ----------
def _load(db: Session, project_id: str):
    nodes = db.query(models.GraphNode).filter(models.GraphNode.project_id == project_id).all()
    rows = db.query(models.GraphEdge).filter(models.GraphEdge.project_id == project_id).all()
    edges = [
        AnalysisEdge(id=r.id, source_node_id=r.source_node_id, target_node_id=r.target_node_id, edge_type=r.edge_type.value)
        for r in rows
    ]
    return nodes, edges


def _type(node: models.GraphNode) -> str:
    return node.node_type.value


def _has_owner(node: models.GraphNode) -> bool:
    return bool((node.owner_team or "").strip() or (node.owner_contact or "").strip())


# ---------- Risk score ----------
def _level(score: int) -> str:
    if score >= 75:
        return "critical"
    if score >= 50:
        return "high"
    if score >= 25:
        return "medium"
    return "low"


@router.get("/risk", response_model=schemas.RiskResponse)
def get_risk(project_id: str, db: Session = Depends(get_db), _m: models.ProjectMember = Depends(require_project_role(VIEWER))):
    """Explainable 0-100 risk score per node. Points come from blast radius
    (what breaks if it fails), how deep failures ripple, missing authentication
    on endpoints, missing ownership, and being deprecated while still in use."""
    nodes, edges = _load(db, project_id)
    authed = {e.source_node_id for e in edges if e.edge_type == "uses_auth"}

    out: list[schemas.NodeRisk] = []
    for n in nodes:
        dependents = compute_impact(n.id, edges, "dependents")
        total = len(dependents)
        direct = sum(1 for a in dependents if a.depth == 1)
        height = max((a.depth for a in dependents), default=0)

        factors: list[schemas.RiskFactor] = []
        if total:
            factors.append(schemas.RiskFactor(
                label="Blast radius", points=min(40, total * 5),
                detail=f"{total} component{'s' if total != 1 else ''} depend on it, directly or indirectly"))
        if direct:
            factors.append(schemas.RiskFactor(
                label="Direct dependents", points=min(15, direct * 3),
                detail=f"{direct} component{'s' if direct != 1 else ''} use it directly"))
        if height >= 2:
            factors.append(schemas.RiskFactor(
                label="Deep dependency chain", points=min(10, height * 3),
                detail=f"A failure can ripple {height} levels deep"))
        if _type(n) == "api" and n.id not in authed:
            factors.append(schemas.RiskFactor(
                label="No authentication", points=15, detail="This endpoint doesn't require any auth scheme"))
        if total and not _has_owner(n):
            factors.append(schemas.RiskFactor(
                label="No owner", points=10, detail="Other components depend on it, but no team or contact is assigned"))
        if n.deprecated and total:
            factors.append(schemas.RiskFactor(
                label="Deprecated but in use", points=10, detail="Marked deprecated while components still depend on it"))

        score = min(100, sum(f.points for f in factors))
        out.append(schemas.NodeRisk(
            node_id=n.id, label=n.label, node_type=_type(n), score=score, level=_level(score),
            dependents_direct=direct, dependents_total=total, factors=factors,
        ))

    out.sort(key=lambda r: (-r.score, r.label))
    counts = {lvl: sum(1 for r in out if r.level == lvl) for lvl in ("critical", "high", "medium", "low")}
    return schemas.RiskResponse(
        nodes=out,
        critical_count=counts["critical"], high_count=counts["high"],
        medium_count=counts["medium"], low_count=counts["low"],
        owned_count=sum(1 for n in nodes if _has_owner(n)), total_nodes=len(nodes),
    )


# ---------- Security view ----------
# Name-based hints for schemas likely to carry sensitive data. Checked in order,
# first match wins. These are hints to look at, not proof of what a schema holds.
SENSITIVE_KEYWORDS = [
    ("credentials", ["password", "passwd", "secret", "token", "credential", "apikey", "api_key", "privatekey"]),
    ("payment", ["card", "payment", "billing", "bank", "iban", "invoice", "payout", "wallet"]),
    ("personal", ["user", "customer", "profile", "address", "email", "phone", "person", "patient", "ssn", "account", "member"]),
]


def _sensitive_category(label: str) -> str | None:
    lowered = label.lower()
    for category, words in SENSITIVE_KEYWORDS:
        if any(w in lowered for w in words):
            return category
    return None


@router.get("/security", response_model=schemas.SecurityResponse)
def get_security(project_id: str, db: Session = Depends(get_db), _m: models.ProjectMember = Depends(require_project_role(VIEWER))):
    nodes, edges = _load(db, project_id)
    by_id = {n.id: n for n in nodes}
    authed = {e.source_node_id for e in edges if e.edge_type == "uses_auth"}

    endpoints = [n for n in nodes if _type(n) == "api"]
    unprotected = [n for n in endpoints if n.id not in authed]
    total = len(endpoints)

    schemes = []
    for n in nodes:
        if _type(n) != "auth":
            continue
        users = {e.source_node_id for e in edges if e.edge_type == "uses_auth" and e.target_node_id == n.id}
        schemes.append(schemas.SecurityScheme(node_id=n.id, label=n.label, description=n.description or "", endpoint_count=len(users)))
    schemes.sort(key=lambda s: -s.endpoint_count)

    sensitive = []
    for n in nodes:
        if _type(n) != "schema":
            continue
        category = _sensitive_category(n.label)
        if not category:
            continue
        users = {
            e.source_node_id for e in edges
            if e.edge_type == "uses_schema" and e.target_node_id == n.id and e.source_node_id in by_id and _type(by_id[e.source_node_id]) == "api"
        }
        exposed = [by_id[i] for i in users if i not in authed]
        sensitive.append(schemas.SensitiveSchema(
            node_id=n.id, label=n.label, category=category, endpoint_count=len(users),
            exposed_endpoints=[schemas.SecurityEndpoint(node_id=e.id, label=e.label) for e in sorted(exposed, key=lambda x: x.label)],
        ))
    sensitive.sort(key=lambda s: (-len(s.exposed_endpoints), s.label))

    return schemas.SecurityResponse(
        endpoints_total=total,
        endpoints_protected=total - len(unprotected),
        coverage_percent=round(100 * (total - len(unprotected)) / total) if total else 0,
        unprotected=[schemas.SecurityEndpoint(node_id=n.id, label=n.label) for n in sorted(unprotected, key=lambda x: x.label)],
        schemes=schemes,
        sensitive_schemas=sensitive,
        exposed_sensitive_count=sum(1 for s in sensitive if s.exposed_endpoints),
    )


# ---------- Safe to remove? ----------
@router.get("/nodes/{node_id}/removal-check", response_model=schemas.RemovalCheck)
def removal_check(node_id: str, project_id: str, db: Session = Depends(get_db), _m: models.ProjectMember = Depends(require_project_role(VIEWER))):
    """Node-level answer to "can I delete this?". The graph records which
    components depend on this one, not which fields they read, so it can't say
    a single field is unused."""
    nodes, edges = _load(db, project_id)
    by_id = {n.id: n for n in nodes}
    node = by_id.get(node_id)
    if not node:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Node not found")

    dependents = compute_impact(node_id, edges, "dependents")
    direct, seen = [], set()
    for e in edges:
        if e.target_node_id == node_id and e.source_node_id not in seen and e.source_node_id in by_id:
            seen.add(e.source_node_id)
            direct.append(schemas.RemovalDependent(node_id=e.source_node_id, label=by_id[e.source_node_id].label, edge_type=e.edge_type))
    direct.sort(key=lambda d: d.label)
    orphaned = [by_id[a.node_id].label for a in find_orphaned(node_id, dependents, edges) if a.node_id in by_id]

    reasons: list[str] = []
    if dependents:
        reasons.append(
            f"{len(direct)} component{'s' if len(direct) != 1 else ''} depend on it directly; "
            f"{len(dependents)} in total would be affected."
        )
    if node.is_permanently_frozen:
        reasons.append("It is under a permanent project freeze.")
    if not reasons:
        reasons.append("Nothing in the graph depends on it.")
    return schemas.RemovalCheck(
        node_id=node.id, label=node.label,
        verdict="blocked" if (dependents or node.is_permanently_frozen) else "safe",
        reasons=reasons, direct_dependents=direct, total_dependents=len(dependents), would_be_orphaned=sorted(orphaned),
    )


# ---------- Deprecations ----------
_STATUS_ORDER = {"overdue": 0, "in_use": 1, "safe_to_remove": 2}


@router.get("/deprecations", response_model=list[schemas.DeprecatedNode])
def list_deprecations(project_id: str, db: Session = Depends(get_db), _m: models.ProjectMember = Depends(require_project_role(VIEWER))):
    nodes, edges = _load(db, project_id)
    by_id = {n.id: n for n in nodes}
    today = date.today()

    out = []
    for n in nodes:
        if not n.deprecated:
            continue
        dependents = compute_impact(n.id, edges, "dependents")
        direct_ids = sorted({e.source_node_id for e in edges if e.target_node_id == n.id and e.source_node_id in by_id},
                            key=lambda i: by_id[i].label)
        if not dependents:
            state = "safe_to_remove"
        elif n.sunset_date and n.sunset_date < today:
            state = "overdue"
        else:
            state = "in_use"
        out.append(schemas.DeprecatedNode(
            node_id=n.id, label=n.label, node_type=_type(n), sunset_date=n.sunset_date,
            days_left=(n.sunset_date - today).days if n.sunset_date else None,
            note=n.deprecation_note, owner_team=n.owner_team, owner_contact=n.owner_contact,
            status=state,
            direct_dependents=[schemas.SecurityEndpoint(node_id=i, label=by_id[i].label) for i in direct_ids],
            total_dependents=len(dependents),
        ))
    out.sort(key=lambda d: (_STATUS_ORDER[d.status], d.sunset_date is None, d.sunset_date or date.max, d.label))
    return out


# ---------- Time travel ----------
@router.get("/timeline", response_model=list[schemas.TimelineFrame])
def get_timeline(project_id: str, db: Session = Depends(get_db), _m: models.ProjectMember = Depends(require_project_role(VIEWER))):
    """Every saved snapshot with its full graph, oldest first, so the UI can
    replay how the architecture changed. The live graph is added client-side."""
    snapshots = (
        db.query(models.GraphSnapshot)
        .filter(models.GraphSnapshot.project_id == project_id)
        .order_by(models.GraphSnapshot.created_at.asc())
        .all()
    )
    return [
        schemas.TimelineFrame(
            id=s.id, label=s.label, created_at=s.created_at,
            nodes=[schemas.TimelineNode(**n) for n in s.nodes_json],
            edges=[schemas.TimelineEdge(**e) for e in s.edges_json],
        )
        for s in snapshots
    ]
