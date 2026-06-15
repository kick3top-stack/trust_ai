# Free port 8000 (or another port) for TrustAI
param([int]$Port = 8000)

function Stop-TrustAIPythonProcesses {
    Get-CimInstance Win32_Process -Filter "Name='python.exe'" -ErrorAction SilentlyContinue |
        Where-Object {
            $_.CommandLine -like "*uvicorn*app.main*" -or
            $_.CommandLine -like "*multiprocessing.spawn*spawn_main*"
        } |
        ForEach-Object {
            Write-Host "Stopping TrustAI backend (PID $($_.ProcessId))..."
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
}

Stop-TrustAIPythonProcesses

$lines = netstat -ano | Select-String ":$Port\s" | Select-String "LISTENING"
$pids = @()
foreach ($line in $lines) {
    if ($line -match "\s(\d+)\s*$") { $pids += [int]$matches[1] }
}
$pids = $pids | Select-Object -Unique

foreach ($procId in $pids) {
    if (Get-Process -Id $procId -ErrorAction SilentlyContinue) {
        Write-Host "Stopping PID $procId on port $Port..."
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
}

Start-Sleep -Seconds 2
Write-Host "Port $Port should now be free. Run: npm run dev"
