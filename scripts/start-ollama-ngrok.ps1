param(
    [int]$OllamaPort = 11435,
    [int]$NgrokInspectPort = 4040
)

$ErrorActionPreference = "Stop"

function Test-OllamaReady {
    param([int]$Port)

    try {
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/v1/models" -Method Get -TimeoutSec 3
        return $null -ne $response
    } catch {
        return $false
    }
}

function Resolve-NgrokCommand {
    $candidates = @(
        "ngrok",
        "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe",
        "$env:LOCALAPPDATA\Microsoft\WindowsApps\ngrok.exe"
    )

    foreach ($candidate in $candidates) {
        try {
            if ($candidate -eq "ngrok") {
                $cmd = Get-Command ngrok -ErrorAction Stop
                if ($cmd.Path) { return $cmd.Path }
            } elseif (Test-Path $candidate) {
                return $candidate
            }
        } catch {
            continue
        }
    }

    throw "ngrok not found. Install it first with winget install --id Ngrok.Ngrok -e"
}

$ollamaCmd = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollamaCmd) {
    throw "Ollama is not available in PATH. Install Ollama and reopen terminal."
}

$ngrokPath = Resolve-NgrokCommand

if (-not (Test-OllamaReady -Port $OllamaPort)) {
    Write-Host "Starting Ollama on 0.0.0.0:$OllamaPort ..." -ForegroundColor Cyan
    $startArgs = "`$env:OLLAMA_HOST='0.0.0.0:$OllamaPort'; ollama serve"
    Start-Process -FilePath "powershell" -ArgumentList "-NoProfile", "-WindowStyle", "Minimized", "-Command", $startArgs | Out-Null

    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Milliseconds 500
        if (Test-OllamaReady -Port $OllamaPort) {
            $ready = $true
            break
        }
    }

    if (-not $ready) {
        throw "Ollama did not become ready on port $OllamaPort in time."
    }
}

Write-Host "Ollama is ready at http://127.0.0.1:$OllamaPort" -ForegroundColor Green
Write-Host "Starting ngrok tunnel..." -ForegroundColor Cyan
Write-Host "" 
Write-Host "Keep this terminal open while using Vercel deployment." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop ngrok." -ForegroundColor Yellow
Write-Host ""

& $ngrokPath http $OllamaPort --log stdout
