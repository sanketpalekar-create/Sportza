# ─────────────────────────────────────────────────────────────────────────────
# Sportza One-Click Startup Script
# Run this from the Sportza folder each morning:
#   Right-click → "Run with PowerShell"  OR  powershell -File start-sportza.ps1
# ─────────────────────────────────────────────────────────────────────────────

$ROOT        = "C:\Users\user\Desktop\Sportza"
$CLOUDFLARED = "$ROOT\cloudflared.exe"
$LOG         = "$ROOT\startup.log"

function Log($msg) {
    $line = "[$(Get-Date -Format 'HH:mm:ss')] $msg"
    Write-Host $line
    Add-Content $LOG $line
}

Set-Location $ROOT
"" | Add-Content $LOG
Log "=== Sportza Startup ==="

# 1. Kill any leftover processes
Log "Stopping old processes..."
Get-Process node, cloudflared -EA SilentlyContinue | Stop-Process -Force -EA SilentlyContinue
Start-Sleep 2

# 2. Ensure Docker Desktop is running
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

# 3. Start MySQL + Redis
Log "Starting MySQL and Redis..."
docker compose up -d mysql redis 2>&1 | Select-String "Running|Started|Created" | ForEach-Object { Log $_ }

# 4. Regenerate Prisma client
Log "Regenerating Prisma client..."
Set-Location "$ROOT\apps\api"
npx prisma generate 2>&1 | Select-String "Generated" | ForEach-Object { Log $_ }
Set-Location $ROOT

# 5. Ensure CORS is set for sportza.in only
$envPath = "$ROOT\apps\api\.env"
(Get-Content $envPath) -replace "CLIENT_ORIGIN=.*",
    "CLIENT_ORIGIN=http://localhost:5173,http://localhost:5174,http://localhost:5175,https://sportza.in,https://www.sportza.in" |
    Set-Content $envPath

# 6. Start backend API
Log "Starting API..."
Start-Process powershell -ArgumentList "-NoExit -Command `"Set-Location '$ROOT'; pnpm --filter @sportza/api dev`"" -WindowStyle Normal

Start-Sleep 8

# 7. Start Vite frontend
Log "Starting Vite..."
Start-Process powershell -ArgumentList "-NoExit -Command `"Set-Location '$ROOT'; Remove-Item -Recurse -Force 'apps\web\node_modules\.vite' -EA SilentlyContinue; pnpm --filter @sportza/web exec vite --force`"" -WindowStyle Normal

Start-Sleep 5

# 8. Start named Cloudflare Tunnel for sportza.in
Log "Starting Cloudflare Tunnel for sportza.in..."
$tunnelLog = "$ROOT\tunnel.log"
"" | Set-Content $tunnelLog
Start-Process $CLOUDFLARED -ArgumentList "tunnel --config C:\Users\user\.cloudflared\config.yml run" -RedirectStandardError $tunnelLog -WindowStyle Hidden

# 9. Wait for tunnel to connect
Log "Waiting for tunnel connection..."
$connected = $false; $attempts = 0
while (-not $connected -and $attempts -lt 15) {
    Start-Sleep 3; $attempts++
    $connected = (Get-Content $tunnelLog -Raw -EA SilentlyContinue) -match "Registered tunnel connection"
}

if ($connected) {
    Log "Tunnel connected — sportza.in is live!"
} else {
    Log "WARNING: Tunnel may still be connecting, check tunnel.log"
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
