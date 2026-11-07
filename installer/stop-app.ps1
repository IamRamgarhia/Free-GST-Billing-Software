# Free GST Billing - stop ONE copy's server (v1.10.84).
#
# Run by the Windows Setup before it replaces the program files or copies the
# books of an earlier copy, and by the uninstaller. It stops only the node.exe
# of that copy, found by its process id - never "all node.exe":
#   1. data\server.lock in the books folder (the server's own id, v1.10.84+)
#   2. the TEMP file start-windows.ps1 writes for the server it started (ERR-076)
#   3. a node.exe whose command line names this copy's server.js (WMI, with a
#      time limit: ERR-076)
#   4. outside the Setup's test mode: the node.exe listening on the books'
#      port whose command line runs a server.js (older launchers started
#      "node server.js" with no folder)
# It only reads files; it never writes or deletes anything.
#
#   -Sys   the folder holding server.js
#   -Books the books folder (default: home.txt in -Sys, else -Sys)
#   -Test  the Setup's test mode (also when installed.txt says so)
#   -Out   write "stopped=..." to this file (Setup runs this with -File and
#          separate arguments, never a -Command string: a folder name with
#          curly quotes cannot break or change the command)
#   -CloseWindow  also close the app's own window (Free GST Billing.exe) of
#          THIS program folder, also when it is hidden near the clock: its
#          "close" event first, then by its id (uninstall only: an update
#          leaves the window open and it reloads)
#
# Keep this file pure ASCII (ERR-001).

param([Parameter(Mandatory = $true)][string]$Sys, [string]$Books = '', [switch]$Test, [string]$Out = '', [switch]$CloseWindow)

$ErrorActionPreference = 'SilentlyContinue'
$Sys = $Sys.TrimEnd('\')

$closed = ''
if ($CloseWindow) {
  # Only windows whose exe is in this folder (an update may have renamed it to *.old).
  $wins = @(Get-Process -Name 'Free GST Billing' -ErrorAction SilentlyContinue | Where-Object { $_.Path -and ((Split-Path -Parent $_.Path).TrimEnd('\') -eq $Sys) })
  # The window listens for this (installer\host\FreeGSTBilling.cs: the same name rule).
  # Closing it by message would only hide it near the clock.
  $h = [Security.Cryptography.SHA1]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($Sys.ToLowerInvariant()))
  $evName = 'Local\FreeGSTBillingHost-' + (($h[0..7] | ForEach-Object { $_.ToString('x2') }) -join '') + '-close'
  try { $ev = [System.Threading.EventWaitHandle]::OpenExisting($evName); [void]$ev.Set(); $ev.Dispose() } catch { }
  $deadline = (Get-Date).AddSeconds(5)
  while ((Get-Date) -lt $deadline -and @($wins | Where-Object { -not $_.HasExited }).Count) { Start-Sleep -Milliseconds 250 }
  foreach ($w in $wins) { if (-not $w.HasExited) { Stop-Process -Id $w.Id -Force -ErrorAction SilentlyContinue } }
  # Its web engine (msedgewebview2.exe) lets go of the profile folder a moment later.
  if ($wins.Count) { Start-Sleep -Seconds 2; $closed = " window=" + (($wins | ForEach-Object { $_.Id }) -join ',') }
}
if (-not $Books) {
  $Books = $Sys
  $homeTxt = Join-Path $Sys 'home.txt'
  if (Test-Path -LiteralPath $homeTxt) {
    $h = [string](Get-Content -LiteralPath $homeTxt -Encoding UTF8 -TotalCount 1)
    if ($h.Trim()) { $Books = $h.Trim() }
  }
}
$installedTxt = Join-Path $Sys 'installed.txt'
if ((Test-Path -LiteralPath $installedTxt) -and ((Get-Content -LiteralPath $installedTxt -Raw) -match 'testroot=')) { $Test = $true }

function Test-IsNode([int]$id) {
  $p = Get-Process -Id $id -ErrorAction SilentlyContinue
  return [bool]($p -and $p.ProcessName -eq 'node')
}

# Process ids listening on a TCP port (netstat: no WMI). A listener is the
# line whose remote end is 0.0.0.0:0, whatever its state word: some Windows
# builds (seen on 10.0.28020) print a listening socket as CLOSED, and the
# state word is translated on other languages' Windows.
function Get-Listeners([string]$port) {
  $owners = @()
  foreach ($line in @(netstat -ano -p TCP)) {
    if ($line -match ('^\s*TCP\s+\S+:' + $port + '\s+0\.0\.0\.0:0\s+\S+\s+(\d+)\s*$')) { $owners += [int]$Matches[1] }
  }
  return $owners
}

$ids = @()
$why = @()

# 1. The lock the server keeps in its data folder. Its process must still be
# serving the lock's port: a process id can be reused by another program.
$lockFile = Join-Path $Books 'data\server.lock'
if (Test-Path -LiteralPath $lockFile) {
  try {
    $lock = Get-Content -LiteralPath $lockFile -Raw | ConvertFrom-Json
    $lp = [int]$lock.pid
    # Another PC's lock (books on a shared drive): its process id means nothing here.
    $here = (-not $lock.host) -or ([string]$lock.host -eq [System.Net.Dns]::GetHostName())
    if ($here -and $lp -and $lock.port -and (Test-IsNode $lp) -and (@(Get-Listeners ([string]$lock.port)) -contains $lp)) { $ids += $lp; $why += "lock file: $lp" }
  } catch { }
}

# 2. start-windows.ps1's "already starting" file in TEMP (same name rule).
# Only a recent one, like start-windows.ps1 itself (a process id is reused).
$serverJs = (Join-Path $Sys 'server.js').ToLower()
$hash = [Security.Cryptography.SHA1]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($serverJs))
$mark = Join-Path $env:TEMP ('FreeGSTBilling-' + (($hash[0..7] | ForEach-Object { $_.ToString('x2') }) -join '') + '.starting')
if ((Test-Path -LiteralPath $mark) -and ((Get-Item -LiteralPath $mark).LastWriteTime -gt (Get-Date).AddMinutes(-10))) {
  $p = ([string](Get-Content -LiteralPath $mark -Raw)).Trim()
  if ($p -match '^\d+$' -and (Test-IsNode ([int]$p))) { $ids += [int]$p; $why += "TEMP start file: $p" }
}

# 3. Its command line names this copy's server.js.
$nodes = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -OperationTimeoutSec 10 -ErrorAction SilentlyContinue)
foreach ($n in $nodes) {
  if ($n.CommandLine -and $n.CommandLine.ToLower().Contains($serverJs)) { $ids += [int]$n.ProcessId; $why += "command line: $($n.ProcessId)" }
}

# 4. Older launchers: the node.exe serving this copy's port.
if (-not $Test) {
  $portFile = Join-Path $Books 'data\port.txt'
  $port = if (Test-Path -LiteralPath $portFile) { ([string](Get-Content -LiteralPath $portFile -Raw)).Trim() } else { '' }
  if ($port -match '^\d+$') {
    foreach ($owner in @(Get-Listeners $port)) {
      foreach ($n in $nodes) {
        if ($n.ProcessId -eq $owner -and $n.CommandLine -match 'server\.js') { $ids += $owner; $why += "port $port`: $owner" }
      }
    }
  }
}

$ids = @($ids | Select-Object -Unique)
foreach ($id in $ids) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }
# Wait (up to 10 s) until they are gone, so their files can be replaced.
$deadline = (Get-Date).AddSeconds(10)
while ((Get-Date) -lt $deadline -and @($ids | Where-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue }).Count) { Start-Sleep -Milliseconds 250 }
$result = $(if ($ids.Count) { "stopped=" + ($ids -join ',') + " (" + ($why -join '; ') + ")" } else { 'stopped=none' }) + $closed
if ($Out) { Set-Content -LiteralPath $Out -Value $result -Encoding UTF8 }
Write-Output $result
exit 0
