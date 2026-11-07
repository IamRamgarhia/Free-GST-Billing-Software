import { useEffect, useState } from 'react';
import { Lock, LockOpen, History } from 'lucide-react';
import HelpButton from './HelpButton';
import { toast } from './Toast';
import { confirmAction, promptAction } from './ConfirmModal';
import { getPeriodLock, setPeriodLock, getEditHistory, getLockStatus } from '../store';
import { formatCurrency } from '../utils';

// v1.10.85 - Settings -> Data: Close the books (nothing dated on or before the
// day can change in a way that moves the accounts or the GST returns; the
// server checks it, src/utils/periodLock.js) and the edit history (every
// save and delete, kept in data/edit-history).
const KIND_NAMES = {
  bills: 'Invoice', purchases: 'Purchase bill', expenses: 'Expense', receipts: 'Receipt',
  'debit-notes': 'Debit note', 'cash-book': 'Cash book entry', 'stock-adjustments': 'Stock adjustment', books: 'Books',
};
const ACTION_NAMES = { added: 'Added', changed: 'Changed', deleted: 'Deleted', restored: 'Restored from Trash', closed: 'Closed up to', opened: 'Opened',
  'backup-restored': 'Daily backup restored', imported: 'Backup imported (added)', 'imported-replace': 'Backup imported (replaced)' };
// With the app's PIN on, the server asks for it (null = cancelled).
const appPinIfOn = async () => {
  const on = await getLockStatus().then((s) => !!s?.enabled).catch(() => false);
  if (!on) return '';
  const pin = await promptAction({ title: "Type the app's PIN", message: 'Closing or opening the books needs the PIN of the app lock.', inputType: 'password', placeholder: '6 or 8 digits', confirmLabel: 'OK' });
  return pin ? pin.trim() : null;
};
// The server's answer to a wrong PIN, in words.
const pinTrouble = (e) => (e?.body?.code === 'wait' ? `Too many wrong tries. Wait ${e.body.wait} seconds.` : e?.status === 401 ? 'Wrong PIN. Nothing changed.' : '');
const when = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const money = (n) => (typeof n === 'number' ? formatCurrency(n) : '');

export default function BooksLockSettings() {
  const [upTo, setUpTo] = useState('');
  const [typed, setTyped] = useState('');
  const [history, setHistory] = useState(null);
  const [kind, setKind] = useState('');

  useEffect(() => {
    getPeriodLock().then((r) => { setUpTo(r.upTo || ''); setTyped(r.upTo || ''); }).catch(() => {});
  }, []);

  const loadHistory = () => getEditHistory(300).then(setHistory).catch(() => toast('Could not read the edit history.', 'error'));

  const close = async () => {
    if (!typed) { toast('Pick the last day to close (for example the last day of the month you filed).', 'warning'); return; }
    if (!await confirmAction({
      title: `Close the books up to ${typed}?`,
      message: 'Invoices, purchases, expenses, receipts, debit notes and cash book entries dated on or before that day can no longer be added, changed or deleted. Payments against them can still be recorded. You can open the books again here.',
      confirmLabel: 'Close the books',
    })) return;
    try {
      const pin = await appPinIfOn();
      if (pin === null) return;
      const r = await setPeriodLock(typed, pin);
      setUpTo(r.upTo);
      toast(`The books are closed up to ${r.upTo}.`, 'success');
      if (history) loadHistory();
    } catch (e) { toast(pinTrouble(e) || 'Could not close the books.', 'error'); }
  };
  const open = async () => {
    if (!await confirmAction({ title: 'Open the books again?', message: 'Everything can be changed again, including entries in months you have already filed. This is written in the edit history.', confirmLabel: 'Open the books', tone: 'warning' })) return;
    try {
      const pin = await appPinIfOn();
      if (pin === null) return;
      await setPeriodLock('', pin);
      setUpTo('');
      setTyped('');
      toast('The books are open.', 'success');
      if (history) loadHistory();
    } catch (e) { toast(pinTrouble(e) || 'Could not open the books.', 'error'); }
  };

  const shown = (history || []).filter((h) => !kind || h.kind === kind);
  return (
    <>
      <h3 className="section-title">Close the books <HelpButton title="Close the books" doc="backup#close-books" size={16} style={{ marginLeft: 6 }} /></h3>
      <p className="page-subtitle mb-4">
        After you file a month&apos;s GST returns, close the books up to its last day so nothing in it changes by mistake.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <label htmlFor="books-upto" className="form-label" style={{ margin: 0 }}>Closed up to</label>
        <input id="books-upto" type="date" className="form-input" style={{ width: 'auto' }} value={typed} onChange={(e) => setTyped(e.target.value)} />
        <button type="button" className="btn btn-primary" onClick={close} disabled={!typed || typed === upTo}>
          <Lock size={15} /> {upTo ? 'Change the date' : 'Close the books'}
        </button>
        {upTo && (
          <button type="button" className="btn btn-secondary" onClick={open}>
            <LockOpen size={15} /> Open the books
          </button>
        )}
      </div>
      <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
        {upTo ? `Closed up to ${upTo}: entries dated then cannot be added, changed or deleted. Payments against them can still be recorded.` : 'Open: everything can be changed.'}
      </p>

      <h4 style={{ fontSize: '0.95rem', margin: '1.25rem 0 0.5rem', display: 'flex', alignItems: 'center', gap: 6 }}>
        <History size={16} /> Edit history <HelpButton title="Edit history" doc="backup#edit-history" size={14} />
      </h4>
      {!history ? (
        <button type="button" className="btn btn-secondary" onClick={loadHistory}>Show the edit history</button>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <select className="filter-select" aria-label="Show" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">Everything</option>
              {Object.entries(KIND_NAMES).map(([k, name]) => <option key={k} value={k}>{name}</option>)}
            </select>
            <span className="text-muted" style={{ fontSize: '0.8rem' }}>The latest {history.length} changes, newest first.</span>
          </div>
          {shown.length === 0 ? (
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>Nothing yet. Changes are recorded from this version on.</p>
          ) : (
            <div className="table-wrap" style={{ maxHeight: 360, overflow: 'auto' }}>
              <table className="data-table edit-history-table">
                <thead><tr><th>When</th><th>What</th><th>Number</th><th>Dated</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
                <tbody>
                  {shown.map((h, i) => (
                    <tr key={`${h.at}-${i}`}>
                      <td>{when(h.at)}{h.from === 'phone' ? ' (phone)' : ''}</td>
                      <td>{ACTION_NAMES[h.action] || h.action} {h.kind === 'books' ? '' : (KIND_NAMES[h.kind] || h.kind).toLowerCase()}</td>
                      <td>{h.number}</td>
                      <td>{h.dateBefore && h.dateBefore !== h.date ? `${h.dateBefore} -> ${h.date}` : h.date}</td>
                      <td style={{ textAlign: 'right' }}>
                        {h.action === 'changed' && h.totalBefore !== h.total ? `${money(h.totalBefore)} -> ${money(h.total)}` : money(h.total ?? h.totalBefore)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
