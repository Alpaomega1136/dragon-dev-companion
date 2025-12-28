"""SQLite database initialization and connection helpers."""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager

from app.utils.path_utils import db_path, ensure_dirs


def init_db() -> None:
    ensure_dirs()
    with sqlite3.connect(db_path()) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS pomodoro_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mode TEXT NOT NULL,
                status TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT,
                duration_minutes INTEGER NOT NULL,
                elapsed_minutes REAL NOT NULL DEFAULT 0,
                last_start_time TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                priority TEXT NOT NULL,
                due_date TEXT,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS readme_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                created_at TEXT NOT NULL,
                output_path TEXT NOT NULL
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS vscode_activity (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                details TEXT,
                created_at TEXT NOT NULL
            );
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_vscode_activity_type
            ON vscode_activity(event_type);
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_vscode_activity_time
            ON vscode_activity(created_at);
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_pomodoro_status ON pomodoro_sessions(status);"
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);")
        conn.commit()


@contextmanager
def get_connection() -> sqlite3.Connection:
    ensure_dirs()
    conn = sqlite3.connect(db_path())
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()
