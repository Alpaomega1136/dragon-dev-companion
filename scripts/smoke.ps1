$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$python = ".\\.venv\\Scripts\\python.exe"
$ddc = ".\\.venv\\Scripts\\ddc.exe"

if (-not (Test-Path $python)) {
  Write-Host "Python venv belum ada. Jalankan scripts/setup.ps1 dulu." -ForegroundColor Yellow
  exit 1
}

if (-not (Test-Path $ddc)) {
  Write-Host "DDC belum terpasang. Jalankan scripts/setup.ps1 dulu." -ForegroundColor Yellow
  exit 1
}

& $ddc --help
& $ddc init
& $ddc focus stats
& $python -m pytest -q

Write-Host "Smoke test selesai." -ForegroundColor Green
