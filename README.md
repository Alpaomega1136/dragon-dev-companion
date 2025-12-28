# Dragon Dev Companion (DDC)

Dragon Dev Companion is a local-first, dragon-themed developer companion. It ships
with a CLI and an optional TUI to help you stay focused, track tasks, and forge
READMEs without leaving your terminal.

## Features
- Focus Den: Pomodoro timer, session logging, and stats.
- Repo Forge: GitHub profile and project README generators.
- Project Roost: Task system and deadlines.
- DDC Web: Offline-first web app with Pomodoro, tasks, VS Code activity heatmap, GitHub viewer, and Git summary.

## Install (local)
```bash
python -m venv .venv
```

Windows:
```bash
.venv\\Scripts\\activate
```

macOS/Linux:
```bash
source .venv/bin/activate
pip install -e .
```

## Quick Setup (Windows PowerShell)
```powershell
.\scripts\setup.ps1
```
This script creates the venv, installs dependencies, and sets up the CLI.

## Smoke Test (Windows PowerShell)
```powershell
.\scripts\smoke.ps1
```
This script runs basic CLI commands and pytest.

Optional TUI:
```bash
pip install -e .[tui]
```

## CLI Usage
```bash
ddc --help
ddc init

ddc focus start --minutes 25 --break 5 --cycles 4
ddc focus stats

ddc readme profile --style cute --name "Raymond Jonathan"
ddc readme project --title "Dragon Tracker" --description "Track flight logs"

ddc tasks add "Refactor focus timer" --due 2025-12-30
ddc tasks list
ddc tasks done 1
```

## TUI
```bash
ddc tui
```

## DDC Web
The web app lives in `ddc-desktop/` (FastAPI backend + React frontend).
See `ddc-desktop/README.md` for setup and run instructions.

## Output Paths
Generated files default to `out/` and must remain inside the project root.

## Screenshots (Placeholder)
```
   / \  //\     Dragon Dev Companion
  ( o_o )        [Focus] [Tasks] [Forge]
   > ^ <         Stats, tasks, and forge views
```

## Roadmap
- [ ] Expand focus analytics (monthly views).
- [ ] Add task tags and filtering.
- [ ] Improve TUI interactivity.
- [ ] Add template customization flags.

## License
Add a license if you plan to distribute.
