"""Textual TUI dashboard for DDC."""

from __future__ import annotations

from rich.panel import Panel
from rich.text import Text
from textual.app import App, ComposeResult
from textual.widgets import Footer, Header, Static, TabbedContent, TabPane

from modules.focus_den.core import render_focus_stats
from modules.project_roost.core import render_tasks_table
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

        yield Header()
        with TabbedContent():
            yield TabPane("Focus", Static(stats_panel))
            yield TabPane("Tasks", Static(tasks_panel))
            yield TabPane("README Forge", Static(forge_text))
        yield Footer()


def run_tui() -> None:
    app = DDCApp()
    app.run()
