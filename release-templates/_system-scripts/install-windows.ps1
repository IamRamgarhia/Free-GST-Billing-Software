# Free GST Billing — Windows installer.
#
# Invoked by the HTA launcher on first run. Idempotent — safe to
# re-run any time. Installs Node.js if missing, runs npm install
# inside _system/, and creates a Desktop shortcut pointing at the
# HTA launcher so the user never has to open the extract folder
# again.

$ErrorActionPreference = 'Continue'
$Host.UI.RawUI.WindowTitle = 'Free GST Billing — Installer'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SystemDir = $ScriptDir
$RootDir   = Split-Path -Parent $ScriptDir
$LauncherHTA = Join-Path $RootDir 'Free GST Billing.hta'

Write-Host ''
Write-Host '  ============================================================'
Write-Host '   Free GST Billing Software — Installer'
Write-Host '  ============================================================'
Write-Host ''

# --- Step 1: Node.js check ---
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Host '  Node.js not found — downloading the LTS installer…'
  $tmp = Join-Path $env:TEMP 'node-lts-x64.msi'
  try {
    Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.19.0/node-v20.19.0-x64.msi' -OutFile $tmp -UseBasicParsing
    Write-Host '  Running Node.js installer (silent)…'
    Start-Process msiexec.exe -ArgumentList "/i `"$tmp`" /qn /norestart" -Wait
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    # Refresh PATH so the current session picks up node.exe without a reboot.
    $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
  } catch {
    Write-Host ''
    Write-Host "  ERROR: Node.js download failed. Manually install from https://nodejs.org and re-run this installer." -ForegroundColor Red
    Read-Host '  Press Enter to close'
    exit 1
  }
}

# --- Step 2: npm install inside _system/ ---
Write-Host ''
Write-Host '  Installing app dependencies (npm install)…'
Push-Location $SystemDir
try {
  npm install --omit=dev --no-audit --no-fund --loglevel=error
  if ($LASTEXITCODE -ne 0) { throw "npm install exited $LASTEXITCODE" }
} catch {
  Write-Host ''
  Write-Host "  ERROR: npm install failed. See above." -ForegroundColor Red
  Pop-Location
  Read-Host '  Press Enter to close'
  exit 1
}
Pop-Location

# --- Step 3: Desktop shortcut ---
Write-Host ''
Write-Host '  Creating Desktop shortcut…'
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
  $sc.Description = 'Free GST Billing Software — open the launcher'
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

Write-Host ''
Write-Host '  ============================================================'
Write-Host '   ✅ Install complete!' -ForegroundColor Green
Write-Host '  ============================================================'
Write-Host ''
Write-Host '  What to do next:'
Write-Host '   1. Close this window.'
Write-Host '   2. Double-click the Desktop shortcut, or the HTA launcher.'
Write-Host '   3. Click "Open App" and start billing.'
Write-Host ''
Read-Host '  Press Enter to close'
