$ErrorActionPreference = "Stop"

$taskName = "MyPersonalAI-Tunnel"

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "Startup task removed: $taskName" -ForegroundColor Yellow
} else {
    Write-Host "Startup task not found: $taskName" -ForegroundColor Yellow
}
