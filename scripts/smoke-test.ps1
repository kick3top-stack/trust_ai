# TrustAI smoke test - run while npm run dev is active
param(
    [string]$BaseUrl = "http://127.0.0.1:8000/api/v1"
)

$ErrorActionPreference = "Stop"
$passed = 0
$failed = 0

function Test-Step($name, [scriptblock]$action) {
    try {
        & $action
        Write-Host "[OK] $name" -ForegroundColor Green
        $script:passed++
    } catch {
        Write-Host "[FAIL] $name - $($_.Exception.Message)" -ForegroundColor Red
        $script:failed++
    }
}

Write-Host "TrustAI smoke test -> $BaseUrl" -ForegroundColor Cyan
Write-Host ""

Test-Step "Health endpoint" {
    $h = Invoke-RestMethod "$BaseUrl/health" -TimeoutSec 5
    if ($h.status -ne "ok") { throw "status not ok" }
    if (-not $h.auth_enabled) { throw "auth_enabled missing" }
    if (-not $h.disputes) { throw "disputes flag missing - restart backend" }
}

$testEmail = "smoke-$(Get-Random)@example.com"
$testPass = "smokepass123"
$token = $null
$requestId = $null

Test-Step "Register user" {
    $body = @{ email = $testEmail; password = $testPass; display_name = "Smoke Test" } | ConvertTo-Json
    $r = Invoke-RestMethod "$BaseUrl/auth/register" -Method POST -Body $body -ContentType "application/json"
    if (-not $r.access_token) { throw "no token" }
    $script:token = $r.access_token
}

Test-Step "Auth me" {
    $headers = @{ Authorization = "Bearer $token" }
    $me = Invoke-RestMethod "$BaseUrl/auth/me" -Headers $headers
    if ($me.email -ne $testEmail) { throw "email mismatch" }
}

Test-Step "Billing statement" {
    $headers = @{ Authorization = "Bearer $token" }
    $s = Invoke-RestMethod "$BaseUrl/billing/statement" -Headers $headers
    if ($s.balance -lt 0) { throw "invalid balance" }
}

Test-Step "Admin login" {
    $body = @{ email = "admin@trustai.local"; password = "admin123" } | ConvertTo-Json
    $r = Invoke-RestMethod "$BaseUrl/auth/login" -Method POST -Body $body -ContentType "application/json"
    if ($r.user.role -ne "admin") { throw "not admin" }
}

Test-Step "Support disputes list (admin)" {
    $body = @{ email = "admin@trustai.local"; password = "admin123" } | ConvertTo-Json
    $login = Invoke-RestMethod "$BaseUrl/auth/login" -Method POST -Body $body -ContentType "application/json"
    $headers = @{ Authorization = "Bearer $($login.access_token)" }
    $d = Invoke-RestMethod "$BaseUrl/admin/support/disputes" -Headers $headers
    if ($null -eq $d.disputes) { throw "disputes missing" }
}

Write-Host ""
Write-Host "Passed: $passed  Failed: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Yellow" })
if ($failed -gt 0) { exit 1 }
