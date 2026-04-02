param(
    [Parameter(Mandatory = $true)]
    [string]$AppUrl
)

$ErrorActionPreference = "Stop"

$base = $AppUrl.TrimEnd('/')

Write-Host "Checking status endpoint..." -ForegroundColor Cyan
$statusResponse = Invoke-RestMethod -Uri "$base/api/status" -Method Get -TimeoutSec 30
$statusResponse | ConvertTo-Json -Depth 5

$isOnline = $false
if ($null -ne $statusResponse.ok) {
    $isOnline = [bool]$statusResponse.ok
} elseif ($null -ne $statusResponse.online) {
    $isOnline = [bool]$statusResponse.online
}

if (-not $isOnline) {
    throw "Health check failed: /api/status returned offline"
}

Write-Host "Checking chat endpoint..." -ForegroundColor Cyan
$body = @{
    messages = @(
        @{
            id = "healthcheck-msg-1"
            role = "user"
            parts = @(
                @{
                    type = "text"
                    text = "Reply with exactly: HEALTH_OK"
                }
            )
        }
    )
} | ConvertTo-Json -Depth 10

$chatResponse = Invoke-WebRequest -Uri "$base/api/chat" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 60 -UseBasicParsing

if ($chatResponse.StatusCode -lt 200 -or $chatResponse.StatusCode -ge 300) {
    throw "Health check failed: /api/chat did not return 2xx"
}

Write-Host "Chat endpoint returned HTTP $($chatResponse.StatusCode)" -ForegroundColor Green
Write-Host "Deploy health check passed." -ForegroundColor Green
