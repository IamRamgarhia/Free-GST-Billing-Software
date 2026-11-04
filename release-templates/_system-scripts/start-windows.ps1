# Free GST Billing - Windows start-server + open-browser.
#
# Invoked by the HTA launcher's "Open App" button and by the
# Desktop shortcut. Idempotent - safe to click multiple times.
# If the server is already running on our chosen port, we just
# open the browser without spawning a duplicate node.exe.
#
# v1.10.83 - -AppWindow opens the app in its own window (Edge --app: no tabs,
# no address bar) instead of a browser tab; the one-line install's icons use
# it. -Hidden says nobody can see this console (the icon runs it hidden), so
# a problem re-opens this script in a window that shows it and waits.

#
# v1.10.84 - -NoWindow starts the server and opens nothing (the Windows Setup
# uses it after a silent update: the app's window is already open and
# reloads by itself).
# v1.10.84 - -PrintUrl starts (or finds) the server like the icon does, opens
# nothing and prints "URL=http://localhost:<port>/"; a problem is printed and
# the exit code is 1. The Setup's own window (Free GST Billing.exe) uses it.

param([switch]$AppWindow, [switch]$Hidden, [switch]$NoWindow, [switch]$PrintUrl)
if ($PrintUrl) { try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch { } }

$ErrorActionPreference = 'Continue'
$Host.UI.RawUI.WindowTitle = 'Free GST Billing - Server'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SystemDir = $ScriptDir

# v1.10.84 - the Windows Setup keeps the books (data, Saved Invoices, Trash)
# in the folder the user chose, named in home.txt; without home.txt they are
# next to this script, as in the ZIP (FGSB_HOME, if set, wins: the same order
# as server.js). installed.txt marks a Setup install: it carries its own
# Node.js and packages, and none of the ZIP tidy-ups apply.
$HomeDir = $SystemDir
$homeTxt = Join-Path $SystemDir 'home.txt'
if ($env:FGSB_HOME) { $HomeDir = $env:FGSB_HOME.Trim() }
elseif (Test-Path -LiteralPath $homeTxt) {
  $h = [string](Get-Content -LiteralPath $homeTxt -Encoding UTF8 -TotalCount 1)
  if ($h.Trim()) { $HomeDir = $h.Trim() }
}
$Installed = Test-Path -LiteralPath (Join-Path $SystemDir 'installed.txt')
function Get-NormPath([string]$p) {
  try { return ([IO.Path]::GetFullPath($p)).TrimEnd('\').ToLower() } catch { return $p.TrimEnd('\').ToLower() }
}
# A Setup copy never keeps books in its program folder (src/utils/appHome.js).
$HomeMissing = $Installed -and (-not $env:FGSB_HOME) -and ((Get-NormPath $HomeDir) -eq (Get-NormPath $SystemDir))

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
if (-not $Installed) { Move-ToRenamedLauncher }

# v1.10.83 - the Desktop and Start Menu icons open the app directly (see
# app-shortcut.ps1); before, the ZIP install's icons opened the launcher and
# needed a second click on Open App. An install that updates to this version
# keeps its old icons, so turn the ones that open THIS folder's launcher into
# app icons. Others (another copy, anything the user made) are left alone.
function Move-IconsToApp {
  if ((Split-Path -Leaf $SystemDir) -ne '_system') { return }
  $hta = Join-Path (Split-Path -Parent $SystemDir) 'Free GST Billing - WINDOWS.hta'
  try {
    . (Join-Path $SystemDir 'app-shortcut.ps1')
    $wsh = New-Object -ComObject WScript.Shell
    foreach ($dir in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))) {
      if (-not $dir -or -not (Test-Path -LiteralPath $dir)) { continue }
      foreach ($lnk in Get-ChildItem -LiteralPath $dir -Filter '*.lnk' -File -ErrorAction SilentlyContinue) {
        if (([string]$wsh.CreateShortcut($lnk.FullName).Arguments).Trim().Trim('"') -ne $hta) { continue }
        New-AppShortcut $lnk.FullName $SystemDir
      }
    }
  } catch {
    # The old icon still opens the launcher, which still works.
  }
}
if (-not $Installed) { Move-IconsToApp }

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
if (-not $Installed) { Remove-ObsoleteFiles }

# Read persisted port (server writes this after successful bind).
$portFile = Join-Path $HomeDir 'data\port.txt'
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
# v1.10.84 - and is it OURS? A server answers /api/version with the books
# folder it serves. A Setup copy opens only the server of its own books: after
# "Copy my books", an old icon may have started the OLD copy's server, and
# opening that would show the old books. A server too old to say (no "books")
# is accepted only by the ZIP, where it is this copy's previous version.
function TestServerUp {
  param([int]$p)
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:$p/api/version" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    $v = $r.Content | ConvertFrom-Json
    if (-not $v.current) { return $false }
    if (-not $v.books) { return (-not $Installed) }
    return ((Get-NormPath ([string]$v.books)) -eq (Get-NormPath $HomeDir))
  } catch { return $false }
}

# v1.10.83 - Edge is on every Windows 10 / 11 PC; its --app window has no tabs
# or address bar, so the app looks like a program. Otherwise: a browser tab.
# FREEGSTBILL_TEST (the installer's test mode) opens nothing.
function Open-App([int]$p) {
  $url = "http://localhost:$p/"
  if ($PrintUrl) { Write-Output "URL=$url"; return }
  if ($env:FREEGSTBILL_TEST -or $NoWindow) { Write-Host "  (not opening a window: $url)"; return }
  if ($AppWindow) {
    foreach ($d in @(${env:ProgramFiles(x86)}, $env:ProgramFiles, $env:LOCALAPPDATA)) {
      if (-not $d) { continue }
      $edge = Join-Path $d 'Microsoft\Edge\Application\msedge.exe'
      if (Test-Path -LiteralPath $edge) { Start-Process -FilePath $edge -ArgumentList "--app=$url"; return }
    }
  }
  Start-Process $url
}

# Stops with the problem on screen. Run hidden (from the icon), nobody would
# see it, so the same script is opened again in a normal window instead.
function Exit-WithProblem {
  if ($env:FREEGSTBILL_TEST -or $PrintUrl) { exit 1 }   # test mode / the app's window shows it: nobody to press Enter
  if ($Hidden) {
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -AppWindow"
    exit 1
  }
  Read-Host '  Press Enter to close'
  exit 1
}

if (TestServerUp -p $port) {
  Write-Host "  Server already running on port $port - opening the app..."
  Open-App $port
  exit 0
}

# Not running -> spawn it detached so the CMD window can close.
#
# v1.10.69 - the installer may have put Node.js inside the app folder rather
# than on the PC (it needs no admin rights that way), so look there before
# trusting PATH. 'node.exe' alone would be resolved by PATH only.
# v1.10.81 (#109) - only a Node.js new enough (see ensure-node.ps1): Node 6
# on PATH was started here and never answered.
# v1.10.84 - the books folder may be on a drive that is not connected.
if ($HomeMissing) {
  Write-Host "  home.txt in $SystemDir is missing or empty, so the app does not know where your books are." -ForegroundColor Yellow
  Write-Host '  Run Free-GST-Billing-Windows-Setup.exe again to repair it. Your books are not changed.'
  Exit-WithProblem
}
if (-not (Test-Path -LiteralPath $HomeDir)) {
  Write-Host "  The folder with your books is not there: $HomeDir" -ForegroundColor Yellow
  Write-Host '  If it is on a USB or network drive, connect it, then open the app again.'
  Exit-WithProblem
}
if ($Installed) {
  # v1.10.84 - the Setup put Node.js and the packages in place; nothing to fetch.
  $NodeExe = Join-Path $SystemDir 'node\node.exe'
  if (-not (Test-Path -LiteralPath $NodeExe)) {
    Write-Host "  $NodeExe is missing. Run Free-GST-Billing-Setup.exe again to repair the app (your books are kept)." -ForegroundColor Yellow
    Exit-WithProblem
  }
} else {
. (Join-Path $SystemDir 'ensure-node.ps1')
$NodeExe = Use-GoodNode
if (-not $NodeExe) { Exit-WithProblem }
}
# v1.10.83 - the ZIP ships complete packages, which work with any Node.js 18+;
# only a missing or half-done node_modules (an old npm, ERR-060) is redone.
if (-not $Installed -and -not (Test-PackagesReady)) {
  # The packages were installed by the old Node.js (or not at all): again.
  Write-Host '  Installing the app packages for this Node.js (one time)...'
  Reset-Packages
  if (-not (Test-InstallReady)) { Exit-WithProblem }
  Push-Location $SystemDir
  npm install --omit=dev --no-audit --no-fund --loglevel=error
  $npmCode = $LASTEXITCODE
  Pop-Location
  if ($npmCode -ne 0) {
    Show-InstallHelp
    Write-Host '  Then open the app again.'
    Exit-WithProblem
  }
}
# v1.10.83 - the icon runs this hidden, so during a slow first start people
# click it again. A server for this folder started in the last two minutes is
# still starting: wait for it instead of starting a second one on the same
# data (it would move to another port). An older one that never answered is
# stuck, and a new one is started as before. Two clicks a second apart both
# get here before either has started node, so only the run holding this
# folder's lock (held until this script ends) may start one.
$serverJs = (Join-Path $SystemDir 'server.js').ToLower()
$hash = [Security.Cryptography.SHA1]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($serverJs))
$folderId = 'FreeGSTBilling-' + (($hash[0..7] | ForEach-Object { $_.ToString('x2') }) -join '')
$startLock = New-Object System.Threading.Mutex($false, "Local\$folderId")
$haveLock = $false
try { $haveLock = $startLock.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $haveLock = $true }
# ERR-076 - "started in the last two minutes" is a time stamp in TEMP, written
# just before node is started. It used to be a WMI process query
# (Get-CimInstance), which on some PCs never answers: the script stopped
# there, with "Opening the app in your browser now..." the last line shown.
# It holds the process id of the server started then, and counts only while
# that very process (Get-Process, no WMI) is still running.
$startMark = Join-Path $env:TEMP "$folderId.starting"
$starting = $false
try {
  if ((Test-Path -LiteralPath $startMark) -and ((Get-Item -LiteralPath $startMark).LastWriteTime -gt (Get-Date).AddMinutes(-2))) {
    $markPid = (Get-Content -LiteralPath $startMark -Raw).Trim()
    $starting = ($markPid -match '^\d+$') -and [bool](Get-Process -Id ([int]$markPid) -ErrorAction SilentlyContinue)
  }
} catch { $starting = $false }
if (-not $haveLock -or $starting) {
  Write-Host '  The app is already starting - waiting for it...'
} else {
  Write-Host "  Starting server on port $port..."
  Push-Location $SystemDir
  # v1.10.83 - the full path, so the installer can tell this install's server
  # from any other node.exe when it has to stop it for an update.
  $server = Start-Process -FilePath $NodeExe -ArgumentList "`"$(Join-Path $SystemDir 'server.js')`"" -WorkingDirectory $SystemDir -WindowStyle Hidden -PassThru
  Pop-Location
  try { Set-Content -LiteralPath $startMark -Value $server.Id -ErrorAction Stop } catch { }
}

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
  # v1.10.83 - when the port is taken the server moves to a free one and
  # writes it to port.txt; without this, the first Open App waited 90 s on
  # the old port and gave up.
  if (Test-Path $portFile) {
    $p = (Get-Content $portFile -Raw -ErrorAction SilentlyContinue)
    if ($p -and $p.Trim() -match '^\d+$') { $port = [int]$p.Trim() }
  }
  if (TestServerUp -p $port) {
    Open-App $port
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
Write-Host '  If that does not work, close this window and open the app again.'
Exit-WithProblem
