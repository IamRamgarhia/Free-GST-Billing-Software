@echo off
title BillKaro Server
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js not found. Run "Install BillKaro.bat" first.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

if not exist "dist\index.html" (
    echo Building application...
    npm run build
)

echo.
echo  BillKaro running at http://localhost:3001
echo  Press Ctrl+C to stop
echo.

start "" /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3001"
node server.js
