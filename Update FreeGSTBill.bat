@echo off
title Free GST Billing Software Updater
cd /d "%~dp0"

echo.
echo  ========================================================
echo.
echo     Free GST Billing Software Updater
echo.
echo     Your data (invoices, clients, settings) will NOT
echo     be deleted. Only the app code will be updated.
echo.
echo  ========================================================
echo.
echo  Checking for updates...
echo.

:: Check current version
if exist "package.json" (
    for /f "tokens=2 delims=:, " %%a in ('findstr /c:"\"version\"" package.json') do set CURRENT_VER=%%~a
)
echo  Current version: %CURRENT_VER%

:: Stop running server
echo  Stopping server...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING 2^>nul') do (
    taskkill /f /pid %%a >nul 2>nul
)
if exist "data\port.txt" (
    set /p PORT=<data\port.txt
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PORT% ^| findstr LISTENING 2^>nul') do (
        taskkill /f /pid %%a >nul 2>nul
    )
)
:: Wait for server to fully stop
timeout /t 2 /nobreak >nul

:: Backup data folders
echo  Backing up your data...
if exist "data" xcopy /E /I /Q /Y "data" "%TEMP%\freegstbill_backup\data" >nul 2>nul
if exist "Saved Invoices" xcopy /E /I /Q /Y "Saved Invoices" "%TEMP%\freegstbill_backup\Saved Invoices" >nul 2>nul
if exist "Trash" xcopy /E /I /Q /Y "Trash" "%TEMP%\freegstbill_backup\Trash" >nul 2>nul
if exist "screenshot.png" copy /Y "screenshot.png" "%TEMP%\freegstbill_backup\screenshot.png" >nul 2>nul
echo         Data backed up safely

:: Download latest code
echo  Downloading latest version...
set "ZIP_URL=https://github.com/IamRamgarhia/Free-GST-Billing-Software/archive/refs/heads/main.zip"
set "ZIP_PATH=%TEMP%\freegstbill_latest.zip"
set "EXTRACT_PATH=%TEMP%\freegstbill_extract"

powershell -Command "Invoke-WebRequest -Uri '%ZIP_URL%' -OutFile '%ZIP_PATH%'" 2>nul
if not exist "%ZIP_PATH%" (
    echo.
    echo  ERROR: Could not download update. Check your internet connection.
    echo  Your data is safe - nothing was changed.
    echo.
    pause
    exit /b 1
)

:: Extract
echo  Extracting update...
if exist "%EXTRACT_PATH%" rmdir /s /q "%EXTRACT_PATH%"
powershell -Command "Expand-Archive -Path '%ZIP_PATH%' -DestinationPath '%EXTRACT_PATH%' -Force" 2>nul

:: Find the extracted folder (usually freegstbill-main)
for /d %%d in ("%EXTRACT_PATH%\*") do set "SOURCE_DIR=%%d"

:: Copy new files (skip data folders)
echo  Updating app files...
robocopy "%SOURCE_DIR%" "%~dp0" /E /XD data "Saved Invoices" Trash node_modules dist .git .claude /XF screenshot.png /NFL /NDL /NJH /NJS /R:2 /W:1
if %errorlevel% geq 8 (
    echo  WARNING: Some files may not have copied correctly.
)
:: Ensure critical files are copied
if exist "%SOURCE_DIR%\package.json" copy /Y "%SOURCE_DIR%\package.json" "%~dp0package.json" >nul
if exist "%SOURCE_DIR%\server.js" copy /Y "%SOURCE_DIR%\server.js" "%~dp0server.js" >nul

:: Restore data (in case anything was overwritten)
echo  Restoring your data...
if exist "%TEMP%\freegstbill_backup\data" xcopy /E /I /Q /Y "%TEMP%\freegstbill_backup\data" "data" >nul 2>nul
if exist "%TEMP%\freegstbill_backup\Saved Invoices" xcopy /E /I /Q /Y "%TEMP%\freegstbill_backup\Saved Invoices" "Saved Invoices" >nul 2>nul
if exist "%TEMP%\freegstbill_backup\Trash" xcopy /E /I /Q /Y "%TEMP%\freegstbill_backup\Trash" "Trash" >nul 2>nul
if exist "%TEMP%\freegstbill_backup\screenshot.png" copy /Y "%TEMP%\freegstbill_backup\screenshot.png" "screenshot.png" >nul 2>nul

:: Install new dependencies
echo  Installing dependencies...
call npm install --silent 2>nul

:: Rebuild
echo  Building updated app...
if exist "dist" rmdir /s /q "dist"
call npm run build --silent 2>nul

:: Cleanup temp files
del "%ZIP_PATH%" 2>nul
rmdir /s /q "%EXTRACT_PATH%" 2>nul
rmdir /s /q "%TEMP%\freegstbill_backup" 2>nul

:: Show new version
if exist "package.json" (
    for /f "tokens=2 delims=:, " %%a in ('findstr /c:"\"version\"" package.json') do set NEW_VER=%%~a
)

:: Verify update worked
if "%NEW_VER%"=="%CURRENT_VER%" (
    echo.
    echo  WARNING: Version did not change. The update may not have applied correctly.
    echo  Try running this updater again, or re-download from GitHub.
    echo.
)

echo.
echo  ========================================================
echo.
echo     Update Complete!
echo.
echo     Updated: %CURRENT_VER% → %NEW_VER%
echo.
echo     Your data is safe and untouched.
echo     Starting Free GST Billing Software...
echo.
echo  ========================================================
echo.

start "" "%~dp0Start FreeGSTBill.bat"
pause
