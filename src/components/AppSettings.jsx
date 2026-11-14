import { useState, useEffect } from 'react';
import { Download, RefreshCw, Package, FolderOpen, StopCircle, Upload, AlertCircle, CheckCircle, Trash2, RotateCcw } from 'lucide-react';
import { toast } from './Toast';
import HelpButton from './HelpButton';
import { docsLink } from '../utils';
import { runUpdateNow } from '../store';

// v1.10.44 — In-app Control Panel: the launcher's jobs (Update / Backup /
// Restore / Move / Stop / Open folders) without opening the app folder.
// Buttons hit /api/control-panel/* on the server (PC-only for paired phones),
// which runs the scripts under `_system-scripts/`. Installed without them
// (e.g. `git clone && npm start`), the server reports which actions have no
// script and those buttons say "Not available here". Nothing crashes.
//
// v1.10.86 (maintainer, 15 Nov: "move the Control Panel into Settings") - it
// is no longer a screen of its own:
//   AppAndUpdates -> Settings -> App & updates (#section-updates, #section-app)
//   BackupFiles   -> Settings -> Data & Backups (#section-backupzip)
// Settings' own update card and the Control Panel's Update card were merged
// into one (Check for updates + one Update Now with the progress window).

// v1.10.86 - "win32" is Node's name for every Windows, 64-bit too: show plain words.
const OS_NAMES = { win32: 'Windows', darwin: 'Mac', linux: 'Linux' };
const ARCH_BITS = { x64: '64-bit', arm64: 'ARM 64-bit', ia32: '32-bit', arm: 'ARM' };
const platformName = (platform, arch) => {
  const os = OS_NAMES[platform] || platform || '';
  return ARCH_BITS[arch] ? `${os} (${ARCH_BITS[arch]})` : os;
};

// v1.10.86 (maintainer: "why we are showing these") - how this copy was
// installed, in plain words.
const INSTALL_NAMES = { deb: 'Installed from the .deb package', appimage: 'The AppImage', docker: 'Running in Docker', macapp: 'The Mac app' };
const installedWith = (s) => (s.installed ? 'Installed with the Windows Setup' : INSTALL_NAMES[s.installKind] || 'Installed from the ZIP');

const ACTION_NAMES = {
  backup: 'Backup', update: 'Update', restore: 'Restore', move: 'Move export',
  stop: 'Stop server', restart: 'Restart', 'open-data-folder': 'Open data folder',
  'open-backups-folder': 'Open backups folder', 'open-apps-settings': 'Open Windows Apps',
};
const prettyAction = (a) => ACTION_NAMES[a] || a;

const formatSize = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

// What this copy can do (GET /api/control-panel/status). Settings asks once
// and hands it to both cards. A paired phone gets { code: 'pc-only' }.
export function useAppStatus() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    fetch('/api/control-panel/status')
      .then(r => r.json())
      .then(setStatus)
      .catch(() => setStatus({ error: 'Could not reach server' }));
  }, []);
  return status;
}

// Per action: Linux / macOS ship only the update and backup scripts.
// Older servers send no `actions`; fall back to the all-or-nothing flag.
const canDo = (status, a) => (status?.actions ? !!status.actions[a] : !!status?.controlScriptsAvailable);

// One card's running action and its result panel.
function useActions(status) {
  const [busy, setBusy] = useState(null); // action name currently in flight
  const [lastResult, setLastResult] = useState(null);

  const report = (action, data) => {
    setLastResult({ action, ...data });
    if (data.ok) toast(`${prettyAction(action)} completed.`, 'success');
    else toast(`${prettyAction(action)} failed — ${data.error || 'see details below'}`, 'error');
  };
  const post = async (action, url, body) => {
    setBusy(action);
    setLastResult(null);
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
      report(action, await r.json());
    } catch (e) {
      report(action, { ok: false, error: e.message });
    } finally {
      setBusy(null);
    }
  };
  const runAction = (action) => post(action, `/api/control-panel/${action}`);
  const launchScript = (action) => post(action, '/api/control-panel/launch-script', { action });
  const can = (a) => canDo(status, a);
  const label = (a, idle, working) => (busy === a ? working : (status && !can(a) ? 'Not available here' : idle));
  return { busy, setBusy, lastResult, setLastResult, runAction, launchScript, can, label };
}

const PcOnly = () => (
  <p className="page-subtitle" style={{ margin: 0 }}>Do this on the computer the app runs on: these buttons are not on a phone or tablet.</p>
);

// ---------------------------------------------------------------------------
// Settings -> Data & Backups: backup ZIPs, restore, move, open the folders.
export function BackupFiles({ status }) {
  const act = useActions(status);
  const { busy, can, label, runAction, launchScript } = act;
  return (
    <div id="section-backupzip" className="glass-panel p-6 mb-6" style={{ order: 8 }}>
      <h3 className="section-title">Backup files (ZIP) <HelpButton title="Backup files (ZIP)" doc="backup#backup-zip" size={16} style={{ marginLeft: 6 }} /></h3>
      {status?.code === 'pc-only' ? <PcOnly /> : (
        <>
          <p className="page-subtitle mb-4">Your whole data folder as one ZIP, to keep on a pen drive or carry to a new computer.</p>
          <div className="app-actions-grid">
            <ActionCard icon={<Download size={22} />} title="Backup Data" doc="backup#backup"
              body="Zips your data folder into Documents/FreeGSTBill Backups, with the date and time."
              buttonLabel={label('backup', 'Create Backup', 'Backing up…')}
              disabled={!!busy || !can('backup')} onClick={() => runAction('backup')} />
            <ActionCard icon={<Upload size={22} />} title="Restore Backup" doc="backup#restore"
              body="Pick a backup ZIP. Your data as it is now is saved first, as a safety net."
              buttonLabel={label('restore', 'Choose Backup ZIP', 'Restoring…')}
              disabled={!!busy || !can('restore')} onClick={() => launchScript('restore')} />
            {/* v1.10.84 (maintainer, 7 Nov) - not in the Windows Setup's app: it
                 only said "Not available here" there; Backup + Restore move PCs. */}
            {!status?.installed && (
              <ActionCard icon={<Package size={22} />} title="Move to Another PC" doc="backup#move"
                body="Your data and settings as one ZIP on your Desktop. Copy it to the new PC, install the app, then Restore."
                buttonLabel={label('move', 'Export for Move', 'Exporting…')}
                disabled={!!busy || !can('move')} onClick={() => launchScript('move')} />
            )}
            <ActionCard icon={<FolderOpen size={22} />} title="Open Data Folder" doc="backup#where-data-lives"
              body="The folder where your bills, clients, products and settings are kept."
              buttonLabel="Open" disabled={!!busy} onClick={() => runAction('open-data-folder')} />
            <ActionCard icon={<FolderOpen size={22} />} title="Open Backups Folder" doc="backup#backup-zip"
              body="Documents/FreeGSTBill Backups, where every backup ZIP is kept."
              buttonLabel="Open" disabled={!!busy} onClick={() => runAction('open-backups-folder')} />
          </div>
          <ResultPanel result={act.lastResult} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings -> App & updates: this copy, the update, restart / stop / remove.
export function AppAndUpdates({ status }) {
  const act = useActions(status);
  const pcOnly = status?.code === 'pc-only';
  return (
    <>
      <div id="section-updates" className="glass-panel p-6 mb-6" style={{ order: 11 }}>
        <h3 className="section-title">App &amp; updates <HelpButton title="App & updates" doc="settings#updates" size={16} style={{ marginLeft: 6 }} /></h3>
        {status && !status.error && <p className="page-subtitle mb-4">{installedWith(status)}</p>}
        {status && !status.error && <AppInfo status={status} />}
        <UpdateRow act={act} status={status} />
        {act.lastResult?.action === 'update' && <ResultPanel result={act.lastResult} />}
        {status && !status.error && <TechDetails status={status} />}
      </div>
      <div id="section-app" className="glass-panel p-6 mb-6" style={{ order: 11 }}>
        <h3 className="section-title">Restart, stop or remove the app <HelpButton title="Restart, stop or remove the app" doc="settings#restart" size={16} style={{ marginLeft: 6 }} /></h3>
        {pcOnly ? <PcOnly /> : <AppActions act={act} status={status} />}
      </div>
    </>
  );
}

function AppInfo({ status }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
      <StatCell label="Computer" value={platformName(status.platform, status.arch)} />
      {status.version && <StatCell label="Version" value={`v${status.version}`} />}
      <StatCell label="Data folder size" value={formatSize(status.dataSizeBytes)} />
    </div>
  );
}

// v1.10.86 (maintainer) - Node version, port and folders only matter when
// someone helps you: closed until opened.
function TechDetails({ status }) {
  return (
    <details style={{ marginTop: '1rem' }}>
      <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Technical details (for support)</summary>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '0.75rem' }}>
        <StatCell small label="Node.js" value={status.node} />
        <StatCell small label="Server port" value={status.port} />
        {status.booksFolder && <StatCell small label="Books folder" value={status.booksFolder} />}
        {status.appFolder && <StatCell small label="App folder" value={status.appFolder} />}
      </div>
    </details>
  );
}

// Check for updates + the one Update Now (the progress window, UpdateOverlay
// in App.jsx, shows the steps; the page reloads on the new version).
function UpdateRow({ act, status }) {
  const [info, setInfo] = useState(null);
  const [checking, setChecking] = useState(false);
  const { busy, setBusy, setLastResult, can, label } = act;

  const check = async () => {
    setChecking(true);
    try {
      const data = await (await fetch('/api/check-update?now=1')).json();
      setInfo(data);
      if (data.updateAvailable) toast(`Update available: v${data.latest}`, 'info');
      else if (data.error) toast('Could not check for updates. Check internet connection.', 'warning');
      else toast('You are on the latest version!', 'success');
    } catch {
      toast('Could not check for updates.', 'error');
    }
    setChecking(false);
  };
  // v1.10.84 - Windows Setup copy: the new Setup installs the update.
  // A copy that cannot update itself keeps its message (hint) and download link.
  const updateNow = async () => {
    setBusy('update');
    setLastResult(null);
    const r = await runUpdateNow();
    if (!r.ok) setLastResult({ action: 'update', ...r });
    if (r.hint) toast(`Update failed — ${r.error}`, 'error', 10000);
    setBusy(null);
  };

  const pcOnly = status?.code === 'pc-only';
  return (
    <>
      {status && !status.error && !status.controlScriptsAvailable && !status.installed && (
        <div className="notice notice-warn" style={{ marginBottom: '1rem' }}>
          <AlertCircle size={18} />
          <div>
            <strong>Update and backup scripts not found.</strong> <HelpButton title="Update and backup scripts not found" doc="settings#scripts-missing" size={16} /> They come with the downloaded ZIP, in the
            <code> _system</code> folder next to the app. If you started the app from source code, or copied it
            without those files, download the latest ZIP from GitHub. Your data can still be saved with
            <em> Export Backup…</em> on the Data &amp; Backups tab.
          </div>
        </div>
      )}
      <div className="flex gap-4 items-center" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-secondary" disabled={checking} onClick={check}>
          <RefreshCw size={18} className={checking ? 'spin' : ''} /> {checking ? 'Checking...' : 'Check for Updates'}
        </button>
        {!pcOnly && !info?.updateHint && (
          <button type="button" className="btn btn-primary" disabled={!!busy || !can('update')} onClick={updateNow}>
            <Download size={18} /> {label('update', 'Update Now', 'Updating…')}
          </button>
        )}
        {info && (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Current: v{info.current}{info.latest ? ` | Latest: v${info.latest}` : ''}
          </span>
        )}
      </div>
      <p className="field-hint" style={{ marginBottom: 0 }}>Your data is backed up first and is never touched by an update.</p>
      {info?.updateAvailable && (
        <div className="update-available-box">
          <p><strong>New version v{info.latest} is available!</strong></p>
          {info.updateHint && (
            <p>{info.updateHint}{info.downloadUrl
              ? <> <a href={info.downloadUrl} target="_blank" rel="noopener noreferrer">Download the new Mac app</a></>
              : info.releaseUrl && <> <a href={info.releaseUrl} target="_blank" rel="noopener noreferrer">Open the release page</a></>}</p>
          )}
        </div>
      )}
    </>
  );
}

function AppActions({ act, status }) {
  const [removeOpen, setRemoveOpen] = useState(false);
  const { busy, setBusy, setLastResult, can, label, runAction, launchScript } = act;

  // v1.10.83 - restart the server, then reload this page once it answers again.
  const restartApp = async () => {
    setBusy('restart');
    setLastResult(null);
    try {
      const data = await (await fetch('/api/control-panel/restart', { method: 'POST' })).json();
      if (!data.ok) { setLastResult({ action: 'restart', ...data }); toast(`Restart failed — ${data.error}`, 'error'); setBusy(null); return; }
      await new Promise(res => setTimeout(res, 1500));
      for (let i = 0; i < 40; i++) {
        try { if ((await fetch('/api/profile', { cache: 'no-store' })).ok) { window.location.reload(); return; } } catch { /* still starting */ }
        await new Promise(res => setTimeout(res, 750));
      }
      setLastResult({ action: 'restart', ok: false, error: 'The app did not come back within 30 seconds. Open it again from its icon or launcher.' });
    } catch (e) {
      setLastResult({ action: 'restart', ok: false, error: e.message });
    }
    setBusy(null);
  };

  const openRemove = () => {
    // Not an installed copy (source code, or an old layout): the guide's steps instead.
    if (!status.canRemove) { window.open(docsLink(status.platform === 'darwin' ? 'install-mac#uninstall-mac' : 'install#uninstall'), '_blank', 'noopener'); return; }
    setRemoveOpen(true);
    setTimeout(() => document.getElementById('remove-app')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  return (
    <>
      <div className="app-actions-grid">
        <ActionCard icon={<RotateCcw size={22} />} title="Restart the App" doc="settings#restart"
          body="Something not working or stuck? Restarts the app in a few seconds and reloads this page. Save an open invoice first."
          buttonLabel={busy === 'restart' ? 'Restarting…' : 'Restart'} disabled={!!busy} onClick={restartApp} />
        {/* v1.10.84 (maintainer) - not in the Windows Setup's app: its window's
             tray icon has Quit (window AND server), and a server stopped from
             inside the window is started again by the window's self-repair. */}
        {!status?.installed && (
          <ActionCard icon={<StopCircle size={22} />} title="Stop Server" doc="settings#stop"
            body="Turns the app off. It stops answering until you open it again from its icon or launcher."
            buttonLabel={label('stop', 'Stop Server', 'Stopping…')}
            disabled={!!busy || !can('stop')} onClick={() => launchScript('stop')} variant="danger" />
        )}
        {status?.installed ? (
          // The Setup's app is removed like other Windows programs.
          <ActionCard icon={<Trash2 size={22} />} title="Remove the App" doc="settings#remove"
            body="Remove it like other Windows programs: Settings → Apps → Installed apps → Free GST Billing → Uninstall. It asks before deleting your books; the answer is No unless you choose Yes."
            buttonLabel="Open Windows Apps" disabled={!!busy} onClick={() => runAction('open-apps-settings')} variant="danger" />
        ) : (
          <ActionCard icon={<Trash2 size={22} />} title="Remove the App" doc="settings#remove"
            body="Uninstalls the app and its icons from this computer. You choose whether your data, PDFs and backups go too."
            buttonLabel={status && !status.canRemove ? 'How to remove it' : 'Remove…'}
            disabled={!!busy || !status || !!status.error} onClick={openRemove} variant="danger" />
        )}
      </div>
      {removeOpen && status?.canRemove && <RemovePanel status={status} busy={busy} setBusy={setBusy} onCancel={() => setRemoveOpen(false)} />}
      {act.lastResult?.action !== 'update' && <ResultPanel result={act.lastResult} />}
    </>
  );
}

// v1.10.83 - Remove the app, with the user choosing what goes.
function RemovePanel({ status, busy, setBusy, onCancel }) {
  const [opts, setOpts] = useState({ data: false, pdfs: false, backups: false });
  const [removed, setRemoved] = useState(null);

  const removeApp = async () => {
    const { data, pdfs, backups } = opts;
    if (data && !window.confirm(backups
      ? 'Delete all your invoices, clients, products, settings and every backup? Nothing will be left, and this cannot be undone.'
      : 'Delete your invoices, clients, products and settings from this computer? A last copy is saved in the backups folder first.')) return;
    setBusy('remove');
    try {
      const r = await fetch('/api/control-panel/uninstall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, pdfs, backups, confirm: 'REMOVE' }),
      });
      const result = await r.json();
      if (!result.ok) { toast(`Remove failed — ${result.error}`, 'error'); return; }
      // The app is gone: drop its offline copy too, so this tab cannot show it again.
      try {
        for (const reg of await navigator.serviceWorker?.getRegistrations?.() || []) await reg.unregister();
        for (const key of await caches.keys()) await caches.delete(key);
      } catch { /* nothing cached */ }
      setRemoved({ ...opts, kept: result.kept });
    } catch (e) {
      toast(`Remove failed — ${e.message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  if (removed) {
    return (
      <div id="remove-app" className="glass-panel p-6" style={{ marginTop: '1.5rem' }}>
        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle size={22} color="#22c55e" /> Free GST Billing is being removed
        </h3>
        <p>The app has closed and its files and icons are being deleted. You can close this window.</p>
        {removed.kept && (
          <p>
            Kept: {[!removed.data && 'your invoices, clients and settings', !removed.pdfs && 'your saved invoice PDFs'].filter(Boolean).join(' and ')},
            in <code>{removed.kept}</code>. Installing the app into the same folder again brings them back.
          </p>
        )}
        {removed.data && !removed.backups && (
          <p>A last copy of your data was saved in <code>Documents/FreeGSTBill Backups</code> as <code>before-removal-…</code>.</p>
        )}
      </div>
    );
  }

  return (
    <div id="remove-app" className="glass-panel p-6" style={{ marginTop: '1.5rem', border: '1px solid #dc2626' }}>
      <h3 style={{ margin: '0 0 0.4rem' }}>Remove Free GST Billing from this computer</h3>
      <p style={{ margin: '0 0 0.8rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        Tick what else should be deleted. Anything not ticked stays in <code>{status.appFolder}</code>.
      </p>
      <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
        <label style={{ opacity: 0.7 }}><input type="checkbox" checked disabled /> The app, its icons and shortcuts (always removed)</label>
        {[
          ['data', 'My invoices, clients, products and settings (and the daily backups inside the app)'],
          ['pdfs', 'Saved invoice PDFs (the Saved Invoices and Trash folders)'],
          ['backups', 'All backup files in Documents/FreeGSTBill Backups'],
        ].map(([key, text]) => (
          <label key={key}>
            <input type="checkbox" checked={opts[key]} onChange={e => setOpts(o => ({ ...o, [key]: e.target.checked }))} /> {text}
          </label>
        ))}
      </div>
      {opts.data && !opts.backups && (
        <p style={{ fontSize: '0.82rem', margin: '0.8rem 0 0' }}>A last copy of your data is saved in <code>Documents/FreeGSTBill Backups</code> first.</p>
      )}
      {opts.data && opts.backups && (
        <p style={{ fontSize: '0.82rem', margin: '0.8rem 0 0', color: '#ef4444' }}><b>Nothing will be left. This cannot be undone.</b> Export a backup first if you may want your books again.</p>
      )}
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '1rem' }}>
        <button className="btn btn-secondary" disabled={!!busy} onClick={() => setOpts({ data: true, pdfs: true, backups: true })}>Select everything</button>
        <button className="btn" style={{ background: '#dc2626', color: '#fff' }} disabled={!!busy} onClick={removeApp}>
          {busy === 'remove' ? 'Removing…' : 'Remove the app'}
        </button>
        <button className="btn btn-secondary" disabled={!!busy} onClick={onCancel}>Cancel</button>
      </div>
      <p style={{ fontSize: '0.78rem', margin: '0.8rem 0 0', color: 'var(--text-muted)' }}>
        Copies in a second backup folder you chose in Settings are not touched. Delete them by hand if you want.
      </p>
    </div>
  );
}

// What the last action did: OK / Failed, what the script printed, the reason.
function ResultPanel({ result }) {
  if (!result) return null;
  const pre = { fontSize: '0.75rem', background: 'var(--bg-secondary)', padding: '0.6rem', borderRadius: 6, overflow: 'auto', maxHeight: 200, marginTop: '0.4rem' };
  return (
    <div className="surface-card" style={{ marginTop: '1rem' }}>
      <h4 style={{ margin: '0 0 0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {result.ok ? <CheckCircle size={18} color="#22c55e" /> : <AlertCircle size={18} color="#ef4444" />}
        {prettyAction(result.action)} — {result.ok ? 'OK' : 'Failed'}
        <HelpButton title="The result panel" doc="settings#result" size={16} />
      </h4>
      {result.stdout && (
        <details open>
          <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Output</summary>
          <pre style={pre}>{result.stdout}</pre>
        </details>
      )}
      {result.stderr && (
        <details>
          <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Errors</summary>
          <pre style={{ ...pre, color: '#f87171' }}>{result.stderr}</pre>
        </details>
      )}
      {result.error && <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: '#f87171' }}>{result.error}</p>}
      {result.downloadUrl && (
        <p style={{ margin: '0.6rem 0 0' }}>
          <a href={result.downloadUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ textDecoration: 'none', display: 'inline-flex' }}>
            <Download size={16} /> Download the new Mac app
          </a>
        </p>
      )}
    </div>
  );
}

function StatCell({ label, value, small = false }) {
  return (
    <div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={small ? { fontSize: '0.8rem', marginTop: '0.2rem', wordBreak: 'break-all', fontFamily: 'ui-monospace, Consolas, monospace' } : { fontSize: '0.95rem', fontWeight: 600, marginTop: '0.2rem', wordBreak: 'break-all' }}>{value}</div>
    </div>
  );
}

function ActionCard({ icon, title, body, buttonLabel, disabled, onClick, variant, doc }) {
  const danger = variant === 'danger' ? { background: '#dc2626', color: '#fff', borderColor: '#dc2626' } : {};
  return (
    <div className="surface-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--primary)' }}>
        {icon}
        <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{title} <HelpButton title={title} doc={doc} size={16} /></h4>
      </div>
      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', flex: 1 }}>{body}</p>
      <button className="btn btn-secondary" disabled={disabled} onClick={onClick}
        style={{ ...danger, alignSelf: 'flex-start', padding: '0.5rem 1rem', fontSize: '0.85rem', opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
        {buttonLabel}
      </button>
    </div>
  );
}
