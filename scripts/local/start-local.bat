@echo off
rem Start condoVotes locally. Options: -Seed -Dev -Build -NoBrowser (see start.ps1 next to this file)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
if errorlevel 1 pause
