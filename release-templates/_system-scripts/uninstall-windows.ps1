# Free GST Billing - remove the app (Control Panel -> Remove the app).
#
# The server starts this from a temp copy and exits; this waits for it, then
# deletes. The program and its icons always go; -Data, -Pdfs and -Backups say
# what else goes. Whatever is kept stays in _system, so installing into the
# same folder again brings it all back.
param(
  [Parameter(Mandatory = $true)][string]$Sys,
  [int]$ServerPid = 0,
  [switch]$Data, [switch]$Pdfs, [switch]$Backups, [switch]$Detached
)

$ErrorActionPreference = 'SilentlyContinue'
$Sys = $Sys.TrimEnd('\')
if ((Split-Path -Leaf $Sys) -ne '_system' -or -not (Test-Path -LiteralPath (Join-Path $Sys 'server.js'))) { exit 1 }
$root = Split-Path -Parent $Sys

# Started by the server: start again through WMI, outside the server's process
# tree (a job that ends with the server would end this too), and report back.
if (-not $Detached) {
  $cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$PSCommandPath`" -Detached -Sys `"$Sys`" -ServerPid $ServerPid"
  if ($Data) { $cmd += ' -Data' }
  if ($Pdfs) { $cmd += ' -Pdfs' }
  if ($Backups) { $cmd += ' -Backups' }
  $r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd }
  if ($r -and $r.ReturnValue -eq 0) { exit 0 } else { exit 2 }
}

# Node.js locks its own files: wait for this server, then stop any other copy
# still running from this folder (same check as install.ps1's Stop-App).
if ($ServerPid) { Wait-Process -Id $ServerPid -Timeout 20 }
$nodes = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -OperationTimeoutSec 10 -ErrorAction SilentlyContinue)  # ERR-076: never wait for WMI forever
$ids = @($nodes | Where-Object { $_.CommandLine -and $_.CommandLine.ToLower().Contains((Join-Path $Sys 'server.js').ToLower()) } | ForEach-Object { $_.ProcessId })
$portFile = Join-Path $Sys 'data\port.txt'
$port = if (Test-Path -LiteralPath $portFile) { (Get-Content -LiteralPath $portFile -Raw).Trim() } else { '' }
if ($port -match '^\d+$') {
  foreach ($c in @(Get-NetTCPConnection -LocalPort ([int]$port) -State Listen)) {
    $ids += @($nodes | Where-Object { $_.ProcessId -eq $c.OwningProcess -and $_.CommandLine -match 'server\.js' } | ForEach-Object { $_.ProcessId })
  }
}
foreach ($id in @($ids | Where-Object { $_ } | Select-Object -Unique)) { Stop-Process -Id $id -Force }
Start-Sleep -Milliseconds 800

# Icons: every shortcut on the Desktop, in the Start menu or in Startup that
# opens something in this app folder.
$wsh = New-Object -ComObject WScript.Shell
$needle = $root.ToLower() + '\'
foreach ($dir in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('Startup'))) {
  if (-not $dir) { continue }
  foreach ($lnk in @(Get-ChildItem -LiteralPath $dir -Filter '*.lnk' -File)) {
    $sc = $wsh.CreateShortcut($lnk.FullName)
    if ("$($sc.TargetPath) $($sc.Arguments)".ToLower().Contains($needle)) { Remove-Item -LiteralPath $lnk.FullName -Force }
  }
}

# Data deleted but backups kept: one last copy first. If that copy fails the
# data is kept, never lost.
$backupHome = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'FreeGSTBill Backups'
$dataDir = Join-Path $Sys 'data'
if ($Data -and -not $Backups -and @(Get-ChildItem -LiteralPath $dataDir -Recurse -File -Force).Count) {
  New-Item -ItemType Directory -Path $backupHome -Force | Out-Null
  $last = Join-Path $backupHome "before-removal-$(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss').zip"
  Compress-Archive -Path (Join-Path $dataDir '*') -DestinationPath $last -Force
  if (-not (Test-Path -LiteralPath $last)) { $Data = $false }
}

$keep = @()
if (-not $Data) { $keep += 'data' }
if (-not $Pdfs) { $keep += 'Saved Invoices', 'Trash' }

# A file can be held for a moment (antivirus, a closing window): try a few times.
for ($try = 0; $try -lt 5; $try++) {
  Get-ChildItem -LiteralPath $Sys -Force | Where-Object { $keep -notcontains $_.Name } | Remove-Item -Recurse -Force
  # Only the app's own files beside _system; anything else there is the user's.
  Get-ChildItem -LiteralPath $root -Force | Where-Object { $_.Name -like 'Free GST Billing - *' -or $_.Name -eq 'READ ME FIRST.txt' } | Remove-Item -Recurse -Force
  if (-not @(Get-ChildItem -LiteralPath $Sys -Force | Where-Object { $keep -notcontains $_.Name }).Count) { break }
  Start-Sleep -Seconds 1
}
if ((Test-Path -LiteralPath $Sys) -and -not @(Get-ChildItem -LiteralPath $Sys -Force).Count) { Remove-Item -LiteralPath $Sys -Force }
if ((Test-Path -LiteralPath $root) -and -not @(Get-ChildItem -LiteralPath $root -Force).Count) { Remove-Item -LiteralPath $root -Force }
if ($Backups) { Remove-Item -LiteralPath $backupHome -Recurse -Force }

$left = @(Get-ChildItem -LiteralPath $Sys -Force | Where-Object { $keep -notcontains $_.Name })
if ($left.Count) {
  $wsh.Popup("Free GST Billing could not remove some of its files. Restart the computer, then delete this folder by hand:`n`n$root", 0, 'Free GST Billing', 48) | Out-Null
}
# The temp copy the server made; never the folder if run from _system by hand.
if ((Split-Path -Leaf $PSScriptRoot) -like 'fgsb-remove-*') { Remove-Item -LiteralPath $PSScriptRoot -Recurse -Force }
