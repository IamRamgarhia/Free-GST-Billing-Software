# Free GST Billing - check this PC has what the app needs, fix what can be
# fixed safely, and say in plain words what to do about the rest.
#
# Dot-sourced by install-windows.ps1, update-windows.ps1 and start-windows.ps1.
#
# v1.10.81 (#109) - any "node" on PATH used to be accepted. A PC with an old
# Node.js (6.10, from 2017) got npm 3, which does not know --omit=dev, half
# installed the packages and failed; the updater still said "Update complete"
# and the server could not start on Node 6 ("not answered in 90 seconds").
#
# What is checked, and what happens when it fails:
#   Windows 10 or 11       -> say so (Node.js 18+ does not run on 7 / 8)
#   app folder writable    -> say where to move it
#   free disk space        -> say how much is needed
#   Node.js 18+, npm 7+    -> 1. the official portable Node.js, unpacked into
#                                _system\node (no admin rights, nothing else on
#                                the PC changes, an older Node.js is left alone)
#                             2. if that download fails: winget, after asking
#                             3. else: the steps, and the download page opened
#   npm registry reachable -> say it is the connection or a proxy
#   npm install failed     -> Show-InstallHelp works out which of the above

$MinNodeMajor = 18           # package.json "engines"
$MinNpmMajor = 7             # first npm that understands --omit=dev
# v1.10.86 - Node.js 26 LTS; it has no 32-bit Windows build, so a 32-bit
# Windows gets Node.js 22 (supported to April 2027). See Install-PortableNode.
$PortableNodeVersion = 'v26.13.1'
$PortableNodeVersionX86 = 'v22.23.5'
$AppNodeDir = Join-Path $PSScriptRoot 'node'
$NeedFreeMB = 400            # packages (~150 MB) + Node.js (~90 MB) + room

function Write-Problem([string]$title, [string[]]$lines) {
  Write-Host ''
  Write-Host "  PROBLEM: $title" -ForegroundColor Red
  foreach ($l in $lines) { Write-Host "    $l" }
}

function Get-Major([string]$exe) {
  try {
    $v = (& $exe -v 2>$null | Out-String).Trim()
    if ($v -match '^v?(\d+)\.') { return [int]$Matches[1] }
  } catch { }
  return 0
}

# npm next to this node.exe (the one that came with it), or $null.
function Get-NpmFor([string]$nodeExe) {
  $dir = Split-Path -Parent $nodeExe
  foreach ($n in @('npm.cmd', 'npm')) {
    $p = Join-Path $dir $n
    if (Test-Path -LiteralPath $p) { return $p }
  }
  $any = Get-Command npm -ErrorAction SilentlyContinue
  if ($any) { return $any.Source }
  return $null
}

# Every node.exe worth trying: the app's own copy first, then each one on
# PATH (not only the first - an old one can hide a new one), then the
# standard install folder.
function Get-NodeCandidates {
  $list = @()
  $inApp = Join-Path $AppNodeDir 'node.exe'
  if (Test-Path -LiteralPath $inApp) { $list += $inApp }
  foreach ($c in @(Get-Command node -All -ErrorAction SilentlyContinue)) { if ($c.Source) { $list += $c.Source } }
  foreach ($d in @($env:ProgramFiles, ${env:ProgramFiles(x86)}, (Join-Path $env:LOCALAPPDATA 'Programs'))) {
    if (-not $d) { continue }
    $p = Join-Path $d 'nodejs\node.exe'
    if (Test-Path -LiteralPath $p -ErrorAction SilentlyContinue) { $list += $p }
  }
  return $list | Select-Object -Unique
}

# Path of a node.exe new enough, with an npm new enough, or $null.
# $script:OldNodeVersion is set when one was found but is too old.
function Find-GoodNode {
  $script:OldNodeVersion = $null
  foreach ($exe in Get-NodeCandidates) {
    $major = Get-Major $exe
    if ($major -lt $MinNodeMajor) {
      if ($major -gt 0 -and -not $script:OldNodeVersion) { $script:OldNodeVersion = "Node.js $((& $exe -v 2>$null | Out-String).Trim())" }
      continue
    }
    $npm = Get-NpmFor $exe
    if ($npm -and (Get-Major $npm) -ge $MinNpmMajor) { return $exe }
    if (-not $script:OldNodeVersion) { $script:OldNodeVersion = "npm next to Node.js $((& $exe -v 2>$null | Out-String).Trim())" }
  }
  return $null
}

function Test-WindowsVersion {
  if ([Environment]::OSVersion.Version.Major -ge 10) { return $true }
  Write-Problem 'This version of Windows is too old.' @(
    'Free GST Billing needs Windows 10 or Windows 11.',
    'Node.js, which the app runs on, no longer works on Windows 7 or 8.')
  return $false
}

function Test-AppFolderWritable {
  $probe = Join-Path $PSScriptRoot ".write-test-$([Guid]::NewGuid().ToString('N'))"
  try {
    Set-Content -LiteralPath $probe -Value 'ok' -ErrorAction Stop
    Remove-Item -LiteralPath $probe -Force -ErrorAction SilentlyContinue
    return $true
  } catch {
    Write-Problem 'The app cannot write to its own folder.' @(
      "Folder: $(Split-Path -Parent $PSScriptRoot)",
      'This happens inside C:\Program Files, on a read-only drive, or when',
      'antivirus "controlled folder access" blocks it.',
      'Move the Free-GST-Billing folder to Documents or D:\ and open it from there.')
    return $false
  }
}

function Test-DiskSpace {
  try {
    $root = [IO.Path]::GetPathRoot($PSScriptRoot)
    # v1.10.83 - Get-PSDrive's Free is empty on some PCs, which read as
    # "0 MB free" and refused to install on a nearly empty drive (reported by
    # e-mail). Ask Windows directly; a value that cannot be read does not block.
    $free = $null
    try { $free = ([IO.DriveInfo]::new($root)).AvailableFreeSpace } catch { $free = $null }
    if ($null -eq $free -or $free -le 0) { $free = (Get-PSDrive -Name $root.Substring(0, 1) -ErrorAction Stop).Free }
    if ($null -eq $free -or $free -le 0) { return $true }   # cannot tell: do not block on it
    $freeMB = [int]($free / 1MB)
    if ($freeMB -ge $NeedFreeMB) { return $true }
    Write-Problem "Drive $root is almost full." @(
      "It has $freeMB MB free; the app needs about $NeedFreeMB MB to install.",
      'Free some space (empty the Recycle Bin, delete old downloads) and try again.')
    return $false
  } catch { return $true }   # cannot tell: do not block on it
}

function Test-Internet([string]$url = 'https://registry.npmjs.org/') {
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $null = Invoke-WebRequest -Uri $url -Method Head -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
    return $true
  } catch { return $false }
}

function Install-PortableNode {
  $arch = if ([Environment]::Is64BitOperatingSystem) { 'x64' } else { 'x86' }
  if ($arch -eq 'x86') { $PortableNodeVersion = $PortableNodeVersionX86 }
  $name = "node-$PortableNodeVersion-win-$arch"
  $tmpZip = Join-Path $env:TEMP "$name.zip"
  $tmpDir = Join-Path $env:TEMP "fgstbill-node-$([Guid]::NewGuid().ToString('N'))"
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri "https://nodejs.org/dist/$PortableNodeVersion/$name.zip" -OutFile $tmpZip -UseBasicParsing -ErrorAction Stop
    Write-Host '  Unpacking...'
    Expand-Archive -Path $tmpZip -DestinationPath $tmpDir -Force
    if (Test-Path $AppNodeDir) { Remove-Item $AppNodeDir -Recurse -Force -ErrorAction SilentlyContinue }
    Move-Item (Join-Path $tmpDir $name) $AppNodeDir -ErrorAction Stop
    return $true
  } catch {
    Write-Host "  The download did not work: $($_.Exception.Message)" -ForegroundColor Yellow
    return $false
  } finally {
    Remove-Item $tmpZip -Force -ErrorAction SilentlyContinue
    Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}

# Windows Package Manager, only after asking: it installs Node.js for the
# whole PC (Windows asks for permission), replacing an older one there.
function Install-NodeWithWinget {
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) { return $false }
  Write-Host ''
  Write-Host '  Windows can install Node.js LTS for this PC with its own package manager'
  Write-Host '  (winget). Windows may ask for permission. Other programs that use Node.js'
  Write-Host '  will get the new version too.'
  $ans = Read-Host '  Install Node.js LTS now? Type Y and press Enter (anything else = no)'
  if ($ans -notmatch '^[Yy]') { return $false }
  & $winget.Source install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
  # New PATH for this window, so the new Node.js is found without a restart.
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
  return $true
}

function Show-NodeHelp {
  Write-Problem 'Node.js could not be set up automatically.' @(
    'The app needs Node.js 18 or newer. To install it yourself:',
    '  1. Open https://nodejs.org (opening it now) and download the LTS version.',
    '  2. Run the installer and keep the default options.',
    '  3. Open Free GST Billing again.',
    'If your antivirus removed it, add the Free-GST-Billing folder to its exclusions.')
  try { Start-Process 'https://nodejs.org/en/download' } catch { }
}

# Finds or sets up a good Node.js and puts it first on PATH (so "npm" is its
# npm too). Returns the node.exe path, or $null after saying what to do.
# $script:NodeWasFetched tells the caller a new Node.js was just set up.
function Use-GoodNode {
  $script:NodeWasFetched = $false
  $exe = Find-GoodNode
  if (-not $exe) {
    if (-not (Test-WindowsVersion)) { return $null }
    if ($script:OldNodeVersion) {
      Write-Host "  The $($script:OldNodeVersion) on this PC is too old for this app."
      Write-Host '  Fetching a current Node.js into the app folder (about 30 MB, one time).'
      Write-Host '  Your other Node.js is left as it is.'
    } else {
      Write-Host '  Node.js is not on this PC - fetching it (about 30 MB, one time)...'
    }
    if (-not (Test-AppFolderWritable)) { return $null }
    if (-not (Test-DiskSpace)) { return $null }
    $ok = Install-PortableNode
    if ($ok) { $exe = Find-GoodNode }
    if (-not $exe -and (Install-NodeWithWinget)) { $exe = Find-GoodNode }
    if (-not $exe) { Show-NodeHelp; return $null }
    $script:NodeWasFetched = $true
    Write-Host "  Node.js $(& $exe -v) is ready."
  }
  $env:Path = "$(Split-Path -Parent $exe);$env:Path"
  return $exe
}

# Before an npm install: the folder, the space and the connection.
function Test-InstallReady {
  if (-not (Test-AppFolderWritable)) { return $false }
  if (-not (Test-DiskSpace)) { return $false }
  if (Test-Internet) { return $true }
  Write-Problem 'The app cannot reach the internet to download its packages.' @(
    'Check that this PC is online (open any website), then try again.',
    'On an office network a proxy or firewall may block registry.npmjs.org;',
    'ask whoever manages the network to allow it.')
  return $false
}

# After a failed npm install: work out which cause it was.
function Show-InstallHelp {
  if (-not (Test-InstallReady)) { return }   # said which one
  Write-Problem 'The app packages did not install.' @(
    'The internet, the disk and the folder all look fine, so the usual cause is',
    'antivirus blocking files as they are written. Add the Free-GST-Billing folder',
    'to its exclusions and try again. If it keeps failing, open an issue at',
    'https://github.com/IamRamgarhia/Free-GST-Billing-Software/issues with a',
    'photo of this window.')
}

# Packages installed by an old npm (a half-done node_modules, a .staging
# folder, npm-debug.log) are not always repaired by a newer one, so they are
# removed and installed cleanly. Only app code lives there - never data.
function Reset-Packages {
  $nm = Join-Path $PSScriptRoot 'node_modules'
  if (Test-Path -LiteralPath $nm) {
    Write-Host '  Removing the app packages left by the earlier install...'
    Remove-Item -LiteralPath $nm -Recurse -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -LiteralPath (Join-Path $PSScriptRoot 'npm-debug.log') -Force -ErrorAction SilentlyContinue
}

# True when node_modules is there but incomplete (the app's main package missing).
function Test-PackagesBroken {
  $nm = Join-Path $PSScriptRoot 'node_modules'
  return (Test-Path -LiteralPath $nm) -and -not (Test-Path -LiteralPath (Join-Path $nm 'express\package.json'))
}

# v1.10.83 - True when node_modules is complete and was written by npm 7 or
# newer, so no npm install is needed: the release ZIP ships it like that. npm
# 7+ always leaves node_modules\.package-lock.json; the npm 3 that broke
# installs in ERR-060 never does, so its half-done folders still get redone.
function Test-PackagesReady([string]$systemDir = $PSScriptRoot) {
  $nm = Join-Path $systemDir 'node_modules'
  return (Test-Path -LiteralPath (Join-Path $nm 'express\package.json')) -and (Test-Path -LiteralPath (Join-Path $nm '.package-lock.json'))
}
