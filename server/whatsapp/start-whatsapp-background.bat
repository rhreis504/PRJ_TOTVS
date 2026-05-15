@echo off
cd /d "%~dp0"
echo Iniciando Cockpit WhatsApp Service em segundo plano...
start "Cockpit WhatsApp Service" /min cmd /c "npm start >> whatsapp-service.log 2>&1"
echo Serviço iniciado. Aguarde alguns segundos.
echo Teste: http://127.0.0.1:4545/health
pause
