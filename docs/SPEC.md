# Dragon Dev Companion (DDC) - SPEC

## Overview
DDC is a local-first developer companion with a CLI and optional TUI. It focuses on
focus sessions, lightweight task tracking, and README generation, all stored in a
project-local SQLite database.

## Architecture
- apps/cli: Typer-based CLI entrypoint and commands.
- apps/tui: Optional Textual dashboard.
- modules/focus_den: Pomodoro timer + focus stats.
- modules/repo_forge: README/profile template rendering.
- modules/project_roost: Task system + standup view.
- packages/core: shared config, storage, git helpers, time utilities.

## Storage
Location: `.ddc_data/ddc.sqlite3` in the project root.

Tables:
- focus_sessions
  - id (integer, pk)
  - start_ts (text)
  - end_ts (text)
  - minutes (integer)
  - session_type (text: work|break)
- tasks
  - id (integer, pk)
  - title (text)
  - status (text: open|done)
  - created_ts (text)
  - due_date (text, YYYY-MM-DD, nullable)
  - done_ts (text, nullable)

## Safety and Scope
- All reads/writes are inside the project root.
- Git inspection is read-only and blocked outside the project directory.
- Outputs default to `out/`.
