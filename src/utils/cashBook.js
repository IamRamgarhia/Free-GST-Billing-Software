/*
 * v1.10.83 - the cash book: money in and money out in cash, with cash in hand.
 *
 * Asked for: "enter any cash entries or any raw entries of cash with names or
 * notes". Two kinds of lines:
 *   - the user's own entries (data/cash-book), each Money in or Money out;
 *   - cash already recorded elsewhere in the app, shown read-only so nothing
 *     is typed twice: invoice payments, payment receipts, expenses paid in
 *     cash and (v1.10.83, #123) cash payments to suppliers on purchase bills.
 *     A supplier payment has no other record (no receipt or expense is made
 *     for it), so it is one line as it stands.
 *
 * An invoice payment and its receipt are usually the SAME money (recording a
 * payment on the Dashboard saves a receipt; a receipt against an invoice adds
 * a payment to it). They are paired the way the Dashboard reconciles them, and
 * a pair is one line. See scripts/cashbook-test.mjs.
 *
 * Pure: no React, no storage, so the server validates with the same rules.
 * ponytail: rupees only; a foreign-currency invoice or receipt is left out.
 */
import { belongsToProfile, getFinancialYearStart, toLocalIsoDate } from '../utils.js';
import { expensePaid } from './expensePayment.js';

export const CASH_CATEGORIES = ['Opening balance', 'Sales', 'Advance', 'Salary', 'Tea & snacks', 'Transport', 'Owner drawing', 'Deposit to bank', 'Other'];

const MAX_AMOUNT = 1e11;
const LIMITS = { name: 120, note: 500, category: 60 };
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const isIsoDate = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || ''));
  if (!m) return false;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return dt.getMonth() === Number(m[2]) - 1 && dt.getDate() === Number(m[3]);
};

// '' when the entry can be saved, else what to fix, in words for the user.
export function validateCashEntry(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return 'Invalid entry';
  if (e.id !== undefined && (typeof e.id !== 'string' || !e.id.trim())) return 'Invalid entry';
  if (e.type !== 'in' && e.type !== 'out') return 'Choose Money in or Money out';
  const amount = typeof e.amount === 'string' ? Number(e.amount) : e.amount;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || r2(amount) <= 0) return 'Enter an amount more than 0';
  if (amount > MAX_AMOUNT) return 'The amount is too large';
  if (!isIsoDate(e.date)) return 'Enter a date';
  for (const [k, max] of Object.entries(LIMITS)) {
    if (e[k] !== undefined && e[k] !== null && typeof e[k] !== 'string') return 'Invalid entry';
    if (str(e[k]).length > max) return `The ${k} is too long (${max} letters at most)`;
  }
  return '';
}

// The record as stored: only known fields, trimmed, amount to the paisa.
// Call validateCashEntry first.
export function cleanCashEntry(e) {
  return {
    ...(e.id ? { id: e.id } : {}),
    type: e.type,
    date: e.date,
    amount: r2(e.amount),
    name: str(e.name),
    note: str(e.note),
    category: str(e.category),
    ownerGstin: str(e.ownerGstin),
    ownerName: str(e.ownerName),
    createdAt: str(e.createdAt) || new Date().toISOString(),
    ...(e.updatedAt ? { updatedAt: str(e.updatedAt) } : {}),
  };
}

export const isCash = (mode) => String(mode || '').trim().toLowerCase() === 'cash';
const inRupees = (currency) => !currency || currency === 'INR';
const billCurrency = (b) => b?.currency || b?.data?.invoiceOptions?.currency || 'INR';
// As the Dashboard compares them: 'Bank Transfer' on a receipt is 'bank-transfer' on a payment.
const modeKey = (m) => String(m || '').toLowerCase().replace(' ', '-');

// Is receipt r the record of payment p on bill? Strong links first (the
// payment carries the receipt's id or number), then, for older records, the
// same amount, date and mode on a receipt against this invoice.
function linkedTo(r, bill) {
  const ref = r.billId || r.againstInvoice;
  return !!ref && (ref === bill.id || ref === bill.invoiceNumber)
    && belongsToProfile(bill, { gstin: r.ownerGstin, businessName: r.ownerName });
}
const strongMatch = (p, r, bill) => (r.id && p.id === r.id) || (linkedTo(r, bill) && !!r.receiptNo && p.receiptNo === r.receiptNo);
const weakMatch = (p, r, bill) => linkedTo(r, bill)
  && Math.abs((Number(p.amount) || 0) - (Number(r.amount) || 0)) < 0.005
  && p.date === r.date && modeKey(p.mode) === modeKey(r.paymentMode);

// Cash recorded elsewhere, as read-only lines. Pass this business's records.
// `view` is the screen the line was made on (to open it from the cash book).
export function linkedCashLines({ bills = [], receipts = [], expenses = [], purchases = [] } = {}) {
  const paired = new Set(); // receipts that are the record of a payment
  // Pairs a payment with a receipt not yet taken; false when there is none.
  const pair = (match) => ([bill, p]) => {
    const r = receipts.find((x) => !paired.has(x) && match(p, x, bill));
    if (r) paired.add(r);
    return !!r;
  };
  const payments = bills.flatMap((bill) => (bill?.payments || bill?.data?.payments || []).map((p) => [bill, p]));
  const unpaired = payments.filter((x) => !pair(strongMatch)(x)).filter((x) => !pair(weakMatch)(x));
  // A paired payment is shown once, as its receipt (cash or not, as the
  // receipt says). An unpaired cash payment is shown from the invoice.
  const lines = [];
  for (const [bill, p] of unpaired) {
    if (!isCash(p.mode) || !inRupees(billCurrency(bill)) || !(Number(p.amount) > 0)) continue;
    const no = bill.invoiceNumber || bill.id;
    lines.push({
      key: `payment:${bill.id}:${p.id || `${p.date}:${p.amount}`}`,
      source: 'payment', view: 'dashboard', label: `Invoice ${no} payment`,
      // A refund paid on a credit note is money going out.
      type: bill.invoiceType === 'credit-note' ? 'out' : 'in',
      date: p.date || bill.invoiceDate || '', amount: r2(p.amount),
      name: bill.clientName || bill.data?.client?.name || '', note: p.note || '', category: '',
      at: p.recordedAt || '',
    });
  }
  for (const r of receipts) {
    if (!isCash(r.paymentMode) || !inRupees(r.currency) || !(Number(r.amount) > 0)) continue;
    lines.push({
      key: `receipt:${r.id}`,
      source: 'receipt', view: 'receipts',
      label: [`Receipt ${r.receiptNo || ''}`.trim(), r.againstInvoice].filter(Boolean).join(' · '),
      type: 'in', date: r.date || '', amount: r2(r.amount),
      name: r.clientName || '', note: r.note || '', category: '', at: r.recordedAt || '',
    });
  }
  for (const e of expenses) {
    // v1.10.85 (#165) - only what was paid: an Unpaid expense took no cash out.
    const paid = expensePaid(e);
    if (!isCash(e.paymentMode) || !inRupees(e.currency) || !(paid > 0)) continue;
    lines.push({
      key: `expense:${e.id}`,
      source: 'expense', view: 'expenses', label: 'Expense',
      type: 'out', date: e.date || '', amount: r2(paid),
      name: e.vendorName || e.description || '',
      note: [e.vendorName ? e.description : '', e.note].filter(Boolean).join(' · '),
      category: e.category || '', at: '',
    });
  }
  for (const p of purchases) {
    for (const x of (Array.isArray(p?.payments) ? p.payments : [])) {
      if (!isCash(x?.mode) || !(Number(x.amount) > 0)) continue;
      lines.push({
        key: `purchase:${p.id}:${x.id || `${x.date}:${x.amount}`}`,
        source: 'purchase', view: 'purchases', label: `Purchase bill ${p.invoiceNumber || p.id} payment`,
        type: 'out', date: x.date || p.date || '', amount: r2(x.amount),
        name: p.supplierName || '', note: [x.reference, x.note].filter(Boolean).join(' · '),
        category: '', at: x.recordedAt || '',
      });
    }
  }
  return lines;
}

// The user's own entries as lines.
export const ownCashLines = (entries = []) => entries.map((e) => ({
  key: `own:${e.id}`, source: 'own', view: '', label: '',
  type: e.type, date: e.date || '', amount: r2(e.amount),
  name: e.name || '', note: e.note || '', category: e.category || '', at: e.createdAt || '', entry: e,
}));

const signed = (l) => (l.type === 'out' ? -l.amount : l.amount);
// Same day: in the order entered where known, money in before money out otherwise.
const byDate = (a, b) => a.date.localeCompare(b.date) || String(a.at).localeCompare(String(b.at))
  || (a.type === b.type ? 0 : a.type === 'in' ? -1 : 1) || a.key.localeCompare(b.key);

// Money in and out, and the change, of some lines.
export function cashTotals(lines) {
  const tIn = lines.reduce((s, l) => s + (l.type === 'in' ? l.amount : 0), 0);
  const tOut = lines.reduce((s, l) => s + (l.type === 'out' ? l.amount : 0), 0);
  return { in: r2(tIn), out: r2(tOut), net: r2(tIn - tOut) };
}

// The book for a period: the balance brought in, the lines oldest first, each
// with the balance after it, and the balance carried out. `from` / `to` are
// YYYY-MM-DD ('' = no limit). Search narrows the lines shown and their totals;
// each line keeps its true balance, and opening / closing stay the period's.
export function cashBookView(lines, { from = '', to = '', search = '' } = {}) {
  const sorted = [...lines].sort(byDate);
  let bal = 0;
  const withBal = sorted.map((l) => { bal = r2(bal + signed(l)); return { ...l, balance: bal }; });
  const opening = r2(withBal.filter((l) => from && l.date < from).reduce((s, l) => s + signed(l), 0));
  const period = withBal.filter((l) => (!from || l.date >= from) && (!to || l.date <= to));
  const closing = r2(opening + cashTotals(period).net);
  const q = String(search || '').trim().toLowerCase();
  const rows = q
    ? period.filter((l) => [l.name, l.note, l.category, l.label, String(l.amount)].some((v) => String(v || '').toLowerCase().includes(q)))
    : period;
  return { opening, rows, totals: cashTotals(rows), closing };
}

// The cards at the top: cash in hand now, and today's and this month's in / out.
export function cashSummary(lines, today = toLocalIsoDate(new Date())) {
  const month = today.slice(0, 7);
  return {
    inHand: cashTotals(lines.filter((l) => l.date <= today)).net,
    today: cashTotals(lines.filter((l) => l.date === today)),
    month: cashTotals(lines.filter((l) => l.date.slice(0, 7) === month)),
  };
}

// Date filter presets. 'custom' and 'all' leave the dates to the caller.
export function periodRange(kind, today = toLocalIsoDate(new Date())) {
  const [y, m] = today.split('-').map(Number);
  const lastDay = (yy, mm) => new Date(yy, mm, 0).getDate();
  const pad = (n) => String(n).padStart(2, '0');
  if (kind === 'month') return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${lastDay(y, m)}` };
  if (kind === 'lastMonth') {
    const ly = m === 1 ? y - 1 : y, lm = m === 1 ? 12 : m - 1;
    return { from: `${ly}-${pad(lm)}-01`, to: `${ly}-${pad(lm)}-${lastDay(ly, lm)}` };
  }
  if (kind === 'fy') {
    const fy = getFinancialYearStart(new Date(y, m - 1, 1));
    return { from: `${fy}-04-01`, to: `${fy + 1}-03-31` };
  }
  return { from: '', to: '' };
}
