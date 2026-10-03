// v1.10.75 - one quiet thank-you, never a nag: shown on the Dashboard once
// this business has 50 invoices, then at most every 120 days, and never
// again after "Don't show again". Per browser (localStorage), which is fine
// for a reminder: losing it only means one more polite card.
import { useState } from 'react';
import { Heart } from 'lucide-react';

const KEY = 'freegstbill_supportNudge';
const MIN_INVOICES = 50;
const GAP_DAYS = 120;

const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ } };

function shouldShowSupportNudge(invoiceCount, state, now = Date.now()) {
  if (invoiceCount < MIN_INVOICES || state.never) return false;
  return !state.snoozedAt || now - state.snoozedAt > GAP_DAYS * 86400000;
}

export default function SupportNudge({ invoiceCount, onOpen }) {
  const [state, setState] = useState(read);
  if (!shouldShowSupportNudge(invoiceCount, state)) return null;
  const save = (v) => { write(v); setState(v); };
  const milestone = Math.floor(invoiceCount / 50) * 50;
  return (
    <div className="glass-panel" role="note"
      style={{ padding: '0.9rem 1.25rem', marginBottom: '1.25rem', display: 'flex', gap: '0.9rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <Heart size={22} style={{ color: '#e11d48', flexShrink: 0 }} />
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <div style={{ fontWeight: 700 }}>{milestone}+ invoices made with Free GST Billing</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          It's free and always will be. If it helps your business, you can help keep it going.
        </div>
      </div>
      <button type="button" className="btn btn-primary" onClick={() => { save({ ...state, snoozedAt: Date.now() }); onOpen(); }}
        style={{ fontSize: '0.82rem' }}>See how to help</button>
      <button type="button" className="btn btn-secondary" onClick={() => save({ ...state, snoozedAt: Date.now() })}
        style={{ fontSize: '0.82rem' }}>Maybe later</button>
      <button type="button" onClick={() => save({ ...state, never: true })}
        style={{ background: 'none', border: 0, color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem', fontSize: '0.78rem', textDecoration: 'underline' }}>
        Don't show again
      </button>
    </div>
  );
}
