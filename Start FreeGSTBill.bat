@echo off
cd /d "%~dp0"

:: Check if installed
if not exist "node_modules" (
    echo Free GST Billing Software is not installed yet. Running installer...
    call "%~dp0Install FreeGSTBill.bat"
    exit /b
)

:: Build if needed
if not exist "dist\index.html" (
    echo Building app, please wait...
    npm run build --silent 2>nul
)

:: ===============================================================
:: Port discovery
:: ---------------------------------------------------------------
:: The server picks its port and writes it to data\port.txt. We:
::   1. Read whatever's there now (if anything) as our best guess
::   2. Probe — if the server is already running on that port, just open it
::   3. Otherwise launch the server, then RE-READ port.txt during the wait
::      loop because the server may have hit a collision and bumped the port
::      while we were waiting.
:: 47371 is the project's default; we only use it as a fallback for
:: first-ever installs where data\port.txt doesn't exist yet.
:: ===============================================================
set "PORT=47371"
if exist "data\port.txt" set /p PORT=<data\port.txt
curl -s -o nul -w "" http://localhost:%PORT%/api/meta/test >nul 2>nul
if %errorlevel% equ 0 (
    start http://localhost:%PORT%
    exit /b 0
)

:: Start server completely hidden (no window, no taskbar icon)
powershell -WindowStyle Hidden -Command "Start-Process node -ArgumentList 'server.js' -WorkingDirectory '%~dp0' -WindowStyle Hidden"

:: Wait for server to be ready. Re-read port.txt every iteration so we
:: pick up any collision-driven port bumps the server makes.
set RETRIES=0
:waitloop
if %RETRIES% geq 20 goto openanyway
timeout /t 1 /nobreak >nul
set /a RETRIES+=1
if exist "data\port.txt" set /p PORT=<data\port.txt
curl -s -o nul -w "" http://localhost:%PORT%/api/meta/test >nul 2>nul
if %errorlevel% neq 0 goto waitloop

:openanyway
:: Always re-read after the wait — the server may have started AFTER our
:: last waitloop probe but before we got here.
if exist "data\port.txt" set /p PORT=<data\port.txt
start http://localhost:%PORT%
