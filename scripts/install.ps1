# ANIMUS Career installer for Windows (PowerShell).
#   • Python venv + `animus` command
#   • a logon task that keeps the local server and scheduler running
#   • a Start-menu shortcut
# Your data lives in %APPDATA%\ANIMUS Career (override with $env:ANIMUS_HOME).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Port = if ($env:JOBAGENT_PORT) { $env:JOBAGENT_PORT } else { "8765" }

$py = Get-Command py -ErrorAction SilentlyContinue
$python = if ($py) { "py -3" } else { "python" }
Write-Host "-> Python environment"
if (-not (Test-Path "$Root\.venv\Scripts\python.exe")) { Invoke-Expression "$python -m venv `"$Root\.venv`"" }
& "$Root\.venv\Scripts\python.exe" -m pip install -q --upgrade pip
& "$Root\.venv\Scripts\python.exe" -m pip install -q -e "$Root"

Write-Host "-> animus command (added to your user PATH)"
$scripts = "$Root\.venv\Scripts"
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$scripts*") { [Environment]::SetEnvironmentVariable("Path", "$userPath;$scripts", "User") }

Write-Host "-> Background server (runs at logon)"
$pyw = "$Root\.venv\Scripts\pythonw.exe"
$action = New-ScheduledTaskAction -Execute $pyw -Argument "-m animus_career.cli serve --port $Port" -WorkingDirectory $Root
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName "ANIMUS Career" -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName "ANIMUS Career"

Write-Host "-> Start menu shortcut"
$lnk = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\ANIMUS Career.lnk"
$sh = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)
$sh.TargetPath = $pyw; $sh.Arguments = "-m animus_career.cli open --port $Port"; $sh.WorkingDirectory = $Root; $sh.Save()

Write-Host ""
Write-Host "Installed. Open http://127.0.0.1:$Port (or run: animus open) - the setup wizard starts on first launch."
