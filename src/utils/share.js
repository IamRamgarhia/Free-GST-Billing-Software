// v1.10.31 — Single WhatsApp URL opener used by Dashboard, ClientsView,
// InvoiceGenerator (share button + payment reminder). Prior to this the
// same 4-line snippet — sanitize phone, encode message, pick wa.me route,
// window.open with noopener — was inlined at every call site. When a bug
// showed up ("share opens in same tab" or "phone with + prefix breaks the
// url") it had to be fixed in every copy. Now: one function, one bug fix
// spot.
//
// Kept intentionally narrow: only the URL open. Caller composes the
// message because those legitimately differ (Dashboard has rich
// payment-status caption, ClientsView has a minimal blurb, invoice-form
// has totals). Attempting to unify the message text would collapse three
// UX-tuned strings into one lowest-common-denominator string.

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
