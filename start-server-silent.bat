@echo off
cd /d "%~dp0"
if not exist "node_modules" exit /b
if not exist "dist\index.html" exit /b
start "" /min cmd /c "node server.js"
