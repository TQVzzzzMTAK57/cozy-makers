# ============================================
# start.ps1 - Khoi dong AI Drowning Detection
# ============================================

$rootDir = $PSScriptRoot

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   AI Drowning Detection - Khoi dong he thong  " -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# --- Tat cac process cu neu con chay ---
Write-Host "[1/3] Tat cac server cu (neu co)..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# --- Khoi dong Backend ---
Write-Host "[2/3] Dang khoi dong Backend (port 3001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "Set-Location '$rootDir\server'; `
    Write-Host '--- BACKEND (port 3001) ---' -ForegroundColor Cyan; `
    node server.js" `
    -WindowStyle Normal

Start-Sleep -Seconds 2

# --- Khoi dong Frontend ---
Write-Host "[3/3] Dang khoi dong Frontend (port 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "Set-Location '$rootDir'; `
    Write-Host '--- FRONTEND (port 5173) ---' -ForegroundColor Cyan; `
    npm run dev" `
    -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "   He thong da khoi dong thanh cong!           " -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "   Frontend  :  http://localhost:5173"          -ForegroundColor Cyan
Write-Host "   Backend   :  http://localhost:3001/api/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Tai khoan : admin / 123456 (admin)" -ForegroundColor White
Write-Host ""

# Mo trinh duyet
Start-Process "http://localhost:5173"
