# Dragon Dev Companion (DDC)

Dragon Dev Companion is a local-first developer companion. The main experience is DDC Web
(React + FastAPI) with an optional VS Code activity extension and a legacy CLI.

## DDC Web (main app)
- Pomodoro focus/break timer with stats.
- Task manager (CRUD).
- README generator (profile + project).
- VS Code activity tracker + heatmap (requires extension).
- GitHub profile + contributions viewer (offline cache or sync).
- Git summary for local repos.
- Spotify lounge (OAuth PKCE, playlists, player bar).

Data lives in `ddc-desktop/data/` (SQLite + JSON). README output goes to `ddc-desktop/out/`.

## Quick start (Windows)
```powershell
cd ddc-desktop
.\scripts\run.ps1
```

Launcher with VS Code extension install:
```powershell
cd ddc-desktop
.\scripts\launch.cmd
```

Frontend: `http://127.0.0.1:5173`
Backend: `http://127.0.0.1:5123`

See `ddc-desktop/README.md` for full setup, extension steps, and Spotify OAuth notes.

## CLI (optional)
```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install -e .
ddc --help
```

CLI data is stored in `.ddc_data/` and output in `out/`.

## Notes
- Spotify and GitHub sync require internet access.
- Everything else is local-first and runs offline.
