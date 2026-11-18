/*
 * v1.10.24 — Client credit balance from overpayments.
 *
 * Reported: "this extra payment can be added to the next bill of
 * customer, u enabled that — auto or manual."
 *
 * Design.
 * When a client pays more than the invoice total on Bill A, the excess
 * sits as an overpayment on Bill A. When Bill B is later created for
 * the same client, we let the user "apply" that credit — accounting is
 * a dual-entry transfer:
 *
 *   Bill A gets an extra payment entry `{amount: -X, mode:
 *     'credit-transferred-out', creditTargetBillId: <new bill id>}` so
 *     Bill A's outstanding stops showing overpaid.
 *   Bill B gets `{amount: +X, mode: 'credit-applied', creditSourceBillIds:
 *     [source ids]}` so Bill B's outstanding drops by X and the
 *     application is auditable.
 *
 * The two entries net to zero (no new cash), so total-paid-vs-invoiced
 * for the client is unchanged.
 */

import { amountDue, paymentStatusFor, isCancelledBill, SALES_INVOICE_TYPES, localToday, clientKey } from '../utils';

// What the client owes on a bill: the total less TDS they deduct. Nothing on
// a cancelled invoice, or on a quotation / proforma / challan (not a sale), so
// money received against one - an advance, or a payment before the invoice was
// cancelled - is the client's credit instead of disappearing.
const owedOn = (bill) => {
  if (isCancelledBill(bill)) return 0;
  const type = bill.invoiceType || 'tax-invoice';
  if (type !== 'credit-note' && !SALES_INVOICE_TYPES.includes(type)) return 0;
  return amountDue(bill);
};

// Overpayment on a single bill: paid - owed, ignoring the client-credit
// paper trail so we don't double-count our own transfer entries.
export function getBillOverpayment(bill) {
  if (!bill) return 0;
  const total = owedOn(bill);
  const cashPaid = (bill.payments || []).reduce((s, p) => {
    // 'credit-transferred-out' entries reduce the raw paidAmount to show
    // that the excess has been moved off this bill. Skip 'credit-applied'
    // entries — those are inbound-from-another-bill and don't affect our
    // overpayment tally.
    if (p.mode === 'credit-applied') return s;
    return s + (Number(p.amount) || 0);
  }, 0);
  return cashPaid - total; // positive → overpaid, negative → underpaid
}

/*
 * Available credit for a client = sum of overpayments across all bills.
 * Returns { available, sources } where sources is a FIFO-sortable list
 * used by the apply flow to know which bill(s) to debit.
 */
export function getClientCredit(clientName, allBills) {
  if (!clientName) return { available: 0, sources: [] };
  // v1.10.86 (#202) - the same name key as the client ledger.
  const lower = clientKey(clientName);
  const bills = (allBills || []).filter(b => clientKey(b.clientName) === lower);
  const sources = [];
  let available = 0;
  for (const b of bills) {
    const over = getBillOverpayment(b);
    if (over > 0.005) {
      sources.push({ billId: b.id, invoiceNumber: b.invoiceNumber, overpaid: over, invoiceDate: b.invoiceDate });
      available += over;
    }
  }
  // Oldest first — natural FIFO allocation on apply.
  sources.sort((a, b) => new Date(a.invoiceDate || 0) - new Date(b.invoiceDate || 0));
  return { available, sources };
}

/*
 * Given a client's credit sources + an amount to apply, produce the
 * dual-entry patches:
 *
 *   returnValue.sourcePatches = [{ billId, patch: <new payments array> }]
 *   returnValue.targetEntry   = payment entry to add to the new bill
 *
 * FIFO across sources. If `amountToApply` exceeds available credit, we
 * apply only what's available (caller should cap; we clamp defensively).
 */
export function planCreditApplication(clientName, allBills, amountToApply, newBillId) {
  const { available, sources } = getClientCredit(clientName, allBills);
  const amount = Math.max(0, Math.min(Number(amountToApply) || 0, available));
  if (amount <= 0.005) return null;

  let remaining = amount;
  const sourcePatches = [];
  const consumedFrom = [];
  for (const src of sources) {
    if (remaining <= 0.005) break;
    const take = Math.min(remaining, src.overpaid);
    const srcBill = allBills.find(b => b.id === src.billId);
    if (!srcBill) continue;
    const newPayments = [
      ...(srcBill.payments || []),
      {
        id: 'credit_out_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        amount: -take,
        date: localToday(),
        mode: 'credit-transferred-out',
        note: `Transferred to ${newBillId}`,
        recordedAt: new Date().toISOString(),
        creditTargetBillId: newBillId,
      },
    ];
    const newTotalPaid = newPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    // A source keeps its status when it is cancelled or not a sale.
    const newStatus = isCancelledBill(srcBill) ? 'cancelled'
      : (owedOn(srcBill) > 0 ? paymentStatusFor(srcBill, newTotalPaid) : (srcBill.status || 'unpaid'));
    sourcePatches.push({
      billId: src.billId,
      updatedBill: { ...srcBill, payments: newPayments, paidAmount: newTotalPaid, status: newStatus },
    });
    consumedFrom.push({ billId: src.billId, invoiceNumber: src.invoiceNumber, amount: take });
    remaining -= take;
  }

  const targetEntry = {
    id: 'credit_in_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    amount,
    date: localToday(),
    mode: 'credit-applied',
    note: `Applied from prior overpayment${consumedFrom.length > 1 ? 's' : ''} (${consumedFrom.map(c => c.invoiceNumber).join(', ')})`,
    recordedAt: new Date().toISOString(),
    creditSourceBillIds: consumedFrom.map(c => c.billId),
  };

  return { amountApplied: amount, sourcePatches, targetEntry, consumedFrom };
}
