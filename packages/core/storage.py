"""SQLite storage for DDC."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
import sqlite3
from pathlib import Path
from typing import Iterable

from packages.core.config import DB_PATH
from packages.core.time_utils import format_dt, now_local, today_date


@dataclass
class FocusStats:
    today_minutes: int
    today_sessions: int
    week_minutes: int
    week_sessions: int
    streak_days: int


@dataclass
class TaskItem:
    id: int
    title: str
    status: str
    created_ts: str
    due_date: str | None
    done_ts: str | None


class DDCStorage:
    def __init__(self, db_path: Path | None = None) -> None:
        self.db_path = db_path or DB_PATH

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS focus_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    start_ts TEXT NOT NULL,
                    end_ts TEXT NOT NULL,
                    minutes INTEGER NOT NULL,
                    session_type TEXT NOT NULL
                );
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_focus_start
                ON focus_sessions(start_ts);
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_ts TEXT NOT NULL,
                    due_date TEXT,
                    done_ts TEXT
                );
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_tasks_status
                ON tasks(status);
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_tasks_due
                ON tasks(due_date);
                """
            )
            conn.commit()

    def add_focus_session(
        self,
        start_ts: str,
        end_ts: str,
        minutes: int,
        session_type: str = "work",
    ) -> int:
        with self._connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO focus_sessions (start_ts, end_ts, minutes, session_type)
                VALUES (?, ?, ?, ?)
                """,
                (start_ts, end_ts, minutes, session_type),
            )
            conn.commit()
            return int(cur.lastrowid)

    def get_focus_stats(self) -> FocusStats:
        today = today_date()
        week_start = today - timedelta(days=6)
        with self._connect() as conn:
            cur_today = conn.execute(
                """
                SELECT COALESCE(SUM(minutes), 0) AS minutes, COUNT(*) AS sessions
                FROM focus_sessions
                WHERE session_type = 'work' AND date(start_ts) = ?
                """,
                (today.isoformat(),),
            )
            today_row = cur_today.fetchone()
            cur_week = conn.execute(
                """
                SELECT COALESCE(SUM(minutes), 0) AS minutes, COUNT(*) AS sessions
                FROM focus_sessions
                WHERE session_type = 'work' AND date(start_ts) >= ?
                """,
                (week_start.isoformat(),),
            )
            week_row = cur_week.fetchone()
            cur_dates = conn.execute(
                """
                SELECT DISTINCT date(start_ts) AS d
                FROM focus_sessions
                WHERE session_type = 'work'
                ORDER BY d DESC
                """
            )
            dates = {row["d"] for row in cur_dates.fetchall() if row["d"]}

        streak = 0
        cursor = today
        while cursor.isoformat() in dates:
            streak += 1
            cursor = cursor - timedelta(days=1)

        return FocusStats(
            today_minutes=int(today_row["minutes"]),
            today_sessions=int(today_row["sessions"]),
            week_minutes=int(week_row["minutes"]),
            week_sessions=int(week_row["sessions"]),
            streak_days=streak,
        )

    def add_task(self, title: str, due_date: date | None) -> int:
        created_ts = format_dt(now_local())
        due_value = due_date.isoformat() if due_date else None
        with self._connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO tasks (title, status, created_ts, due_date, done_ts)
                VALUES (?, 'open', ?, ?, NULL)
                """,
                (title, created_ts, due_value),
            )
            conn.commit()
            return int(cur.lastrowid)

    def list_tasks(self, include_done: bool = False) -> list[TaskItem]:
        query = "SELECT * FROM tasks"
        params: Iterable[str] = []
        if not include_done:
            query += " WHERE status = 'open'"
        query += " ORDER BY due_date IS NULL, due_date, created_ts"
        with self._connect() as conn:
            cur = conn.execute(query, params)
            rows = cur.fetchall()
        return [TaskItem(**dict(row)) for row in rows]

    def mark_task_done(self, task_id: int) -> bool:
        done_ts = format_dt(now_local())
        with self._connect() as conn:
            cur = conn.execute(
                """
                UPDATE tasks
                SET status = 'done', done_ts = ?
                WHERE id = ? AND status = 'open'
                """,
                (done_ts, task_id),
            )
            conn.commit()
            return cur.rowcount > 0

    def list_open_tasks_with_due(self) -> list[TaskItem]:
        with self._connect() as conn:
            cur = conn.execute(
                """
                SELECT * FROM tasks
                WHERE status = 'open'
                ORDER BY due_date IS NULL, due_date, created_ts
                """
            )
            rows = cur.fetchall()
        return [TaskItem(**dict(row)) for row in rows]

    def ensure_initialized(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        if not self.db_path.exists():
            self.init_db()
