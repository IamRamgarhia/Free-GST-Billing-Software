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
  shortcuts go to `Documents\Free GST Billing` instead - never into the old copy.

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
4. Adds the official portable `node.exe` (the version is `$PortableNodeVersion`
   in `ensure-node.ps1`): downloaded once into `.installer-cache/`, refused
   unless its SHA-256 matches nodejs.org's `SHASUMS256.txt`.
5. Compiles with `ISCC.exe` (found in `%LOCALAPPDATA%\Programs\Inno Setup 6`,
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
| Books folder | `home.txt` next to `server.js` (one line, the full path); default `Documents\Free GST Billing` |
| "Installed by Setup" marker | `installed.txt` next to `server.js` (test mode: `testroot=...`) |
| Uninstall entry | `HKCU\...\Uninstall\FreeGSTBilling_is1` (test mode: `FreeGSTBilling-TEST_is1`) |
| Icons | Start menu, Desktop (task, ticked), Startup (task; ticked when the old copy had one) |
| One server per books | `data/server.lock` (`{pid, port, at}`), `src/utils/serverLock.js` |

- **Where the books are** (`src/utils/appHome.js`): `FGSB_HOME` (environment,
  used by the Linux packages), else `home.txt`, else `server.js`'s own folder -
  so the ZIP is unchanged. `start-`, `stop-`, `backup-` and
  `restore-windows.ps1` use the same order.
- **Opening the app**: the icons run `start-windows.ps1 -AppWindow -Hidden`
  (the ZIP's mechanics: TEMP start file, `port.txt`, hidden start). In a Setup
  copy it uses `node\node.exe` and skips the ZIP-only tidy-ups.
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
  and reloads.
- **Two servers on one books folder** can never run: a second server finds the
  live lock and exits ("already running"); its launcher then opens the running
  one through `port.txt`. A lock whose process is gone is taken over. Old ZIP
  versions (before 1.10.84) do not check the lock - that is why Setup moves
  their icons away.
- **Uninstall** stops the app, removes the program and icons, and asks *Also
  delete your books?* (default **No**; silent: `/DELETEBOOKS=yes`). Books in an
  earlier copy's own folder (Keep) are never deleted by it.

## Command line

| Parameter | Meaning |
| --- | --- |
| `/DATAMODE=keep\|move\|new\|choose` | the books question, for silent installs (default: keep if an earlier copy is found, else new) |
| `/DATADIR=<folder>` | choose: the books folder; move / new: where to |
| `/NOSTART=1` | do not start the app at the end |
| `/DELETEBOOKS=yes` | uninstaller: also delete the books |
| `/TESTROOT=<folder>` | **test mode** (below) |
| `/PORT=<n>` | test mode: the port for new books (default 47461; 47371-47373 and 47398 refused) |

## Test mode - use it for every test on a PC with real books

`/TESTROOT=<folder>`: the program goes to `<folder>\Programs\Free GST Billing`,
books to `<folder>\Documents\Free GST Billing`, icons to `<folder>\Desktop`,
`\Programs`, `\Startup`; earlier copies are looked for **only** inside the
folder; its own AppId (`FreeGSTBilling-TEST`), so its uninstall entry cannot
touch a real one; port 47461; no window opens (`FREEGSTBILL_TEST`); and the
books folder must be inside the test folder.

```bash
node scripts/build-installer.mjs
node scripts/build-installer.mjs --skip-build --version=1.10.99 --outDir=release-build/upgrade-test
node scripts/test-windows-setup.mjs        # A: new, in-app update, uninstall, reinstall, delete
                                           # B: earlier ZIP copy, keep, lock, update, uninstall
                                           # C: earlier ZIP copy, move, update, uninstall
```

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
- Node.js 20 is past its end of life (April 2026); move `$PortableNodeVersion`
  to the current LTS once the ZIP's portable Node.js moves too.
