@echo off
rem =============================================================
rem make-itch-zip.bat - packt das Spiel als ZIP fuer itch.io
rem -------------------------------------------------------------
rem Einfach doppelklicken. Danach liegt "streetbattle-itch.zip"
rem im Spielordner. Diese Datei bei itch.io hochladen.
rem In der ZIP liegen nur die Dateien, die das Spiel braucht
rem (index.html ganz oben, wie itch.io es verlangt).
rem =============================================================

chcp 65001 >nul
cd /d "%~dp0.."

if exist streetbattle-itch.zip del streetbattle-itch.zip

rem Das in Windows 10/11 eingebaute "tar" erzeugt saubere ZIP-Dateien
set "WINTAR=%SystemRoot%\System32\tar.exe"
if not exist "%WINTAR%" goto powershell
"%WINTAR%" -a -c -f streetbattle-itch.zip index.html style.css manifest.webmanifest icon.svg sw.js src
if errorlevel 1 goto powershell
goto done

:powershell
powershell -NoProfile -Command "Compress-Archive -Path index.html,style.css,manifest.webmanifest,icon.svg,sw.js,src -DestinationPath streetbattle-itch.zip -Force"
if errorlevel 1 (
  echo Die ZIP-Datei konnte nicht erstellt werden.
  pause
  exit /b 1
)

:done
echo.
echo Fertig! Die Datei streetbattle-itch.zip liegt jetzt im Spielordner:
echo %cd%
echo.
echo Diese ZIP-Datei bei itch.io hochladen (siehe README.md).
pause
