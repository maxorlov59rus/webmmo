@echo off
chcp 65001 >nul
rem Ручной импорт схемы в MySQL (например, через консоль XAMPP)
cd /d "%~dp0"
for /f "usebackq tokens=1,* delims==" %%a in ("..\server\.env") do (
    if /i "%%a"=="DB_HOST" set DB_HOST=%%b
    if /i "%%a"=="DB_PORT" set DB_PORT=%%b
    if /i "%%a"=="DB_USER" set DB_USER=%%b
    if /i "%%a"=="DB_PASS" set DB_PASS=%%b
)
if "%DB_HOST%"=="" set DB_HOST=127.0.0.1
if "%DB_PORT%"=="" set DB_PORT=3306
if "%DB_USER%"=="" set DB_USER=root
set "MYSQL_EXE="
for %%d in (C:\xampp D:\xampp E:\xampp) do if exist "%%d\mysql\bin\mysql.exe" set "MYSQL_EXE=%%d\mysql\bin\mysql.exe"
if not defined MYSQL_EXE ( where mysql >nul 2>nul && set "MYSQL_EXE=mysql" )
if not defined MYSQL_EXE ( echo mysql.exe не найден. Укажите путь вручную и повторите. & pause & exit /b 1 )
"!MYSQL_EXE!" -h %DB_HOST% -P %DB_PORT% -u %DB_USER% %DB_PASS:=-p%DB_PASS% < ..\server\schema.sql
if errorlevel 1 (echo ОШИБКА импорта. Проверьте, что MySQL запущен.) else (echo Схема применена успешно.)
pause
