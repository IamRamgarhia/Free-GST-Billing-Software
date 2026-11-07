// v1.10.85 (#175) - Bank matching: the lines of a bank statement matched to
// what is already in the books.
//
// A credit (money in) can be a payment already recorded on an invoice, or an
// unpaid / partly paid invoice whose balance is that amount. A debit (money
// out) can be a payment to a supplier, an unpaid purchase bill, or an
// expense. A suggestion needs the amount (exact, or within a rupee of
// round-off) and the date (within 7 days of a payment; for an unpaid
// invoice or bill, not more than 7 days before it), and ranks higher when
// the client or supplier name, or the invoice number, is in the bank's
// description. Each suggestion says why it was made.
//
// A statement is saved as { id, bankName, fileName, importedAt, ownerGstin,
// ownerName, lines: [{ id, date, description, reference, credit, debit,
// balance, status: 'open' | 'matched' | 'ignored' | 'expense', match }] }.
//
// Pure: no React, no storage. Tested by scripts/bank-match-test.mjs.
import { toIsoDate } from './bulkCsv.js';
import { amountDue, paymentStatusFor, isCancelledBill, SALES_INVOICE_TYPES } from '../utils.js';
import { purchaseStatus, purchasePaymentDue } from './purchasePayments.js';
import { expenseStatus } from './expensePayment.js';
import { billCurrency } from './partyOutstanding.js';

export const WINDOW_DAYS = 7;
export const ROUND_OFF = 1;

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const compact = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const amountOf = (l) => r2(l.credit > 0 ? l.credit : l.debit);
const sideOf = (l) => (l.credit > 0 ? 'credit' : 'debit');
const dayNo = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000;
const inRupees = (c) => !c || c === 'INR';

// The bank's date as YYYY-MM-DD. Some banks add the time ("05/11/2026 10:42").
const bankDate = (v) => toIsoDate(v) || toIsoDate(String(v || '').trim().split(/\s+/)[0]);

// Parsed statement rows (utils/itr.js parseBankRows) -> lines to save. Rows
// with no date or no amount (opening balance, totals) are left out.
export function toBankLines(transactions, statementId) {
  return (transactions || []).map((t) => ({
    date: bankDate(t.date),
    description: String(t.description || '').trim().slice(0, 300),
    reference: String(t.reference || '').trim().slice(0, 60),
    credit: Math.max(0, r2(t.credit)),
    debit: Math.max(0, r2(t.debit)),
    balance: r2(t.balance),
  })).filter((l) => l.date && (l.credit > 0 || l.debit > 0))
    .map((l, i) => ({ id: `${statementId}-${i + 1}`, ...l, status: 'open', match: null }));
}

// The same bank line in two statements: same date, amount and reference.
export const lineKey = (l) => `${l.date}|${sideOf(l)}|${amountOf(l).toFixed(2)}|${compact(l.reference)}`;

// The incoming lines not already saved. Counted per key: a statement
// imported again (or two overlapping ones) adds nothing twice, while two
// equal payments on the same day in one file both stay.
export function freshLines(savedLines, incoming) {
  const seen = new Map();
  for (const l of savedLines || []) seen.set(lineKey(l), (seen.get(lineKey(l)) || 0) + 1);
  return (incoming || []).filter((l) => {
    const n = seen.get(lineKey(l)) || 0;
    if (n > 0) { seen.set(lineKey(l), n - 1); return false; }
    return true;
  });
}

// Everything in the books a bank line could be. `record: true` means
// confirming records a payment (an unpaid invoice or bill) or marks an
// unpaid expense paid; otherwise the money is already in the books.
// Pass this business's records, purchases with their returns (withReturns).
export function bookEntries({ bills = [], purchases = [], expenses = [] } = {}) {
  const out = [];
  for (const b of bills) {
    if (!b?.id || isCancelledBill(b) || !SALES_INVOICE_TYPES.includes(b.invoiceType || 'tax-invoice') || !inRupees(billCurrency(b))) continue;
    const base = { side: 'credit', kind: 'invoice', id: b.id, number: b.invoiceNumber || '', party: b.clientName || b.data?.client?.name || '' };
    const payments = Array.isArray(b.payments) ? b.payments : [];
    payments.forEach((p, i) => {
      if (!(Number(p?.amount) > 0)) return;
      const paymentId = p.id || `at${i}`;
      out.push({ ...base, key: `invoice:${b.id}:${paymentId}`, paymentId, record: false, amount: r2(p.amount), date: p.date || b.invoiceDate || '' });
    });
    const due = r2(amountDue(b) - payments.reduce((s, p) => s + (Number(p?.amount) || 0), 0));
    if (b.status !== 'paid' && due > 0.005) out.push({ ...base, key: `invoice:${b.id}:open`, record: true, amount: due, date: b.invoiceDate || '' });
  }
  for (const p of purchases) {
    if (!p?.id) continue;
    const base = { side: 'debit', kind: 'purchase', id: p.id, number: p.invoiceNumber || '', party: p.supplierName || '' };
    (Array.isArray(p.payments) ? p.payments : []).forEach((x, i) => {
      if (!(Number(x?.amount) > 0)) return;
      const paymentId = x.id || `at${i}`;
      out.push({ ...base, key: `purchase:${p.id}:${paymentId}`, paymentId, record: false, amount: r2(x.amount), date: x.date || p.date || '' });
    });
    const due = purchasePaymentDue(p);
    if (purchaseStatus(p) !== 'Paid' && due > 0.005) out.push({ ...base, key: `purchase:${p.id}:open`, record: true, amount: due, date: p.date || '' });
  }
  for (const e of expenses) {
    // Partly paid expenses are left out: what is still owed and how the
    // first part was paid (cash?) are not known to the bank line.
    if (!e?.id || !inRupees(e.currency) || !(Number(e.amount) > 0)) continue;
    const status = expenseStatus(e);
    if (status === 'partial') continue;
    out.push({
      side: 'debit', kind: 'expense', id: e.id, number: e.invoiceNo || '', party: e.vendorName || e.description || '',
      key: `expense:${e.id}:${status === 'paid' ? 'paid' : 'open'}`, record: status === 'unpaid', amount: r2(e.amount), date: e.date || '',
    });
  }
  return out;
}

// What the saved lines already use: a payment or expense matches one line only.
export const usedKeys = (lines) => new Set((lines || []).map((l) => l.match?.key).filter(Boolean));

// Words of a name too common to say anything.
const COMMON = new Set(['the', 'and', 'pvt', 'private', 'ltd', 'limited', 'llp', 'company', 'india', 'enterprises', 'traders', 'trading',
  'services', 'solutions', 'industries', 'sons', 'brothers', 'shri', 'store', 'stores', 'agency', 'agencies']);
export function nameInText(name, text) {
  const whole = compact(name);
  if (!whole) return false;
  if (whole.length >= 4 && text.includes(whole)) return true;
  return String(name).toLowerCase().split(/[^a-z0-9]+/).some((w) => w.length >= 4 && !COMMON.has(w) && text.includes(w));
}

const what = (e) => {
  if (e.kind === 'expense') return e.record ? 'unpaid expense' : 'expense';
  const doc = e.kind === 'invoice' ? 'invoice' : 'purchase bill';
  return e.record ? `unpaid ${doc}` : `payment on ${doc}`;
};
const days = (n) => `${n} day${n === 1 ? '' : 's'}`;

// The book entries this bank line could be, best first, each with `why`.
export function suggestFor(line, entries, used = new Set(), { windowDays = WINDOW_DAYS, slack = ROUND_OFF } = {}) {
  const side = sideOf(line);
  const amount = amountOf(line);
  const text = compact(`${line.description} ${line.reference}`);
  const found = [];
  for (const e of entries || []) {
    if (e.side !== side || used.has(e.key) || !e.date) continue;
    const diff = r2(Math.abs(e.amount - amount));
    if (diff > slack + 0.005) continue;
    const gap = dayNo(line.date) - dayNo(e.date); // days after the entry's date
    if (e.record ? gap < -windowDays : Math.abs(gap) > windowDays) continue;
    const why = [diff < 0.005 ? 'Same amount' : `Amount ${diff.toFixed(2)} apart (round-off)`];
    let score = diff < 0.005 ? 3 : 2;
    if (gap === 0) why.push(`same date as the ${what(e)}`);
    else why.push(`${days(Math.abs(gap))} ${gap > 0 ? 'after' : 'before'} the ${what(e)}`);
    score += Math.max(0, 1 - Math.abs(gap) / (e.record ? 90 : windowDays));
    const no = compact(e.number);
    if (no.length >= 3 && text.includes(no)) { why.push(`${e.number} is in the description`); score += 3; }
    if (nameInText(e.party, text)) { why.push(`${e.party} is in the description`); score += 2; }
    found.push({ ...e, score: r2(score), why });
  }
  return found.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
}

// Picking by hand: the entries on the line's side not yet used, nearest
// amount first, filtered by number, name or amount.
export function pickList(line, entries, used = new Set(), search = '', limit = 10) {
  const amount = amountOf(line);
  const q = compact(search);
  return (entries || [])
    .filter((e) => e.side === sideOf(line) && !used.has(e.key))
    .filter((e) => !q || compact(`${e.number} ${e.party} ${e.amount.toFixed(2)}`).includes(q))
    .sort((a, b) => Math.abs(a.amount - amount) - Math.abs(b.amount - amount) || String(b.date).localeCompare(String(a.date)))
    .slice(0, limit);
}

export const entryLabel = (e) => {
  const doc = { invoice: 'Invoice', purchase: 'Purchase bill', expense: 'Expense' }[e.kind];
  return [doc, e.number, e.party && `(${e.party})`].filter(Boolean).join(' ');
};

// The line matched to an entry. `extra`: paymentId of a payment recorded
// now, `before` (an expense's status before it was marked paid).
export function matchedLine(line, entry, extra = {}) {
  const paymentId = extra.paymentId || entry.paymentId || '';
  const key = entry.kind === 'expense' ? `expense:${entry.id}:paid` : `${entry.kind}:${entry.id}:${paymentId}`;
  return {
    ...line,
    status: 'matched',
    match: {
      key, kind: entry.kind, id: entry.id, paymentId, recorded: !!entry.record, label: entryLabel(entry),
      ...(extra.before ? { before: extra.before } : {}), at: new Date().toISOString(),
    },
  };
}
export const ignoredLine = (line) => ({ ...line, status: 'ignored', match: null });
export const expenseLine = (line, expense) => ({
  ...line, status: 'expense',
  match: { key: `expense:${expense.id}:paid`, kind: 'expense', id: expense.id, created: true, label: `Expense (${expense.category})`, at: new Date().toISOString() },
});
export const openLine = (line) => ({ ...line, status: 'open', match: null });

// The payment confirming records, on the bank's date, by bank transfer.
export const bankPayment = (line, id) => ({
  id, amount: amountOf(line), date: line.date, mode: 'bank-transfer',
  reference: line.reference || '', note: line.reference ? `Bank ref ${line.reference}` : 'From bank statement',
  recordedAt: new Date().toISOString(), bankLineId: line.id,
});
export const newInvoicePaymentId = () => `pay_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// An invoice with one more payment, as Record Payment on the Dashboard saves it.
export function invoiceWithPayment(bill, payment) {
  const payments = [...(bill.payments || []), payment];
  const paid = r2(payments.reduce((s, p) => s + (Number(p.amount) || 0), 0));
  return { ...bill, payments, paidAmount: paid, status: paymentStatusFor(bill, paid) };
}
// ... and with that payment taken back (Undo).
export function invoiceWithoutPayment(bill, paymentId) {
  const payments = (bill.payments || []).filter((p) => p.id !== paymentId);
  const paid = r2(payments.reduce((s, p) => s + (Number(p.amount) || 0), 0));
  return { ...bill, payments, paidAmount: paid, status: isCancelledBill(bill) ? 'cancelled' : paymentStatusFor(bill, paid) };
}

// The receipt the Dashboard makes for a payment, so it shows in Receipts.
export const receiptForPayment = (bill, payment) => ({
  id: payment.id,
  date: payment.date,
  receiptNo: `RCPT-${payment.id.replace('pay_', '').toUpperCase().slice(0, 10)}`,
  clientName: bill.data?.client?.name || bill.clientName || '',
  clientAddress: bill.data?.client?.address || '',
  amount: payment.amount,
  paymentMode: payment.mode,
  referenceNo: payment.reference || '',
  againstInvoice: bill.invoiceNumber || bill.id || '',
  note: payment.note || '',
  currency: billCurrency(bill),
  source: 'auto-from-payment',
  billId: bill.id,
  ownerGstin: bill.data?.profile?.gstin || bill.ownerGstin || '',
  ownerName: bill.data?.profile?.businessName || bill.ownerName || '',
});

// A debit added as an expense (bank charges, rent paid by transfer...).
export const expenseFromLine = (line, profile, category = 'Bank Charges') => ({
  id: `exp_bank_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  date: line.date, description: line.description || 'Bank payment', category: String(category || 'Other').slice(0, 60),
  amount: amountOf(line), gstAmount: 0, gstPercent: 0, vendorName: '', vendorGstin: '', invoiceNo: line.reference || '',
  paymentMode: 'Bank Transfer', paymentStatus: 'paid', paidAmount: amountOf(line), interstate: false,
  note: 'Added from the bank statement', bankLineId: line.id,
  ownerGstin: profile?.gstin || '', ownerName: profile?.businessName || '',
});

// The numbers on top of the screen.
export function bankSummary(lines) {
  const s = { lines: 0, matched: 0, ignored: 0, unmatched: 0, moneyIn: 0, moneyOut: 0, unmatchedIn: 0, unmatchedOut: 0 };
  for (const l of lines || []) {
    s.lines++;
    if (l.status === 'open') s.unmatched++;
    else if (l.status === 'ignored') s.ignored++;
    else s.matched++;
    s.moneyIn += l.credit || 0;
    s.moneyOut += l.debit || 0;
    if (l.status === 'open') { s.unmatchedIn += l.credit || 0; s.unmatchedOut += l.debit || 0; }
  }
  return { ...s, moneyIn: r2(s.moneyIn), moneyOut: r2(s.moneyOut), unmatchedIn: r2(s.unmatchedIn), unmatchedOut: r2(s.unmatchedOut) };
}
