@echo off
setlocal
title Gripr launcher (production)

rem Builds and starts the API and the storefront in production mode, each in
rem its own window. Much faster than start-gripr.bat (development mode): pages
rem are compiled once by the build instead of on every first visit.
rem Expects Gripr_frontend next to Gripr_backend and filled-in .env files.

set "BACKEND=%~dp0"
set "FRONTEND=%~dp0..\Gripr_frontend\"

where node >nul 2>nul || goto :no_node
if not exist "%FRONTEND%package.json" goto :no_frontend
if not exist "%BACKEND%.env" goto :no_backend_env
if not exist "%FRONTEND%.env" goto :no_frontend_env

if not exist "%BACKEND%node_modules" (
  echo Installing backend packages...
  pushd "%BACKEND%"
  call npm.cmd ci || goto :install_failed
  popd
)
if not exist "%FRONTEND%node_modules" (
  echo Installing frontend packages...
  pushd "%FRONTEND%"
  call npm.cmd ci || goto :install_failed
  popd
)

echo Building the API...
pushd "%BACKEND%"
call npm.cmd run build || goto :build_failed
popd

echo Building the storefront (takes a minute or two)...
pushd "%FRONTEND%"
call npm.cmd run build || goto :build_failed
popd

net session >nul 2>nul
if not errorlevel 1 (
  powershell -NoProfile -Command "if (-not (Get-NetFirewallRule -DisplayName 'Gripr dev 3000' -ErrorAction SilentlyContinue)) { New-NetFirewallRule -DisplayName 'Gripr dev 3000' -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow | Out-Null; 'Firewall: opened port 3000' }"
) else (
  echo Firewall: run this file as administrator once to open port 3000 for visitors.
)

rem The site is reached over plain HTTP (http://<ip>:3000), where browsers
rem drop Secure cookies, so the session cookie is sent without Secure here.
rem Remove ACCOUNT_COOKIE_SECURE once the site is served over HTTPS.
start "Gripr backend :4000" /D "%BACKEND%" cmd /k npm.cmd run start:prod
start "Gripr frontend :3000" /D "%FRONTEND%" cmd /k "set ACCOUNT_COOKIE_SECURE=false&& npm.cmd run start"

echo.
echo Started. Close the two server windows to stop.
echo   This PC:   http://localhost:3000/uk
echo Run this file again after changing the code: it rebuilds both apps.
echo.
pause
exit /b 0

:no_node
echo Node.js is not installed. Install Node.js 22 LTS from https://nodejs.org and run this file again.
goto :fail
:no_frontend
echo Gripr_frontend was not found next to Gripr_backend: "%FRONTEND%"
goto :fail
:no_backend_env
echo Gripr_backend\.env is missing. Copy it from your main PC or fill it in from .env.example.
goto :fail
:no_frontend_env
echo Gripr_frontend\.env is missing. Copy it from your main PC or fill it in from .env.example.
goto :fail
:install_failed
popd
echo Package installation failed. See the errors above.
goto :fail
:build_failed
popd
echo The build failed. See the errors above.
goto :fail
:fail
pause
exit /b 1
