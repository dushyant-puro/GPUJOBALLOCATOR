param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$backendPath = Join-Path $projectRoot 'backend'
if (!(Test-Path -LiteralPath (Join-Path $projectRoot 'frontend\dist\index.html'))) {
    throw 'Build the presentation first: run prepare-demo.cmd (use -Install if dependencies are missing).'
}
$demoUrl = 'http://127.0.0.1:8000/studio/'
$existingEngine = $false
try {
    $health = Invoke-RestMethod 'http://127.0.0.1:8000/health' -TimeoutSec 2
    $existingEngine = $health.service -eq 'GPU Job Allocator' -and $health.status -eq 'healthy'
} catch { }
if ($existingEngine) {
    try { $null = Invoke-WebRequest $demoUrl -UseBasicParsing -TimeoutSec 3 }
    catch { throw 'An earlier allocator server is using port 8000. Stop that server, then run start-demo.cmd again to load the presentation.' }
} else {
    $pythonPath = Join-Path $backendPath '.venv\Scripts\python.exe'
    if (!(Test-Path -LiteralPath $pythonPath)) { $pythonPath = (Get-Command python.exe -ErrorAction Stop).Source }
    $logPath = Join-Path $projectRoot '.demo'
    $null = New-Item -ItemType Directory -Path $logPath -Force
    $demoProcess = Start-Process -FilePath $pythonPath -ArgumentList @('-B', '-m', 'uvicorn', 'app.main:app', '--app-dir', ('"' + $backendPath + '"'), '--host', '127.0.0.1', '--port', '8000') -WorkingDirectory $backendPath -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logPath 'server.log') -RedirectStandardError (Join-Path $logPath 'server-error.log')
    Set-Content -LiteralPath (Join-Path $logPath 'server.pid') -Value $demoProcess.Id
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        Start-Sleep -Milliseconds 250
        $demoProcess.Refresh()
        if ($demoProcess.HasExited) { throw ('Engine did not start. Read ' + (Join-Path $logPath 'server-error.log')) }
        try {
            $health = Invoke-RestMethod 'http://127.0.0.1:8000/health' -TimeoutSec 1
            $null = Invoke-WebRequest $demoUrl -UseBasicParsing -TimeoutSec 1
            if ($health.service -eq 'GPU Job Allocator') { $ready = $true; break }
        } catch { }
    }
    if (!$ready) { throw ('Startup timed out. Read ' + (Join-Path $logPath 'server-error.log')) }
}
Write-Host ('Demo ready: ' + $demoUrl) -ForegroundColor Green
if (!$NoBrowser) { Start-Process $demoUrl }
