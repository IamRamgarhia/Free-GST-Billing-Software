import { useState, useEffect } from 'react';
import { Download, RefreshCw, Package, FolderOpen, HardDrive, StopCircle, Upload, AlertCircle, CheckCircle, Trash2, RotateCcw } from 'lucide-react';
import PageHeader from './PageHeader';
import { toast } from './Toast';
import HelpButton from './HelpButton';
import { docsLink } from '../utils';
import { runUpdateNow } from '../store';

// v1.10.44 — In-app Control Panel.
//
// Companion to the HTA / .command / .sh launcher: post-install
// actions (Update / Backup / Restore / Move / Stop / Open folders)
// live here so the user never has to open the extract folder or
// remember any batch-file names. Buttons hit /api/control-panel/*
// endpoints on the server, which shell out to platform-appropriate
// scripts under `_system-scripts/`.
//
// Fallback behaviour: if the app was installed WITHOUT the launcher
// (e.g. via `git clone && npm start` in dev mode), the server
// reports `controlScriptsAvailable: false` and the buttons are
// visibly disabled with an inline explanation. Nothing crashes.

export default function ControlPanel() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(null); // action name currently in flight
  const [lastResult, setLastResult] = useState(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeOpts, setRemoveOpts] = useState({ data: false, pdfs: false, backups: false });
  const [removed, setRemoved] = useState(null);

  useEffect(() => {
    fetch('/api/control-panel/status')
      .then(r => r.json())
      .then(setStatus)
      .catch(() => setStatus({ error: 'Could not reach server' }));
  }, []);

  const runAction = async (action, method = 'POST') => {
    setBusy(action);
    setLastResult(null);
    try {
      const r = await fetch(`/api/control-panel/${action}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await r.json();
      setLastResult({ action, ...data });
      if (data.ok) toast(`${prettyAction(action)} completed.`, 'success');
      else toast(`${prettyAction(action)} failed — ${data.error || 'see details below'}`, 'error');
    } catch (e) {
      setLastResult({ action, ok: false, error: e.message });
      toast(`${prettyAction(action)} failed — ${e.message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const launchScript = async (action) => {
    setBusy(action);
    setLastResult(null);
    try {
      const r = await fetch('/api/control-panel/launch-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await r.json();
      setLastResult({ action, ...data });
      if (data.ok) toast(`${prettyAction(action)} completed.`, 'success');
      else toast(`${prettyAction(action)} failed — ${data.error || 'see details below'}`, 'error');
    } catch (e) {
      setLastResult({ action, ok: false, error: e.message });
    } finally {
      setBusy(null);
    }
  };

  // v1.10.84 - installed with the Windows Setup: the new Setup installs the
  // update and the page reloads by itself (runUpdateNow).
  const updateInstalled = async () => {
    setBusy('update');
    setLastResult(null);
    toast('Downloading the new version… the app restarts by itself in about a minute.', 'info', 10000);
    const r = await runUpdateNow();
    if (!r.ok) { setLastResult({ action: 'update', ...r }); toast(`Update failed — ${r.error}`, 'error', 10000); }
    setBusy(null);
  };

  // v1.10.83 - restart the server, then reload this page once it answers again.
  const restartApp = async () => {
    setBusy('restart');
    setLastResult(null);
    try {
      const r = await fetch('/api/control-panel/restart', { method: 'POST' });
      const data = await r.json();
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

  const removeApp = async () => {
    const { data, pdfs, backups } = removeOpts;
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
      setRemoved({ ...removeOpts, kept: result.kept });
    } catch (e) {
      toast(`Remove failed — ${e.message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  if (removed) {
    return (
      <div className="dashboard-container">
        <div className="glass-panel p-6" style={{ maxWidth: 560, margin: '3rem auto' }}>
          <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={22} color="#22c55e" /> Free GST Billing is being removed
          </h2>
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
      </div>
    );
  }

  const prettyAction = (a) => ({
    backup: 'Backup', update: 'Update', restore: 'Restore', move: 'Move export',
    stop: 'Stop server', restart: 'Restart', 'open-data-folder': 'Open data folder',
    'open-backups-folder': 'Open backups folder', 'open-apps-settings': 'Open Windows Apps',
  })[a] || a;

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const scriptsUnavailable = status && !status.controlScriptsAvailable;
  // Per action: Linux / macOS ship only the update and backup scripts.
  // Older servers send no `actions`; fall back to the all-or-nothing flag.
  const can = (a) => (status?.actions ? !!status.actions[a] : !scriptsUnavailable);
  const label = (a, idle, working) => (busy === a ? working : (status && !can(a) ? 'Not available here' : idle));

  return (
    <div className="dashboard-container">
      <PageHeader
        icon={<HardDrive size={22} />}
        title={<>Control Panel <HelpButton title="Control Panel — how to use" doc="control-panel" size={16} /></>}
        subtitle="Manage the app — update, backup, restore, move to another PC — without touching batch files."
        meta={status?.launcherType ? `${status.launcherType.toUpperCase()} launcher` : null}
      >
      </PageHeader>

      {scriptsUnavailable && (
        <div className="notice notice-warn" style={{ marginBottom: '1rem' }}>
          <AlertCircle size={18} />
          <div>
            <strong>Update and backup scripts not found.</strong> <HelpButton title="Update and backup scripts not found" doc="control-panel#scripts-missing" size={16} /> They come with the downloaded ZIP, in the
            <code> _system</code> folder next to the app. If you started the app from source code, or copied it
            without those files, download the latest ZIP from GitHub. Your data can still be saved from
            <em> Settings → Data Management → Export Backup</em>.
          </div>
        </div>
      )}

      {/* Install info card */}
      {status && !status.error && (
        <div className="glass-panel p-6 mb-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <StatCell label="Platform"       value={status.platform} />
          <StatCell label="Node version"   value={status.node} />
          <StatCell label="Server port"    value={status.port} />
          <StatCell label="Data folder size" value={formatSize(status.dataSizeBytes)} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        <ActionCard
          icon={<RefreshCw size={22} />}
          title="Update Software" doc="control-panel#update"
          body="Pull the latest release from GitHub. Your data folder is snapshotted first and never touched."
          buttonLabel={label('update', 'Update Now', 'Updating…')}
          disabled={!!busy || !can('update')}
          onClick={() => (status?.installed ? updateInstalled() : launchScript('update'))}
          variant="primary"
        />
        <ActionCard
          icon={<Download size={22} />}
          title="Backup Data" doc="control-panel#backup"
          body="Zips your data folder into ~/Documents/FreeGSTBill Backups/ with a timestamp."
          buttonLabel={label('backup', 'Create Backup', 'Backing up…')}
          disabled={!!busy || !can('backup')}
          onClick={() => runAction('backup')}
        />
        <ActionCard
          icon={<Upload size={22} />}
          title="Restore Backup" doc="control-panel#restore"
          body="Pick a previous backup ZIP. Current data is snapshotted first as a safety net before restore."
          buttonLabel={label('restore', 'Choose Backup ZIP', 'Restoring…')}
          disabled={!!busy || !can('restore')}
          onClick={() => launchScript('restore')}
        />
        {/* v1.10.84 (maintainer, 7 Nov) - not in the Windows Setup's app: it
             only said "Not available here" there; Backup + Restore move PCs. */}
        {!status?.installed && (
          <ActionCard
            icon={<Package size={22} />}
            title="Move to Another PC" doc="control-panel#move"
            body="Exports data + settings as one ZIP on your Desktop. Copy it to the new PC, install the app, then Restore."
            buttonLabel={label('move', 'Export for Move', 'Exporting…')}
            disabled={!!busy || !can('move')}
            onClick={() => launchScript('move')}
          />
        )}
        <ActionCard
          icon={<FolderOpen size={22} />}
          title="Open Data Folder"
          body="Opens the folder where your bills, clients, products, and settings live as JSON files."
          buttonLabel="Open"
          disabled={!!busy}
          onClick={() => runAction('open-data-folder')}
        />
        <ActionCard
          icon={<FolderOpen size={22} />}
          title="Open Backups Folder"
          body="Opens ~/Documents/FreeGSTBill Backups/ where every automatic and manual backup ZIP is stored."
          buttonLabel="Open"
          disabled={!!busy}
          onClick={() => runAction('open-backups-folder')}
        />
        <ActionCard
          icon={<RotateCcw size={22} />}
          title="Restart the App" doc="control-panel#restart"
          body="Something not working or stuck? Restarts the app in a few seconds and reloads this page. Save an open invoice first."
          buttonLabel={busy === 'restart' ? 'Restarting…' : 'Restart'}
          disabled={!!busy}
          onClick={restartApp}
        />
        {/* v1.10.84 (maintainer) - not in the Windows Setup's app: its window's
             tray icon has Quit (window AND server), and a server stopped from
             inside the window is started again by the window's self-repair. */}
        {!status?.installed && (
          <ActionCard
            icon={<StopCircle size={22} />}
            title="Stop Server" doc="control-panel#stop"
            body="Shuts down the local Node server. The app will stop responding until you re-open it from the launcher / shortcut."
            buttonLabel={label('stop', 'Stop Server', 'Stopping…')}
            disabled={!!busy || !can('stop')}
            onClick={() => launchScript('stop')}
            variant="danger"
          />
        )}
        {status?.installed ? (
          // The Setup's app is removed like other Windows programs.
          <ActionCard
            icon={<Trash2 size={22} />}
            title="Remove the App" doc="control-panel#remove"
            body="Remove it like other Windows programs: Settings → Apps → Installed apps → Free GST Billing → Uninstall. It asks before deleting your books; the answer is No unless you choose Yes."
            buttonLabel="Open Windows Apps"
            disabled={!!busy}
            onClick={() => runAction('open-apps-settings')}
            variant="danger"
          />
        ) : (
        <ActionCard
          icon={<Trash2 size={22} />}
          title="Remove the App" doc="control-panel#remove"
          body="Uninstalls the app and its icons from this computer. You choose whether your data, PDFs and backups go too."
          buttonLabel={status && !status.canRemove ? 'How to remove it' : 'Remove…'}
          disabled={!!busy || !status}
          onClick={() => {
            // Not an installed copy (source code, or an old layout): the guide's steps instead.
            if (!status.canRemove) { window.open(docsLink(status.platform === 'darwin' ? 'install-mac#uninstall-mac' : 'install#uninstall'), '_blank', 'noopener'); return; }
            setRemoveOpen(true); setTimeout(() => document.getElementById('remove-app')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
          }}
          variant="danger"
        />
        )}
      </div>

      {removeOpen && status?.canRemove && (
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
                <input type="checkbox" checked={removeOpts[key]}
                  onChange={e => setRemoveOpts(o => ({ ...o, [key]: e.target.checked }))} /> {text}
              </label>
            ))}
          </div>
          {removeOpts.data && !removeOpts.backups && (
            <p style={{ fontSize: '0.82rem', margin: '0.8rem 0 0' }}>A last copy of your data is saved in <code>Documents/FreeGSTBill Backups</code> first.</p>
          )}
          {removeOpts.data && removeOpts.backups && (
            <p style={{ fontSize: '0.82rem', margin: '0.8rem 0 0', color: '#ef4444' }}><b>Nothing will be left. This cannot be undone.</b> Export a backup first if you may want your books again.</p>
          )}
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            <button className="btn btn-secondary" disabled={!!busy}
              onClick={() => setRemoveOpts({ data: true, pdfs: true, backups: true })}>Select everything</button>
            <button className="btn" style={{ background: '#dc2626', color: '#fff' }} disabled={!!busy} onClick={removeApp}>
              {busy === 'remove' ? 'Removing…' : 'Remove the app'}
            </button>
            <button className="btn btn-secondary" disabled={!!busy} onClick={() => setRemoveOpen(false)}>Cancel</button>
          </div>
          <p style={{ fontSize: '0.78rem', margin: '0.8rem 0 0', color: 'var(--text-muted)' }}>
            Copies in a second backup folder you chose in Settings are not touched. Delete them by hand if you want.
          </p>
        </div>
      )}

      {/* Last action result */}
      {lastResult && (
        <div className="glass-panel p-6" style={{ marginTop: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {lastResult.ok
              ? <CheckCircle size={18} color="#22c55e" />
              : <AlertCircle size={18} color="#ef4444" />}
            {prettyAction(lastResult.action)} — {lastResult.ok ? 'OK' : 'Failed'}
            <HelpButton title="The result panel" doc="control-panel#result" size={16} />
          </h3>
          {lastResult.stdout && (
            <details open>
              <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Output</summary>
              <pre style={{ fontSize: '0.75rem', background: 'var(--bg-secondary)', padding: '0.6rem', borderRadius: 6, overflow: 'auto', maxHeight: 200, marginTop: '0.4rem' }}>
                {lastResult.stdout}
              </pre>
            </details>
          )}
          {lastResult.stderr && (
            <details>
              <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Errors</summary>
              <pre style={{ fontSize: '0.75rem', background: 'var(--bg-secondary)', padding: '0.6rem', borderRadius: 6, overflow: 'auto', maxHeight: 200, marginTop: '0.4rem', color: '#f87171' }}>
                {lastResult.stderr}
              </pre>
            </details>
          )}
          {lastResult.error && (
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: '#f87171' }}>
              {lastResult.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '0.2rem', wordBreak: 'break-all' }}>{value}</div>
    </div>
  );
}

function ActionCard({ icon, title, body, buttonLabel, disabled, onClick, variant, doc = 'control-panel#actions' }) {
  const bg = variant === 'primary' ? 'var(--primary)' : variant === 'danger' ? '#dc2626' : 'var(--bg-secondary)';
  const color = (variant === 'primary' || variant === 'danger') ? '#fff' : 'var(--text)';
  return (
    <div className="glass-panel p-6" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--primary)' }}>
        {icon}
        <h3 style={{ margin: 0, fontSize: '1rem' }}>{title} <HelpButton title={title} doc={doc} size={16} /></h3>
      </div>
      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', flex: 1 }}>{body}</p>
      <button
        className="btn"
        style={{ background: bg, color, alignSelf: 'flex-start', padding: '0.5rem 1rem', fontSize: '0.85rem', opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
        disabled={disabled}
        onClick={onClick}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
