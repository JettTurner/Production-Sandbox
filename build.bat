@echo off
setlocal
rem ============================================================
rem  Folder Hierarchy Studio - Electron build + Inno Setup installer
rem
rem  1. npm install (first run only)
rem  2. npm run verify   (parser/resolver regression suite)
rem  3. npm run build    (tsc -b && vite build -> web/dist)
rem  4. electron-builder --dir -> web/release/win-unpacked
rem  5. ISCC (Inno Setup) -> web/installer/Output/FolderHierarchyStudio-Setup-<version>.exe
rem ============================================================

set "ROOT=%~dp0"
set "WEB=%ROOT%web"

rem Heavy packaging output goes OUTSIDE the repo: OneDrive sync locks the
rem large win-unpacked folder and breaks electron-builder's rename step.
set "BUILD_OUT=%LOCALAPPDATA%\fh-studio-build"

echo === Folder Hierarchy Studio - Electron build ===
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js was not found on PATH. Install it from https://nodejs.org
    exit /b 1
)

cd /d "%WEB%"

if not exist node_modules (
    echo [1/5] Installing dependencies...
    call npm ci
    if errorlevel 1 call npm install
    if errorlevel 1 exit /b 1
) else (
    echo [1/5] Dependencies already installed - skipping.
)

echo [2/5] Running regression suite...
call npm run verify
if errorlevel 1 exit /b 1

echo [3/5] Typechecking and building renderer...
call npm run build
if errorlevel 1 exit /b 1

echo [4/5] Packaging Electron app ^(electron-builder --dir^)...
if exist "%BUILD_OUT%" rmdir /s /q "%BUILD_OUT%"
call npx electron-builder --dir -c.directories.output="%BUILD_OUT%"
if errorlevel 1 exit /b 1

if not exist "%BUILD_OUT%\win-unpacked" (
    echo [ERROR] electron-builder did not produce win-unpacked in %BUILD_OUT%.
    exit /b 1
)

rem Locate Inno Setup compiler (ISCC.exe)
set "PF86=%ProgramFiles(x86)%"
set "PF=%ProgramFiles%"
set "ISCC="
if exist "%PF86%\Inno Setup 6\ISCC.exe" set "ISCC=%PF86%\Inno Setup 6\ISCC.exe"
if not defined ISCC if exist "%PF%\Inno Setup 6\ISCC.exe" set "ISCC=%PF%\Inno Setup 6\ISCC.exe"
if not defined ISCC where iscc >nul 2>nul && set "ISCC=iscc"
if not defined ISCC (
    echo [ERROR] Inno Setup 6 not found. Install it from https://jrsoftware.org/isdl.php
    echo         ^(or add its install dir to PATH so "iscc" is callable^).
    exit /b 1
)

for /f "usebackq delims=" %%V in (`node -p "require('./package.json').version"`) do set "APPVER=%%V"

echo [5/5] Building installer v%APPVER% with Inno Setup...
"%ISCC%" /DMyAppVersion=%APPVER% /DAppSourceDir="%BUILD_OUT%\win-unpacked" installer\folder-hierarchy-studio.iss
if errorlevel 1 exit /b 1

echo.
echo ============================================================
echo  Done. Installer:
echo    %WEB%\installer\Output\FolderHierarchyStudio-Setup-%APPVER%.exe
echo  Unpacked app:
echo    %BUILD_OUT%\win-unpacked\FolderHierarchyStudio.exe
echo ============================================================
endlocal
