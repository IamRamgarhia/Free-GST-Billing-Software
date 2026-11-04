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
;     %LOCALAPPDATA%\Programs\Free GST Billing, with its own node.exe;
;   - asks where the books are: an earlier copy found on this PC is kept where
;     it is or COPIED to Documents\Free GST Billing; or new books there;
;   - the top rule: NOTHING inside an earlier installation is ever written,
;     moved, renamed or deleted. "Move" copies and checks every file
;     (SHA-256) first; old shortcuts are moved into a backup folder, never
;     deleted; the old data is zipped into the NEW folder before anything;
;   - an update (same AppId) stops the app, replaces the program files and
;     keeps home.txt (the books folder) and the books;
;   - the uninstaller removes the program and icons, and deletes books only
;     after an explicit Yes.
;
; Command line (all optional):
;   /DATAMODE=keep|move|new|choose  the books question, for silent installs
;   /DATADIR=<folder>               choose: the books folder; move/new: where to
;   /NOSTART=1                      do not start the app at the end
;   /DELETEBOOKS=yes                uninstaller: also delete the books
;   /TESTROOT=<folder>              TEST MODE: everything (app, books, icons,
;                                   the search for earlier copies) stays inside
;                                   that folder; its own AppId; no window opens
;   /PORT=<n>                       test mode: port for new books (47461)

#ifndef AppVersion
  #error AppVersion is not defined - build with npm run release:exe
#endif
#ifndef StageDir
  #error StageDir is not defined - build with npm run release:exe
#endif
#ifndef NodeExe
  #error NodeExe is not defined - build with npm run release:exe
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
Source: "stop-app.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StageDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[InstallDelete]
; Program files only: an update must not leave old ones behind. The books are
; never in {app} (home.txt points elsewhere).
Type: filesandordirs; Name: "{app}\dist"
Type: filesandordirs; Name: "{app}\node_modules"
Type: filesandordirs; Name: "{app}\src"

[Icons]
Name: "{code:IconDir|programs}\Free GST Billing"; Filename: "{win}\System32\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\start-windows.ps1"" -AppWindow -Hidden"; WorkingDir: "{app}"; IconFilename: "{app}\app-icon.ico"; Comment: "Free GST Billing Software"; Flags: runminimized
Name: "{code:IconDir|desktop}\Free GST Billing"; Filename: "{win}\System32\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\start-windows.ps1"" -AppWindow -Hidden"; WorkingDir: "{app}"; IconFilename: "{app}\app-icon.ico"; Comment: "Free GST Billing Software"; Flags: runminimized; Tasks: desktopicon
Name: "{code:IconDir|startup}\Free GST Billing"; Filename: "{win}\System32\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\start-windows.ps1"" -AppWindow -Hidden"; WorkingDir: "{app}"; IconFilename: "{app}\app-icon.ico"; Comment: "Free GST Billing Software"; Flags: runminimized; Tasks: startup

[Run]
Filename: "{win}\System32\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\start-windows.ps1"" -AppWindow -Hidden"; WorkingDir: "{app}"; Description: "Open Free GST Billing now"; Flags: postinstall nowait runhidden skipifsilent; Check: MayStart
; A silent run (an update started from the app): start the server, open no
; second window - the app's window reloads by itself.
Filename: "{win}\System32\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\start-windows.ps1"" -NoWindow -Hidden"; WorkingDir: "{app}"; Flags: nowait runhidden; Check: MayStartSilent

[UninstallRun]
Filename: "{win}\System32\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\stop-app.ps1"" -Sys ""{app}"""; Flags: runhidden waituntilterminated; RunOnceId: "StopServer"

[UninstallDelete]
Type: files; Name: "{app}\home.txt"
Type: files; Name: "{app}\installed.txt"

[Code]
const
  TestPortDefault = '47461';
  LogName = 'Free GST Billing - install log.txt';

var
  TestRoot, TestPort: String;
  OldSys, OldHome: String;
  OldInvoices, OldCount: Integer;
  OldHadStartup, IsUpgrade, StartupPreset, ToolsReady: Boolean;
  Mode, Home, SrcHome, SrcSys, LogDir: String;
  LogLines: TStringList;
  DataPage: TInputOptionWizardPage;
  BrowsePage: TInputDirWizardPage;
  DeleteBooks: Boolean;
  UHome: String;

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
  if IsTest then Result := TestRoot + '\Programs\Free GST Billing'
  else Result := ExpandConstant('{localappdata}\Programs\Free GST Billing');
end;

function IconDir(Param: String): String;
begin
  if IsTest then begin
    if Param = 'desktop' then Result := TestRoot + '\Desktop'
    else if Param = 'startup' then Result := TestRoot + '\Startup'
    else Result := TestRoot + '\Programs';
  end else begin
    if Param = 'desktop' then Result := ExpandConstant('{userdesktop}')
    else if Param = 'startup' then Result := ExpandConstant('{userstartup}')
    else Result := ExpandConstant('{userprograms}');
  end;
end;

function DocsHome: String;
begin
  if IsTest then Result := TestRoot + '\Documents\Free GST Billing'
  else Result := ExpandConstant('{userdocs}\Free GST Billing');
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

{ A command-line argument in double quotes (an empty one stays an argument). }
function Q(S: String): String;
begin
  Result := '"' + S + '"';
end;

{ A PowerShell single-quoted string. }
function PSQ(S: String): String;
begin
  StringChangeEx(S, '''', '''''', True);
  Result := '''' + S + '''';
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

{ First line of a UTF-8 text file (home.txt), or ''. }
function ReadFirstLine(FileName: String): String;
var
  A: TArrayOfString;
begin
  Result := '';
  if LoadStringsFromFile(FileName, A) and (GetArrayLength(A) > 0) then Result := Trim(A[0]);
  if (Length(Result) > 0) and (Ord(Result[1]) = $FEFF) then Result := Trim(Copy(Result, 2, MaxInt));
end;

function ValueOf(const A: TArrayOfString; Key: String): String;
var
  I: Integer;
  L: String;
begin
  Result := '';
  for I := 0 to GetArrayLength(A) - 1 do begin
    L := A[I];
    if (Length(L) > 0) and (Ord(L[1]) = $FEFF) then L := Copy(L, 2, MaxInt);
    if Pos(Key + '=', L) = 1 then begin
      Result := Copy(L, Length(Key) + 2, MaxInt);
      exit;
    end;
  end;
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

{ Stops the server of one copy - by its own process id only (stop-app.ps1). }
procedure RunStop(Sys, Books: String);
var
  Code: Integer;
  OutFile, Args: String;
  A: TArrayOfString;
begin
  EnsureTools;
  OutFile := ExpandConstant('{tmp}\stop-out.txt');
  DeleteFile(OutFile);
  Args := '-NoProfile -ExecutionPolicy Bypass -Command "& ' + PSQ(ExpandConstant('{tmp}\stop-app.ps1')) + ' -Sys ' + PSQ(Sys);
  if Books <> '' then Args := Args + ' -Books ' + PSQ(Books);
  if IsTest then Args := Args + ' -Test';
  Args := Args + ' | Out-File -Encoding UTF8 -LiteralPath ' + PSQ(OutFile) + '"';
  Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'), Args, '', SW_HIDE, ewWaitUntilTerminated, Code);
  if LoadStringsFromFile(OutFile, A) and (GetArrayLength(A) > 0) then
    AddLog('Stopping the app of ' + Sys + ': ' + ValueOf(A, 'stopped'))
  else
    AddLog('Stopping the app of ' + Sys + ': no answer (code ' + IntToStr(Code) + ')');
end;

{ ---------------------------------------------------- shortcuts }

function LnkText(Lnk: String; var FirstPath, Target, WorkDir: String): String;
var
  Shell, S: Variant;
  Args, Rest: String;
  P: Integer;
begin
  Result := '';
  FirstPath := '';
  Target := '';
  WorkDir := '';
  try
    Shell := CreateOleObject('WScript.Shell');
    S := Shell.CreateShortcut(Lnk);
    Target := S.TargetPath;
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

{ Does this shortcut open the earlier copy? }
function OpensOld(Text: String): Boolean;
var
  Root: String;
begin
  Result := False;
  if OldSys = '' then exit;
  Root := OldSys;
  if Lowercase(ExtractFileName(OldSys)) = '_system' then Root := ExtractFileDir(OldSys);
  Result := (Pos(Lowercase(AddBackslash(OldSys)), Text) > 0) or
            (Pos(Lowercase(AddBackslash(Root)) + 'free gst billing', Text) > 0);
end;

procedure AddCandidatesFrom(Dir: String; var C: TArrayOfString);
var
  F: TFindRec;
  Text, FirstPath, Target, WorkDir: String;
begin
  if FindFirst(AddBackslash(Dir) + '*.lnk', F) then
  try
    repeat
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

function StartupOpensOld: Boolean;
var
  F: TFindRec;
  Dir, FirstPath, Target, WorkDir: String;
begin
  Result := False;
  Dir := IconDir('startup');
  if FindFirst(AddBackslash(Dir) + '*.lnk', F) then
  try
    repeat
      if OpensOld(LnkText(AddBackslash(Dir) + F.Name, FirstPath, Target, WorkDir)) then Result := True;
    until Result or not FindNext(F);
  finally
    FindClose(F);
  end;
end;

{ Old shortcuts are never deleted: each one that opens the earlier copy, or
  that our new icon would overwrite, is MOVED into
  "<log folder>\Old shortcuts (backup)" - put it back to undo. }
procedure BackUpShortcutsIn(Dir, Label_: String);
var
  F: TFindRec;
  Lnk, Text, FirstPath, Target, WorkDir, BackupDir, Dest: String;
  N: Integer;
begin
  if FindFirst(AddBackslash(Dir) + '*.lnk', F) then
  try
    repeat
      Lnk := AddBackslash(Dir) + F.Name;
      Text := LnkText(Lnk, FirstPath, Target, WorkDir);
      if (Pos(Lowercase(AddBackslash(GetAppDir(''))), Text) = 0) and
         (OpensOld(Text) or (Lowercase(F.Name) = 'free gst billing.lnk')) then begin
        BackupDir := AddBackslash(LogDir) + 'Old shortcuts (backup)';
        ForceDirectories(BackupDir);
        Dest := AddBackslash(BackupDir) + Label_ + ' - ' + F.Name;
        N := 2;
        while FileExists(Dest) do begin
          Dest := AddBackslash(BackupDir) + Label_ + ' - ' + IntToStr(N) + ' - ' + F.Name;
          N := N + 1;
        end;
        if FileCopy(Lnk, Dest, True) and DeleteFile(Lnk) then
          AddLog('Moved the old shortcut ' + Lnk + ' to ' + Dest)
        else
          AddLog('Could not move the old shortcut ' + Lnk);
      end;
    until not FindNext(F);
  finally
    FindClose(F);
  end;
end;

{ ---------------------------------------------------- finding earlier copies }

procedure FindOldInstall;
var
  C, Res: TArrayOfString;
  ListFile: String;
begin
  AddCandidatesFrom(IconDir('desktop'), C);
  AddCandidatesFrom(IconDir('programs'), C);
  AddCandidatesFrom(IconDir('startup'), C);
  AddStr(C, DocsHome);
  if IsTest then begin
    AddStr(C, TestRoot + '\Programs\Free GST Billing');
    AddGstFolders(TestRoot + '\Downloads', C);
    AddGstFolders(TestRoot + '\Desktop', C);
    AddGstFolders(TestRoot + '\Documents', C);
  end else begin
    AddStr(C, ExpandConstant('{localappdata}\Programs\Free GST Billing'));
    AddGstFolders(ExpandConstant('{userprofile}\Downloads'), C);
    AddGstFolders(ExpandConstant('{userdesktop}'), C);
    AddGstFolders(ExpandConstant('{userdocs}'), C);
  end;
  ListFile := ExpandConstant('{tmp}\candidates.txt');
  SaveStringsToUTF8File(ListFile, C, False);
  if RunHelper('detect ' + Q(ListFile) + ' ' + Q(GetAppDir('')) + ' ' + Q(TestRoot), Res) then begin
    OldCount := StrToIntDef(ValueOf(Res, 'count'), 0);
    if OldCount > 0 then begin
      OldSys := ValueOf(Res, 'sys');
      OldHome := ValueOf(Res, 'home');
      OldInvoices := StrToIntDef(ValueOf(Res, 'invoices'), 0);
      OldHadStartup := StartupOpensOld;
    end;
  end else
    AddLog('Looking for an earlier copy failed: ' + ValueOf(Res, 'error'));
  if OldHome = '' then AddLog('No earlier copy with books was found.');
end;

{ A folder the user named as "my books": the folder itself when it has a data
  folder, or its _system folder (the ZIP layout). '' when neither. }
function BooksFolder(Dir: String): String;
begin
  Result := '';
  Dir := NoSlash(Dir);
  if Dir = '' then exit;
  if DirExists(Dir + '\data') then Result := Dir
  else if DirExists(Dir + '\_system\data') then Result := Dir + '\_system';
end;

{ ---------------------------------------------------- the books choice }

function TargetHome: String;
begin
  Result := NoSlash(ExpandConstant('{param:DATADIR|}'));
  if (Result = '') or (Mode = 'choose') then Result := DocsHome;
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
      Result := 'That folder has no "data" folder with books in it. Choose the folder that holds "data" (for the ZIP version: the "_system" folder inside the app folder).';
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
    LogDir := DocsHome;
    if IsInside(LogDir, SrcHome) or IsInside(SrcHome, LogDir) or ((SrcSys <> '') and IsInside(LogDir, SrcSys)) then
      LogDir := LogDir + ' Setup';
  end;
end;

{ ---------------------------------------------------- Setup events }

function InitializeSetup: Boolean;
var
  P: Integer;
begin
  Result := True;
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
  IsUpgrade := FileExists(GetAppDir('') + '\installed.txt') and FileExists(GetAppDir('') + '\home.txt');
  if IsTest then AddLog('Free GST Billing Setup {#AppVersion} - TEST MODE in ' + TestRoot)
  else AddLog('Free GST Billing Setup {#AppVersion}');
  if IsUpgrade then begin
    Home := ReadFirstLine(GetAppDir('') + '\home.txt');
    { Never write into an earlier copy's own folder ("Keep" points at one). }
    LogDir := Home;
    if FileExists(AddBackslash(Home) + 'server.js') then LogDir := DocsHome + ' Setup';
    AddLog('Updating the copy in ' + GetAppDir('') + '; books stay in ' + Home);
  end else
    FindOldInstall;
end;

procedure InitializeWizard;
var
  Intro: String;
begin
  if IsUpgrade then exit;
  if OldHome <> '' then begin
    Intro := 'Free GST Billing is already on this computer. Its books (' + IntToStr(OldInvoices) + ' invoices) are in:' + #13#10 + OldHome + #13#10#13#10 +
      'Setup never changes or deletes anything in that folder. What should the new app use?';
    DataPage := CreateInputOptionPage(wpWelcome, 'Your books', 'Where your invoices, clients and settings are kept', Intro, True, False);
    DataPage.Add('Keep using my books where they are (do not delete or move that folder afterwards)');
    DataPage.Add('Copy my books to ' + DocsHome + ' (the old folder stays as it is, as a backup)');
    DataPage.Add('Use books in another folder (browse)');
    DataPage.SelectedValueIndex := 0;
    if IsInside(DocsHome, OldHome) or IsInside(OldHome, DocsHome) then DataPage.CheckListBox.ItemEnabled[1] := False;
  end else begin
    Intro := 'Your invoices, clients and settings will be kept in:' + #13#10 + DocsHome + #13#10#13#10 +
      'If you already use Free GST Billing on this computer, choose the folder that holds its books instead.';
    DataPage := CreateInputOptionPage(wpWelcome, 'Your books', 'Where your invoices, clients and settings are kept', Intro, True, False);
    DataPage.Add('Start new books in ' + DocsHome);
    DataPage.Add('I already have my books in another folder (browse)');
    DataPage.SelectedValueIndex := 0;
  end;
  BrowsePage := CreateInputDirPage(DataPage.ID, 'Your books', 'Which folder holds your books?',
    'Choose the folder that has the "data" folder in it. For the ZIP version, that is the "_system" folder inside the app folder. Setup uses the books where they are and changes nothing in that folder.', False, '');
  BrowsePage.Add('');
  BrowsePage.Values[0] := ExpandConstant('{userdocs}');
end;

function InteractiveMode: String;
begin
  if OldHome <> '' then begin
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

{ Everything that touches an earlier copy happens here, before any file is
  installed. Any failure stops Setup with nothing switched over. }
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Res: TArrayOfString;
begin
  Result := '';
  { An update or repair: stop this copy's own server so its files can be replaced. }
  if FileExists(GetAppDir('') + '\server.js') then RunStop(GetAppDir(''), Home);
  if IsUpgrade then exit;

  if WizardSilent then begin
    Mode := Lowercase(ExpandConstant('{param:DATAMODE|}'));
    if Mode = '' then begin
      if OldHome <> '' then Mode := 'keep' else Mode := 'new';
    end;
    Result := SettleChoice;
  end else if Mode = '' then begin
    Mode := InteractiveMode;
    Result := SettleChoice;
  end;
  SettleLogDir;
  AddLog('Choice: ' + Mode + '; books folder: ' + Home);
  if Result <> '' then begin
    AddLog('STOPPED: ' + Result);
    SaveLog;
    exit;
  end;

  if SrcHome <> '' then begin
    { 1. The earlier copy's server, by its own process id only. }
    if SrcSys <> '' then RunStop(SrcSys, SrcHome) else RunStop(SrcHome, SrcHome);
    { 2. A fresh backup ZIP of its data, into the NEW folder. }
    if not RunHelper('backup ' + Q(SrcHome) + ' ' + Q(AddBackslash(LogDir) + 'Setup backups'), Res) then begin
      Result := 'The backup before installing could not be made: ' + ValueOf(Res, 'error') + #13#10 + 'Nothing was changed.';
      AddLog('STOPPED: ' + Result);
      SaveLog;
      exit;
    end;
    { 3. Move = copy, then check every file, before switching. }
    if Mode = 'move' then begin
      if not RunHelper('copy ' + Q(SrcHome) + ' ' + Q(Home), Res) then begin
        Result := 'Your books could not be copied: ' + ValueOf(Res, 'error') + #13#10 +
          'Nothing was switched over; your books are still in ' + SrcHome + ' and work as before.';
        AddLog('STOPPED: ' + Result);
        SaveLog;
        exit;
      end;
    end;
  end;
  { 4. Old shortcuts into the backup folder (never deleted). }
  BackUpShortcutsIn(IconDir('desktop'), 'Desktop');
  BackUpShortcutsIn(IconDir('programs'), 'Start menu');
  BackUpShortcutsIn(IconDir('startup'), 'Startup');
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
  A: TArrayOfString;
begin
  if CurStep <> ssPostInstall then exit;
  if not IsUpgrade then begin
    AddStr(A, Home);
    SaveStringsToUTF8File(ExpandConstant('{app}\home.txt'), A, False);
  end;
  SetArrayLength(A, 0);
  AddStr(A, 'Installed by Free GST Billing Setup {#AppVersion}. Updates come as a new Setup (Update now in the app).');
  if IsTest then AddStr(A, 'testroot=' + TestRoot);
  SaveStringsToUTF8File(ExpandConstant('{app}\installed.txt'), A, False);
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

{ ---------------------------------------------------- uninstall }

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Answer: Boolean;
begin
  if CurUninstallStep = usUninstall then begin
    UHome := ReadFirstLine(ExpandConstant('{app}\home.txt'));
    DeleteBooks := False;
    if (UHome = '') or not DirExists(UHome) then exit;
    if FileExists(AddBackslash(UHome) + 'server.js') then begin
      { The books are in an earlier copy's own folder ("Keep"): never touched. }
      if not UninstallSilent then
        MsgBox('Your books stay where they are, in the folder of your earlier copy:' + #13#10 + UHome, mbInformation, MB_OK);
      exit;
    end;
    if UninstallSilent then
      Answer := Lowercase(ExpandConstant('{param:DELETEBOOKS|no}')) = 'yes'
    else
      Answer := MsgBox('Also delete your books (invoices, clients, settings and saved PDFs)?' + #13#10#13#10 + UHome + #13#10#13#10 +
        'Choose No to keep them (recommended): installing Free GST Billing again finds them.', mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES;
    DeleteBooks := Answer;
  end;
  if (CurUninstallStep = usPostUninstall) and DeleteBooks then begin
    DelTree(AddBackslash(UHome) + 'data', True, True, True);
    DelTree(AddBackslash(UHome) + 'Saved Invoices', True, True, True);
    DelTree(AddBackslash(UHome) + 'Trash', True, True, True);
    RemoveDir(UHome);
  end;
end;

procedure DeinitializeSetup;
begin
  SaveLog;
end;
