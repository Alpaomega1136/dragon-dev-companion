"""Time helpers for DDC."""

from __future__ import annotations

from datetime import date, datetime


def now_local() -> datetime:
    return datetime.now()


def format_dt(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def today_date() -> date:
    return date.today()


def parse_due_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise ValueError("Date must be in YYYY-MM-DD format.") from exc
