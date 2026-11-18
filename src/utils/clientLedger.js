// v1.10.85 (#157, #148) - a client's account: payment history, the latest
// payment on an invoice, the items of an invoice for the statement, the
// client's outstanding against a credit limit, and the WhatsApp / email text
// sent with the Statement and Aging PDFs.
// Pure functions (no fetch / React), so scripts/client-ledger-test.mjs can
// run them in Node.
import { amountDue, paymentStatusFor, salesSign, belongsToProfile, calculateLineItemTax, formatCurrency, isCancelledBill, clientKey, businessKeyOf } from '../utils.js';
import { billInInr, billRate, billCurrency, baseCurrencyOf } from './fx.js';

const PAYMENT_MODES = {
  'bank-transfer': 'Bank Transfer', upi: 'UPI', cash: 'Cash', cheque: 'Cheque', card: 'Card', other: 'Other',
};
export const paymentModeName = (mode) => PAYMENT_MODES[mode] || mode || '';

// v1.10.86 (#202) - one name key everywhere (utils.clientKey): case and
// spaces do not split a client's ledger.
export { clientKey };
const sameName = (a, b) => clientKey(a) === clientKey(b);

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
// v1.10.86 (#214) - the client's receipts that are on no invoice (an
// advance, a payment on their opening balance): not one of the payments on
// their invoices (same id, or same receipt number).
export function onAccountReceipts(clientName, bills, receipts = []) {
  const ids = new Set();
  const receiptNos = new Set();
  for (const b of bills || []) {
    if (!sameName(b.clientName, clientName)) continue;
    for (const p of b.payments || []) {
      if (p.id) ids.add(p.id);
      if (p.receiptNo) receiptNos.add(p.receiptNo);
    }
  }
  return (receipts || []).filter((r) => sameName(r.clientName, clientName) && !ids.has(r.id)
    && !(r.receiptNo && receiptNos.has(r.receiptNo)) && (Number(r.amount) || 0) > 0);
}

export function clientPaymentHistory(clientName, bills, receipts = []) {
  const rows = [];
  for (const b of bills || []) {
    if (!sameName(b.clientName, clientName)) continue;
    for (const p of b.payments || []) {
      if (!isReceived(p)) continue;
      rows.push({
        key: `${b.id}:${p.id || rows.length}`, date: p.date || '', invoiceNumber: b.invoiceNumber || '',
        amount: Number(p.amount) || 0, mode: paymentModeName(p.mode), note: p.note || '',
        currency: b.currency || b.data?.invoiceOptions?.currency || 'INR',
      });
    }
  }
  for (const r of onAccountReceipts(clientName, bills, receipts)) {
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
// An old bill marked Paid with neither counts as paid in full.
const paidOn = (bill) => {
  const fromPayments = (bill.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  if (fromPayments || Number(bill.paidAmount)) return fromPayments || Number(bill.paidAmount);
  return bill.status === 'paid' ? amountDue(bill) : 0;
};
const r2 = (n) => Math.round(n * 100) / 100;

// A client's account with the active business, in its own currency
// (baseCurrencyOf): `owed` - each sale's amount due less what was paid on it,
// less credit notes not yet refunded (a paid or overpaid invoice counts 0);
// `credit` - what they overpaid (as clientCredit.js counts it: payments
// beyond what a bill owes, credit already moved to another bill left out);
// `missing` - the currencies of invoices in another currency with no saved
// exchange rate, which are left out. Quotations, challans and cancelled
// invoices owe nothing. Other businesses' invoices are left out.
// `excludeId`: the invoice being edited, which is counted as "this invoice".
// v1.10.86 (#214) - `opening`: what is left of their opening balance
// (openingDue().due): owed when above 0, their advance (credit) when below.
export function clientAccount(clientName, bills, profile, excludeId = null, opening = 0) {
  const open = Number(opening) || 0;
  const out = { owed: Math.max(0, open), credit: Math.max(0, -open), missing: [] };
  if (!String(clientName || '').trim()) return { ...out, owed: r2(out.owed), credit: r2(out.credit) };
  const base = baseCurrencyOf(profile);
  for (const raw of bills || []) {
    if (raw.id === excludeId || !sameName(raw.clientName, clientName) || !belongsToProfile(raw, profile)) continue;
    const b = billInInr(raw, base);
    if (!b) { if (salesSign(raw)) out.missing.push(billCurrency(raw)); continue; }
    const sign = salesSign(b);
    const owes = sign ? amountDue(b) : 0;
    const cash = (b.payments || []).reduce((s, p) => s + (p.mode === 'credit-applied' ? 0 : Number(p.amount) || 0), 0);
    if (cash - owes > 0.005 && sign >= 0 && !isCancelledBill(b)) out.credit += cash - owes;
    if (!sign) continue;
    const paid = paidOn(b);
    if (paymentStatusFor(b, paid) === 'paid') continue;
    out.owed += sign * Math.max(0, owes - paid);
  }
  return { ...out, owed: r2(out.owed), credit: r2(out.credit) };
}

// What a client owes the active business (clientAccount().owed).
export const clientOutstanding = (clientName, bills, profile, excludeId = null, opening = 0) => clientAccount(clientName, bills, profile, excludeId, opening).owed;

// ---- v1.10.86 (#214) opening balance ----
// What a client owed you (or had paid in advance) when you started with this
// app, on the "as on" date: saved on the client as openingBalance (amount),
// openingBalanceDate (YYYY-MM-DD), openingBalanceType ('receivable', the
// default, or 'advance') and openingBalanceBusiness (the business it is with;
// blank counts in every business).

// The start of the financial year `today` is in (1 April): the "as on" date
// an opening balance gets when none is typed.
export const fyStartDate = (today) => {
  const [y, m] = String(today || '').split('-').map(Number);
  return `${m >= 4 ? y : y - 1}-04-01`;
};

// The client's opening balance with this business: owed to you (+) or their
// advance (-); 0 when none, or when it is with another business.
export function openingOf(client, profile) {
  const amount = r2(Number(client?.openingBalance) || 0);
  if (!(amount > 0)) return 0;
  const biz = client.openingBalanceBusiness;
  if (biz && profile && biz !== businessKeyOf(profile)) return 0;
  return client.openingBalanceType === 'advance' ? -amount : amount;
}

// What is left of it. Money owed is paid off by the client's receipts that
// are on no invoice (Receipts page, Against Invoice left blank), dated on or
// after the "as on" date, oldest money first; never below 0 (more than that
// stays an advance receipt, as before). An advance stays as it is.
// { opening, received, due, date }: due is signed like openingOf.
export function openingDue(client, bills, receipts, profile) {
  const opening = openingOf(client, profile);
  const date = client?.openingBalanceDate || '';
  if (opening <= 0) return { opening, received: 0, due: opening, date };
  const paid = onAccountReceipts(client.name, bills, receipts)
    .filter((r) => (!profile || belongsToProfile(r, profile)) && String(r.date || '') >= date)
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const received = r2(Math.min(opening, paid));
  return { opening, received, due: r2(opening - received), date };
}

// The client form's opening balance as saved: a positive amount with its
// date and kind, or the fields cleared. `businessKey`: the business it is
// with, kept once set.
export function openingFields(form, businessKey = '', today = '') {
  const amount = r2(Number(form?.openingBalance) || 0);
  if (!(amount > 0)) return { openingBalance: '', openingBalanceDate: '', openingBalanceType: '', openingBalanceBusiness: '' };
  return {
    openingBalance: amount,
    openingBalanceDate: /^\d{4}-\d{2}-\d{2}$/.test(String(form.openingBalanceDate || '')) ? form.openingBalanceDate : fyStartDate(today),
    openingBalanceType: form.openingBalanceType === 'advance' ? 'advance' : 'receivable',
    openingBalanceBusiness: form.openingBalanceBusiness || businessKey || '',
  };
}

// "1 invoice in USD without an exchange rate left out" - bills not counted.
export const missingRateNote = (missing) => {
  if (!missing?.length) return '';
  const cur = [...new Set(missing)];
  return `${missing.length} invoice${missing.length === 1 ? '' : 's'} in ${cur.join(' and ')} without an exchange rate left out`;
};

// This invoice as it adds to what the client owes: its amount due (less TDS)
// less what was already paid on it and the client credit being applied, never
// below 0, in the business's currency. { amount, missing } - missing is the
// invoice's currency when it has no exchange rate (it then counts 0).
export function thisInvoiceDue({ totals, currency, exchangeRate, paid = 0, creditApplied = 0 }, profile) {
  const base = baseCurrencyOf(profile);
  const cur = currency || base;
  const rate = billRate({ currency: cur, data: { invoiceOptions: { currency: cur, exchangeRate } } }, base);
  if (!rate) return { amount: 0, missing: cur };
  const due = amountDue({ totalAmount: totals?.total, data: { totals } }) - (Number(paid) || 0) - (Number(creditApplied) || 0);
  return { amount: r2(Math.max(0, due) * rate), missing: '' };
}

// What was paid on a saved invoice towards it: its payments, but not credit
// moved from it to another invoice (credit-transferred-out).
export const paidTowards = (bill) => r2((bill?.payments || [])
  .reduce((s, p) => s + (p.mode === 'credit-transferred-out' ? 0 : Number(p.amount) || 0), 0));

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
  const fmt = (n) => formatCurrency(Number(n) || 0, baseCurrencyOf(profile));
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
  const fmt = (n) => formatCurrency(Number(n) || 0, baseCurrencyOf(profile));
  return [
    profile?.businessName && `*${profile.businessName}*`,
    `Outstanding invoices: ${clientName}`,
    `*Total outstanding: ${fmt(buckets?.total)}*`,
    (Number(buckets?.d90plus) || 0) > 0.005 && `Over 90 days: ${fmt(buckets.d90plus)}`,
    'The ageing report PDF is attached.',
  ].filter(Boolean).join('\n');
}

// v1.10.86 - "Send reminder" on a client's account: a short WhatsApp message
// with what they owe in all and the unpaid invoices, oldest first (five at
// most), saying which are past their due date. `unpaid`: [{ number,
// outstanding, dueDate }]; today is a 'YYYY-MM-DD' date (passed in for tests).
export function balanceReminderMessage(clientName, unpaid, profile, today) {
  const fmt = (n) => formatCurrency(Number(n) || 0, baseCurrencyOf(profile));
  const list = (unpaid || []).filter((u) => Number(u.outstanding) > 0.005);
  const total = r2(list.reduce((s, u) => s + Number(u.outstanding), 0));
  const daysLate = (due) => (due && today ? Math.round((Date.parse(today) - Date.parse(due)) / 86400000) : 0);
  const oldestFirst = [...list].sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));
  return [
    `Hi ${clientName || 'Sir/Madam'}, this is a gentle reminder that a balance of ${fmt(total)} is pending with us:`,
    ...oldestFirst.slice(0, 5).map((u) => {
      const late = daysLate(u.dueDate);
      // v1.10.86 (#214) - the opening balance is no invoice.
      if (u.opening) return `- Opening balance: ${fmt(u.outstanding)}`;
      return `- Invoice ${u.number}: ${fmt(u.outstanding)}${late > 0 ? ` (due ${late} day${late === 1 ? '' : 's'} ago)` : ''}`;
    }),
    list.length > 5 && `- and ${list.length - 5} more`,
    'Kindly arrange the payment at your earliest convenience. Thank you!',
    profile?.businessName && `- ${profile.businessName}`,
  ].filter(Boolean).join('\n');
}
