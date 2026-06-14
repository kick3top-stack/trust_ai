# Free port 8000 (or another port) for TrustAI
param([int]$Port = 8000)

$lines = netstat -ano | Select-String ":$Port\s" | Select-String "LISTENING"
foreach ($line in $lines) {
    if ($line -match "\s(\d+)\s*$") {
        $pid = [int]$matches[1]
        Write-Host "Stopping PID $pid on port $Port..."
        taskkill /PID $pid /F
    }
}
Write-Host "Port $Port should now be free. Run: npm run dev"
