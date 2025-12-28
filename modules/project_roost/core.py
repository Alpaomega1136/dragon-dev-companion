"""Task system and standup view."""

from __future__ import annotations

from datetime import date

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from packages.core.git_utils import git_summary
from packages.core.storage import DDCStorage, TaskItem


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


def render_standup(storage: DDCStorage, console: Console, cwd_path) -> None:
    tasks = storage.list_open_tasks_with_due()
    if tasks:
        console.print(render_tasks_table(tasks))
    else:
        console.print(Panel("No open tasks. The roost is calm.", title="Tasks"))

    summary = git_summary(cwd_path)
    if summary.error:
        console.print(Panel(summary.error, title="Git Summary"))
        return
    if not summary.is_repo:
        console.print(Panel("Not a git repository.", title="Git Summary"))
        return

    lines = [
        f"Branch: {summary.branch or '-'}",
        f"Dirty files: {summary.dirty_count if summary.dirty_count is not None else '-'}",
        f"Last commit: {summary.last_commit or '-'}",
    ]
    console.print(Panel("\n".join(lines), title="Git Summary"))
