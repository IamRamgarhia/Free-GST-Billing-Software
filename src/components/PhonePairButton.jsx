// v1.10.86 - the phone button at the top right (asked for: "a Pair a phone or
// tablet button at the top"). It shows the same QR code as Settings -> Privacy
// & Security -> Use on phone or tablet; when phone access is off or there is
// no PIN it says so, with a button to that card. On a paired phone the PC's
// phone settings are refused (403), so there is no button there.
import { useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';
import HelpButton from './HelpButton';
import { toast } from './Toast';
import { getPhoneAccess, newPairingCode } from '../store';
import { PairPanel } from './PhoneAccessSettings';

const why = (s) => (!s.pinSet
  ? 'First set a PIN for the app (a phone must type it to pair), then tick Use on phone or tablet.'
  : !s.enabled ? 'Phone access is off. Tick Use on phone or tablet, then click this button again.'
    : s.error || 'Phone access is starting. Try again in a moment.');

export default function PhonePairButton({ className, onOpenSettings }) {
  const [hidden, setHidden] = useState(false);
  const [shown, setShown] = useState(null); // { pair } | { status }
  useEffect(() => {
    getPhoneAccess().catch((err) => { if (err.status === 403) setHidden(true); });
  }, []);
  if (hidden) return null;

  const open = async () => {
    try {
      const status = await getPhoneAccess();
      setShown(status.listening && status.pinSet ? { pair: await newPairingCode(), status } : { status });
    } catch (err) {
      if (err.status === 403) setHidden(true);
      else toast('Could not make a pairing code. Try again.', 'error');
    }
  };
  const close = () => setShown(null);
  const toSettings = () => { close(); onOpenSettings?.(); };

  return (
    <>
      <button type="button" className={className} onClick={open}
        title="Pair a phone or tablet: show the QR code" aria-label="Use on a phone or tablet">
        <Smartphone size={18} />
      </button>
      {shown && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal-content" role="dialog" aria-labelledby="phone-pair-title" style={{ maxWidth: shown.pair ? '640px' : '460px' }} onClick={(e) => e.stopPropagation()}>
            <h3 id="phone-pair-title" className="section-title" style={{ margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Smartphone size={20} /> Pair a phone or tablet
              <HelpButton title="Use on a phone or tablet" doc="phone" size={16} />
            </h3>
            {shown.pair
              ? <PairPanel key={shown.pair.code} pair={shown.pair} onNew={open} devices={shown.status.devices} showDevices />
              : <p className="notice notice-note" style={{ fontSize: '0.9rem' }}><span>{why(shown.status)}</span></p>}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              {!shown.pair && !shown.status.headless && <button type="button" className="btn btn-primary" onClick={toSettings}>Open phone settings</button>}
              <button type="button" className="btn btn-secondary" onClick={close}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
