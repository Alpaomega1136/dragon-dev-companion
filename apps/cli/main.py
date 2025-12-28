"""DDC CLI entrypoint."""

from __future__ import annotations

from pathlib import Path

import typer
from rich.console import Console
from rich.panel import Panel

from modules.focus_den.core import render_focus_stats, run_pomodoro
from modules.project_roost.core import render_standup, render_tasks_table
from modules.repo_forge.core import render_profile_readme, render_project_readme
from packages.core.config import APP_NAME, OUT_DIR, ensure_dirs, resolve_within_project
from packages.core.storage import DDCStorage
from packages.core.time_utils import parse_due_date


app = typer.Typer(help=f"{APP_NAME} CLI")
focus_app = typer.Typer(help="Focus and productivity tools.")
readme_app = typer.Typer(help="README and profile generators.")
tasks_app = typer.Typer(help="Task system for your project roost.")

app.add_typer(focus_app, name="focus")
app.add_typer(readme_app, name="readme")
app.add_typer(tasks_app, name="tasks")

console = Console()


def _normalize_style(style: str) -> str:
    value = style.strip().lower()
    if value not in ("clean", "cute"):
        raise typer.BadParameter("Style must be 'clean' or 'cute'.")
    return value


@app.command()
def init() -> None:
    """Initialize local DDC data directory and database."""
    ensure_dirs()
    storage = DDCStorage()
    storage.init_db()
    console.print(Panel("DDC initialized. Data lair is ready.", title="Init"))


@focus_app.command("start")
def focus_start(
    minutes: int = typer.Option(25, "--minutes"),
    break_minutes: int = typer.Option(5, "--break"),
    cycles: int = typer.Option(4, "--cycles"),
) -> None:
    """Start a pomodoro focus session."""
    if minutes <= 0:
        raise typer.BadParameter("Minutes must be greater than zero.")
    if break_minutes < 0:
        raise typer.BadParameter("Break minutes cannot be negative.")
    if cycles <= 0:
        raise typer.BadParameter("Cycles must be greater than zero.")
    ensure_dirs()
    storage = DDCStorage()
    storage.ensure_initialized()
    run_pomodoro(minutes, break_minutes, cycles, storage, console)


@focus_app.command("stats")
def focus_stats() -> None:
    """Show focus stats for today and this week."""
    storage = DDCStorage()
    storage.ensure_initialized()
    stats = storage.get_focus_stats()
    console.print(render_focus_stats(stats))


def _write_output(content: str, output: Path) -> Path:
    ensure_dirs()
    try:
        resolved = resolve_within_project(output)
    except ValueError as exc:
        raise typer.BadParameter(str(exc)) from exc
    resolved.parent.mkdir(parents=True, exist_ok=True)
    resolved.write_text(content, encoding="utf-8")
    return resolved


@readme_app.command("profile")
def readme_profile(
    name: str = typer.Option(..., "--name"),
    style: str = typer.Option("clean", "--style", help="cute or clean"),
    output: Path = typer.Option(OUT_DIR / "profile_README.md", "--out"),
) -> None:
    """Generate a GitHub profile README."""
    content = render_profile_readme(name=name, style=_normalize_style(style))
    path = _write_output(content, output)
    console.print(Panel(f"Wrote profile README to {path}", title="Repo Forge"))


@readme_app.command("project")
def readme_project(
    title: str = typer.Option(..., "--title"),
    description: str = typer.Option("", "--description"),
    style: str = typer.Option("clean", "--style", help="cute or clean"),
    output: Path = typer.Option(OUT_DIR / "PROJECT_README.md", "--out"),
) -> None:
    """Generate a project README skeleton."""
    content = render_project_readme(
        title=title,
        description=description,
        style=_normalize_style(style),
    )
    path = _write_output(content, output)
    console.print(Panel(f"Wrote project README to {path}", title="Repo Forge"))


@tasks_app.command("add")
def tasks_add(
    title: str = typer.Argument(...),
    due: str = typer.Option(None, "--due"),
) -> None:
    """Add a new task."""
    storage = DDCStorage()
    storage.ensure_initialized()
    try:
        due_date = parse_due_date(due)
    except ValueError as exc:
        raise typer.BadParameter(str(exc)) from exc
    task_id = storage.add_task(title=title, due_date=due_date)
    console.print(Panel(f"Task {task_id} added.", title="Project Roost"))


@tasks_app.command("list")
def tasks_list(
    show_all: bool = typer.Option(False, "--all"),
) -> None:
    """List tasks."""
    storage = DDCStorage()
    storage.ensure_initialized()
    tasks = storage.list_tasks(include_done=show_all)
    if tasks:
        console.print(render_tasks_table(tasks, show_status=show_all))
    else:
        console.print(Panel("No tasks found.", title="Project Roost"))


@tasks_app.command("done")
def tasks_done(task_id: int = typer.Argument(...)) -> None:
    """Mark a task as done."""
    storage = DDCStorage()
    storage.ensure_initialized()
    updated = storage.mark_task_done(task_id)
    if updated:
        console.print(Panel(f"Task {task_id} marked done.", title="Project Roost"))
    else:
        console.print(Panel(f"Task {task_id} not found or already done.", title="Project Roost"))


@app.command()
def standup() -> None:
    """Daily standup view: tasks + deadlines + git summary."""
    storage = DDCStorage()
    storage.ensure_initialized()
    render_standup(storage, console, Path.cwd())


@app.command()
def tui() -> None:
    """Launch the Textual dashboard."""
    try:
        from apps.tui.app import run_tui
    except Exception:
        console.print(
            Panel(
                "Textual is not installed. Install with: pip install .[tui]",
                title="TUI",
            )
        )
        raise typer.Exit(code=1)
    run_tui()


def main() -> None:
    app()


if __name__ == "__main__":
    main()
