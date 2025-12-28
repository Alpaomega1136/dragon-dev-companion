"""Git summary service."""

from __future__ import annotations

from pathlib import Path
import subprocess


def _run_git(repo_path: Path, args: list[str]) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=repo_path,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "git command failed")
    return result.stdout.strip()


def summary(repo_path: str) -> dict:
    path = Path(repo_path)
    if not path.exists() or not path.is_dir():
        return {"ok": False, "message": "Repo path tidak ditemukan."}

    try:
        inside = _run_git(path, ["rev-parse", "--is-inside-work-tree"])
        if inside.lower() != "true":
            return {"ok": False, "message": "Bukan repository git."}
        branch = _run_git(path, ["rev-parse", "--abbrev-ref", "HEAD"])
        last_commit = _run_git(path, ["log", "-1", "--pretty=%s"])
        status = _run_git(path, ["status", "--porcelain"])
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "message": str(exc)}

    staged = 0
    unstaged = 0
    for line in status.splitlines():
        if not line:
            continue
        x = line[0]
        y = line[1] if len(line) > 1 else " "
        if x != " " and x != "?":
            staged += 1
        if y != " " or x == "?":
            unstaged += 1

    return {
        "ok": True,
        "message": "OK",
        "branch": branch,
        "last_commit": last_commit,
        "staged": staged,
        "unstaged": unstaged,
    }
