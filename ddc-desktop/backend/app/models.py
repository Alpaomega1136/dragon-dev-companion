"""Pydantic models for API payloads."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


PomodoroMode = Literal["focus", "break"]
PomodoroStatus = Literal["running", "paused", "stopped"]


class PomodoroStart(BaseModel):
    mode: PomodoroMode = "focus"
    duration_minutes: int = Field(ge=1, default=25)


class PomodoroState(BaseModel):
    id: int | None
    mode: PomodoroMode | None
    status: PomodoroStatus | None
    start_time: str | None
    end_time: str | None
    duration_minutes: int | None
    elapsed_minutes: float | None


class PomodoroStats(BaseModel):
    range: Literal["today", "week", "all"]
    total_focus_minutes: float
    total_sessions: int


class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    priority: Literal["low", "med", "high"] = "med"
    due_date: str | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    priority: Literal["low", "med", "high"] | None = None
    due_date: str | None = None
    status: Literal["todo", "doing", "done"] | None = None


class TaskOut(BaseModel):
    id: int
    title: str
    description: str | None
    priority: str
    due_date: str | None
    status: str
    created_at: str
    updated_at: str


class ReadmeProfileRequest(BaseModel):
    name: str
    bio: str
    tech: str | None = None
    links: str | None = None


class ReadmeProjectRequest(BaseModel):
    title: str
    description: str
    features: str | None = None
    usage: str | None = None
    stack: str | None = None
    links: str | None = None


class ReadmeHistoryItem(BaseModel):
    id: int
    type: str
    created_at: str
    output_path: str


class GitSummaryRequest(BaseModel):
    repo_path: str


class GitSummaryResponse(BaseModel):
    ok: bool
    message: str
    branch: str | None = None
    last_commit: str | None = None
    staged: int | None = None
    unstaged: int | None = None


class VscodeEventRequest(BaseModel):
    event_type: Literal["active", "inactive", "typing"]
    details: str | None = None


class GitHubSyncRequest(BaseModel):
    profile: str
    year: int | None = None


class SpotifyTokenRequest(BaseModel):
    client_id: str
    code: str
    code_verifier: str
    redirect_uri: str


class SpotifyRefreshRequest(BaseModel):
    client_id: str
    refresh_token: str
