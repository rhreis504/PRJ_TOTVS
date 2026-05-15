@echo off
echo ==========================================
echo Testando Cockpit WhatsApp Service
echo ==========================================
echo.
echo Teste /health:
powershell -Command "try { Invoke-RestMethod http://localhost:4545/health | ConvertTo-Json -Depth 5 } catch { Write-Host $_.Exception.Message; exit 1 }"
echo.
echo Teste /status:
powershell -Command "try { Invoke-RestMethod http://localhost:4545/status | ConvertTo-Json -Depth 5 } catch { Write-Host $_.Exception.Message; exit 1 }"
echo.
pause
