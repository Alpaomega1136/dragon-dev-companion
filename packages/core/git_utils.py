"""Safe, read-only git helpers."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import subprocess

from packages.core.config import PROJECT_ROOT


@dataclass
class GitSummary:
    is_repo: bool
    branch: str | None
    dirty_count: int | None
    last_commit: str | None
    error: str | None = None


def _run_git(args: list[str], cwd: Path) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=cwd,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "git command failed")
    return result.stdout.strip()


def git_summary(cwd: Path) -> GitSummary:
    try:
        cwd.resolve().relative_to(PROJECT_ROOT)
    except ValueError:
        return GitSummary(
            is_repo=False,
            branch=None,
            dirty_count=None,
            last_commit=None,
            error="Refusing to inspect git outside the project directory.",
        )

    try:
        inside = _run_git(["rev-parse", "--is-inside-work-tree"], cwd)
        if inside.strip().lower() != "true":
            return GitSummary(False, None, None, None, None)
    except Exception as exc:  # noqa: BLE001
        return GitSummary(False, None, None, None, str(exc))

    try:
        branch = _run_git(["branch", "--show-current"], cwd)
    except Exception:
        branch = None
    try:
        status = _run_git(["status", "--porcelain"], cwd)
        dirty_count = len([line for line in status.splitlines() if line.strip()])
    except Exception:
        dirty_count = None
    try:
        last_commit = _run_git(["log", "-1", "--pretty=%s"], cwd)
    except Exception:
        last_commit = None

    return GitSummary(
        is_repo=True,
        branch=branch or None,
        dirty_count=dirty_count,
        last_commit=last_commit or None,
    )
