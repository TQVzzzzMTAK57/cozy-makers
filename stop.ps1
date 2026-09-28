# ============================================
# stop.ps1 - Tat AI Drowning Detection
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
    return @($owners)
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Red
Write-Host "   AI Drowning Detection - Dung he thong       " -ForegroundColor Red
Write-Host "================================================" -ForegroundColor Red
Write-Host ""

$stopped = $false

# --- Tat Backend (port 3001) ---
Write-Host "[1/3] Dang tat Backend (port 3001)..." -ForegroundColor Yellow
$backendPids = Stop-PortOwner 3001
if ($backendPids.Count -gt 0) {
    Write-Host "      OK - Da tat Backend (PID: $($backendPids -join ', '))" -ForegroundColor Green
    $stopped = $true
} else {
    Write-Host "      (Khong co process nao tren port 3001)" -ForegroundColor Gray
}

# --- Tat Frontend (port 5173) ---
Write-Host "[2/3] Dang tat Frontend (Vite, port 5173)..." -ForegroundColor Yellow
$frontendPids = Stop-PortOwner 5173
if ($frontendPids.Count -gt 0) {
    Write-Host "      OK - Da tat Vite (PID: $($frontendPids -join ', '))" -ForegroundColor Green
    $stopped = $true
} else {
    Write-Host "      (Khong co process nao tren port 5173)" -ForegroundColor Gray
}

# --- Dong cac cua so PowerShell do start.ps1 mo ---
Write-Host "[3/3] Dong cac cua so do start.ps1 mo..." -ForegroundColor Yellow
if (Test-Path $pidFile) {
    foreach ($line in Get-Content $pidFile) {
        $windowId = 0
        if (-not [int]::TryParse($line, [ref]$windowId)) { continue }
        $proc = Get-Process -Id $windowId -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName -eq "powershell") {
            Stop-Process -Id $windowId -Force -ErrorAction SilentlyContinue
            $stopped = $true
        }
    }
    Remove-Item $pidFile -ErrorAction SilentlyContinue
    Write-Host "      OK" -ForegroundColor Green
} else {
    Write-Host "      (Khong tim thay .run.pids)" -ForegroundColor Gray
}

Write-Host ""
if ($stopped) {
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "   He thong da dung thanh cong!                " -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
} else {
    Write-Host "================================================" -ForegroundColor Gray
    Write-Host "   Khong co server nao dang chay.              " -ForegroundColor Gray
    Write-Host "================================================" -ForegroundColor Gray
}
Write-Host ""
