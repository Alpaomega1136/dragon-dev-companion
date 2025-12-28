@echo off
setlocal

set ROOT=%~dp0..
cd /d "%ROOT%"

echo Launching DDC Web...

if not exist "backend\.venv\Scripts\python.exe" goto setup
if not exist "frontend\node_modules" goto setup
goto run

:setup
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\setup.ps1"

:run
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\launch.ps1"

endlocal
