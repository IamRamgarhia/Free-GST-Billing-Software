# Free GST Billing - one-command Windows installer.
#
#   irm https://raw.githubusercontent.com/IamRamgarhia/Free-GST-Billing-Software/main/install.ps1 | iex
#
# Does what a user doing it by hand would do: download the latest release
# ZIP, extract it, run the installer inside it. Nothing else. There is no
# elevation, no registry writing and no service - the app installs under
# the user's own profile.
#
# It runs through `iex`, so it cannot take -Parameters. Point it somewhere
# else with an environment variable instead:
#
#   $env:FREEGSTBILL_DIR = 'D:\Apps\Free GST Billing'
#
# Keep this file pure ASCII: it is fetched and parsed by Windows
# PowerShell 5.1, which mangles UTF-8 without a BOM (see ERR-001).

$ErrorActionPreference = 'Stop'

$Repo = 'IamRamgarhia/Free-GST-Billing-Software'
$Dest = $env:FREEGSTBILL_DIR
if (-not $Dest) { $Dest = Join-Path $env:LOCALAPPDATA 'Programs\Free GST Billing' }

Write-Host ''
Write-Host '  ============================================================'
Write-Host '   Free GST Billing Software - one-command install'
Write-Host '  ============================================================'
Write-Host ''

# PowerShell 5.1 still defaults to TLS 1.0, which github.com refuses.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# --- Refuse to write over books that are already there ----------------------
# Re-running this would put a fresh copy on top of a live install. The data
# folder survives that, but "the installer touched my data" is not a sentence
# anyone wants to read, so hand the job to the updater that is built for it.
$existingData = Join-Path $Dest '_system\data'
if (Test-Path $existingData) {
  $hasBooks = @(Get-ChildItem -Path $existingData -Recurse -File -ErrorAction SilentlyContinue).Count -gt 0
  if ($hasBooks) {
    Write-Host "  Free GST Billing is already installed at:" -ForegroundColor Yellow
    Write-Host "    $Dest"
    Write-Host ''
    Write-Host '  To update it, open the app and use Control Panel -> Update Now.'
    Write-Host '  That keeps your invoices, clients and settings, and backs them up first.'
    Write-Host ''
    Write-Host '  To install a second, separate copy, set a different folder and re-run:'
    Write-Host '    $env:FREEGSTBILL_DIR = ''D:\Apps\Free GST Billing'''
    Write-Host ''
    return
  }
}

# --- Step 1: find the latest release ZIP ------------------------------------
Write-Host '  Looking up the latest release...'
$release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -Headers @{ 'User-Agent' = 'FreeGSTBill-Installer' }
$asset = $release.assets | Where-Object { $_.name -like '*.zip' } | Select-Object -First 1
if (-not $asset) { throw "The latest release ($($release.tag_name)) has no ZIP attached. Download it by hand from https://github.com/$Repo/releases/latest" }
Write-Host "  Found $($release.tag_name) - $($asset.name)"

# --- Step 2: download -------------------------------------------------------
$tmp = Join-Path $env:TEMP ("freegstbill-" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
$zip = Join-Path $tmp $asset.name
Write-Host "  Downloading $([math]::Round($asset.size / 1MB, 1)) MB..."
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zip -UseBasicParsing

# --- Step 3: extract --------------------------------------------------------
Write-Host '  Extracting...'
$unpacked = Join-Path $tmp 'unpacked'
Expand-Archive -Path $zip -DestinationPath $unpacked -Force

# The ZIP holds a single folder (Free-GST-Billing) with the launchers and
# _system inside it. Install its CONTENTS, so the target folder is the app
# folder rather than a folder holding a folder.
$inner = Get-ChildItem -Path $unpacked -Directory | Select-Object -First 1
if (-not $inner) { throw "The release ZIP did not contain the expected folder. Extract it by hand from $zip" }

if (-not (Test-Path $Dest)) { New-Item -ItemType Directory -Path $Dest -Force | Out-Null }
Copy-Item -Path (Join-Path $inner.FullName '*') -Destination $Dest -Recurse -Force
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "  Installed to $Dest"

# --- Step 4: hand over to the installer that ships in the ZIP ---------------
# It installs Node.js if missing, runs npm install, and makes the Desktop and
# Start-Menu shortcuts. One copy of that logic, not two.
$installer = Join-Path $Dest '_system\install-windows.ps1'
if (-not (Test-Path $installer)) { throw "Extracted, but $installer is missing. Open $Dest and run the launcher by hand." }

Write-Host ''
Write-Host '  Running the installer (Node.js + dependencies + shortcuts)...'
Write-Host ''
& $installer
