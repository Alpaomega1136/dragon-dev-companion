# Dragon Dev Companion Web (DDC Web)

Aplikasi web lokal bertema naga dengan backend FastAPI + SQLite dan frontend React (Vite).
Semua data disimpan lokal di `./data` dan output README ada di `./out`.

## Prasyarat
- Node.js 18+
- npm
- Python 3.11+ (disarankan 3.11/3.12)

## Struktur
```
ddc-desktop/
  frontend/  (React + Vite)
  backend/   (FastAPI)
  data/      (SQLite)
  out/       (README output)
  scripts/
```

## Setup (Windows PowerShell)
```powershell
cd ddc-desktop
.\scripts\setup.ps1
```

## Menjalankan (dev)
```powershell
cd ddc-desktop
.\scripts\dev.ps1
```
Frontend akan berjalan di `http://127.0.0.1:5173`.

## Jalankan Semua dengan Satu Perintah
```powershell
cd ddc-desktop
.\scripts\run.ps1
```
Script ini akan menjalankan setup jika belum lengkap, lalu menyalakan backend + frontend.

## Launcher (Setup + Extension + Run)
```powershell
cd ddc-desktop
.\scripts\launch.ps1
```
Launcher ini akan:
1) Setup backend/frontend jika belum lengkap
2) Build dan install VS Code extension ke `%USERPROFILE%\.vscode\extensions\`
3) Menjalankan backend + frontend, lalu membuka browser

Catatan: instalasi extension menyalin file ke folder VS Code (di luar repo).

## Launcher (CMD)
```cmd
cd ddc-desktop
scripts\launch.cmd
```

## Jalankan Backend Saja
```powershell
cd ddc-desktop\backend
.\.venv\Scripts\python.exe -m app.main
```
Backend akan berjalan di `http://127.0.0.1:5123`.

## Jalankan Frontend Saja
```powershell
cd ddc-desktop\frontend
npm run dev
```

## Endpoint Backend
- `GET /health`
- `POST /pomodoro/start`
- `POST /pomodoro/pause`
- `POST /pomodoro/resume`
- `POST /pomodoro/stop`
- `GET /pomodoro/status`
- `GET /pomodoro/stats?range=today|week|all`
- `GET /tasks?status=todo|doing|done|all`
- `POST /tasks`
- `PUT /tasks/{id}`
- `POST /tasks/{id}/toggle_done`
- `DELETE /tasks/{id}`
- `GET /standup/today`
- `POST /readme/profile`
- `POST /readme/project`
- `GET /readme/history`
- `POST /git/summary`
- `POST /vscode/event`
- `GET /vscode/status?window_hours=1-24`
- `GET /vscode/history?window_hours=1-24&limit=1-200`
- `GET /vscode/heatmap?days=7-365`

## VS Code Activity (Extension)
Extension ini mengirim status **aktif** / **mengetik** dari VS Code ke backend.

Setup:
```powershell
cd ddc-desktop\vscode-extension
npm install
npm run build
```

Jalankan mode dev:
1. Buka folder `ddc-desktop/vscode-extension` di VS Code.
2. Tekan `F5` untuk menjalankan Extension Development Host.
3. Pastikan backend sudah berjalan.

## Troubleshooting
- Jika frontend tidak bisa connect, pastikan backend berjalan di `http://127.0.0.1:5123`.
- Jika `python` tidak terdeteksi, gunakan path Python/venv secara eksplisit.
