@echo off
chcp 65001 >nul
echo ============================================================
echo   RöK BoX — Instalador del Agente de Sincronización HikCentral
echo ============================================================
echo.

set SCRIPT_DIR=%~dp0
set AGENT_PATH=%SCRIPT_DIR%sync_agent.py

echo 1. Instalando dependencias de Python...
pip install -r "%SCRIPT_DIR%requirements.txt"
if %errorlevel% neq 0 (
    echo [ERROR] No se pudieron instalar las dependencias. Verifica que Python y pip estén en el PATH.
    pause
    exit /b %errorlevel%
)

echo 2. Creando Tarea Programada de Windows 'RokBoxHikCentralSync'...
schtasks /create /tn "RokBoxHikCentralSync" /tr "python \"%AGENT_PATH%\"" /sc onstart /ru SYSTEM /f
if %errorlevel% neq 0 (
    echo [ADVERTENCIA] No se pudo crear como SYSTEM, intentando como usuario actual...
    schtasks /create /tn "RokBoxHikCentralSync" /tr "python \"%AGENT_PATH%\"" /sc onstart /f
)

echo.
echo ============================================================
echo   ¡Instalación completada exitosamente!
echo   El agente se iniciará automáticamente con Windows cada vez
echo   que se encienda el PC del box.
echo ============================================================
echo.
echo Para ejecutar una prueba manual ahora mismo:
echo python "%AGENT_PATH%" --once
echo.
pause
