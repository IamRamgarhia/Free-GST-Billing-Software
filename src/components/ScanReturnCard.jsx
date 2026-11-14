import { Eye, Undo2, PackageCheck } from 'lucide-react';
import HelpButton from './HelpButton';
import { formatCurrency, formatShortDate } from '../utils';

// v1.10.86 (#197) - the one invoice a scanned return label (order ID, AWB or
// invoice number, matched exactly by findScannedInvoice) belongs to, above the
// Dashboard list: Open it, or make its credit note. When a credit note against
// it is already made, that is said instead, with Open.
export default function ScanReturnCard({ found, onOpen, onReturn }) {
  const { bill, creditNotes } = found;
  const d = bill.data?.details || {};
  const codes = [d.buyerOrderNo && `Order ${d.buyerOrderNo}`, d.dispatchDocNo && `AWB ${d.dispatchDocNo}`].filter(Boolean).join(' · ');
  const cn = creditNotes[0];
  return (
    <div className="scan-return-card" role="status" aria-live="polite">
      <PackageCheck size={20} className="scan-return-icon" aria-hidden="true" />
      <div className="scan-return-info">
        <div className="scan-return-title">
          <strong>{bill.invoiceNumber}</strong>
          <span>{formatShortDate(bill.invoiceDate)}</span>
          <span>{bill.clientName}</span>
          <strong>{formatCurrency(Number(bill.totalAmount) || 0, bill.currency || 'INR')}</strong>
          <HelpButton title="Scan a return" doc="dashboard#scan-a-return" size={14} />
        </div>
        {codes && <div className="scan-return-codes">{codes}</div>}
        {cn && <div className="scan-return-done">Credit note {cn.invoiceNumber} already made{creditNotes.length > 1 ? ` (and ${creditNotes.length - 1} more)` : ''}.</div>}
      </div>
      <div className="scan-return-actions">
        <button type="button" className="btn btn-secondary" onClick={() => onOpen(bill)}><Eye size={14} /> Open</button>
        {cn
          ? <button type="button" className="btn btn-secondary" onClick={() => onOpen(cn)}><Eye size={14} /> Open {cn.invoiceNumber}</button>
          : <button type="button" className="btn btn-primary" onClick={() => onReturn(bill)}><Undo2 size={14} /> Return / credit note</button>}
      </div>
    </div>
  );
}
