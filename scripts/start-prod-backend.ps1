# TrustAI production backend (Windows VPS) - no Docker, no --reload
# Usage: npm run prod:backend
# Listens on 0.0.0.0 so Vercel or other hosts can reach the API by public IP.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if (-not (Test-Path ".env")) {
    Copy-Item ".env.vps.example" ".env"
    Write-Host "Created .env from .env.vps.example - edit TRUSTAI_CORS_ORIGINS and secrets before public use." -ForegroundColor Yellow
}

Get-Content ".env" | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
    }
}

if (-not (Test-Path "secrets\signing_key.pem")) {
    New-Item -ItemType Directory -Force -Path "secrets" | Out-Null
    python scripts/generate_signing_key.py --output secrets/signing_key.pem
}

New-Item -ItemType Directory -Force -Path "data" | Out-Null

$port = if ($env:TRUSTAI_BACKEND_PORT) { $env:TRUSTAI_BACKEND_PORT } else { "8000" }
$env:PYTHONPATH = "$Root\backend"

Write-Host "TrustAI production backend" -ForegroundColor Cyan
Write-Host "  Listen:   0.0.0.0:$port"
Write-Host "  Health:   http://127.0.0.1:$port/api/v1/health"
Write-Host "  External: http://YOUR_PUBLIC_IP:$port/api/v1/health"
Write-Host ""
Write-Host "Set Vercel TRUSTAI_BACKEND_URL=http://YOUR_PUBLIC_IP:$port" -ForegroundColor DarkGray
Write-Host "Set TRUSTAI_CORS_ORIGINS to your Vercel URL (https://....vercel.app)" -ForegroundColor DarkGray
Write-Host ""

Set-Location "$Root\backend"
python -m uvicorn app.main:app --host 0.0.0.0 --port $port
