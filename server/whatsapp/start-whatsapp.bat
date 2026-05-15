@echo off
echo ==========================================
echo Iniciando Cockpit WhatsApp Service
echo ==========================================
cd /d "%~dp0"
echo Pasta atual:
cd
echo.
echo Instalando dependencias...
call npm install
echo.
echo Iniciando servidor...
call npm start
pause
