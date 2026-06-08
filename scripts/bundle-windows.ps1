# Bundle Ourboros for Windows - assumes cargo and web are already built
# Usage: .\bundle-windows-quick.ps1

param(
    [ValidateSet('exe', 'portable')]
    [string]$OutputType = 'exe'
)

$ErrorActionPreference = 'Stop'

$ROOT = Split-Path -Parent $PSScriptRoot
Push-Location $ROOT

# Configuration
$APP_NAME = 'Ourboros'
$APP_VERSION = '0.1.0'
$EXECUTABLE_NAME = 'Ourboros.exe'
$RELEASE_BINARY_NAME = 'ourboros.exe'
$BINARY_PATH = "target\release\$RELEASE_BINARY_NAME"
$WEB_DIST = 'web\dist'
$OUTPUT_DIR = "target\bundle-output"
$APP_BUNDLE_DIR = "$OUTPUT_DIR\$APP_NAME"

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Ourboros Windows Bundle - Quick" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

# Check if binary exists
if (-not (Test-Path $BINARY_PATH)) {
    Write-Host "[ERROR] Missing: $BINARY_PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Build the Rust backend first:" -ForegroundColor Yellow
    Write-Host "  cargo build -p ourboros --release" -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] Found binary: $BINARY_PATH" -ForegroundColor Green

# Check if web dist exists
$WEB_INDEX = "$WEB_DIST\index.html"
if (-not (Test-Path $WEB_INDEX)) {
    Write-Host "[ERROR] Missing: $WEB_INDEX" -ForegroundColor Red
    Write-Host ""
    Write-Host "Build the frontend first:" -ForegroundColor Yellow
    Write-Host "  cd web && npm install && npm run build && cd .." -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] Found web dist: $WEB_DIST" -ForegroundColor Green

Write-Host ""
Write-Host "Creating bundle..." -ForegroundColor Cyan

# Clean and create bundle directory
Remove-Item $OUTPUT_DIR -Force -Recurse -ErrorAction SilentlyContinue | Out-Null
New-Item -ItemType Directory -Path $APP_BUNDLE_DIR -Force | Out-Null
$RESOURCES_DIR = "$APP_BUNDLE_DIR\resources"
New-Item -ItemType Directory -Path $RESOURCES_DIR -Force | Out-Null

# Copy binary
$TARGET_EXE = "$APP_BUNDLE_DIR\$EXECUTABLE_NAME"
Copy-Item $BINARY_PATH $TARGET_EXE
Write-Host "  [+] Copied executable"

# Copy web resources
$TARGET_WEB = "$RESOURCES_DIR\web"
Copy-Item -Path "$WEB_DIST\*" -Destination $TARGET_WEB -Recurse -Force
Write-Host "  [+] Copied web resources"

# Create batch launcher
$RUN_BAT = "$APP_BUNDLE_DIR\run.bat"
$BATCH_CONTENT = @"
@echo off
setlocal enabledelayedexpansion
set OURBOROS_APP_BUNDLE=1
set APP_DIR=%~dp0
"%APP_DIR%$EXECUTABLE_NAME" %*
endlocal
"@
$BATCH_CONTENT | Out-File -FilePath $RUN_BAT -Encoding ASCII -Force
Write-Host "  [+] Created launcher script"

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "Bundle ready!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green

Write-Host ""
Write-Host "Location: $APP_BUNDLE_DIR" -ForegroundColor Cyan
Write-Host ""
Write-Host "Run the app:" -ForegroundColor Yellow
Write-Host "  $TARGET_EXE" -ForegroundColor White
Write-Host "  or" -ForegroundColor Yellow
Write-Host "  $RUN_BAT" -ForegroundColor White
Write-Host ""
Write-Host "Web UI: http://127.0.0.1:8080" -ForegroundColor Cyan

Pop-Location
