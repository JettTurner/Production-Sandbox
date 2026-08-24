; Inno Setup script — Folder Hierarchy Studio
;
; Compiled by the repo-root build.bat, which passes the version from
; web/package.json:
;
;   ISCC /DMyAppVersion=0.1.0 installer\folder-hierarchy-studio.iss
;
; Input:  web\release\win-unpacked\   (electron-builder --dir output)
; Output: web\installer\Output\FolderHierarchyStudio-Setup-<version>.exe

#ifndef MyAppVersion
#define MyAppVersion "0.0.0"
#endif

; Where electron-builder left the unpacked app. build.bat overrides this with
; /DAppSourceDir=... when the packaging output lives outside the repo
; (default assumes web\release\win-unpacked).
#ifndef AppSourceDir
#define AppSourceDir "..\release\win-unpacked"
#endif

#define MyAppName "Folder Hierarchy Studio"
#define MyAppExeName "FolderHierarchyStudio.exe"
; All products of the ProductionSandbox suite live under one Program Files
; folder, each app in its own subfolder.
#define PublisherDirName "ProductionSandbox"
#define MyAppDirName "Folder Hierarchy Designer"

[Setup]
AppId={{DB014296-6B71-450A-A269-CAABF0132960}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#PublisherDirName}
; Machine-wide install: {autopf} resolves to C:\Program Files (64-bit view),
; so the app lands in Program Files\ProductionSandbox\Folder Hierarchy Designer.
DefaultDirName={autopf}\{#PublisherDirName}\{#MyAppDirName}
PrivilegesRequired=admin
OutputDir=Output
OutputBaseFilename=FolderHierarchyStudio-Setup-{#MyAppVersion}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
; Same icon electron-builder embeds into the exe (generated from
; public/Production-Sandbox_Icon.svg by scripts/make-icon.mjs).
SetupIconFile=..\build\icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "{#AppSourceDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#MyAppName}}"; Flags: nowait postinstall skipifsilent
