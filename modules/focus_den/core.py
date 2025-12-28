"""Pomodoro and focus stats."""

from __future__ import annotations

import time

from rich.console import Console
from rich.panel import Panel
from rich.progress import BarColumn, Progress, TimeRemainingColumn
from rich.text import Text

from packages.core.config import read_ascii_dragon
from packages.core.storage import DDCStorage, FocusStats
from packages.core.time_utils import format_dt, now_local


def _countdown(seconds: int, label: str, console: Console) -> tuple[int, bool]:
    if seconds <= 0:
        return 0, True
    elapsed = 0
    try:
        with Progress(
            "[progress.description]{task.description}",
            BarColumn(),
            TimeRemainingColumn(),
            console=console,
        ) as progress:
            task_id = progress.add_task(label, total=seconds)
            start = time.time()
            while elapsed < seconds:
                time.sleep(1)
                elapsed = int(time.time() - start)
                progress.update(task_id, completed=min(elapsed, seconds))
    except KeyboardInterrupt:
        return elapsed, False
    return elapsed, True


def run_pomodoro(
    minutes: int,
    break_minutes: int,
    cycles: int,
    storage: DDCStorage,
    console: Console,
) -> None:
    dragon = read_ascii_dragon()
    if dragon:
        console.print(Panel(dragon, title="Dragon Dev Companion"))
    console.print("[bold]Focus Den[/bold] - Settle in and breathe fire on your tasks.")

    for cycle in range(1, cycles + 1):
        console.print(f"\n[bold]Cycle {cycle}/{cycles}[/bold]")
        console.print("Work session begins. Keep the hoard growing.")
        start_dt = now_local()
        elapsed, completed = _countdown(minutes * 60, "Working", console)
        end_dt = now_local()
        worked_minutes = int(elapsed // 60)
        if worked_minutes > 0:
            storage.add_focus_session(
                format_dt(start_dt),
                format_dt(end_dt),
                worked_minutes,
                "work",
            )
        if not completed:
            console.print("[yellow]Session interrupted. Logged partial focus time.[/yellow]")
            break

        if cycle < cycles:
            console.print("Break time. Stretch those wings.")
            b_start = now_local()
            b_elapsed, b_completed = _countdown(break_minutes * 60, "Break", console)
            b_end = now_local()
            break_minutes_done = int(b_elapsed // 60)
            if break_minutes_done > 0:
                storage.add_focus_session(
                    format_dt(b_start),
                    format_dt(b_end),
                    break_minutes_done,
                    "break",
                )
            if not b_completed:
                console.print("[yellow]Break interrupted. Returning to the lair.[/yellow]")
                break

    console.print("\n[bold]Focus session complete.[/bold]")


def render_focus_stats(stats: FocusStats) -> Panel:
    lines = [
        f"Today: {stats.today_minutes} min across {stats.today_sessions} sessions",
        f"Week: {stats.week_minutes} min across {stats.week_sessions} sessions",
        f"Streak: {stats.streak_days} day(s) of focus",
    ]
    text = Text("\n".join(lines))
    return Panel(text, title="Focus Den Stats")
