$ErrorActionPreference = "Stop"

$scriptDir = $PSScriptRoot
$root = Split-Path -Parent $scriptDir
Set-Location $root

function Ensure-Setup {
  $backendPython = Join-Path $root "backend\.venv\Scripts\python.exe"
  $nodeModules = Join-Path $root "frontend\node_modules"
  if (-not (Test-Path $backendPython) -or -not (Test-Path $nodeModules)) {
    Write-Host "Setup belum lengkap, menjalankan setup..." -ForegroundColor Yellow
    & (Join-Path $scriptDir "setup.ps1")
  }
}

function Install-VscodeExtension {
  $source = Join-Path $root "vscode-extension"
  if (-not (Test-Path $source)) {
    Write-Host "Folder extension tidak ditemukan." -ForegroundColor Yellow
    return
  }

  $distPath = Join-Path $source "dist\extension.js"
  if (-not (Test-Path $distPath)) {
    Write-Host "Build extension..." -ForegroundColor Cyan
    Push-Location $source
    if (-not (Test-Path "node_modules")) {
      npm install
    }
    npm run build
    Pop-Location
  }

  if (-not $env:USERPROFILE) {
    Write-Host "USERPROFILE tidak ditemukan. Install extension dibatalkan." -ForegroundColor Yellow
    return
  }

  $target = Join-Path $env:USERPROFILE ".vscode\extensions\ddc-local.ddc-vscode-activity-0.1.0"
  New-Item -ItemType Directory -Force -Path $target | Out-Null

  Copy-Item -Force (Join-Path $source "package.json") $target
  if (Test-Path (Join-Path $source "README.md")) {
    Copy-Item -Force (Join-Path $source "README.md") $target
  }
  if (Test-Path (Join-Path $source "dist")) {
    Copy-Item -Recurse -Force (Join-Path $source "dist") $target
  }

  Write-Host "Extension terpasang di: $target" -ForegroundColor Green
  Write-Host "Restart VS Code untuk mengaktifkan extension." -ForegroundColor Green
}

Ensure-Setup
Install-VscodeExtension

& (Join-Path $scriptDir "dev.ps1")

Start-Sleep -Seconds 2
Start-Process "http://127.0.0.1:5173"
