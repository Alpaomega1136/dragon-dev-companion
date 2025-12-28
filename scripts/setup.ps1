$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if (-not (Test-Path ".\\.venv\\Scripts\\python.exe")) {
  python -m venv .venv
}

New-Item -ItemType Directory -Force -Path ".\\.pip-cache", ".\\.tmp" | Out-Null
$env:PIP_CACHE_DIR = "$PWD\\.pip-cache"
$env:TEMP = "$PWD\\.tmp"
$env:TMP = "$PWD\\.tmp"

& ".\\.venv\\Scripts\\python.exe" -m ensurepip --upgrade --default-pip
& ".\\.venv\\Scripts\\python.exe" -m pip install -U pip setuptools wheel
& ".\\.venv\\Scripts\\python.exe" -m pip install -e ".[tui,dev]"

Write-Host "Setup selesai. Coba:" -ForegroundColor Green
Write-Host "  .\\.venv\\Scripts\\ddc.exe --help"
Write-Host "  .\\.venv\\Scripts\\python.exe -m pytest -q"
