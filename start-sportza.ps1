# ─────────────────────────────────────────────────────────────────────────────
# Sportza One-Click Startup Script
# Run this from the Sportza folder each morning:
#   Right-click → "Run with PowerShell"  OR  powershell -File start-sportza.ps1
# ─────────────────────────────────────────────────────────────────────────────

$ROOT        = if ($PSScriptRoot) { $PSScriptRoot } else { "C:\Users\user\Desktop\Sportza" }
$CLOUDFLARED = "$ROOT\cloudflared.exe"
$LOG         = "$ROOT\startup.log"

function Log($msg) {
    $line = "[$(Get-Date -Format 'HH:mm:ss')] $msg"
    Write-Host $line
    Add-Content $LOG $line
}

function Stop-PortListener([int]$Port) {
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique |
        ForEach-Object {
            $p = Get-Process -Id $_ -ErrorAction SilentlyContinue
            if ($p -and ($p.Name -eq "node" -or $p.Path -like "*Sportza*")) {
                Log "Stopping process $($p.Id) on port $Port"
                Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
            }
        }
}

function Test-ViteInstall {
    $vitePkg = Get-ChildItem "$ROOT\node_modules\.pnpm" -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like "vite@6*" } |
        Select-Object -First 1
    if (-not $vitePkg) { return $false }
    $entry = Join-Path $vitePkg.FullName "node_modules\vite\package.json"
    return (Test-Path $entry)
}

Set-Location $ROOT
"" | Add-Content $LOG
Log "=== Sportza Startup ==="

# 1. Kill any leftover processes and free dev ports
Log "Stopping old processes..."
Get-Process node, cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 2
Stop-PortListener 5173
Stop-PortListener 5000

# 2. Ensure dependencies (fixes stale pnpm / Vite chunk errors)
if (-not (Test-ViteInstall)) {
    Log "Vite install missing or corrupt — running repair-deps..."
    & "$ROOT\scripts\repair-deps.ps1" -SkipStorePrune
}

# 3. Ensure Docker Desktop is running
Log "Checking Docker..."
$dockerOk = docker info 2>&1 | Select-String "Server Version"
if (-not $dockerOk) {
    Log "Starting Docker Desktop..."
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    $i = 0
    do {
        Start-Sleep 8; $i++
        $dockerOk = docker info 2>&1 | Select-String "Server Version"
        Log "Waiting for Docker ($i)..."
    } until ($dockerOk -or $i -ge 15)
}

# 4. Start MySQL + Redis
Log "Starting MySQL and Redis..."
docker compose up -d mysql redis 2>&1 | Select-String "Running|Started|Created" | ForEach-Object { Log $_ }

# 5. Regenerate Prisma client
Log "Regenerating Prisma client..."
Set-Location "$ROOT\apps\api"
npx prisma generate 2>&1 | Select-String "Generated" | ForEach-Object { Log $_ }
Set-Location $ROOT

# 6. Ensure CORS is set for sportza.in only
$envPath = "$ROOT\apps\api\.env"
if (Test-Path $envPath) {
    (Get-Content $envPath) -replace "CLIENT_ORIGIN=.*",
        "CLIENT_ORIGIN=http://localhost:5173,http://localhost:5174,http://localhost:5175,https://sportza.in,https://www.sportza.in" |
        Set-Content $envPath
}

# 7. Start backend API
Log "Starting API..."
Start-Process powershell -ArgumentList "-NoExit -Command `"Set-Location '$ROOT'; pnpm --filter @sportza/api dev`"" -WindowStyle Normal

Start-Sleep 8

# 8. Start Vite frontend (always on 5173 for Cloudflare tunnel)
Log "Starting Vite..."
Remove-Item -Recurse -Force "$ROOT\apps\web\node_modules\.vite" -ErrorAction SilentlyContinue
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$ROOT'; pnpm --filter @sportza/web exec vite --host 0.0.0.0 --port 5173 --strictPort --force"
) -WindowStyle Normal

Start-Sleep 45

# 9. Smoke-test Vite before exposing via tunnel (retry — first compile can be slow)
$viteOk = $false
for ($attempt = 1; $attempt -le 3; $attempt++) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:5173/login" -UseBasicParsing -TimeoutSec 30
        if (($resp.StatusCode -eq 200) -and ($resp.Content -notmatch "Cannot find module")) {
            $viteOk = $true
            break
        }
    } catch {
        Log "Vite health check attempt $attempt failed: $($_.Exception.Message)"
    }
    if (-not $viteOk -and $attempt -lt 3) { Start-Sleep 15 }
}

if (-not $viteOk) {
    Log "Vite still broken — running full dependency repair..."
    & "$ROOT\scripts\repair-deps.ps1"
    Log "Please re-run start-sportza.ps1 after repair completes."
    exit 1
}

Log "Vite OK on http://localhost:5173/login"

# 10. Start named Cloudflare Tunnel for sportza.in
if (Test-Path $CLOUDFLARED) {
    Log "Starting Cloudflare Tunnel for sportza.in..."
    $tunnelLog = "$ROOT\tunnel.log"
    "" | Set-Content $tunnelLog
    Start-Process $CLOUDFLARED -ArgumentList "tunnel --config C:\Users\user\.cloudflared\config.yml run" -RedirectStandardError $tunnelLog -WindowStyle Hidden

    Log "Waiting for tunnel connection..."
    $connected = $false; $attempts = 0
    while (-not $connected -and $attempts -lt 15) {
        Start-Sleep 3; $attempts++
        $connected = (Get-Content $tunnelLog -Raw -ErrorAction SilentlyContinue) -match "Registered tunnel connection"
    }

    if ($connected) {
        Log "Tunnel connected — sportza.in is live!"
    } else {
        Log "WARNING: Tunnel may still be connecting, check tunnel.log"
    }
} else {
    Log "WARNING: cloudflared.exe not found — public URL will not work"
}

Log "=== All services started ==="
Log ""
Log "  Local:    http://localhost:5173"
Log "  Public:   https://sportza.in"
Log "  Login:    arjun@sportza.dev / Sportza@123"
Log ""

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Sportza is running!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Local:    http://localhost:5173" -ForegroundColor Cyan
Write-Host "  Public:   https://sportza.in" -ForegroundColor Cyan
Write-Host "  Login:    arjun@sportza.dev / Sportza@123" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to exit this window..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
