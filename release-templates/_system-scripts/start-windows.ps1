# Free GST Billing - Windows start-server + open-browser.
#
# Invoked by the HTA launcher's "Open App" button and by the
# Desktop shortcut. Idempotent - safe to click multiple times.
# If the server is already running on our chosen port, we just
# open the browser without spawning a duplicate node.exe.

$ErrorActionPreference = 'Continue'
$Host.UI.RawUI.WindowTitle = 'Free GST Billing - Server'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SystemDir = $ScriptDir

# v1.10.69 - the Windows launcher was renamed from "Free GST Billing.hta" to
# "Free GST Billing - WINDOWS.hta". An update to this version is carried out
# by the PREVIOUS version's updater, which copies the new launcher in but
# knows nothing of the rename: it leaves the old file beside the new one, and
# the Desktop and Start-Menu shortcuts still pointing at the old one. That
# works, but it leaves two launchers in the folder and the user on the old
# screen. This script is the first new code to run after such an update -
# both launchers call it for Open App - so it tidies up here, once.
#
# It only touches shortcuts whose target is exactly the old launcher in THIS
# folder, and it deletes the old launcher only when no shortcut points at it
# any more. If anything fails it leaves everything as it was: the old
# launcher still works, so the worst case is a missed tidy-up, never a
# broken shortcut.
function Move-ToRenamedLauncher {
  $RootDir = Split-Path -Parent $SystemDir
  $oldHta = Join-Path $RootDir 'Free GST Billing.hta'
  $newHta = Join-Path $RootDir 'Free GST Billing - WINDOWS.hta'
  if (-not ((Test-Path -LiteralPath $oldHta) -and (Test-Path -LiteralPath $newHta))) { return }
  try {
    $wsh = New-Object -ComObject WScript.Shell
    $icon = Join-Path $SystemDir 'app-icon.ico'
    $dirs = @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))
    $stillOld = 0
    foreach ($dir in $dirs) {
      if (-not $dir -or -not (Test-Path -LiteralPath $dir)) { continue }
      foreach ($lnk in Get-ChildItem -LiteralPath $dir -Filter '*.lnk' -File -ErrorAction SilentlyContinue) {
        $sc = $wsh.CreateShortcut($lnk.FullName)
        $lnkArgs = [string]$sc.Arguments
        if ($lnkArgs.Trim('"') -ne $oldHta) { continue }
        $sc.Arguments = '"' + $newHta + '"'
        if (Test-Path -LiteralPath $icon) { $sc.IconLocation = "$icon,0" }
        $sc.Save()
        $check = $wsh.CreateShortcut($lnk.FullName)
        if (([string]$check.Arguments).Trim('"') -eq $oldHta) { $stillOld++ }
      }
    }
    if ($stillOld -eq 0) { Remove-Item -LiteralPath $oldHta -Force -ErrorAction Stop }
  } catch {
    # The old launcher may be open right now (it is often what called this),
    # in which case Windows will not delete it. The next Open App will.
  }
}
Move-ToRenamedLauncher

# v1.10.75 - updating only ever ADDED files, so an install that started on an
# older version kept launchers and scripts that no longer do anything (and
# look like a second copy of the app). Remove them, by exact name only, and
# only when the file that replaced each one is present. Never touches data,
# node, node_modules or backups.
function Remove-ObsoleteFiles {
  # Only in a real install. Run from the source tree (release-templates\
  # _system-scripts) the legacy-folder rule below would delete this script's
  # own folder.
  if ((Split-Path -Leaf $SystemDir) -ne '_system') { return }
  $RootDir = Split-Path -Parent $SystemDir
  $hta = Join-Path $RootDir 'Free GST Billing - WINDOWS.hta'
  if (-not (Test-Path -LiteralPath $hta)) { return }   # not the current layout: leave everything
  # Anything a shortcut still points at stays (an old Start-Menu or Startup
  # shortcut would otherwise be left pointing at nothing).
  $linked = @()
  try {
    $wsh = New-Object -ComObject WScript.Shell
    foreach ($dir in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('Startup'))) {
      if (-not $dir -or -not (Test-Path -LiteralPath $dir)) { continue }
      foreach ($lnk in Get-ChildItem -LiteralPath $dir -Filter '*.lnk' -File -Recurse -ErrorAction SilentlyContinue) {
        try { $sc = $wsh.CreateShortcut($lnk.FullName); $linked += ([string]$sc.TargetPath + ' ' + [string]$sc.Arguments) } catch { }
      }
    }
  } catch { return }   # cannot tell what is still in use: leave everything
  $obsolete = @(
    # renamed launchers (v1.10.69); the old .hta is handled above, once no shortcut uses it
    @{ old = 'Free GST Billing.command'; now = 'Free GST Billing - MAC.command' },
    @{ old = 'Free GST Billing.sh';      now = 'Free GST Billing - LINUX.sh' },
    # batch launchers from before the one-file launcher (v1.10.44)
    @{ old = 'Install FreeGSTBill.bat';  now = 'Free GST Billing - WINDOWS.hta' },
    @{ old = 'Start FreeGSTBill.bat';    now = 'Free GST Billing - WINDOWS.hta' },
    @{ old = 'Stop FreeGSTBill.bat';     now = 'Free GST Billing - WINDOWS.hta' },
    @{ old = 'Update FreeGSTBill.bat';   now = 'Free GST Billing - WINDOWS.hta' },
    @{ old = 'start-freegstbill.bat';    now = 'Free GST Billing - WINDOWS.hta' },
    @{ old = 'start-server-silent.bat';  now = 'Free GST Billing - WINDOWS.hta' }
  )
  foreach ($f in $obsolete) {
    $oldPath = Join-Path $RootDir $f.old
    if (@($linked | Where-Object { $_.ToLower().Contains($oldPath.ToLower()) }).Count -gt 0) { continue }
    if ((Test-Path -LiteralPath $oldPath -PathType Leaf) -and (Test-Path -LiteralPath (Join-Path $RootDir $f.now))) {
      try { Remove-Item -LiteralPath $oldPath -Force -ErrorAction Stop } catch { }
    }
  }
  # Scripts used to sit in a _system-scripts folder; the ZIP now keeps them in
  # _system itself. Drop the old folder once the new copies are in place.
  foreach ($legacy in @((Join-Path $RootDir '_system-scripts'), (Join-Path $SystemDir '_system-scripts'))) {
    if ((Test-Path -LiteralPath $legacy -PathType Container) -and (Test-Path -LiteralPath (Join-Path $SystemDir 'update-windows.ps1'))) {
      try { Remove-Item -LiteralPath $legacy -Recurse -Force -ErrorAction Stop } catch { }
    }
  }
}
Remove-ObsoleteFiles

# Read persisted port (server writes this after successful bind).
$portFile = Join-Path $SystemDir 'data\port.txt'
$port = 47371
if (Test-Path $portFile) {
  $p = (Get-Content $portFile -Raw).Trim()
  if ($p -match '^\d+$') { $port = [int]$p }
}

# Windows PowerShell 5.1 runs the system proxy auto-detect (WPAD) on every
# web request - including ones to 127.0.0.1 - and on a machine with a proxy,
# a VPN or a corporate network that costs about two seconds. Every time.
#
# This check used to ask for the page with -TimeoutSec 1, so it could never
# succeed: "Open App" always concluded the server was down, started a second
# copy of it, polled for the full timeout and then told the user it had
# failed - while the app was serving perfectly well the entire time, and the
# browser never opened. Measured 2026-09-23 against a real packaged install:
# 1s timeout = always fails; same request with the proxy off = 0.03s.
#
# Nothing in this script talks to anything but this machine, so the proxy is
# never wanted here.
[System.Net.WebRequest]::DefaultWebProxy = $null

# Is our server already up on that port?
function TestServerUp {
  param([int]$p)
  try {
    Invoke-WebRequest -Uri "http://127.0.0.1:$p/api/profile" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop | Out-Null
    return $true
  } catch { return $false }
}

if (TestServerUp -p $port) {
  Write-Host "  Server already running on port $port - opening browser..."
  Start-Process "http://localhost:$port/"
  exit 0
}

# Not running -> spawn it detached so the CMD window can close.
#
# v1.10.69 - the installer may have put Node.js inside the app folder rather
# than on the PC (it needs no admin rights that way), so look there before
# trusting PATH. 'node.exe' alone would be resolved by PATH only.
$NodeDir = Join-Path $SystemDir 'node'
$NodeExe = Join-Path $NodeDir 'node.exe'
if (-not (Test-Path $NodeExe)) {
  $onPath = Get-Command node -ErrorAction SilentlyContinue
  if ($onPath) { $NodeExe = $onPath.Source } else { $NodeExe = 'node.exe' }
}
Write-Host "  Starting server on port $port..."
Push-Location $SystemDir
Start-Process -FilePath $NodeExe -ArgumentList 'server.js' -WorkingDirectory $SystemDir -WindowStyle Hidden
Pop-Location

# Poll until the server responds. 15 seconds was not enough: the very first
# start after an install is cold - Windows Defender reads every one of the
# freshly written node_modules files as node loads them - and it can take
# the better part of a minute on an ordinary laptop. The user was shown a
# yellow "did not respond" warning and no browser, seconds before the app
# came up perfectly well behind it. Found by installing the real ZIP,
# 2026-09-23.
$deadline = (Get-Date).AddSeconds(90)
$announced = 0
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 400
  if (TestServerUp -p $port) {
    Start-Process "http://localhost:$port/"
    exit 0
  }
  # Say something every 10s so a slow first start does not look like a hang.
  $waited = [int]((Get-Date) - $deadline.AddSeconds(-90)).TotalSeconds
  if ($waited -ge $announced + 10) {
    $announced = $waited
    Write-Host "  Still starting... ($waited seconds. The first start after an update is the slow one.)"
  }
}

Write-Host ''
Write-Host '  The server has not answered in 90 seconds.' -ForegroundColor Yellow
Write-Host '  It may still be starting - try this address in your browser:'
Write-Host "  http://localhost:$port/"
Write-Host '  If that does not work, close this window and click Open App again.'
Read-Host '  Press Enter to close'
