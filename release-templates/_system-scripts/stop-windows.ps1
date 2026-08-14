# Free GST Billing — Windows stop-server.
#
# Finds any node.exe process listening on our port and kills it.
# Safe if nothing is running (no error, quick exit).

$ErrorActionPreference = 'SilentlyContinue'
$Host.UI.RawUI.WindowTitle = 'Free GST Billing — Stop Server'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$portFile = Join-Path $ScriptDir 'data\port.txt'
$port = 47371
if (Test-Path $portFile) {
  $p = (Get-Content $portFile -Raw).Trim()
  if ($p -match '^\d+$') { $port = [int]$p }
}

$conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if (-not $conn) {
  Write-Host "  Server is not running on port $port."
  Start-Sleep 1
  exit 0
}

$owningPid = $conn | Select-Object -ExpandProperty OwningProcess -First 1
if ($owningPid) {
  Stop-Process -Id $owningPid -Force
  Write-Host "  Stopped server on port $port (PID $owningPid)."
}
Start-Sleep 1
exit 0
