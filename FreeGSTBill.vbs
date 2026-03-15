' FreeGSTBill Silent Launcher
' Starts the FreeGSTBill server and opens the app in browser.

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get the directory where this script is located
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
portFile = scriptDir & "\data\port.txt"
defaultPort = "3001"

' Read saved port (from previous run) or use default
Function GetPort()
    If fso.FileExists(portFile) Then
        GetPort = Trim(fso.OpenTextFile(portFile, 1).ReadAll())
        If GetPort = "" Then GetPort = defaultPort
    Else
        GetPort = defaultPort
    End If
End Function

' Check if node_modules exists
If Not fso.FolderExists(scriptDir & "\node_modules") Then
    MsgBox "FreeGSTBill is not installed yet." & vbCrLf & vbCrLf & _
           "Please double-click 'Install FreeGSTBill.bat' first.", _
           vbExclamation, "FreeGSTBill"
    WScript.Quit 1
End If

' Check if dist exists, build if not
If Not fso.FileExists(scriptDir & "\dist\index.html") Then
    MsgBox "Building the app for first time. This window will close when ready." & vbCrLf & _
           "Please wait about 30 seconds...", vbInformation, "FreeGSTBill"
    WshShell.Run "cmd /c cd /d """ & scriptDir & """ && npm run build", 1, True
End If

' Check if server is already running
activePort = GetPort()
serverRunning = False
On Error Resume Next
Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
http.setTimeouts 2000, 2000, 2000, 2000
http.Open "GET", "http://localhost:" & activePort & "/api/meta/test", False
http.Send
If Err.Number = 0 Then
    If http.Status = 200 Then serverRunning = True
End If
Set http = Nothing
Err.Clear
On Error GoTo 0

If serverRunning Then
    WshShell.Run "http://localhost:" & activePort, 1, False
    WScript.Quit 0
End If

' Start the server silently
WshShell.Run "cmd /c cd /d """ & scriptDir & """ && node server.js", 0, False

' Wait for server to be ready (check every second, up to 20 seconds)
' Server writes port to data/port.txt, so re-read it after startup
maxWait = 20
waited = 0
serverReady = False
Do While waited < maxWait
    WScript.Sleep 1000
    waited = waited + 1

    ' Re-read port in case server picked a different one
    activePort = GetPort()

    On Error Resume Next
    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    http.setTimeouts 2000, 2000, 2000, 2000
    http.Open "GET", "http://localhost:" & activePort & "/api/meta/test", False
    http.Send
    If Err.Number = 0 Then
        If http.Status = 200 Then serverReady = True
    End If
    Set http = Nothing
    Err.Clear
    On Error GoTo 0
    If serverReady Then Exit Do
Loop

If Not serverReady Then
    WScript.Sleep 2000
    activePort = GetPort()
End If

' Rename the localhost file to match actual port
localhostFile3001 = scriptDir & "\localhost-3001 (Open This in Browser).txt"
newFileName = scriptDir & "\localhost-" & activePort & " (Open This in Browser).txt"
If fso.FileExists(localhostFile3001) And activePort <> "3001" Then
    fso.MoveFile localhostFile3001, newFileName
End If

' Open browser
WshShell.Run "http://localhost:" & activePort, 1, False
