// v1.10.83 (#123) - record, change and delete payments to the supplier on a
// purchase bill, with its payment history. Laid out like Record Payment on the
// Dashboard. The maths is in utils/purchasePayments.js (unit-tested).
import { useState } from 'react';
import { Edit3, Trash2 } from 'lucide-react';
import { savePurchase } from '../store';
import { formatCurrency, localToday } from '../utils';
import {
  PURCHASE_PAYMENT_MODES, PURCHASE_STATUS_LABEL, OVERPAY_SLACK, purchasePaymentModeName, purchaseTotal, purchaseOwed, purchasePaid, purchaseRcmTax,
  purchasePaymentDue, purchaseStatus, hasPurchasePayments, validatePurchasePayment, withPurchasePayments, newPurchasePaymentId,
} from '../utils/purchasePayments';
import HelpButton from './HelpButton';
import { toast } from './Toast';
import { confirmAction } from './ConfirmModal';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const blankFor = (bill) => ({ amount: String(purchasePaymentDue(bill) || ''), date: localToday(), mode: 'bank-transfer', reference: '', note: '' });

export default function PurchasePaymentModal({ purchase, onClose, onChanged }) {
  const [bill, setBill] = useState(purchase);
  const [form, setForm] = useState(() => blankFor(purchase));
  const [editIdx, setEditIdx] = useState(null);
  const [saving, setSaving] = useState(false);
  const payments = bill.payments || [];
  const total = purchaseTotal(bill);
  const owed = purchaseOwed(bill);
  const paid = purchasePaid(bill);
  const legacyPaid = !hasPurchasePayments(bill) && bill.paymentStatus === 'Paid';
  const set = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }));

  // Saves the bill with these payments; the updated bill, or null if it failed.
  const persist = async (nextPayments) => {
    const updated = withPurchasePayments(bill, nextPayments);
    setSaving(true);
    try {
      await savePurchase(updated);
      setBill(updated);
      onChanged(updated);
      return updated;
    } catch (err) {
      toast(err?.message && !/^API error/.test(err.message) ? err.message : 'Could not save the payment. Try again.', 'error');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    const base = editIdx !== null ? payments[editIdx] : { id: newPurchasePaymentId(), recordedAt: new Date().toISOString() };
    // Edited by you, so no longer the automatic Mark as paid payment.
    const entry = { ...base, amount: r2(form.amount), date: form.date, mode: form.mode, reference: form.reference.trim(), note: form.note.trim(), ...(editIdx !== null ? { auto: false } : {}) };
    const problem = validatePurchasePayment({ ...entry, amount: Number(form.amount) });
    if (problem) { toast(problem, 'warning'); return; }
    const others = r2(paid - (editIdx !== null ? Number(payments[editIdx].amount) || 0 : 0));
    if (others + entry.amount > owed + OVERPAY_SLACK) {
      toast(`That is more than the ${formatCurrency(Math.max(0, owed - others))} still to pay on this bill`, 'warning');
      return;
    }
    const next = editIdx !== null ? payments.map((x, i) => (i === editIdx ? entry : x)) : [...payments, entry];
    const updated = await persist(next);
    if (!updated) return;
    const left = purchasePaymentDue(updated);
    if (editIdx !== null) {
      toast('Payment updated', 'success');
      setEditIdx(null);
      setForm(blankFor(updated));
      return;
    }
    toast(`Payment of ${formatCurrency(entry.amount)} recorded${left > 0.005 ? ` · ${formatCurrency(left)} left to pay` : ' · bill paid'}`, 'success');
    onClose();
  };

  const startEdit = (i) => {
    const x = payments[i];
    setEditIdx(i);
    setForm({ amount: String(x.amount ?? ''), date: x.date || localToday(), mode: x.mode || 'other', reference: x.reference || '', note: x.note || '' });
  };
  const cancelEdit = () => { setEditIdx(null); setForm(blankFor(bill)); };

  const remove = async (i) => {
    const x = payments[i];
    if (!await confirmAction({
      title: 'Delete this payment?',
      message: `${formatCurrency(x.amount)} paid on ${x.date || '-'} (${purchasePaymentModeName(x.mode)}) is removed. The bill goes back to Partly paid or Unpaid${x.mode === 'cash' ? ', and the Cash book no longer shows it' : ''}.`,
      confirmLabel: 'Delete payment',
      tone: 'danger',
    })) return;
    const updated = await persist(payments.filter((_, j) => j !== i));
    if (!updated) return;
    toast('Payment deleted', 'success');
    setEditIdx(null);
    setForm(blankFor(updated));
  };

  const balance = r2(owed - paid);
  const rcm = purchaseRcmTax(bill); // v1.10.86 - reverse charge: GST you pay, not the supplier
  const tds = r2(total - rcm - owed);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
        <h3 className="section-title">{editIdx !== null ? 'Edit payment' : 'Record payment to supplier'} <HelpButton title="Paying a supplier" doc="purchases#record-payment" size={16} style={{ marginLeft: 6 }} /></h3>
        <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.85rem', lineHeight: 1.6 }}>
          Bill: <strong>{bill.invoiceNumber || '-'}</strong> · {bill.supplierName || '-'}<br />
          Total: <strong>{formatCurrency(total)}</strong>
          {rcm > 0.005 && <> | Less GST you pay (reverse charge): <strong>{formatCurrency(rcm)}</strong></>}
          {tds > 0.005 && <> | Less TDS: <strong>{formatCurrency(tds)}</strong></>}
          {paid > 0.005 && <> | Paid: <strong>{formatCurrency(paid)}</strong></>}
          {' '}| Balance: <strong style={{ color: legacyPaid || balance <= 0.005 ? 'var(--success)' : 'var(--danger)' }}>{formatCurrency(legacyPaid ? 0 : Math.max(0, balance))}</strong>
        </p>
        {legacyPaid && (
          <div className="notice notice-info" style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.8rem' }}>
            This bill was marked <b>Paid</b> without amounts. Recording a payment here replaces that mark: the status then follows the payments you enter.
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label" htmlFor="ppay-amount">Amount paid *</label>
            <input id="ppay-amount" type="number" min="0" step="any" className="form-input" value={form.amount}
              onFocus={(e) => e.target.select()} onChange={set('amount')} placeholder={String(Math.max(0, balance))} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ppay-date">Payment date *</label>
            <input id="ppay-date" type="date" className="form-input" value={form.date} onChange={set('date')} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ppay-mode">Payment mode</label>
            <select id="ppay-mode" className="form-input" value={form.mode} onChange={set('mode')}>
              {PURCHASE_PAYMENT_MODES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ppay-ref">Reference / cheque no.</label>
            <input id="ppay-ref" type="text" className="form-input" maxLength={60} value={form.reference} onChange={set('reference')} placeholder="UTR, UPI ref, cheque no." />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label" htmlFor="ppay-note">Note (optional)</label>
            <input id="ppay-note" type="text" className="form-input" maxLength={300} value={form.note} onChange={set('note')} placeholder="Anything to remember" />
          </div>
        </div>
        {form.mode === 'cash' && (
          <p className="text-muted" style={{ margin: '0.25rem 0 0', fontSize: '0.75rem' }}>Cash payments also show in the Cash book as money out. Do not add them there again.</p>
        )}
        {payments.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <label className="form-label">Payment History <HelpButton title="Payment history" doc="purchases#payment-history" size={14} /></label>
            <div className="payment-history">
              {payments.map((x, i) => (
                <div key={x.id || i} className="payment-row" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', outline: editIdx === i ? '2px solid var(--primary)' : undefined }}>
                  <span style={{ minWidth: 90 }}>{x.date ? new Date(`${x.date}T00:00:00`).toLocaleDateString('en-IN') : '-'}</span>
                  <span className="font-bold" style={{ minWidth: 100 }}>{formatCurrency(x.amount)}</span>
                  <span className="text-muted" style={{ minWidth: 80 }}>{purchasePaymentModeName(x.mode)}</span>
                  {(x.reference || x.note) && <span className="text-muted" style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>· {[x.reference, x.note].filter(Boolean).join(' · ')}</span>}
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.25rem' }}>
                    <button type="button" className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }} disabled={saving}
                      onClick={() => startEdit(i)} title="Edit amount / date / mode / reference" aria-label="Edit this payment"><Edit3 size={12} /></button>
                    <button type="button" className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', color: 'var(--danger)', borderColor: 'var(--danger)' }} disabled={saving}
                      onClick={() => remove(i)} title="Delete this payment" aria-label="Delete this payment"><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-muted" style={{ margin: '0.4rem 0 0', fontSize: '0.75rem' }}>Status: <b>{PURCHASE_STATUS_LABEL[purchaseStatus(bill)]}</b></p>
          </div>
        )}
        <div className="flex gap-2 justify-end mt-4" style={{ flexWrap: 'wrap' }}>
          {editIdx !== null
            ? <button className="btn btn-secondary" onClick={cancelEdit} disabled={saving}>Cancel edit</button>
            : <button className="btn btn-secondary" onClick={onClose}>Close</button>}
          <button className="btn btn-primary" onClick={save} disabled={saving}>{editIdx !== null ? 'Save payment' : 'Record Payment'}</button>
        </div>
      </div>
    </div>
  );
}
