# Prepare TrustAI for a pilot deployment (secrets + reminders)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if (-not (Test-Path ".env")) {
    Copy-Item ".env.vps.example" ".env"
    Write-Host "Created .env from .env.vps.example" -ForegroundColor Yellow
}

$jwt = [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
$content = Get-Content ".env" -Raw

if ($content -match "TRUSTAI_JWT_SECRET=change-me") {
    $content = $content -replace "TRUSTAI_JWT_SECRET=change-me", "TRUSTAI_JWT_SECRET=$jwt"
    Set-Content ".env" $content.TrimEnd()
    Write-Host "Generated new TRUSTAI_JWT_SECRET" -ForegroundColor Green
} else {
    Write-Host "TRUSTAI_JWT_SECRET already customized - left unchanged" -ForegroundColor DarkGray
}

if (-not (Test-Path "secrets\signing_key.pem")) {
    python scripts/generate_signing_key.py --output secrets/signing_key.pem
}

Write-Host ""
Write-Host "Pilot checklist:" -ForegroundColor Cyan
Write-Host "  1. Change TRUSTAI_ADMIN_PASSWORD in .env (not admin123)"
Write-Host "  2. Set TRUSTAI_PUBLIC_HOST if using VPS public IP"
Write-Host "  3. Run: npm run dev"
Write-Host "  4. Run: npm run smoke-test"
Write-Host "  5. Read: docs/support-playbook.md"
