@echo off
title Stop Free GST Billing Software
echo Stopping Free GST Billing Software server...

set "PORT=3001"
if exist "%~dp0data\port.txt" set /p PORT=<"%~dp0data\port.txt"

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PORT% ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>nul
)

echo Free GST Billing Software server stopped.
timeout /t 2 /nobreak >nul
