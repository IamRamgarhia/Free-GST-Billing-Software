# Free GST Billing - Windows updater.
#
# Pulls the latest release ZIP from GitHub, extracts _system/ over
# the existing one, re-runs npm install. Data folder is preserved.
#
# Design decisions:
#   * Data folder never touched - user's invoices survive updates
#   * We fetch by tag_name from GitHub Releases so users always get
#     the latest published release, not a random dev commit
#   * Pre-update, we snapshot data/ to a timestamped backup as a
#     safety net - even though we don't touch data, hardware faults
#     during rmdir could corrupt state

$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'Free GST Billing - Update'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SystemDir = $ScriptDir
$RootDir   = Split-Path -Parent $ScriptDir

Write-Host ''
Write-Host '  ============================================================'
Write-Host '   Free GST Billing Software - Update'
Write-Host '  ============================================================'
Write-Host ''

# --- Step 1: Belt-and-braces backup of data folder BEFORE anything ---
$dataDir = Join-Path $SystemDir 'data'
if (Test-Path $dataDir) {
  $backupsHome = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'FreeGSTBill Backups'
  if (-not (Test-Path $backupsHome)) { New-Item -ItemType Directory -Path $backupsHome | Out-Null }
  $stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
  $preUpdateBackup = Join-Path $backupsHome "pre-update-$stamp.zip"
  Write-Host "  Backing up your data to $preUpdateBackup ..."
  Compress-Archive -Path "$dataDir\*" -DestinationPath $preUpdateBackup -Force
}

# --- Step 2: Find latest release ---
Write-Host '  Checking latest release from GitHub...'
try {
  $api = Invoke-RestMethod -Uri 'https://api.github.com/repos/IamRamgarhia/Free-GST-Billing-Software/releases/latest' -Headers @{ 'User-Agent' = 'FreeGSTBill-Updater' }
  $tag = $api.tag_name
  $zipAsset = $api.assets | Where-Object { $_.name -like '*.zip' } | Select-Object -First 1
  if (-not $zipAsset) {
    # Fall back to source-code ZIP if no release asset uploaded
    $zipUrl = $api.zipball_url
  } else {
    $zipUrl = $zipAsset.browser_download_url
  }
  Write-Host "  Latest: $tag"
} catch {
  Write-Host "  ERROR: could not reach GitHub. Are you online?" -ForegroundColor Red
  Read-Host '  Press Enter to close'
  exit 1
}

# --- Step 3: Download + extract to a staging folder ---
$tmp = Join-Path $env:TEMP "fgstbill-update-$([Guid]::NewGuid().ToString('N').Substring(0,8))"
New-Item -ItemType Directory -Path $tmp | Out-Null
$zipPath = Join-Path $tmp 'update.zip'
Write-Host '  Downloading update...'
Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing

Write-Host '  Extracting...'
Expand-Archive -Path $zipPath -DestinationPath $tmp -Force

# The extract may contain either the pretty release structure
# (root has Free GST Billing.hta + _system/) or the source zipball
# (root has IamRamgarhia-Free-GST-Billing-Software-HASH/).
$extracted = Get-ChildItem -Path $tmp -Directory | Select-Object -First 1
$candidateSystem = Join-Path $extracted.FullName '_system'
if (Test-Path $candidateSystem) {
  $sourceRoot = $extracted.FullName
  $newSystem  = $candidateSystem
} else {
  # Zipball layout - treat the extracted folder itself as the "new _system"
  $sourceRoot = $extracted.FullName
  $newSystem  = $extracted.FullName
}

# --- Step 4: Copy everything EXCEPT data/ over the current _system/ ---
Write-Host '  Applying update (your data folder is untouched)...'
Get-ChildItem -Path $newSystem -Force | Where-Object { $_.Name -ne 'data' -and $_.Name -ne 'node_modules' } | ForEach-Object {
  $dest = Join-Path $SystemDir $_.Name
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force -ErrorAction SilentlyContinue }
  Copy-Item -Path $_.FullName -Destination $dest -Recurse -Force
}
# If the new release ships new launcher/HTA files at root, refresh those too
Get-ChildItem -Path $sourceRoot -File | Where-Object { $_.Extension -match '\.(hta|command|sh)$' -or $_.Name -match '^Free GST Billing' } | ForEach-Object {
  Copy-Item -Path $_.FullName -Destination (Join-Path $RootDir $_.Name) -Force
}

# --- Step 5: Reinstall dependencies (safest - new package.json may add packages) ---
Write-Host '  Re-installing dependencies...'
Push-Location $SystemDir
npm install --omit=dev --no-audit --no-fund --loglevel=error
Pop-Location

# --- Cleanup ---
Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue

Write-Host ''
Write-Host '  [OK] Update complete!' -ForegroundColor Green
Write-Host '  Restart the app (Stop Server -> Open App) to run the new version.'
Write-Host ''
Read-Host '  Press Enter to close'
