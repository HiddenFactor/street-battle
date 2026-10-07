@echo off
rem =============================================================
rem start.bat - Startet STREET BATTLE (einfach doppelklicken)
rem -------------------------------------------------------------
rem 1. prueft, ob Node.js installiert ist
rem 2. startet einen kleinen Webserver (tools\serve.js)
rem 3. oeffnet das Spiel automatisch im Browser
rem Beenden: dieses Fenster schliessen oder darin Strg+C druecken.
rem =============================================================

rem Umlaute im Fenster richtig anzeigen
chcp 65001 >nul
title Street Battle

rem In den Ordner wechseln, in dem diese Datei liegt
cd /d "%~dp0"

rem 1. Ist Node.js installiert?
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js wurde nicht gefunden.
  echo Bitte installiere Node.js ^("LTS"^) von https://nodejs.org
  echo und starte diese Datei danach noch einmal.
  pause
  exit /b 1
)

rem 2. + 3. Server starten und Browser oeffnen
node tools\serve.js --open

rem Falls der Server mit einem Fehler endet: Fenster offen lassen
echo.
echo Der Server wurde beendet.
pause
