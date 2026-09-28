# ============================================
# start.ps1 - Khoi dong AI Drowning Detection
# ============================================

$rootDir = $PSScriptRoot
$pidFile = Join-Path $rootDir ".run.pids"

# Chi tat process dang chiem dung cong cua du an (khong dung toi cac app node khac)
function Stop-PortOwner([int]$port) {
    $owners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique |
        Where-Object { $_ -gt 0 }
    foreach ($procId in $owners) {
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
    return @($owners).Count
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   AI Drowning Detection - Khoi dong he thong  " -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path (Join-Path $rootDir "server\.env"))) {
    Write-Host "Chua co server\.env - hay copy server\.env.example thanh server\.env va dien JWT_SECRET, PG_PASSWORD." -ForegroundColor Red
    exit 1
}

# --- Tat server cu cua du an neu con chay ---
Write-Host "[1/3] Tat cac server cu (cong 3001, 5173) neu co..." -ForegroundColor Yellow
$null = Stop-PortOwner 3001
$null = Stop-PortOwner 5173
Start-Sleep -Seconds 1

# --- Khoi dong Backend ---
Write-Host "[2/3] Dang khoi dong Backend (port 3001)..." -ForegroundColor Yellow
$backend = Start-Process powershell -PassThru -ArgumentList "-NoExit", "-Command", `
    "Set-Location '$rootDir\server'; `
    Write-Host '--- BACKEND (port 3001) ---' -ForegroundColor Cyan; `
    node server.js" `
    -WindowStyle Normal

Start-Sleep -Seconds 2

# --- Khoi dong Frontend ---
Write-Host "[3/3] Dang khoi dong Frontend (port 5173)..." -ForegroundColor Yellow
$frontend = Start-Process powershell -PassThru -ArgumentList "-NoExit", "-Command", `
    "Set-Location '$rootDir'; `
    Write-Host '--- FRONTEND (port 5173) ---' -ForegroundColor Cyan; `
    npm run dev" `
    -WindowStyle Normal

# Luu PID cac cua so da mo de stop.ps1 chi dong dung cac cua so nay
@($backend.Id, $frontend.Id) | Set-Content -Path $pidFile

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "   He thong da khoi dong thanh cong!           " -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "   Frontend  :  http://localhost:5173"          -ForegroundColor Cyan
Write-Host "   Backend   :  http://localhost:3001/api/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Tai khoan admin: mat khau la ADMIN_PASSWORD trong server\.env," -ForegroundColor White
Write-Host "   hoac mat khau ngau nhien in ra o cua so Backend lan chay dau tien." -ForegroundColor White
Write-Host "   Quen mat khau: cd server; npm run set-password -- admin" -ForegroundColor White
Write-Host ""

# Mo trinh duyet
Start-Process "http://localhost:5173"
