"""Template rendering for README generation."""

from __future__ import annotations

from modules.repo_forge.templates import PROFILE_TEMPLATES, PROJECT_TEMPLATES


def render_profile_readme(name: str, style: str = "clean") -> str:
    template = PROFILE_TEMPLATES.get(style, PROFILE_TEMPLATES["clean"])
    return template.format(
        name=name,
        about="Write a short bio: what you build, what you love, what you are exploring.",
        github_handle="https://github.com/your-handle",
        website="https://your-site.example",
    )


def render_project_readme(title: str, description: str, style: str = "clean") -> str:
    template = PROJECT_TEMPLATES.get(style, PROJECT_TEMPLATES["clean"])
    return template.format(
        title=title,
        description=description or "Add a crisp summary of the project goal and audience.",
    )
