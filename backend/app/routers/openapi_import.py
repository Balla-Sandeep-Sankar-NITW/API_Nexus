import json

import yaml
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import require_project_role
from app.utils.audit import log_action
from app.utils.notify import notify_project_members
from app.utils.openapi_parser import parse_openapi_spec

router = APIRouter(prefix="/api/projects/{project_id}/openapi", tags=["openapi"])


def _parse_raw_text(raw_text: str, fmt: str) -> dict:
    """Parse raw spec text as JSON or YAML. 'auto' tries JSON first (most
    common case), then falls back to YAML - which is a superset of JSON
    syntax anyway, so this also gracefully handles JSON-with-YAML-format."""
    if fmt == "json":
        return json.loads(raw_text)
    if fmt == "yaml":
        return yaml.safe_load(raw_text)
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        return yaml.safe_load(raw_text)


@router.post("/import", response_model=schemas.ImportSummary, status_code=status.HTTP_201_CREATED)
def import_openapi_spec(
    project_id: str,
    payload: schemas.OpenApiImportRequest,
    db: Session = Depends(get_db),
    membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.LEADER)),
):
    spec = payload.spec
    if not isinstance(spec, dict) or ("paths" not in spec and "openapi" not in spec):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "This doesn't look like a valid OpenAPI document (missing 'openapi' or 'paths' field).",
        )

    try:
        parsed = parse_openapi_spec(spec)
    except Exception as exc:  # keep the API resilient to malformed specs
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Failed to parse OpenAPI spec: {exc}")

    spec_row = models.OpenApiSpec(
        project_id=project_id,
        version_label=payload.version_label,
        raw_spec=spec,
        title=parsed.title,
        imported_by=membership.user_id,
    )
    db.add(spec_row)
    db.flush()

    # Create nodes, tracking key -> db id for edge creation
    key_to_node_id: dict[str, str] = {}
    nodes_created = 0
    for pn in parsed.nodes:
        node = models.GraphNode(
            project_id=project_id,
            label=pn.label,
            node_type=models.NodeTypeEnum(pn.node_type),
            description=pn.description,
            method=pn.method,
            path=pn.path,
            source="openapi",
            created_by=membership.user_id,
        )
        db.add(node)
        db.flush()
        key_to_node_id[pn.key] = node.id
        nodes_created += 1

    edges_created = 0
    seen_edges = set()
    for pe in parsed.edges:
        src_id = key_to_node_id.get(pe.source_key)
        tgt_id = key_to_node_id.get(pe.target_key)
        if not src_id or not tgt_id:
            continue  # referenced schema/auth wasn't declared in components
        dedupe = (src_id, tgt_id, pe.edge_type)
        if dedupe in seen_edges:
            continue
        seen_edges.add(dedupe)
        edge = models.GraphEdge(
            project_id=project_id,
            source_node_id=src_id,
            target_node_id=tgt_id,
            edge_type=models.EdgeTypeEnum(pe.edge_type),
            description=pe.description,
            source_origin="openapi",
            created_by=membership.user_id,
        )
        db.add(edge)
        edges_created += 1

    log_action(
        db, project_id, membership.user_id, "spec.import", parsed.title,
        {"nodes_created": nodes_created, "edges_created": edges_created, "version_label": payload.version_label},
    )
    notify_project_members(
        db, project_id, membership.user_id, "spec_imported",
        f"A new OpenAPI spec ({payload.version_label}) was imported: {nodes_created} nodes, {edges_created} edges",
        target=parsed.title,
    )
    db.commit()

    return schemas.ImportSummary(
        spec_id=spec_row.id,
        title=parsed.title,
        nodes_created=nodes_created,
        edges_created=edges_created,
        endpoints_found=parsed.endpoints_found,
        schemas_found=parsed.schemas_found,
        security_schemes_found=parsed.security_schemes_found,
    )


@router.post("/preview", response_model=schemas.ImportPreview)
def preview_openapi_spec(
    project_id: str,
    payload: schemas.OpenApiRawImportRequest,
    _membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.LEADER)),
):
    """Dry-run parse: shows what would be imported without writing anything,
    so a Leader can sanity-check a spec before committing to it."""
    warnings = []
    try:
        spec = _parse_raw_text(payload.raw_text, payload.format)
    except (json.JSONDecodeError, yaml.YAMLError) as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Could not parse as JSON or YAML: {exc}")

    if not isinstance(spec, dict) or ("paths" not in spec and "openapi" not in spec):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "This doesn't look like a valid OpenAPI document (missing 'openapi' or 'paths' field).",
        )
    if "openapi" in spec and not str(spec["openapi"]).startswith("3."):
        warnings.append(f"Spec declares OpenAPI version {spec.get('openapi')} — this parser targets 3.x")

    try:
        parsed = parse_openapi_spec(spec)
    except Exception as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Failed to parse OpenAPI spec: {exc}")

    if parsed.endpoints_found == 0:
        warnings.append("No endpoints found under 'paths' — check the spec is complete")

    return schemas.ImportPreview(
        title=parsed.title,
        endpoints_found=parsed.endpoints_found,
        schemas_found=parsed.schemas_found,
        security_schemes_found=parsed.security_schemes_found,
        endpoint_list=sorted(n.label for n in parsed.nodes if n.node_type == "api"),
        schema_list=sorted(n.label for n in parsed.nodes if n.node_type == "schema"),
        security_scheme_list=sorted(n.label for n in parsed.nodes if n.node_type == "auth"),
        warnings=warnings,
    )


@router.post("/import-raw", response_model=schemas.ImportSummary, status_code=status.HTTP_201_CREATED)
def import_openapi_raw(
    project_id: str,
    payload: schemas.OpenApiRawImportRequest,
    db: Session = Depends(get_db),
    membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.LEADER)),
):
    """Same as /import, but accepts raw JSON or YAML text instead of a
    pre-parsed dict - this is what powers YAML spec uploads."""
    try:
        spec = _parse_raw_text(payload.raw_text, payload.format)
    except (json.JSONDecodeError, yaml.YAMLError) as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Could not parse as JSON or YAML: {exc}")
    return import_openapi_spec(
        project_id,
        schemas.OpenApiImportRequest(spec=spec, version_label=payload.version_label),
        db,
        membership,
    )


@router.get("/versions", response_model=list[schemas.SpecVersionOut])
def list_versions(
    project_id: str,
    db: Session = Depends(get_db),
    _membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.VIEWER)),
):
    specs = (
        db.query(models.OpenApiSpec)
        .filter(models.OpenApiSpec.project_id == project_id)
        .order_by(models.OpenApiSpec.created_at.desc())
        .all()
    )
    return specs


@router.get("/versions/{spec_id}/diff", response_model=schemas.SpecDiffResult)
def diff_version(
    project_id: str,
    spec_id: str,
    compare_to: str,
    db: Session = Depends(get_db),
    _membership: models.ProjectMember = Depends(require_project_role(models.RoleEnum.VIEWER)),
):
    newer = db.query(models.OpenApiSpec).filter(
        models.OpenApiSpec.id == spec_id, models.OpenApiSpec.project_id == project_id
    ).first()
    older = db.query(models.OpenApiSpec).filter(
        models.OpenApiSpec.id == compare_to, models.OpenApiSpec.project_id == project_id
    ).first()
    if not newer or not older:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "One or both spec versions were not found")

    parsed_new = parse_openapi_spec(newer.raw_spec)
    parsed_old = parse_openapi_spec(older.raw_spec)

    def endpoint_labels(parsed):
        return {n.label for n in parsed.nodes if n.node_type == "api"}

    def schema_labels(parsed):
        return {n.label for n in parsed.nodes if n.node_type == "schema"}

    def auth_labels(parsed):
        return {n.label for n in parsed.nodes if n.node_type == "auth"}

    new_eps, old_eps = endpoint_labels(parsed_new), endpoint_labels(parsed_old)
    new_sch, old_sch = schema_labels(parsed_new), schema_labels(parsed_old)
    new_auth, old_auth = auth_labels(parsed_new), auth_labels(parsed_old)

    return schemas.SpecDiffResult(
        from_version=older.version_label,
        to_version=newer.version_label,
        endpoints_added=sorted(new_eps - old_eps),
        endpoints_removed=sorted(old_eps - new_eps),
        schemas_added=sorted(new_sch - old_sch),
        schemas_removed=sorted(old_sch - new_sch),
        security_schemes_added=sorted(new_auth - old_auth),
        security_schemes_removed=sorted(old_auth - new_auth),
    )
