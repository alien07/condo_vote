@echo off
rem Stop condoVotes locally. Options: -AppOnly -Docker (see scripts\local\stop.ps1)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\local\stop.ps1" %*
