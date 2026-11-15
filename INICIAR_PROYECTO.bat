@echo off
setlocal
title Iniciar proyecto de papa
cd /d "%~dp0"

if not exist "%~dp0env\Scripts\python.exe" (
  echo No se encontro el entorno de Python del proyecto.
  echo Ruta esperada: %~dp0env\Scripts\python.exe
  pause
  exit /b 1
)

echo Iniciando el servidor del proyecto...
start "Servidor del proyecto" /min cmd /k ""%~dp0env\Scripts\python.exe" "%~dp0modules\diagnostico-hojas\server.py""

powershell -NoProfile -ExecutionPolicy Bypass -Command "$url='http://127.0.0.1:8001'; for($i=0; $i -lt 45; $i++){ try { $logistica=Invoke-RestMethod -Uri ($url + '/api/logistica/estado') -TimeoutSec 2; if($logistica.available){ Start-Process $url; exit 0 } } catch {}; Start-Sleep -Seconds 1 }; exit 1"

if errorlevel 1 (
  echo.
  echo No se pudo iniciar el servidor en http://127.0.0.1:8001
  echo Revisa la ventana "Servidor del proyecto" para ver el error.
  pause
  exit /b 1
)

endlocal
