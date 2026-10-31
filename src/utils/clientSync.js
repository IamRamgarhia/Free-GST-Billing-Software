// Customer details typed on the New Invoice page are written back to the
// customer list on save, so a phone number (or any custom field) added while
// billing does not have to be entered again on the next invoice.
//
// Pure helpers only - the store calls live in InvoiceGenerator.

// The contact fields the invoice form edits. Everything else on a saved
// client (preferred paper size, currency, auto-print, invoice preferences...)
// is kept as it is.
export const CLIENT_FORM_FIELDS = ['name', 'address', 'city', 'pin', 'state', 'gstin', 'country', 'email', 'phone', 'isSEZ'];

// Invoice display options a customer can have saved, so every invoice for
// them comes out the same way. Data on the bill (account snapshot, currency
// rate, recurring setup) is never part of it.
export const CUSTOMER_PREF_KEYS = [
  'pdfStyle', 'accentColor', 'customTitle',
  'showLogo', 'showBusinessName', 'showBusinessAddress', 'showBusinessPhone', 'showBusinessEmail', 'showState', 'showGSTIN',
  'showClientAddress', 'showClientPhone', 'showClientEmail', 'showClientCustomFields', 'showPlaceOfSupply',
  'showInvoiceNumber', 'showInvoiceDate', 'showDueDate',
  'showHSN', 'showItemQty', 'showItemUnit', 'showRateColumn', 'showDiscount', 'showGST', 'showCess',
  'showSubtotal', 'showAmountWords', 'showRoundOff', 'showHsnSummary', 'showTaxInWords',
  'showBankDetails', 'showAccountLabel', 'showUPI', 'showSignature', 'showSignatoryText',
  'showTerms', 'showNotes', 'showSystemGeneratedNote', 'showDeclaration', 'showCustomerSeal',
];

// Custom fields with a label or a value, trimmed. Rows left completely
// blank (an "Add field" click never filled in) are dropped.
export function cleanCustomFields(fields) {
  if (!Array.isArray(fields)) return [];
  return fields
    .map((f) => ({ label: String(f?.label ?? '').trim(), value: String(f?.value ?? '').trim() }))
    .filter((f) => f.label || f.value);
}

// Custom fields that print: both a label and a value.
export function printableCustomFields(fields) {
  return cleanCustomFields(fields).filter((f) => f.label && f.value);
}

const norm = (s) => String(s ?? '').trim().toLowerCase();

// The saved client this invoice is for: the one picked from the list, else
// one with the same name (and the same GSTIN when both have one).
export function findClientMatch(savedClients, invoiceClient, selectedId) {
  const list = Array.isArray(savedClients) ? savedClients : [];
  if (selectedId) {
    const picked = list.find((c) => c.id === selectedId);
    if (picked) return picked;
  }
  const name = norm(invoiceClient?.name);
  if (!name) return null;
  const gstin = norm(invoiceClient?.gstin);
  return list.find((c) => norm(c.name) === name && (!gstin || !norm(c.gstin) || norm(c.gstin) === gstin)) || null;
}

// The record to save for this customer, or null when nothing changed.
// Fields typed on the invoice win; an empty field on the invoice does not
// wipe one already saved (a walk-in invoice that skipped the phone keeps the
// phone on file).
export function mergeClientRecord(existing, invoiceClient) {
  if (!String(invoiceClient?.name ?? '').trim()) return null;
  const base = existing ? { ...existing } : {};
  const next = { ...base };
  for (const key of CLIENT_FORM_FIELDS) {
    if (key === 'isSEZ') { next.isSEZ = !!invoiceClient.isSEZ; continue; }
    const v = String(invoiceClient[key] ?? '').trim();
    if (v || !existing) next[key] = v;
  }
  const typed = cleanCustomFields(invoiceClient.customFields);
  const saved = cleanCustomFields(existing?.customFields);
  // Same label replaces the saved value; new labels are added.
  const merged = saved.map((f) => {
    const hit = typed.find((t) => t.label && norm(t.label) === norm(f.label));
    return hit ? { ...f, value: hit.value || f.value } : f;
  });
  for (const t of typed) {
    if (!t.label || !merged.some((f) => norm(f.label) === norm(t.label))) merged.push(t);
  }
  next.customFields = merged;
  if (!existing) return next;
  const changed = CLIENT_FORM_FIELDS.some((k) => (k === 'isSEZ' ? !!base.isSEZ !== next.isSEZ : String(base[k] ?? '') !== String(next[k] ?? '')))
    || JSON.stringify(cleanCustomFields(base.customFields)) !== JSON.stringify(merged);
  return changed ? next : null;
}

// Pull the customer's saved display preferences out of invoice options.
export function pickCustomerPrefs(options) {
  const out = {};
  for (const k of CUSTOMER_PREF_KEYS) if (options && options[k] !== undefined) out[k] = options[k];
  return out;
}
