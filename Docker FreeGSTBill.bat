@echo off
title Free GST Billing Software (Docker)
setlocal

echo ===================================================
echo   Starting Free GST Billing Software via Docker...
echo ===================================================
echo.

:: Check if Docker is installed and running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running or not installed.
    echo Please make sure Docker Desktop is installed and running, then try again.
    echo.
    pause
    exit /b 1
)

:: Read port from .env if present, otherwise default to 47371
set PORT=47371
if exist .env (
    for /f "tokens=1,2 delims==" %%a in (.env) do (
        if "%%a"=="PORT" set PORT=%%b
    )
)

echo Starting container stack...
docker compose up -d

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to start Docker Compose stack.
    pause
    exit /b 1
)

echo.
echo Application started successfully!
echo URL: http://localhost:%PORT%
echo.
echo Opening browser...
start http://localhost:%PORT%

echo.
echo Container is running in the background.
echo To stop it anytime, run: docker compose down
echo or double-click "Stop Docker FreeGSTBill.bat".
echo.
timeout /t 3 >nul
