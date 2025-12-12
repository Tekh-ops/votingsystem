<#
  Windows build script for Online Voting System.
  Usage:
    powershell -ExecutionPolicy Bypass -File .\windows_build.ps1
  Notes:
    - Prefers MSVC (cl) if available, else tries MinGW gcc.
    - Outputs bin\onlinevote.exe
#>

$ErrorActionPreference = "Stop"

Write-Host "== Online Voting System: Windows build ==" -ForegroundColor Cyan

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

$srcFiles = Get-ChildItem -Path "$projectRoot\src" -Recurse -Filter *.c | ForEach-Object { $_.FullName }
if (-not $srcFiles -or $srcFiles.Count -eq 0) {
    Write-Error "No .c files found under src"
}

if (-not (Test-Path "$projectRoot\bin")) {
    New-Item -ItemType Directory -Path "$projectRoot\bin" | Out-Null
}

$cl = Get-Command cl -ErrorAction SilentlyContinue
$gcc = Get-Command gcc -ErrorAction SilentlyContinue

if ($cl) {
    Write-Host "Using MSVC (cl)" -ForegroundColor Green
    $args = @("/std:c11", "/W4", "/nologo", "/D_CRT_SECURE_NO_WARNINGS", "/Fe:bin\onlinevote.exe")
    $args += $srcFiles
    & $cl @args
} elseif ($gcc) {
    Write-Host "Using MinGW gcc" -ForegroundColor Green
    $args = @("-std=c11", "-Wall", "-Wextra", "-O2")
    $args += $srcFiles
    $args += @("-o", "bin/onlinevote.exe")
    & $gcc @args
} else {
    Write-Error "Neither cl (MSVC) nor gcc (MinGW) found in PATH."
}

Write-Host "Build complete. Output: bin\onlinevote.exe" -ForegroundColor Cyan

