from __future__ import annotations

from app.services import task_service


def test_task_crud(temp_db):
    created = task_service.add_task(
        {"title": "Test task", "description": None, "priority": "low", "due_date": None}
    )
    assert created["id"] > 0
    assert created["status"] == "todo"

    tasks = task_service.list_tasks("all")
    assert len(tasks) == 1

    updated = task_service.update_task(created["id"], {"status": "doing"})
    assert updated["status"] == "doing"

    toggled = task_service.toggle_done(created["id"])
    assert toggled["status"] == "done"

    deleted = task_service.delete_task(created["id"])
    assert deleted["message"] == "Task deleted."
