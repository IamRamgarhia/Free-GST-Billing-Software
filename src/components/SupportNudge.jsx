// v1.10.80 - the daily support card on the Dashboard (was a 50-invoice
// milestone card every 120 days). The maintainer asked to be in front of
// users every day: once a business has made a few invoices, the card shows
// once a day with the live supporters total. "Not today" hides it until
// tomorrow, "Hide for 7 days" for a week. Never a popup, never blocks work,
// never printed on an invoice. Per browser (localStorage), which is fine for a
// reminder: losing it only means one more card.
import { useState } from 'react';
import { Heart } from 'lucide-react';
import useSupporters from './useSupporters';
import HelpButton from './HelpButton';
import { shouldShowSupportNudge, localDay, SNOOZE_DAYS } from '../utils/supporters';

const KEY = 'freegstbill_supportNudge';

const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ } };
const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

// A different line each day, so the card doesn't read as the same banner.
const LINES = [
  'Free GST Billing is free, with no ads and no paid version. It keeps going because users chip in.',
  'One developer builds this app in spare hours. A small UPI payment pays for the next fix.',
  'No subscription, no locked features. If the app saves you time, help keep it free for everyone.',
  'Every bug you report and every rupee you send goes into the next update.',
];

export default function SupportNudge({ invoiceCount, onOpen }) {
  const [state, setState] = useState(read);
  const visible = shouldShowSupportNudge(invoiceCount, state);
  const tracker = useSupporters(visible);
  if (!visible) return null;
  const save = (v) => { write(v); setState(v); };
  const hideToday = () => save({ ...state, hiddenOn: localDay() });
  const now = new Date();
  const line = LINES[Math.floor(now.getTime() / 86400000) % LINES.length];
  const goal = tracker?.goal;
  return (
    <div className="glass-panel" role="note" aria-label="Support Free GST Billing"
      style={{ padding: '0.9rem 1.25rem', marginBottom: '1.25rem', display: 'flex', gap: '0.9rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <Heart size={22} style={{ color: '#e11d48', flexShrink: 0 }} />
      <div style={{ flex: '1 1 300px', minWidth: 0 }}>
        <div style={{ fontWeight: 700 }}>{invoiceCount} invoices made with Free GST Billing <HelpButton title="The support card" doc="dashboard#support-card" size={16} /></div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{line}</div>
        {tracker && tracker.totalReceived > 0 && (
          <div style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>
            {goal
              ? <>{inr(tracker.totalReceived)} of {inr(goal.amount)} raised{goal.label ? ` for ${goal.label}` : ''}</>
              : <>{inr(tracker.totalReceived)} received so far{tracker.supporters ? ` from ${tracker.supporters} supporters` : ''}</>}
            {goal && (
              <div role="progressbar" aria-label="Progress towards the goal" aria-valuemin={0} aria-valuemax={goal.amount}
                aria-valuenow={Math.min(tracker.totalReceived, goal.amount)}
                style={{ height: 6, maxWidth: 360, marginTop: 4, background: 'var(--border-color, #e5e7eb)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, (tracker.totalReceived / goal.amount) * 100)}%`, height: '100%', background: 'var(--primary)' }} />
              </div>
            )}
          </div>
        )}
      </div>
      <button type="button" className="btn btn-primary" onClick={() => { hideToday(); onOpen(); }}
        style={{ fontSize: '0.82rem' }}>Support with UPI</button>
      <button type="button" className="btn btn-secondary" onClick={hideToday}
        style={{ fontSize: '0.82rem' }}>Not today</button>
      <button type="button" onClick={() => save({ ...state, snoozedUntil: now.getTime() + SNOOZE_DAYS * 86400000 })}
        style={{ background: 'none', border: 0, color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem', fontSize: '0.78rem', textDecoration: 'underline' }}>
        Hide for 7 days
      </button>
    </div>
  );
}
