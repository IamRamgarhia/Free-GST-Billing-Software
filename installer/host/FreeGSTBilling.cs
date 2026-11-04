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
//   - FGSB_HOST_SMOKE=<file> (tests): load the app, open Settings, write what was
//     seen to <file> and close.

using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
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

    public static string AppDir, DataDir, Aumid, SmokeFile;

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

        // Sharp text on high-DPI screens (per-monitor v2, Windows 10 1703+).
        try { if (!SetProcessDpiAwarenessContext(new IntPtr(-4))) SetProcessDPIAware(); } catch (Exception) { try { SetProcessDPIAware(); } catch (Exception) { } }
        SetCurrentProcessExplicitAppUserModelID(Aumid);

        bool first;
        using (Mutex one = new Mutex(true, @"Local\FreeGSTBillingHost-" + Hash(AppDir.ToLowerInvariant()), out first))
        {
            if (!first)
            {
                Smoke("instance=second\r\nforwarded=" + (BringForward() ? "1" : "0") + "\r\n");
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
            Application.Run(new MainForm(runtime));
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

    // The window of this program folder's first copy (an update may have
    // renamed its exe: the folder is compared, not the file).
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
    readonly Label status = new Label();
    readonly string runtime;
    readonly string placeFile = Path.Combine(Program.DataDir, "window.txt");
    string origin = "";
    int smokeStep;
    string smokeText = "";

    public MainForm(string runtime)
    {
        this.runtime = runtime;
        Text = "Free GST Billing";
        BackColor = Color.White;
        try { Icon = new Icon(Path.Combine(Program.AppDir, "app-icon.ico")); } catch (Exception) { }
        status.Dock = DockStyle.Fill;
        status.TextAlign = ContentAlignment.MiddleCenter;
        status.Font = new Font("Segoe UI", 12f);
        status.ForeColor = Color.FromArgb(70, 70, 70);
        status.Text = "Starting Free GST Billing...";
        web.Dock = DockStyle.Fill;
        web.Visible = false;
        Controls.Add(web);
        Controls.Add(status);
        RestorePlace();
        FormClosing += delegate { SavePlace(); };
    }

    protected override async void OnShown(EventArgs e)
    {
        base.OnShown(e);
        Task<string[]> server = Task.Run(() => Program.StartServer());
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
            Close();
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
            if (Program.SmokeFile != null) Close();
            return;
        }
        origin = new Uri(r[0]).GetLeftPart(UriPartial.Authority);
        web.CoreWebView2.Navigate(r[0]);
    }

    void Configure(CoreWebView2 core)
    {
        core.Settings.AreDevToolsEnabled = false;   // no "Inspect", no F12
        core.Settings.IsStatusBarEnabled = false;   // no link addresses at the bottom
        core.Settings.IsPasswordAutosaveEnabled = false;
        core.DocumentTitleChanged += delegate { Text = TitleOf(core.DocumentTitle); };
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
        core.ProcessFailed += delegate (object o, CoreWebView2ProcessFailedEventArgs a)
        {
            if (a.ProcessFailedKind == CoreWebView2ProcessFailedKind.BrowserProcessExited) Problem("The window's web engine stopped. Close this window and open Free GST Billing again.");
            else if (a.ProcessFailedKind == CoreWebView2ProcessFailedKind.RenderProcessExited) core.Reload();
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
        if (a.IsSuccess && !web.Visible)
        {
            web.Visible = true;
            status.Visible = false;
            web.Focus();
        }
        if (Program.SmokeFile == null || !a.IsSuccess) return;
        // Test: the app, then its Settings page; the title must follow the page.
        smokeStep++;
        await Task.Delay(2500);
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
        Close();
    }

    void Problem(string text)
    {
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
        try
        {
            string[] v = File.ReadAllText(placeFile).Trim().Split(' ');
            Rectangle r = new Rectangle(int.Parse(v[0]), int.Parse(v[1]), int.Parse(v[2]), int.Parse(v[3]));
            bool seen = false;
            foreach (Screen s in Screen.AllScreens) if (s.WorkingArea.IntersectsWith(r)) seen = true;
            if (seen && r.Width >= 400 && r.Height >= 300) Bounds = r;
            if (v.Length > 4 && v[4] == "1") WindowState = FormWindowState.Maximized;
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
