/*
 * v1.10.83 (#123) - payments to suppliers on a purchase bill.
 *
 * Asked for: "vendor payment entry, how to enter for purchase invoice". A bill
 * keeps purchase.payments[] ({ id, amount, date, mode, reference, note,
 * recordedAt, auto? }), like sales invoices keep bill.payments[].
 *
 * What is owed is the bill total less the TDS you keep back ("Paid to
 * supplier"). The status follows the payments: Paid, Partial (shown as "Partly
 * paid") or Unpaid. A bill saved before this, with no payments, keeps the
 * status it was given, so an old bill marked Paid stays Paid.
 *
 * "Mark as paid" records one payment for the balance (mode Other, auto: true),
 * as invoices do; Unpaid takes that payment back and keeps the ones you
 * entered. Mode Other keeps it out of the cash book: how it was paid is unknown.
 *
 * Pure: no React, no storage, so the server checks with the same rules.
 */
import { purchaseTotals } from './purchaseOrders.js';

export const PURCHASE_PAYMENT_MODES = [
  ['cash', 'Cash'], ['upi', 'UPI'], ['bank-transfer', 'Bank transfer'],
  ['cheque', 'Cheque'], ['card', 'Card'], ['other', 'Other'],
];
export const purchasePaymentModeName = (mode) => (PURCHASE_PAYMENT_MODES.find(([v]) => v === mode) || [])[1] || mode || '';
export const PURCHASE_STATUS_LABEL = { Paid: 'Paid', Partial: 'Partly paid', Unpaid: 'Unpaid' };

const MAX_AMOUNT = 1e11;
const LIMITS = { reference: 60, note: 300 };
// More than the balance by this much is refused (a rupee of rounding is fine).
export const OVERPAY_SLACK = 1;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const isIsoDate = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || ''));
  if (!m) return false;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return dt.getMonth() === Number(m[2]) - 1 && dt.getDate() === Number(m[3]);
};

const paymentsOf = (p) => (Array.isArray(p?.payments) ? p.payments : []);
export const hasPurchasePayments = (p) => paymentsOf(p).length > 0;

// The bill total, as the purchase list works it out.
export function purchaseTotal(p) {
  if (Array.isArray(p?.items) && p.items.length) return r2(purchaseTotals(p.items, !!p.applyRoundOff).finalTotal);
  return r2(p?.totalAmount);
}
// What the supplier is to be paid: the total less TDS you keep back.
export function purchaseOwed(p) {
  const total = purchaseTotal(p);
  const tds = Math.min(Math.max(0, Number(p?.tdsAmount) || 0), Math.max(0, total));
  return r2(total - tds);
}
export const purchasePaid = (p) => r2(paymentsOf(p).reduce((s, x) => s + (Number(x?.amount) || 0), 0));

// v1.10.85 (#168) - goods sent back on debit notes are not paid for: what
// the debit notes against a bill take off it (set in memory by withReturns in
// utils/debitNotes.js; never saved). Payments are still checked against the
// whole bill (validatePurchasePayments), since a bill paid in full before the
// return stays paid and the supplier owes you the refund.
const returnedOn = (p) => Math.max(0, Number(p?._returned) || 0);

// 'Paid' | 'Partial' | 'Unpaid'.
export function purchaseStatus(p) {
  const returned = returnedOn(p);
  if (!hasPurchasePayments(p)) {
    if (returned > 0.005 && returned >= purchaseOwed(p) - 0.005) return 'Paid';
    return ['Paid', 'Partial'].includes(p?.paymentStatus) ? p.paymentStatus : 'Unpaid';
  }
  const paid = purchasePaid(p);
  if (paid + returned >= purchaseOwed(p) - 0.005) return 'Paid';
  return paid > 0.005 ? 'Partial' : 'Unpaid';
}

// Still to pay, for the list and reports. An old bill marked Paid owes nothing.
export function purchaseBalance(p) {
  if (!hasPurchasePayments(p) && purchaseStatus(p) === 'Paid') return 0;
  return Math.max(0, r2(purchaseOwed(p) - purchasePaid(p) - returnedOn(p)));
}
// Still to pay going by the payments (and returns): the amount a new payment starts at.
export const purchasePaymentDue = (p) => Math.max(0, r2(purchaseOwed(p) - purchasePaid(p) - returnedOn(p)));

// '' when a payment can be saved, else what to fix, in words for the user.
export function validatePurchasePayment(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return 'Invalid payment';
  const amount = typeof x.amount === 'string' ? Number(x.amount) : x.amount;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || r2(amount) <= 0) return 'Enter an amount more than 0';
  if (amount > MAX_AMOUNT) return 'The amount is too large';
  if (!isIsoDate(x.date)) return 'Enter the payment date';
  for (const [k, max] of Object.entries({ ...LIMITS, mode: 30, id: 80 })) {
    if (x[k] !== undefined && x[k] !== null && typeof x[k] !== 'string') return 'Invalid payment';
    if (String(x[k] || '').length > max) return `The ${k === 'reference' ? 'reference / cheque no.' : k} is too long (${max} letters at most)`;
  }
  return '';
}

// '' when a bill's payments can be saved (none at all is fine).
export function validatePurchasePayments(p) {
  if (p?.payments === undefined || p?.payments === null) return '';
  if (!Array.isArray(p.payments)) return 'Invalid payments';
  for (const x of p.payments) {
    const problem = validatePurchasePayment(x);
    if (problem) return problem;
  }
  const paid = purchasePaid(p), owed = purchaseOwed(p);
  if (paid > owed + OVERPAY_SLACK) return `Payments of ${paid.toFixed(2)} are more than the ${owed.toFixed(2)} this bill comes to`;
  return '';
}

// The bill with these payments, its paid amount and its status.
export function withPurchasePayments(p, payments) {
  const next = { ...p, payments };
  return { ...next, paidAmount: purchasePaid(next), paymentStatus: payments.length ? purchaseStatus(next) : 'Unpaid' };
}

export const newPurchasePaymentId = (now = Date.now()) => `ppay_${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// "Mark as paid": one payment for what is still owed.
// v1.10.85 (#184) - mode: how it was paid (askPaidMode); a cash one reaches the Cash book.
export function markPurchasePaid(p, today, now = new Date(), mode = 'other') {
  const payments = paymentsOf(p);
  const due = purchasePaymentDue(p);
  if (due <= 0.005) return payments.length ? withPurchasePayments(p, payments) : { ...p, paymentStatus: 'Paid' };
  return withPurchasePayments(p, [...payments, {
    id: newPurchasePaymentId(now.getTime()), amount: due, date: today, mode: mode || 'other',
    reference: '', note: 'Marked paid', recordedAt: now.toISOString(), auto: true,
  }]);
}
// "Unpaid": takes back the Mark as paid payment; payments you entered stay.
export const markPurchaseUnpaid = (p) => withPurchasePayments(p, paymentsOf(p).filter((x) => !x?.auto));
