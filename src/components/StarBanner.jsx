// v1.10.75 - a slim "star us on GitHub" line at the top of the app. Asked
// for by the maintainer: closable like a notification, at most once a month.
// First shown 3 days after the app was first opened in this browser, never
// to someone on day one. ✕ hides it for 30 days; "Star on GitHub" or
// "Already starred" hides it for good. Per browser (localStorage), which is
// fine for a reminder: losing it only means one more polite line.
import { useState } from 'react';
import { Star, X } from 'lucide-react';

const KEY = 'freegstbill_starBanner';
const REPO = 'https://github.com/IamRamgarhia/Free-GST-Billing-Software';
const DAY = 86400000;
const FIRST_AFTER_DAYS = 3;
const EVERY_DAYS = 30;

const load = () => {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* blocked storage: treat as new */ }
  if (!s.firstSeen) {
    s = { ...s, firstSeen: Date.now() };
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ }
  }
  return s;
};

const due = (s, now = Date.now()) => !s.done && (s.closedAt
  ? now - s.closedAt >= EVERY_DAYS * DAY
  : now - s.firstSeen >= FIRST_AFTER_DAYS * DAY);

export default function StarBanner() {
  const [state, setState] = useState(load);
  if (!due(state)) return null;
  const save = (patch) => {
    const next = { ...state, ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
    setState(next);
  };
  return (
    <div role="status" style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
      padding: '0.6rem 0.9rem', marginBottom: '1rem', borderRadius: 10,
      background: 'var(--info-bg)', border: '1px solid var(--info-border)', color: 'var(--info-text)', fontSize: '0.85rem',
    }}>
      <Star size={18} style={{ color: '#f59e0b', fill: '#f59e0b', flexShrink: 0 }} />
      <span style={{ flex: '1 1 240px' }}>
        Finding Free GST Billing useful? A star on GitHub helps other businesses find it. It takes one click.
      </span>
      <a className="btn btn-primary" href={REPO} target="_blank" rel="noopener noreferrer"
        onClick={() => save({ done: true })} style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', textDecoration: 'none' }}>
        <Star size={14} /> Star on GitHub
      </a>
      <button type="button" onClick={() => save({ done: true })}
        style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', fontSize: '0.78rem', textDecoration: 'underline', padding: '0.25rem' }}>
        Already starred
      </button>
      <button type="button" onClick={() => save({ closedAt: Date.now() })} title="Close (asks again in a month)" aria-label="Close"
        style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', padding: '0.25rem', lineHeight: 0 }}>
        <X size={16} />
      </button>
    </div>
  );
}
