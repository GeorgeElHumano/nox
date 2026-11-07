; Instalador de NOX para Windows (Inno Setup 6). Lo arma .github/workflows/release.yml.
; Se instala para el usuario (sin pedir permisos de administrador), deja el acceso directo
; en el escritorio y en el menú Inicio, y se desinstala desde "Agregar o quitar programas".
#ifndef AppVer
  #define AppVer "1.0.0"
#endif

[Setup]
; las rutas son desde la raíz del repositorio
SourceDir=..
AppId={{3F5B3ECA-5822-4549-B45F-FA68CE4FBBB0}
AppName=NOX
AppVersion={#AppVer}
AppVerName=NOX {#AppVer}
AppPublisher=The BnKr Media
AppPublisherURL=https://noxparaguay.com
AppSupportURL=https://noxparaguay.com
DefaultDirName={localappdata}\Programs\NOX
DefaultGroupName=NOX
DisableProgramGroupPage=yes
DisableDirPage=yes
DisableReadyPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=.
OutputBaseFilename=NOX-Instalador
SetupIconFile=desktop\icon.ico
UninstallDisplayIcon={app}\NOX.exe
UninstallDisplayName=NOX - Crónicas del Paraguay
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes

[Languages]
Name: "es"; MessagesFile: "compiler:Languages\Spanish.isl"

[Files]
Source: "NOX\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autodesktop}\NOX"; Filename: "{app}\NOX.exe"; WorkingDir: "{app}"; Comment: "NOX - Crónicas del Paraguay"
Name: "{group}\NOX"; Filename: "{app}\NOX.exe"; WorkingDir: "{app}"
Name: "{group}\Desinstalar NOX"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\NOX.exe"; Description: "Abrir NOX ahora"; Flags: nowait postinstall skipifsilent
