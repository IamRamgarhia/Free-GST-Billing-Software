' BillKaro Silent Launcher
' Starts the BillKaro server without showing a console window
' and opens the app in the default browser.

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get the directory where this script is located
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Check if Node.js is available
On Error Resume Next
WshShell.Run "cmd /c where node >nul 2>nul", 0, True
If Err.Number <> 0 Then
    MsgBox "Node.js is not installed." & vbCrLf & vbCrLf & _
           "Please run 'Install BillKaro.bat' first, or install Node.js from https://nodejs.org", _
           vbExclamation, "BillKaro"
    WScript.Quit 1
End If
On Error GoTo 0

' Check if node_modules exists
If Not fso.FolderExists(scriptDir & "\node_modules") Then
    MsgBox "Dependencies not installed." & vbCrLf & vbCrLf & _
           "Please run 'Install BillKaro.bat' first.", _
           vbExclamation, "BillKaro"
    WScript.Quit 1
End If

' Check if dist exists, build if not
If Not fso.FileExists(scriptDir & "\dist\index.html") Then
    WshShell.Run "cmd /c cd /d """ & scriptDir & """ && npm run build", 1, True
End If

' Start the server silently
WshShell.Run "cmd /c cd /d """ & scriptDir & """ && node server.js", 0, False

' Wait for server to start
WScript.Sleep 2000

' Open browser
WshShell.Run "http://localhost:3001", 1, False
