"""Time utilities for backend."""

from __future__ import annotations

from datetime import date, datetime


def now_iso() -> str:
    return datetime.now().replace(microsecond=0).isoformat(sep=" ")


def today_date() -> date:
    return date.today()


def parse_date(value: str | None) -> date | None:
    if not value:
        return None
    return datetime.strptime(value, "%Y-%m-%d").date()
