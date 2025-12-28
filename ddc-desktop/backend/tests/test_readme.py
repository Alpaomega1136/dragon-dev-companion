from __future__ import annotations

from pathlib import Path

import app.services.readme_service as readme_service
import app.utils.path_utils as path_utils


def test_generate_profile(tmp_path, monkeypatch, temp_db):
    out_dir = tmp_path / "out"
    out_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(path_utils, "out_dir", lambda: out_dir)

    result = readme_service.generate_profile(
        {"name": "Ray", "bio": "Dev", "tech": "Python", "links": "https://x"}
    )
    output_path = Path(result["path"])
    assert output_path.exists()


def test_generate_project(tmp_path, monkeypatch, temp_db):
    out_dir = tmp_path / "out"
    out_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(path_utils, "out_dir", lambda: out_dir)

    result = readme_service.generate_project(
        {
            "title": "DDC",
            "description": "Desc",
            "features": "- A",
            "usage": "Run",
            "stack": "Python",
            "links": "",
        }
    )
    output_path = Path(result["path"])
    assert output_path.exists()
