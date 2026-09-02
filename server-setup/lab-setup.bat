@echo off
REM L.A.B first-server setup bootstrapper - run this ON THE G50
title L.A.B - Ubuntu Server setup
echo Fetching setup logic from Twizzler over the cable...
curl.exe -L -o "%TEMP%\lab-setup.ps1" http://169.254.61.215:8000/lab-setup.ps1
if errorlevel 1 (
  echo.
  echo Could not reach Twizzler at 169.254.61.215:8000
  echo   - Is the ethernet cable in both machines?
  echo   - Does this PC's Ethernet have a 169.254.x.x address?  ^(run: ipconfig^)
  echo   - On Twizzler: firewall allowing TCP 8000 ^(or off^), serve.js running?
  echo.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP%\lab-setup.ps1"
echo.
pause
