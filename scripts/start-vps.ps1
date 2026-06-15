# TrustAI VPS startup (Windows, no Docker)
# Usage: .\scripts\start-vps.ps1
# Optional: .\scripts\start-vps.ps1 -PublicHost "http://YOUR_VPS_IP:3000"

param(
    [string]$PublicHost = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "TrustAI VPS setup at $Root" -ForegroundColor Cyan

# .env
if (-not (Test-Path ".env")) {
    Copy-Item ".env.vps.example" ".env"
    Write-Host "Created .env from .env.vps.example"
}

# Signing key
if (-not (Test-Path "secrets/signing_key.pem")) {
    New-Item -ItemType Directory -Force -Path "secrets" | Out-Null
    python scripts/generate_signing_key.py --output secrets/signing_key.pem
}

# Data dir
New-Item -ItemType Directory -Force -Path "data" | Out-Null

# Backend deps (core only — skip torch if install fails)
Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
pip install fastapi uvicorn pydantic pydantic-settings sqlalchemy aiosqlite cryptography python-multipart httpx pytest pytest-asyncio -q
pip install transformers accelerate safetensors -q 2>$null
pip install llama-cpp-python -q 2>$null

# Frontend deps
if (-not (Test-Path "frontend/node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    Set-Location frontend
    npm install
    Set-Location $Root
}

# Update CORS and API URL for public access
$apiUrl = $PublicHost -replace ":3000", ":8000"
$envContent = Get-Content ".env" -Raw
$envContent = $envContent -replace "TRUSTAI_CORS_ORIGINS=.*", "TRUSTAI_CORS_ORIGINS=$PublicHost"
$envContent = $envContent -replace "NEXT_PUBLIC_API_URL=.*", "NEXT_PUBLIC_API_URL=$apiUrl/api/v1"
Set-Content ".env" $envContent -NoNewline

Write-Host ""
Write-Host "Starting TrustAI..." -ForegroundColor Green
Write-Host "  Frontend: $PublicHost"
Write-Host "  API:      $apiUrl/api/v1"
Write-Host "  Health:   $apiUrl/api/v1/health"
Write-Host ""
Write-Host "Press Ctrl+C to stop both services." -ForegroundColor DarkGray

# Load .env into process
Get-Content ".env" | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
    }
}

$env:PYTHONPATH = "$Root\backend"
$env:NEXT_PUBLIC_API_URL = "$apiUrl/api/v1"

# Start backend in background job
$backendJob = Start-Job -ScriptBlock {
    param($Root)
    Set-Location "$Root\backend"
    $env:PYTHONPATH = "$Root\backend"
    uvicorn app.main:app --host 0.0.0.0 --port 8000
} -ArgumentList $Root

Start-Sleep -Seconds 3

# Start frontend in foreground
Set-Location "$Root\frontend"
npm run dev -- --hostname 0.0.0.0 --port 3000

Stop-Job $backendJob -ErrorAction SilentlyContinue
Remove-Job $backendJob -Force -ErrorAction SilentlyContinue
