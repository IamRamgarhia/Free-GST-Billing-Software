// Free GST Billing - the app's own window (Windows Setup only, v1.10.84).
//
// "Free GST Billing.exe" in the program folder: a small WinForms window with
// WebView2 (the Edge engine every Windows 10/11 has) showing the app, so an
// installed copy looks and behaves like a program, not like Edge. The ZIP
// version does not have it.
//
// Built by scripts/build-installer.mjs with the C# compiler that is part of
// Windows (C# 5, .NET Framework 4.x); docs/WINDOWS_SETUP.md has the details.
//
//   - The server: start-windows.ps1 -PrintUrl, the launcher's own logic (it
//     opens only a server that serves THIS install's books, review H2), prints
//     the URL; its text is shown if it fails.
//   - No WebView2 runtime (or it fails to start): start-windows.ps1 -AppWindow,
//     Edge's app window as before, else the default browser.
//   - One window per program folder; a second start brings it forward.
//   - Window place and size, and the WebView2 profile, are kept in
//     %LOCALAPPDATA%\Free GST Billing (test mode: <test folder>\LocalAppData\...),
//     never in Documents (ERR-082) or the program folder.
//   - An update renames this exe and its DLLs while the window is open (Windows
//     allows that for a running program) and installs the new ones; the page
//     reloads by itself. The renamed "*.old" files are removed on the next start.
//   - Close (X) hides the window to the tray (the icon near the clock; a tip
//     the first time). Open from the icon; Quit (its right-click menu) closes
//     the window AND stops this install's server (stop-app.ps1, by its own id).
//     Windows shutting down or Task Manager close it for real. "/tray" (the
//     Startup icon) starts the server and waits in the tray, no window.
//   - The tray menu also has the version, Check for updates (the app's own
//     Updates tab), Open books folder (home.txt) and Make a backup now (the
//     app's own backup, POST /api/control-panel/backup). The app's
//     notifications (NotificationReceived) show near the clock.
//   - Self-repair: the server stopped? Started again the launcher's way.
//   - Jump list (right-click the taskbar / Start icon): New Invoice, Dashboard,
//     Clients, Reports = "/view=<screen>", the app's own ?view=; a running
//     window is sent there (open-view.txt + the "-show" event).
//   - Named events per program folder, "Local\FreeGSTBillingHost-<hash>-show",
//     "-close" (uninstall: stop-app.ps1 -CloseWindow) and "-quit".
//   - FGSB_HOST_SMOKE=<file> (tests): load the app, open Settings, write what was
//     seen to <file> and close. FGSB_HOST_TRACE=<file>: tray events, one a line.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

static class Program
{
    [DllImport("shell32.dll")] static extern int SetCurrentProcessExplicitAppUserModelID([MarshalAs(UnmanagedType.LPWStr)] string id);
    [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr value);
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hwnd, int cmd);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool AllowSetForegroundWindow(int pid);

    public static string AppDir, DataDir, Aumid, SmokeFile, TraceFile;

    [STAThread]
    static int Main()
    {
        AppDir = Path.GetDirectoryName(Application.ExecutablePath);
        string testRoot = ReadTestRoot();
        DataDir = testRoot != null
            ? Path.Combine(testRoot, "LocalAppData", "Free GST Billing")
            : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Free GST Billing");
        // The same id is on the Setup's shortcuts ([Icons] AppUserModelID), so a
        // pinned taskbar icon is this program with its own icon.
        Aumid = testRoot != null ? "DiceCodes.FreeGSTBilling.Test" : "DiceCodes.FreeGSTBilling";
        SmokeFile = Environment.GetEnvironmentVariable("FGSB_HOST_SMOKE");
        if (SmokeFile == "") SmokeFile = null;
        TraceFile = Environment.GetEnvironmentVariable("FGSB_HOST_TRACE");
        if (TraceFile == "") TraceFile = null;
        bool tray = false;
        string view = null; // "/view=clients": that screen (the jump list), the app's own ?view=
        foreach (string a in Environment.GetCommandLineArgs())
        {
            if (string.Equals(a, "/tray", StringComparison.OrdinalIgnoreCase)) tray = true;
            if (a.StartsWith("/view=", StringComparison.OrdinalIgnoreCase) && Array.IndexOf(Views, a.Substring(6).ToLowerInvariant()) >= 0) view = a.Substring(6).ToLowerInvariant();
        }

        // Sharp text on high-DPI screens (per-monitor v2, Windows 10 1703+).
        try { if (!SetProcessDpiAwarenessContext(new IntPtr(-4))) SetProcessDPIAware(); } catch (Exception) { try { SetProcessDPIAware(); } catch (Exception) { } }
        SetCurrentProcessExplicitAppUserModelID(Aumid);

        bool first;
        string name = @"Local\FreeGSTBillingHost-" + Hash(AppDir.ToLowerInvariant());
        using (Mutex one = new Mutex(true, name, out first))
        {
            if (!first)
            {
                // The first copy shows its window, also from the tray - on that screen.
                if (view != null) { try { Directory.CreateDirectory(DataDir); File.WriteAllText(ViewFile, view); } catch (Exception) { } }
                Smoke("instance=second\r\nforwarded=" + (Signal(name + "-show") || BringForward() ? "1" : "0") + "\r\n");
                return 0;
            }
            CleanOld();
            string runtime = null;
            try { runtime = CoreWebView2Environment.GetAvailableBrowserVersionString(); } catch (Exception) { }
            if (string.IsNullOrEmpty(runtime))
            {
                Fallback("the WebView2 Runtime is not installed");
                return 0;
            }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            ApplyJumpList();
            MainForm form = new MainForm(runtime, name);
            form.PendingView = view;
            if (tray) form.StartInTray(); else form.Show();
            Application.Run(); // until the window really closes (ExitThread)
            GC.KeepAlive(one);
        }
        return 0;
    }

    // installed.txt: "testroot=<folder>" in the Setup's test mode.
    static string ReadTestRoot()
    {
        try
        {
            foreach (string line in File.ReadAllLines(Path.Combine(AppDir, "installed.txt")))
            {
                string l = line.Trim().TrimStart('\uFEFF');
                if (l.StartsWith("testroot=") && l.Length > 9) return l.Substring(9).Trim();
            }
        }
        catch (Exception) { }
        return null;
    }

    static string Hash(string s)
    {
        byte[] h = SHA1.Create().ComputeHash(Encoding.UTF8.GetBytes(s));
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 8; i++) sb.Append(h[i].ToString("x2"));
        return sb.ToString();
    }

    // The app's screens (src/App.jsx, its ?view= list).
    public static readonly string[] Views = { "dashboard", "new", "clients", "inventory", "expenses", "purchases", "recurring", "receipts",
        "cashbook", "reports", "filing", "incometax", "settings", "controlpanel", "support" };
    public static string ViewFile { get { return Path.Combine(DataDir, "open-view.txt"); } }

    // Right-click on the taskbar / Start icon: these screens. WPF's JumpList
    // uses this process's AppUserModelID, the one on the Setup's icons.
    static void ApplyJumpList()
    {
        try
        {
            System.Windows.Shell.JumpList list = new System.Windows.Shell.JumpList();
            list.ShowFrequentCategory = false;
            list.ShowRecentCategory = false;
            string[,] items = { { "New Invoice", "new" }, { "Dashboard", "dashboard" }, { "Clients", "clients" }, { "Reports", "reports" } };
            for (int i = 0; i < items.GetLength(0); i++)
            {
                System.Windows.Shell.JumpTask t = new System.Windows.Shell.JumpTask();
                t.Title = items[i, 0];
                t.Arguments = "/view=" + items[i, 1];
                t.ApplicationPath = Application.ExecutablePath;
                t.IconResourcePath = Application.ExecutablePath;
                t.WorkingDirectory = AppDir;
                list.JumpItems.Add(t);
            }
            list.Apply();
            Trace("jumplist=" + items.GetLength(0));
        }
        catch (Exception e) { Trace("jumplist failed: " + e.Message); }
    }

    static bool Signal(string eventName)
    {
        try
        {
            using (EventWaitHandle ev = EventWaitHandle.OpenExisting(eventName))
            {
                AllowSetForegroundWindow(-1); // this start was the user's: the first copy may come to the front
                ev.Set();
                return true;
            }
        }
        catch (Exception) { return false; }
    }

    public static void Trace(string line)
    {
        if (TraceFile == null) return;
        try { File.AppendAllText(TraceFile, line + "\r\n", new UTF8Encoding(false)); } catch (Exception) { }
    }

    // The server's process id from /api/version, or 0 when it does not answer.
    // Quiet: no window, no log while it is healthy.
    public static int ServerPid(string origin)
    {
        try
        {
            HttpWebRequest q = (HttpWebRequest)WebRequest.Create(origin + "/api/version");
            q.Proxy = null; // never the system proxy for this PC's own server (start-windows.ps1 says why)
            q.Timeout = 8000;
            using (HttpWebResponse r = (HttpWebResponse)q.GetResponse())
            using (StreamReader rd = new StreamReader(r.GetResponseStream(), Encoding.UTF8))
            {
                Match m = Regex.Match(rd.ReadToEnd(), "\"pid\"\\s*:\\s*(\\d+)");
                return r.StatusCode != HttpStatusCode.OK ? 0 : m.Success ? int.Parse(m.Groups[1].Value) : -1;
            }
        }
        catch (Exception) { return 0; }
    }

    // A Setup (an update) or its uninstaller is at work: never start the
    // server under it. (SetupMutex=FreeGSTBillingSetup in the .iss.)
    public static bool SetupRunning()
    {
        try
        {
            Mutex m;
            if (!Mutex.TryOpenExisting("FreeGSTBillingSetup", out m)) return false;
            m.Dispose();
            return true;
        }
        catch (Exception) { return true; } // it exists, though we may not open it
    }

    // Stops this install's server by its own id - the uninstaller's way.
    public static void StopServer()
    {
        string ps = Path.Combine(Environment.SystemDirectory, @"WindowsPowerShell\v1.0\powershell.exe");
        ProcessStartInfo psi = new ProcessStartInfo(ps, "-NoProfile -ExecutionPolicy Bypass -File \"" +
            Path.Combine(AppDir, "stop-app.ps1") + "\" -Sys \"" + AppDir + "\"");
        psi.UseShellExecute = false;
        psi.CreateNoWindow = true;
        try { using (Process p = Process.Start(psi)) { p.WaitForExit(30000); } } catch (Exception) { }
    }

    // An older copy's window (no events): the folder is compared, not the
    // file (an update may have renamed its exe).
    static bool BringForward()
    {
        int me = Process.GetCurrentProcess().Id;
        foreach (Process p in Process.GetProcessesByName(Path.GetFileNameWithoutExtension(Application.ExecutablePath)))
        {
            try
            {
                if (p.Id == me) continue;
                if (!string.Equals(Path.GetDirectoryName(p.MainModule.FileName), AppDir, StringComparison.OrdinalIgnoreCase)) continue;
                IntPtr h = p.MainWindowHandle;
                if (h == IntPtr.Zero) continue;
                if (IsIconic(h)) ShowWindow(h, 9); // SW_RESTORE
                SetForegroundWindow(h);
                return true;
            }
            catch (Exception) { }
        }
        return false;
    }

    // What an update renamed while the window was open.
    static void CleanOld()
    {
        try { foreach (string f in Directory.GetFiles(AppDir, "*.old")) { try { File.Delete(f); } catch (Exception) { } } } catch (Exception) { }
    }

    public static void Smoke(string text)
    {
        if (SmokeFile == null) return;
        try { File.WriteAllText(SmokeFile, text, new UTF8Encoding(false)); } catch (Exception) { }
    }

    static ProcessStartInfo Launcher(string args)
    {
        string ps = Path.Combine(Environment.SystemDirectory, @"WindowsPowerShell\v1.0\powershell.exe");
        ProcessStartInfo psi = new ProcessStartInfo(ps, "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" +
            Path.Combine(AppDir, "start-windows.ps1") + "\" " + args);
        psi.UseShellExecute = false;
        psi.CreateNoWindow = true;
        psi.WorkingDirectory = AppDir;
        return psi;
    }

    // As before this window existed: Edge's app window, else the default browser.
    public static void Fallback(string why)
    {
        Smoke("mode=fallback\r\nwhy=" + why + "\r\n");
        try { Process.Start(Launcher("-AppWindow -Hidden")); }
        catch (Exception e) { MessageBox.Show("Free GST Billing could not start: " + e.Message, "Free GST Billing", MessageBoxButtons.OK, MessageBoxIcon.Error); }
    }

    // Runs the launcher; returns { url or null, everything it printed }.
    public static string[] StartServer()
    {
        StringBuilder text = new StringBuilder();
        string url = null;
        ProcessStartInfo psi = Launcher("-PrintUrl");
        psi.RedirectStandardOutput = true;
        psi.StandardOutputEncoding = Encoding.UTF8;
        try
        {
            using (Process p = new Process())
            {
                p.StartInfo = psi;
                p.OutputDataReceived += delegate (object o, DataReceivedEventArgs a)
                {
                    if (a.Data == null) return;
                    string l = a.Data.TrimStart('\uFEFF');
                    lock (text)
                    {
                        if (l.StartsWith("URL=")) url = l.Substring(4).Trim();
                        else text.AppendLine(l);
                    }
                };
                p.Start();
                p.BeginOutputReadLine();
                // Never p.WaitForExit() without a time: it also waits for the
                // output pipe, which the started server could keep open.
                DateTime end = DateTime.Now.AddSeconds(150);
                while (!p.WaitForExit(200) && DateTime.Now < end) { lock (text) { if (url != null) break; } }
                for (int i = 0; i < 10; i++) { lock (text) { if (url != null) break; } Thread.Sleep(100); }
            }
        }
        catch (Exception e) { lock (text) { text.AppendLine(e.Message); } }
        lock (text)
        {
            if (url != null && !url.StartsWith("http://")) url = null;
            return new string[] { url, text.ToString().Trim() };
        }
    }
}

class MainForm : Form
{
    readonly WebView2 web = new WebView2();
    readonly Splash status = new Splash(); // the start screen - also over the page while the app starts again
    readonly string runtime;
    readonly string placeFile = Path.Combine(Program.DataDir, "window.txt");
    readonly string tipFile = Path.Combine(Program.DataDir, "tray-tip-shown.txt");
    readonly NotifyIcon tray = new NotifyIcon();
    readonly EventWaitHandle showEvent, closeEvent, quitEvent;
    string origin = "";
    int smokeStep;
    string smokeText = "";
    bool reallyClose, problem;
    // Self-repair: a light check of the server every 12 s (window open or in the tray).
    readonly System.Windows.Forms.Timer health = new System.Windows.Forms.Timer();
    int healthMisses, serverPid, renderCrashes;
    bool repairing, checking, pageFailed;
    DateTime busySince = DateTime.MinValue, lastRenderCrash = DateTime.MinValue;
    Task starting; // a server start still running (Quit waits for it, review L1)
    CoreWebView2Notification lastNote;
    public string PendingView; // the screen to open first ("/view=", the jump list)
    string pendingJs; // for the page once it is there (a tray action before the window was ever open)

    public MainForm(string runtime, string eventName)
    {
        this.runtime = runtime;
        Text = "Free GST Billing";
        BackColor = Splash.Back;
        try { Icon = new Icon(Path.Combine(Program.AppDir, "app-icon.ico")); } catch (Exception) { }
        // The icon near the clock: click = the window; right-click = Open / Quit.
        tray.Icon = Icon;
        tray.Text = "Free GST Billing";
        ContextMenuStrip menu = new ContextMenuStrip();
        ToolStripItem version = menu.Items.Add(VersionText());
        version.Enabled = false;
        ToolStripItem open = menu.Items.Add("Open Free GST Billing", null, delegate { ShowFromTray(); });
        open.Font = new Font(open.Font, FontStyle.Bold);
        menu.Items.Add("Check for updates", null, delegate { CheckForUpdates(); });
        menu.Items.Add("Open books folder", null, delegate { OpenBooksFolder(); });
        menu.Items.Add("Make a backup now", null, delegate { BackupNow(); });
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Quit (stop the app)", null, delegate { Quit(); });
        menu.Opening += delegate { version.Text = VersionText(); }; // an update changes it under a running window
        tray.ContextMenuStrip = menu;
        tray.MouseClick += delegate (object o, MouseEventArgs a) { if (a.Button == MouseButtons.Left) ShowFromTray(); };
        // A notice shown near the clock (the app's notifications, the first-close tip): click = the window.
        tray.BalloonTipClicked += delegate
        {
            ShowFromTray();
            if (lastNote != null) { try { lastNote.ReportClicked(); } catch (Exception) { } lastNote = null; }
        };
        string items = "";
        foreach (ToolStripItem i in menu.Items) if (i.Text.Length > 0) items += (items.Length > 0 ? "|" : "") + i.Text;
        Program.Trace("menu=" + items);
        tray.Visible = true;
        Program.Trace("tray=1");
        showEvent = new EventWaitHandle(false, EventResetMode.AutoReset, eventName + "-show");
        closeEvent = new EventWaitHandle(false, EventResetMode.AutoReset, eventName + "-close");
        quitEvent = new EventWaitHandle(false, EventResetMode.AutoReset, eventName + "-quit");
        status.Dock = DockStyle.Fill;
        web.Dock = DockStyle.Fill;
        web.Visible = false;
        web.DefaultBackgroundColor = Splash.Back; // no white flash in dark mode
        Controls.Add(web);
        Controls.Add(status);
        RestorePlace();
        health.Interval = 12000;
        health.Tick += OnHealthTick;
        health.Start();
        FormClosing += OnClosing;
        FormClosed += delegate
        {
            tray.Visible = false;
            tray.Dispose();
            Application.ExitThread();
        };
    }

    // "/tray": the server starts, no window; opening it from the icon starts it as usual.
    public void StartInTray()
    {
        IntPtr made = Handle; // the events need a window handle to post to
        Program.Trace("start-tray handle=" + (made != IntPtr.Zero ? "1" : "0"));
        starting = Task.Run(() =>
        {
            string[] r = Program.StartServer();
            Program.Trace("server url=" + (r[0] ?? "none"));
            // Known now, so the self-repair check watches it in the tray too.
            if (r[0] != null) BeginInvoke((MethodInvoker)delegate { if (origin.Length == 0) origin = new Uri(r[0]).GetLeftPart(UriPartial.Authority); });
        });
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        Thread waiter = new Thread(delegate ()
        {
            WaitHandle[] all = new WaitHandle[] { showEvent, closeEvent, quitEvent };
            while (true)
            {
                int i = WaitHandle.WaitAny(all);
                try
                {
                    if (i == 0) BeginInvoke((MethodInvoker)ShowFromTray);
                    else if (i == 1) { BeginInvoke((MethodInvoker)delegate { Program.Trace("close"); ExitNow(); }); return; }
                    else { BeginInvoke((MethodInvoker)Quit); return; }
                }
                catch (Exception) { return; } // the window is gone
            }
        });
        waiter.IsBackground = true;
        waiter.Start();
    }

    void OnClosing(object sender, FormClosingEventArgs e)
    {
        // X (or Alt+F4): to the tray. Windows shutting down, Task Manager, Quit,
        // the uninstaller and a window that only shows a problem: really closed.
        if (!reallyClose && !problem && e.CloseReason == CloseReason.UserClosing)
        {
            e.Cancel = true;
            SavePlace();
            Hide();
            Program.Trace("hidden");
            if (!File.Exists(tipFile))
            {
                tray.ShowBalloonTip(8000, "Free GST Billing", "Free GST Billing is still running. Click the icon near the clock to open it.", ToolTipIcon.Info);
                try { Directory.CreateDirectory(Program.DataDir); File.WriteAllText(tipFile, DateTime.Now.ToString("s")); } catch (Exception) { }
                Program.Trace("tip");
            }
            return;
        }
        if (Visible) SavePlace();
    }

    void ShowFromTray()
    {
        if (reallyClose) return;
        if (!Visible) Show();
        if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
        Activate();
        Program.Trace("shown");
        // A second start from the jump list: that screen.
        try
        {
            if (File.Exists(Program.ViewFile))
            {
                string v = File.ReadAllText(Program.ViewFile).Trim();
                File.Delete(Program.ViewFile);
                if (Array.IndexOf(Program.Views, v) >= 0)
                {
                    Program.Trace("view=" + v);
                    if (web.CoreWebView2 != null && origin.Length > 0 && !repairing) web.CoreWebView2.Navigate(origin + "/?view=" + v);
                    else PendingView = v;
                }
            }
        }
        catch (Exception) { }
    }

    // Quit: the window, the tray icon and this install's server.
    async void Quit()
    {
        if (reallyClose) return;
        reallyClose = true;
        tray.Visible = false;
        if (Visible) SavePlace();
        Hide();
        Program.Trace("quit");
        // Review L1: a start still running would leave a server with no window.
        Task s = starting;
        if (s != null) { try { await s; } catch (Exception) { } }
        await Task.Run(() => Program.StopServer());
        Program.Trace("server stopped");
        ExitNow();
    }

    // ---- the tray menu's extras

    static string VersionText()
    {
        try
        {
            Match m = Regex.Match(File.ReadAllText(Path.Combine(Program.AppDir, "package.json")), "\"version\"\\s*:\\s*\"([^\"]+)\"");
            if (m.Success) return "Free GST Billing " + m.Groups[1].Value;
        }
        catch (Exception) { }
        return "Free GST Billing";
    }

    // Script for the app's page; kept until the page is there.
    void RunInPage(string js)
    {
        if (web.CoreWebView2 != null && origin.Length > 0 && web.Visible && !repairing) web.CoreWebView2.ExecuteScriptAsync(js);
        else pendingJs = js;
    }

    // The app's own update check: Settings, on its Updates tab (sessionStorage gst_settingsTab).
    void CheckForUpdates()
    {
        ShowFromTray();
        RunInPage("try { sessionStorage.setItem('gst_settingsTab', 'section-updates'); } catch (e) { } location.href = '/?view=settings';");
        Program.Trace("check-updates");
    }

    // The books folder (home.txt), in Explorer.
    void OpenBooksFolder()
    {
        string home = Program.AppDir;
        try
        {
            string h = File.ReadAllLines(Path.Combine(Program.AppDir, "home.txt"))[0].Trim().TrimStart('﻿');
            if (h.Length > 0 && Directory.Exists(h)) home = h;
        }
        catch (Exception) { }
        Program.Trace("open-folder " + home);
        try { Process.Start("explorer.exe", "\"" + home + "\""); } catch (Exception) { }
    }

    // The app's own backup (Control Panel > Backup Data: backup-windows.ps1 through the server).
    async void BackupNow()
    {
        if (origin.Length == 0) { tray.ShowBalloonTip(6000, "Free GST Billing", "The app is still starting. Try again in a moment.", ToolTipIcon.Info); return; }
        tray.ShowBalloonTip(4000, "Free GST Billing", "Making a backup of your books...", ToolTipIcon.Info);
        string o = origin;
        string said = await Task.Run(() =>
        {
            try
            {
                HttpWebRequest q = (HttpWebRequest)WebRequest.Create(o + "/api/control-panel/backup");
                q.Proxy = null;
                q.Method = "POST";
                q.ContentType = "application/json";
                q.Timeout = 300000;
                byte[] body = Encoding.UTF8.GetBytes("{}");
                using (Stream s = q.GetRequestStream()) s.Write(body, 0, body.Length);
                using (HttpWebResponse r = (HttpWebResponse)q.GetResponse())
                using (StreamReader rd = new StreamReader(r.GetResponseStream(), Encoding.UTF8))
                {
                    Dictionary<string, object> j = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(rd.ReadToEnd());
                    object ok, text;
                    if (j.TryGetValue("ok", out ok) && ok is bool && (bool)ok)
                    {
                        string last = "";
                        if (j.TryGetValue("stdout", out text) && text != null)
                            foreach (string l in text.ToString().Split('\n')) if (l.Trim().Length > 0) last = l.Trim();
                        return "Backup made. " + last;
                    }
                    return "The backup did not work: " + (j.TryGetValue("error", out text) && text != null ? text.ToString() : "no reason given") + " (Control Panel > Backup Data shows more.)";
                }
            }
            catch (Exception ex) { return "The backup did not work: " + ex.Message; }
        });
        Program.Trace("backup " + said);
        tray.ShowBalloonTip(10000, "Free GST Billing", said, ToolTipIcon.Info);
    }

    async void OnHealthTick(object sender, EventArgs e)
    {
        if (origin.Length == 0 || repairing || checking || reallyClose || problem) return;
        checking = true;
        string o = origin;
        int pid = await Task.Run(() => Program.ServerPid(o));
        checking = false;
        if (pid != 0)
        {
            healthMisses = 0;
            busySince = DateTime.MinValue;
            serverPid = pid;
            // Back after an update or a repair while the page showed an error: reload it.
            if (pageFailed && web.CoreWebView2 != null) { pageFailed = false; web.CoreWebView2.Navigate(origin + "/"); }
            return;
        }
        if (++healthMisses >= 3) Repair("the server did not answer");
    }

    // The server stopped or crashed: start it again the launcher's way (it
    // never starts a second server for the same books: data\server.lock),
    // then reload. A Setup at work or Quit: leave it alone. After 3 tries:
    // the launcher's own text.
    async void Repair(string why)
    {
        if (repairing || reallyClose || problem || origin.Length == 0) return;
        if (Program.SetupRunning()) { Program.Trace("repair skipped: Setup is running"); return; }
        // Review H1: a server that is BUSY (a big backup blocks its one thread)
        // does not answer but is still running: never start another on the
        // same books. Wait (the start screen stays if the page failed); after
        // 3 minutes, say so in words.
        if (ServerProcessAlive())
        {
            if (busySince == DateTime.MinValue) busySince = DateTime.Now;
            healthMisses = 0;
            Program.Trace("repair skipped: the server is busy, not stopped");
            if ((DateTime.Now - busySince).TotalMinutes >= 3)
                Problem("Free GST Billing is not answering. Wait a minute, or right-click its icon near the clock, choose Quit, and open it again. Your books are safe.");
            return;
        }
        busySince = DateTime.MinValue;
        repairing = true;
        Program.Trace("repair: " + why);
        Cover();
        string[] r = new string[] { null, "" };
        for (int t = 1; t <= 3 && !reallyClose; t++)
        {
            Program.Trace("repair try=" + t);
            Task<string[]> attempt = Task.Run(() => Program.StartServer());
            starting = attempt;
            r = await attempt;
            if (r[0] != null || reallyClose || Program.SetupRunning()) break;
            await Task.Delay(3000);
        }
        repairing = false;
        healthMisses = 0;
        if (reallyClose) return;
        if (r[0] == null)
        {
            if (Program.SetupRunning()) return; // an update took over: it starts the server itself
            Program.Trace("repair gave up");
            Problem(r[1].Length > 0 ? r[1] : "The app's server stopped and did not start again.");
            return;
        }
        string before = origin;
        origin = new Uri(r[0]).GetLeftPart(UriPartial.Authority);
        string now = origin;
        int pidNow = await Task.Run(() => Program.ServerPid(now));
        if (reallyClose) return;
        if (!pageFailed && now == before && pidNow != 0 && pidNow == serverPid)
        {
            // The same server, only slow (a busy PC): the page is kept as it
            // was - nothing typed in it is lost.
            Program.Trace("repair: the server was only slow, the page is kept");
            if (web.CoreWebView2 != null) Uncover(); else health.Interval = 12000;
            return;
        }
        serverPid = pidNow;
        Program.Trace("repaired url=" + r[0]);
        pageFailed = false;
        if (web.CoreWebView2 != null) web.CoreWebView2.Navigate(r[0]);
        else { status.Visible = false; health.Interval = 12000; } // never shown yet ("/tray"): it navigates when opened
    }

    // The last server this window saw (its /api/version pid) still runs.
    bool ServerProcessAlive()
    {
        if (serverPid <= 0) return false;
        try { using (Process p = Process.GetProcessById(serverPid)) return !p.HasExited && p.ProcessName.Equals("node", StringComparison.OrdinalIgnoreCase); }
        catch (Exception) { return false; }
    }

    // The start screen over the page; while it is up the server is checked every 2 s.
    void Cover()
    {
        web.Visible = false;
        status.Visible = true;
        status.BringToFront();
        health.Interval = 2000;
    }

    void Uncover()
    {
        web.Visible = true;
        status.Visible = false;
        health.Interval = 12000;
    }

    // Really closed - also a window that was never shown ("/tray").
    void ExitNow()
    {
        reallyClose = true;
        tray.Visible = false;
        if (Visible) Close();
        Application.ExitThread();
    }

    protected override async void OnShown(EventArgs e)
    {
        base.OnShown(e);
        Task<string[]> server = Task.Run(() => Program.StartServer());
        starting = server;
        try
        {
            Directory.CreateDirectory(Program.DataDir);
            CoreWebView2Environment env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(Program.DataDir, "WebView2"), null);
            await web.EnsureCoreWebView2Async(env);
        }
        catch (Exception ex)
        {
            if (IsDisposed) return; // closed while starting
            Program.Fallback("WebView2 did not start: " + ex.Message);
            ExitNow();
            return;
        }
        if (IsDisposed) return;
        Configure(web.CoreWebView2);
        string[] r = await server;
        if (IsDisposed) return;
        if (r[0] == null)
        {
            Program.Smoke("mode=error\r\ntext=" + r[1].Replace("\r\n", " | ") + "\r\n");
            Problem(r[1].Length > 0 ? r[1] : "The app's server did not start.");
            if (Program.SmokeFile != null) ExitNow();
            return;
        }
        origin = new Uri(r[0]).GetLeftPart(UriPartial.Authority);
        web.CoreWebView2.Navigate(origin + "/" + (PendingView != null ? "?view=" + PendingView : ""));
        PendingView = null;
    }

    void Configure(CoreWebView2 core)
    {
        core.Settings.AreDevToolsEnabled = false;   // no "Inspect", no F12
        core.Settings.IsStatusBarEnabled = false;   // no link addresses at the bottom
        core.Settings.IsPasswordAutosaveEnabled = false;
        core.DocumentTitleChanged += delegate { Text = TitleOf(core.DocumentTitle); Program.Trace("title=" + Text); };
        core.NavigationStarting += delegate (object o, CoreWebView2NavigationStartingEventArgs a)
        {
            if (Ours(a.Uri)) return;
            a.Cancel = true;
            Outside(a.Uri);
        };
        // Other sites (and mailto:) open in the default browser / mail program;
        // the app's own pop-ups (print a table, a PDF) stay in a WebView2 window.
        core.NewWindowRequested += delegate (object o, CoreWebView2NewWindowRequestedEventArgs a)
        {
            if (Ours(a.Uri) || a.Uri.StartsWith("about:") || a.Uri.StartsWith("blob:") || a.Uri.StartsWith("data:")) return;
            a.Handled = true;
            Outside(a.Uri);
        };
        core.PermissionRequested += delegate (object o, CoreWebView2PermissionRequestedEventArgs a)
        {
            // The app asks first in its own words (update notices); several
            // files in a row (an export after a PDF) are the app's own downloads.
            if (Ours(a.Uri) && (a.PermissionKind == CoreWebView2PermissionKind.Notifications || a.PermissionKind == CoreWebView2PermissionKind.ClipboardRead ||
                a.PermissionKind == CoreWebView2PermissionKind.MultipleAutomaticDownloads))
                a.State = CoreWebView2PermissionState.Allow;
        };
        // The app's notifications (an update is out) appear near the clock, also
        // while the window is hidden there; a click opens the window.
        core.NotificationReceived += delegate (object o, CoreWebView2NotificationReceivedEventArgs a)
        {
            if (!Ours(a.SenderOrigin)) return;
            a.Handled = true;
            CoreWebView2Notification n = a.Notification;
            lastNote = n;
            tray.ShowBalloonTip(10000, n.Title.Length > 0 ? n.Title : "Free GST Billing", n.Body.Length > 0 ? n.Body : " ", ToolTipIcon.Info);
            try { n.ReportShown(); } catch (Exception) { }
            Program.Trace("notify " + n.Title);
        };
        core.ProcessFailed += delegate (object o, CoreWebView2ProcessFailedEventArgs a)
        {
            if (a.ProcessFailedKind == CoreWebView2ProcessFailedKind.BrowserProcessExited) Problem("The window's web engine stopped. Close this window and open Free GST Billing again.");
            else if (a.ProcessFailedKind == CoreWebView2ProcessFailedKind.RenderProcessExited)
            {
                // Review L2: a page that crashes every time is not reloaded for ever.
                if ((DateTime.Now - lastRenderCrash).TotalMinutes > 5) renderCrashes = 0;
                lastRenderCrash = DateTime.Now;
                if (++renderCrashes > 3) Problem("The app's page keeps stopping. Close this window and open Free GST Billing again.");
                else core.Reload();
            }
        };
        web.NavigationCompleted += OnNavigated;
    }

    static string TitleOf(string t)
    {
        if (string.IsNullOrWhiteSpace(t) || t.StartsWith("http") || t.StartsWith("localhost")) return "Free GST Billing";
        return t;
    }

    bool Ours(string uri)
    {
        return origin.Length > 0 && (string.Equals(uri, origin, StringComparison.OrdinalIgnoreCase) || uri.StartsWith(origin + "/", StringComparison.OrdinalIgnoreCase));
    }

    static void Outside(string uri)
    {
        if (!(uri.StartsWith("https://") || uri.StartsWith("http://") || uri.StartsWith("mailto:") || uri.StartsWith("tel:"))) return;
        try { Process.Start(new ProcessStartInfo(uri) { UseShellExecute = true }); } catch (Exception) { }
    }

    async void OnNavigated(object sender, CoreWebView2NavigationCompletedEventArgs a)
    {
        if (!a.IsSuccess && (a.WebErrorStatus == CoreWebView2WebErrorStatus.CannotConnect || a.WebErrorStatus == CoreWebView2WebErrorStatus.ConnectionAborted ||
            a.WebErrorStatus == CoreWebView2WebErrorStatus.ConnectionReset || a.WebErrorStatus == CoreWebView2WebErrorStatus.Disconnected ||
            a.WebErrorStatus == CoreWebView2WebErrorStatus.ServerUnreachable || a.WebErrorStatus == CoreWebView2WebErrorStatus.Timeout))
        {
            // Not Chromium's error page: our own start screen, and the server again.
            pageFailed = true;
            Cover();
            Repair("the page could not load (" + a.WebErrorStatus + ")");
            return;
        }
        // Review L3: another failure (an HTTP error page): show it rather than
        // a start screen that never goes away. A navigation replaced by the
        // next one (OperationCanceled) is left to that one.
        if (!a.IsSuccess && a.WebErrorStatus != CoreWebView2WebErrorStatus.OperationCanceled && !web.Visible && !repairing)
        {
            Uncover();
            return;
        }
        if (a.IsSuccess && !repairing && origin.Length > 0)
        {
            // With the server down, the app's offline copy (service worker)
            // answers with its "Needs a Quick Start" page - written for a
            // browser. The window never shows it: the start screen stays and
            // the server is started; the check every 2 s opens the app.
            string o = origin;
            int pid = await Task.Run(() => Program.ServerPid(o));
            if (IsDisposed) return;
            if (pid == 0)
            {
                Program.Trace("offline page hidden");
                pageFailed = true;
                Cover();
                if (!Program.SetupRunning()) Repair("the page came from the offline copy");
                return;
            }
            serverPid = pid;
        }
        if (a.IsSuccess && !web.Visible && !repairing)
        {
            Uncover();
            web.Focus();
        }
        if (a.IsSuccess && pendingJs != null)
        {
            string js = pendingJs;
            pendingJs = null;
            await web.CoreWebView2.ExecuteScriptAsync(js);
        }
        if (Program.SmokeFile == null || !a.IsSuccess) return;
        // Test: the app, then its Settings page; the title must follow the page.
        smokeStep++;
        // The page sets its title once its data is in: wait for it (a busy PC is slow).
        string want = smokeStep == 1 ? "Dashboard - " : "Settings - ";
        for (int i = 0; i < 60 && !IsDisposed && !Text.StartsWith(want); i++) await Task.Delay(250);
        await Task.Delay(500);
        if (IsDisposed) return;
        smokeText += "title" + smokeStep + "=" + Text + "\r\n";
        if (smokeStep == 1)
        {
            web.CoreWebView2.Navigate(origin + "/?view=settings");
            return;
        }
        if (smokeStep != 2) return;
        Program.Smoke("mode=webview2\r\nruntime=" + runtime + "\r\nurl=" + origin + "/\r\n" + smokeText +
            "aumid=" + Program.Aumid + "\r\nuserdata=" + Path.Combine(Program.DataDir, "WebView2") + "\r\n");
        ExitNow();
    }

    void Problem(string text)
    {
        problem = true; // X closes such a window for real
        TextBox box = new TextBox();
        box.Multiline = true;
        box.ReadOnly = true;
        box.BorderStyle = BorderStyle.None;
        box.BackColor = Color.White;
        box.ScrollBars = ScrollBars.Vertical;
        box.Dock = DockStyle.Fill;
        box.Font = new Font("Segoe UI", 11f);
        box.Text = "Free GST Billing could not start.\r\n\r\n" + text.Replace("\r\n", "\n").Replace("\n", "\r\n");
        status.Visible = false;
        web.Visible = false;
        Controls.Add(box);
        box.BringToFront();
    }

    // "x y width height maximized" in the user's own app-data folder.
    void RestorePlace()
    {
        Rectangle area = Screen.PrimaryScreen.WorkingArea;
        Size size = new Size(Math.Min(1280, area.Width * 9 / 10), Math.Min(820, area.Height * 9 / 10));
        StartPosition = FormStartPosition.Manual;
        Bounds = new Rectangle(area.X + (area.Width - size.Width) / 2, area.Y + (area.Height - size.Height) / 2, size.Width, size.Height);
        // 7 Nov (maintainer): the first time it opens full screen (maximized);
        // after that, the size and place the user left it in.
        WindowState = FormWindowState.Maximized;
        try
        {
            string[] v = File.ReadAllText(placeFile).Trim().Split(' ');
            Rectangle r = new Rectangle(int.Parse(v[0]), int.Parse(v[1]), int.Parse(v[2]), int.Parse(v[3]));
            bool seen = false;
            foreach (Screen s in Screen.AllScreens) if (s.WorkingArea.IntersectsWith(r)) seen = true;
            if (seen && r.Width >= 400 && r.Height >= 300) Bounds = r;
            WindowState = v.Length > 4 && v[4] == "1" ? FormWindowState.Maximized : FormWindowState.Normal;
        }
        catch (Exception) { }
    }

    void SavePlace()
    {
        try
        {
            Rectangle r = WindowState == FormWindowState.Normal ? Bounds : RestoreBounds;
            Directory.CreateDirectory(Program.DataDir);
            File.WriteAllText(placeFile, r.X + " " + r.Y + " " + r.Width + " " + r.Height + " " + (WindowState == FormWindowState.Maximized ? "1" : "0"));
        }
        catch (Exception) { }
    }
}

// The start screen, also shown over the page while the app starts again: the
// app's icon, its name, a thin moving bar and "by DiceCodes". Light or dark
// like the app's own theme (Settings; kept in the books folder's
// data\local-prefs.json, light when not set) and the app's own background,
// so there is no flash. The logo is read into memory (never left open), so an
// update can replace dist\ while the window is open.
class Splash : Control
{
    static readonly bool dark = IsDark();
    public static Color Back { get { return dark ? Color.FromArgb(15, 23, 42) : Color.FromArgb(240, 242, 245); } }
    readonly Image logo;
    readonly System.Windows.Forms.Timer tick = new System.Windows.Forms.Timer();
    int phase;

    static bool IsDark()
    {
        try
        {
            string books = Program.AppDir;
            try
            {
                string h = File.ReadAllLines(Path.Combine(Program.AppDir, "home.txt"))[0].Trim().TrimStart('﻿');
                if (h.Length > 0) books = h;
            }
            catch (Exception) { }
            string prefs = File.ReadAllText(Path.Combine(books, "data", "local-prefs.json"));
            return Regex.IsMatch(prefs, "\"freegstbill_theme\"\\s*:\\s*\"dark\"");
        }
        catch (Exception) { return false; }
    }

    public Splash()
    {
        SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint | ControlStyles.ResizeRedraw, true);
        BackColor = Back;
        try
        {
            using (MemoryStream ms = new MemoryStream(File.ReadAllBytes(Path.Combine(Program.AppDir, "dist", "icons", "icon-512.png"))))
            using (Image img = Image.FromStream(ms)) logo = new Bitmap(img);
        }
        catch (Exception)
        {
            try { using (Icon ic = new Icon(Path.Combine(Program.AppDir, "app-icon.ico"), 256, 256)) logo = ic.ToBitmap(); } catch (Exception) { }
        }
        tick.Interval = 30;
        tick.Tick += delegate { phase = (phase + 3) % 260; Invalidate(); };
        VisibleChanged += delegate { tick.Enabled = Visible; };
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        Graphics g = e.Graphics;
        g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
        g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
        g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;
        float s = g.DpiX / 96f;
        Color ink = dark ? Color.FromArgb(226, 232, 240) : Color.FromArgb(15, 23, 42);
        Color muted = dark ? Color.FromArgb(148, 163, 184) : Color.FromArgb(100, 116, 139);
        Color track = dark ? Color.FromArgb(30, 41, 59) : Color.FromArgb(203, 213, 225);
        Color blue = Color.FromArgb(37, 99, 235);
        int logoSize = (int)(72 * s), gap1 = (int)(18 * s), gap2 = (int)(20 * s);
        int barW = (int)(180 * s), barH = Math.Max(2, (int)(3 * s));
        using (Font name = new Font("Segoe UI Semibold", 18f))
        using (Font by = new Font("Segoe UI", 9f))
        {
            const string title = "Free GST Billing";
            SizeF ts = g.MeasureString(title, name);
            int block = logoSize + gap1 + (int)ts.Height + gap2 + barH;
            int top = Math.Max((int)(12 * s), (Height - block) / 2 - (int)(24 * s));
            int cx = Width / 2;
            if (logo != null) g.DrawImage(logo, cx - logoSize / 2, top, logoSize, logoSize);
            int y = top + logoSize + gap1;
            using (Brush b = new SolidBrush(ink)) g.DrawString(title, name, b, cx - ts.Width / 2, y);
            y += (int)ts.Height + gap2;
            Rectangle bar = new Rectangle(cx - barW / 2, y, barW, barH);
            using (Brush b = new SolidBrush(track)) g.FillRectangle(b, bar);
            int seg = barW * 35 / 100;
            int x = bar.X - seg + (barW + seg) * phase / 260;
            g.SetClip(bar);
            using (Brush b = new SolidBrush(blue)) g.FillRectangle(b, x, bar.Y, seg, barH);
            g.ResetClip();
            SizeF bs = g.MeasureString("by DiceCodes", by);
            using (Brush b = new SolidBrush(muted)) g.DrawString("by DiceCodes", by, b, cx - bs.Width / 2, Height - bs.Height - (int)(28 * s));
        }
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing) { tick.Dispose(); if (logo != null) logo.Dispose(); }
        base.Dispose(disposing);
    }
}
