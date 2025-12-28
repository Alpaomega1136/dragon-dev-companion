$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Menjalankan backend dan frontend..." -ForegroundColor Cyan

$backendCmd = ".\\.venv\\Scripts\\python.exe -m app.main"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\\backend'; $backendCmd"

Start-Sleep -Seconds 1

Set-Location ".\\frontend"
npm run dev
