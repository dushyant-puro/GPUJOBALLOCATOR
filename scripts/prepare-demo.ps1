param([switch]$Install)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$pythonPath = Join-Path $projectRoot 'backend\.venv\Scripts\python.exe'
if (!(Test-Path -LiteralPath $pythonPath)) { $pythonPath = (Get-Command python.exe -ErrorAction Stop).Source }
Push-Location (Join-Path $projectRoot 'backend')
try {
    if ($Install) {
        & $pythonPath -m pip install -r requirements.txt -r requirements-dev.txt
        if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed.' }
    }
    & $pythonPath -B -m unittest discover -s tests
    if ($LASTEXITCODE -ne 0) { throw 'Backend checks failed; see the output above.' }
    & $pythonPath -B -m app.prepare_demo
    if ($LASTEXITCODE -ne 0) { throw 'Reference evidence generation failed.' }
} finally { Pop-Location }
Push-Location (Join-Path $projectRoot 'frontend')
try {
    if ($Install) {
        & npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
    }
    & npm.cmd run lint
    if ($LASTEXITCODE -ne 0) { throw 'Frontend lint failed.' }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
} finally { Pop-Location }
Write-Host 'Demo prepared. Run start-demo.cmd. Dependencies and assets are local; no venue Wi-Fi is needed.' -ForegroundColor Green
