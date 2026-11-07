; Free GST Billing - Windows Setup (v1.10.84). Inno Setup 6.
;
; Built by `npm run release:exe` (scripts/build-installer.mjs), which stages
; the app exactly like the release ZIP, adds the official portable node.exe
; and compiles this file:
;   ISCC.exe /DAppVersion=1.10.84 /DStageDir=<staged app> /DNodeExe=<node.exe>
;            /DOutputDir=<release-build> installer\free-gst-billing.iss
;
; What it does (docs/WINDOWS_SETUP.md has the long version):
;   - installs per user (no administrator) to
;     %LOCALAPPDATA%\Programs\Free GST Billing, with its own node.exe - or to
;     "...\Free GST Billing App" when the one-line installer's copy already
;     lives in the first folder (never into another program's folder);
;   - asks where the books are: every earlier copy found on this PC is listed
;     (last changed first) and the user picks one: keep it where it is, or
;     COPY it to C:\Users\<name>\Free GST Billing; or new books there;
;   - checks first that the app can write there (Controlled folder access,
;     ERR-082) and that PowerShell is present; Node.js comes inside Setup;
;   - the top rule: NOTHING inside an earlier installation is ever written,
;     moved, renamed or deleted. Copy checks every file (SHA-256) first; old
;     shortcuts are moved into a backup folder after a successful install,
;     never deleted; the old data is zipped into the NEW folder first;
;   - an update (same AppId) stops the app, puts the new program files in,
;     only THEN removes old ones the new version does not have, and keeps
;     home.txt (the books folder) and the books;
;   - the uninstaller removes the program and icons, and deletes books only
;     after an explicit Yes, and never in a folder that is not plainly a
;     books folder.
;
; Command line (all optional):
;   /DATAMODE=keep|move|new|choose  the books question, for silent installs
;   /OLDDIR=<folder>                keep/move: which earlier copy (needed when
;                                   more than one is found)
;   /DATADIR=<folder>               choose: the books folder; move/new: where to
;   /NOSTART=1                      do not start the app at the end
;   /DELETEBOOKS=yes                uninstaller: also delete the books
;   /TESTROOT=<folder>              TEST MODE: everything (app, books, icons,
;                                   the search for earlier copies) stays inside
;                                   that folder; its own AppId; no window opens
;   /PORT=<n>                       test mode: port for new books (47461)
;   /FAKEWEBVIEW2=<program>         test mode: act as if the WebView2 Runtime
;                                   were missing and run <program> instead of
;                                   Microsoft's installer (never a real install)

#ifndef AppVersion
  #error AppVersion is not defined - build with npm run release:exe
#endif
#ifndef StageDir
  #error StageDir is not defined - build with npm run release:exe
#endif
#ifndef NodeExe
  #error NodeExe is not defined - build with npm run release:exe
#endif
#ifndef Bootstrapper
  #error Bootstrapper is not defined - build with npm run release:exe
#endif
#ifndef OutputDir
  #define OutputDir "..\release-build"
#endif

[Setup]
AppId={code:GetAppId}
AppName=Free GST Billing
AppVersion={#AppVersion}
AppVerName=Free GST Billing {#AppVersion}
AppPublisher=DiceCodes
AppPublisherURL=https://github.com/IamRamgarhia/Free-GST-Billing-Software
AppSupportURL=https://github.com/IamRamgarhia/Free-GST-Billing-Software/issues
AppUpdatesURL=https://github.com/IamRamgarhia/Free-GST-Billing-Software/releases
DefaultDirName={code:GetAppDir}
UsePreviousAppDir=no
UsePreviousLanguage=no
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
; Review M1: two Setups at once never run (one could undo the other's copy).
SetupMutex=FreeGSTBillingSetup
OutputDir={#OutputDir}
OutputBaseFilename=Free-GST-Billing-Windows-Setup
SetupIconFile={#StageDir}\app-icon.ico
UninstallDisplayIcon={app}\app-icon.ico
UninstallDisplayName=Free GST Billing
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
CloseApplications=no
RestartApplications=no
VersionInfoVersion={#AppVersion}
VersionInfoProductName=Free GST Billing
VersionInfoCompany=DiceCodes

[Tasks]
Name: desktopicon; Description: "Put a Free GST Billing icon on the Desktop"
Name: startup; Description: "Open Free GST Billing when Windows starts"; Flags: unchecked

[Files]
; First, so Setup can unpack them quickly to look for an earlier copy.
Source: "{#NodeExe}"; DestDir: "{app}\node"; Flags: ignoreversion
Source: "setup-helper.mjs"; Flags: dontcopy
; Microsoft's WebView2 Runtime installer (Evergreen bootstrapper, about 2 MB),
; unpacked to {tmp} and run only when the runtime is missing (EnsureWebView2).
Source: "{#Bootstrapper}"; DestName: "MicrosoftEdgeWebview2Setup.exe"; Flags: dontcopy
Source: "stop-app.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StageDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; (No [InstallDelete]: old program files go only after the new ones are in -
; see "prune" in CurStepChanged. A failed update leaves a working app.)

; The icons open the app's own window, Free GST Billing.exe (installer\host):
; it starts the server through start-windows.ps1 and shows the app with
; WebView2 (without WebView2: Edge's app window, as before). The same
; AppUserModelID as the window, so a pinned taskbar icon is this program.
[Icons]
Name: "{code:IconDir|programs}\Free GST Billing"; Filename: "{app}\Free GST Billing.exe"; WorkingDir: "{app}"; IconFilename: "{app}\app-icon.ico"; Comment: "Free GST Billing Software"; AppUserModelID: "{code:GetAumid}"
Name: "{code:IconDir|desktop}\Free GST Billing"; Filename: "{app}\Free GST Billing.exe"; WorkingDir: "{app}"; IconFilename: "{app}\app-icon.ico"; Comment: "Free GST Billing Software"; AppUserModelID: "{code:GetAumid}"; Tasks: desktopicon; Check: DesktopOK
; At Windows start-up: the server starts and the app waits near the clock (/tray).
Name: "{code:IconDir|startup}\Free GST Billing"; Filename: "{app}\Free GST Billing.exe"; Parameters: "/tray"; WorkingDir: "{app}"; IconFilename: "{app}\app-icon.ico"; Comment: "Free GST Billing Software"; AppUserModelID: "{code:GetAumid}"; Tasks: startup

[Run]
Filename: "{app}\Free GST Billing.exe"; WorkingDir: "{app}"; Description: "Open Free GST Billing now"; Flags: postinstall nowait skipifsilent; Check: MayStart
; A silent run (an update started from the app): start the server, open no
; second window - the app's window reloads by itself.
Filename: "{win}\System32\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\start-windows.ps1"" -NoWindow -Hidden"; WorkingDir: "{app}"; Flags: nowait runhidden; Check: MayStartSilent

[UninstallRun]
Filename: "{win}\System32\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\stop-app.ps1"" -Sys ""{app}"" -CloseWindow"; Flags: runhidden waituntilterminated; RunOnceId: "StopServer"

[UninstallDelete]
Type: files; Name: "{app}\home.txt"
Type: files; Name: "{app}\installed.txt"
; The app window's files an update set aside while the window was open, and
; its WebView2 profile and window place (never the books).
Type: files; Name: "{app}\*.old"
Type: filesandordirs; Name: "{code:HostDataDir}\WebView2"
Type: files; Name: "{code:HostDataDir}\window.txt"
Type: files; Name: "{code:HostDataDir}\tray-tip-shown.txt"
Type: dirifempty; Name: "{code:HostDataDir}"

[Code]
const
  TestPortDefault = '47461';
  LogName = 'Free GST Billing - install log.txt';
  IconName = 'Free GST Billing.lnk';

var
  TestRoot, TestPort, AppDirValue: String;
  CopySys, CopyHome, CopyInv, CopyChanged: TArrayOfString;
  OldCount, OldIndex: Integer;
  OldSys, OldHome, OldInvoices: String;
  OldHadStartup, IsUpgrade, StartupPreset, ToolsReady: Boolean;
  StoppedOwnApp, InstallDone: Boolean;
  Mode, Home, SrcHome, SrcSys, LogDir: String;
  LogLines: TStringList;
  WhichPage, DataPage: TInputOptionWizardPage;
  BrowsePage: TInputDirWizardPage;
  DeleteBooks: Boolean;
  UHome, UTestRoot: String;

function SetEnvironmentVariable(lpName, lpValue: String): BOOL;
  external 'SetEnvironmentVariableW@kernel32.dll stdcall';

{ ---------------------------------------------------------------- basics }

function IsTest: Boolean;
begin
  Result := TestRoot <> '';
end;

function GetAppId(Param: String): String;
begin
  if IsTest then Result := 'FreeGSTBilling-TEST' else Result := 'FreeGSTBilling';
end;

function GetAppDir(Param: String): String;
begin
  Result := AppDirValue;
end;

{ The app window's taskbar identity (installer\host\FreeGSTBilling.cs uses
  the same two) and its own folder: WebView2 profile, window place. }
function GetAumid(Param: String): String;
begin
  if IsTest then Result := 'DiceCodes.FreeGSTBilling.Test' else Result := 'DiceCodes.FreeGSTBilling';
end;

function HostDataDir(Param: String): String;
begin
  if IsTest then Result := TestRoot + '\LocalAppData\Free GST Billing'
  else Result := ExpandConstant('{localappdata}\Free GST Billing');
end;

function IconDir(Param: String): String;
begin
  if IsTest then begin
    if Param = 'desktop' then Result := TestRoot + '\Desktop'
    else if Param = 'startup' then Result := TestRoot + '\Startup'
    else if Param = 'taskbar' then Result := TestRoot + '\TaskBar'
    else Result := TestRoot + '\Programs';
  end else begin
    if Param = 'desktop' then Result := ExpandConstant('{userdesktop}')
    else if Param = 'startup' then Result := ExpandConstant('{userstartup}')
    else if Param = 'taskbar' then Result := ExpandConstant('{userappdata}\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar')
    else Result := ExpandConstant('{userprograms}');
  end;
end;

{ The user's own folder (C:\Users\<name>\Free GST Billing), not Documents:
  Windows Security's "Controlled folder access" blocks unknown programs from
  writing in Documents and Desktop, so books there could not be saved (seen on
  the maintainer's PC, 4 Nov 2026). }
function BooksHome: String;
begin
  if IsTest then Result := TestRoot + '\Free GST Billing'
  else Result := ExpandConstant('{%USERPROFILE}\Free GST Billing');
end;

{ A desktop that Windows will not let Setup write on: skip the Desktop icon
  (the Start menu icon is always made) instead of stopping with an error. }
var
  DesktopChecked, DesktopWritable: Boolean;

function DesktopOK: Boolean;
var
  Probe: String;
begin
  if not DesktopChecked then begin
    DesktopChecked := True;
    ForceDirectories(IconDir('desktop'));
    Probe := AddBackslash(IconDir('desktop')) + 'fgsb-write-check.tmp';
    DesktopWritable := SaveStringToFile(Probe, 'ok', False);
    if DesktopWritable then DeleteFile(Probe);
  end;
  Result := DesktopWritable;
end;

function NoSlash(S: String): String;
begin
  Result := RemoveBackslashUnlessRoot(Trim(S));
end;

{ Is Child the folder Parent or inside it? }
function IsInside(Child, Parent: String): Boolean;
begin
  Result := (Child <> '') and (Parent <> '') and
    (Pos(Lowercase(AddBackslash(NoSlash(Parent))), Lowercase(AddBackslash(NoSlash(Child)))) = 1);
end;

{ A command-line argument in double quotes, read back exactly by Windows
  programs: a trailing backslash is doubled, or "E:\" would end in \" (an
  escaped quote). Paths never contain a double quote. An empty one stays an
  argument. (scripts/installer-test.mjs checks this rule.) }
function Q(S: String): String;
begin
  if (Length(S) > 0) and (S[Length(S)] = '\') then S := S + '\';
  Result := '"' + S + '"';
end;

procedure AddStr(var A: TArrayOfString; S: String);
begin
  SetArrayLength(A, GetArrayLength(A) + 1);
  A[GetArrayLength(A) - 1] := S;
end;

procedure AddLog(S: String);
begin
  Log(S);
  LogLines.Add(GetDateTimeString('yyyy-mm-dd hh:nn:ss', '-', ':') + '  ' + S);
end;

function LogFile: String;
begin
  Result := AddBackslash(LogDir) + LogName;
end;

procedure SaveLog;
var
  A: TArrayOfString;
  I: Integer;
begin
  if (LogDir = '') or (LogLines.Count = 0) then exit;
  ForceDirectories(LogDir);
  for I := 0 to LogLines.Count - 1 do AddStr(A, LogLines[I]);
  AddStr(A, '');
  SaveStringsToUTF8File(LogFile, A, True);
  LogLines.Clear;
end;

function StripBom(S: String): String;
begin
  Result := S;
  if (Length(Result) > 0) and (Ord(Result[1]) = $FEFF) then Result := Copy(Result, 2, MaxInt);
end;

{ First line of a UTF-8 text file (home.txt), or ''. }
function ReadFirstLine(FileName: String): String;
var
  A: TArrayOfString;
begin
  Result := '';
  if LoadStringsFromFile(FileName, A) and (GetArrayLength(A) > 0) then Result := Trim(StripBom(A[0]));
end;

function ValueOf(const A: TArrayOfString; Key: String): String;
var
  I: Integer;
  L: String;
begin
  Result := '';
  for I := 0 to GetArrayLength(A) - 1 do begin
    L := StripBom(A[I]);
    if Pos(Key + '=', L) = 1 then begin
      Result := Copy(L, Length(Key) + 2, MaxInt);
      exit;
    end;
  end;
end;

{ Books worth the name: a business profile or invoices, clients or profiles
  saved (the same rule as setup-helper.mjs hasBooks). }
function HasJson(Dir: String): Boolean;
var
  F: TFindRec;
begin
  Result := FindFirst(AddBackslash(Dir) + '*.json', F);
  if Result then FindClose(F);
end;

function HasBooks(Home_: String): Boolean;
begin
  Result := FileExists(AddBackslash(Home_) + 'data\profile.json') or HasJson(AddBackslash(Home_) + 'data\bills') or
            HasJson(AddBackslash(Home_) + 'data\clients') or HasJson(AddBackslash(Home_) + 'data\profiles');
end;

{ Review H1: never install into a folder that is not ours. The one-line
  installer (v1.10.83) put its ZIP copy in ...\Programs\Free GST Billing\_system,
  so a Setup copy then goes to "...\Free GST Billing App". }
procedure SettleAppDir;
var
  Base: String;
begin
  if IsTest then Base := TestRoot + '\Programs\Free GST Billing'
  else Base := ExpandConstant('{localappdata}\Programs\Free GST Billing');
  if FileExists(Base + '\installed.txt') then AppDirValue := Base
  else if FileExists(Base + ' App\installed.txt') then AppDirValue := Base + ' App'
  else if DirExists(Base) then AppDirValue := Base + ' App'
  else AppDirValue := Base;
end;

{ ---------------------------------------------------- helper programs }

procedure EnsureTools;
begin
  if ToolsReady then exit;
  ExtractTemporaryFile('node.exe');
  ExtractTemporaryFile('setup-helper.mjs');
  ExtractTemporaryFile('stop-app.ps1');
  ToolsReady := True;
end;

{ Runs setup-helper.mjs; its key=value result is in Res, its log= lines go to
  the install log. True when it succeeded. }
function RunHelper(Args: String; var Res: TArrayOfString): Boolean;
var
  Code, I: Integer;
  OutFile: String;
begin
  EnsureTools;
  OutFile := ExpandConstant('{tmp}\helper-out.txt');
  DeleteFile(OutFile);
  Result := Exec(ExpandConstant('{tmp}\node.exe'), Q(ExpandConstant('{tmp}\setup-helper.mjs')) + ' ' + Args + ' ' + Q(OutFile),
    ExpandConstant('{tmp}'), SW_HIDE, ewWaitUntilTerminated, Code) and (Code = 0);
  SetArrayLength(Res, 0);
  if not LoadStringsFromFile(OutFile, Res) then begin
    AddStr(Res, 'error=The Setup helper did not answer (code ' + IntToStr(Code) + ').');
    Result := False;
  end;
  for I := 0 to GetArrayLength(Res) - 1 do
    if Pos('log=', Res[I]) > 0 then AddLog(Copy(Res[I], Pos('log=', Res[I]) + 4, MaxInt));
end;

{ Stops the server of one copy - by its own process id only (stop-app.ps1).
  -File with separate arguments (review M6): a folder name is never parsed as
  PowerShell code, whatever quotes it has. }
procedure RunStop(Sys, Books: String);
var
  Code: Integer;
  OutFile, Args: String;
  A: TArrayOfString;
begin
  EnsureTools;
  OutFile := ExpandConstant('{tmp}\stop-out.txt');
  DeleteFile(OutFile);
  Args := '-NoProfile -ExecutionPolicy Bypass -File ' + Q(ExpandConstant('{tmp}\stop-app.ps1')) + ' -Sys ' + Q(Sys) + ' -Out ' + Q(OutFile);
  if Books <> '' then Args := Args + ' -Books ' + Q(Books);
  if IsTest then Args := Args + ' -Test';
  Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'), Args, '', SW_HIDE, ewWaitUntilTerminated, Code);
  if LoadStringsFromFile(OutFile, A) and (GetArrayLength(A) > 0) then
    AddLog('Stopping the app of ' + Sys + ': ' + ValueOf(A, 'stopped'))
  else
    AddLog('Stopping the app of ' + Sys + ': no answer (code ' + IntToStr(Code) + ')');
end;

procedure StartApp(Args: String);
var
  Code: Integer;
begin
  Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
    '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ' + Q(GetAppDir('') + '\start-windows.ps1') + ' ' + Args,
    GetAppDir(''), SW_HIDE, ewNoWait, Code);
end;

{ ---------------------------------------------------- the app window }

{ An update is usually started from the app's own window, whose exe and DLLs
  Windows keeps locked while it is open. A running program's files can be
  RENAMED, though: they are set aside as "<name>.old" and the new ones go in
  beside them, with no reboot and no closed window (the page reloads when the
  new version answers). The window deletes *.old files when it next starts;
  so does this Setup after the install when the window is closed. }
var
  SetAside: TArrayOfString;

function SetAsideHost: String;
var
  Names: TArrayOfString;
  I: Integer;
  F, Dest: String;
begin
  Result := '';
  AddStr(Names, 'Free GST Billing.exe');
  AddStr(Names, 'Microsoft.Web.WebView2.Core.dll');
  AddStr(Names, 'Microsoft.Web.WebView2.WinForms.dll');
  AddStr(Names, 'WebView2Loader.dll');
  for I := 0 to GetArrayLength(Names) - 1 do begin
    F := GetAppDir('') + '\' + Names[I];
    if not FileExists(F) then continue;
    Dest := F + '.old';
    if FileExists(Dest) and not DeleteFile(Dest) then
      Dest := F + '.' + GetDateTimeString('yyyymmddhhnnss', #0, #0) + '.old';
    if not RenameFile(F, Dest) then begin
      Result := 'The file ' + F + ' could not be set aside for the update. Close Free GST Billing and run the update again.';
      exit;
    end;
    AddStr(SetAside, F);
    AddStr(SetAside, Dest);
  end;
  if GetArrayLength(SetAside) > 0 then AddLog('Set aside the app window''s files for the update (' + IntToStr(GetArrayLength(SetAside) div 2) + ' files, renamed to *.old).');
end;

{ The app's window needs the WebView2 Runtime (Windows 11 and most Windows
  10 PCs have it). Missing: Microsoft's own installer is run, per user, with
  a time limit. If that fails (offline), Setup carries on and the window
  uses Edge's app window instead. Test mode never installs anything real:
  /FAKEWEBVIEW2=<program> says "missing" and runs that program instead. }
const
  WebView2Key = '\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';

function WebView2Version: String;
var
  V: String;
begin
  Result := '';
  if RegQueryStringValue(HKLM, 'SOFTWARE\WOW6432Node' + WebView2Key, 'pv', V) and (V <> '') and (V <> '0.0.0.0') then Result := V
  else if RegQueryStringValue(HKCU, 'Software' + WebView2Key, 'pv', V) and (V <> '') and (V <> '0.0.0.0') then Result := V;
end;

procedure EnsureWebView2;
var
  Exe, V: String;
  Res: TArrayOfString;
begin
  V := '';
  if IsTest then begin
    Exe := ExpandConstant('{param:FAKEWEBVIEW2|}');
    if Exe = '' then begin
      AddLog('Test mode: the WebView2 Runtime is not checked or installed.');
      exit;
    end;
  end else begin
    V := WebView2Version;
    if V <> '' then begin
      AddLog('WebView2 Runtime ' + V + ' is installed (the app''s window uses it).');
      exit;
    end;
    ExtractTemporaryFile('MicrosoftEdgeWebview2Setup.exe');
    Exe := ExpandConstant('{tmp}\MicrosoftEdgeWebview2Setup.exe');
  end;
  AddLog('The WebView2 Runtime is missing: installing it with Microsoft''s installer (it downloads about 150 MB)...');
  WizardForm.StatusLabel.Caption := 'Installing the Microsoft WebView2 Runtime (for the app''s window)...';
  RunHelper('run-timed ' + Q(Exe) + ' 600 /silent /install', Res);
  if not IsTest then V := WebView2Version;
  if V <> '' then AddLog('WebView2 Runtime ' + V + ' is now installed.')
  else AddLog('The WebView2 Runtime could not be installed (no internet?). The app opens in Edge''s app window instead; nothing else is affected.');
end;

{ PutBack: the update did not finish - the window's files go back to their
  names. Otherwise the set-aside files are deleted, if no window holds them. }
procedure EndSetAside(PutBack: Boolean);
var
  I: Integer;
begin
  for I := 0 to GetArrayLength(SetAside) div 2 - 1 do begin
    if PutBack then begin
      if not FileExists(SetAside[2 * I]) then RenameFile(SetAside[2 * I + 1], SetAside[2 * I]);
    end else
      DeleteFile(SetAside[2 * I + 1]);
  end;
  SetArrayLength(SetAside, 0);
end;

{ ---------------------------------------------------- shortcuts }

{ What a shortcut opens. Read through Shell.Application, which is Unicode:
  WScript.Shell converts paths to the ANSI code page, so a shortcut under a
  user name or folder with Hindi letters could not be read at all. }
function LnkText(Lnk: String; var FirstPath, Target, WorkDir: String): String;
var
  Shell, Folder, Item, S: Variant;
  Args, Rest: String;
  P: Integer;
begin
  Result := '';
  FirstPath := '';
  Target := '';
  WorkDir := '';
  try
    Shell := CreateOleObject('Shell.Application');
    Folder := Shell.NameSpace(ExtractFileDir(Lnk));
    Item := Folder.ParseName(ExtractFileName(Lnk));
    S := Item.GetLink;
    Target := S.Path;
    Args := S.Arguments;
    WorkDir := S.WorkingDirectory;
  except
    exit;
  end;
  P := Pos('"', Args);
  if P > 0 then begin
    Rest := Copy(Args, P + 1, MaxInt);
    P := Pos('"', Rest);
    if P > 0 then FirstPath := Copy(Rest, 1, P - 1);
  end;
  Result := Lowercase(Target + '|' + Args + '|' + WorkDir);
end;

{ Does this shortcut open the copy whose server.js is in Sys? }
function OpensCopy(Text, Sys: String): Boolean;
var
  Root: String;
begin
  Result := False;
  if Sys = '' then exit;
  Root := Sys;
  if Lowercase(ExtractFileName(Sys)) = '_system' then Root := ExtractFileDir(Sys);
  Result := (Pos(Lowercase(AddBackslash(Sys)), Text) > 0) or
            (Pos(Lowercase(AddBackslash(Root)) + 'free gst billing', Text) > 0);
end;

function IsOurs(Text: String): Boolean;
begin
  Result := Pos(Lowercase(AddBackslash(GetAppDir(''))), Text) > 0;
end;

{ Candidates for "an earlier copy": what shortcuts open (Start-menu
  subfolders and taskbar pins too). }
procedure AddCandidatesFrom(Dir: String; var C: TArrayOfString; Recurse: Boolean);
var
  F: TFindRec;
  Text, FirstPath, Target, WorkDir: String;
begin
  if FindFirst(AddBackslash(Dir) + '*', F) then
  try
    repeat
      if (F.Name = '.') or (F.Name = '..') then continue;
      if (F.Attributes and FILE_ATTRIBUTE_DIRECTORY) <> 0 then begin
        if Recurse then AddCandidatesFrom(AddBackslash(Dir) + F.Name, C, True);
        continue;
      end;
      if Lowercase(ExtractFileExt(F.Name)) <> '.lnk' then continue;
      Text := LnkText(AddBackslash(Dir) + F.Name, FirstPath, Target, WorkDir);
      if (Pos('gst', Lowercase(F.Name)) > 0) or (Pos('gst', Text) > 0) or (Pos('start-windows', Text) > 0) or (Pos('server.js', Text) > 0) then begin
        if FirstPath <> '' then AddStr(C, FirstPath);
        if (Target <> '') and not IsInside(Target, ExpandConstant('{win}')) then AddStr(C, Target);
        if WorkDir <> '' then AddStr(C, WorkDir);
      end;
    until not FindNext(F);
  finally
    FindClose(F);
  end;
end;

procedure AddGstFolders(Dir: String; var C: TArrayOfString);
var
  F: TFindRec;
begin
  if FindFirst(AddBackslash(Dir) + '*GST*', F) then
  try
    repeat
      if (F.Attributes and FILE_ATTRIBUTE_DIRECTORY) <> 0 then AddStr(C, AddBackslash(Dir) + F.Name);
    until not FindNext(F);
  finally
    FindClose(F);
  end;
end;

function StartupOpens(Sys: String): Boolean;
var
  F: TFindRec;
  Dir, FirstPath, Target, WorkDir: String;
begin
  Result := False;
  Dir := IconDir('startup');
  if FindFirst(AddBackslash(Dir) + '*.lnk', F) then
  try
    repeat
      if OpensCopy(LnkText(AddBackslash(Dir) + F.Name, FirstPath, Target, WorkDir), Sys) then Result := True;
    until Result or not FindNext(F);
  finally
    FindClose(F);
  end;
end;

{ Into "<log folder>\Old shortcuts (backup)": copied (CopyOnly) or moved.
  Never deleted - put one back to undo. }
procedure BackUpLnk(Lnk, Label_: String; CopyOnly: Boolean);
var
  BackupDir, Dest: String;
  N: Integer;
begin
  BackupDir := AddBackslash(LogDir) + 'Old shortcuts (backup)';
  ForceDirectories(BackupDir);
  Dest := AddBackslash(BackupDir) + Label_ + ' - ' + ExtractFileName(Lnk);
  N := 2;
  while FileExists(Dest) do begin
    Dest := AddBackslash(BackupDir) + Label_ + ' - ' + IntToStr(N) + ' - ' + ExtractFileName(Lnk);
    N := N + 1;
  end;
  if not FileCopy(Lnk, Dest, True) then AddLog('Could not back up the shortcut ' + Lnk)
  else if CopyOnly then AddLog('Copied the shortcut ' + Lnk + ' to ' + Dest + ' (Setup''s new icon has the same name)')
  else if DeleteFile(Lnk) then AddLog('Moved the old shortcut ' + Lnk + ' to ' + Dest)
  else AddLog('Copied the old shortcut ' + Lnk + ' to ' + Dest + ', but could not take it away');
end;

{ After a successful install (review M2): every shortcut that opens the
  earlier copy, here and in subfolders, is moved to the backup folder. }
procedure MoveOldShortcutsIn(Dir, Label_: String; Recurse: Boolean);
var
  F: TFindRec;
  Lnk, Text, FirstPath, Target, WorkDir: String;
begin
  if SrcSys = '' then exit;
  if FindFirst(AddBackslash(Dir) + '*', F) then
  try
    repeat
      if (F.Name = '.') or (F.Name = '..') then continue;
      if (F.Attributes and FILE_ATTRIBUTE_DIRECTORY) <> 0 then begin
        if Recurse then MoveOldShortcutsIn(AddBackslash(Dir) + F.Name, Label_ + ' - ' + F.Name, True);
        continue;
      end;
      if Lowercase(ExtractFileExt(F.Name)) <> '.lnk' then continue;
      Lnk := AddBackslash(Dir) + F.Name;
      Text := LnkText(Lnk, FirstPath, Target, WorkDir);
      if not IsOurs(Text) and OpensCopy(Text, SrcSys) then BackUpLnk(Lnk, Label_, False);
    until not FindNext(F);
  finally
    FindClose(F);
  end;
end;

{ Just before the icons are made: a shortcut with the new icon's name that is
  not ours would be overwritten - a COPY of it goes to the backup folder. }
procedure CopyIconToBeReplaced(Dir, Label_: String);
var
  Lnk, Text, FirstPath, Target, WorkDir: String;
begin
  Lnk := AddBackslash(Dir) + IconName;
  if not FileExists(Lnk) then exit;
  Text := LnkText(Lnk, FirstPath, Target, WorkDir);
  if not IsOurs(Text) then BackUpLnk(Lnk, Label_, True);
end;

{ ---------------------------------------------------- finding earlier copies }

procedure SelectOld(I: Integer);
begin
  OldIndex := I;
  OldSys := CopySys[I];
  OldHome := CopyHome[I];
  OldInvoices := CopyInv[I];
  OldHadStartup := StartupOpens(OldSys);
end;

procedure FindOldInstalls;
var
  C, Res: TArrayOfString;
  ListFile: String;
  I: Integer;
begin
  AddCandidatesFrom(IconDir('desktop'), C, False);
  AddCandidatesFrom(IconDir('programs'), C, True);
  AddCandidatesFrom(IconDir('startup'), C, False);
  AddCandidatesFrom(IconDir('taskbar'), C, False);
  AddStr(C, BooksHome);
  if IsTest then begin
    AddStr(C, TestRoot + '\Programs\Free GST Billing');
    AddGstFolders(TestRoot + '\Downloads', C);
    AddGstFolders(TestRoot + '\Desktop', C);
    AddGstFolders(TestRoot + '\Documents', C);
  end else begin
    AddStr(C, ExpandConstant('{localappdata}\Programs\Free GST Billing'));
    AddGstFolders(ExpandConstant('{%USERPROFILE}\Downloads'), C);
    AddGstFolders(ExpandConstant('{userdesktop}'), C);
    AddGstFolders(ExpandConstant('{userdocs}'), C);
  end;
  ListFile := ExpandConstant('{tmp}\candidates.txt');
  SaveStringsToUTF8File(ListFile, C, False);
  OldCount := 0;
  OldIndex := -1;
  if RunHelper('detect ' + Q(ListFile) + ' ' + Q(GetAppDir('')) + ' ' + Q(TestRoot), Res) then begin
    OldCount := StrToIntDef(ValueOf(Res, 'count'), 0);
    for I := 1 to OldCount do begin
      AddStr(CopySys, ValueOf(Res, IntToStr(I) + '.sys'));
      AddStr(CopyHome, ValueOf(Res, IntToStr(I) + '.home'));
      AddStr(CopyInv, ValueOf(Res, IntToStr(I) + '.invoices'));
      AddStr(CopyChanged, ValueOf(Res, IntToStr(I) + '.changed'));
    end;
    if OldCount > 0 then SelectOld(0);
  end else
    AddLog('Looking for an earlier copy failed: ' + ValueOf(Res, 'error'));
  if OldCount = 0 then AddLog('No earlier copy with books was found.');
end;

{ /OLDDIR=<folder>: which listed copy (its books folder, its _system folder or
  the folder above that). -1 when none. }
function MatchOld(Dir: String): Integer;
var
  I: Integer;
begin
  Result := -1;
  Dir := NoSlash(Dir);
  for I := 0 to OldCount - 1 do
    if SameText(Dir, CopyHome[I]) or SameText(Dir, CopySys[I]) or
       ((CopySys[I] <> '') and (Lowercase(ExtractFileName(CopySys[I])) = '_system') and SameText(Dir, ExtractFileDir(CopySys[I]))) then begin
      Result := I;
      exit;
    end;
end;

{ A folder the user named as "my books": the folder itself, or its _system
  folder (the ZIP layout) - only if it really holds books (review H3). }
function BooksFolder(Dir: String): String;
begin
  Result := '';
  Dir := NoSlash(Dir);
  if Dir = '' then exit;
  if HasBooks(Dir) then Result := Dir
  else if HasBooks(Dir + '\_system') then Result := Dir + '\_system';
end;

{ ---------------------------------------------------- the books choice }

function TargetHome: String;
begin
  Result := NoSlash(ExpandConstant('{param:DATADIR|}'));
  if (Result = '') or (Mode = 'choose') then Result := BooksHome;
end;

{ Checks the choice; '' when fine, else what is wrong. Sets Home, SrcHome, SrcSys. }
function SettleChoice: String;
begin
  Result := '';
  SrcHome := '';
  SrcSys := '';
  if (Mode = 'keep') or (Mode = 'move') then begin
    if OldHome = '' then begin
      Result := 'No earlier copy of Free GST Billing with books was found. Use /DATAMODE=new or /DATAMODE=choose.';
      exit;
    end;
    SrcHome := OldHome;
    SrcSys := OldSys;
  end;
  if Mode = 'keep' then Home := OldHome
  else if Mode = 'move' then begin
    Home := TargetHome;
    if IsInside(Home, SrcHome) or IsInside(SrcHome, Home) then begin
      Result := 'Your books are already in ' + SrcHome + '. Choose "Keep using my books where they are".';
      exit;
    end;
  end else if Mode = 'choose' then begin
    if WizardSilent then SrcHome := BooksFolder(ExpandConstant('{param:DATADIR|}'))
    else SrcHome := BooksFolder(BrowsePage.Values[0]);
    if SrcHome = '' then begin
      Result := 'No books were found in that folder (no business profile, invoices or clients in its "data" folder). Choose the folder that holds "data" (for the ZIP version: the "_system" folder inside the app folder).';
      exit;
    end;
    if FileExists(SrcHome + '\server.js') then SrcSys := SrcHome;
    Home := SrcHome;
  end else if Mode = 'new' then
    Home := TargetHome
  else begin
    Result := 'Unknown /DATAMODE "' + Mode + '": use keep, move, new or choose.';
    exit;
  end;
  if IsTest and not IsInside(Home, TestRoot) then
    Result := 'Test mode: the books folder must be inside ' + TestRoot + ' (it is ' + Home + ').'
  else if IsInside(Home, GetAppDir('')) then
    Result := 'The books cannot be kept inside the program folder ' + GetAppDir('') + '.';
end;

{ Where the install log, the backup ZIP and the old shortcuts go: the new
  books folder - but never inside an earlier installation (keep / choose
  point at one), then Documents\Free GST Billing (or "... Setup"). }
procedure SettleLogDir;
begin
  LogDir := Home;
  if (Mode = 'keep') or (Mode = 'choose') then begin
    LogDir := BooksHome;
    if IsInside(LogDir, SrcHome) or IsInside(SrcHome, LogDir) or ((SrcSys <> '') and IsInside(LogDir, SrcSys)) then
      LogDir := LogDir + ' Setup';
  end;
end;

{ Silent installs never guess (review H4). }
function SilentChoice: String;
var
  I: Integer;
  OldDir, List: String;
begin
  Result := '';
  Mode := Lowercase(ExpandConstant('{param:DATAMODE|}'));
  OldDir := ExpandConstant('{param:OLDDIR|}');
  if OldDir <> '' then begin
    I := MatchOld(OldDir);
    if I < 0 then begin
      Result := '/OLDDIR=' + OldDir + ' is not one of the earlier copies found.';
      exit;
    end;
    SelectOld(I);
  end;
  if (OldCount > 1) and ((Mode = '') or (((Mode = 'keep') or (Mode = 'move')) and (OldDir = ''))) then begin
    List := '';
    for I := 0 to OldCount - 1 do List := List + #13#10 + '  ' + CopyHome[I] + ' (' + CopyInv[I] + ' invoices, last changed ' + CopyChanged[I] + ')';
    Result := 'Free GST Billing was found more than once:' + List + #13#10 +
      'Run Setup without /SILENT to choose, or give /DATAMODE=keep or move with /OLDDIR=<one of these folders>. Nothing was changed.';
    exit;
  end;
  if Mode = '' then begin
    if OldCount > 0 then Mode := 'keep' else Mode := 'new';
  end;
end;

{ ---------------------------------------------------- Setup events }

function InitializeSetup: Boolean;
var
  P: Integer;
begin
  Result := True;
  { What the app needs that Setup does not carry: Windows 10/11 64-bit is
    checked by MinVersion / ArchitecturesAllowed, Node.js comes inside Setup,
    Edge is optional (the default browser is used without it). PowerShell
    starts the app, and is part of every Windows 10/11 - unless removed. }
  if not FileExists(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe')) then begin
    MsgBox('Windows PowerShell is missing on this computer, and Free GST Billing needs it to start.' + #13#10#13#10 +
      'Turn it back on in Settings > System > Optional features (Windows PowerShell), then run Setup again. Nothing was changed.', mbError, MB_OK);
    Result := False;
    exit;
  end;
  LogLines := TStringList.Create;
  TestRoot := NoSlash(ExpandConstant('{param:TESTROOT|}'));
  if TestRoot <> '' then begin
    if not ForceDirectories(TestRoot) then begin
      MsgBox('Test mode: cannot create ' + TestRoot, mbError, MB_OK);
      Result := False;
      exit;
    end;
    TestPort := ExpandConstant('{param:PORT|' + TestPortDefault + '}');
    P := StrToIntDef(TestPort, 0);
    if (P < 1024) or (P > 65535) or ((P >= 47371) and (P <= 47373)) or (P = 47398) then begin
      MsgBox('Test mode: /PORT=' + TestPort + ' is not allowed (47371-47373 and 47398 belong to real copies).', mbError, MB_OK);
      Result := False;
      exit;
    end;
    { start-windows.ps1 then opens no window and waits for nobody. }
    SetEnvironmentVariable('FREEGSTBILL_TEST', '1');
  end;
  SettleAppDir;
  IsUpgrade := FileExists(GetAppDir('') + '\installed.txt') and (ReadFirstLine(GetAppDir('') + '\home.txt') <> '');
  if IsTest then AddLog('Free GST Billing Setup {#AppVersion} - TEST MODE in ' + TestRoot)
  else AddLog('Free GST Billing Setup {#AppVersion}');
  AddLog('Program folder: ' + GetAppDir(''));
  if IsUpgrade then begin
    Home := ReadFirstLine(GetAppDir('') + '\home.txt');
    { Review M3: never create a missing books folder, never write into an
      earlier copy's own folder ("Keep" points at one). }
    if not DirExists(Home) then LogDir := GetAppDir('')
    else if FileExists(AddBackslash(Home) + 'server.js') then LogDir := BooksHome + ' Setup'
    else LogDir := Home;
    AddLog('Updating the copy in ' + GetAppDir('') + '; books stay in ' + Home);
  end else
    FindOldInstalls;
end;

function DataIntro: String;
begin
  Result := 'Free GST Billing is already on this computer. Its books (' + OldInvoices + ' invoices) are in:' + #13#10 + OldHome + #13#10#13#10 +
    'Setup never changes or deletes anything in that folder. What should the new app use?';
end;

procedure InitializeWizard;
var
  I: Integer;
  After: Integer;
begin
  if IsUpgrade then exit;
  After := wpWelcome;
  if OldCount > 1 then begin
    WhichPage := CreateInputOptionPage(wpWelcome, 'Your books', 'Free GST Billing was found more than once',
      'Which books do you use now? The one changed last is first. Nothing in any of these folders is changed.', True, False);
    for I := 0 to OldCount - 1 do
      WhichPage.Add(CopyHome[I] + '  -  ' + CopyInv[I] + ' invoices, last changed ' + CopyChanged[I]);
    WhichPage.SelectedValueIndex := 0;
    After := WhichPage.ID;
  end;
  if OldCount > 0 then begin
    DataPage := CreateInputOptionPage(After, 'Your books', 'Where your invoices, clients and settings are kept', DataIntro, True, False);
    DataPage.Add('Keep using my books where they are (do not delete or move that folder afterwards)');
    DataPage.Add('Copy my books to ' + BooksHome + ' (the old folder stays as it is, as a backup)');
    DataPage.Add('Use books in another folder (browse)');
    DataPage.SelectedValueIndex := 0;
  end else begin
    DataPage := CreateInputOptionPage(After, 'Your books', 'Where your invoices, clients and settings are kept',
      'Your invoices, clients and settings will be kept in:' + #13#10 + BooksHome + #13#10#13#10 +
      'If you already use Free GST Billing on this computer, choose the folder that holds its books instead.', True, False);
    DataPage.Add('Start new books in ' + BooksHome);
    DataPage.Add('I already have my books in another folder (browse)');
    DataPage.SelectedValueIndex := 0;
  end;
  BrowsePage := CreateInputDirPage(DataPage.ID, 'Your books', 'Which folder holds your books?',
    'Choose the folder that has the "data" folder in it. For the ZIP version, that is the "_system" folder inside the app folder. Setup uses the books where they are and changes nothing in that folder.', False, '');
  BrowsePage.Add('');
  BrowsePage.Values[0] := ExpandConstant('{%USERPROFILE}');
end;

function InteractiveMode: String;
begin
  if OldCount > 0 then begin
    case DataPage.SelectedValueIndex of
      0: Result := 'keep';
      1: Result := 'move';
    else Result := 'choose';
    end;
  end else begin
    if DataPage.SelectedValueIndex = 0 then Result := 'new' else Result := 'choose';
  end;
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
  if IsUpgrade then exit;
  if (BrowsePage <> nil) and (PageID = BrowsePage.ID) then Result := InteractiveMode <> 'choose';
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  Problem: String;
begin
  Result := True;
  if IsUpgrade or WizardSilent then exit;
  if (WhichPage <> nil) and (CurPageID = WhichPage.ID) then begin
    SelectOld(WhichPage.SelectedValueIndex);
    DataPage.SubCaptionLabel.Caption := DataIntro;
  end;
  if ((CurPageID = DataPage.ID) and (InteractiveMode <> 'choose')) or (CurPageID = BrowsePage.ID) then begin
    Mode := InteractiveMode;
    Problem := SettleChoice;
    if Problem <> '' then begin
      MsgBox(Problem, mbError, MB_OK);
      Result := False;
    end;
  end;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if (DataPage <> nil) and (CurPageID = DataPage.ID) and (OldCount > 0) then
    DataPage.CheckListBox.ItemEnabled[1] := not (IsInside(BooksHome, OldHome) or IsInside(OldHome, BooksHome));
  { An earlier copy that opened by itself at start-up: tick the same here, once. }
  if (CurPageID = wpSelectTasks) and not IsUpgrade and OldHadStartup and not StartupPreset and (InteractiveMode <> 'new') then begin
    WizardSelectTasks('startup');
    StartupPreset := True;
  end;
  if CurPageID = wpFinished then
    WizardForm.FinishedLabel.Caption := WizardForm.FinishedLabel.Caption + #13#10#13#10 +
      'Your books are in:' + #13#10 + Home + #13#10#13#10 + 'What Setup did is written in:' + #13#10 + LogFile;
end;

function UpdateReadyMemo(Space, NewLine, MemoUserInfoInfo, MemoDirInfo, MemoTypeInfo, MemoComponentsInfo, MemoGroupInfo, MemoTasksInfo: String): String;
var
  What: String;
begin
  if IsUpgrade then What := 'Kept where they are: ' + Home
  else if Mode = 'keep' then What := 'Used where they are (nothing in that folder is changed by Setup): ' + Home
  else if Mode = 'move' then What := 'Copied (and checked file by file) from ' + SrcHome + ' to ' + Home + NewLine + Space + 'The old folder is not changed.'
  else if Mode = 'choose' then What := 'Used where they are: ' + Home
  else What := 'New books in ' + Home;
  Result := 'Your books:' + NewLine + Space + What + NewLine + NewLine + MemoDirInfo + NewLine + NewLine + MemoTasksInfo;
end;

function Stop_(Why: String): String;
begin
  Result := Why;
  AddLog('STOPPED: ' + Why);
  SaveLog;
end;

{ Everything that touches an earlier copy happens here, before any file is
  installed, in this order: every check first; then stop the old server (by
  its own id) and make sure it no longer answers; then the backup ZIP (into the
  NEW folder); then the copy, checked file by file. Any failure stops Setup
  with nothing switched over. Shortcuts wait until the install succeeded. }
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Res: TArrayOfString;
  CopyPort, WriteArgs: String;
begin
  Result := '';
  if IsUpgrade then begin
    { An update: the open window's files are set aside (nothing is stopped
      if that fails), then this copy's own server is stopped so its files
      can be replaced. }
    Result := SetAsideHost;
    if Result <> '' then begin
      EndSetAside(True);
      Result := Stop_(Result);
      exit;
    end;
    RunStop(GetAppDir(''), Home);
    StoppedOwnApp := True;
    exit;
  end;

  if WizardSilent then begin
    Result := SilentChoice;
    if Result = '' then Result := SettleChoice;
  end else if Mode = '' then begin
    Mode := InteractiveMode;
    Result := SettleChoice;
  end;
  SettleLogDir;
  if LogDir = '' then LogDir := BooksHome + ' Setup';
  AddLog('Choice: ' + Mode + '; books folder: ' + Home);
  if Result <> '' then begin
    Result := Stop_(Result);
    exit;
  end;
  if (Mode = 'move') and not RunHelper('check-copy ' + Q(SrcHome) + ' ' + Q(Home), Res) then begin
    Result := Stop_('The books cannot be copied there: ' + ValueOf(Res, 'error'));
    exit;
  end;

  { 0. Before anything is stopped or copied: can the app's own node.exe write
    where the books and the backup go? ("Keep" / "choose" books are only read
    here - the rule: Setup never writes in an earlier copy's folder.) }
  if (Mode = 'keep') or (Mode = 'choose') then WriteArgs := Q(LogDir)
  else WriteArgs := Q(Home) + ' ' + Q(LogDir);
  if not RunHelper('writable ' + WriteArgs, Res) then begin
    Result := Stop_(ValueOf(Res, 'error') + #13#10#13#10 + 'Nothing was changed. Run Setup again and choose another folder.');
    exit;
  end;

  if SrcHome <> '' then begin
    { 1. The earlier copy's server, by its own process id only - and checked. }
    if SrcSys <> '' then RunStop(SrcSys, SrcHome) else RunStop(SrcHome, SrcHome);
    if not RunHelper('stopped ' + Q(SrcHome), Res) then begin
      Result := Stop_(ValueOf(Res, 'error'));
      exit;
    end;
    { 2. A fresh backup ZIP of its data, into the NEW folder. }
    if not RunHelper('backup ' + Q(SrcHome) + ' ' + Q(AddBackslash(LogDir) + 'Setup backups'), Res) then begin
      Result := Stop_('The backup before installing could not be made: ' + ValueOf(Res, 'error') + #13#10 + 'Nothing was changed.');
      exit;
    end;
    { 3. Move = copy, then check every file, before switching. The copy gets
      a port of its own (review H2). }
    if Mode = 'move' then begin
      if IsTest then CopyPort := TestPort else CopyPort := '47371';
      if not RunHelper('copy ' + Q(SrcHome) + ' ' + Q(Home) + ' ' + CopyPort, Res) then begin
        Result := Stop_('Your books could not be copied: ' + ValueOf(Res, 'error') + #13#10 +
          'Nothing was switched over; your books are still in ' + SrcHome + ' and work as before.');
        exit;
      end;
    end;
  end;
  if WizardSilent and OldHadStartup and (Mode <> 'new') then WizardSelectTasks('startup');
  if Mode = 'new' then begin
    ForceDirectories(Home);
    if IsTest and not FileExists(Home + '\data\port.txt') then begin
      ForceDirectories(Home + '\data');
      SaveStringToFile(Home + '\data\port.txt', TestPort, False);
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  A, Res: TArrayOfString;
begin
  if (CurStep = ssInstall) and not IsUpgrade then begin
    { Just before the icons are made: copies of same-named old ones. }
    CopyIconToBeReplaced(IconDir('programs'), 'Start menu');
    if WizardIsTaskSelected('desktopicon') then CopyIconToBeReplaced(IconDir('desktop'), 'Desktop');
    if WizardIsTaskSelected('startup') then CopyIconToBeReplaced(IconDir('startup'), 'Startup');
  end;
  if CurStep <> ssPostInstall then exit;
  if not IsUpgrade then begin
    AddStr(A, Home);
    SaveStringsToUTF8File(ExpandConstant('{app}\home.txt'), A, False);
  end;
  SetArrayLength(A, 0);
  AddStr(A, 'Installed by Free GST Billing Setup {#AppVersion}. Updates come as a new Setup (Update now in the app).');
  if IsTest then AddStr(A, 'testroot=' + TestRoot);
  SaveStringsToUTF8File(ExpandConstant('{app}\installed.txt'), A, False);
  { Review M5: the old version's leftovers go only now, with every new file in place. }
  if IsUpgrade and FileExists(ExpandConstant('{app}\installed-files.txt')) then
    RunHelper('prune ' + Q(ExpandConstant('{app}')) + ' ' + Q(ExpandConstant('{app}\installed-files.txt')), Res);
  EndSetAside(False);
  { Review M2: the earlier copy's shortcuts move only after a successful install. }
  if not IsUpgrade then begin
    MoveOldShortcutsIn(IconDir('desktop'), 'Desktop', False);
    if WizardIsTaskSelected('desktopicon') and not DesktopOK then begin
      AddLog('No Desktop icon: Windows did not let Setup write on the Desktop (Controlled folder access?). The Start menu icon was made.');
      if not WizardSilent then
        MsgBox('Windows Security did not let Setup put an icon on the Desktop (its "Controlled folder access" protection is on).' + #13#10#13#10 +
          'Open Free GST Billing from the Start menu instead. Everything else was installed.', mbInformation, MB_OK);
    end;
    MoveOldShortcutsIn(IconDir('programs'), 'Start menu', True);
    MoveOldShortcutsIn(IconDir('startup'), 'Startup', False);
    MoveOldShortcutsIn(IconDir('taskbar'), 'Taskbar', False);
  end;
  { Review M1: never on an update - the app is stopped until Setup ends, and a
    slow WebView2 download would keep it down for minutes. A PC without
    WebView2 keeps using the Edge window; a new install offers it again. }
  if IsUpgrade then AddLog('An update: the WebView2 check is left to a new install.')
  else EnsureWebView2;
  InstallDone := True;
  AddLog('Installed version {#AppVersion} in ' + ExpandConstant('{app}') + '; books folder: ' + Home);
  SaveLog;
end;

function MayStart: Boolean;
begin
  Result := ExpandConstant('{param:NOSTART|}') = '';
end;

function MayStartSilent: Boolean;
begin
  Result := WizardSilent and MayStart;
end;

procedure DeinitializeSetup;
begin
  { Review M5: an update that stopped the app but did not finish starts the
    version that is there again, so nobody is left without the app. }
  if IsUpgrade and not InstallDone then EndSetAside(True);
  if IsUpgrade and StoppedOwnApp and not InstallDone then begin
    AddLog('The update did not finish. The app that was installed is started again; your books were not changed.');
    StartApp('-NoWindow -Hidden');
  end;
  SaveLog;
end;

{ ---------------------------------------------------- uninstall }

{ Review H3: a folder that must never be emptied, whatever home.txt says. }
function IsProtected(Dir: String): Boolean;
var
  D: String;
begin
  D := NoSlash(Dir);
  Result := (Length(D) <= 3) or
    SameText(D, NoSlash(ExpandConstant('{userdocs}'))) or SameText(D, NoSlash(ExpandConstant('{%USERPROFILE}'))) or
    SameText(D, NoSlash(ExpandConstant('{userdesktop}'))) or SameText(D, NoSlash(ExpandConstant('{localappdata}'))) or
    SameText(D, NoSlash(ExpandConstant('{userappdata}'))) or SameText(D, NoSlash(ExpandConstant('{app}'))) or
    ((UTestRoot <> '') and (SameText(D, UTestRoot) or SameText(D, UTestRoot + '\Documents') or SameText(D, UTestRoot + '\Desktop')));
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  A: TArrayOfString;
  I: Integer;
  Why: String;
begin
  if CurUninstallStep = usUninstall then begin
    UHome := ReadFirstLine(ExpandConstant('{app}\home.txt'));
    UTestRoot := '';
    if LoadStringsFromFile(ExpandConstant('{app}\installed.txt'), A) then
      for I := 0 to GetArrayLength(A) - 1 do
        if Pos('testroot=', StripBom(A[I])) = 1 then UTestRoot := NoSlash(Copy(StripBom(A[I]), 10, MaxInt));
    DeleteBooks := False;
    if (UHome = '') or not DirExists(UHome) then exit;
    if UninstallSilent then
      DeleteBooks := Lowercase(ExpandConstant('{param:DELETEBOOKS|no}')) = 'yes'
    else if not FileExists(AddBackslash(UHome) + 'server.js') then
      DeleteBooks := MsgBox('Also delete your books (invoices, clients, settings and saved PDFs)?' + #13#10#13#10 + UHome + #13#10#13#10 +
        'Choose No to keep them (recommended): installing Free GST Billing again finds them.', mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES;
    { Even after a Yes, only a folder that plainly holds books, and only its
      data, Saved Invoices and Trash. }
    Why := '';
    if FileExists(AddBackslash(UHome) + 'server.js') then Why := 'it is the folder of your earlier copy of the app'
    else if IsProtected(UHome) then Why := 'it is not a folder of its own (Documents, Desktop, a drive or a system folder)'
    else if not (FileExists(AddBackslash(UHome) + 'data\profile.json') or DirExists(AddBackslash(UHome) + 'data\bills')) then Why := 'it does not look like a books folder';
    if Why <> '' then begin
      if DeleteBooks or (not UninstallSilent and FileExists(AddBackslash(UHome) + 'server.js')) then begin
        Log('Books not deleted: ' + UHome + ' - ' + Why);
        if not UninstallSilent then MsgBox('Your books stay where they are, in:' + #13#10 + UHome + #13#10#13#10 + 'They are not deleted because ' + Why + '.', mbInformation, MB_OK);
      end;
      DeleteBooks := False;
    end;
  end;
  if (CurUninstallStep = usPostUninstall) and DeleteBooks then begin
    DelTree(AddBackslash(UHome) + 'data', True, True, True);
    DelTree(AddBackslash(UHome) + 'Saved Invoices', True, True, True);
    DelTree(AddBackslash(UHome) + 'Trash', True, True, True);
    RemoveDir(UHome);
  end;
end;
