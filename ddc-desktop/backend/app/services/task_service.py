"""Task CRUD helpers."""

from __future__ import annotations

from app.db import get_connection
from app.utils.time_utils import now_iso


def _row_to_dict(row) -> dict:
    return dict(row) if row else {}


def add_task(data: dict) -> dict:
    timestamp = now_iso()
    with get_connection() as conn:
        cur = conn.execute(
            """
            INSERT INTO tasks
            (title, description, priority, due_date, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'todo', ?, ?)
            """,
            (
                data["title"],
                data.get("description"),
                data.get("priority", "med"),
                data.get("due_date"),
                timestamp,
                timestamp,
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (cur.lastrowid,)).fetchone()
    return _row_to_dict(row)


def list_tasks(status: str) -> list[dict]:
    query = "SELECT * FROM tasks"
    params: list[str] = []
    if status != "all":
        query += " WHERE status = ?"
        params.append(status)
    query += " ORDER BY due_date IS NULL, due_date, created_at"
    with get_connection() as conn:
        rows = conn.execute(query, params).fetchall()
    return [dict(row) for row in rows]


def update_task(task_id: int, updates: dict) -> dict:
    fields = []
    params: list[object] = []
    for key in ("title", "description", "priority", "due_date", "status"):
        if key in updates and updates[key] is not None:
            fields.append(f"{key} = ?")
            params.append(updates[key])
    if not fields:
        return {"error": "No updates provided."}

    fields.append("updated_at = ?")
    params.append(now_iso())
    params.append(task_id)

    with get_connection() as conn:
        cur = conn.execute(
            f"UPDATE tasks SET {', '.join(fields)} WHERE id = ?",
            params,
        )
        conn.commit()
        if cur.rowcount == 0:
            return {"error": "Task not found."}
        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    return _row_to_dict(row)


def toggle_done(task_id: int) -> dict:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        if not row:
            return {"error": "Task not found."}
        new_status = "done" if row["status"] != "done" else "todo"
        conn.execute(
            "UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?",
            (new_status, now_iso(), task_id),
        )
        conn.commit()
        updated = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    return _row_to_dict(updated)


def delete_task(task_id: int) -> dict:
    with get_connection() as conn:
        cur = conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        conn.commit()
        if cur.rowcount == 0:
            return {"error": "Task not found."}
    return {"message": "Task deleted."}
