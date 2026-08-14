# Free GST Billing — Windows restore-from-backup.
#
# Prompts for a backup ZIP via a file-picker dialog. Snapshots
# CURRENT data/ first as safety net, then extracts the backup ZIP
# on top. Never destructive without a pre-restore snapshot.

$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'Free GST Billing — Restore'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SystemDir = $ScriptDir
$dataDir = Join-Path $SystemDir 'data'

Add-Type -AssemblyName System.Windows.Forms

$dlg = New-Object System.Windows.Forms.OpenFileDialog
$dlg.Title = 'Select a Free GST Billing backup ZIP'
$dlg.Filter = 'ZIP files (*.zip)|*.zip'
$dlg.InitialDirectory = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'FreeGSTBill Backups'
if ($dlg.ShowDialog() -ne 'OK') {
  Write-Host '  Cancelled.'
  exit 0
}
$zipPath = $dlg.FileName

# --- Safety snapshot of current data folder ---
if (Test-Path $dataDir) {
  $backupsHome = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'FreeGSTBill Backups'
  if (-not (Test-Path $backupsHome)) { New-Item -ItemType Directory -Path $backupsHome | Out-Null }
  $stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
  $preRestore = Join-Path $backupsHome "pre-restore-$stamp.zip"
  Write-Host "  Snapshotting current data → $preRestore …"
  Compress-Archive -Path "$dataDir\*" -DestinationPath $preRestore -Force
}

# --- Wipe & extract ---
Write-Host '  Extracting backup into data folder…'
if (Test-Path $dataDir) { Remove-Item -Recurse -Force "$dataDir\*" }
else { New-Item -ItemType Directory -Path $dataDir | Out-Null }
Expand-Archive -Path $zipPath -DestinationPath $dataDir -Force

Write-Host ''
Write-Host '  ✅ Restore complete!' -ForegroundColor Green
Write-Host '  Restart the app to see the restored data.'
Read-Host '  Press Enter to close'
