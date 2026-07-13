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

// Overpayment on a single bill: paid - total, ignoring the client-credit
// paper trail so we don't double-count our own transfer entries.
export function getBillOverpayment(bill) {
  if (!bill) return 0;
  const total = Number(bill.totalAmount) || 0;
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
  const lower = clientName.trim().toLowerCase();
  const bills = (allBills || []).filter(b => (b.clientName || '').trim().toLowerCase() === lower);
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
        date: new Date().toISOString().split('T')[0],
        mode: 'credit-transferred-out',
        note: `Transferred to ${newBillId}`,
        recordedAt: new Date().toISOString(),
        creditTargetBillId: newBillId,
      },
    ];
    const newTotalPaid = newPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const newStatus = newTotalPaid >= (Number(srcBill.totalAmount) || 0) - 0.005 ? 'paid' : (newTotalPaid > 0.005 ? 'partial' : 'unpaid');
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
    date: new Date().toISOString().split('T')[0],
    mode: 'credit-applied',
    note: `Applied from prior overpayment${consumedFrom.length > 1 ? 's' : ''} (${consumedFrom.map(c => c.invoiceNumber).join(', ')})`,
    recordedAt: new Date().toISOString(),
    creditSourceBillIds: consumedFrom.map(c => c.billId),
  };

  return { amountApplied: amount, sourcePatches, targetEntry, consumedFrom };
}
