"""GitHub data loader for offline profile display."""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

from app.utils.path_utils import data_dir


def _read_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def summary(year: int | None = None) -> dict[str, Any]:
    path = data_dir() / "github_profile.json"
    if not path.exists():
        return {
            "profile": None,
            "repos": [],
            "contributions": [],
            "available_years": [],
            "year": year or datetime.now().year,
            "message": "No GitHub profile data found. Add data/github_profile.json."
        }

    data = _read_json(path)
    profile = data.get("profile") if isinstance(data, dict) else None
    if not isinstance(profile, dict):
        profile = {}

    avatar_file = profile.get("avatar_file") or profile.get("avatar_path")
    avatar_url = None
    if avatar_file:
        file_name = Path(avatar_file).name
        avatar_path = data_dir() / file_name
        if avatar_path.exists():
            avatar_url = f"/github/avatar?file={file_name}"
    profile["avatar_url"] = avatar_url

    repos = data.get("repos", []) if isinstance(data, dict) else []
    contributions = data.get("contributions", []) if isinstance(data, dict) else []
    if not isinstance(repos, list):
        repos = []
    if not isinstance(contributions, list):
        contributions = []

    contributions_by_year = data.get("contributions_by_year") if isinstance(data, dict) else None
    if not isinstance(contributions_by_year, dict):
        contributions_by_year = {}

    available_years: list[int] = []
    for key in contributions_by_year.keys():
        try:
            available_years.append(int(key))
        except (TypeError, ValueError):
            continue
    available_years = sorted(set(available_years))

    last_sync_year = data.get("last_sync_year") if isinstance(data, dict) else None
    try:
        last_sync_year = int(last_sync_year) if last_sync_year is not None else None
    except (TypeError, ValueError):
        last_sync_year = None

    selected_year = year or last_sync_year
    if selected_year is None and available_years:
        selected_year = max(available_years)
    if selected_year is None:
        selected_year = datetime.now().year

    if contributions_by_year:
        year_key = str(selected_year)
        year_contrib = contributions_by_year.get(year_key, [])
        if isinstance(year_contrib, list):
            contributions = year_contrib
        else:
            contributions = []

    message = data.get("message") if isinstance(data, dict) else None
    last_sync = data.get("last_sync") if isinstance(data, dict) else None
    return {
        "profile": profile,
        "repos": repos,
        "contributions": contributions,
        "available_years": available_years,
        "year": selected_year,
        "last_sync_year": last_sync_year,
        "message": message,
        "last_sync": last_sync,
    }


def avatar_path(file_name: str) -> Path | None:
    if not file_name:
        return None
    safe_name = Path(file_name).name
    if not safe_name:
        return None
    path = data_dir() / safe_name
    if not path.exists():
        return None
    return path


class _ContributionParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.date_by_id: dict[str, str] = {}
        self.count_by_id: dict[str, int] = {}
        self._current_tooltip_for: str | None = None
        self._tooltip_text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = {key: value for key, value in attrs}
        date_value = attr_map.get("data-date")
        id_value = attr_map.get("id")
        if date_value and id_value:
            if re.match(r"^\d{4}-\d{2}-\d{2}$", date_value):
                self.date_by_id[id_value] = date_value
        if tag == "tool-tip":
            self._current_tooltip_for = attr_map.get("for")
            self._tooltip_text = []
        if not id_value:
            return
        count_value = attr_map.get("data-count")
        count = _parse_contribution_count(count_value)
        if count is None:
            label = attr_map.get("aria-label") or ""
            count = _parse_contribution_count(label)
        if count is None:
            return
        self.count_by_id[id_value] = count

    def handle_data(self, data: str) -> None:
        if self._current_tooltip_for is not None:
            self._tooltip_text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag != "tool-tip":
            return
        if not self._current_tooltip_for:
            self._tooltip_text = []
            return
        text = " ".join(self._tooltip_text).strip()
        self._tooltip_text = []
        target_id = self._current_tooltip_for
        self._current_tooltip_for = None
        count = _parse_contribution_count(text)
        if count is None:
            return
        self.count_by_id[target_id] = count


def _parse_contribution_count(text: str | None) -> int | None:
    if not text:
        return None
    value = unescape(str(text)).strip()
    if not value:
        return None
    if re.fullmatch(r"\d+", value):
        return int(value)
    lower_value = value.lower()
    if "no contribution" in lower_value:
        return 0
    match = re.search(r"(\d+)\s+contribution", value, re.IGNORECASE)
    if match:
        try:
            return int(match.group(1))
        except ValueError:
            return None
    return None


def _request_json(url: str) -> dict[str, Any]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "DDC-Desktop",
            "Accept": "application/vnd.github+json",
        },
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        payload = resp.read().decode("utf-8")
    return json.loads(payload)


def _request_text(url: str) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "DDC-Desktop",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.read().decode("utf-8")


def _download_binary(url: str, file_name: str) -> str | None:
    req = urllib.request.Request(url, headers={"User-Agent": "DDC-Desktop"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = resp.read()
    except (urllib.error.URLError, urllib.error.HTTPError):
        return None
    target = data_dir() / file_name
    try:
        target.write_bytes(data)
    except OSError:
        return None
    return file_name


def _parse_username(profile: str) -> str | None:
    value = profile.strip()
    if not value:
        return None
    if value.startswith("http://") or value.startswith("https://"):
        try:
            parsed = urllib.parse.urlparse(value)
        except ValueError:
            return None
        parts = parsed.path.strip("/").split("/")
        return parts[0] if parts else None
    if "/" in value:
        value = value.split("/")[0]
    return re.sub(r"[^A-Za-z0-9-]", "", value) or None


def _fetch_profile(username: str) -> dict[str, Any]:
    url = f"https://api.github.com/users/{username}"
    data = _request_json(url)
    return {
        "name": data.get("name") or username,
        "username": data.get("login") or username,
        "bio": data.get("bio") or "",
        "location": data.get("location") or "",
        "followers": data.get("followers"),
        "following": data.get("following"),
        "avatar_url": data.get("avatar_url"),
    }


def _fetch_repos(username: str) -> list[dict[str, Any]]:
    url = f"https://api.github.com/users/{username}/repos?per_page=100&sort=updated"
    data = _request_json(url)
    repos: list[dict[str, Any]] = []
    if not isinstance(data, list):
        return repos
    for item in data:
        if not isinstance(item, dict):
            continue
        repos.append(
            {
                "name": item.get("name"),
                "description": item.get("description"),
                "language": item.get("language"),
                "stars": item.get("stargazers_count"),
                "updated_at": item.get("updated_at"),
                "private": item.get("private"),
                "html_url": item.get("html_url"),
            }
        )
    return repos


def _fetch_contributions(username: str, year: int) -> list[dict[str, Any]]:
    start = f"{year}-01-01"
    end = f"{year}-12-31"
    url = f"https://github.com/users/{username}/contributions?from={start}&to={end}"
    html = _request_text(url)
    parser = _ContributionParser()
    parser.feed(html)
    dedup = _merge_contributions(parser.date_by_id, parser.count_by_id)
    if not dedup or all(count == 0 for count in dedup.values()):
        fallback = _fallback_contributions(html)
        if fallback:
            dedup = fallback
    return [
        {"date": key, "count": dedup[key]}
        for key in sorted(dedup.keys())
    ]


def _merge_contributions(date_by_id: dict[str, str], count_by_id: dict[str, int]) -> dict[str, int]:
    merged: dict[str, int] = {}
    for id_value, date_value in date_by_id.items():
        count = count_by_id.get(id_value, 0)
        if date_value not in merged or count > merged[date_value]:
            merged[date_value] = count
    return merged


def _fallback_contributions(html: str) -> dict[str, int]:
    date_by_id: dict[str, str] = {}
    for match in re.finditer(r'id="([^"]+)"[^>]*data-date="(\d{4}-\d{2}-\d{2})"', html):
        date_by_id[match.group(1)] = match.group(2)
    for match in re.finditer(r'data-date="(\d{4}-\d{2}-\d{2})"[^>]*id="([^"]+)"', html):
        date_by_id[match.group(2)] = match.group(1)
    count_by_id: dict[str, int] = {}
    for match in re.finditer(
        r'<tool-tip[^>]*for="([^"]+)"[^>]*>(.*?)</tool-tip>',
        html,
        re.IGNORECASE | re.DOTALL,
    ):
        raw_text = re.sub(r"<[^>]+>", " ", match.group(2))
        count = _parse_contribution_count(raw_text)
        if count is None:
            continue
        count_by_id[match.group(1)] = count
    return _merge_contributions(date_by_id, count_by_id)


def sync(profile: str, year: int | None = None) -> dict[str, Any]:
    username = _parse_username(profile)
    if not username:
        return {"error": "GitHub username or URL is required."}
    target_year = year or datetime.now().year

    data_dir().mkdir(parents=True, exist_ok=True)

    try:
        profile_data = _fetch_profile(username)
        repos = _fetch_repos(username)
        contributions = _fetch_contributions(username, target_year)
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError):
        return {"error": "Failed to fetch GitHub data. Check username or network access."}

    avatar_url = profile_data.get("avatar_url")
    avatar_file = None
    if avatar_url:
        avatar_file = _download_binary(avatar_url, "github_avatar.png")

    path = data_dir() / "github_profile.json"
    existing = _read_json(path)
    contributions_by_year = existing.get("contributions_by_year") if isinstance(existing, dict) else None
    if not isinstance(contributions_by_year, dict):
        contributions_by_year = {}
    contributions_by_year[str(target_year)] = contributions

    payload = {
        "profile": {
            "name": profile_data.get("name"),
            "username": profile_data.get("username"),
            "bio": profile_data.get("bio"),
            "location": profile_data.get("location"),
            "followers": profile_data.get("followers"),
            "following": profile_data.get("following"),
            "avatar_file": avatar_file or "",
        },
        "repos": repos,
        "contributions": contributions,
        "contributions_by_year": contributions_by_year,
        "last_sync": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "last_sync_year": target_year,
    }

    try:
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    except OSError:
        return {"error": "Failed to save GitHub data."}

    return {
        "profile": payload["profile"],
        "repos": repos,
        "contributions": contributions,
        "last_sync": payload["last_sync"],
        "last_sync_year": target_year,
        "available_years": sorted(int(key) for key in contributions_by_year.keys() if str(key).isdigit()),
    }
