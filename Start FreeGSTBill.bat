@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

:: ===============================================================
:: Free GST Billing Software — Launcher
:: ---------------------------------------------------------------
:: Behaviour:
::   1. If not installed → run Install.bat
::   2. If app build is missing → build it
::   3. If server is already running → open the URL
::   4. Otherwise → start the server, wait for it, then open the URL
::   5. If anything fails → fall back to the visual Control Panel
::      (index.html) so the user always sees something useful,
::      never a black window that closed silently.
:: ===============================================================

:: Step 1: Verify install
if not exist "node_modules" (
    echo Free GST Billing Software is not installed yet. Running installer...
    call "%~dp0Install FreeGSTBill.bat"
    exit /b
)

:: Step 1.5: Verify node is on PATH. If not, point user at index.html
:: which has visible troubleshooting steps. (Without this check, the script
:: would silently fail since PowerShell can't run a non-existent command.)
where node >nul 2>nul
if errorlevel 1 (
    echo Node.js was not found on PATH. Opening the control panel for help.
    start "" "%~dp0index.html"
    pause
    exit /b 1
)

:: Step 2: Build if needed
if not exist "dist\index.html" (
    echo Building app, please wait...
    call npm run build --silent 2>nul
)

:: Step 3: Port discovery — read whatever's saved, probe it
set "PORT=47371"
if exist "data\port.txt" set /p PORT=<data\port.txt
curl -s -o nul -w "" http://localhost:%PORT%/api/meta/test >nul 2>nul
if !errorlevel! equ 0 (
    start "" http://localhost:!PORT!/
    exit /b 0
)

:: Step 4: Launch server. Try the hidden PowerShell approach first
:: (matches existing behaviour). If PowerShell fails, fall back to a
:: visible "start /b" launch which is more compatible across Windows
:: versions / corporate policies.
powershell -WindowStyle Hidden -Command "Start-Process node -ArgumentList 'server.js' -WorkingDirectory '%~dp0' -WindowStyle Hidden" 2>nul
if errorlevel 1 (
    start "Free GST Billing Server" /min cmd /c "node server.js"
)

:: Step 4.5: Wait for server. We poll every second up to 30s and
:: re-read port.txt each iteration so a collision-driven port bump
:: doesn't strand us on the old port.
set RETRIES=0
:waitloop
if !RETRIES! geq 30 goto fallback
timeout /t 1 /nobreak >nul
set /a RETRIES+=1
if exist "data\port.txt" set /p PORT=<data\port.txt
curl -s -o nul -w "" http://localhost:!PORT!/api/meta/test >nul 2>nul
if !errorlevel! neq 0 goto waitloop

:: Server is up — open the app in default browser
if exist "data\port.txt" set /p PORT=<data\port.txt
start "" http://localhost:!PORT!/
exit /b 0

:fallback
:: Server didn't respond within 30 seconds. Open the visual Control
:: Panel so the user can see status, retry, and read troubleshooting
:: tips. This is FAR better than the old behaviour where we'd just
:: open the URL and the browser would show "this site can't be reached".
echo Server did not respond within 30 seconds. Opening the control panel.
start "" "%~dp0index.html"
exit /b 1
