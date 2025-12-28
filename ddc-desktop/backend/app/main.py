"""FastAPI app for Dragon Dev Companion Desktop."""

from __future__ import annotations

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.db import init_db
from app.models import (
    GitSummaryRequest,
    PomodoroStart,
    ReadmeProfileRequest,
    ReadmeProjectRequest,
    TaskCreate,
    TaskUpdate,
    VscodeEventRequest,
)
from app.services import (
    git_service,
    pomodoro_service,
    readme_service,
    task_service,
    vscode_service,
)

app = FastAPI(title="DDC Desktop Backend", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict:
    return {"ok": True, "message": "DDC backend is running."}


@app.post("/pomodoro/start")
def pomodoro_start(payload: PomodoroStart) -> dict:
    result = pomodoro_service.start_session(payload.mode, payload.duration_minutes)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return {"ok": True, "data": result}


@app.post("/pomodoro/pause")
def pomodoro_pause() -> dict:
    result = pomodoro_service.pause_session()
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return {"ok": True, "data": result}


@app.post("/pomodoro/resume")
def pomodoro_resume() -> dict:
    result = pomodoro_service.resume_session()
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return {"ok": True, "data": result}


@app.post("/pomodoro/stop")
def pomodoro_stop() -> dict:
    result = pomodoro_service.stop_session()
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return {"ok": True, "data": result}


@app.get("/pomodoro/status")
def pomodoro_status() -> dict:
    return {"ok": True, "data": pomodoro_service.status()}


@app.get("/pomodoro/stats")
def pomodoro_stats(range: str = Query("today", pattern="^(today|week|all)$")) -> dict:
    return {"ok": True, "data": pomodoro_service.stats(range)}


@app.get("/tasks")
def tasks_list(status: str = Query("all", pattern="^(todo|doing|done|all)$")) -> dict:
    return {"ok": True, "data": task_service.list_tasks(status)}


@app.post("/tasks")
def tasks_add(payload: TaskCreate) -> dict:
    return {"ok": True, "data": task_service.add_task(payload.model_dump())}


@app.put("/tasks/{task_id}")
def tasks_update(task_id: int, payload: TaskUpdate) -> dict:
    result = task_service.update_task(task_id, payload.model_dump())
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return {"ok": True, "data": result}


@app.post("/tasks/{task_id}/toggle_done")
def tasks_toggle(task_id: int) -> dict:
    result = task_service.toggle_done(task_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return {"ok": True, "data": result}


@app.delete("/tasks/{task_id}")
def tasks_delete(task_id: int) -> dict:
    result = task_service.delete_task(task_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return {"ok": True, "data": result}


@app.get("/standup/today")
def standup_today() -> dict:
    return {"ok": True, "data": task_service.standup_today()}


@app.post("/readme/profile")
def readme_profile(payload: ReadmeProfileRequest) -> dict:
    return {"ok": True, "data": readme_service.generate_profile(payload.model_dump())}


@app.post("/readme/project")
def readme_project(payload: ReadmeProjectRequest) -> dict:
    return {"ok": True, "data": readme_service.generate_project(payload.model_dump())}


@app.get("/readme/history")
def readme_history() -> dict:
    return {"ok": True, "data": readme_service.history()}


@app.post("/git/summary")
def git_summary(payload: GitSummaryRequest) -> dict:
    return {"ok": True, "data": git_service.summary(payload.repo_path)}


@app.post("/vscode/event")
def vscode_event(payload: VscodeEventRequest) -> dict:
    result = vscode_service.record_event(payload.event_type, payload.details)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return {"ok": True, "data": result}


@app.get("/vscode/status")
def vscode_status(window_hours: int = Query(1, ge=1, le=24)) -> dict:
    return {"ok": True, "data": vscode_service.summary(window_hours)}


@app.get("/vscode/history")
def vscode_history(window_hours: int = Query(24, ge=1, le=24), limit: int = Query(50, ge=1, le=200)) -> dict:
    return {"ok": True, "data": vscode_service.history(window_hours, limit)}


@app.get("/vscode/heatmap")
def vscode_heatmap(days: int = Query(90, ge=7, le=365)) -> dict:
    return {"ok": True, "data": vscode_service.heatmap(days)}


@app.get("/vscode/timeline")
def vscode_timeline(
    date: str = Query(...),
    bucket_minutes: int = Query(10, ge=5, le=60),
) -> dict:
    try:
        data = vscode_service.timeline(date, bucket_minutes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "data": data}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=5123, reload=False)
