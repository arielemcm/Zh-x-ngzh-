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

echo Iniciando el servidor y preparando el modelo...
start "Servidor del proyecto" /min cmd /k ""%~dp0env\Scripts\python.exe" "%~dp0modules\diagnostico-hojas\server.py""

powershell -NoProfile -ExecutionPolicy Bypass -Command "$url='http://127.0.0.1:8001'; for($i=0; $i -lt 90; $i++){ try { $state=Invoke-RestMethod -Uri ($url + '/api/model') -TimeoutSec 2; if($state.status -eq 'ready'){ Start-Process $url; exit 0 } } catch {}; Start-Sleep -Seconds 1 }; Start-Process $url; exit 1"

if errorlevel 1 (
  echo El navegador se abrio, pero el modelo demoro mas de lo esperado.
  echo Espera unos segundos y vuelve a cargar la pagina.
  pause
)

endlocal
