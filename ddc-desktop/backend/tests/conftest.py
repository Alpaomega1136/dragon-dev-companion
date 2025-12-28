from __future__ import annotations

from pathlib import Path

import pytest

import app.db as db


@pytest.fixture()
def temp_db(tmp_path, monkeypatch):
    data_dir = tmp_path / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    test_db = data_dir / "ddc.db"

    def _db_path():
        return test_db

    def _ensure_dirs():
        data_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(db, "db_path", _db_path)
    monkeypatch.setattr(db, "ensure_dirs", _ensure_dirs)
    db.init_db()
    return test_db
