"""Path helpers for backend."""

from __future__ import annotations

from pathlib import Path


def base_dir() -> Path:
    return Path(__file__).resolve().parents[3]


def data_dir() -> Path:
    return base_dir() / "data"


def out_dir() -> Path:
    return base_dir() / "out"


def db_path() -> Path:
    return data_dir() / "ddc.db"


def ensure_dirs() -> None:
    data_dir().mkdir(parents=True, exist_ok=True)
    out_dir().mkdir(parents=True, exist_ok=True)
