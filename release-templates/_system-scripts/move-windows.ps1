# Free GST Billing — Windows "Move to Another PC" export.
#
# Zips just the data folder — matching the backup format — and drops
# it on the user's Desktop with a "MOVE" prefix + timestamp.
# User copies that file to the new PC (USB, email, drive), installs
# Free GST Billing there (fresh HTA launcher install), then uses
# Restore Backup to pull their invoices in.

$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'Free GST Billing — Move to Another PC'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SystemDir = $ScriptDir
$dataDir = Join-Path $SystemDir 'data'

if (-not (Test-Path $dataDir)) {
  Write-Host '  No data folder to export.' -ForegroundColor Yellow
  Read-Host '  Press Enter to close'
  exit 0
}

$desktop = [Environment]::GetFolderPath('Desktop')
$stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$out = Join-Path $desktop "MOVE-FreeGSTBill-$stamp.zip"

Write-Host ''
Write-Host "  Exporting your data → $out …"
Compress-Archive -Path "$dataDir\*" -DestinationPath $out -Force

$sizeMB = [Math]::Round((Get-Item $out).Length / 1MB, 2)
Write-Host ''
Write-Host "  ✅ Export ready — $sizeMB MB" -ForegroundColor Green
Write-Host "     $out"
Write-Host ''
Write-Host '  How to import on the new PC:'
Write-Host '    1. Install Free GST Billing on the new PC (double-click the HTA launcher there).'
Write-Host '    2. Copy this ZIP over (USB / email / drive).'
Write-Host '    3. Open the launcher on the new PC → click "♻ Restore Backup" → pick this ZIP.'
Write-Host ''
Start-Process explorer.exe "/select,`"$out`""
Start-Sleep 1
exit 0
