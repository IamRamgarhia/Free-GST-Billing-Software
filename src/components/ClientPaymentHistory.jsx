import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency, parseLocalDate } from '../utils';
import HelpButton from './HelpButton';

// v1.10.85 (#157) - a client's payments on their page: date, invoice, amount,
// mode and note, newest first (rows from clientPaymentHistory). Closed until
// clicked, so the client's page stays as it was.
export default function ClientPaymentHistory({ rows }) {
  const [open, setOpen] = useState(false);
  if (!rows.length) return null;
  const date = (d) => (d ? parseLocalDate(d).toLocaleDateString('en-IN') : '-');
  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <div style={{ padding: '0.5rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <button type="button" className="btn-link" onClick={() => setOpen(!open)} aria-expanded={open}
          style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
          Payment history ({rows.length}) {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <HelpButton title="Payment history" doc="clients#payment-history" size={14} />
      </div>
      {open && (
        <div className="table-scroll">
          <table className="data-table" style={{ marginBottom: 0 }} aria-label="Payment history">
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice No.</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Mode</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="text-muted">{date(r.date)}</td>
                  <td>{r.invoiceNumber ? <span className="invoice-badge">{r.invoiceNumber}</span> : <span className="text-muted">{r.receiptNo ? `Receipt ${r.receiptNo}` : 'Advance'}</span>}</td>
                  <td className="font-bold" style={{ textAlign: 'right', color: '#059669' }}>{formatCurrency(r.amount, r.currency)}</td>
                  <td>{r.mode || '-'}</td>
                  <td className="text-muted">{r.note || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
