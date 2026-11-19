"""Small in-memory sliding-window limiter. Per server process, which is enough for a single
free-tier instance; swap for Redis if you ever run several."""
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

_hits: dict[str, deque] = defaultdict(deque)


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _prune(key: str, window: float) -> deque:
    q = _hits[key]
    cutoff = time.monotonic() - window
    while q and q[0] < cutoff:
        q.popleft()
    if not q:
        _hits.pop(key, None)
        return deque()
    return q


def count(key: str, window: float) -> int:
    return len(_prune(key, window))


def record(key: str) -> None:
    _hits[key].append(time.monotonic())


def clear(key: str) -> None:
    _hits.pop(key, None)


def retry_after(key: str, window: float) -> int:
    q = _prune(key, window)
    return max(1, int(window - (time.monotonic() - q[0]))) if q else 1


def too_many(seconds: int) -> HTTPException:
    mins = max(1, round(seconds / 60))
    wait = f"{seconds} seconds" if seconds < 60 else f"{mins} minute{'s' if mins != 1 else ''}"
    return HTTPException(
        status.HTTP_429_TOO_MANY_REQUESTS,
        f"Too many attempts. Please wait {wait} and try again.",
        headers={"Retry-After": str(seconds)},
    )


def limit(name: str, max_calls: int, window_seconds: int):
    """FastAPI dependency: at most max_calls per window per client IP for this route name."""

    def dependency(request: Request):
        key = f"{name}:{client_ip(request)}"
        if count(key, window_seconds) >= max_calls:
            raise too_many(retry_after(key, window_seconds))
        record(key)

    return dependency
