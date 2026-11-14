// v1.10.86 - (#148, #194) Supplier statement: a supplier's account for a date
// range, like the client statement on the sales side.
//
// From your books: a purchase bill is what you owe them (Credit); a payment to
// them, the TDS you kept back and goods sent back on a debit note take it off
// (Debit). Balance = what you still owe (a minus balance: they owe you, e.g. a
// refund for goods returned after the bill was paid).
//
// Same rules as the purchase list (utils/purchasePayments.js), so the closing
// balance agrees with "Balance due": an old bill marked Paid without payment
// details counts as paid on its own date. Rows before `from` make the opening
// balance; rows after `to` are left out.
//
// The callers pass this business's bills and debit notes only (belongsToProfile),
// as the Purchases screen already loads them. Pure: no React, no storage
// (tested in scripts/supplier-statement-test.mjs).
import { formatCurrency } from '../utils.js';
import { purchaseTotal, purchaseOwed, hasPurchasePayments, purchasePaymentModeName } from './purchasePayments.js';
import { debitNoteTotals, isActiveDebitNote, returnedOnBill } from './debitNotes.js';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const key = (name) => String(name || '').trim().toLowerCase();

// Every supplier on the bills, A-Z, one per name (any case): the latest
// spelling with its GSTIN and address.
export function supplierList(purchases) {
  const seen = new Map();
  const newest = [...(purchases || [])].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  for (const p of newest) {
    const name = String(p.supplierName || '').trim();
    if (name && !seen.has(key(name))) seen.set(key(name), { name, gstin: String(p.supplierGstin || '').trim(), address: String(p.supplierAddress || '').trim() });
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// The entries of one supplier's account, oldest first, before the date range is applied.
function entriesOf(purchases, debitNotes, supplierName) {
  const bills = (purchases || []).filter((p) => key(p.supplierName) === key(supplierName));
  const out = [];
  bills.forEach((p, bi) => {
    const no = p.invoiceNumber || '-';
    const date = p.date || '';
    out.push({ date, order: [bi, 0], kind: 'bill', particulars: `Purchase bill ${no}`, credit: purchaseTotal(p), debit: 0 });
    const tds = r2(purchaseTotal(p) - purchaseOwed(p));
    if (tds > 0.005) out.push({ date, order: [bi, 1], kind: 'tds', particulars: `TDS kept back on ${no}`, debit: tds, credit: 0 });
    if (hasPurchasePayments(p)) {
      (p.payments || []).forEach((x, i) => {
        const how = [purchasePaymentModeName(x.mode), x.reference].filter(Boolean).join(' ');
        out.push({ date: x.date || date, order: [bi, 2 + i], kind: 'payment', particulars: `Paid${how ? ` (${how})` : ''} for ${no}`, debit: r2(x.amount), credit: 0 });
      });
    } else if (p.paymentStatus === 'Paid') {
      out.push({ date, order: [bi, 2], kind: 'payment', particulars: `Marked paid: ${no}`, debit: purchaseOwed(p), credit: 0 });
    }
    // Returns: each debit note; a bill sent back in full also loses its
    // round-off (returnedOnBill), so that bit goes on its last note.
    const notes = (debitNotes || []).filter((dn) => isActiveDebitNote(dn) && dn.purchaseId === p.id)
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    const extra = r2(returnedOnBill(p, notes) - notes.reduce((s, dn) => s + debitNoteTotals(dn).total, 0));
    notes.forEach((dn, i) => {
      const amount = r2(debitNoteTotals(dn).total + (i === notes.length - 1 ? extra : 0));
      out.push({ date: dn.date || date, order: [bi, 1000 + i], kind: 'return', particulars: `Goods returned: debit note${dn.dnNumber ? ` ${dn.dnNumber}` : ''} on ${no}`, debit: amount, credit: 0 });
    });
  });
  // By date; on the same date, a bill before its own payments and returns.
  return out.sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.order[0] - b.order[0] || a.order[1] - b.order[1]);
}

// { opening, rows: [{ date, kind, particulars, debit, credit, balance }],
//   closing, totals: { billed, paid, returned, tds } } for `from`..`to`
// (YYYY-MM-DD, either may be blank: no limit).
export function supplierStatement(purchases, debitNotes, supplierName, { from = '', to = '' } = {}) {
  let balance = 0;
  let opening = 0;
  const rows = [];
  const totals = { billed: 0, paid: 0, returned: 0, tds: 0 };
  for (const e of entriesOf(purchases, debitNotes, supplierName)) {
    if (to && e.date > to) continue;
    balance = r2(balance + e.credit - e.debit);
    if (from && e.date < from) { opening = balance; continue; }
    const { order: _order, ...row } = e;
    rows.push({ ...row, balance });
    if (e.kind === 'bill') totals.billed += e.credit;
    else if (e.kind === 'payment') totals.paid += e.debit;
    else if (e.kind === 'return') totals.returned += e.debit;
    else totals.tds += e.debit;
  }
  return { opening, rows, closing: balance, totals: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, r2(v)])) };
}

// "Rs. 1,200.00 owed" / "... they owe you" / "Nil", for the screen and the PDF.
export const balanceWords = (n, fmt = (v) => formatCurrency(v)) => (n > 0.005 ? `${fmt(n)} you owe` : n < -0.005 ? `${fmt(-n)} they owe you` : 'Nil');

// The text sent with the statement PDF (WhatsApp / email).
export function supplierStatementMessage(supplierName, st, profile, period) {
  const fmt = (n) => formatCurrency(Number(n) || 0);
  return [
    profile?.businessName && `*${profile.businessName}*`,
    `Statement of account: ${supplierName}${period ? ` (${period})` : ''}`,
    `Bills: ${fmt(st.totals.billed)}`,
    `Paid: ${fmt(st.totals.paid)}`,
    st.totals.returned > 0.005 && `Goods returned: ${fmt(st.totals.returned)}`,
    st.closing > 0.005 ? `*Balance we owe: ${fmt(st.closing)}*` : st.closing < -0.005 ? `*Balance you owe us: ${fmt(-st.closing)}*` : 'Nothing outstanding',
    'Please check and confirm. The statement PDF is attached.',
  ].filter(Boolean).join('\n');
}
