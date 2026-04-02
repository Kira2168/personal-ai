param(
    [string]$Target = "production",
    [switch]$SkipDeploy
)

$ErrorActionPreference = "Stop"

function Get-NgrokUrl {
    try {
        $api = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -Method Get -TimeoutSec 5
    } catch {
        throw "ngrok inspector is not reachable at http://127.0.0.1:4040. Start the tunnel first with npm run tunnel:start"
    }

    $httpsTunnel = $api.tunnels | Where-Object { $_.public_url -like "https://*" } | Select-Object -First 1
    if (-not $httpsTunnel -or -not $httpsTunnel.public_url) {
        throw "No active HTTPS ngrok tunnel found."
    }

    return $httpsTunnel.public_url.TrimEnd('/')
}

function Update-LocalEnv {
    param([string]$NewBaseUrl)

    $envPath = Join-Path $PSScriptRoot "..\.env.local"
    if (-not (Test-Path $envPath)) {
        return
    }

    $content = Get-Content $envPath -Raw
    if ($content -match "(?m)^OLLAMA_BASE_URL=") {
        $updated = [regex]::Replace($content, "(?m)^OLLAMA_BASE_URL=.*$", "OLLAMA_BASE_URL=$NewBaseUrl")
    } else {
        $updated = $content.TrimEnd() + "`r`nOLLAMA_BASE_URL=$NewBaseUrl`r`n"
    }

    Set-Content -Path $envPath -Value $updated -NoNewline
}

function Get-VercelArgs {
    if ([string]::IsNullOrWhiteSpace($env:VERCEL_TOKEN)) {
        Write-Host "VERCEL_TOKEN not set. Falling back to Vercel CLI login session." -ForegroundColor Yellow
        return @()
    }

    return @("--token", $env:VERCEL_TOKEN)
}

function EnsureVercelLinked {
    $projectPath = Join-Path $PSScriptRoot "..\.vercel\project.json"
    if (-not (Test-Path $projectPath)) {
        throw "Project is not linked to Vercel. Run npx vercel link once, then retry."
    }
}

$ngrokBase = Get-NgrokUrl
$ollamaBase = "$ngrokBase/v1"

Write-Host "Detected ngrok URL: $ngrokBase" -ForegroundColor Green
Write-Host "Using OLLAMA_BASE_URL: $ollamaBase" -ForegroundColor Green

Update-LocalEnv -NewBaseUrl $ollamaBase
Write-Host "Updated local .env.local" -ForegroundColor Cyan

$vercelArgs = Get-VercelArgs
EnsureVercelLinked

Write-Host "Updating Vercel env OLLAMA_BASE_URL for target '$Target'..." -ForegroundColor Cyan
try {
    npx vercel env rm OLLAMA_BASE_URL $Target --yes @vercelArgs *> $null
} catch {
}

$tempFile = New-TemporaryFile
Set-Content -Path $tempFile -Value $ollamaBase -NoNewline
Get-Content $tempFile | npx vercel env add OLLAMA_BASE_URL $Target @vercelArgs
Remove-Item $tempFile -ErrorAction SilentlyContinue

Write-Host "Vercel env updated." -ForegroundColor Green

if (-not $SkipDeploy) {
    Write-Host "Triggering production redeploy..." -ForegroundColor Cyan
    npx vercel deploy --prod --yes @vercelArgs
} else {
    Write-Host "SkipDeploy set, no redeploy triggered." -ForegroundColor Yellow
}
