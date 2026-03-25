# ============================================
# stop.ps1 - Tat AI Drowning Detection
# ============================================

Write-Host ""
Write-Host "================================================" -ForegroundColor Red
Write-Host "   AI Drowning Detection - Dung he thong       " -ForegroundColor Red
Write-Host "================================================" -ForegroundColor Red
Write-Host ""

$stopped = $false

# --- Tat Backend: node.exe (port 3001) ---
Write-Host "[1/2] Dang tat Backend (node.js, port 3001)..." -ForegroundColor Yellow

$nodeProcs = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcs) {
    $nodeProcs | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "      OK - Da tat $($nodeProcs.Count) process node.js" -ForegroundColor Green
    $stopped = $true
} else {
    Write-Host "      (Khong co process node.js nao dang chay)" -ForegroundColor Gray
}

# --- Tat Frontend: Vite (port 5173) ---
Write-Host "[2/2] Dang tat Frontend (Vite, port 5173)..." -ForegroundColor Yellow

# Tim process dang chiem port 5173
$port5173 = netstat -ano | Select-String ":5173" | ForEach-Object {
    ($_ -split '\s+')[-1]
} | Sort-Object -Unique | Where-Object { $_ -match '^\d+$' }

if ($port5173) {
    foreach ($pid in $port5173) {
        try {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        } catch {}
    }
    Write-Host "      OK - Da tat Vite (PID: $($port5173 -join ', '))" -ForegroundColor Green
    $stopped = $true
} else {
    Write-Host "      (Khong co process nao tren port 5173)" -ForegroundColor Gray
}

# --- Tat cac cua so PowerShell con (neu co) ---
$childWindows = Get-Process -Name "powershell" -ErrorAction SilentlyContinue |
    Where-Object { $_.Id -ne $PID }

if ($childWindows) {
    Write-Host "" 
    Write-Host "Tim thay $($childWindows.Count) cua so PowerShell con." -ForegroundColor Yellow
    $confirm = Read-Host "   Ban co muon dong cac cua so do khong? (y/N)"
    if ($confirm -eq 'y' -or $confirm -eq 'Y') {
        $childWindows | Stop-Process -Force -ErrorAction SilentlyContinue
        Write-Host "   Da dong cac cua so PowerShell con." -ForegroundColor Green
    }
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
