@echo off
rem Start condoVotes locally. Options: -Seed -Dev -Build -NoBrowser (see scripts\local\start.ps1)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\local\start.ps1" %*
if errorlevel 1 pause
