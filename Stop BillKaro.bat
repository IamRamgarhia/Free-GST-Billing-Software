@echo off
title Stop BillKaro
echo Stopping BillKaro server...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>nul
)
echo BillKaro server stopped.
timeout /t 2 /nobreak >nul
