@echo off
chcp 65001 >nul
title Math Platform Launcher
cd /d "%~dp0"

if not exist server.js (
  echo ERROR: Put this file inside the yt-platform folder, next to server.js
  pause
  exit /b
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Installing it now...
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  echo.
  echo Done. CLOSE this window, then double-click start.bat again.
  pause
  exit /b
)

where cloudflared >nul 2>nul
if errorlevel 1 (
  echo cloudflared not found. Installing it now...
  winget install -e --id Cloudflare.cloudflared --accept-source-agreements --accept-package-agreements
  echo.
  echo Done. CLOSE this window, then double-click start.bat again.
  pause
  exit /b
)

if not exist data\db.json (
  echo ===== First run: create the admin account =====
  set /p ADMIN_PHONE=Admin login (phone or any name, e.g. 01012345678): 
  set /p ADMIN_PASS=Admin password (strong, 6+ chars): 
)

echo Starting the platform server...
start "Platform Server - do not close" cmd /k node server.js
timeout /t 4 >nul

echo.
echo ==============================================================
echo  Look below for a link like:  https://xxxx.trycloudflare.com
echo  Send that link to your students.
echo  Keep BOTH windows open while students are using the platform.
echo ==============================================================
echo.
cloudflared tunnel --url http://localhost:3000
pause
