$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$release = Join-Path $root "release\AgentPing-win32-x64"
$exe = Join-Path $release "AgentPing.exe"
$core = Join-Path $release "AgentPingCore.exe"
$shortcutPath = Join-Path $release "AgentPing.lnk"
$icon = Join-Path $root "assets\icon.ico"

if (-not (Test-Path -LiteralPath $release)) {
  throw "release folder not found: $release"
}

if (-not (Test-Path -LiteralPath $core)) {
  if (-not (Test-Path -LiteralPath $exe)) {
    throw "neither AgentPing.exe nor AgentPingCore.exe exists in $release"
  }
  $size = (Get-Item -LiteralPath $exe).Length
  if ($size -lt 10MB) {
    throw "AgentPing.exe is unexpectedly small ($size bytes); packaging did not produce a valid Electron launcher"
  }
  Rename-Item -LiteralPath $exe -NewName "AgentPingCore.exe"
}

# Remove a stale wrapper from an older build, if present.
if (Test-Path -LiteralPath $exe) {
  $size = (Get-Item -LiteralPath $exe).Length
  if ($size -lt 10MB) {
    Remove-Item -LiteralPath $exe -Force
  }
}

Copy-Item -LiteralPath $icon -Destination (Join-Path $release "icon.ico") -Force

$cmdPath = Join-Path $release "AgentPing.cmd"
@"
@echo off
cd /d "%~dp0"
start "" "%~dp0AgentPingCore.exe" --no-sandbox
exit /b
"@ | Set-Content -LiteralPath $cmdPath -Encoding ascii

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $core
$shortcut.Arguments = "--no-sandbox"
$shortcut.WorkingDirectory = $release
$shortcut.IconLocation = (Join-Path $release "icon.ico")
$shortcut.Description = "Agent Ping Global"
$shortcut.Save()

Write-Host "shortcut built: $shortcutPath"
Write-Host "runtime: $core"
