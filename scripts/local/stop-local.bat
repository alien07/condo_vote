@echo off
rem Stop condoVotes locally. Options: -AppOnly -Docker (see stop.ps1 next to this file)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop.ps1" %*
