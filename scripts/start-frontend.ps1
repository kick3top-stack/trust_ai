# TrustAI — frontend only (reads frontend/.env.local automatically)
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

# Sync API URL from root .env
if (Test-Path "$Root\.env") {
    $apiUrl = (Get-Content "$Root\.env" | Where-Object { $_ -match "^NEXT_PUBLIC_API_URL=" }) -replace "NEXT_PUBLIC_API_URL=", ""
    if ($apiUrl) {
        Set-Content "$Root\frontend\.env.local" "NEXT_PUBLIC_API_URL=$apiUrl"
    }
}

Set-Location "$Root\frontend"
if (-not (Test-Path "node_modules")) { npm install }
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
npm run dev
