"""
Parses an OpenAPI 3.x spec (as a dict) and derives:
  - one node per operation (method+path)
  - one node per reusable schema (#/components/schemas/*)
  - one node per security scheme (#/components/securitySchemes/*)
  - edges: operation -> schema (request/response body reuse)
  - edges: operation -> auth (security requirement)

This is intentionally dependency-free (no external OpenAPI library) so the
parser stays predictable and easy to extend.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field


HTTP_METHODS = {"get", "post", "put", "patch", "delete", "head", "options"}


@dataclass
class ParsedNode:
    key: str            # stable dedupe key
    label: str
    node_type: str       # "api" | "schema" | "auth"
    method: str | None = None
    path: str | None = None
    description: str = ""


@dataclass
class ParsedEdge:
    source_key: str
    target_key: str
    edge_type: str       # "uses_schema" | "uses_auth"
    description: str = ""


@dataclass
class ParseResult:
    title: str
    nodes: list[ParsedNode] = field(default_factory=list)
    edges: list[ParsedEdge] = field(default_factory=list)
    endpoints_found: int = 0
    schemas_found: int = 0
    security_schemes_found: int = 0


def _schema_ref_name(ref: str) -> str | None:
    m = re.match(r"^#/components/schemas/(.+)$", ref)
    return m.group(1) if m else None


def _collect_refs(obj) -> set[str]:
    """Recursively walk a dict/list structure and collect all $ref schema names."""
    found: set[str] = set()
    if isinstance(obj, dict):
        if "$ref" in obj and isinstance(obj["$ref"], str):
            name = _schema_ref_name(obj["$ref"])
            if name:
                found.add(name)
        for v in obj.values():
            found |= _collect_refs(v)
    elif isinstance(obj, list):
        for item in obj:
            found |= _collect_refs(item)
    return found


def parse_openapi_spec(spec: dict) -> ParseResult:
    title = (spec.get("info") or {}).get("title", "Untitled API")
    result = ParseResult(title=title)

    # 1. Security schemes -> auth nodes
    components = spec.get("components") or {}
    security_schemes = components.get("securitySchemes") or {}
    for name, scheme in security_schemes.items():
        stype = scheme.get("type", "unknown")
        result.nodes.append(
            ParsedNode(
                key=f"auth:{name}",
                label=name,
                node_type="auth",
                description=f"{stype} security scheme",
            )
        )
    result.security_schemes_found = len(security_schemes)

    # 2. Schemas -> schema nodes (only ones actually referenced get edges,
    #    but we surface all declared schemas as nodes for completeness)
    schemas = components.get("schemas") or {}
    for name in schemas.keys():
        result.nodes.append(
            ParsedNode(key=f"schema:{name}", label=name, node_type="schema")
        )
    result.schemas_found = len(schemas)

    global_security = spec.get("security")  # list of {schemeName: []}

    # 3. Paths -> operation nodes
    paths = spec.get("paths") or {}
    for path, path_item in paths.items():
        if not isinstance(path_item, dict):
            continue
        for method, operation in path_item.items():
            if method.lower() not in HTTP_METHODS or not isinstance(operation, dict):
                continue
            method_upper = method.upper()
            op_id = operation.get("operationId") or f"{method_upper} {path}"
            node_key = f"api:{method_upper}:{path}"
            result.nodes.append(
                ParsedNode(
                    key=node_key,
                    label=f"{method_upper} {path}",
                    node_type="api",
                    method=method_upper,
                    path=path,
                    description=operation.get("summary", "") or op_id,
                )
            )
            result.endpoints_found += 1

            # request/response schema refs
            refs = _collect_refs(operation.get("requestBody"))
            for status_code, resp in (operation.get("responses") or {}).items():
                refs |= _collect_refs(resp)
            for schema_name in refs:
                result.edges.append(
                    ParsedEdge(
                        source_key=node_key,
                        target_key=f"schema:{schema_name}",
                        edge_type="uses_schema",
                        description=f"{method_upper} {path} uses schema {schema_name}",
                    )
                )

            # security -> auth edges (operation-level overrides global)
            op_security = operation.get("security", global_security) or []
            for req in op_security:
                if not isinstance(req, dict):
                    continue
                for scheme_name in req.keys():
                    result.edges.append(
                        ParsedEdge(
                            source_key=node_key,
                            target_key=f"auth:{scheme_name}",
                            edge_type="uses_auth",
                            description=f"{method_upper} {path} requires {scheme_name}",
                        )
                    )

    return result
