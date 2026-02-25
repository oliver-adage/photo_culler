param(
  [string]$PythonExe = "python"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host "Installing build dependencies..."
& $PythonExe -m pip install -r requirements-build.txt

Write-Host "Cleaning previous build output..."
if (Test-Path build) { Remove-Item -Recurse -Force build }
if (Test-Path dist) { Remove-Item -Recurse -Force dist }

Write-Host "Building portable Windows app (PyInstaller onedir)..."
& $PythonExe -m PyInstaller `
  --noconfirm `
  --clean `
  --onedir `
  --name PhotoCuller `
  --icon "assets\\app.ico" `
  --version-file "packaging\\windows-version-info.txt" `
  --add-data "index.html;." `
  --add-data "web;web" `
  native_server.py

Write-Host ""
Write-Host "Build complete:"
Write-Host "  dist\\PhotoCuller\\PhotoCuller.exe"
