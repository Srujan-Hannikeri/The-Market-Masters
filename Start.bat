@echo off
title The Market Masters - Server
cls

echo ============================================
echo    THE MARKET MASTERS
echo    Smart Billing & Inventory Management
echo ============================================
echo.

:: Check if already running
netstat -ano | findstr :5000 >nul 2>nul
if %errorlevel% equ 0 (
    echo [WARN] Port 5000 is already in use
    echo Stopping existing instance...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000') do (
        taskkill /F /PID %%a >nul 2>nul
    )
    timeout /t 2 /nobreak >nul
)
echo.

:: Verify backend exists
if not exist "%~dp0backend\node_modules" (
    echo [ERROR] Dependencies not installed!
    echo Please run Setup.bat first
    pause
    exit /b 1
)

:: Verify .env file exists
if not exist "%~dp0backend\.env" (
    echo [ERROR] Configuration file not found!
    echo Please run Setup.bat first
    pause
    exit /b 1
)

echo ============================================
echo   Starting Server...
echo ============================================
echo.
echo Launching Node backend server...
echo.

cd /d "%~dp0backend"
start /b node server.js

echo Waiting for server to initialize on port 5000...
:check_loop
timeout /t 1 /nobreak >nul
netstat -ano | findstr :5000 >nul 2>nul
if %errorlevel% neq 0 (
    goto check_loop
)

echo Server is ready! Opening Market Masters application in browser...
start http://localhost:5000
echo.
echo Server is running. Keep this window open. Press Ctrl+C to stop.
pause >nul
