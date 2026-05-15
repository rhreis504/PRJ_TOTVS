@echo off
title Check Cockpit WhatsApp Service
cd /d "%~dp0"
echo ==========================================
echo Rodando WhatsApp Doctor
echo ==========================================
node whatsapp-doctor.cjs
pause
