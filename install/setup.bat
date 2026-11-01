@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
rem ============================================================
rem  НОЧЬ ВОЕННОГО РЕМЕСЛА - установка сервера + MySQL (XAMPP)
rem  Запускать ДВОЙНЫМ ЩЕЛЧКОМ на Windows. Работает из cmd/PowerShell.
rem  Требования: Node.js 18+, XAMPP (Apache+MySQL запущены в панели).
rem ============================================================
title Ночь Военного Ремесла - Установка
cd /d "%~dp0"

echo.
echo  ============================================================
echo    НОЧЬ ВОЕННОГО РЕМЕСЛА - подготовка к запуску
echo  ============================================================
echo.

rem ---------- 1. Node.js ----------
where node >nul 2>nul
if errorlevel 1 (
    echo [ОШИБКА] Node.js не найден в PATH.
    echo Установите его с https://nodejs.org/ (LTS 18 или новее) и перезапустите скрипт.
    pause & exit /b 1
)
for /f "delims=" %%v in ('node -v') do echo [OK] Node.js %%v

rem ---------- 2. Поиск MySQL/MariaDB (XAMPP) ----------
set "MYSQL_EXE="
for %%d in (C:\xampp D:\xampp E:\xampp %LOCALAPPDATA%\Programs\xampp C:\xampp8) do (
    if exist "%%d\mysql\bin\mysql.exe" set "MYSQL_EXE=%%d\mysql\bin\mysql.exe"
)
if not defined MYSQL_EXE (
    where mysql >nul 2>nul && for /f "delims=" %%p in ('where mysql') do if not defined MYSQL_EXE set "MYSQL_EXE=%%p"
)
if not defined MYSQL_EXE (
    echo [ВНИМАНИЕ] mysql.exe не найден (XAMPP?). Продолжаю без ручной проверки БД:
    echo             сервер сам создаст таблицы при старте, если MySQL запущен.
) else (
    echo [OK] MySQL-клиент: !MYSQL_EXE!
)

rem ---------- 3. Конфигурация ----------
if not exist "..\server\.env" (
    copy "..\server\.env.example" "..\server\.env" >nul
    echo [OK] Создан server\.env из шаблона.
) else (
    echo [OK] server\.env уже существует - оставляю без изменений.
)
rem читаем значения из .env
for /f "usebackq tokens=1,* delims==" %%a in ("..\server\.env") do (
    if /i "%%a"=="PORT"    set PORT=%%b
    if /i "%%a"=="DB_HOST" set DB_HOST=%%b
    if /i "%%a"=="DB_PORT" set DB_PORT=%%b
    if /i "%%a"=="DB_USER" set DB_USER=%%b
    if /i "%%a"=="DB_PASS" set DB_PASS=%%b
    if /i "%%a"=="DB_NAME" set DB_NAME=%%b
)
if "%PORT%"=="" set PORT=3000
if "%DB_HOST%"=="" set DB_HOST=127.0.0.1
if "%DB_PORT%"=="" set DB_PORT=3306
if "%DB_USER%"=="" set DB_USER=root
if "%DB_NAME%"=="" set DB_NAME=nvr_game
echo [*] Параметры: порт игры=%PORT%, MySQL=%DB_HOST%:%DB_PORT% пользователь=%DB_USER% база=%DB_NAME%

rem ---------- 4. npm install ----------
echo [*] Установка зависимостей сервера (express, ws, mysql2)...
pushd ..\server
call npm install --no-audit --no-fund
if errorlevel 1 ( popd & echo [ОШИБКА] npm install не удался. Проверьте интернет и Node.js. & pause & exit /b 1 )
popd
echo [OK] Зависимости установлены.

rem ---------- 5. Развертывание БД ----------
echo.
if defined MYSQL_EXE (
    echo [*] Применяю схему server\schema.sql к MySQL...
    "!MYSQL_EXE!" -h %DB_HOST% -P %DB_PORT% -u %DB_USER% %DB_PASS:=-p%DB_PASS% < "..\server\schema.sql"
    if errorlevel 1 (
        echo [ОШИБКА] Не удалось применить схему. Убедитесь, что MySQL запущен в панели XAMPP,
        echo          и что DB_USER/DB_PASS в server\.env верны ^(у XAMPP по умолчанию root/^без пароля^).
        pause & exit /b 1
    )
    echo [OK] База "%DB_NAME%" и таблицы созданы.
) else (
    echo [ПРОПУСК] Схема будет создана автоматически сервером при первом запуске ^(DB_AUTOINIT=1^).
)

rem ---------- 6. Готово ----------
echo.
echo  ============================================================
echo    УСТАНОВКА ЗАВЕРШЕНА
echo    Запустите:  start-server.bat   ^(или двойным щелчком^)
echo    Затем откройте браузер:
echo      http://localhost:%PORT%/?api=http://localhost:%PORT%^&server=ws://localhost:%PORT%/ws
echo  ============================================================
pause
