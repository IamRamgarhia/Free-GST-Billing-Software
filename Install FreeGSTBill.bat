@echo off
setlocal enabledelayedexpansion
title FreeGSTBill Installer
color 0B

echo.
echo  ========================================================
echo.
echo     FreeGSTBill - Free GST Billing Software
echo     Free - Offline - Open Source
echo     by DiceCodes
echo.
echo  ========================================================
echo.

cd /d "%~dp0"

:: ========================================
:: Step 1: Check / Install Node.js
:: ========================================
echo  [1/4] Checking Node.js...

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo         Node.js not found. Installing automatically...
    echo.

    :: Try winget first (Windows 10 1709+ and Windows 11)
    where winget >nul 2>nul
    if %errorlevel% equ 0 (
        echo         Installing Node.js LTS via winget...
        echo         (This may take 1-2 minutes, please wait)
        echo.
        winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent
        if %errorlevel% equ 0 (
            echo.
            echo         Node.js installed successfully!
            echo.
            echo         IMPORTANT: Please close this window and run the installer again.
            echo         (Windows needs to refresh the PATH to find Node.js)
            echo.
            pause
            exit /b 0
        ) else (
            echo         winget install failed. Trying alternative method...
        )
    )

    :: Try chocolatey
    where choco >nul 2>nul
    if %errorlevel% equ 0 (
        echo         Installing Node.js LTS via Chocolatey...
        choco install nodejs-lts -y --no-progress
        if %errorlevel% equ 0 (
            echo.
            echo         Node.js installed successfully!
            echo         Please close this window and run the installer again.
            echo.
            pause
            exit /b 0
        )
    )

    :: Fallback: download MSI installer directly
    echo.
    echo         Automatic install not available. Downloading Node.js installer...
    echo.

    set "NODE_MSI=%TEMP%\node-install.msi"
    echo         Downloading Node.js LTS...
    powershell -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $url = (Invoke-WebRequest -Uri 'https://nodejs.org/dist/latest-v22.x/' -UseBasicParsing).Links | Where-Object { $_.href -match 'x64\.msi$' } | Select-Object -First 1 -ExpandProperty href; Invoke-WebRequest -Uri ('https://nodejs.org/dist/latest-v22.x/' + $url) -OutFile '%NODE_MSI%' -UseBasicParsing; Write-Host 'Download complete' } catch { Write-Host 'DOWNLOAD_FAILED' }" 2>nul

    if exist "%NODE_MSI%" (
        echo         Running Node.js installer...
        echo         (Follow the installer steps - click Next through all)
        echo.
        start /wait msiexec /i "%NODE_MSI%"
        del "%NODE_MSI%" 2>nul
        echo.
        echo         Please close this window and run the installer again.
        echo         (Windows needs to refresh the PATH to find Node.js)
        echo.
        pause
        exit /b 0
    ) else (
        echo  [!] Could not download Node.js automatically.
        echo.
        echo      Please install Node.js manually:
        echo        1. Go to: https://nodejs.org
        echo        2. Download the LTS version
        echo        3. Run the installer
        echo        4. Run this installer again
        echo.
        start https://nodejs.org/en/download/
        pause
        exit /b 1
    )
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo         Found Node.js %NODE_VER%
echo.

:: ========================================
:: Step 2: Install dependencies
:: ========================================
echo  [2/4] Installing dependencies...

if exist "node_modules" (
    echo         Dependencies already installed
) else (
    echo         Running npm install (this may take 1-2 minutes)...
    npm install --silent 2>nul
    if %errorlevel% neq 0 (
        echo  [!] Failed to install dependencies. Check your internet connection.
        pause
        exit /b 1
    )
    echo         Dependencies installed
)
echo.

:: ========================================
:: Step 3: Build the application
:: ========================================
echo  [3/4] Building application...

if exist "dist\index.html" (
    echo         Application already built
) else (
    npm run build --silent 2>nul
    if %errorlevel% neq 0 (
        echo  [!] Build failed. Please check for errors above.
        pause
        exit /b 1
    )
    echo         Build complete
)
echo.

:: ========================================
:: Step 4: Create Desktop Shortcut
:: ========================================
echo  [4/5] Creating shortcuts...

set "TARGET_PATH=%~dp0Start FreeGSTBill.bat"

:: Desktop shortcut
set "DESKTOP_SHORTCUT=%USERPROFILE%\Desktop\FreeGSTBill.lnk"

:: Start Menu shortcut (searchable from Windows Start)
set "STARTMENU_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\FreeGSTBill"
if not exist "%STARTMENU_DIR%" mkdir "%STARTMENU_DIR%"
set "STARTMENU_SHORTCUT=%STARTMENU_DIR%\FreeGSTBill.lnk"

:: Create VBS shortcut creator script (creates both shortcuts)
set "TEMP_VBS=%TEMP%\create_shortcut.vbs"
(
    echo Set WshShell = WScript.CreateObject("WScript.Shell"^)
    echo.
    echo Set desktopShortcut = WshShell.CreateShortcut("%DESKTOP_SHORTCUT%"^)
    echo desktopShortcut.TargetPath = "%TARGET_PATH%"
    echo desktopShortcut.WorkingDirectory = "%~dp0"
    echo desktopShortcut.Description = "FreeGSTBill - Free GST Billing Software"
    echo desktopShortcut.WindowStyle = 1
    echo desktopShortcut.Save
    echo.
    echo Set startShortcut = WshShell.CreateShortcut("%STARTMENU_SHORTCUT%"^)
    echo startShortcut.TargetPath = "%TARGET_PATH%"
    echo startShortcut.WorkingDirectory = "%~dp0"
    echo startShortcut.Description = "FreeGSTBill - Free GST Billing Software"
    echo startShortcut.WindowStyle = 1
    echo startShortcut.Save
) > "%TEMP_VBS%"

cscript //nologo "%TEMP_VBS%" 2>nul
del "%TEMP_VBS%" 2>nul

if exist "%DESKTOP_SHORTCUT%" (
    echo         Desktop shortcut created
) else (
    echo         Could not create desktop shortcut
)
if exist "%STARTMENU_SHORTCUT%" (
    echo         Start Menu shortcut created (search "FreeGSTBill" in Start)
) else (
    echo         Could not create Start Menu shortcut
)
echo.

:: ========================================
:: Step 5: Auto-start on Windows login + Protocol
:: ========================================
echo  [5/5] Setting up auto-start...

:: Add to Windows Startup folder (server starts silently on login)
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "STARTUP_SHORTCUT=%STARTUP_DIR%\FreeGSTBill Server.lnk"
set "SERVER_BAT=%~dp0start-server-silent.bat"

:: Create a silent server starter (no window, just runs node)
(
    echo @echo off
    echo cd /d "%~dp0"
    echo if not exist "node_modules" exit /b
    echo if not exist "dist\index.html" exit /b
    echo start "" /min cmd /c "node server.js"
) > "%SERVER_BAT%"

:: Create startup shortcut
set "TEMP_VBS2=%TEMP%\create_startup.vbs"
(
    echo Set WshShell = WScript.CreateObject("WScript.Shell"^)
    echo Set startupShortcut = WshShell.CreateShortcut("%STARTUP_SHORTCUT%"^)
    echo startupShortcut.TargetPath = "%SERVER_BAT%"
    echo startupShortcut.WorkingDirectory = "%~dp0"
    echo startupShortcut.Description = "FreeGSTBill Server Auto-Start"
    echo startupShortcut.WindowStyle = 7
    echo startupShortcut.Save
) > "%TEMP_VBS2%"
cscript //nologo "%TEMP_VBS2%" 2>nul
del "%TEMP_VBS2%" 2>nul

if exist "%STARTUP_SHORTCUT%" (
    echo         Auto-start on login enabled
) else (
    echo         Could not enable auto-start
)

:: Register freegstbill:// protocol
set "REG_VBS=%TEMP%\reg_protocol.vbs"
(
    echo Set WshShell = CreateObject("WScript.Shell"^)
    echo On Error Resume Next
    echo WshShell.RegWrite "HKCU\Software\Classes\freegstbill\", "URL:FreeGSTBill Protocol", "REG_SZ"
    echo WshShell.RegWrite "HKCU\Software\Classes\freegstbill\URL Protocol", "", "REG_SZ"
    echo WshShell.RegWrite "HKCU\Software\Classes\freegstbill\shell\open\command\", "cmd /c ""%TARGET_PATH%""", "REG_SZ"
) > "%REG_VBS%"

cscript //nologo "%REG_VBS%" 2>nul
del "%REG_VBS%" 2>nul
echo         Start button registered
echo.

:: ========================================
:: Done!
:: ========================================
echo.
echo  ========================================================
echo.
echo     Installation Complete!
echo.
echo  ========================================================
echo.
echo  Starting FreeGSTBill...
echo  (Your browser will open automatically)
echo.

start "" "%~dp0Start FreeGSTBill.bat"

echo.
echo  ========================================================
echo.
echo     FreeGSTBill is running!
echo.
echo     HOW IT WORKS:
echo       - Server starts automatically when you turn on PC
echo       - Just click "FreeGSTBill" on Desktop to open
echo       - Or search "FreeGSTBill" in Start Menu
echo       - Your data is always safe on your computer
echo.
echo     Tip: When the app opens, click "Install App"
echo     to use it like a normal desktop application.
echo.
echo  ========================================================
echo.
pause
