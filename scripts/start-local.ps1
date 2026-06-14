# TrustAI local dev — starts backend + frontend
# Usage: npm run dev

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if (-not (Test-Path ".env")) {
    Copy-Item ".env.vps.example" ".env"
    Write-Host "Created .env" -ForegroundColor Yellow
}

Get-Content ".env" | ForEach-Object {
    if ($_ -match "^\s*([^#][^=]+)=(.*)$") {
        [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
    }
}

$backendPort = if ($env:TRUSTAI_BACKEND_PORT) { $env:TRUSTAI_BACKEND_PORT } else { "8000" }
$apiUrl = if ($env:NEXT_PUBLIC_API_URL) { $env:NEXT_PUBLIC_API_URL } else { "http://localhost:$backendPort/api/v1" }

function Test-TrustAIHealth([string]$Port) {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/v1/health" -UseBasicParsing -TimeoutSec 2
        return ($r.StatusCode -eq 200 -and $r.Content -match '"auth_enabled"\s*:\s*true')
    } catch { return $false }
}

function Get-ListeningPid([string]$Port) {
    $lines = netstat -ano | Select-String ":$Port\s" | Select-String "LISTENING"
    foreach ($line in $lines) {
        if ($line -match "\s(\d+)\s*$") { return [int]$matches[1] }
    }
    return $null
}

# Port conflict check — restart stale backend missing auth routes
$existingPid = Get-ListeningPid $backendPort
if ($existingPid -and -not (Test-TrustAIHealth $backendPort)) {
    Write-Host "Stopping stale backend on port $backendPort (PID $existingPid)..." -ForegroundColor Yellow
    taskkill /PID $existingPid /F 2>$null | Out-Null
    Start-Sleep -Seconds 1
}

Set-Content "frontend\.env.local" "NEXT_PUBLIC_API_URL=$apiUrl"

# Ensure core backend deps
python -c "import httpx, fastapi" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
    pip install fastapi uvicorn pydantic pydantic-settings sqlalchemy aiosqlite cryptography python-multipart httpx PyJWT bcrypt email-validator -q
}

# Ensure llama-cpp only when using direct GGUF inference
if ($env:TRUSTAI_INFERENCE_BACKEND -eq "gguf") {
    python -c "from llama_cpp import Llama" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Installing llama-cpp-python..." -ForegroundColor Yellow
        & "$Root\scripts\install-backend.ps1"
    }
}

if (-not (Test-Path "secrets\signing_key.pem")) {
    New-Item -ItemType Directory -Force -Path "secrets" | Out-Null
    python scripts/generate_signing_key.py --output secrets/signing_key.pem
}

New-Item -ItemType Directory -Force -Path "data" | Out-Null

Write-Host ""
Write-Host "TrustAI (local)" -ForegroundColor Cyan
Write-Host "  Frontend:  http://localhost:3000"
Write-Host "  API:       $apiUrl"
Write-Host "  Health:    http://localhost:$backendPort/api/v1/health"
Write-Host ""
Write-Host "Place model at: models\Qwen2.5-Coder-0.5B-Instruct-Q8_0.gguf"
Write-Host "Press Ctrl+C to stop frontend (backend runs in background)." -ForegroundColor DarkGray
Write-Host ""

$backendProc = $null
if (-not (Test-TrustAIHealth $backendPort)) {
    $env:PYTHONPATH = "$Root\backend"
    $backendProc = Start-Process -FilePath "python" `
        -ArgumentList "-m","uvicorn","app.main:app","--host","127.0.0.1","--port",$backendPort,"--reload" `
        -WorkingDirectory "$Root\backend" `
        -PassThru -WindowStyle Hidden

    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        if (Test-TrustAIHealth $backendPort) {
            $ready = $true
            Write-Host "Backend ready on port $backendPort" -ForegroundColor Green
            break
        }
        if ($backendProc.HasExited) { break }
    }

    if (-not $ready) {
        Write-Host "ERROR: Backend failed to start on port $backendPort" -ForegroundColor Red
        if ($backendProc -and -not $backendProc.HasExited) { Stop-Process -Id $backendProc.Id -Force }
        exit 1
    }
} else {
    Write-Host "Backend already running on port $backendPort" -ForegroundColor Green
}

Set-Location "$Root\frontend"
if (-not (Test-Path "node_modules")) { npm install }

try {
    npm run dev
} finally {
    if ($backendProc -and -not $backendProc.HasExited) {
        Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
    }
}
