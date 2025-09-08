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

function Write-Error {
    param([string]$Message)
    Write-Host "Error: $Message" -ForegroundColor Red
}

function Decode-JWT {
    param([string]$Token)
    
    $parts = $Token.Split('.')
    if ($parts.Length -ne 3) {
        throw "Invalid JWT token format"
    }
    
    $payload = $parts[1]
    while ($payload.Length % 4 -ne 0) {
        $payload += "="
    }
    
    $payloadBytes = [Convert]::FromBase64String($payload)
    $payloadJson = [System.Text.Encoding]::UTF8.GetString($payloadBytes)
    return $payloadJson | ConvertFrom-Json
}

try {
    Set-Location $ProjectRoot
    
    Write-Step "Step 1: Starting SpaceTimeDB"
    Start-Process -FilePath "powershell" -ArgumentList "-Command", "spacetime start" -WindowStyle Normal
    Write-Success "SpaceTimeDB started in new window"
    
    Write-Host "Waiting for SpaceTimeDB to initialize..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5

    Write-Step "Step 2: Rebuilding database with clean flag"
    & spacetime publish -c --project-path lunavoxel/server lunavoxel-db -y
    if ($LASTEXITCODE -ne 0) { throw "Failed to rebuild database" }
    Write-Success "Database rebuilt successfully"

    Write-Step "Step 3: Generating TypeScript bindings"
    & spacetime generate --lang typescript --out-dir frontend/src/module_bindings --project-path lunavoxel/server
    if ($LASTEXITCODE -ne 0) { throw "Failed to generate TypeScript bindings" }
    Write-Success "TypeScript bindings generated"

    Write-Step "Step 4: Creating new admin identity"
    $identityResponse = Invoke-RestMethod -Uri "http://localhost:3000/v1/identity" -Method Post -ContentType "application/json"
    if (-not $identityResponse.token) { throw "Failed to create identity - no token received" }
    Write-Success "New admin identity created"

    Write-Step "Step 5: Updating .env.local file"
    $envContent = @"
SPACETIME_URL=localhost:3000
SPACETIME_TOKEN=$($identityResponse.token)
"@
    $envPath = "functions/.env.local"
    New-Item -Path (Split-Path $envPath) -ItemType Directory -Force | Out-Null
    Set-Content -Path $envPath -Value $envContent
    Write-Success ".env.local updated"

    Write-Step "Step 6: Extracting identity from token"
    $decodedToken = Decode-JWT -Token $identityResponse.token
    $hexIdentity = $decodedToken.hex_identity
    Write-Host "New identity hash: $hexIdentity" -ForegroundColor Yellow

    Write-Step "Step 7: Updating admin user helper"
    $helperPath = "lunavoxel/server/helpers/EnsureIsAdminUser.cs"
    if (-not (Test-Path $helperPath)) { throw "EnsureIsAdminUser.cs not found at $helperPath" }
    
    $helperContent = Get-Content $helperPath -Raw
    $updatedContent = $helperContent -replace 'var isDev = callerIdentity\.ToLower\(\) == "[^"]*";', "var isDev = callerIdentity.ToLower() == `"$($hexIdentity.ToLower())`";"
    Set-Content -Path $helperPath -Value $updatedContent
    Write-Success "Admin user helper updated with new identity"

    Write-Step "Step 8: Updating database without clean flag"
    & spacetime publish --project-path lunavoxel/server lunavoxel-db
    if ($LASTEXITCODE -ne 0) { throw "Failed to update database" }
    Write-Success "Database updated"

    Write-Step "Step 9: Building functions"
    Set-Location functions
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw "Failed to build functions" }
    Set-Location ..
    Write-Success "Functions built successfully"

    Write-Step "Step 10: Starting Firebase emulators"
    Start-Process -FilePath "powershell" -ArgumentList "-Command", "firebase emulators:start" -WindowStyle Normal
    Write-Success "Firebase emulators started in new window"

    Start-Sleep -Seconds 3

    Write-Step "Step 11: Starting frontend development server"
    Set-Location frontend
    Start-Process -FilePath "powershell" -ArgumentList "-Command", "npm run dev" -WindowStyle Normal
    Set-Location ..
    Write-Success "Frontend development server started in new window"

    Write-Host "Project startup complete!" -ForegroundColor Green
    Write-Host "New identity token: $($identityResponse.token)" -ForegroundColor Yellow
    Write-Host "Identity hash: $hexIdentity" -ForegroundColor Yellow

}
catch {
    Write-Error "Script failed: $($_.Exception.Message)"
    exit 1
}