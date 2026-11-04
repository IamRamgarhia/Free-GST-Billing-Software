// v1.10.31 — Single WhatsApp URL opener used by Dashboard, ClientsView,
// InvoiceGenerator (share button + payment reminder). Prior to this the
// same 4-line snippet — sanitize phone, encode message, pick wa.me route,
// window.open with noopener — was inlined at every call site. When a bug
// showed up ("share opens in same tab" or "phone with + prefix breaks the
// url") it had to be fixed in every copy. Now: one function, one bug fix
// spot.
//
// v1.10.84 (#156) - the message is now shared too: the three screens sent
// three different texts (the Clients page a bare 4-line one), and users
// asked for the full one everywhere, with the UPI ID.

import { formatCurrency, amountDue, paymentStatusFor, getAccountById, parseLocalDate } from '../utils.js';

const shortDate = (d) => (d
  ? parseLocalDate(String(d).slice(0, 10)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '');

/**
 * The WhatsApp / email text for an invoice: business, client, number and
 * dates, total, paid and balance, status, and the UPI ID while money is due
 * on a rupee invoice. `bill` is a saved bill (or the same shape built from
 * the invoice form); *bold* is WhatsApp markup.
 */
export function invoiceShareMessage(bill, profile) {
  const currency = bill.currency || bill.data?.invoiceOptions?.currency || 'INR';
  const fmt = (n) => formatCurrency(Number(n) || 0, currency);
  const total = Number(bill.totalAmount) || 0;
  const paidFromList = (bill.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const paid = paidFromList > 0 ? paidFromList : (Number(bill.paidAmount) || 0);
  const balance = amountDue(bill) - paid;
  const opts = bill.data?.invoiceOptions || {};
  const account = opts.paymentAccountSnapshot || getAccountById(profile || {}, opts.selectedAccountId);
  const upiId = currency === 'INR' && balance > 0.005 ? (account?.upiId || profile?.upiId || '') : '';
  const dueDate = shortDate(bill.data?.details?.dueDate);

  let paymentLine;
  if (balance < -0.005) paymentLine = `Paid: ${fmt(paid)}  (Overpaid by ${fmt(-balance)})`;
  else if (balance <= 0.005) paymentLine = `Paid: ${fmt(paid)}  ✅ FULLY PAID`;
  else if (paid > 0.005) paymentLine = `Paid: ${fmt(paid)}  ·  *Balance due: ${fmt(balance)}*`;
  else paymentLine = `*Amount due: ${fmt(balance)}*`;

  return [
    profile?.businessName && `*${profile.businessName}*`,
    `Client: ${bill.clientName || ''}`,
    `Invoice: *${bill.invoiceNumber || ''}*`,
    `Date: ${shortDate(bill.invoiceDate)}${dueDate ? `   ·   Due: ${dueDate}` : ''}`,
    `Total: ${fmt(total)}`,
    paymentLine,
    `Status: ${(bill.status || paymentStatusFor(bill, paid)).toUpperCase()}`,
    upiId && `Pay by UPI: ${upiId}`,
  ].filter(Boolean).join('\n');
}

/**
 * Sanitize a phone number for WhatsApp deep-link.
 * WhatsApp requires digits only — no +, spaces, dashes, or parens.
 * Empty / undefined → empty string (caller picks the no-phone URL).
 */
export function sanitizeWhatsAppPhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

/**
 * Open WhatsApp with the given phone (optional) and prefilled message.
 * Opens in a new tab so the user's current invoice / modal / draft state
 * isn't lost — reported as GH #12: "push reminder and whatsapp in new
 * tab not the tab or windows we are working on".
 *
 * @param {string|null|undefined} phone — recipient phone; empty → generic share
 * @param {string} message — plain text (WhatsApp caption); may include *bold*
 * @returns {Window|null} — the new tab handle, or null if blocked
 */
export function openWhatsAppShare(phone, message) {
  const clean = sanitizeWhatsAppPhone(phone);
  const encoded = encodeURIComponent(message || '');
  const waUrl = clean
    ? `https://api.whatsapp.com/send?phone=${clean}&text=${encoded}`
    : `https://api.whatsapp.com/send?text=${encoded}`;
  return window.open(waUrl, '_blank', 'noopener,noreferrer');
}
