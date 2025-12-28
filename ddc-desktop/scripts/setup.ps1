$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "== DDC Web Setup ==" -ForegroundColor Cyan

if (-not (Test-Path ".\\backend\\.venv\\Scripts\\python.exe")) {
  python -m venv .\backend\.venv
}

& ".\\backend\\.venv\\Scripts\\python.exe" -m pip install -U pip setuptools wheel
Set-Location ".\\backend"
& ".\\.venv\\Scripts\\python.exe" -m pip install -e ".[dev]"
Set-Location $root

Set-Location ".\\frontend"
& npm install
& npm run build
Set-Location $root

New-Item -ItemType Directory -Force -Path ".\\data", ".\\out" | Out-Null

Write-Host "Setup selesai." -ForegroundColor Green
Write-Host "Langkah berikutnya:"
Write-Host "  scripts\\dev.ps1"
