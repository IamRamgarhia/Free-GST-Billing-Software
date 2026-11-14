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
export function whatsAppUrl(phone, message) {
  const clean = sanitizeWhatsAppPhone(phone);
  const encoded = encodeURIComponent(message || '');
  return clean
    ? `https://api.whatsapp.com/send?phone=${clean}&text=${encoded}`
    : `https://api.whatsapp.com/send?text=${encoded}`;
}

export function openWhatsAppShare(phone, message) {
  return window.open(whatsAppUrl(phone, message), '_blank', 'noopener,noreferrer');
}

// v1.10.86 - every WhatsApp button that has a PDF (invoice screen, Invoices
// list, client account, statement / aging preview, purchase orders).
// - A phone or tablet (the app over the HTTPS phone connection): the Share
//   sheet with the PDF attached, as before.
// - The PC (the app at http://localhost): the server copies the PDF FILE to
//   the clipboard and the chat opens, so the user presses Ctrl+V and Send.
//   The tab is opened at the click, with the steps written in it: opened after
//   the PDF is made, browsers block it as a pop-up.
// - Copy not possible (Linux without xclip, an error): the PDF is downloaded
//   and the chat opened, to drag it in (the old way).
// `prepare` makes the PDF: it returns { blob, fileName, message }, or null to
// stop (e.g. the invoice could not be saved). `toast` is the app's toast
// (passed in so this file still loads in Node for the unit tests).
const pasteKey = () => (/Mac/i.test(globalThis.navigator?.platform || '') ? 'Cmd+V' : 'Ctrl+V');
export const isPcPage = () => globalThis.location?.protocol === 'http:';

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = String(fileName || 'document.pdf').replace(/[\\/:*?"<>|]+/g, '-');
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// 'shared' | 'cancelled' | 'blocked' (too long after the click) | 'no'
async function shareNatively(blob, fileName, message) {
  const nav = globalThis.navigator;
  if (typeof nav?.share !== 'function' || typeof nav.canShare !== 'function') return 'no';
  const file = new File([blob], fileName, { type: 'application/pdf' });
  if (!nav.canShare({ files: [file] })) return 'no';
  try {
    await nav.share({ title: fileName.replace(/\.pdf$/i, ''), text: String(message || ''), files: [file] });
    return 'shared';
  } catch (e) {
    if (e?.name === 'AbortError') return 'cancelled';
    return e?.name === 'NotAllowedError' ? 'blocked' : 'no';
  }
}

export async function copyPdfToClipboard(blob, fileName) {
  try {
    const r = await fetch(`/api/control-panel/copy-pdf?name=${encodeURIComponent(fileName || '')}`, {
      method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: blob,
    });
    return r.ok && (await r.json()).ok === true;
  } catch { return false; }
}

function openWaitingTab() {
  const tab = window.open('', '_blank');
  if (!tab) return null;
  try {
    tab.opener = null;
    tab.document.title = 'Opening WhatsApp...';
    tab.document.body.innerHTML = `<h2>Getting the PDF ready...</h2><p>When the WhatsApp chat opens, press <b>${pasteKey()}</b> in the message box to attach the PDF, then Send.</p>`;
  } catch { /* still usable for the chat */ }
  return tab;
}

export async function sendPdfOnWhatsApp({ phone, prepare, toast = () => {} }) {
  const pc = isPcPage();
  const tab = pc ? openWaitingTab() : null;
  toast('Preparing the PDF...', 'info', 2000);
  let got;
  try { got = await prepare(); } catch { got = undefined; }
  if (!got?.blob) {
    if (tab) tab.close();
    if (got !== null) toast('Could not make the PDF.', 'error');
    return 'failed';
  }
  const { blob, message } = got;
  const fileName = got.fileName || 'document.pdf';
  if (!pc) {
    const r = await shareNatively(blob, fileName, message);
    if (r === 'shared' || r === 'cancelled') return r;
    if (r === 'blocked') {
      toast('The PDF is ready.', 'info', 15000, [{ label: 'Share PDF', onClick: () => shareNatively(blob, fileName, message) }]);
      return 'blocked';
    }
  }
  const copied = pc && await copyPdfToClipboard(blob, fileName);
  if (!copied) downloadBlob(blob, fileName);
  const url = whatsAppUrl(phone, message);
  if (tab) tab.location.href = url;
  else openWhatsAppShare(phone, message);
  const contact = phone ? '' : ' (choose the contact there)';
  // No tab handle: the chat may have been blocked as a pop-up, so it has a button too.
  const again = tab ? null : [{ label: 'Open WhatsApp', onClick: () => openWhatsAppShare(phone, message) }];
  if (copied) toast(`PDF copied. In the WhatsApp chat${contact} press ${pasteKey()}, then Send.`, 'success', 10000, again);
  else toast(`PDF downloaded. Drag it into the WhatsApp chat${contact} - browsers can't attach it for you.`, 'info', 8000, again);
  return copied ? 'copied' : 'downloaded';
}
