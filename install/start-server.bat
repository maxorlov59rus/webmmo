@echo off
chcp 65001 >nul
title Ночь Военного Ремесла - Игровой сервер
cd /d "%~dp0"
if not exist "..\server\node_modules" (
    echo [!] Сервер не установлен. Сначала запустите setup.bat
    pause & exit /b 1
)
if not exist "..\server\.env" copy "..\server\.env.example" "..\server\.env" >nul
for /f "usebackq tokens=1,* delims==" %%a in ("..\server\.env") do (
    if /i "%%a"=="PORT" set PORT=%%b
)
if "%PORT%"=="" set PORT=3000
echo [*] Запуск игрового сервера... Клиент: http://localhost:%PORT%
echo     ^(параметры БД берутся из server\.env; остановка - Ctrl+C^)
echo     Подключение игроков: http://localhost:%PORT%/?api=http://localhost:%PORT%^&server=ws://localhost:%PORT%/ws
node ..\server\server.js
pause
