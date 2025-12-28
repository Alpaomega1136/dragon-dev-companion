from __future__ import annotations

from modules.repo_forge.core import render_profile_readme, render_project_readme


def test_profile_readme_contains_sections() -> None:
    content = render_profile_readme(name="Ray")
    assert "# Ray" in content
    assert "## About" in content
    assert "## Tech Stack" in content


def test_project_readme_contains_sections() -> None:
    content = render_project_readme(title="Dragon Tracker", description="Test")
    assert "# Dragon Tracker" in content
    assert "## About" in content
    assert "## Roadmap" in content
