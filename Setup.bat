@echo off
title Market Masters - Setup Wizard
cls

echo ============================================
echo    THE MARKET MASTERS
echo    Smart Billing & Inventory Management
echo    Setup Wizard
echo ============================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js detected
node --version
echo.

:: Check MySQL
where mysql >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARN] MySQL CLI not found in PATH
    echo Ensure MySQL Server is installed and running
    echo.
)

echo ============================================
echo   STEP 1: Install Dependencies
echo ============================================
echo.
cd /d "%~dp0backend"
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies!
    pause
    exit /b 1
)
echo [OK] Dependencies installed
cd /d "%~dp0"
echo.

echo ============================================
echo   STEP 2: Configure Database
echo ============================================
echo.
echo MySQL server should be running.
echo Using configured password from .env file.
echo.

:: Generate random JWT secret
set "JWT_SECRET=market_masters_%random%%random%%random%"

:: Create .env file with your MySQL password
(
    echo # Market Masters Configuration
    echo DB_HOST=localhost
    echo DB_PORT=3306
    echo DB_NAME=market_masters
    echo DB_USER=root
    echo DB_PASSWORD=srujan@0513
    echo JWT_SECRET=%JWT_SECRET%
    echo JWT_EXPIRE=7d
    echo PORT=5000
    echo NODE_ENV=production
    echo.
    echo # Optional: Twilio SMS/WhatsApp
    echo TWILIO_ACCOUNT_SID=
    echo TWILIO_AUTH_TOKEN=
    echo TWILIO_WHATSAPP_NUMBER=
    echo TWILIO_PHONE_NUMBER=
) > "%~dp0backend\.env"

echo [OK] Configuration saved
echo.

echo ============================================
echo   STEP 3: Test Database Connection
echo ============================================
echo.
cd /d "%~dp0backend"
node test-db.js
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Database connection failed!
    echo.
    echo Please check:
    echo   [1] MySQL Server is running
    echo   [2] Database 'market_masters' exists
    echo   [3] Password in backend\.env is correct
    echo.
    echo To create database:
    echo   mysql -u root -p -e "CREATE DATABASE market_masters CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    cd /d "%~dp0"
    pause
    exit /b 1
)
cd /d "%~dp0"
echo.

echo ============================================
echo   SETUP COMPLETE!
echo ============================================
echo.
echo Next Steps:
echo   1. Double-click Start.bat to launch
echo   2. Browser opens at http://localhost:5000
echo   3. Create your shopkeeper account
echo.
echo Configuration:
echo   - Port: 5000
echo   - Database: MySQL (market_masters)
echo   - API: /api
echo.
echo Production Deployment:
echo   - Update JWT_SECRET in backend\.env
echo   - Add Twilio credentials for SMS/WhatsApp
echo   - Use PM2: npm install -g pm2
echo   - Run: pm2 start backend/server.js --name market-masters
echo.
pause
