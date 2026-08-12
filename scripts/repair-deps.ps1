# Repair broken pnpm / Vite installs (fixes "Cannot find module" on sportza.in)
param(
    [switch]$SkipStorePrune
)

$ErrorActionPreference = "Stop"
$ROOT = if ($PSScriptRoot) { Resolve-Path (Join-Path $PSScriptRoot "..") } else { Get-Location }

Set-Location $ROOT
Write-Host "Stopping node / cloudflared..." -ForegroundColor Yellow
Get-Process node, cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 2

Write-Host "Removing node_modules and Vite cache..." -ForegroundColor Yellow
Remove-Item -Recurse -Force "$ROOT\node_modules" -ErrorAction SilentlyContinue
Get-ChildItem -Path $ROOT -Recurse -Directory -Filter node_modules -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\node_modules\\' } |
    ForEach-Object { Remove-Item -Recurse -Force $_.FullName -ErrorAction SilentlyContinue }
Remove-Item -Recurse -Force "$ROOT\apps\web\node_modules\.vite" -ErrorAction SilentlyContinue

if (-not $SkipStorePrune) {
    Write-Host "Pruning pnpm store..." -ForegroundColor Yellow
    pnpm store prune | Out-Null
}

Write-Host "Installing dependencies..." -ForegroundColor Yellow
pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) {
    pnpm install
}

Write-Host "Verifying Vite..." -ForegroundColor Yellow
pnpm --filter @sportza/web exec vite --version
if ($LASTEXITCODE -ne 0) { throw "Vite verification failed" }

Write-Host "Done. Run start-sportza.ps1 to bring the stack back up." -ForegroundColor Green
