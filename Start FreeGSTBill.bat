@echo off
cd /d "%~dp0"

:: Check if installed
if not exist "node_modules" (
    echo FreeGSTBill is not installed yet. Running installer...
    call "%~dp0Install FreeGSTBill.bat"
    exit /b
)

:: Build if needed
if not exist "dist\index.html" (
    npm run build --silent 2>nul
)

:: Check if server is already running
set "PORT=3001"
if exist "data\port.txt" set /p PORT=<data\port.txt
curl -s -o nul -w "" http://localhost:%PORT%/api/meta/test >nul 2>nul
if %errorlevel% equ 0 (
    start http://localhost:%PORT%
    exit /b 0
)

:: Start server silently (no window)
start "FreeGSTBill Server" /min cmd /c "node server.js"

:: Wait for server
set RETRIES=0
:waitloop
if %RETRIES% geq 20 goto openanyway
timeout /t 1 /nobreak >nul
set /a RETRIES+=1
if exist "data\port.txt" set /p PORT=<data\port.txt
curl -s -o nul -w "" http://localhost:%PORT%/api/meta/test >nul 2>nul
if %errorlevel% neq 0 goto waitloop

:openanyway
if exist "data\port.txt" set /p PORT=<data\port.txt
start http://localhost:%PORT%
