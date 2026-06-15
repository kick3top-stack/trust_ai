# TrustAI — backend only (reads .env from project root automatically)
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Get-Content "$Root\.env" | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
    }
}

$port = if ($env:TRUSTAI_BACKEND_PORT) { $env:TRUSTAI_BACKEND_PORT } else { "8000" }
Set-Location "$Root\backend"
$env:PYTHONPATH = "$Root\backend"
Write-Host "Backend: http://localhost:$port/api/v1/health" -ForegroundColor Cyan
python -m uvicorn app.main:app --host 127.0.0.1 --port $port --reload
