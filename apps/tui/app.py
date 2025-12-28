"""Textual TUI dashboard for DDC."""

from __future__ import annotations

from pathlib import Path

from rich.console import Group
from rich.panel import Panel
from rich.text import Text
from textual.app import App, ComposeResult
from textual.widgets import Footer, Header, Static, TabbedContent, TabPane

from modules.focus_den.core import render_focus_stats
from modules.project_roost.core import render_tasks_table
from packages.core.git_utils import git_summary
from packages.core.storage import DDCStorage


class DDCApp(App):
    TITLE = "Dragon Dev Companion"
    BINDINGS = [("q", "quit", "Quit")]

    def compose(self) -> ComposeResult:
        storage = DDCStorage()
        storage.ensure_initialized()

        stats_panel = render_focus_stats(storage.get_focus_stats())
        tasks = storage.list_tasks(include_done=False)
        tasks_panel = render_tasks_table(tasks) if tasks else Panel("No open tasks.", title="Tasks")

        forge_text = Text(
            "Use `ddc readme profile` or `ddc readme project` in the CLI to forge READMEs.",
        )

        standup_renderable = self._standup_renderable(storage)

        yield Header()
        with TabbedContent():
            yield TabPane("Focus", Static(stats_panel))
            yield TabPane("Tasks", Static(tasks_panel))
            yield TabPane("README Forge", Static(forge_text))
            yield TabPane("Standup", Static(standup_renderable))
        yield Footer()

    def _standup_renderable(self, storage: DDCStorage):
        tasks = storage.list_tasks(include_done=False)
        tasks_renderable = (
            render_tasks_table(tasks) if tasks else Panel("No open tasks.", title="Tasks")
        )
        summary = git_summary(Path.cwd())
        if summary.error:
            git_panel = Panel(summary.error, title="Git Summary")
        elif not summary.is_repo:
            git_panel = Panel("Not a git repository.", title="Git Summary")
        else:
            lines = [
                f"Branch: {summary.branch or '-'}",
                f"Dirty files: {summary.dirty_count if summary.dirty_count is not None else '-'}",
                f"Last commit: {summary.last_commit or '-'}",
            ]
            git_panel = Panel("\n".join(lines), title="Git Summary")
        return Group(tasks_renderable, git_panel)


def run_tui() -> None:
    app = DDCApp()
    app.run()
