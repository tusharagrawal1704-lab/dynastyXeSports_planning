@echo off
title DynastyX Tactical Hub - Launcher
color 0A

echo ========================================================
echo        DynastyX BGMI Tactical Hub Launcher
echo ========================================================
echo Starting Express Backend & Socket Server...
echo Starting Vite Frontend Tactical Planner...
echo.

cd /d "%~dp0"
call npm run dev

pause
