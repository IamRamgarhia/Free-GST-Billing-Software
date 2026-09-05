@echo off
title Stop Free GST Billing Software (Docker)
setlocal

echo ===================================================
echo   Stopping Free GST Billing Software Container...
echo ===================================================
echo.

docker compose down

echo.
echo Container stopped. Your data remains safely stored in the ./data/ directory.
echo.
timeout /t 3 >nul
