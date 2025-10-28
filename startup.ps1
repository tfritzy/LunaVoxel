param(
    [string]$ProjectRoot = "."
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "Step: $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "Success: $Message" -ForegroundColor Green
}

function Write-ErrorMessage {
    param([string]$Message)
    Write-Host "Error: $Message" -ForegroundColor Red
}

try {
    Set-Location $ProjectRoot

    Write-Step "Step 0: Clearing all local SpacetimeDB data"
    Write-Host "Stopping any running SpacetimeDB instances..." -ForegroundColor Yellow
    Get-Process | Where-Object { $_.ProcessName -like "*spacetime*" } | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    Write-Host "Clearing SpacetimeDB data directory..." -ForegroundColor Yellow
    $spacetimeDataDir = Join-Path $env:USERPROFILE ".spacetime"
    if (Test-Path $spacetimeDataDir) {
        Remove-Item -Path $spacetimeDataDir -Recurse -Force
        Write-Success "SpacetimeDB data cleared"
    } else {
        Write-Success "No existing SpacetimeDB data found"
    }
    
    Write-Step "Step 1: Starting SpaceTimeDB"
    Start-Process -FilePath "powershell" -ArgumentList "-Command", "spacetime start" -WindowStyle Normal
    Write-Success "SpaceTimeDB started in new window"
    
    Write-Host "Waiting for SpaceTimeDB to initialize..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5

    Write-Step "Step 2: Publishing Rust backend with clean flag"
    & spacetime publish -c --project-path backend lunavoxel-db -y
    if ($LASTEXITCODE -ne 0) { throw "Failed to publish Rust backend" }
    Write-Success "Rust backend published successfully"

    Write-Step "Step 3: Generating TypeScript bindings"
    & spacetime generate --lang typescript --out-dir frontend/src/module_bindings --project-path backend
    if ($LASTEXITCODE -ne 0) { throw "Failed to generate TypeScript bindings" }
    Write-Success "TypeScript bindings generated"

    Write-Step "Step 4: Building functions"
    Set-Location functions
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw "Failed to build functions" }
    Set-Location ..
    Write-Success "Functions built successfully"

    Write-Step "Step 5: Starting Firebase emulators"
    Start-Process -FilePath "powershell" -ArgumentList "-Command", "firebase emulators:start" -WindowStyle Normal
    Write-Success "Firebase emulators started in new window"

    Start-Sleep -Seconds 3

    Write-Step "Step 6: Starting frontend development server"
    Set-Location frontend
    Start-Process -FilePath "powershell" -ArgumentList "-Command", "npm run dev" -WindowStyle Normal
    Set-Location ..
    Write-Success "Frontend development server started in new window"

    Write-Host ""
    Write-Host "Project startup complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "=== Service Status ===" -ForegroundColor Cyan
    Write-Host "- SpaceTimeDB (Rust Backend) - Running in new window" -ForegroundColor Green
    Write-Host "- Firebase Emulators - Running in new window" -ForegroundColor Green
    Write-Host "- Frontend Dev Server - Running in new window" -ForegroundColor Green
    Write-Host "======================" -ForegroundColor Cyan

}
catch {
    Write-Host "Error: Script failed: " -NoNewline -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}