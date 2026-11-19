from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import require_project_role
from app.utils.audit import log_action
from app.utils.notify import notify_project_members, notify, notify_owners
from app.utils.graph_analysis import compute_impact, find_orphaned, Edge as AnalysisEdge

router = APIRouter(prefix="/api/projects/{project_id}", tags=["graph"])


# ---------- Graph read ----------
@router.get("/graph", response_model=schemas.GraphOut)
def get_graph(
    project_id: str,
    db: Session = Depends(get_db),
    _membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.VIEWER)),
):
    nodes = db.query(models.GraphNode).filter(models.GraphNode.project_id == project_id).all()
    edges = db.query(models.GraphEdge).filter(models.GraphEdge.project_id == project_id).all()
    return schemas.GraphOut(nodes=nodes, edges=edges)


def _edge_name(db: Session, source_id: str, target_id: str) -> str:
    """Readable name for the activity log: "Orders API → Payments Service", not two UUIDs."""
    labels = {
        n.id: n.label
        for n in db.query(models.GraphNode).filter(models.GraphNode.id.in_([source_id, target_id])).all()
    }
    return f"{labels.get(source_id, 'a deleted node')} → {labels.get(target_id, 'a deleted node')}"


def _clean(value: str | None) -> str | None:
    """Blank strings from the UI mean "no value"."""
    value = (value or "").strip()
    return value or None


def _purge_node_references(db: Session, project_id: str, node_ids: list[str] | None = None):
    """Delete the comments and freeze plans/steps that point at graph nodes, so the
    nodes themselves can be deleted. Without this, a database that enforces foreign
    keys (Postgres) refuses the delete, and SQLite is left with plans for nodes that
    no longer exist. node_ids=None means every node in the project."""
    node_q = db.query(models.GraphNode.id).filter(models.GraphNode.project_id == project_id)
    if node_ids is not None:
        node_q = node_q.filter(models.GraphNode.id.in_(node_ids))
    ids = [row[0] for row in node_q.all()]
    if not ids:
        return
    db.query(models.Comment).filter(models.Comment.node_id.in_(ids)).delete(synchronize_session=False)
    # steps in other plans that mention these nodes
    db.query(models.FreezePlanStep).filter(models.FreezePlanStep.node_id.in_(ids)).delete(synchronize_session=False)
    # plans whose target is one of these nodes (their remaining steps go with them)
    for plan in db.query(models.FreezePlan).filter(models.FreezePlan.target_node_id.in_(ids)).all():
        db.delete(plan)
    db.flush()


# ---------- Node CRUD ----------
@router.post("/nodes", response_model=schemas.NodeOut, status_code=status.HTTP_201_CREATED)
def create_node(
    project_id: str,
    payload: schemas.NodeCreate,
    db: Session = Depends(get_db),
    membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.MEMBER)),
):
    node = models.GraphNode(
        project_id=project_id,
        label=payload.label,
        node_type=payload.node_type,
        description=payload.description,
        method=payload.method,
        path=payload.path,
        pos_x=payload.pos_x,
        pos_y=payload.pos_y,
        owner_team=_clean(payload.owner_team),
        owner_contact=_clean(payload.owner_contact),
        source="manual",
        created_by=membership.user_id,
    )
    db.add(node)
    log_action(db, project_id, membership.user_id, "node.create", payload.label)
    db.commit()
    db.refresh(node)
    return node


@router.patch("/nodes/{node_id}", response_model=schemas.NodeOut)
def update_node(
    project_id: str,
    node_id: str,
    payload: schemas.NodeUpdate,
    db: Session = Depends(get_db),
    membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.MEMBER)),
):
    node = db.query(models.GraphNode).filter(
        models.GraphNode.id == node_id, models.GraphNode.project_id == project_id
    ).first()
    if not node:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Node not found")
    was_deprecated = bool(node.deprecated)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "deprecated" and value is None:
            continue  # NOT NULL column; null just means "unchanged"
        if field in ("owner_team", "owner_contact", "deprecation_note"):
            value = _clean(value)
        setattr(node, field, value)
    if not node.deprecated:
        node.sunset_date = None
        node.deprecation_note = None
    # Auto-arranging or dragging a node only changes its position. Logging each of
    # those as an "update" buries real changes in the activity history.
    if set(payload.model_dump(exclude_unset=True)) - {"pos_x", "pos_y"}:
        log_action(db, project_id, membership.user_id, "node.update", node.label)

    # Newly deprecated: tell the owners of everything that still depends on it.
    if node.deprecated and not was_deprecated:
        dependent_ids = [a.node_id for a in compute_impact(node_id, _load_edges(db, project_id), "dependents")]
        if dependent_ids:
            dependents = db.query(models.GraphNode).filter(models.GraphNode.id.in_(dependent_ids)).all()
            when = f" (sunset {node.sunset_date.isoformat()})" if node.sunset_date else ""
            notify_owners(
                db, project_id, dependents, membership.user_id, "owner_alert",
                lambda labels: f"{node.label} is deprecated{when}. You own components that depend on it: "
                               + ", ".join(labels[:3]) + ("…" if len(labels) > 3 else ""),
                target=node.label,
            )
        log_action(db, project_id, membership.user_id, "node.deprecate", node.label)
    db.commit()
    db.refresh(node)
    return node


@router.delete("/nodes/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_node(
    project_id: str,
    node_id: str,
    db: Session = Depends(get_db),
    membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.LEADER)),
):
    node = db.query(models.GraphNode).filter(
        models.GraphNode.id == node_id, models.GraphNode.project_id == project_id
    ).first()
    if not node:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Node not found")
    db.query(models.GraphEdge).filter(
        (models.GraphEdge.source_node_id == node_id) | (models.GraphEdge.target_node_id == node_id)
    ).delete(synchronize_session=False)
    _purge_node_references(db, project_id, [node_id])
    db.delete(node)
    log_action(db, project_id, membership.user_id, "node.delete", node.label)
    db.commit()
    return None


# ---------- Edge CRUD ----------
@router.post("/edges", response_model=schemas.EdgeOut, status_code=status.HTTP_201_CREATED)
def create_edge(
    project_id: str,
    payload: schemas.EdgeCreate,
    db: Session = Depends(get_db),
    membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.MEMBER)),
):
    if payload.source_node_id == payload.target_node_id:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A node cannot depend on itself")
    for nid in (payload.source_node_id, payload.target_node_id):
        exists = db.query(models.GraphNode).filter(
            models.GraphNode.id == nid, models.GraphNode.project_id == project_id
        ).first()
        if not exists:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Node {nid} not found in this project")

    edge = models.GraphEdge(
        project_id=project_id,
        source_node_id=payload.source_node_id,
        target_node_id=payload.target_node_id,
        edge_type=payload.edge_type,
        description=payload.description,
        source_origin="manual",
        created_by=membership.user_id,
    )
    db.add(edge)
    log_action(db, project_id, membership.user_id, "edge.create", _edge_name(db, payload.source_node_id, payload.target_node_id))
    db.commit()
    db.refresh(edge)
    return edge


@router.patch("/edges/{edge_id}", response_model=schemas.EdgeOut)
def update_edge(
    project_id: str,
    edge_id: str,
    payload: schemas.EdgeUpdate,
    db: Session = Depends(get_db),
    membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.MEMBER)),
):
    edge = db.query(models.GraphEdge).filter(
        models.GraphEdge.id == edge_id, models.GraphEdge.project_id == project_id
    ).first()
    if not edge:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Edge not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(edge, field, value)
    log_action(db, project_id, membership.user_id, "edge.update", _edge_name(db, edge.source_node_id, edge.target_node_id))
    db.commit()
    db.refresh(edge)
    return edge


@router.delete("/edges/{edge_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_edge(
    project_id: str,
    edge_id: str,
    db: Session = Depends(get_db),
    membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.MEMBER)),
):
    edge = db.query(models.GraphEdge).filter(
        models.GraphEdge.id == edge_id, models.GraphEdge.project_id == project_id
    ).first()
    if not edge:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Edge not found")
    name = _edge_name(db, edge.source_node_id, edge.target_node_id)
    db.delete(edge)
    log_action(db, project_id, membership.user_id, "edge.delete", name)
    db.commit()
    return None


# ---------- Impact / Freeze analysis ----------
def _load_edges(db: Session, project_id: str) -> list[AnalysisEdge]:
    rows = db.query(models.GraphEdge).filter(models.GraphEdge.project_id == project_id).all()
    return [
        AnalysisEdge(id=r.id, source_node_id=r.source_node_id, target_node_id=r.target_node_id, edge_type=r.edge_type.value)
        for r in rows
    ]


def _node_label_map(db: Session, project_id: str) -> dict[str, str]:
    rows = db.query(models.GraphNode).filter(models.GraphNode.project_id == project_id).all()
    return {r.id: r.label for r in rows}


@router.post("/impact/preview", response_model=schemas.ImpactResult)
def preview_impact(
    project_id: str,
    payload: schemas.ImpactRequest,
    db: Session = Depends(get_db),
    _membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.VIEWER)),
):
    node = db.query(models.GraphNode).filter(
        models.GraphNode.id == payload.node_id, models.GraphNode.project_id == project_id
    ).first()
    if not node:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Node not found")

    edges = _load_edges(db, project_id)
    labels = _node_label_map(db, project_id)
    edge_type_values = [t.value for t in payload.edge_types] if payload.edge_types else None
    affected = compute_impact(payload.node_id, edges, payload.direction, payload.depth, edge_type_values)

    affected_out = [
        schemas.AffectedNode(
            node_id=a.node_id, label=labels.get(a.node_id, "Unknown"), depth=a.depth,
            path=[labels.get(pid, pid) for pid in a.path],
        )
        for a in affected
    ]
    direct = sum(1 for a in affected if a.depth == 1)
    indirect = sum(1 for a in affected if a.depth > 1)

    return schemas.ImpactResult(
        source_node_id=payload.node_id,
        direction=payload.direction,
        affected=affected_out,
        direct_count=direct,
        indirect_count=indirect,
        total_affected=len(affected_out),
    )


@router.post("/freeze/apply", response_model=schemas.ImpactResult)
def apply_freeze(
    project_id: str,
    payload: schemas.FreezeApplyRequest,
    db: Session = Depends(get_db),
    membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.MEMBER)),
):
    node = db.query(models.GraphNode).filter(
        models.GraphNode.id == payload.node_id, models.GraphNode.project_id == project_id
    ).first()
    if not node:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Node not found")
    if payload.permanent and membership.role != models.RoleEnum.LEADER:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only a Team Leader can apply a permanent freeze")

    edges = _load_edges(db, project_id)
    labels = _node_label_map(db, project_id)
    edge_type_values = [t.value for t in payload.edge_types] if payload.edge_types else None
    affected = compute_impact(payload.node_id, edges, payload.direction, payload.depth, edge_type_values)

    node.freeze_status = models.FreezeStatusEnum.FROZEN
    if payload.permanent:
        node.is_permanently_frozen = True
    affected_nodes = []
    for a in affected:
        target = db.query(models.GraphNode).filter(models.GraphNode.id == a.node_id).first()
        if target:
            target.freeze_status = models.FreezeStatusEnum.IMPACTED
            affected_nodes.append(target)

    log_action(
        db, project_id, membership.user_id,
        "node.freeze" if not payload.permanent else "node.freeze_permanent",
        node.label, {"affected_count": len(affected), "direction": payload.direction},
    )
    if payload.permanent:
        notify_project_members(
            db, project_id, membership.user_id, "node_frozen",
            f"{node.label} was permanently frozen — {len(affected)} service(s) affected",
            target=node.label,
        )
        # Owners of the affected components get a more specific alert.
        notify_owners(
            db, project_id, [node, *affected_nodes], membership.user_id, "owner_alert",
            lambda labels: f"{node.label} was permanently frozen. You own affected components: "
                           + ", ".join(labels[:3]) + ("…" if len(labels) > 3 else ""),
            target=node.label,
        )
    db.commit()

    affected_out = [
        schemas.AffectedNode(
            node_id=a.node_id, label=labels.get(a.node_id, "Unknown"), depth=a.depth,
            path=[labels.get(pid, pid) for pid in a.path],
        )
        for a in affected
    ]
    return schemas.ImpactResult(
        source_node_id=payload.node_id,
        direction=payload.direction,
        affected=affected_out,
        direct_count=sum(1 for a in affected if a.depth == 1),
        indirect_count=sum(1 for a in affected if a.depth > 1),
        total_affected=len(affected_out),
    )


@router.post("/freeze/unfreeze", status_code=status.HTTP_200_OK)
def unfreeze(
    project_id: str,
    payload: schemas.UnfreezeRequest,
    db: Session = Depends(get_db),
    membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.MEMBER)),
):
    node = db.query(models.GraphNode).filter(
        models.GraphNode.id == payload.node_id, models.GraphNode.project_id == project_id
    ).first()
    if not node:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Node not found")
    if node.is_permanently_frozen and membership.role != models.RoleEnum.LEADER:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only a Team Leader can lift a permanent freeze")

    # Reset this node and every currently-impacted node back to active.
    # (Simple model: only one freeze "session" active at a time per project.)
    all_nodes = db.query(models.GraphNode).filter(models.GraphNode.project_id == project_id).all()
    for n in all_nodes:
        if n.freeze_status != models.FreezeStatusEnum.ACTIVE:
            n.freeze_status = models.FreezeStatusEnum.ACTIVE
    node.is_permanently_frozen = False

    log_action(db, project_id, membership.user_id, "node.unfreeze", node.label)
    db.commit()
    return {"status": "unfrozen"}


@router.post("/path", response_model=schemas.PathResult)
def find_dependency_path(
    project_id: str,
    payload: schemas.PathRequest,
    db: Session = Depends(get_db),
    _membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.VIEWER)),
):
    for nid in (payload.source_node_id, payload.target_node_id):
        exists = db.query(models.GraphNode).filter(
            models.GraphNode.id == nid, models.GraphNode.project_id == project_id
        ).first()
        if not exists:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Node {nid} not found in this project")

    edges = _load_edges(db, project_id)
    labels = _node_label_map(db, project_id)
    reachable = compute_impact(payload.source_node_id, edges, payload.direction, None)
    match = next((a for a in reachable if a.node_id == payload.target_node_id), None)

    if not match:
        return schemas.PathResult(reachable=False)

    return schemas.PathResult(
        reachable=True,
        path=match.path,
        path_labels=[labels.get(pid, pid) for pid in match.path],
        length=match.depth,
    )


# ---------- What-if simulation (removal / failure) ----------
@router.post("/simulate", response_model=schemas.SimulateResult)
def simulate_change(
    project_id: str,
    payload: schemas.SimulateRequest,
    db: Session = Depends(get_db),
    _membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.VIEWER)),
):
    """Non-destructive: computes what WOULD happen if this node were removed
    (permanently gone) or failed (temporarily down), without changing
    anything. 'orphaned' is the stronger subset of 'affected' - nodes that
    would lose every one of their dependencies, not just be touched by one."""
    node = db.query(models.GraphNode).filter(
        models.GraphNode.id == payload.node_id, models.GraphNode.project_id == project_id
    ).first()
    if not node:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Node not found")

    edges = _load_edges(db, project_id)
    labels = _node_label_map(db, project_id)
    affected = compute_impact(payload.node_id, edges, payload.direction, payload.depth)
    orphaned = find_orphaned(payload.node_id, affected, edges)

    def to_affected_out(items):
        return [
            schemas.AffectedNode(
                node_id=a.node_id, label=labels.get(a.node_id, "Unknown"), depth=a.depth,
                path=[labels.get(pid, pid) for pid in a.path],
            )
            for a in items
        ]

    return schemas.SimulateResult(
        node_id=payload.node_id,
        mode=payload.mode,
        affected=to_affected_out(affected),
        orphaned=to_affected_out(orphaned),
        total_affected=len(affected),
        total_orphaned=len(orphaned),
    )


# ---------- Freeze plan ----------
@router.post("/freeze-plans", response_model=schemas.FreezePlanOut, status_code=status.HTTP_201_CREATED)
def create_freeze_plan(
    project_id: str,
    payload: schemas.FreezePlanCreate,
    db: Session = Depends(get_db),
    membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.MEMBER)),
):
    node = db.query(models.GraphNode).filter(
        models.GraphNode.id == payload.node_id, models.GraphNode.project_id == project_id
    ).first()
    if not node:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Node not found")

    edges = _load_edges(db, project_id)
    labels = _node_label_map(db, project_id)
    affected = compute_impact(payload.node_id, edges, payload.direction, payload.depth)
    # ordered so the target itself freezes first, then in increasing depth
    ordered = sorted(affected, key=lambda a: a.depth)

    plan = models.FreezePlan(project_id=project_id, target_node_id=payload.node_id, direction=payload.direction, created_by=membership.user_id)
    db.add(plan)
    db.flush()

    db.add(models.FreezePlanStep(plan_id=plan.id, node_id=payload.node_id, label=node.label, depth=0, order_index=0))
    for i, a in enumerate(ordered, start=1):
        db.add(models.FreezePlanStep(plan_id=plan.id, node_id=a.node_id, label=labels.get(a.node_id, "Unknown"), depth=a.depth, order_index=i))

    log_action(db, project_id, membership.user_id, "freeze_plan.create", node.label, {"steps": len(ordered) + 1})
    db.commit()
    db.refresh(plan)
    return plan


@router.get("/freeze-plans", response_model=list[schemas.FreezePlanOut])
def list_freeze_plans(
    project_id: str,
    db: Session = Depends(get_db),
    _membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.VIEWER)),
):
    return (
        db.query(models.FreezePlan)
        .filter(models.FreezePlan.project_id == project_id)
        .order_by(models.FreezePlan.created_at.desc())
        .all()
    )


@router.patch("/freeze-plans/{plan_id}/steps/{step_id}", response_model=schemas.FreezePlanStepOut)
def update_freeze_plan_step(
    project_id: str,
    plan_id: str,
    step_id: str,
    payload: schemas.FreezePlanStepUpdate,
    db: Session = Depends(get_db),
    membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.MEMBER)),
):
    step = (
        db.query(models.FreezePlanStep)
        .join(models.FreezePlan)
        .filter(
            models.FreezePlanStep.id == step_id,
            models.FreezePlanStep.plan_id == plan_id,
            models.FreezePlan.project_id == project_id,
        )
        .first()
    )
    if not step:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Freeze plan step not found")
    step.status = models.FreezePlanStepStatusEnum(payload.status)
    log_action(db, project_id, membership.user_id, "freeze_plan.step_update", step.label, {"status": payload.status})
    db.commit()
    db.refresh(step)
    return step


@router.delete("/freeze-plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_freeze_plan(
    project_id: str,
    plan_id: str,
    db: Session = Depends(get_db),
    membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.MEMBER)),
):
    """Remove a freeze plan and its steps. A plan is only a tracking checklist, so this
    does not change the freeze status of any node on the graph."""
    plan = (
        db.query(models.FreezePlan)
        .filter(models.FreezePlan.id == plan_id, models.FreezePlan.project_id == project_id)
        .first()
    )
    if not plan:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Freeze plan not found")
    target = db.query(models.GraphNode).filter(models.GraphNode.id == plan.target_node_id).first()
    log_action(db, project_id, membership.user_id, "freeze_plan.delete", target.label if target else "", {"steps": len(plan.steps)})
    db.delete(plan)
    db.commit()
    return None


# ---------- Graph snapshots ----------
@router.post("/snapshots", response_model=schemas.SnapshotOut, status_code=status.HTTP_201_CREATED)
def create_snapshot(
    project_id: str,
    payload: schemas.SnapshotCreate,
    db: Session = Depends(get_db),
    membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.MEMBER)),
):
    nodes = db.query(models.GraphNode).filter(models.GraphNode.project_id == project_id).all()
    edges = db.query(models.GraphEdge).filter(models.GraphEdge.project_id == project_id).all()

    nodes_json = [
        {"id": n.id, "label": n.label, "node_type": n.node_type.value, "description": n.description,
         "method": n.method, "path": n.path, "pos_x": n.pos_x, "pos_y": n.pos_y,
         "source": n.source, "owner_team": n.owner_team, "owner_contact": n.owner_contact, "deprecated": bool(n.deprecated),
         "sunset_date": n.sunset_date.isoformat() if n.sunset_date else None, "deprecation_note": n.deprecation_note}
        for n in nodes
    ]
    edges_json = [
        {"id": e.id, "source_node_id": e.source_node_id, "target_node_id": e.target_node_id,
         "edge_type": e.edge_type.value, "description": e.description}
        for e in edges
    ]

    snapshot = models.GraphSnapshot(
        project_id=project_id, label=payload.label, nodes_json=nodes_json, edges_json=edges_json,
        created_by=membership.user_id,
    )
    db.add(snapshot)
    log_action(db, project_id, membership.user_id, "snapshot.create", payload.label, {"nodes": len(nodes_json), "edges": len(edges_json)})
    db.commit()
    db.refresh(snapshot)
    return schemas.SnapshotOut(
        id=snapshot.id, label=snapshot.label, node_count=len(nodes_json), edge_count=len(edges_json),
        created_by=snapshot.created_by, created_at=snapshot.created_at,
    )


@router.get("/snapshots", response_model=list[schemas.SnapshotOut])
def list_snapshots(
    project_id: str,
    db: Session = Depends(get_db),
    _membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.VIEWER)),
):
    snapshots = (
        db.query(models.GraphSnapshot)
        .filter(models.GraphSnapshot.project_id == project_id)
        .order_by(models.GraphSnapshot.created_at.desc())
        .all()
    )
    return [
        schemas.SnapshotOut(
            id=s.id, label=s.label, node_count=len(s.nodes_json), edge_count=len(s.edges_json),
            created_by=s.created_by, created_at=s.created_at,
        )
        for s in snapshots
    ]


@router.delete("/snapshots/{snapshot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_snapshot(
    project_id: str,
    snapshot_id: str,
    db: Session = Depends(get_db),
    membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.MEMBER)),
):
    """A leader can delete any snapshot; a member only the ones they saved. The
    live graph is untouched, but the snapshot can no longer be compared or restored,
    and it drops out of the time-travel replay."""
    snap = (
        db.query(models.GraphSnapshot)
        .filter(models.GraphSnapshot.id == snapshot_id, models.GraphSnapshot.project_id == project_id)
        .first()
    )
    if not snap:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Snapshot not found")
    if membership.role != models.RoleEnum.LEADER and snap.created_by != membership.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only a leader or the person who saved it can delete this snapshot")
    log_action(db, project_id, membership.user_id, "snapshot.delete", snap.label)
    db.delete(snap)
    db.commit()
    return None


@router.get("/snapshots/{snapshot_id}/diff", response_model=schemas.SnapshotDiff)
def diff_snapshot(
    project_id: str,
    snapshot_id: str,
    db: Session = Depends(get_db),
    _membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.VIEWER)),
):
    snapshot = db.query(models.GraphSnapshot).filter(
        models.GraphSnapshot.id == snapshot_id, models.GraphSnapshot.project_id == project_id
    ).first()
    if not snapshot:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Snapshot not found")

    current_nodes = db.query(models.GraphNode).filter(models.GraphNode.project_id == project_id).all()
    current_labels = {n.label for n in current_nodes}
    snapshot_labels = {n["label"] for n in snapshot.nodes_json}
    current_edge_count = db.query(models.GraphEdge).filter(models.GraphEdge.project_id == project_id).count()

    return schemas.SnapshotDiff(
        nodes_added=sorted(current_labels - snapshot_labels),
        nodes_removed=sorted(snapshot_labels - current_labels),
        edges_added=max(0, current_edge_count - len(snapshot.edges_json)),
        edges_removed=max(0, len(snapshot.edges_json) - current_edge_count),
    )


@router.post("/snapshots/{snapshot_id}/restore", status_code=status.HTTP_200_OK)
def restore_snapshot(
    project_id: str,
    snapshot_id: str,
    db: Session = Depends(get_db),
    membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.LEADER)),
):
    """Destructive: replaces the current graph with the snapshot's contents.
    Leader-only, and the frontend requires a confirmation dialog before
    calling this."""
    snapshot = db.query(models.GraphSnapshot).filter(
        models.GraphSnapshot.id == snapshot_id, models.GraphSnapshot.project_id == project_id
    ).first()
    if not snapshot:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Snapshot not found")

    db.query(models.GraphEdge).filter(models.GraphEdge.project_id == project_id).delete(synchronize_session=False)
    _purge_node_references(db, project_id)   # comments + freeze plans on the nodes being replaced
    db.query(models.GraphNode).filter(models.GraphNode.project_id == project_id).delete(synchronize_session=False)
    db.flush()

    old_to_new_id: dict[str, str] = {}
    for n in snapshot.nodes_json:
        new_node = models.GraphNode(
            project_id=project_id, label=n["label"], node_type=models.NodeTypeEnum(n["node_type"]),
            description=n.get("description", ""), method=n.get("method"), path=n.get("path"),
            pos_x=n.get("pos_x", 0), pos_y=n.get("pos_y", 0), source=n.get("source") or "manual",
            owner_team=n.get("owner_team"), owner_contact=n.get("owner_contact"),
            deprecated=bool(n.get("deprecated", False)),
            sunset_date=date.fromisoformat(n["sunset_date"]) if n.get("sunset_date") else None,
            deprecation_note=n.get("deprecation_note"),
            created_by=membership.user_id,
        )
        db.add(new_node)
        db.flush()
        old_to_new_id[n["id"]] = new_node.id

    for e in snapshot.edges_json:
        src = old_to_new_id.get(e["source_node_id"])
        tgt = old_to_new_id.get(e["target_node_id"])
        if not src or not tgt:
            continue
        db.add(models.GraphEdge(
            project_id=project_id, source_node_id=src, target_node_id=tgt,
            edge_type=models.EdgeTypeEnum(e["edge_type"]), description=e.get("description", ""),
            source_origin="snapshot_restore", created_by=membership.user_id,
        ))

    log_action(db, project_id, membership.user_id, "snapshot.restore", snapshot.label)
    db.commit()
    return {"status": "restored", "nodes": len(snapshot.nodes_json), "edges": len(snapshot.edges_json)}


# ---------- Findings ----------
@router.get("/findings", response_model=schemas.FindingsResponse)
def get_findings(
    project_id: str,
    db: Session = Depends(get_db),
    _membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.VIEWER)),
):
    """Heuristic findings derived from the current graph shape - not a
    substitute for real static/security analysis, but surfaces the kind of
    structural risk that's visible from dependency fan-in/out."""
    nodes = db.query(models.GraphNode).filter(models.GraphNode.project_id == project_id).all()
    edges = db.query(models.GraphEdge).filter(models.GraphEdge.project_id == project_id).all()
    labels = {n.id: n.label for n in nodes}

    incoming: dict[str, int] = {}
    outgoing: dict[str, int] = {}
    for e in edges:
        incoming[e.target_node_id] = incoming.get(e.target_node_id, 0) + 1
        outgoing[e.source_node_id] = outgoing.get(e.source_node_id, 0) + 1

    findings: list[schemas.Finding] = []

    for node in nodes:
        dep_count = incoming.get(node.id, 0)
        if dep_count >= 5:
            findings.append(schemas.Finding(
                id=f"fanin-{node.id}", severity="high",
                title=f"{node.label} has {dep_count} direct dependents",
                description=f"{dep_count} other components depend directly on {node.label}. A change or outage here has a wide blast radius.",
                remediation="Consider an interface/contract test suite for this component, and review its change-approval process before modifying it.",
                node_id=node.id, node_label=node.label,
            ))
        elif dep_count >= 3:
            findings.append(schemas.Finding(
                id=f"fanin-{node.id}", severity="medium",
                title=f"{node.label} has {dep_count} direct dependents",
                description=f"{dep_count} components depend on {node.label} — worth reviewing before changes.",
                remediation="Run an impact preview before modifying this component.",
                node_id=node.id, node_label=node.label,
            ))

        if node.node_type == models.NodeTypeEnum.API and incoming.get(node.id, 0) == 0 and outgoing.get(node.id, 0) == 0:
            findings.append(schemas.Finding(
                id=f"isolated-{node.id}", severity="low",
                title=f"{node.label} has no detected dependencies",
                description="This endpoint isn't linked to any schema, auth scheme, or other component. It may be missing metadata, or genuinely standalone.",
                remediation="Confirm this is intentional, or check the OpenAPI spec for a missing schema/security reference.",
                node_id=node.id, node_label=node.label,
            ))

    if not any(n.node_type == models.NodeTypeEnum.AUTH for n in nodes) and any(n.node_type == models.NodeTypeEnum.API for n in nodes):
        findings.append(schemas.Finding(
            id="no-auth-scheme", severity="medium",
            title="No authentication scheme detected on any endpoint",
            description="None of the imported endpoints declare a security requirement.",
            remediation="Confirm this is intentional (a fully public API) or check that 'security' is declared in the OpenAPI spec.",
        ))

    findings.sort(key=lambda f: {"high": 0, "medium": 1, "low": 2}[f.severity])
    return schemas.FindingsResponse(
        findings=findings,
        high_count=sum(1 for f in findings if f.severity == "high"),
        medium_count=sum(1 for f in findings if f.severity == "medium"),
        low_count=sum(1 for f in findings if f.severity == "low"),
    )


# ---------- Comments ----------
@router.get("/nodes/{node_id}/comments", response_model=list[schemas.CommentOut])
def list_comments(
    project_id: str,
    node_id: str,
    db: Session = Depends(get_db),
    _membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.VIEWER)),
):
    comments = db.query(models.Comment).filter(models.Comment.node_id == node_id).order_by(models.Comment.created_at).all()
    return [
        schemas.CommentOut(
            id=c.id, node_id=c.node_id, author_id=c.author_id,
            author_name=_author_name(db, c.author_id),
            body=c.body, mentioned_user_ids=c.mentioned_user_ids or [],
            is_suggestion=c.is_suggestion, suggestion_status=c.suggestion_status,
            created_at=c.created_at,
        )
        for c in comments
    ]


def _author_name(db: Session, user_id: str) -> str:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    return user.full_name if user else "Unknown"


def _extract_mentions(db: Session, project_id: str, body: str) -> list[str]:
    """Match @Full Name against current project members (longest names
    first, so 'Jane Doe' matches before a lone 'Jane' would)."""
    members = (
        db.query(models.ProjectMember)
        .filter(models.ProjectMember.project_id == project_id)
        .all()
    )
    mentioned = []
    candidates = sorted(members, key=lambda m: len(m.user.full_name), reverse=True)
    for m in candidates:
        if f"@{m.user.full_name}" in body:
            mentioned.append(m.user_id)
    return mentioned


@router.post("/nodes/{node_id}/comments", response_model=schemas.CommentOut, status_code=status.HTTP_201_CREATED)
def add_comment(
    project_id: str,
    node_id: str,
    payload: schemas.CommentCreate,
    db: Session = Depends(get_db),
    membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.MEMBER)),
):
    node = db.query(models.GraphNode).filter(
        models.GraphNode.id == node_id, models.GraphNode.project_id == project_id
    ).first()
    if not node:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Node not found")

    mentioned_ids = _extract_mentions(db, project_id, payload.body)
    comment = models.Comment(
        node_id=node_id, author_id=membership.user_id, body=payload.body,
        mentioned_user_ids=mentioned_ids,
        is_suggestion=payload.is_suggestion,
        suggestion_status="pending" if payload.is_suggestion else None,
    )
    db.add(comment)
    log_action(db, project_id, membership.user_id, "comment.add", node.label)

    author_name = _author_name(db, membership.user_id)
    for uid in mentioned_ids:
        if uid == membership.user_id:
            continue
        notify(db, uid, "mention", f"{author_name} mentioned you on {node.label}", project_id=project_id, target=node.label)
    if payload.is_suggestion:
        notify_project_members(
            db, project_id, membership.user_id, "suggestion",
            f"{author_name} suggested a change on {node.label}", target=node.label,
        )

    db.commit()
    db.refresh(comment)
    return schemas.CommentOut(
        id=comment.id, node_id=comment.node_id, author_id=comment.author_id,
        author_name=author_name, body=comment.body, mentioned_user_ids=comment.mentioned_user_ids or [],
        is_suggestion=comment.is_suggestion, suggestion_status=comment.suggestion_status,
        created_at=comment.created_at,
    )


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    project_id: str,
    comment_id: str,
    db: Session = Depends(get_db),
    membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.MEMBER)),
):
    """The author can delete their own comment or suggestion; a leader can delete any."""
    comment = (
        db.query(models.Comment)
        .join(models.GraphNode, models.GraphNode.id == models.Comment.node_id)
        .filter(models.Comment.id == comment_id, models.GraphNode.project_id == project_id)
        .first()
    )
    if not comment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comment not found")
    if membership.role != models.RoleEnum.LEADER and comment.author_id != membership.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only delete your own comments")
    node = db.query(models.GraphNode).filter(models.GraphNode.id == comment.node_id).first()
    log_action(db, project_id, membership.user_id, "comment.delete", node.label if node else "")
    db.delete(comment)
    db.commit()
    return None


@router.post("/comments/{comment_id}/review", response_model=schemas.CommentOut)
def review_suggestion(
    project_id: str,
    comment_id: str,
    payload: schemas.SuggestionReview,
    db: Session = Depends(get_db),
    membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.LEADER)),
):
    comment = (
        db.query(models.Comment)
        .join(models.GraphNode)
        .filter(models.Comment.id == comment_id, models.GraphNode.project_id == project_id)
        .first()
    )
    if not comment or not comment.is_suggestion:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Suggestion not found")

    comment.suggestion_status = "approved" if payload.approve else "rejected"
    log_action(db, project_id, membership.user_id, "suggestion.review", comment.id, {"status": comment.suggestion_status})
    notify(
        db, comment.author_id, "suggestion",
        f"Your suggestion was {comment.suggestion_status}", project_id=project_id, target=comment.node.label,
    )
    db.commit()
    db.refresh(comment)
    return schemas.CommentOut(
        id=comment.id, node_id=comment.node_id, author_id=comment.author_id,
        author_name=_author_name(db, comment.author_id), body=comment.body,
        mentioned_user_ids=comment.mentioned_user_ids or [], is_suggestion=comment.is_suggestion,
        suggestion_status=comment.suggestion_status, created_at=comment.created_at,
    )
