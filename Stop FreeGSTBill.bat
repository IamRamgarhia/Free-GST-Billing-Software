@echo off
title Stop Free GST Billing Software
echo Stopping Free GST Billing Software server...

:: Default 47371 matches server.js DEFAULT_PORT; the actual running port
:: is read from data\port.txt (written by the server on every successful
:: boot). Falling back to 47371 covers the edge case where data\port.txt
:: hasn't been written yet — better than killing port 3001 (some other
:: poor app on this machine) by mistake.
set "PORT=47371"
if exist "%~dp0data\port.txt" set /p PORT=<"%~dp0data\port.txt"

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PORT% ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>nul
)

echo Free GST Billing Software server stopped.
timeout /t 2 /nobreak >nul
