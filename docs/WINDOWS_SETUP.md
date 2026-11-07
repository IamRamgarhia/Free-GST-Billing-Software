# The Windows Setup (`Free-GST-Billing-Windows-Setup.exe`) - for maintainers

From v1.10.84 there is a normal Windows installer beside the ZIP. It is built
with Inno Setup 6 from `installer/free-gst-billing.iss`.

## The top rule

**A new install never harms the previous installation.** Users' real invoices
are in it. The Setup never writes, moves, renames or deletes anything inside an
earlier copy's folder (its `data/`, `Saved Invoices/`, `Trash/`, scripts,
`node_modules`):

- **Keep** only points the new app at that folder (`home.txt`).
- **Move** only *copies* `data/`, `Saved Invoices/` and `Trash/` to the new
  folder, then checks every file (count, sizes, SHA-256 of every file) before
  switching. A failed check stops Setup; nothing is switched over.
- Before either: the old server is stopped **by its own process id**
  (`data/server.lock`, the TEMP start file of ERR-076, or a command line that
  names that copy's `server.js` - never "all node.exe"), and a ZIP of the old
  `data/` is made with `tar.exe` **in the new folder** (`Setup backups\`).
- Old Desktop / Start-menu / Startup shortcuts are **moved** into
  `<new folder>\Old shortcuts (backup)\`, never deleted (put one back to undo).
- Everything is written to `Free GST Billing - install log.txt` in the new
  folder; the last page shows its path.
- With Keep (or "use books in another folder"), the log, backup ZIP and old
  shortcuts go to `C:\Users\<name>\Free GST Billing` instead - never into the old copy.

`scripts/test-windows-setup.mjs` hashes the whole earlier copy before and after
every install, update and uninstall and fails on any difference.

### Review fixes (5 Nov 2026)

| | What | How |
| --- | --- | --- |
| H1 | The one-line installer's copy lives in `%LOCALAPPDATA%\Programs\Free GST Billing\_system` | Setup installs only into a folder of its own: when that folder exists and is not a Setup copy, it uses `...\Free GST Billing App`. Keep and Copy work from there. |
| H2 | After Copy, an old icon could start the OLD server on the old port and the new icon opened it | The copy gets a free port of its own; the launcher opens a running server only if `/api/version` says it serves this install's books (a Setup copy refuses one too old to say); old taskbar pins and Start-menu subfolder shortcuts are moved to the backup too. |
| H3 | "Choose" took any folder with `data\`; Yes to delete could empty it | Choose needs books (`data\profile.json`, or `*.json` in `data\bills`, `clients` or `profiles`). Delete-my-books refuses Documents, the user folder, the Desktop, a drive root, AppData, the program folder, an earlier copy's own folder, and any folder without `data\profile.json` or `data\bills`; it only ever deletes that folder's `data`, `Saved Invoices` and `Trash`. |
| H4 | With two earlier copies only one was offered | All are listed, last changed first (folder, invoices, date), and the user picks. A silent Setup with more than one and no `/DATAMODE` + `/OLDDIR` stops without changing anything. |
| M1 | Two Setups at once | `SetupMutex`; a failed copy removes only the files and folders that run made. |
| M2 | Shortcuts moved before the install | Old shortcuts move after a successful install; a same-named one the new icon replaces is copied first. The old server is stopped just before the backup and copy, after every check. |
| M3 | Missing books folder | An update never creates the books folder; a Setup copy whose `home.txt` is missing or empty refuses to start (server and launcher) instead of using the program folder. |
| M4 | Lock | The lock holds the PC name and a random id; it is read back after taking it, written at listen only while it is ours, "running" means `/api/version` answers with that process or id, and another PC's lock is never taken over. |
| M5 | Updater | Every download hop must be https on `github.com`, `objects.githubusercontent.com` or `release-assets.githubusercontent.com`; the size must equal the GitHub API's; the SHA-256 must equal the release asset's `digest` when GitHub gives one (else the gap is noted). No `[InstallDelete]`: old program files go only after the new ones are in (`installed-files.txt` + `prune`); an update that fails starts the version that is there again, and the page shows the Setup's log path. |
| M6 | `-Command` strings | `stop-app.ps1` runs with `-File` and separate arguments; arguments ending in `\` are quoted so `E:\` survives; the old server must no longer answer before anything is copied. Tested with spaces, `'`, `‘ ’` and Hindi in the folder names. |

**Signing (later):** sign `Free-GST-Billing-Windows-Setup.exe` with an
Authenticode certificate (`SignTool=` in the .iss); the updater should then
also check the signature (`Get-AuthenticodeSignature`) before running it.

## Build

```bash
npm run release:exe            # = node scripts/build-installer.mjs
```

1. Builds `dist/` (`npm run build`; `--skip-build` if it is fresh).
2. Stages the app with `scripts/build-release-zip.mjs --no-zip`: exactly what
   the ZIP's `_system/` holds, production packages included.
3. Takes out what only the ZIP uses: `install-` / `update-` / `move-` /
   `uninstall-windows.ps1`, the `.sh` / `.command` files, the empty `data/`.
4. Builds the app's own window, `Free GST Billing.exe` (below), with the C#
   compiler that is part of Windows
   (`C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe`, C# 5, .NET
   Framework 4.x - nothing to install) and Microsoft's WebView2 SDK: the NuGet
   package `Microsoft.Web.WebView2` **1.0.4258.31**, unpacked in
   `.installer-cache/webview2-sdk/pkg` (or `WEBVIEW2_SDK=<folder>`). The
   three files used are checked against SHA-256s in `build-installer.mjs`;
   another SDK version needs new hashes there (check `Get-AuthenticodeSignature`:
   *Valid*, *Microsoft Corporation*).
   It also takes Microsoft's WebView2 Runtime installer (the Evergreen
   bootstrapper `MicrosoftEdgeWebview2Setup.exe`, about 2 MB, from
   <https://go.microsoft.com/fwlink/p/?LinkId=2124703>) from
   `.installer-cache/webview2-bootstrapper/` (or
   `WEBVIEW2_BOOTSTRAPPER=<file>`): its SHA-256 is pinned in
   `build-installer.mjs` and its signature must be valid, Microsoft
   Corporation. Microsoft updates that file now and then: a fresh download
   needs its new hash there.
5. Adds the official portable `node.exe`, **Node.js 22 LTS** (the version is
   `SETUP_NODE_VERSION` in `build-installer.mjs`, now v22.23.4): downloaded
   once into `.installer-cache/`, refused unless its SHA-256 matches
   nodejs.org's `SHASUMS256.txt`. The ZIP still uses `$PortableNodeVersion` in
   `ensure-node.ps1` (Node.js 20); ZIP users move in a later release.
6. Compiles with `ISCC.exe` (found in `%LOCALAPPDATA%\Programs\Inno Setup 6`,
   Program Files, or `ISCC=<path>`) into
   `release-build/Free-GST-Billing-Windows-Setup.exe` (about 30 MB).

Run it **after** `npm run release:zip` (which empties `release-build/`).
Inno Setup 6: <https://jrsoftware.org/isdl.php> (per-user install is enough:
`innosetup-6.x.exe /VERYSILENT /CURRENTUSER`). Check its signature first:
`Get-AuthenticodeSignature` must say *Valid*, signer *Pyrsys B.V.*

## Publish

Upload the exe to the same GitHub release as the ZIP, under exactly this name:

```bash
gh release upload v<NEW> release-build/Free-GST-Billing-Windows-Setup.exe
curl -sIL -o /dev/null -w "%{http_code}\n" \
  https://github.com/IamRamgarhia/Free-GST-Billing-Software/releases/latest/download/Free-GST-Billing-Windows-Setup.exe
```

An installed copy's **Update now** reads the latest release from the GitHub API,
takes that asset's download URL, size and SHA-256 (`digest`), and downloads it
(server.js `updateWithSetup`, checks in `src/utils/setupDownload.js`). The build
also writes `Free-GST-Billing-Windows-Setup.exe.sha256` for people who check by
hand (upload it too if you like). A release without the exe tells installed users "the new
version's Setup is not on GitHub yet". The ZIP updaters take the first
`*.zip` of the release, so the exe does not disturb them.

The exe is **unsigned**: Windows SmartScreen shows "Windows protected your PC"
for a downloaded copy until it has a reputation (More info -> Run anyway).
Updates from inside the app are not affected (a file Node.js downloads has no
"from the internet" mark).

## How it works

| What | Where |
| --- | --- |
| Program | `%LOCALAPPDATA%\Programs\Free GST Billing` (per user, no admin), with `node\node.exe`; `...\Free GST Billing App` when the one-line installer's copy is in the first folder |
| Books folder | `home.txt` next to `server.js` (one line, the full path); default `C:\Users\<name>\Free GST Billing` (not Documents: Windows Security's Controlled folder access blocks unknown programs there, ERR-082) |
| "Installed by Setup" marker | `installed.txt` next to `server.js` (test mode: `testroot=...`) |
| Uninstall entry | `HKCU\...\Uninstall\FreeGSTBilling_is1` (test mode: `FreeGSTBilling-TEST_is1`) |
| Icons | Start menu, Desktop (task, ticked), Startup (task; ticked when the old copy had one) |
| One server per books | `data/server.lock` (`{pid, port, at}`), `src/utils/serverLock.js` |

- **Where the books are** (`src/utils/appHome.js`): `FGSB_HOME` (environment,
  used by the Linux packages), else `home.txt`, else `server.js`'s own folder -
  so the ZIP is unchanged. `start-`, `stop-`, `backup-` and
  `restore-windows.ps1` use the same order.
- **Opening the app**: the icons open `Free GST Billing.exe`, the app's own
  window (next section). It runs `start-windows.ps1 -PrintUrl` (the ZIP's
  mechanics: TEMP start file, `port.txt`, hidden start, and the H2 rule: only
  a server that serves this install's books), which prints the address. In a
  Setup copy the launcher uses `node\node.exe` and skips the ZIP-only tidy-ups.
- **Finding an earlier copy** (`installer/setup-helper.mjs detect`): the
  shortcuts on the Desktop, in the Start menu and Startup, plus the usual
  folders (`%LOCALAPPDATA%\Programs\Free GST Billing`, `Documents`, `Desktop`,
  `Downloads\*GST*`). From each, up to 4 folders up, a folder whose
  `package.json` is this app. **A source checkout run from its own shortcut is
  found too** (the maintainer's PC).
- **Update**: same AppId, so Setup stops the running server (by its id),
  replaces `dist/`, `node_modules/`, `src/` and the rest, keeps `home.txt` and
  starts the app again. Silent from the app:
  `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART`; the page polls `/api/version`
  and reloads. The open window's exe and DLLs are locked, so Setup first
  renames them to `*.old` (Windows allows that for a running program; if it
  fails, Setup stops before anything is changed) and installs the new ones
  beside them: no reboot, the window stays open and the page reloads. The
  `*.old` files are deleted by Setup when no window holds them, else by the
  window's next start; an update that fails puts them back.
- **Two servers on one books folder** can never run: a second server finds the
  live lock and exits ("already running"); its launcher then opens the running
  one through `port.txt`. A lock whose process is gone is taken over. Old ZIP
  versions (before 1.10.84) do not check the lock - that is why Setup moves
  their icons away.
- **Uninstall** closes the app's window (`stop-app.ps1 -CloseWindow`: only
  the window of that program folder), stops the server, removes the program,
  the icons and the window's `WebView2` profile and `window.txt`, and asks
  *Also delete your books?* (default **No**; silent: `/DELETEBOOKS=yes`).
  Books in an earlier copy's own folder (Keep) are never deleted by it.

## The WebView2 Runtime

Windows 11 and nearly every Windows 10 PC have it. After installing, Setup
looks for it (registry `pv` of `{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}` under
`HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients` and
`HKCU\Software\Microsoft\EdgeUpdate\Clients`, not empty and not `0.0.0.0`).
Missing: it runs the bundled bootstrapper `/silent /install` (per user, no
administrator, at most 10 minutes; it downloads the runtime, so it needs the
internet) through `setup-helper.mjs run-timed`, and writes the result in the
install log. A failure never stops Setup: the window then uses Edge's app
window. In test mode nothing real is installed; `/FAKEWEBVIEW2=<program>`
acts as if it were missing and runs that program instead (scenario H uses a
stand-in that fails).

## The app's own window (`Free GST Billing.exe`)

Only the Setup has it; the ZIP (Mac, Linux, Windows without installing) is
unchanged and opens Edge's app window or the browser. Source:
`installer/host/FreeGSTBilling.cs` (one file, WinForms + WebView2, the Edge
engine every Windows 10/11 has).

| What | How |
| --- | --- |
| Start | Shows "Starting Free GST Billing..." at once; runs `start-windows.ps1 -PrintUrl` and opens the address it prints. If the launcher fails, its text is shown in the window (never a blank page). |
| No WebView2 Runtime (or it fails to start) | Setup installs it first (below). Still missing: hands over to `start-windows.ps1 -AppWindow -Hidden`, Edge's app window as before, else the default browser. That fallback has no tray icon. |
| Close (X) | Hides the window to the tray (the icon near the clock); the app and its server keep running, no taskbar button. The first time, a tip says so (`tray-tip-shown.txt` in the window's folder). Click the icon, or start the app again, to show it. Windows shutting down / logging off and Task Manager's End task (a bare WM_CLOSE) close it for real. A window that only shows a start-up problem closes for real. |
| Self-repair | While the window is open or in the tray it asks `/api/version` every 12 s (quietly, 8 s time limit). Three misses, or a page that cannot load: "Starting again...", `start-windows.ps1 -PrintUrl` (the same lock rules: never a second server for the books), then the page reloads - only if the server is a new process (its `pid`) or the page had failed: a server that was only slow keeps the page as it was, so nothing typed is lost. Not while a Setup runs (its `FreeGSTBillingSetup` mutex) or Quit runs; after 3 tries the launcher's own text is shown. |
| Notifications | The app's notifications (the Notification API: "an update is out") are shown near the clock through `NotificationReceived`, also while the window is hidden; a click opens the window. A hidden window keeps running (timers too). The overdue / low-stock notices are the bell inside the app, not Windows notifications. |
| Jump list | Right-click the taskbar or Start icon: New Invoice, Dashboard, Clients, Reports = `Free GST Billing.exe /view=<screen>` (the app's own `?view=`). A running window goes to that screen (`open-view.txt` in the window's folder + the `-show` event). Built with WPF's `JumpList` (part of .NET Framework), under the window's AppUserModelID. |
| Tray menu | The version (greyed), **Open Free GST Billing**, **Check for updates** (opens Settings on its Updates tab, the app's own check), **Open books folder** (the `home.txt` folder in Explorer), **Make a backup now** (the app's own backup, Control Panel > Backup Data: `backup-windows.ps1` into Documents\FreeGSTBill Backups; the result is shown near the clock), **Quit (stop the app)**: Quit closes the window and the tray icon and stops this install's server by its own id (`stop-app.ps1 -Sys`, as the uninstaller), never "all node.exe". |
| Start with Windows | The Startup icon runs `Free GST Billing.exe /tray`: the server starts and the app waits near the clock, no window. |
| Events | `Local\FreeGSTBillingHost-<first 8 bytes of SHA-1 of the lower-case program folder>` + `-show` (a second start), `-close` (the uninstaller: `stop-app.ps1 -CloseWindow`, which kills only if the window has not closed within 5 s) and `-quit`. |
| Title | The page's `document.title` ("Invoices - DiceCodes"). |
| Taskbar | AppUserModelID `DiceCodes.FreeGSTBilling` on the window and on the Setup's icons ([Icons] `AppUserModelID`), so a pin is this program with its icon (test mode: `DiceCodes.FreeGSTBilling.Test`). |
| One window | A mutex per program folder; a second start brings the open window forward. |
| Size and place | `%LOCALAPPDATA%\Free GST Billing\window.txt` (place, size, maximized). |
| WebView2 profile | `%LOCALAPPDATA%\Free GST Billing\WebView2` (never Documents - ERR-082 - or the program folder). Test mode: `<test folder>\LocalAppData\Free GST Billing`. |
| Links | The app's own pages stay; other sites, `target=_blank` to other sites and `mailto:` open in the default browser / mail program. The app's own pop-ups (print a table or receipt, a PDF) open in a WebView2 window. |
| Downloads, print, file pickers, clipboard, service worker | WebView2's own: downloads go to Downloads with its download list, `window.print()` shows the print preview. Notifications and clipboard reading are allowed for the app only. |
| Context menu | WebView2's, without Inspect (DevTools off), no status bar. |

**localStorage moves with the window.** WebView2 has its own storage, so
settings kept only in the browser would start empty. Everything that matters
is in the books folder already (PIN: server side; invoice defaults: server
side) or mirrored to `data/local-prefs.json` (`src/utils/prefsMirror.js`) and
restored on the first start: print & PDF settings, region, features, business
type, menu order, units, dashboard columns, GST filed marks, income-tax
inputs, theme, welcome/onboarding, and from v1.10.84 custom field names, text
size, preview open/closed, the last bank account used, dismissed notices and
update reminders. Not carried: an unsaved invoice draft (sessionStorage: it
never survived closing a window, in Edge either), the problem log (only for
Report a problem) and caches. Keys that only v1.10.84 mirrors reach the books
folder once a 1.10.84 page has run in the old browser (an in-app update from
Edge reloads it there); a copy going straight from an older ZIP to the Setup
starts those few with their defaults.

## Command line

| Parameter | Meaning |
| --- | --- |
| `/DATAMODE=keep\|move\|new\|choose` | the books question, for silent installs (default: keep if an earlier copy is found, else new) |
| `/DATADIR=<folder>` | choose: the books folder; move / new: where to |
| `/NOSTART=1` | do not start the app at the end |
| `/DELETEBOOKS=yes` | uninstaller: also delete the books |
| `/TESTROOT=<folder>` | **test mode** (below) |
| `/PORT=<n>` | test mode: the port for new books (default 47461; 47371-47373 and 47398 refused) |
| `/FAKEWEBVIEW2=<program>` | test mode: act as if the WebView2 Runtime were missing and run `<program>` instead of Microsoft's installer |

## Test mode - use it for every test on a PC with real books

`/TESTROOT=<folder>`: the program goes to `<folder>\Programs\Free GST Billing`,
books to `<folder>\Free GST Billing`, icons to `<folder>\Desktop`,
`\Programs`, `\Startup`; earlier copies are looked for **only** inside the
folder; its own AppId (`FreeGSTBilling-TEST`), so its uninstall entry cannot
touch a real one; port 47461; no browser window opens (`FREEGSTBILL_TEST`);
the app's own window opens only from its icons or the last page, with its
profile in `<folder>\LocalAppData`; and the books folder must be inside the
test folder.

```bash
node scripts/build-installer.mjs
node scripts/build-installer.mjs --skip-build --version=1.10.99 --outDir=release-build/upgrade-test
node scripts/test-windows-setup.mjs        # A: new, in-app update, uninstall, reinstall, delete
                                           # B: earlier ZIP copy, keep, lock, update, uninstall
                                           # C: earlier ZIP copy, move, update, uninstall
                                           # D-G: see the top of the file
                                           # H: the app's own window: icon, title, one
                                           #    window, update with it open, no-WebView2
                                           #    fallback, uninstall with it open
```

The window can be checked by hand in test mode: `FGSB_HOST_SMOKE=<file>`
makes it load the app and Settings, write what it saw to `<file>` and close;
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=<n>` lets
Playwright drive it (`chromium.connectOverCDP`); and
`WEBVIEW2_BROWSER_EXECUTABLE_FOLDER=<empty folder>` simulates a PC without
WebView2.

By hand, a test install and its removal:

```powershell
.\Free-GST-Billing-Windows-Setup.exe /TESTROOT=$env:TEMP\fgsb-try
# ... try it (http://localhost:47461) ...
& "$env:TEMP\fgsb-try\Programs\Free GST Billing\unins000.exe"
```

## Not done yet

- Code signing (SmartScreen warning on downloaded copies).
- The Control Panel's *Remove the App* opens the guide for a Setup copy;
  removing is done in Settings -> Apps.
- The Setup carries Node.js 22 LTS; the ZIP's portable Node.js
  (`$PortableNodeVersion`, 20, past its end of life in April 2026) moves in a
  later release.
