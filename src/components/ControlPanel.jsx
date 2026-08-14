import { useState, useEffect } from 'react';
import { Download, RefreshCw, Package, FolderOpen, HardDrive, StopCircle, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import PageHeader from './PageHeader';
import { toast } from './Toast';

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

  const prettyAction = (a) => ({
    backup: 'Backup', update: 'Update', restore: 'Restore', move: 'Move export',
    stop: 'Stop server', 'open-data-folder': 'Open data folder',
    'open-backups-folder': 'Open backups folder',
  })[a] || a;

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const scriptsUnavailable = status && !status.controlScriptsAvailable;

  return (
    <div className="dashboard-container">
      <PageHeader
        icon={<HardDrive size={22} />}
        title="Control Panel"
        subtitle="Manage the app — update, backup, restore, move to another PC — without touching batch files."
        meta={status?.launcherType ? `${status.launcherType.toUpperCase()} launcher` : null}
      />

      {scriptsUnavailable && (
        <div className="notice notice-warning" style={{ marginBottom: '1rem' }}>
          <AlertCircle size={18} />
          <div>
            <strong>Launcher scripts not detected.</strong> This app appears to be running from a dev clone (npm start)
            rather than an installer ZIP. Update / Backup / Restore / Move buttons need the launcher scripts under
            <code> _system-scripts/</code>. Download the latest release from GitHub to unlock them, or use
            <em> Settings → Backup & Restore</em> for a data-only backup.
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
          title="Update Software"
          body="Pull the latest release from GitHub. Your data folder is snapshotted first and never touched."
          buttonLabel={busy === 'update' ? 'Updating…' : 'Update Now'}
          disabled={!!busy || scriptsUnavailable}
          onClick={() => launchScript('update')}
          variant="primary"
        />
        <ActionCard
          icon={<Download size={22} />}
          title="Backup Data"
          body="Zips your data folder into ~/Documents/FreeGSTBill Backups/ with a timestamp."
          buttonLabel={busy === 'backup' ? 'Backing up…' : 'Create Backup'}
          disabled={!!busy || scriptsUnavailable}
          onClick={() => runAction('backup')}
        />
        <ActionCard
          icon={<Upload size={22} />}
          title="Restore Backup"
          body="Pick a previous backup ZIP. Current data is snapshotted first as a safety net before restore."
          buttonLabel={busy === 'restore' ? 'Restoring…' : 'Choose Backup ZIP'}
          disabled={!!busy || scriptsUnavailable}
          onClick={() => launchScript('restore')}
        />
        <ActionCard
          icon={<Package size={22} />}
          title="Move to Another PC"
          body="Exports data + settings as one ZIP on your Desktop. Copy it to the new PC, install the app, then Restore."
          buttonLabel={busy === 'move' ? 'Exporting…' : 'Export for Move'}
          disabled={!!busy || scriptsUnavailable}
          onClick={() => launchScript('move')}
        />
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
          icon={<StopCircle size={22} />}
          title="Stop Server"
          body="Shuts down the local Node server. The app will stop responding until you re-open it from the launcher / shortcut."
          buttonLabel={busy === 'stop' ? 'Stopping…' : 'Stop Server'}
          disabled={!!busy || scriptsUnavailable}
          onClick={() => launchScript('stop')}
          variant="danger"
        />
      </div>

      {/* Last action result */}
      {lastResult && (
        <div className="glass-panel p-6" style={{ marginTop: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {lastResult.ok
              ? <CheckCircle size={18} color="#22c55e" />
              : <AlertCircle size={18} color="#ef4444" />}
            {prettyAction(lastResult.action)} — {lastResult.ok ? 'OK' : 'Failed'}
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

function ActionCard({ icon, title, body, buttonLabel, disabled, onClick, variant }) {
  const bg = variant === 'primary' ? 'var(--primary)' : variant === 'danger' ? '#dc2626' : 'var(--bg-secondary)';
  const color = (variant === 'primary' || variant === 'danger') ? '#fff' : 'var(--text)';
  return (
    <div className="glass-panel p-6" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--primary)' }}>
        {icon}
        <h3 style={{ margin: 0, fontSize: '1rem' }}>{title}</h3>
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
