from __future__ import annotations

from app.services import pomodoro_service


def test_pomodoro_flow(temp_db):
    started = pomodoro_service.start_session("focus", 25)
    assert started["status"] == "running"

    paused = pomodoro_service.pause_session()
    assert paused["status"] == "paused"

    resumed = pomodoro_service.resume_session()
    assert resumed["status"] == "running"

    stopped = pomodoro_service.stop_session()
    assert stopped["status"] == "stopped"

    stats = pomodoro_service.stats("all")
    assert stats["total_sessions"] >= 1
