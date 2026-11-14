// v1.10.86 - Settings -> "New invoice starts with": what a brand-new invoice
// starts with. Kept in the invoice defaults (patchInvoiceDefaults) under one
// key, START_KEY; a saved invoice never stores it, and editing or duplicating
// a bill never reads it.
import { INVOICE_TYPES, parseLocalDate, toLocalIsoDate } from '../utils.js';

export const START_KEY = 'newInvoiceStart';
// The last document type picked on New Invoice (this browser).
export const LAST_TYPE_KEY = 'fgsb_lastInvoiceType';
export const DUE_CHOICES = [7, 15, 30];
export const MODE_CHOICES = [['goods', 'Goods'], ['services', 'Services'], ['mixed', 'Goods and services (mixed)']];

export function lastInvoiceType() {
  try { return localStorage.getItem(LAST_TYPE_KEY) || ''; } catch { return ''; }
}
export function rememberInvoiceType(type) {
  try { localStorage.setItem(LAST_TYPE_KEY, type); } catch { /* storage blocked */ }
}

// The type a new invoice opens as: the one chosen in Settings, else the last
// one used, else Tax Invoice. A type that is switched off (Sales Order without
// the feature) is skipped.
export function startTypeFor(start, lastType, allowed = () => true) {
  for (const t of [start?.type, lastType]) {
    if (t && INVOICE_TYPES[t] && allowed(t)) return t;
  }
  return 'tax-invoice';
}

const isSet = (v) => v !== '' && v !== null && v !== undefined;

// Due date: N days after the invoice date (0 = no due date). Not set in
// Settings: a freelancer's invoice is due in 15 days, others have none.
export function startDueDate(invoiceDate, start, businessType) {
  const days = isSet(start?.dueDays)
    ? Math.max(0, Math.floor(Number(start.dueDays)) || 0)
    : (businessType === 'freelancer' ? 15 : 0);
  if (!days) return '';
  const d = parseLocalDate(invoiceDate);
  return toLocalIsoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

// GST % of a new line: the Settings rate when it is one of the rates offered,
// else 18 where offered, else the second-highest rate.
export function startTaxRate(start, rates) {
  if (isSet(start?.taxRate) && rates.includes(Number(start.taxRate))) return Number(start.taxRate);
  return rates.includes(18) ? 18 : (rates[rates.length - 2] ?? 0);
}

// How "Received now" was paid: the Settings choice, else the last one used.
export function startPaidMode(start, last, modes) {
  return modes.some(([v]) => v === start?.paidMode) ? start.paidMode : last;
}

// Options a new invoice starts with: goods / services / mixed (and the unit
// column that goes with it, unless set by hand), and GST on or off for the
// starting type. The saved defaults keep the last invoice's GST switch, so a
// Tax Invoice that starts after a Bill of Supply turns GST back on.
export function startOptionsPatch(opts, type, lastType) {
  const start = opts?.[START_KEY] || {};
  const patch = {};
  if (MODE_CHOICES.some(([v]) => v === start.mode)) {
    patch.invoiceMode = start.mode;
    if (!opts.showItemUnitManual) patch.showItemUnit = start.mode !== 'services';
  }
  if (INVOICE_TYPES[type]?.showGST === false) Object.assign(patch, { showGST: false, showPlaceOfSupply: false });
  else if (lastType && lastType !== type && INVOICE_TYPES[lastType]?.showGST === false) Object.assign(patch, { showGST: true, showPlaceOfSupply: true });
  return patch;
}

// Short words for a folded section's title line, e.g. "Standard (5 lines)".
export function htmlLineCount(html) {
  const text = String(html || '')
    .replace(/<\/(p|div|li|h\d)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ');
  return text.split('\n').filter((l) => l.trim()).length;
}
export function htmlFirstWords(html, max = 40) {
  const text = String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
