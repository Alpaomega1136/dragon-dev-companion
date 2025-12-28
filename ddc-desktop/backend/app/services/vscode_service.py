"""VS Code activity tracking service."""

from __future__ import annotations

from datetime import datetime, timedelta

from app.db import get_connection
from app.utils.time_utils import now_iso


ALLOWED_EVENTS = {"active", "inactive", "typing"}


def record_event(event_type: str, details: str | None = None) -> dict:
    if event_type not in ALLOWED_EVENTS:
        return {"error": "Event type tidak valid."}

    timestamp = now_iso()
    with get_connection() as conn:
        cur = conn.execute(
            """
            INSERT INTO vscode_activity (event_type, details, created_at)
            VALUES (?, ?, ?)
            """,
            (event_type, details, timestamp),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM vscode_activity WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
    return dict(row)


def _latest_event(event_type: str) -> str | None:
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT created_at FROM vscode_activity
            WHERE event_type = ?
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (event_type,),
        ).fetchone()
    return row["created_at"] if row else None


def _count_since(event_type: str, since: str) -> int:
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT COUNT(*) AS total
            FROM vscode_activity
            WHERE event_type = ? AND datetime(created_at) >= datetime(?)
            """,
            (event_type, since),
        ).fetchone()
    return int(row["total"]) if row else 0


def summary(window_hours: int) -> dict:
    now = datetime.now()
    since = (now - timedelta(hours=window_hours)).replace(microsecond=0)
    since_str = since.isoformat(sep=" ")

    last_active = _latest_event("active")
    last_typing = _latest_event("typing")
    last_inactive = _latest_event("inactive")

    def _within_window(value: str | None) -> bool:
        if not value:
            return False
        try:
            ts = datetime.fromisoformat(value)
        except ValueError:
            return False
        return ts >= since

    return {
        "window_hours": window_hours,
        "since": since_str,
        "last_active_at": last_active,
        "last_typing_at": last_typing,
        "last_inactive_at": last_inactive,
        "active_events": _count_since("active", since_str),
        "typing_events": _count_since("typing", since_str),
        "inactive_events": _count_since("inactive", since_str),
        "is_active": _within_window(last_active),
        "is_typing": _within_window(last_typing),
    }


def history(window_hours: int, limit: int = 50) -> list[dict]:
    now = datetime.now()
    since = (now - timedelta(hours=window_hours)).replace(microsecond=0)
    since_str = since.isoformat(sep=" ")

    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT * FROM vscode_activity
            WHERE datetime(created_at) >= datetime(?)
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (since_str, limit),
        ).fetchall()
    return [dict(row) for row in rows]


def heatmap(days: int) -> dict:
    if days < 7:
        days = 7
    if days > 365:
        days = 365

    now = datetime.now().date()
    start_date = now - timedelta(days=days - 1)
    start_str = start_date.isoformat()

    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT date(created_at) AS day, event_type, COUNT(*) AS total
            FROM vscode_activity
            WHERE date(created_at) >= ?
            GROUP BY day, event_type
            ORDER BY day ASC
            """,
            (start_str,),
        ).fetchall()

    counts: dict[str, dict[str, int]] = {}
    for row in rows:
        day = row["day"]
        if day not in counts:
            counts[day] = {"active": 0, "typing": 0, "inactive": 0}
        counts[day][row["event_type"]] = int(row["total"])

    items: list[dict] = []
    cursor = start_date
    while cursor <= now:
        key = cursor.isoformat()
        day_counts = counts.get(key, {"active": 0, "typing": 0, "inactive": 0})
        items.append(
            {
                "date": key,
                "active": day_counts["active"],
                "typing": day_counts["typing"],
                "inactive": day_counts["inactive"],
            }
        )
        cursor += timedelta(days=1)

    return {"days": days, "items": items}


def timeline(date_str: str, bucket_minutes: int) -> dict:
    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError as exc:
        raise ValueError("Tanggal harus format YYYY-MM-DD.") from exc

    if bucket_minutes < 5 or bucket_minutes > 60:
        raise ValueError("bucket_minutes harus di antara 5 dan 60.")

    buckets_per_day = int(24 * 60 / bucket_minutes)
    counts = [
        {"typing": 0, "active": 0, "inactive": 0}
        for _ in range(buckets_per_day)
    ]

    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT created_at, event_type
            FROM vscode_activity
            WHERE date(created_at) = ?
            """,
            (target_date.isoformat(),),
        ).fetchall()

    for row in rows:
        try:
            ts = datetime.fromisoformat(row["created_at"])
        except ValueError:
            continue
        bucket = int((ts.hour * 60 + ts.minute) / bucket_minutes)
        if 0 <= bucket < buckets_per_day:
            counts[bucket][row["event_type"]] += 1

    items = []
    for idx in range(buckets_per_day):
        minutes = idx * bucket_minutes
        hour = minutes // 60
        minute = minutes % 60
        items.append(
            {
                "start_time": f"{hour:02d}:{minute:02d}",
                "typing": counts[idx]["typing"],
                "active": counts[idx]["active"],
                "inactive": counts[idx]["inactive"],
            }
        )

    return {
        "date": target_date.isoformat(),
        "bucket_minutes": bucket_minutes,
        "items": items,
    }
