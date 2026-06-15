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
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
    }
}

if ($env:TRUSTAI_PUBLIC_HOST -and $env:TRUSTAI_PUBLIC_HOST -ne "http://localhost:3000") {
    $origin = $env:TRUSTAI_PUBLIC_HOST.Trim().TrimEnd("/")
    if ($env:TRUSTAI_CORS_ORIGINS -notlike "*$origin*") {
        $env:TRUSTAI_CORS_ORIGINS = "$($env:TRUSTAI_CORS_ORIGINS),$origin"
    }
}

$backendPort = if ($env:TRUSTAI_BACKEND_PORT) { $env:TRUSTAI_BACKEND_PORT } else { "8000" }
# Same-origin proxy via Next.js — works for localhost and public IP access
$apiUrl = "/api/v1"

function Test-TrustAIHealth([string]$Port) {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/v1/health" -UseBasicParsing -TimeoutSec 2
        return ($r.StatusCode -eq 200 -and $r.Content -match '"auth_enabled"\s*:\s*true' -and $r.Content -match '"batches_list"\s*:\s*true')
    } catch { return $false }
}

function Get-ListeningPids([string]$Port) {
    $pids = @()
    try {
        $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        foreach ($c in $conns) {
            if ($c.OwningProcess -gt 0) { $pids += $c.OwningProcess }
        }
    } catch { }
    if ($pids.Count -eq 0) {
        $lines = netstat -ano | Select-String ":$Port\s" | Select-String "LISTENING"
        foreach ($line in $lines) {
            if ($line -match "\s(\d+)\s*$") { $pids += [int]$matches[1] }
        }
    }
    return $pids | Select-Object -Unique
}

function Stop-TrustAIBackends() {
    Get-CimInstance Win32_Process -Filter "Name='python.exe'" -ErrorAction SilentlyContinue |
        Where-Object {
            $_.CommandLine -like "*uvicorn*app.main*" -or
            $_.CommandLine -like "*multiprocessing.spawn*spawn_main*"
        } |
        ForEach-Object {
            Write-Host "Stopping TrustAI backend (PID $($_.ProcessId))..." -ForegroundColor Yellow
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
}

function Stop-PortListeners([string]$Port) {
    Stop-TrustAIBackends
    foreach ($procId in (Get-ListeningPids $Port)) {
        if (Get-Process -Id $procId -ErrorAction SilentlyContinue) {
            Write-Host "Stopping process on port $Port (PID $procId)..." -ForegroundColor Yellow
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
    }
}

function Clear-BackendPort([string]$Port) {
    for ($i = 0; $i -lt 5; $i++) {
        if (Test-TrustAIHealth $Port) { return }
        Stop-PortListeners $Port
        Start-Sleep -Seconds 2
    }
}

# Restart stale backend when health check fails (missing auth/batches routes)
if (-not (Test-TrustAIHealth $backendPort)) {
    Clear-BackendPort $backendPort
}

Set-Content "frontend\.env.local" @"
NEXT_PUBLIC_API_URL=$apiUrl
TRUSTAI_BACKEND_URL=http://127.0.0.1:$backendPort
"@

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
if ($env:TRUSTAI_PUBLIC_HOST) {
    Write-Host "  Public:    $($env:TRUSTAI_PUBLIC_HOST)"
}
Write-Host "  API:       $apiUrl (proxied to http://127.0.0.1:$backendPort)"
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
        Write-Host "Try: npm run free-port" -ForegroundColor Yellow
        Write-Host "Then: npm run dev" -ForegroundColor Yellow
        if ($backendProc -and -not $backendProc.HasExited) {
            Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
        }
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
