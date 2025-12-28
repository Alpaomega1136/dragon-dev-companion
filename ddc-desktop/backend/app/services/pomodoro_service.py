"""Pomodoro session handling."""

from __future__ import annotations

from datetime import datetime, timedelta

from app.db import get_connection
from app.utils.time_utils import now_iso, today_date


def _row_to_dict(row) -> dict:
    return dict(row) if row else {}


def get_active_session() -> dict | None:
    with get_connection() as conn:
        cur = conn.execute(
            """
            SELECT * FROM pomodoro_sessions
            WHERE status IN ('running', 'paused')
            ORDER BY id DESC
            LIMIT 1
            """
        )
        row = cur.fetchone()
    return _row_to_dict(row) if row else None


def start_session(mode: str, duration_minutes: int) -> dict:
    active = get_active_session()
    if active:
        return {"error": "Session already running or paused."}

    timestamp = now_iso()
    with get_connection() as conn:
        cur = conn.execute(
            """
            INSERT INTO pomodoro_sessions
            (mode, status, start_time, end_time, duration_minutes,
             elapsed_minutes, last_start_time, created_at, updated_at)
            VALUES (?, 'running', ?, NULL, ?, 0, ?, ?, ?)
            """,
            (mode, timestamp, duration_minutes, timestamp, timestamp, timestamp),
        )
        conn.commit()
        session_id = cur.lastrowid
        row = conn.execute(
            "SELECT * FROM pomodoro_sessions WHERE id = ?", (session_id,)
        ).fetchone()
    return _row_to_dict(row)


def pause_session() -> dict:
    active = get_active_session()
    if not active or active["status"] != "running":
        return {"error": "No running session to pause."}

    last_start = datetime.fromisoformat(active["last_start_time"])
    now = datetime.now()
    delta_minutes = (now - last_start).total_seconds() / 60.0
    elapsed = float(active["elapsed_minutes"]) + delta_minutes

    with get_connection() as conn:
        conn.execute(
            """
            UPDATE pomodoro_sessions
            SET status = 'paused',
                elapsed_minutes = ?,
                last_start_time = NULL,
                updated_at = ?
            WHERE id = ?
            """,
            (elapsed, now_iso(), active["id"]),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM pomodoro_sessions WHERE id = ?", (active["id"],)
        ).fetchone()
    return _row_to_dict(row)


def resume_session() -> dict:
    active = get_active_session()
    if not active or active["status"] != "paused":
        return {"error": "No paused session to resume."}

    timestamp = now_iso()
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE pomodoro_sessions
            SET status = 'running',
                last_start_time = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (timestamp, timestamp, active["id"]),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM pomodoro_sessions WHERE id = ?", (active["id"],)
        ).fetchone()
    return _row_to_dict(row)


def stop_session() -> dict:
    active = get_active_session()
    if not active:
        return {"error": "No active session to stop."}

    now = datetime.now()
    elapsed = float(active["elapsed_minutes"])
    if active["status"] == "running" and active["last_start_time"]:
        last_start = datetime.fromisoformat(active["last_start_time"])
        elapsed += (now - last_start).total_seconds() / 60.0

    with get_connection() as conn:
        conn.execute(
            """
            UPDATE pomodoro_sessions
            SET status = 'stopped',
                end_time = ?,
                elapsed_minutes = ?,
                last_start_time = NULL,
                updated_at = ?
            WHERE id = ?
            """,
            (now_iso(), elapsed, now_iso(), active["id"]),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM pomodoro_sessions WHERE id = ?", (active["id"],)
        ).fetchone()
    return _row_to_dict(row)


def status() -> dict:
    active = get_active_session()
    return active or {"status": "idle"}


def stats(range_name: str) -> dict:
    today = today_date()
    week_start = today - timedelta(days=6)
    where_clause = ""
    params: list[str] = []

    if range_name == "today":
        where_clause = "AND date(end_time) = ?"
        params.append(today.isoformat())
    elif range_name == "week":
        where_clause = "AND date(end_time) >= ?"
        params.append(week_start.isoformat())

    with get_connection() as conn:
        row = conn.execute(
            f"""
            SELECT COALESCE(SUM(elapsed_minutes), 0) AS total_minutes,
                   COUNT(*) AS sessions
            FROM pomodoro_sessions
            WHERE mode = 'focus'
              AND status = 'stopped'
              AND end_time IS NOT NULL
              {where_clause}
            """,
            params,
        ).fetchone()

    return {
        "range": range_name,
        "total_focus_minutes": float(row["total_minutes"]),
        "total_sessions": int(row["sessions"]),
    }
