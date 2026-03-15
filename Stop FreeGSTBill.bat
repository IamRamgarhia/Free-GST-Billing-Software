@echo off
title Stop FreeGSTBill
echo Stopping FreeGSTBill server...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>nul
)
echo FreeGSTBill server stopped.
timeout /t 2 /nobreak >nul
