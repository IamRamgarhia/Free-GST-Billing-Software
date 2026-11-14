// v1.10.85 - Settings -> Privacy & Security -> Use on phone or tablet. The
// server does the checking (server.js PHONE / TABLET ACCESS, src/utils/
// phoneAccess.js); this card switches it, shows the pairing QR code and lists
// the paired devices. Every sentence here matches docs-site security.mjs
// (page "phone"); change them together.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Smartphone, Trash2, QrCode } from 'lucide-react';
import HelpButton from './HelpButton';
import { toast } from './Toast';
import { getPhoneAccess, setPhoneAccess, newPairingCode, removePairedDevice } from '../store';
import { LOCK_CHANGED_EVENT } from '../utils/appLock';

const when = (ts) => (ts ? new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-');
const muted = { fontSize: '0.85rem', color: 'var(--text-muted)' };

// "Set a PIN" opens the App lock card just above, ready to type.
const openPinCard = () => {
  const card = document.getElementById('section-lock');
  card?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  card?.querySelector('button.btn')?.click();
};

// v1.10.86 - also shown by the phone button at the top (PhonePairButton.jsx).
// The QR code opens the guide page (plain HTTP, it explains the browser's
// warning, then goes on to HTTPS); the HTTPS address is shown as the fallback.
// Docker has no guide page: there the QR code is the HTTPS address.
const mono = { fontFamily: 'ui-monospace, Consolas, monospace' };
const addressOf = (u) => String(u || '').replace(/\/?(pair)?#.*$/, '');
// v1.10.86 (review) - while the code is on screen, the PC asks every 3 seconds
// who is paired, so a pairing shows at once ("Paired: ..."), also one the
// owner did not expect. devices: the paired devices when the code was shown.
const POLL_MS = 3000;
function usePairedWatch(pair, devices, onPaired) {
  const [list, setList] = useState(devices || []);
  const known = useRef(new Set((devices || []).map((d) => d.id)));
  const onPairedRef = useRef(onPaired);
  onPairedRef.current = onPaired;
  useEffect(() => {
    const until = pair.expiresAt + 60000;
    const timer = setInterval(() => {
      if (Date.now() > until) { clearInterval(timer); return; }
      getPhoneAccess().then((s) => {
        const fresh = s.devices.filter((d) => !known.current.has(d.id));
        if (!fresh.length) return;
        fresh.forEach((d) => { known.current.add(d.id); toast(`Paired: ${d.name}`, 'success', 8000); });
        setList(s.devices);
        onPairedRef.current?.(s);
      }).catch(() => { /* asked again in 3 seconds */ });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [pair.expiresAt]);
  return list;
}

export function PairPanel({ pair, onNew, devices, onPaired, showDevices = false }) {
  const paired = usePairedWatch(pair, devices, onPaired);
  const [i, setI] = useState(0);
  const httpsUrl = pair.urls[i] || '';
  const guideUrl = pair.guideUrls?.[i] || '';
  const url = guideUrl || httpsUrl;
  const [qr, setQr] = useState('');
  useEffect(() => {
    let live = true;
    if (!url) return undefined;
    import('qrcode').then(({ default: QRCode }) => QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 1, width: 220 }))
      .then((d) => { if (live) setQr(d); }).catch(() => setQr(''));
    return () => { live = false; };
  }, [url]);
  if (!url) return <p className="notice notice-warn">This PC has no Wi-Fi or network address right now. Connect it to your Wi-Fi, then click Show a new QR code.</p>;
  const address = addressOf(url);
  return (
    <div className="phone-pair" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div style={{ background: '#fff', padding: 8, borderRadius: 8, lineHeight: 0 }}>
        {qr ? <img src={qr} width={220} height={220} alt={`QR code for ${address}`} /> : <div style={{ width: 220, height: 220 }} />}
      </div>
      <div style={{ flex: '1 1 260px', minWidth: 0, fontSize: '0.88rem' }}>
        <ol style={{ margin: 0, paddingLeft: '1.2rem', display: 'grid', gap: '0.4rem' }}>
          <li>Connect the phone or tablet to <b>the same Wi-Fi</b> as this PC, open its camera and scan the code. Or type this address in its browser: <code className="phone-address" style={{ overflowWrap: 'anywhere' }}>{address}</code></li>
          <li>{guideUrl ? <>The phone shows a page that says where to tap. Then its browser warns <i>Your connection is not private</i>.</> : <>The browser warns <i>Your connection is not private</i>.</>} That is expected: the app uses this PC&apos;s own certificate, which the browser does not know. Tap <b>Advanced</b> and <b>Proceed</b> (Chrome), or <b>Show Details</b> and <b>visit this website</b> (Safari). The phone&apos;s page shows a security code: it must be <b className="phone-fingerprint" style={mono}>{pair.shortFingerprint}</b>. This is asked once per phone.</li>
          <li>Type the app&apos;s PIN on the phone. The app opens. Pairing code, if it asks: <b style={mono}>{pair.code.slice(0, 4)} {pair.code.slice(4)}</b></li>
        </ol>
        {guideUrl && httpsUrl && <p style={{ ...muted, margin: '0.5rem 0 0' }}>The page does not open? Type this instead: <code className="phone-https-address" style={{ overflowWrap: 'anywhere' }}>{addressOf(httpsUrl)}</code></p>}
        {pair.urls.length > 1 && (
          <label style={{ display: 'block', marginTop: '0.5rem', ...muted }}>Address for the code:{' '}
            <select className="form-input" style={{ width: 'auto', display: 'inline-block' }} value={i} onChange={(e) => setI(Number(e.target.value))}>
              {pair.urls.map((u, n) => <option key={u} value={n}>{addressOf(u).replace(/^https:\/\/|:\d+$/g, '')}</option>)}
            </select>
          </label>
        )}
        <p style={{ ...muted, margin: '0.5rem 0' }}>This code works once, until {new Date(pair.expiresAt).toLocaleTimeString('en-IN', { timeStyle: 'short' })} (10 minutes). <button type="button" className="btn btn-secondary btn-sm" onClick={onNew}>Show a new QR code</button></p>
        {showDevices && paired.length > 0 && <p className="phone-paired-now" style={{ margin: '0.5rem 0', fontSize: '0.85rem' }}><b>Paired devices:</b> {paired.map((d) => d.name).join(', ')}</p>}
        <p style={{ ...muted, margin: '0.5rem 0 0' }}>After pairing, check that <b>Paired devices</b> shows only your own devices. If the phone said the code was not valid any more after you typed the PIN, remove any device you do not know and change the PIN.</p>
      </div>
    </div>
  );
}

export default function PhoneAccessSettings() {
  const [status, setStatus] = useState(null);
  const [refused, setRefused] = useState(false);
  const [pair, setPair] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => getPhoneAccess().then((s) => { setStatus(s); setRefused(false); })
    .catch((err) => { if (err.status === 403) setRefused(true); }), []);
  useEffect(() => {
    load();
    window.addEventListener(LOCK_CHANGED_EVENT, load);
    return () => window.removeEventListener(LOCK_CHANGED_EVENT, load);
  }, [load]);

  const toggle = async (enabled) => {
    setBusy(true);
    try {
      await setPhoneAccess(enabled);
      setPair(null);
      // The network listener opens a moment after the answer.
      setTimeout(load, 800);
      await load();
      toast(enabled ? 'Phone and tablet access is on' : 'Phone and tablet access is off. Nothing on the network can reach the app now.', 'success');
    } catch (err) {
      toast(err.body?.code === 'pin-needed' ? 'Set a PIN first (App lock, above)' : 'Could not change it', 'error');
    } finally { setBusy(false); }
  };
  const showCode = async () => {
    try { setPair(await newPairingCode()); } catch { toast('Could not make a pairing code. Is phone access on?', 'error'); }
  };
  const remove = async (d) => {
    if (!window.confirm(`Remove ${d.name}? It stops working at once; to use it again, pair it again.`)) return;
    try { await removePairedDevice(d.id); toast(`${d.name} removed`, 'success'); load(); } catch { toast('Could not remove it', 'error'); }
  };

  const title = <h3 className="section-title" style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Smartphone size={18} /> Use on phone or tablet <HelpButton title="Use on a phone or tablet" doc="phone" size={16} /></h3>;
  if (refused) return <div>{title}<p style={muted}>You are using the app on a paired phone or tablet. Phone access is turned on or off, and devices removed, on the PC itself.</p></div>;
  if (!status) return null;
  const on = status.enabled;

  // v1.10.86 - one gap between every block (the switch, the notes, the
  // button and the list touched each other).
  return (
    <div>
      {title}
      <div className="phone-access-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <p style={{ ...muted, margin: 0 }}>
        Open the app on a phone or tablet on <b>the same Wi-Fi</b> as this PC: make invoices, look up clients and stock. Your books stay on this PC. The connection is encrypted (HTTPS), each device is paired once with a QR code and the app&apos;s PIN, and you can remove any device here. Off: nothing on the network can reach the app.
      </p>
      {status.headless ? (
        <p className="notice notice-info" style={{ fontSize: '0.85rem' }}>This server has no screen, so phone access is always on here (FGSB_PHONE_ACCESS=1). Only paired devices get in.</p>
      ) : (
        <label className="notice notice-info" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', cursor: status.pinSet || on ? 'pointer' : 'not-allowed' }}>
          <input type="checkbox" id="phone-access-switch" checked={on} disabled={busy || (!status.pinSet && !on)} onChange={(e) => toggle(e.target.checked)} style={{ marginTop: 4, width: 18, height: 18, flexShrink: 0 }} />
          <span><strong>Use on phone or tablet</strong><br /><span style={{ fontSize: '0.85rem' }}>{on ? 'On. Untick it and every phone is cut off at once.' : 'Off.'}</span></span>
        </label>
      )}
      {!status.pinSet && (
        <div className="notice notice-warn" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
          <span>Set a PIN first: a phone must type the app&apos;s PIN to pair.</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={openPinCard}>Set a PIN</button>
        </div>
      )}
      {on && status.error && <p className="notice notice-danger" style={{ fontSize: '0.85rem' }}>{status.error}</p>}
      {on && status.listening && (
        <>
          {/* .notice is a flex row: one span keeps the sentence as text. */}
          <p className="notice notice-note" style={{ fontSize: '0.85rem' }}><span>
            <b>Windows may ask</b> whether to allow <i>Node.js JavaScript Runtime</i> on networks. Tick <b>Private networks</b> (your home or shop Wi-Fi), leave <b>Public networks</b> unticked, and click <b>Allow</b>. If you clicked Cancel, phones cannot connect: see the ? for how to fix it.
          </span></p>
          {pair ? <PairPanel key={pair.code} pair={pair} onNew={showCode} devices={status.devices} onPaired={setStatus} /> : (
            <button type="button" className="btn btn-primary" onClick={showCode} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}><QrCode size={16} /> Pair a phone or tablet</button>
          )}
          <p style={{ ...muted, margin: 0 }}>Security code of this PC: <b style={mono}>{status.shortFingerprint}</b></p>
        </>
      )}
      {status.devices.length > 0 && (
        <div>
          <strong style={{ fontSize: '0.9rem' }}>Paired devices</strong>
          <ul className="phone-devices" style={{ listStyle: 'none', padding: 0, margin: '0.4rem 0 0', display: 'grid', gap: '0.4rem' }}>
            {status.devices.map((d) => (
              <li key={d.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.5rem 0.7rem', borderRadius: 8, background: 'var(--bg-secondary)', fontSize: '0.85rem' }}>
                <span style={{ flex: '1 1 200px' }}><b>{d.name}</b>{d.thisDevice ? ' (this device)' : ''}<br /><span style={muted}>Paired {when(d.pairedAt)} · last used {when(d.lastSeen)}</span></span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => remove(d)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Trash2 size={14} /> Remove</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      </div>
    </div>
  );
}
