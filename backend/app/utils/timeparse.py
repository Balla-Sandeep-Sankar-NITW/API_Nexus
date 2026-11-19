from datetime import datetime, timezone


def to_naive_utc(dt: datetime | None) -> datetime | None:
    """The database stores naive UTC timestamps. Query parameters arrive as ISO
    strings that usually carry a timezone ("...Z"), so normalise them to match."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt
