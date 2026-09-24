# Free GST Billing - Windows installer.
#
# Invoked by the HTA launcher on first run. Idempotent - safe to
# re-run any time. Installs Node.js if missing, runs npm install
# inside _system/, and creates a Desktop shortcut pointing at the
# HTA launcher so the user never has to open the extract folder
# again.

$ErrorActionPreference = 'Continue'
$Host.UI.RawUI.WindowTitle = 'Free GST Billing - Installer'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SystemDir = $ScriptDir
$RootDir   = Split-Path -Parent $ScriptDir
$LauncherHTA = Join-Path $RootDir 'Free GST Billing - WINDOWS.hta'

Write-Host ''
Write-Host '  ============================================================'
Write-Host '   Free GST Billing Software - Installer'
Write-Host '  ============================================================'
Write-Host ''

# --- Step 1: Node.js check ---
# v1.10.69 - Node.js is installed INTO the app folder, not into Windows.
#
# This used to run the official .msi with /qn. That installer writes to
# C:\Program Files\nodejs, which needs administrator rights - and /qn means
# "fully silent", so Windows cannot even show the UAC prompt that would grant
# them. On a standard account, or a work laptop, or any PC where the user is
# not a local admin, it simply did nothing. The exit code was never checked,
# so the script marched on to npm install, which failed with
# "npm is not recognized" - and the person was told "npm install failed",
# which tells them nothing they can act on.
#
# The official portable ZIP needs no rights at all: unpack it next to the app
# and point PATH at it. Nothing is written outside this folder, no UAC prompt
# appears, and a Node.js the user already has is left completely alone.
$NodeDir = Join-Path $SystemDir 'node'
$NodeExe = Join-Path $NodeDir 'node.exe'

if (Test-Path $NodeExe) { $env:Path = "$NodeDir;$env:Path" }
$node = Get-Command node -ErrorAction SilentlyContinue

if (-not $node) {
  Write-Host '  Node.js is not on this PC - fetching it (about 30 MB, one time)...'
  $ver = 'v20.19.0'
  $arch = if ([Environment]::Is64BitOperatingSystem) { 'x64' } else { 'x86' }
  $name = "node-$ver-win-$arch"
  $tmpZip = Join-Path $env:TEMP "$name.zip"
  $tmpDir = Join-Path $env:TEMP "fgstbill-node-$([Guid]::NewGuid().ToString('N'))"
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri "https://nodejs.org/dist/$ver/$name.zip" -OutFile $tmpZip -UseBasicParsing
    Write-Host '  Unpacking...'
    Expand-Archive -Path $tmpZip -DestinationPath $tmpDir -Force
    if (Test-Path $NodeDir) { Remove-Item $NodeDir -Recurse -Force -ErrorAction SilentlyContinue }
    Move-Item (Join-Path $tmpDir $name) $NodeDir
    Remove-Item $tmpZip -Force -ErrorAction SilentlyContinue
    Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
    $env:Path = "$NodeDir;$env:Path"
  } catch {
    Write-Host ''
    Write-Host "  Could not download Node.js: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host '  Check your internet connection and run this again, or install Node.js'
    Write-Host '  yourself from https://nodejs.org (pick LTS) and then run this again.'
    Read-Host '  Press Enter to close'
    exit 1
  }

  # Never carry on assuming it worked - that is what produced the unhelpful
  # "npm install failed" before.
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    Write-Host ''
    Write-Host "  Node.js was downloaded but will not run from $NodeDir." -ForegroundColor Red
    Write-Host '  Your antivirus may have removed it. Add this folder to its exclusions,'
    Write-Host '  or install Node.js from https://nodejs.org and run this again.'
    Read-Host '  Press Enter to close'
    exit 1
  }
  Write-Host "  Node.js $(& node -v) is ready (inside the app folder - nothing else on your PC was changed)."
}

# --- Step 2: npm install inside _system/ ---
Write-Host ''
Write-Host '  Installing app dependencies (npm install)...'
Push-Location $SystemDir
try {
  npm install --omit=dev --no-audit --no-fund --loglevel=error
  if ($LASTEXITCODE -ne 0) { throw "npm install exited $LASTEXITCODE" }
} catch {
  Write-Host ''
  Write-Host "  ERROR: could not install the app's dependencies." -ForegroundColor Red
  Write-Host '  This is almost always no internet, or a proxy blocking npm.'
  Write-Host '  Check the connection and run this again - it carries on where it stopped.'
  Pop-Location
  Read-Host '  Press Enter to close'
  exit 1
}
Pop-Location

# --- Step 3: Desktop shortcut ---
Write-Host ''
Write-Host '  Creating Desktop shortcut...'
try {
  $desktop = [Environment]::GetFolderPath('Desktop')
  $shortcutPath = Join-Path $desktop 'Free GST Billing.lnk'
  $wsh = New-Object -ComObject WScript.Shell
  $sc = $wsh.CreateShortcut($shortcutPath)
  # Point the shortcut at mshta.exe with the HTA as its argument.
  # This way double-clicking the shortcut always opens the launcher
  # even if the user later associates .hta with something else.
  $sc.TargetPath = 'mshta.exe'
  $sc.Arguments = "`"$LauncherHTA`""
  $sc.WorkingDirectory = $RootDir
  $iconPath = Join-Path $SystemDir 'app-icon.ico'
  if (Test-Path $iconPath) { $sc.IconLocation = $iconPath }
  $sc.Description = 'Free GST Billing Software - open the launcher'
  $sc.Save()
  Write-Host "  Desktop shortcut created: $shortcutPath"
} catch {
  Write-Host "  WARNING: could not create Desktop shortcut ($($_.Exception.Message)). You can still launch by double-clicking the HTA."
}

# --- Step 4: Start Menu shortcut (Programs list) ---
try {
  $startMenu = Join-Path ([Environment]::GetFolderPath('Programs')) 'Free GST Billing.lnk'
  $wsh = New-Object -ComObject WScript.Shell
  $sc = $wsh.CreateShortcut($startMenu)
  $sc.TargetPath = 'mshta.exe'
  $sc.Arguments = "`"$LauncherHTA`""
  $sc.WorkingDirectory = $RootDir
  $iconPath = Join-Path $SystemDir 'app-icon.ico'
  if (Test-Path $iconPath) { $sc.IconLocation = $iconPath }
  $sc.Description = 'Free GST Billing Software'
  $sc.Save()
} catch { }

# --- Step 5: Hide _system folder so root looks clean ---
try {
  attrib +H "$SystemDir" 2>$null
} catch { }

# --- Step 6: give the app folder our icon ---
# Windows will not let a .hta, .sh or .command file carry its own icon - a
# file gets whatever its TYPE is registered with, and only .exe, .ico, .lnk
# and folders can say otherwise. A folder can, through desktop.ini, and only
# when the folder itself is marked read-only or system. So the one icon we
# are allowed to set here, we set: the install folder stops looking like a
# nameless yellow folder full of files Windows has no idea about.
try {
  $iconFile = Join-Path $SystemDir 'app-icon.ico'
  if (Test-Path $iconFile) {
    $ini = Join-Path $RootDir 'desktop.ini'
    $lines = @(
      '[.ShellClassInfo]',
      'IconResource=_system\app-icon.ico,0',
      'InfoTip=Free GST Billing Software - open the launcher inside'
    )
    Set-Content -Path $ini -Value $lines -Encoding ASCII -Force
    attrib +H +S "$ini" 2>$null
    # The folder needs one of these bits before the shell reads desktop.ini.
    # +R on a folder is only this marker; it does not make anything inside
    # read-only.
    attrib +R "$RootDir" 2>$null
  }
} catch { }

Write-Host ''
Write-Host '  ============================================================'
Write-Host '   [OK] Install complete!' -ForegroundColor Green
Write-Host '  ============================================================'
Write-Host ''
Write-Host '  Opening the app in your browser now...'
Write-Host ''
Write-Host '  Next time, use the Free GST Billing shortcut on your Desktop.'
Write-Host ''

# v1.10.69 - finish the job. Leaving a console window saying "now go and
# click Open App" is one step too many for someone who has never installed
# anything but an .exe: they saw a black window, it said OK, and nothing
# happened. Start the server and open the browser ourselves. This runs for
# the launcher path and for the one-command install alike.
$starter = Join-Path $SystemDir 'start-windows.ps1'
if (Test-Path $starter) {
  & $starter
} else {
  Write-Host '  Could not find start-windows.ps1 - open the launcher and click Open App.'
  Read-Host '  Press Enter to close'
}
