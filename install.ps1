# Free GST Billing - one-line install, update and repair for Windows.
#
#   Press Windows + R, paste this line, press Enter:
#   powershell -ExecutionPolicy Bypass -c "[Net.ServicePointManager]::SecurityProtocol='Tls12'; irm https://raw.githubusercontent.com/IamRamgarhia/Free-GST-Billing-Software/main/install.ps1 | iex"
#
# v1.10.83 - a file PowerShell fetches carries no "downloaded from the
# internet" mark, so Windows SmartScreen shows no warning; and the release
# ZIP now carries its own packages, so nothing here runs npm. The same line
# installs, updates an existing install in place (its data is backed up first
# and never touched), or repairs a half-done one. No administrator rights, no
# registry, no service: everything stays under the user's own profile.
#
# To remove the app (it asks before deleting any data):
#   powershell -ExecutionPolicy Bypass -c "[Net.ServicePointManager]::SecurityProtocol='Tls12'; & ([scriptblock]::Create((irm https://raw.githubusercontent.com/IamRamgarhia/Free-GST-Billing-Software/main/install.ps1))) -Uninstall"
#
# `iex` cannot pass parameters, so settings come from environment variables:
#   FREEGSTBILL_DIR   install into (or update) this folder
#   FREEGSTBILL_ZIP   use this local release ZIP instead of downloading
#   FREEGSTBILL_TEST  a folder: icons are made there instead of on the Desktop
#                     and Start menu, backups go there, nothing is asked and
#                     the app window is not opened (for testing)
#   FREEGSTBILL_PORT  the first port a NEW install tries (default 47371)
#
# Keep this file pure ASCII: Windows PowerShell 5.1 misreads anything else
# (ERR-001).

param([switch]$Uninstall)

$ErrorActionPreference = 'Stop'
# Windows PowerShell 5.1 downloads about ten times slower while it draws its
# own progress bar; this script prints its own.
$ProgressPreference = 'SilentlyContinue'
# PowerShell 5.1 may still default to TLS 1.0, which GitHub refuses.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$ZipUrl = 'https://github.com/IamRamgarhia/Free-GST-Billing-Software/releases/latest/download/Free-GST-Billing.zip'
$Test = $env:FREEGSTBILL_TEST
$NeedFreeMB = 600   # the ZIP, its unpacked copy, Node.js, and room to spare
$script:KnownProblem = $false

function Step([string]$text) { Write-Host -NoNewline "  $text ... " }
function Ok([string]$extra = '') { Write-Host "OK $extra" -ForegroundColor Green }

# Stops the install with what went wrong and what to do about it.
function Fail([string]$what, [string]$todo) {
  $script:KnownProblem = $true
  throw "$what`n    $todo"
}

function Ask([string]$question) {
  if ($Test) { return $false }
  try { $a = Read-Host "        $question Type Y and press Enter (just Enter = no)" } catch { return $false }
  return $a -match '^\s*[Yy]'
}

function Get-IconFolders {
  if ($Test) {
    return @{ Desktop = (Join-Path $Test 'Desktop'); Programs = (Join-Path $Test 'Programs'); Startup = (Join-Path $Test 'Startup') }
  }
  return @{ Desktop = [Environment]::GetFolderPath('Desktop'); Programs = [Environment]::GetFolderPath('Programs'); Startup = [Environment]::GetFolderPath('Startup') }
}

# The app folder a "Free GST Billing" shortcut opens. The launcher's runs
# "...\Free GST Billing - WINDOWS.hta", this installer's runs
# "...\_system\start-windows.ps1": the first quoted path either way.
function Get-LinkRoot([string]$lnk) {
  $a = [string](New-Object -ComObject WScript.Shell).CreateShortcut($lnk).Arguments
  $p = if ($a -match '"([^"]+)"') { $Matches[1] } else { $a.Trim() }
  if (-not $p) { return $null }
  $r = Split-Path -Parent $p
  if ((Split-Path -Leaf $r) -eq '_system') { $r = Split-Path -Parent $r }
  return $r.TrimEnd('\')
}

# Where the app is, or goes. The shortcuts first (an install from the ZIP can
# be anywhere: updating it keeps every invoice together, ERR-038), then the
# usual folder.
function Find-Install {
  if ($env:FREEGSTBILL_DIR) { return $env:FREEGSTBILL_DIR.TrimEnd('\') }
  $f = Get-IconFolders
  foreach ($dir in @($f.Desktop, $f.Programs)) {
    # One unreadable shortcut must not stop the other being checked.
    try {
      $lnk = Join-Path $dir 'Free GST Billing.lnk'
      if (-not (Test-Path -LiteralPath $lnk)) { continue }
      $r = Get-LinkRoot $lnk
      if ($r -and (Test-Path -LiteralPath (Join-Path $r '_system\server.js'))) { return $r }
    } catch { }
  }
  return (Join-Path $env:LOCALAPPDATA 'Programs\Free GST Billing')
}

function Test-Writable([string]$dir) {
  try {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    $probe = Join-Path $dir ".write-test-$([Guid]::NewGuid().ToString('N'))"
    Set-Content -LiteralPath $probe -Value 'ok' -ErrorAction Stop
    Remove-Item -LiteralPath $probe -Force
    return $true
  } catch { return $false }
}

# Free space on the drive of $dir, in MB. Get-PSDrive's Free is empty on some
# PCs, which read as 0 MB and refused to install on a nearly empty drive:
# ask Windows directly, and a value that cannot be read never blocks.
function Get-FreeMB([string]$dir) {
  $free = $null
  try { $free = ([IO.DriveInfo]::new([IO.Path]::GetPathRoot($dir))).AvailableFreeSpace } catch { $free = $null }
  if ($null -eq $free -or $free -le 0) { try { $free = (Get-PSDrive -Name $dir.Substring(0, 1) -ErrorAction Stop).Free } catch { $free = $null } }
  if ($null -eq $free -or $free -le 0) { return [int]::MaxValue }
  return [int]($free / 1MB)
}

function Test-Online {
  try {
    $null = Invoke-WebRequest -Uri 'https://github.com' -Method Head -UseBasicParsing -TimeoutSec 20 -ErrorAction Stop
    return $true
  } catch { return $false }
}

# Downloads with a running "x of y MB", so a slow line does not look stuck.
function Save-Url([string]$url, [string]$out) {
  try {
    $req = [Net.HttpWebRequest]::Create($url)
    $req.UserAgent = 'FreeGSTBill-Installer'
    if ($req.Proxy) { $req.Proxy.Credentials = [Net.CredentialCache]::DefaultCredentials }
    $res = $req.GetResponse()
  } catch {
    Write-Host ''
    Fail 'The app could not be downloaded from GitHub.' 'Check the internet connection (open any website), then run the same line again.'
  }
  $total = $res.ContentLength
  $totalMB = [math]::Max(1, [math]::Round($total / 1MB))
  Write-Host "  [2/4] Downloading ($totalMB MB) ..."
  $done = 0L
  try {
    $in = $res.GetResponseStream()
    $fs = [IO.File]::Create($out)
    try {
      $buf = New-Object byte[] 262144
      $shown = -1
      while (($n = $in.Read($buf, 0, $buf.Length)) -gt 0) {
        $fs.Write($buf, 0, $n)
        $done += $n
        $mb = [math]::Floor($done / 1MB)
        if ($mb -ne $shown) { $shown = $mb; Write-Host -NoNewline "`r        $mb of $totalMB MB " }
      }
    } finally { $fs.Close(); $in.Close() }
  } catch {
    Write-Host ''
    Fail 'The download stopped part way.' 'Check the internet connection, then run the same line again.'
  } finally { $res.Close() }
  if ($total -gt 0 -and $done -ne $total) { Write-Host ''; Fail 'The download stopped part way.' 'Check the internet connection, then run the same line again.' }
  Write-Host -NoNewline "`r        "
  Ok "($totalMB MB)   "
}

# Stops this install's own server, so the new version is the one that starts.
# Nothing else: a node.exe whose command line names this folder's server.js
# (how start-windows.ps1 starts it since v1.10.83), or, for one an older
# version started as plain "node server.js", the one listening on this
# install's port.
function Stop-App([string]$sys) {
  $script = (Join-Path $sys 'server.js').ToLower()
  $nodes = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -OperationTimeoutSec 10 -ErrorAction SilentlyContinue)  # ERR-076: never wait for WMI forever
  $ids = @($nodes | Where-Object { $_.CommandLine -and $_.CommandLine.ToLower().Contains($script) } | ForEach-Object { $_.ProcessId })
  $portFile = Join-Path $sys 'data\port.txt'
  $port = if (Test-Path -LiteralPath $portFile) { (Get-Content -LiteralPath $portFile -Raw).Trim() } else { '' }
  if ($port -match '^\d+$') {
    foreach ($c in @(Get-NetTCPConnection -LocalPort ([int]$port) -State Listen -ErrorAction SilentlyContinue)) {
      $ids += @($nodes | Where-Object { $_.ProcessId -eq $c.OwningProcess -and $_.CommandLine -match 'server\.js' } | ForEach-Object { $_.ProcessId })
    }
  }
  foreach ($id in @($ids | Where-Object { $_ } | Select-Object -Unique)) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }
  if ($ids.Count) { Start-Sleep -Milliseconds 800 }
}

function Backup-Data([string]$sys) {
  $data = Join-Path $sys 'data'
  if (@(Get-ChildItem -LiteralPath $data -Recurse -File -Force -ErrorAction SilentlyContinue).Count -eq 0) { return $null }
  $home_ = if ($Test) { Join-Path $Test 'Backups' } else { Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'FreeGSTBill Backups' }
  New-Item -ItemType Directory -Path $home_ -Force | Out-Null
  $zip = Join-Path $home_ "pre-update-$(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss').zip"
  Compress-Archive -Path (Join-Path $data '*') -DestinationPath $zip -Force
  return $zip
}

# The icon opens the app in its own window. The console is minimised and
# then hidden, so all that shows is the app (start-windows.ps1 -Hidden puts a
# problem on screen if there is one).
function New-AppShortcut([string]$path, [string]$sys) {
  $sc = (New-Object -ComObject WScript.Shell).CreateShortcut($path)
  $sc.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $sc.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$(Join-Path $sys 'start-windows.ps1')`" -AppWindow -Hidden"
  $sc.WorkingDirectory = $sys
  $sc.WindowStyle = 7
  $sc.IconLocation = "$(Join-Path $sys 'app-icon.ico'),0"
  $sc.Description = 'Free GST Billing Software'
  $sc.Save()
}

function Install-App {
  Write-Host ''
  Write-Host '  Free GST Billing - install or update'
  Write-Host ''

  # --- [1/4] -----------------------------------------------------------------
  Step '[1/4] Checking this computer'
  if ([Environment]::OSVersion.Version.Major -lt 10) {
    Fail 'This computer runs an old Windows.' 'Free GST Billing needs Windows 10 or 11 (Node.js no longer runs on Windows 7 or 8).'
  }
  $dest = Find-Install
  # v1.10.84 - the Windows Setup installs to the same folder this line would
  # use. Its copy updates with the Setup (Update now in the app), never this.
  if (Test-Path -LiteralPath (Join-Path $dest 'installed.txt')) {
    Fail "Free GST Billing was installed in $dest with its Setup program." 'Update it from the app (Update now), or run Free-GST-Billing-Windows-Setup.exe from the Releases page. Nothing was changed.'
  }
  $sys = Join-Path $dest '_system'
  $isUpdate = Test-Path -LiteralPath (Join-Path $sys 'server.js')
  if (-not (Test-Writable $dest)) {
    Fail "This folder cannot be written to: $dest" 'Close any program using it, or choose another folder: $env:FREEGSTBILL_DIR = ''D:\Free GST Billing'' and run the line again.'
  }
  $free = Get-FreeMB $dest
  if ($free -lt $NeedFreeMB) {
    Fail "The disk is almost full ($free MB free)." "Free at least $NeedFreeMB MB (empty the Recycle Bin, delete old downloads), then run the same line again."
  }
  if (-not $env:FREEGSTBILL_ZIP -and -not (Test-Online)) {
    Fail 'This computer cannot reach github.com.' 'Check the internet (open any website). At an office, ask for github.com to be allowed. Then run the same line again.'
  }
  # Left over by an install that was interrupted.
  Get-ChildItem -LiteralPath $dest -Directory -Force -Filter '.install-tmp-*' -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
  Ok
  if ($isUpdate) { Write-Host "        Found Free GST Billing in $dest - updating it. Your data stays as it is." }

  # --- [2/4] -----------------------------------------------------------------
  # Unpacked inside the app folder itself: the same drive, so the files can be
  # moved into place (a move cannot cross drives).
  $tmp = Join-Path $dest ".install-tmp-$([Guid]::NewGuid().ToString('N').Substring(0, 4))"
  New-Item -ItemType Directory -Path $tmp -Force | Out-Null
  try {
    $zip = Join-Path $tmp 'Free-GST-Billing.zip'
    if ($env:FREEGSTBILL_ZIP) {
      Step '[2/4] Using the package on this computer'
      Copy-Item -LiteralPath $env:FREEGSTBILL_ZIP -Destination $zip
      Ok
    } else {
      Save-Url $ZipUrl $zip
    }

    # --- [3/4] ---------------------------------------------------------------
    Step '[3/4] Installing'
    # Short names: Windows PowerShell cannot write paths over 260 characters,
    # and the deepest package file is 117 characters below the app folder.
    $unpacked = Join-Path $tmp 'u'
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    try { [IO.Compression.ZipFile]::ExtractToDirectory($zip, $unpacked) } catch {
      if ($_.Exception.InnerException -is [IO.PathTooLongException] -or $_.Exception -is [IO.PathTooLongException]) {
        Fail "The folder path is too long for Windows: $dest" 'Install to a shorter one: run $env:FREEGSTBILL_DIR = ''C:\Free GST Billing'' in PowerShell, then the install line there.'
      }
      Fail 'The downloaded file could not be unpacked (damaged download, or the disk is full).' 'Run the same line again.'
    }
    $inner = Get-ChildItem -LiteralPath $unpacked -Directory | Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName '_system\server.js') } | Select-Object -First 1
    if (-not $inner -or -not (Test-Path -LiteralPath (Join-Path $inner.FullName '_system\node_modules\express\package.json'))) {
      Fail 'The downloaded file is not a complete Free GST Billing package.' 'Run the same line again. If it happens again, report it: https://github.com/IamRamgarhia/Free-GST-Billing-Software/issues'
    }
    $newSys = Join-Path $inner.FullName '_system'
    $backup = if ($isUpdate) { Backup-Data $sys } else { $null }
    Stop-App $sys

    # Every app file is replaced, node_modules included; the books, saved PDFs,
    # the bin and Node.js stay. A half-done earlier install is repaired the
    # same way.
    New-Item -ItemType Directory -Path $sys -Force | Out-Null
    $keep = @('data', 'Saved Invoices', 'Trash', 'node')
    $newNames = @(Get-ChildItem -LiteralPath $newSys -Force | ForEach-Object { $_.Name })
    foreach ($item in Get-ChildItem -LiteralPath $newSys -Force) {
      if ($keep -contains $item.Name) { continue }
      $target = Join-Path $sys $item.Name
      if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
      Move-Item -LiteralPath $item.FullName -Destination $target
    }
    # A clean update: what an older version had and this one does not goes.
    # Never the books, saved PDFs, the bin or Node.js.
    Get-ChildItem -LiteralPath $sys -Force | Where-Object {
      $newNames -notcontains $_.Name -and ($keep + 'node-dir.txt') -notcontains $_.Name -and -not $_.Name.StartsWith('.')
    } | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }
    $rootNames = @(Get-ChildItem -LiteralPath $inner.FullName -File -Force | ForEach-Object { $_.Name })
    Get-ChildItem -LiteralPath $dest -File -Force | Where-Object {
      ($_.Name -like 'Free GST Billing - *' -or $_.Name -eq 'READ ME FIRST.txt') -and $rootNames -notcontains $_.Name
    } | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue }
    foreach ($f in Get-ChildItem -LiteralPath $inner.FullName -File -Force) {
      Copy-Item -LiteralPath $f.FullName -Destination (Join-Path $dest $f.Name) -Force
    }
    New-Item -ItemType Directory -Path (Join-Path $sys 'data') -Force | Out-Null
    $portFile = Join-Path $sys 'data\port.txt'
    if ($env:FREEGSTBILL_PORT -and -not (Test-Path -LiteralPath $portFile)) {
      Set-Content -LiteralPath $portFile -Value $env:FREEGSTBILL_PORT -Encoding ASCII
    }
  } finally {
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }

  # Node.js 18+ from this PC, else the official portable one into _system\node
  # (no admin rights). ensure-node.ps1 says what to do if neither works.
  . (Join-Path $sys 'ensure-node.ps1')
  if (-not (Find-GoodNode)) {
    Write-Host ''
    if (-not (Use-GoodNode)) { Fail 'Node.js, which the app runs on, could not be set up (see above).' 'Do what it says, then run the same line again.' }
    Write-Host -NoNewline '        '
  }
  attrib +H "$sys" 2>$null
  $version = (Get-Content -LiteralPath (Join-Path $sys 'package.json') -Raw | ConvertFrom-Json).version
  Ok "(version $version)"
  if ($backup) { Write-Host "        Your data was backed up first, to $backup" }

  # --- [4/4] -----------------------------------------------------------------
  Step '[4/4] Adding icons'
  $f = Get-IconFolders
  foreach ($d in @($f.Desktop, $f.Programs)) {
    New-Item -ItemType Directory -Path $d -Force | Out-Null
    New-AppShortcut (Join-Path $d 'Free GST Billing.lnk') $sys
  }
  Ok
  if (-not $isUpdate -and (Ask 'Open Free GST Billing by itself when this computer starts?')) {
    New-Item -ItemType Directory -Path $f.Startup -Force | Out-Null
    New-AppShortcut (Join-Path $f.Startup 'Free GST Billing.lnk') $sys
    Write-Host '        It will open by itself when this computer starts.'
  }

  Write-Host ''
  Write-Host '  Done! Opening Free GST Billing...' -ForegroundColor Green
  & (Join-Path $sys 'start-windows.ps1') -AppWindow
  Write-Host ''
  Write-Host '  Next time, click the Free GST Billing icon on your Desktop or in the Start menu.'
  Write-Host ''
  if (-not $Test) { Start-Sleep -Seconds 10 }
}

function Uninstall-App {
  $dest = Find-Install
  $sys = Join-Path $dest '_system'
  if (-not (Test-Path -LiteralPath (Join-Path $sys 'server.js'))) { Fail "Free GST Billing is not installed in $dest." 'Nothing was changed.' }
  Write-Host ''
  Write-Host "  Removing Free GST Billing from $dest"
  Stop-App $sys
  $f = Get-IconFolders
  foreach ($d in @($f.Desktop, $f.Programs, $f.Startup)) {
    $lnk = Join-Path $d 'Free GST Billing.lnk'
    try { if ((Test-Path -LiteralPath $lnk) -and ((Get-LinkRoot $lnk) -eq $dest.TrimEnd('\'))) { Remove-Item -LiteralPath $lnk -Force } } catch { }
  }
  # The program goes; the books stay unless the user says otherwise.
  $keep = @('data', 'Saved Invoices', 'Trash')
  Get-ChildItem -LiteralPath $sys -Force | Where-Object { $keep -notcontains $_.Name } | Remove-Item -Recurse -Force
  # Only the app's own files beside _system: the folder may be one the user
  # chose (FREEGSTBILL_DIR, D:\, Documents) with their own files in it. The
  # same rule as uninstall-windows.ps1.
  Get-ChildItem -LiteralPath $dest -Force | Where-Object { $_.Name -like 'Free GST Billing - *' -or $_.Name -eq 'READ ME FIRST.txt' } | Remove-Item -Recurse -Force
  Write-Host '  The app and its icons are removed.' -ForegroundColor Green
  Write-Host ''
  Write-Host "  Your invoices, clients and settings are still in $sys"
  $answer = if ($Test) { '' } else { Read-Host '  To delete them too, type DELETE and press Enter (just Enter = keep them)' }
  if ($answer.Trim() -eq 'DELETE') {
    $backup = Backup-Data $sys
    Remove-Item -LiteralPath $sys -Recurse -Force
    if (-not @(Get-ChildItem -LiteralPath $dest -Force).Count) { Remove-Item -LiteralPath $dest -Force }
    Write-Host '  Deleted.'
    if ($backup) { Write-Host "  One last copy was saved to $backup - delete that file too if you want nothing left." }
  } else {
    Write-Host '  Kept. Running the install line again brings the app back with all of it.'
  }
  Write-Host ''
}

try {
  if ($Uninstall) { Uninstall-App } else { Install-App }
} catch {
  Write-Host ''
  $msg = $_.Exception.Message
  if (-not $script:KnownProblem) {
    $diskFull = ($_.Exception.HResult -eq -2147024784) -or ($msg -match 'not enough space')
    if ($diskFull) { $msg = "The disk is full.`n    Free some space, then run the same line again." }
    else { $msg = "$msg`n    Close Free GST Billing if it is open, then run the same line again; it carries on where it stopped." }
  }
  Write-Host "  PROBLEM: $msg" -ForegroundColor Red
  Write-Host '    Your invoices and settings were not changed.'
  Write-Host ''
  if (-not $Test) { Read-Host '  Press Enter to close' }
}
