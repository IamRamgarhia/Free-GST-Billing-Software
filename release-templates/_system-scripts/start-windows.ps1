# Free GST Billing — Windows start-server + open-browser.
#
# Invoked by the HTA launcher's "Open App" button and by the
# Desktop shortcut. Idempotent — safe to click multiple times.
# If the server is already running on our chosen port, we just
# open the browser without spawning a duplicate node.exe.

$ErrorActionPreference = 'Continue'
$Host.UI.RawUI.WindowTitle = 'Free GST Billing — Server'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SystemDir = $ScriptDir

# Read persisted port (server writes this after successful bind).
$portFile = Join-Path $SystemDir 'data\port.txt'
$port = 47371
if (Test-Path $portFile) {
  $p = (Get-Content $portFile -Raw).Trim()
  if ($p -match '^\d+$') { $port = [int]$p }
}

# Is our server already up on that port?
function TestServerUp {
  param([int]$p)
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:$p/api/profile" -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop
    return $true
  } catch { return $false }
}

if (TestServerUp -p $port) {
  Write-Host "  Server already running on port $port — opening browser…"
  Start-Process "http://localhost:$port/"
  exit 0
}

# Not running → spawn it detached so the CMD window can close.
Write-Host "  Starting server on port $port…"
Push-Location $SystemDir
Start-Process -FilePath 'node.exe' -ArgumentList 'server.js' -WindowStyle Hidden
Pop-Location

# Poll until the server responds, up to ~15 seconds. Then open browser.
$deadline = (Get-Date).AddSeconds(15)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 400
  if (TestServerUp -p $port) {
    Start-Process "http://localhost:$port/"
    exit 0
  }
}

Write-Host ''
Write-Host '  Server did not respond in 15s. Check for errors in this window.' -ForegroundColor Yellow
Write-Host '  Try re-running the launcher, or open the URL manually:'
Write-Host "  http://localhost:$port/"
Read-Host '  Press Enter to close'
