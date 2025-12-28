from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from packages.core.storage import DDCStorage
from packages.core.time_utils import format_dt, now_local


def _new_storage() -> DDCStorage:
    tmp_dir = Path("tests/.tmp")
    tmp_dir.mkdir(parents=True, exist_ok=True)
    db_path = tmp_dir / f"ddc_test_{uuid4().hex}.sqlite3"
    storage = DDCStorage(db_path=db_path)
    storage.init_db()
    return storage


def test_task_lifecycle() -> None:
    storage = _new_storage()
    task_id = storage.add_task("Sharpen claws", None)
    tasks = storage.list_tasks()
    assert any(task.id == task_id for task in tasks)

    updated = storage.mark_task_done(task_id)
    assert updated is True
    open_tasks = storage.list_tasks()
    assert all(task.id != task_id for task in open_tasks)


def test_focus_stats() -> None:
    storage = _new_storage()
    now = now_local()
    storage.add_focus_session(
        start_ts=format_dt(now),
        end_ts=format_dt(now),
        minutes=25,
        session_type="work",
    )
    stats = storage.get_focus_stats()
    assert stats.today_minutes >= 25
    assert stats.today_sessions >= 1
