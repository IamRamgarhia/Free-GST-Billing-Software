// v1.10.85 (#157, #148) - a client's account: payment history, the latest
// payment on an invoice, the items of an invoice for the statement, the
// client's outstanding against a credit limit, and the WhatsApp / email text
// sent with the Statement and Aging PDFs.
// Pure functions (no fetch / React), so scripts/client-ledger-test.mjs can
// run them in Node.
import { amountDue, paymentStatusFor, salesSign, belongsToProfile, calculateLineItemTax, formatCurrency } from '../utils.js';

const PAYMENT_MODES = {
  'bank-transfer': 'Bank Transfer', upi: 'UPI', cash: 'Cash', cheque: 'Cheque', card: 'Card', other: 'Other',
};
export const paymentModeName = (mode) => PAYMENT_MODES[mode] || mode || '';

const sameName = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// Money actually received. Moving a client's credit from one invoice to
// another (credit-applied / credit-transferred-out) is no new money, so it is
// not listed as a payment.
const isReceived = (p) => (Number(p?.amount) || 0) > 0
  && p.mode !== 'credit-applied' && p.mode !== 'credit-transferred-out';

// Every payment the client made, newest first: the payments recorded on their
// invoices (bill.payments), plus receipts made on the Receipts page that are
// on no invoice (an advance, a deposit). A receipt made against an invoice is
// already one of that invoice's payments (same id, or same receipt number),
// so it is not listed twice.
export function clientPaymentHistory(clientName, bills, receipts = []) {
  const rows = [];
  const ids = new Set();
  const receiptNos = new Set();
  for (const b of bills || []) {
    if (!sameName(b.clientName, clientName)) continue;
    for (const p of b.payments || []) {
      if (p.id) ids.add(p.id);
      if (p.receiptNo) receiptNos.add(p.receiptNo);
      if (!isReceived(p)) continue;
      rows.push({
        key: `${b.id}:${p.id || rows.length}`, date: p.date || '', invoiceNumber: b.invoiceNumber || '',
        amount: Number(p.amount) || 0, mode: paymentModeName(p.mode), note: p.note || '',
        currency: b.currency || b.data?.invoiceOptions?.currency || 'INR',
      });
    }
  }
  for (const r of receipts || []) {
    if (!sameName(r.clientName, clientName) || ids.has(r.id) || (r.receiptNo && receiptNos.has(r.receiptNo))) continue;
    if (!((Number(r.amount) || 0) > 0)) continue;
    rows.push({
      key: `rcp:${r.id || r.receiptNo}`, date: r.date || '', invoiceNumber: r.againstInvoice || '',
      amount: Number(r.amount) || 0, mode: paymentModeName(r.paymentMode), note: r.note || r.referenceNo || '',
      currency: r.currency || 'INR', receiptNo: r.receiptNo || '',
    });
  }
  return rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

// The date of the latest money received on an invoice (YYYY-MM-DD), or ''.
export const latestPaymentDate = (bill) => (bill?.payments || [])
  .filter(isReceived).map((p) => String(p.date || '')).sort().pop() || '';

// What has been paid on a bill: its payments, else the older paidAmount field.
const paidOn = (bill) => {
  const fromPayments = (bill.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  return fromPayments || Number(bill.paidAmount) || 0;
};

// What a client owes the active business: each sale's amount due less what
// was paid on it, less the credit notes not yet refunded. Quotations,
// challans and cancelled invoices count nothing (salesSign 0); a paid or
// overpaid invoice counts 0 (overpayments are the client's credit, used on
// the invoice screen). Other businesses' invoices are left out.
// `excludeId`: the invoice being edited, which is counted as "this invoice".
export function clientOutstanding(clientName, bills, profile, excludeId = null) {
  if (!String(clientName || '').trim()) return 0;
  let total = 0;
  for (const b of bills || []) {
    if (b.id === excludeId || !sameName(b.clientName, clientName) || !belongsToProfile(b, profile)) continue;
    const sign = salesSign(b);
    if (!sign) continue;
    const paid = paidOn(b);
    if (paymentStatusFor(b, paid) === 'paid') continue;
    total += sign * Math.max(0, amountDue(b) - paid);
  }
  return Math.round(total * 100) / 100;
}

// Outstanding plus this invoice against the client's credit limit.
// No limit (blank or 0) never warns.
export function creditLimitCheck(limit, outstanding, thisInvoice = 0) {
  const cap = Number(limit) || 0;
  const after = Math.round(((Number(outstanding) || 0) + (Number(thisInvoice) || 0)) * 100) / 100;
  if (cap <= 0) return { over: false, limit: 0, after, by: 0 };
  return { over: after > cap + 0.005, limit: cap, after, by: Math.round((after - cap) * 100) / 100 };
}

// The saved client an invoice is for: the one picked, else the same name.
export const findSavedClient = (savedClients, id, name) => (savedClients || []).find((c) => id && c.id === id)
  || (String(name || '').trim() ? (savedClients || []).find((c) => sameName(c.name, name)) : undefined);

// #148 item 6 - an invoice's items for the statement: name, quantity, unit
// and the line amount as typed (quantity x rate less the line discount).
export function statementItems(bill) {
  const inclusive = !!bill?.data?.taxInclusive;
  return (bill?.data?.items || [])
    .filter((it) => String(it.name || '').trim())
    .map((it) => {
      const { amount, discount } = calculateLineItemTax(it, inclusive);
      return {
        name: String(it.name).trim(), qty: Number(it.quantity) || 0, unit: it.unit || '',
        amount: Math.round(Math.max(0, amount - discount) * 100) / 100,
      };
    });
}
// "Steel chair x 4 Nos"
export const itemLabel = (it) => `${it.name} x ${it.qty}${it.unit ? ` ${it.unit}` : ''}`;

// The text sent with the Statement PDF (*bold* is WhatsApp markup).
export function statementShareMessage(clientName, stats, profile) {
  const fmt = (n) => formatCurrency(Number(n) || 0, 'INR');
  const due = Number(stats?.unpaid) || 0;
  return [
    profile?.businessName && `*${profile.businessName}*`,
    `Statement of account: ${clientName}`,
    `Total billed: ${fmt(stats?.total)}`,
    `Paid: ${fmt(stats?.paid)}`,
    due > 0.005 ? `*Outstanding: ${fmt(due)}*` : due < -0.005 ? `Advance with us: ${fmt(-due)}` : 'Nothing outstanding',
    'The statement PDF is attached.',
  ].filter(Boolean).join('\n');
}

// The text sent with the Aging PDF.
export function agingShareMessage(clientName, buckets, profile) {
  const fmt = (n) => formatCurrency(Number(n) || 0, 'INR');
  return [
    profile?.businessName && `*${profile.businessName}*`,
    `Outstanding invoices: ${clientName}`,
    `*Total outstanding: ${fmt(buckets?.total)}*`,
    (Number(buckets?.d90plus) || 0) > 0.005 && `Over 90 days: ${fmt(buckets.d90plus)}`,
    'The ageing report PDF is attached.',
  ].filter(Boolean).join('\n');
}
