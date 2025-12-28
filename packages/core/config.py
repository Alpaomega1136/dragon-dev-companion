"""Configuration and paths for DDC."""

from __future__ import annotations

from pathlib import Path


APP_NAME = "Dragon Dev Companion"
APP_SHORT = "DDC"

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / ".ddc_data"
OUT_DIR = PROJECT_ROOT / "out"
ASSETS_DIR = PROJECT_ROOT / "assets"
DB_PATH = DATA_DIR / "ddc.sqlite3"


def ensure_dirs() -> None:
    """Create required local directories."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)


def resolve_within_project(path: Path) -> Path:
    """Resolve a path and ensure it is inside the project root."""
    resolved = (PROJECT_ROOT / path).resolve() if not path.is_absolute() else path.resolve()
    try:
        resolved.relative_to(PROJECT_ROOT)
    except ValueError as exc:
        raise ValueError("Path must be inside the project directory.") from exc
    return resolved


def read_ascii_dragon() -> str:
    """Load the ASCII dragon art if available."""
    dragon_path = ASSETS_DIR / "ascii_dragon.txt"
    if dragon_path.exists():
        return dragon_path.read_text(encoding="utf-8")
    return ""
