# Free GST Billing - Windows backup.
#
# Zips the entire data/ folder into
#   %USERPROFILE%\Documents\FreeGSTBill Backups\YYYY-MM-DD_HH-mm-ss.zip
# Opens the folder in Explorer so the user knows where it went.

$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'Free GST Billing - Backup'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SystemDir = $ScriptDir
$dataDir = Join-Path $SystemDir 'data'

if (-not (Test-Path $dataDir)) {
  Write-Host '  No data folder found - nothing to back up.' -ForegroundColor Yellow
  Read-Host '  Press Enter to close'
  exit 0
}

$backupsHome = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'FreeGSTBill Backups'
if (-not (Test-Path $backupsHome)) { New-Item -ItemType Directory -Path $backupsHome | Out-Null }

$stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$out = Join-Path $backupsHome "backup-$stamp.zip"

Write-Host ''
Write-Host "  Backing up data folder -> $out ..."
Compress-Archive -Path "$dataDir\*" -DestinationPath $out -Force

$sizeMB = [Math]::Round((Get-Item $out).Length / 1MB, 2)
Write-Host ''
Write-Host "  [OK] Backup created - $sizeMB MB" -ForegroundColor Green
Write-Host "     $out"
Write-Host ''
Write-Host '  Opening backups folder in Explorer...'
Start-Process explorer.exe "/select,`"$out`""
Start-Sleep 1
exit 0
