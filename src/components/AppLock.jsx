// v1.10.77 (#84) - optional PIN lock: a 6 or 8 digit PIN asked when the app
// opens (and on "Lock now"). A screen lock for a shared PC, not encryption;
// the PIN is checked by the server, which stores only a hash (server.js,
// /api/lock). Forgotten PIN: a file named RESET-PIN in the app folder.
import { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import HelpButton from './HelpButton';
import { getLockStatus, verifyPin, openResetFolder } from '../store';
import { UNLOCKED_KEY, LOCK_EVENT } from '../utils/appLock';
import { TROUBLESHOOTING_URL } from '../utils/errorReport';

// v1.10.86 (maintainer: "give proper a to z steps, folder name etc") - the
// forgotten-PIN steps, with the exact folder on this PC, a button to open it
// and a check that unlocks as soon as the file is there. On a paired phone the
// folder is not sent (the file must be made on the PC).
function ForgotPin({ folder, os, onUnlock }) {
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);
  const mac = os === 'darwin';
  const linux = os === 'linux';
  const fileCmd = folder ? `touch "${folder}/RESET-PIN"` : '';
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked: the text is on screen */ }
  };
  const openFolder = async () => {
    setNote('');
    try { await openResetFolder(); } catch { setNote('The folder could not be opened. Open it yourself: the path is above.'); }
  };
  const check = async () => {
    setNote('');
    try {
      const s = await getLockStatus();
      if (!s.enabled) onUnlock();
      else setNote('The file is not there yet. Check that it is in the folder above and named RESET-PIN, then click again.');
    } catch { setNote('Could not check. Is the app still running?'); }
  };
  if (!folder) {
    return (
      <div className="app-lock-help">
        <p>The PIN can be removed only on the computer where Free GST Billing is installed: open the app there and click <strong>Forgot PIN?</strong> for the steps. Your invoices are not touched.</p>
        <p><a href={`${TROUBLESHOOTING_URL}#pin-forgotten`} target="_blank" rel="noopener noreferrer">Read the full steps</a></p>
      </div>
    );
  }
  return (
    <div className="app-lock-help">
      <p>Remove the PIN on this computer in four steps. Your invoices are not touched.</p>
      <ol>
        <li>
          Open this folder:
          <code className="app-lock-path">{folder}</code>
          <span className="app-lock-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={openFolder}>Open the folder</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy(folder)}>{copied ? 'Copied' : 'Copy the path'}</button>
          </span>
        </li>
        {mac || linux ? (
          <li>
            Make an empty file named <strong>RESET-PIN</strong> there. The easy way: open <strong>Terminal</strong>{mac ? ' (Cmd + Space, type Terminal, press Return)' : ''}, paste this line and press {mac ? 'Return' : 'Enter'}:
            <code className="app-lock-path">{fileCmd}</code>
            <span className="app-lock-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy(fileCmd)}>Copy the line</button>
            </span>
          </li>
        ) : (
          <li>In that folder, right-click an empty space → <strong>New</strong> → <strong>Text Document</strong>.</li>
        )}
        {!mac && !linux && (
          <li>Name it <strong>RESET-PIN</strong> and press Enter. If Windows asks about changing the file name extension, click <strong>Yes</strong>. (<strong>RESET-PIN.txt</strong> works too.)</li>
        )}
        <li>
          Come back here and click:
          <span className="app-lock-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={check}>I made the file: open the app</button>
          </span>
        </li>
      </ol>
      {note && <p className="app-lock-error" role="alert">{note}</p>}
      <p>The PIN is removed and the file deleted by itself. Phone access is switched off until you set a new PIN in Settings. <a href={`${TROUBLESHOOTING_URL}#pin-forgotten`} target="_blank" rel="noopener noreferrer">Read the full steps</a></p>
    </div>
  );
}

function LockScreen({ length, onUnlock, resetFolder, os }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const input = useRef(null);

  const submit = async (value) => {
    if (busy) return;
    setBusy(true);
    try {
      await verifyPin(value);
      onUnlock();
    } catch (err) {
      setPin('');
      if (err.status === 429) setError(`Too many wrong tries. Wait ${err.body?.wait || 30} seconds and try again.`);
      else if (err.status === 401) setError('Wrong PIN. Try again.');
      else setError('Could not check the PIN. Is the app still running?');
      setTimeout(() => input.current?.focus(), 0);
    } finally {
      setBusy(false);
    }
  };

  const onChange = (e) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, length);
    setPin(v);
    setError('');
    if (v.length === length) submit(v);
  };

  return (
    <div className="app-lock-screen">
      <form className="glass-panel app-lock-card" onSubmit={(e) => { e.preventDefault(); if (pin.length === length) submit(pin); }}>
        <Lock size={32} aria-hidden="true" />
        <h1>Enter your PIN <HelpButton title="PIN lock and a forgotten PIN" doc="troubleshooting#pin-forgotten" size={16} /></h1>
        <p className="text-muted">Free GST Billing is locked.</p>
        <input ref={input} className="form-input app-lock-input" type="password" inputMode="numeric" autoComplete="off" autoFocus
          aria-label={`${length} digit PIN`} placeholder={'•'.repeat(length)} value={pin} onChange={onChange} disabled={busy} maxLength={length} />
        <p className="app-lock-error" role="alert">{error}</p>
        <button type="button" className="app-lock-link" onClick={() => setShowHelp((v) => !v)}>Forgot PIN?</button>
        {showHelp && <ForgotPin folder={resetFolder} os={os} onUnlock={onUnlock} />}
      </form>
    </div>
  );
}

// Shows the app only after the PIN, when a PIN is set. Asked once per
// browser tab: a reload in the same tab does not ask again.
export default function AppLockGate({ children }) {
  const [lock, setLock] = useState({ checked: false, enabled: false, length: 6, resetFolder: null, os: '' });
  const [unlocked, setUnlocked] = useState(() => {
    try { return sessionStorage.getItem(UNLOCKED_KEY) === '1'; } catch { return false; }
  });
  // The app has been on screen once (it stays mounted from then on).
  const [shown, setShown] = useState(unlocked);

  useEffect(() => {
    // If the server cannot be reached the app shows its own error screens; the
    // lock does not block that.
    getLockStatus()
      .then((s) => { setLock({ checked: true, enabled: !!s.enabled, length: s.length === 8 ? 8 : 6, resetFolder: s.resetFolder || null, os: s.os || '' }); if (!s.enabled) setShown(true); })
      .catch(() => { setLock((l) => ({ ...l, checked: true })); setShown(true); });
    const relock = () => {
      setUnlocked(false);
      getLockStatus().then((s) => setLock({ checked: true, enabled: !!s.enabled, length: s.length === 8 ? 8 : 6, resetFolder: s.resetFolder || null, os: s.os || '' })).catch(() => {});
    };
    window.addEventListener(LOCK_EVENT, relock);
    return () => window.removeEventListener(LOCK_EVENT, relock);
  }, []);

  if (!lock.checked) return null;
  const locked = lock.enabled && !unlocked;
  const onUnlock = () => {
    try { sessionStorage.setItem(UNLOCKED_KEY, '1'); } catch { /* storage blocked */ }
    setUnlocked(true);
    setShown(true);
  };
  // Locked before the app was ever shown: the app is not rendered at all.
  if (locked && !shown) return <LockScreen length={lock.length} onUnlock={onUnlock} resetFolder={lock.resetFolder} os={lock.os} />;
  // Locked again (Lock now): the app stays mounted but hidden, so anything
  // typed and not yet saved is still there after the PIN. display: contents
  // keeps the wrapper out of the layout.
  return (
    <>
      <div style={{ display: locked ? 'none' : 'contents' }} aria-hidden={locked || undefined}>{children}</div>
      {locked && <LockScreen length={lock.length} onUnlock={onUnlock} resetFolder={lock.resetFolder} os={lock.os} />}
    </>
  );
}
