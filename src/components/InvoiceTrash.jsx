// v1.10.84 (maintainer, 7 Nov: "we should have some trash folder in the
// dashboard ... all tabs on top") - the Trash tab of the Invoices screen.
// Deleted invoices wait here 30 days (the server's purgeOldTrash removes them
// after that, counted from the day they were deleted: ERR-084).
import { RotateCcw, Trash2 } from 'lucide-react';
import { formatCurrency } from '../utils';

export const TRASH_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;
// The same day format as the Invoices list (4/11/2026).
const day = (v) => { const t = Date.parse(v || ''); return Number.isFinite(t) ? new Date(t).toLocaleDateString('en-IN') : '-'; };

export const daysLeft = (trashedAt, now = Date.now()) => {
  const t = Date.parse(trashedAt || '');
  if (!Number.isFinite(t)) return TRASH_DAYS;
  return Math.max(0, TRASH_DAYS - Math.floor((now - t) / DAY));
};

export default function InvoiceTrash({ items, onRestore, onPurge, busy }) {
  if (!items.length) {
    return (
      <div className="empty-state">
        <Trash2 size={48} />
        <p>The Trash is empty. Deleted invoices wait here for {TRASH_DAYS} days, then go for good.</p>
      </div>
    );
  }
  return (
    <div className="table-scroll">
      <p className="text-muted" style={{ fontSize: '0.8rem', margin: '0.6rem 0 0.5rem', padding: '0 1.25rem' }}>
        Deleted invoices stay here {TRASH_DAYS} days, then they are removed for good. Restore puts one back in your invoices (and takes its stock out again).
      </p>
      <table className="data-table invoice-table">
        <thead>
          <tr>
            <th style={{ paddingLeft: '1.25rem' }}>Date</th>
            <th>Invoice No.</th>
            <th>Client</th>
            <th>Amount</th>
            <th>Deleted on</th>
            <th>Days left</th>
            <th className="col-center col-sticky-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((b) => (
            <tr key={b.id}>
              <td className="text-muted" style={{ paddingLeft: '1.25rem' }}>{day(b.invoiceDate || b.data?.details?.invoiceDate)}</td>
              <td className="font-medium">{b.invoiceNumber || '-'}</td>
              <td>{b.clientName || '-'}</td>
              <td>{formatCurrency(b.totalAmount || 0, b.currency || 'INR')}</td>
              <td className="text-muted">{day(b._trashedAt)}</td>
              <td>{daysLeft(b._trashedAt)}</td>
              <td className="col-sticky-actions">
                <div className="table-actions" style={{ justifyContent: 'center' }}>
                  <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => onRestore(b)}
                    style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }} title="Put it back in your invoices">
                    <RotateCcw size={13} /> Restore
                  </button>
                  <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => onPurge(b)}
                    style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                    title="Delete it now, for good">
                    <Trash2 size={13} /> Delete forever
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
