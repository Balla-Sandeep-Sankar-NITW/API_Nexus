"""Server-side HTTP client behind the API Explorer's "Send" button.

Sending from the server avoids browser CORS limits, but it also means this process makes
requests to whatever address a user typed in. That is the classic SSRF risk, so every call:

  * is limited to http/https and refuses URLs with embedded credentials,
  * resolves the hostname itself and refuses private / loopback / link-local / reserved
    addresses (configurable, see settings.tryit_allow_private_networks),
  * then connects to the exact IP it just checked (so DNS can't answer differently a second
    time), keeping the original Host header and TLS server name,
  * never follows redirects (a public URL can't bounce into an internal one),
  * ignores proxy settings from the environment,
  * has a time limit, a request-size limit and a response-size limit.

Nothing about the request or response is stored.
"""
from __future__ import annotations

import ipaddress
import logging
import re
import socket
import ssl
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from urllib.parse import urlsplit

import httpx

from app.config import settings

logger = logging.getLogger("api_nexus.tryit")

ALLOWED_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
# Set by us or by the HTTP stack; letting a caller override them would break the connection or smuggle requests.
DROPPED_HEADERS = {
    "host", "content-length", "connection", "keep-alive", "proxy-authorization", "proxy-connection",
    "te", "trailer", "transfer-encoding", "upgrade", "expect",
}
_HEADER_NAME = re.compile(r"^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$")
MAX_HEADERS = 60
MAX_HEADER_VALUE = 8192
TEXTUAL = ("text/", "application/json", "application/xml", "application/javascript", "application/x-www-form-urlencoded",
           "application/yaml", "application/x-yaml", "application/graphql", "application/problem+json")


class TryItError(Exception):
    """A failure we can describe to the user. `status` is the HTTP status our API answers with."""

    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


# ---------- rate limit (per user, in memory) ----------
_calls: dict[str, deque] = defaultdict(deque)
_lock = threading.Lock()


def check_rate_limit(user_id: str) -> None:
    limit = settings.tryit_rate_per_minute
    now = time.monotonic()
    with _lock:
        window = _calls[user_id]
        while window and now - window[0] > 60:
            window.popleft()
        if len(window) >= limit:
            wait = int(60 - (now - window[0])) + 1
            raise TryItError(429, f"Too many requests. You can send {limit} per minute; try again in about {wait}s.")
        window.append(now)


# ---------- target validation ----------
def _embedded_v4(addr: ipaddress.IPv6Address) -> ipaddress.IPv4Address | None:
    """IPv6 forms that smuggle an IPv4 address: ::ffff:a.b.c.d, 64:ff9b::/96 (NAT64), 2002::/16 (6to4)."""
    if addr.ipv4_mapped:
        return addr.ipv4_mapped
    if addr in ipaddress.ip_network("64:ff9b::/96"):
        return ipaddress.IPv4Address(int(addr) & 0xFFFFFFFF)
    if addr in ipaddress.ip_network("2002::/16"):
        return ipaddress.IPv4Address((int(addr) >> 80) & 0xFFFFFFFF)
    return None


def _blocked_reason(ip: str) -> str | None:
    addr = ipaddress.ip_address(ip.split("%")[0])        # drop an IPv6 zone id
    if isinstance(addr, ipaddress.IPv6Address):
        embedded = _embedded_v4(addr)
        if embedded is not None:
            addr = embedded
    # Never allowed, even when private networks are permitted: link-local covers the cloud
    # metadata endpoint (169.254.169.254), plus unspecified (0.0.0.0) and multicast.
    if addr.is_link_local:
        return "link-local addresses (such as cloud metadata services) are never allowed"
    if addr.is_unspecified or addr.is_multicast:
        return "that address can't be called"
    if settings.tryit_allow_private_networks:
        return None
    if not addr.is_global:
        return "private and internal network addresses are blocked on this server"
    return None


@dataclass
class Target:
    scheme: str
    host: str          # as the user wrote it (used for Host header and TLS name)
    port: int
    ip: str            # the address we validated and will connect to
    path_query: str
    default_port: bool


def validate_target(url: str) -> Target:
    try:
        parts = urlsplit(url.strip())
        port = parts.port
    except ValueError:
        raise TryItError(400, "That URL isn't valid.")
    if parts.scheme not in ("http", "https"):
        raise TryItError(400, "Only http:// and https:// URLs can be called.")
    if not parts.hostname:
        raise TryItError(400, "The URL needs a host, for example https://api.example.com/v1/items.")
    if parts.username or parts.password:
        raise TryItError(400, "URLs with a username or password in them aren't allowed. Use the Authorize panel instead.")
    default_port = port is None
    port = port or (443 if parts.scheme == "https" else 80)

    try:
        infos = socket.getaddrinfo(parts.hostname, port, type=socket.SOCK_STREAM)
    except socket.gaierror:
        raise TryItError(502, f"Couldn't find a server called '{parts.hostname}'. Check the base URL.")
    except UnicodeError:
        raise TryItError(400, "That hostname isn't valid.")
    ips = list(dict.fromkeys(info[4][0] for info in infos))
    if not ips:
        raise TryItError(502, f"'{parts.hostname}' doesn't resolve to any address.")
    for ip in ips:     # every address must be acceptable, otherwise a mixed answer could slip through
        reason = _blocked_reason(ip)
        if reason:
            raise TryItError(400, f"'{parts.hostname}' can't be called from this server: {reason}.")

    path_query = parts.path or "/"
    if parts.query:
        path_query += "?" + parts.query
    return Target(parts.scheme, parts.hostname, port, ips[0], path_query, default_port)


# ---------- request ----------
def _clean_headers(headers: dict[str, str]) -> dict[str, str]:
    if len(headers) > MAX_HEADERS:
        raise TryItError(400, f"Too many headers (the limit is {MAX_HEADERS}).")
    out: dict[str, str] = {}
    for name, value in headers.items():
        name = str(name).strip()
        value = str(value)
        if not _HEADER_NAME.match(name):
            raise TryItError(400, f"'{name}' isn't a valid header name.")
        if "\r" in value or "\n" in value or len(value) > MAX_HEADER_VALUE:
            raise TryItError(400, f"The value of header '{name}' isn't valid.")
        if name.lower() in DROPPED_HEADERS:
            continue
        out[name] = value
    return out


def _is_text(content_type: str | None, raw: bytes) -> bool:
    if content_type:
        ct = content_type.split(";")[0].strip().lower()
        return ct.startswith(TEXTUAL) or ct.endswith(("+json", "+xml"))
    try:
        raw.decode("utf-8")
        return True
    except UnicodeDecodeError:
        return False


def _decode(raw: bytes, content_type: str | None) -> str:
    charset = "utf-8"
    if content_type:
        m = re.search(r"charset=([\w\-]+)", content_type, re.I)
        if m:
            charset = m.group(1)
    try:
        return raw.decode(charset, errors="replace")
    except LookupError:
        return raw.decode("utf-8", errors="replace")


def send(method: str, url: str, headers: dict[str, str], body: str | None, timeout: float | None, user_id: str, project_id: str) -> dict:
    method = method.upper()
    if method not in ALLOWED_METHODS:
        raise TryItError(400, f"{method} requests aren't supported.")
    payload = body.encode("utf-8") if body else None
    if payload is not None and len(payload) > settings.tryit_max_request_bytes:
        raise TryItError(413, "The request body is too large.")
    clean = _clean_headers(headers)

    check_rate_limit(user_id)
    target = validate_target(url)

    # Host header = what the user typed (so virtual hosting works). An IPv6 literal needs brackets.
    host_part = f"[{target.host}]" if ":" in target.host else target.host
    host_header = host_part if target.default_port else f"{host_part}:{target.port}"
    clean["Host"] = host_header
    ip_netloc = f"[{target.ip}]" if ":" in target.ip else target.ip
    pinned = f"{target.scheme}://{ip_netloc}:{target.port}{target.path_query}"
    extensions = {"sni_hostname": target.host} if target.scheme == "https" else {}

    limit = settings.tryit_max_response_bytes
    max_seconds = min(max(timeout or settings.tryit_timeout_seconds, 1.0), 30.0)
    started = time.monotonic()
    chunks: list[bytes] = []
    total = 0
    truncated = False
    logger.info("try-it user=%s project=%s %s %s://%s%s", user_id, project_id, method, target.scheme, host_header, urlsplit(url).path or "/")
    try:
        with httpx.Client(
            follow_redirects=False,
            trust_env=False,                     # ignore HTTP(S)_PROXY from the server's environment
            verify=True,
            timeout=httpx.Timeout(max_seconds, connect=min(max_seconds, 8.0)),
        ) as client:
            with client.stream(method, pinned, headers=clean, content=payload, extensions=extensions) as response:
                for chunk in response.iter_bytes():
                    if time.monotonic() - started > max_seconds:
                        raise httpx.ReadTimeout("overall time limit reached")
                    remaining = limit - total
                    if len(chunk) > remaining:
                        chunks.append(chunk[:remaining])
                        total += remaining
                        truncated = True
                        break
                    chunks.append(chunk)
                    total += len(chunk)
                status_code = response.status_code
                reason = response.reason_phrase
                resp_headers = [[k, v] for k, v in response.headers.multi_items()]
                content_type = response.headers.get("content-type")
    except httpx.TimeoutException:
        raise TryItError(504, f"The API didn't respond within {int(max_seconds)} seconds.")
    except httpx.ConnectError as exc:
        if isinstance(getattr(exc, "__cause__", None), ssl.SSLError) or "CERTIFICATE" in str(exc).upper() or "SSL" in str(exc).upper():
            raise TryItError(502, "The secure connection failed (TLS or certificate problem). Is the certificate valid for this host?")
        raise TryItError(502, f"Couldn't connect to {target.host}:{target.port}. The server may be down, or the port is wrong.")
    except httpx.HTTPError as exc:
        logger.warning("try-it transport error: %s", exc)
        raise TryItError(502, "The request failed before a response was received.")

    raw = b"".join(chunks)
    elapsed_ms = int((time.monotonic() - started) * 1000)
    binary = bool(raw) and not _is_text(content_type, raw)
    return {
        "status": status_code,
        "reason": reason,
        "elapsed_ms": elapsed_ms,
        "size_bytes": total,
        "truncated": truncated,
        "content_type": content_type,
        "headers": resp_headers,
        "body": None if binary else _decode(raw, content_type),
        "binary": binary,
        "url": url,
    }
