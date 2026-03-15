@echo off
setlocal enabledelayedexpansion
title BillKaro Installer
color 0B

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║                                              ║
echo  ║     BillKaro - GST Billing Software          ║
echo  ║     Free • Offline • Open Source              ║
echo  ║     by DiceCodes                              ║
echo  ║                                              ║
echo  ╚══════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

:: ========================================
:: Step 1: Check Node.js
:: ========================================
echo  [1/4] Checking Node.js...

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo  ❌ Node.js is NOT installed on your system.
    echo.
    echo  BillKaro needs Node.js to run. Please install it:
    echo.
    echo     1. Go to: https://nodejs.org
    echo     2. Download the LTS version (recommended)
    echo     3. Run the installer (click Next through all steps)
    echo     4. Restart your computer
    echo     5. Run this installer again
    echo.
    echo  Opening Node.js download page...
    start https://nodejs.org/en/download/
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo         Found Node.js %NODE_VER% ✓
echo.

:: ========================================
:: Step 2: Install dependencies
:: ========================================
echo  [2/4] Installing dependencies...

if exist "node_modules" (
    echo         Dependencies already installed ✓
) else (
    echo         Running npm install (this may take 1-2 minutes)...
    npm install --silent 2>nul
    if %errorlevel% neq 0 (
        echo  ❌ Failed to install dependencies. Check your internet connection.
        pause
        exit /b 1
    )
    echo         Dependencies installed ✓
)
echo.

:: ========================================
:: Step 3: Build the application
:: ========================================
echo  [3/4] Building application...

if exist "dist\index.html" (
    echo         Application already built ✓
) else (
    npm run build --silent 2>nul
    if %errorlevel% neq 0 (
        echo  ❌ Build failed. Please check for errors above.
        pause
        exit /b 1
    )
    echo         Build complete ✓
)
echo.

:: ========================================
:: Step 4: Create Desktop Shortcut
:: ========================================
echo  [4/4] Creating desktop shortcut...

set "SHORTCUT_PATH=%USERPROFILE%\Desktop\BillKaro.lnk"
set "TARGET_PATH=%~dp0BillKaro.vbs"
set "ICON_DIR=%~dp0"

:: Create VBS shortcut creator script
set "TEMP_VBS=%TEMP%\create_shortcut.vbs"
(
    echo Set WshShell = WScript.CreateObject("WScript.Shell"^)
    echo Set shortcut = WshShell.CreateShortcut("%SHORTCUT_PATH%"^)
    echo shortcut.TargetPath = "wscript.exe"
    echo shortcut.Arguments = """%TARGET_PATH%"""
    echo shortcut.WorkingDirectory = "%~dp0"
    echo shortcut.Description = "BillKaro - Free GST Billing Software"
    echo shortcut.WindowStyle = 7
    echo shortcut.Save
) > "%TEMP_VBS%"

cscript //nologo "%TEMP_VBS%" 2>nul
del "%TEMP_VBS%" 2>nul

if exist "%SHORTCUT_PATH%" (
    echo         Desktop shortcut created ✓
) else (
    echo         Could not create shortcut (you can manually create one to BillKaro.vbs)
)
echo.

:: ========================================
:: Done!
:: ========================================
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║                                              ║
echo  ║     ✅ Installation Complete!                 ║
echo  ║                                              ║
echo  ║     To start BillKaro:                        ║
echo  ║       • Double-click "BillKaro" on Desktop    ║
echo  ║       • Or double-click BillKaro.vbs here     ║
echo  ║                                              ║
echo  ║     To install as PWA (optional):             ║
echo  ║       • Open Chrome/Edge to localhost:3001    ║
echo  ║       • Click install icon in address bar     ║
echo  ║                                              ║
echo  ╚══════════════════════════════════════════════╝
echo.
echo  Would you like to start BillKaro now? (Y/N)
set /p START_NOW="> "
if /i "%START_NOW%"=="Y" (
    echo.
    echo  Starting BillKaro...
    start "" wscript.exe "%~dp0BillKaro.vbs"
    timeout /t 3 /nobreak >nul
    start http://localhost:3001
)
echo.
pause
