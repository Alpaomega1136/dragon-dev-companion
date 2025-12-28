from __future__ import annotations

from app.services import vscode_service


def test_vscode_activity_summary(temp_db):
    vscode_service.record_event("active", "startup")
    vscode_service.record_event("typing", "file:test.py")
    vscode_service.record_event("inactive", None)

    summary = vscode_service.summary(1)
    assert summary["active_events"] >= 1
    assert summary["typing_events"] >= 1
    assert summary["inactive_events"] >= 1

    heatmap = vscode_service.heatmap(7)
    assert heatmap["days"] == 7
    assert len(heatmap["items"]) == 7

    timeline = vscode_service.timeline(heatmap["items"][-1]["date"], 10)
    assert timeline["bucket_minutes"] == 10
    assert len(timeline["items"]) == int(24 * 60 / 10)
