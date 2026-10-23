@echo off
title TERRA COTTA - Application Principale
color 0A

:: Configuration
set PROJECT_DIR=C:\MesApplications\TERRACOTTA2
set PORT=5173
set APP_URL=http://localhost:%PORT%

:: Aller dans le dossier du projet
cd /d "%PROJECT_DIR%"

:: Vérifier si le port est déjà utilisé
netstat -ano | findstr :%PORT% > nul
if %errorlevel% equ 0 (
    cls
    echo ========================================
    echo    ⚠️  Port %PORT% déjà occupé
    echo ========================================
    echo.
    choice /C YN /M "Voulez-vous libérer le port %PORT%"
    if errorlevel 2 goto :skip_kill
    if errorlevel 1 (
        for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PORT%') do (
            taskkill /F /PID %%a 2>nul
        )
        echo ✅ Port libéré
        timeout /t 2 /nobreak >nul
    )
)

:skip_kill
cls
echo ========================================
echo    🍽️  TERRA COTTA RESTAURANT
echo    Application Principale
echo ========================================
echo.
echo 📦 Vérification des dépendances...

:: Installation si nécessaire
if not exist "node_modules\" (
    echo 📦 Installation des dépendances...
    call npm install
    echo.
)

echo ✅ Dépendances OK
echo.
echo 🚀 Démarrage du serveur...
echo.

:: Démarrer l'application
start /B npm run dev > server.log 2>&1

:: Attendre que le serveur soit prêt
echo ⏳ Attente du serveur...
timeout /t 3 /nobreak >nul

:: Vérifier que le serveur répond
:wait_for_server
curl -s http://localhost:%PORT% > nul 2>&1
if %errorlevel% neq 0 (
    timeout /t 1 /nobreak >nul
    goto wait_for_server
)

:: Ouvrir UNIQUEMENT l'application principale (PAS le menu)
echo.
echo 🌐 Ouverture de l'application principale...
start "" "%APP_URL%"

cls
echo ========================================
echo    ✅ APPLICATION LANCÉE AVEC SUCCÈS
echo ========================================
echo.
echo 📱 Application principale :
echo    %APP_URL%
echo.
echo ========================================
echo    📋 INFORMATIONS DE CONNEXION
echo ========================================
echo.
echo 🔑 Email    : admin@restaurant.com
echo 🔑 Mot de passe : Admin123456!
echo.
echo ========================================
echo    ⚠️  IMPORTANT
echo ========================================
echo.
echo ✓ L'application s'ouvre dans votre navigateur
echo ✓ Ne fermez PAS cette fenêtre !
echo ✓ Pour arrêter : Fermez cette fenêtre
echo ✓ Ou appuyez sur Ctrl+C
echo.
echo ========================================
echo.

:: Garder la fenêtre ouverte
pause > nul