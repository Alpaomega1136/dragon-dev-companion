$ErrorActionPreference = "Stop"

$scriptDir = $PSScriptRoot
$root = Split-Path -Parent $scriptDir
Set-Location $root

$backendPython = Join-Path $root "backend\.venv\Scripts\python.exe"
$nodeModules = Join-Path $root "frontend\node_modules"

if (-not (Test-Path $backendPython) -or -not (Test-Path $nodeModules)) {
  Write-Host "Setup belum lengkap, menjalankan setup..." -ForegroundColor Yellow
  & (Join-Path $scriptDir "setup.ps1")
}

& (Join-Path $scriptDir "dev.ps1")
