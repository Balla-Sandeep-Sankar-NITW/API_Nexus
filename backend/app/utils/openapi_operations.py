"""Turn a stored OpenAPI 3.x document into what the API Explorer needs to build a
request form: servers, auth schemes, and for every operation its parameters, a
ready-to-edit request body example, documented responses and security requirements.

Only local "#/..." $refs are followed (the same limit as the importer)."""
from __future__ import annotations

import re
from typing import Any

HTTP_METHODS = ("get", "put", "post", "delete", "options", "head", "patch", "trace")
MAX_DEPTH = 6

_FORMAT_EXAMPLES = {
    "date-time": "2026-01-01T12:00:00Z",
    "date": "2026-01-01",
    "time": "12:00:00",
    "uuid": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "user@example.com",
    "uri": "https://example.com",
    "url": "https://example.com",
    "hostname": "example.com",
    "ipv4": "192.0.2.1",
    "ipv6": "2001:db8::1",
    "byte": "c3RyaW5n",
    "password": "string",
}


def resolve(spec: dict, node: Any) -> Any:
    """Follow a chain of local $refs; returns {} for anything unresolvable or circular."""
    seen: set[str] = set()
    while isinstance(node, dict) and "$ref" in node:
        ref = node["$ref"]
        if not isinstance(ref, str) or not ref.startswith("#/") or ref in seen:
            return {}
        seen.add(ref)
        cur: Any = spec
        for part in ref[2:].split("/"):
            part = part.replace("~1", "/").replace("~0", "~")
            if not isinstance(cur, dict) or part not in cur:
                return {}
            cur = cur[part]
        node = cur
    return node


def example_for(spec: dict, schema: Any, depth: int = 0, seen: frozenset = frozenset(), request: bool = True) -> Any:
    """A plausible value for a schema: an explicit example/default/enum first, otherwise
    built from types. `request=True` leaves out readOnly properties (the server sets those)."""
    if isinstance(schema, dict) and "$ref" in schema:
        ref = schema["$ref"]
        if ref in seen:          # recursive schema: stop instead of nesting forever
            return None
        seen = seen | {ref}
    schema = resolve(spec, schema)
    if not isinstance(schema, dict) or depth > MAX_DEPTH:
        return None
    if "example" in schema:
        return schema["example"]
    if schema.get("examples") and isinstance(schema["examples"], list):
        return schema["examples"][0]
    if "default" in schema:
        return schema["default"]
    if schema.get("enum"):
        return schema["enum"][0]
    if schema.get("const") is not None:
        return schema["const"]

    if isinstance(schema.get("allOf"), list):
        merged: dict = {}
        for part in schema["allOf"]:
            value = example_for(spec, part, depth + 1, seen, request)
            if isinstance(value, dict):
                merged.update(value)
        if merged:
            return merged
    for key in ("oneOf", "anyOf"):
        if isinstance(schema.get(key), list) and schema[key]:
            return example_for(spec, schema[key][0], depth + 1, seen, request)

    kind = schema.get("type")
    if isinstance(kind, list):
        kind = next((k for k in kind if k != "null"), "null")
    if kind is None and "properties" in schema:
        kind = "object"
    if kind == "object":
        out = {}
        for name, prop in (schema.get("properties") or {}).items():
            prop_resolved = resolve(spec, prop)
            if request and isinstance(prop_resolved, dict) and prop_resolved.get("readOnly"):
                continue
            out[name] = example_for(spec, prop, depth + 1, seen, request)
        return out
    if kind == "array":
        item = example_for(spec, schema.get("items") or {}, depth + 1, seen, request)
        return [] if item is None else [item]
    if kind == "string":
        return _FORMAT_EXAMPLES.get(schema.get("format"), "string")
    if kind in ("integer", "number"):
        return schema.get("minimum", 0)
    if kind == "boolean":
        return False
    return None


def _compact_schema(spec: dict, schema: Any) -> dict:
    schema = resolve(spec, schema) or {}
    if not isinstance(schema, dict):
        return {}
    out: dict = {}
    for key in ("type", "format", "default", "minimum", "maximum", "pattern"):
        if key in schema:
            out[key] = schema[key]
    if isinstance(schema.get("enum"), list):
        out["enum"] = schema["enum"][:50]
    items = resolve(spec, schema.get("items")) if schema.get("items") else None
    if isinstance(items, dict) and items.get("type"):
        out["items_type"] = items["type"]
    return out


def _parameter(spec: dict, raw: Any) -> dict | None:
    p = resolve(spec, raw)
    if not isinstance(p, dict) or not p.get("name") or p.get("in") not in ("path", "query", "header", "cookie"):
        return None
    schema = _compact_schema(spec, p.get("schema"))
    if "example" in p:
        example = p["example"]
    elif isinstance(p.get("examples"), dict) and p["examples"]:
        first = resolve(spec, next(iter(p["examples"].values())))
        example = first.get("value") if isinstance(first, dict) else None
    else:
        example = example_for(spec, p.get("schema") or {}, request=True)
    if isinstance(example, (dict, list)):
        example = None  # complex parameter values aren't prefilled
    return {
        "name": p["name"],
        "in": p["in"],
        "required": bool(p.get("required")) or p["in"] == "path",
        "description": p.get("description", "") or "",
        "deprecated": bool(p.get("deprecated")),
        "schema": schema,
        "example": example,
    }


# Content types the Explorer can send. Others (multipart/file upload, octet-stream) are listed but flagged.
def _body_supported(content_type: str) -> bool:
    ct = content_type.split(";")[0].strip().lower()
    return ct == "application/json" or ct.endswith("+json") or ct in ("text/plain", "application/x-www-form-urlencoded", "application/xml", "text/xml")


def _request_body(spec: dict, raw: Any) -> dict | None:
    rb = resolve(spec, raw)
    if not isinstance(rb, dict) or not isinstance(rb.get("content"), dict) or not rb["content"]:
        return None
    contents = []
    for content_type, media in rb["content"].items():
        media = resolve(spec, media) or {}
        if "example" in media:
            example = media["example"]
        elif isinstance(media.get("examples"), dict) and media["examples"]:
            first = resolve(spec, next(iter(media["examples"].values())))
            example = first.get("value") if isinstance(first, dict) else None
        else:
            example = example_for(spec, media.get("schema") or {}, request=True)
        contents.append({"content_type": content_type, "example": example, "supported": _body_supported(content_type)})
    contents.sort(key=lambda c: (not c["supported"], c["content_type"] != "application/json"))
    return {"required": bool(rb.get("required")), "description": rb.get("description", "") or "", "contents": contents}


def _security_requirements(spec: dict, operation: dict) -> list[list[str]]:
    sec = operation["security"] if "security" in operation else spec.get("security", [])
    if not isinstance(sec, list):
        return []
    # Each entry is one acceptable combination; an empty {} means "no auth also works".
    return [sorted(req.keys()) for req in sec if isinstance(req, dict)]


def _servers(spec: dict) -> list[dict]:
    out = []
    for server in spec.get("servers") or []:
        if not isinstance(server, dict) or not server.get("url"):
            continue
        url = str(server["url"])
        for name, var in (server.get("variables") or {}).items():
            url = url.replace("{" + name + "}", str((var or {}).get("default", "")))
        out.append({"url": url, "description": server.get("description", "") or ""})
    return out


def _security_schemes(spec: dict) -> list[dict]:
    out = []
    for name, raw in ((spec.get("components") or {}).get("securitySchemes") or {}).items():
        s = resolve(spec, raw)
        if not isinstance(s, dict):
            continue
        kind_raw = s.get("type")
        if kind_raw == "http":
            kind = "basic" if str(s.get("scheme", "")).lower() == "basic" else "bearer"
        elif kind_raw == "apiKey":
            kind = "apikey"
        elif kind_raw in ("oauth2", "openIdConnect"):
            kind = "bearer"   # paste an access token; the Explorer doesn't run the OAuth flow
        else:
            continue
        out.append({
            "name": name, "kind": kind, "type": kind_raw, "scheme": s.get("scheme"),
            "bearer_format": s.get("bearerFormat"), "in": s.get("in"), "param_name": s.get("name"),
            "description": s.get("description", "") or "",
        })
    return out


def extract_operations(spec: dict) -> dict:
    operations = []
    for path, item in (spec.get("paths") or {}).items():
        item = resolve(spec, item)
        if not isinstance(item, dict):
            continue
        shared = item.get("parameters") or []
        for method in HTTP_METHODS:
            op = item.get(method)
            if not isinstance(op, dict):
                continue
            merged: dict[tuple, dict] = {}
            for raw in [*shared, *(op.get("parameters") or [])]:   # operation-level overrides path-level
                param = _parameter(spec, raw)
                if param:
                    merged[(param["name"], param["in"])] = param
            responses = []
            for code, resp in (op.get("responses") or {}).items():
                resp = resolve(spec, resp)
                responses.append({"status": str(code), "description": (resp or {}).get("description", "") if isinstance(resp, dict) else ""})
            responses.sort(key=lambda r: r["status"])
            requirements = _security_requirements(spec, op)
            operations.append({
                "method": method.upper(),
                "path": path,
                "operation_id": op.get("operationId"),
                "summary": op.get("summary", "") or "",
                "description": op.get("description", "") or "",
                "tags": [str(t) for t in (op.get("tags") or [])] or ["default"],
                "deprecated": bool(op.get("deprecated")),
                "parameters": list(merged.values()),
                "request_body": _request_body(spec, op.get("requestBody")),
                "responses": responses,
                "security": requirements,
                # True when every acceptable combination needs some scheme (no empty {} alternative)
                "auth_required": bool(requirements) and all(len(r) > 0 for r in requirements),
            })
    return {"servers": _servers(spec), "security_schemes": _security_schemes(spec), "operations": operations}
