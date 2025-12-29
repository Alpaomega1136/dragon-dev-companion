"""Task system helpers."""

from __future__ import annotations

from datetime import date

from rich.table import Table

from packages.core.storage import TaskItem


def _task_due_label(task: TaskItem, today: date) -> str:
    if not task.due_date:
        return "-"
    if task.due_date < today.isoformat():
        return f"{task.due_date} (overdue)"
    if task.due_date == today.isoformat():
        return f"{task.due_date} (today)"
    return task.due_date


def render_tasks_table(tasks: list[TaskItem], show_status: bool = False) -> Table:
    today = date.today()
    table = Table(title="Project Roost Tasks")
    table.add_column("ID", style="bold")
    table.add_column("Title")
    table.add_column("Due")
    if show_status:
        table.add_column("Status")
    for task in tasks:
        row = [str(task.id), task.title, _task_due_label(task, today)]
        if show_status:
            row.append(task.status)
        table.add_row(*row)
    return table
