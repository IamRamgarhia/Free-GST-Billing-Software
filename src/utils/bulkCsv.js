// v1.10.80 (#101) - bulk CSV import / export of sales invoices and purchase
// bills. Requested: "please consider adding a bulk csv import/export feature
// both sales and purchases."
//
// One row per item line; rows with the same invoice number (and, for
// purchases, the same supplier) make one bill. Column names are matched
// loosely (case, spaces, _ and - ignored, a few common aliases). The export
// writes exactly the columns the import reads, so a file can be exported,
// edited in a spreadsheet and imported again.
//
// Pure functions only (no fetch / React), so scripts/csv-test.mjs can test them.
import { excelSerialToIso } from './xlsxRead.js';
import {
  computeInvoiceTotals, stockEffect, toCsvLine, INVOICE_TYPES, getStateCode,
  stateNameForCode, resolveLineDiscount,
} from '../utils.js';

// ---------------------------------------------------------------- parsing --

// RFC 4180 CSV: quoted fields, "" inside quotes, commas and line breaks
// inside quotes, CRLF or LF, and Excel's byte-order mark.
export function parseCsv(text) {
  const s = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

const norm = (h) => String(h || '').toLowerCase().replace(/[\s_\-.%()/#*]+/g, '');

// Rows as objects keyed by canonical field name. `fields` maps each canonical
// name to the accepted header spellings, the preferred one first.
// v1.10.84 (#130) - `input` is CSV text or rows already read (an .xlsx sheet).
// The header is the row, among the first 8, that names the most columns:
// Vyapar puts the business and report name above it. A closing "Total" row is
// not data. When two columns fit (Vyapar has "Tax Percent" and "Tax"), the
// spelling listed first wins.
export function rowsToRecords(input, fields) {
  const table = (Array.isArray(input) ? input : parseCsv(input))
    .map((r) => (Array.isArray(r) ? r : []))
    .filter((r) => r.some((c) => String(c ?? '').trim() !== ''));
  if (table.length < 2) return { records: [], missing: [], unknown: [] };
  const wanted = new Set(Object.values(fields).flat().map(norm));
  let at = 0;
  let best = 0;
  table.slice(0, 8).forEach((r, i) => {
    const hits = r.filter((h) => wanted.has(norm(h))).length;
    if (hits > best) { best = hits; at = i; }
  });
  const header = table[at].map(norm);
  const colOf = {};
  for (const [field, aliases] of Object.entries(fields)) {
    for (const a of aliases) {
      const idx = header.indexOf(norm(a));
      if (idx >= 0 && !Object.values(colOf).includes(idx)) { colOf[field] = idx; break; }
    }
  }
  const known = new Set(Object.values(colOf));
  const unknown = table[at].filter((_, i) => !known.has(i) && String(table[at][i]).trim());
  const records = table.slice(at + 1)
    .filter((r) => norm(r.find((c) => String(c ?? '').trim() !== '')) !== 'total')
    .map((r) => {
      const rec = { _line: table.indexOf(r) + 1 };
      for (const [field, idx] of Object.entries(colOf)) rec[field] = String(r[idx] ?? '').trim();
      return rec;
    });
  return { records, colOf, unknown };
}

// "1,234.50", "₹ 99", "(12)" -> numbers; '' -> fallback.
export const toNum = (v, fallback = 0) => {
  const s = String(v ?? '').replace(/[₹,\s]/g, '').replace(/^Rs\.?/i, '');
  if (s === '') return fallback;
  const n = Number(/^\(.*\)$/.test(s) ? `-${s.slice(1, -1)}` : s);
  return Number.isFinite(n) ? n : NaN;
};

// YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY, DD-Mon-YYYY -> YYYY-MM-DD.
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
export function toIsoDate(v) {
  const s = String(v || '').trim();
  // An Excel date cell read from an .xlsx is its day number (#130).
  if (/^\d{5}(\.\d+)?$/.test(s) && Number(s) >= 20000 && Number(s) < 80000) return excelSerialToIso(s);
  let y; let m; let d;
  let mt = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (mt) [, y, m, d] = mt.map(Number);
  else if ((mt = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(s))) { [, d, m, y] = mt.map(Number); if (y < 100) y += 2000; }
  else if ((mt = /^(\d{1,2})[-\s]([A-Za-z]{3,4})[-\s,]*(\d{2,4})$/.exec(s))) {
    d = Number(mt[1]); m = MON[mt[2].toLowerCase()]; y = Number(mt[3]); if (y < 100) y += 2000;
  } else return '';
  const dt = new Date(y, (m || 0) - 1, d);
  if (!m || dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return '';
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// 10/01/2026 is 10 January day first and 1 October month first, and nothing
// in the date says which. Day first is the rule here (India's way). A file that
// is clearly month first (some date like 10/25/2026, as US Excel writes) is
// refused as a whole, since its other dates would be read wrongly without an
// error; a file whose dates could be either gets a warning to check one.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function dateOrderNote(values) {
  let dayFirst = false; let monthFirst = false; let example = '';
  for (const v of values || []) {
    const m = /^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}$/.exec(String(v || '').trim());
    if (!m) continue;
    const a = Number(m[1]); const b = Number(m[2]);
    if (a > 12) dayFirst = true;
    else if (b > 12) monthFirst = true;
    else if (a !== b && !example) example = String(v).trim();
  }
  if (monthFirst && !dayFirst) {
    return { error: 'The dates are month first (MM/DD/YYYY, as US Excel writes them). Change the date columns to DD-MM-YYYY or YYYY-MM-DD and choose the file again.' };
  }
  if (example && !dayFirst) {
    const [y, mo, d] = toIsoDate(example).split('-').map(Number);
    return { warning: `Dates are read day first: ${example} is ${d} ${MONTHS[mo - 1]} ${y}. If your file puts the month first, change the dates to DD-MM-YYYY before importing.` };
  }
  return {};
}

const yes = (v) => /^(y|yes|true|1|inter|interstate|igst)$/i.test(String(v || '').trim());
// A state given as a name, a 2-digit code or a GSTIN -> the State dropdown's spelling.
const stateName = (v) => {
  const s = String(v || '').trim();
  if (!s) return '';
  const code = /^\d{1,2}$/.test(s) ? s.padStart(2, '0') : getStateCode(s);
  return stateNameForCode(code) || s;
};
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Type label or prefix -> invoice type key (tax-invoice when blank).
const TYPE_ALIASES = Object.fromEntries(Object.entries(INVOICE_TYPES).flatMap(([key, t]) => [
  [norm(key), key], [norm(t.label), key], [norm(t.prefix), key], [norm(t.title), key],
]));
TYPE_ALIASES[norm('invoice')] = 'tax-invoice';
TYPE_ALIASES[norm('estimate')] = 'proforma';
// Vyapar's "Transaction Type" (#130).
TYPE_ALIASES[norm('sale')] = 'tax-invoice';
const CANCELLED = /cancel/i;
const typeOf = (v) => (String(v || '').trim() ? TYPE_ALIASES[norm(v)] || null : 'tax-invoice');

// ------------------------------------------------------------------ sales --

export const SALES_COLUMNS = [
  'Invoice Number', 'Invoice Date', 'Invoice Type', 'Due Date',
  'Client Name', 'Client GSTIN', 'Client State', 'Client Address', 'Client Country', 'Place of Supply',
  'Item Name', 'HSN/SAC', 'Quantity', 'Unit', 'Rate', 'Discount', 'GST %', 'Cess %', 'Prices Include Tax', 'Notes',
  // Per invoice (read from its first row), so an export re-imports to the same total.
  'Bill Discount', 'Round Off',
];
const SALES_FIELDS = {
  invoiceNumber: ['Invoice Number', 'Invoice No', 'Inv No', 'Bill No', 'Number', 'Invoice No./Txn No.'],
  invoiceDate: ['Invoice Date', 'Date', 'Bill Date'],
  invoiceType: ['Invoice Type', 'Type', 'Document Type', 'Transaction Type'],
  dueDate: ['Due Date', 'Due'],
  clientName: ['Client Name', 'Client', 'Customer', 'Customer Name', 'Party', 'Party Name', 'Buyer'],
  clientGstin: ['Client GSTIN', 'GSTIN', 'Customer GSTIN', 'Party GSTIN', 'Buyer GSTIN'],
  clientState: ['Client State', 'State', 'Customer State'],
  clientAddress: ['Client Address', 'Address'],
  clientCountry: ['Client Country', 'Country'],
  placeOfSupply: ['Place of Supply', 'POS'],
  itemName: ['Item Name', 'Item', 'Product', 'Description', 'Particulars'],
  hsn: ['HSN/SAC', 'HSN', 'SAC', 'HSN Code'],
  quantity: ['Quantity', 'Qty'],
  unit: ['Unit', 'UOM', 'UQC'],
  rate: ['Rate', 'Price', 'Unit Price', 'UnitPrice', 'Price/Unit', 'Price per Unit'],
  discount: ['Discount', 'Discount Amount'],
  taxPercent: ['GST Rate', 'Tax Rate', 'Tax Percent', 'GST %', 'Tax %', 'GST', 'Tax'],
  cessPercent: ['Cess %', 'Cess', 'Cess Rate'],
  taxInclusive: ['Prices Include Tax', 'Tax Inclusive', 'Inclusive'],
  notes: ['Notes', 'Note', 'Remarks'],
  billDiscount: ['Bill Discount', 'Invoice Discount'],
  roundOff: ['Round Off', 'Round-off', 'Rounding'],
};

/**
 * CSV text -> sales bills ready for saveBill, built the way the invoice screen
 * builds them (computeInvoiceTotals, data.profile, stock record).
 * opts: { profile, products, adjustStock, existingIds:Set, makeId? }
 * Returns { bills, errors: [string], skipped: [invoiceNumber], newClients: [client] }.
 */
export function salesCsvToBills(text, { profile = {}, products = [], adjustStock = false, existingIds = new Set(), clients = [], received = null } = {}) {
  const all = rowsToRecords(text, SALES_FIELDS).records;
  // Vyapar lists cancelled sales too ("Sale[Cancelled]"): they are not imported.
  const records = all.filter((r) => !CANCELLED.test(r.invoiceType || ''));
  const cancelled = new Set(all.filter((r) => CANCELLED.test(r.invoiceType || '')).map((r) => r.invoiceNumber)).size;
  const errors = [];
  if (!records.length) return { bills: [], errors: ['The file has no rows under the header.'], skipped: [], newClients: [], warnings: [] };
  const order = dateOrderNote(records.flatMap((r) => [r.invoiceDate, r.dueDate]));
  if (order.error) return { bills: [], errors: [order.error], skipped: [], newClients: [], warnings: [] };
  const groups = new Map();
  for (const r of records) {
    if (!r.invoiceNumber) { errors.push(`Row ${r._line}: no invoice number.`); continue; }
    if (!groups.has(r.invoiceNumber)) groups.set(r.invoiceNumber, []);
    groups.get(r.invoiceNumber).push(r);
  }
  const productByName = new Map((products || []).map((p) => [String(p.name || '').trim().toLowerCase(), p]));
  const knownClients = new Map((clients || []).map((c) => [String(c.name || '').trim().toLowerCase(), c]));
  const clientByGstin = new Map((clients || []).filter((c) => String(c.gstin || '').trim()).map((c) => [String(c.gstin).trim().toUpperCase(), c]));
  const newClientByGstin = new Map();
  const bills = [];
  const skipped = [];
  const newClients = new Map();
  for (const [invoiceNumber, rows] of groups) {
    const head = rows[0];
    const fail = (msg) => errors.push(`Invoice ${invoiceNumber}: ${msg}`);
    if (existingIds.has(invoiceNumber)) { skipped.push(invoiceNumber); continue; }
    const invoiceDate = toIsoDate(head.invoiceDate);
    if (!invoiceDate) { fail(`date "${head.invoiceDate || ''}" is not a date (use YYYY-MM-DD or DD-MM-YYYY).`); continue; }
    const invoiceType = typeOf(head.invoiceType);
    if (!invoiceType) { fail(`unknown invoice type "${head.invoiceType}".`); continue; }
    if (!head.clientName) { fail('no client name.'); continue; }
    // Rows are grouped by number, so two different invoices sharing a number
    // (numbering restarted each year, e.g. a Tally export) would merge into
    // one bill under the first row's client and date. Refuse instead.
    const sameName = (s) => String(s || '').trim().toLowerCase() === head.clientName.trim().toLowerCase();
    const clash = rows.find((r) => (r.invoiceDate && toIsoDate(r.invoiceDate) !== invoiceDate) || (r.clientName && !sameName(r.clientName)));
    if (clash) { fail(`row ${clash._line} has a different date or client than row ${head._line}. Two invoices can't share a number: give one of them its own number.`); continue; }
    const dueDate = head.dueDate ? toIsoDate(head.dueDate) : '';
    if (head.dueDate && !dueDate) { fail(`due date "${head.dueDate}" is not a date.`); continue; }

    const items = [];
    let bad = false;
    rows.forEach((r, i) => {
      const quantity = toNum(r.quantity, 1);
      const rate = toNum(r.rate, NaN);
      const discount = toNum(amountPart(r.discount), 0);
      const taxPercent = toNum(percentPart(r.taxPercent), 0);
      const cessPercent = toNum(r.cessPercent, 0);
      if (!r.itemName) { fail(`row ${r._line} has no item name.`); bad = true; return; }
      for (const [label, v] of [['quantity', quantity], ['rate', rate], ['discount', discount], ['GST %', taxPercent], ['cess %', cessPercent]]) {
        if (!Number.isFinite(v) || v < 0) { fail(`row ${r._line}: ${label} must be a number, 0 or more.`); bad = true; return; }
      }
      if (taxPercent > 100) { fail(`row ${r._line}: GST % over 100.`); bad = true; return; }
      const product = productByName.get(r.itemName.trim().toLowerCase());
      items.push({
        id: `imp-${i + 1}`, name: r.itemName, description: '', hsn: r.hsn || product?.hsn || '',
        quantity, unit: r.unit || product?.unit || 'Nos', rate, discount, discountType: 'fixed',
        taxPercent, cessPercent,
        // Linked to the product only when stock is to follow these bills.
        ...(adjustStock && product ? { productId: product.id } : {}),
      });
    });
    if (bad) continue;

    const typeCfg = INVOICE_TYPES[invoiceType];
    const showGST = typeCfg.showGST;
    const taxInclusive = showGST && yes(head.taxInclusive);
    // #132: a GSTIN already known is that client, even under a mistyped name;
    // the invoice takes the saved (or first) name, so no duplicate is made.
    const rowGstin = String(head.clientGstin || '').trim().toUpperCase();
    const byGstin = rowGstin ? (clientByGstin.get(rowGstin) || newClientByGstin.get(rowGstin)) : null;
    const saved = byGstin || knownClients.get(head.clientName.trim().toLowerCase());
    const client = {
      ...(saved || {}),
      name: byGstin ? byGstin.name : head.clientName,
      gstin: (head.clientGstin || saved?.gstin || '').toUpperCase(),
      state: stateName(head.clientState) || saved?.state || stateName((head.clientGstin || '').slice(0, 2)),
      address: head.clientAddress || saved?.address || '',
      country: head.clientCountry || saved?.country || '',
    };
    if (!saved && !newClients.has(client.name.toLowerCase())) {
      const added = { name: client.name, gstin: client.gstin, state: client.state, address: client.address, country: client.country };
      newClients.set(client.name.toLowerCase(), added);
      if (rowGstin) newClientByGstin.set(rowGstin, added);
    }
    const details = { invoiceNumber, invoiceDate, dueDate, placeOfSupply: stateName(head.placeOfSupply) };
    const billDiscount = toNum(head.billDiscount, 0);
    if (!Number.isFinite(billDiscount) || billDiscount < 0) { fail('Bill Discount must be a number, 0 or more.'); continue; }
    const invoiceOptions = {
      showGST, showPlaceOfSupply: showGST, currency: 'INR', showRoundOff: yes(head.roundOff),
      ...(billDiscount > 0 ? { invoiceDiscountType: 'fixed', invoiceDiscountValue: billDiscount } : {}),
    };
    const totals = computeInvoiceTotals({ items, profile, client, details, showGST, taxInclusive, invoiceOptions });
    bills.push({
      id: invoiceNumber,
      clientName: client.name,
      invoiceNumber,
      invoiceDate,
      invoiceType,
      currency: 'INR',
      totalAmount: totals.total,
      totalTaxAmount: totals.totalTaxAmount,
      ...paidPart(received?.get(invoiceNumber), totals.total, invoiceDate),
      importedAt: new Date().toISOString(),
      data: {
        profile, client, details, items, totals, invoiceType,
        customTerms: '', customNotes: head.notes || '', extraSections: [], invoiceOptions, taxInclusive,
        stockApplied: stockEffect(items, invoiceType, 'unpaid'),
      },
    });
  }
  const warnings = order.warning ? [order.warning] : [];
  if (cancelled) warnings.push(`${cancelled} cancelled invoice${cancelled === 1 ? ' was' : 's were'} left out.`);
  return { bills, errors, skipped, newClients: [...newClients.values()], warnings };
}

// v1.10.84 (#130) - Vyapar writes "297.16 (18.0%)" (tax and its rate) and
// "888.94 (35.0%)" (a discount and its rate) in one cell; also "GST@18%".
export const percentPart = (v) => {
  const m = /([\d.]+)\s*%/.exec(String(v ?? ''));
  return m ? m[1] : v;
};
export const amountPart = (v) => String(v ?? '').replace(/\s*\([^)]*\)\s*$/, '');

// What a sales report says was received, by invoice number: Vyapar's "Sale
// Report" sheet ("Received Amount" or "Received/Paid Amount").
export function receivedByInvoice(input) {
  const { records } = rowsToRecords(input, {
    invoiceNumber: SALES_FIELDS.invoiceNumber,
    received: ['Received Amount', 'Received/Paid Amount', 'Received', 'Amount Received', 'Paid Amount'],
  });
  const map = new Map();
  for (const r of records) {
    const n = toNum(r.received, NaN);
    if (r.invoiceNumber && Number.isFinite(n) && n > 0) map.set(r.invoiceNumber, (map.get(r.invoiceNumber) || 0) + n);
  }
  return map;
}

// Status and one payment for what was received (never more than the total).
const paidPart = (got, total, date) => {
  const amount = r2(Math.min(Number(got) || 0, Number(total) || 0));
  if (amount <= 0.005) return { status: 'unpaid', paidAmount: 0, payments: [] };
  return {
    status: amount >= (Number(total) || 0) - 0.005 ? 'paid' : 'partial',
    paidAmount: amount,
    payments: [{ id: `pay_imp_${date}_${Math.random().toString(36).slice(2, 8)}`, amount, date, mode: 'other', note: 'Imported' }],
  };
};

// Bills -> CSV in the import's own columns (one row per item).
export function billsToSalesCsv(bills) {
  const lines = [toCsvLine(SALES_COLUMNS)];
  for (const b of bills || []) {
    const d = b.data || {};
    const c = d.client || {};
    const type = b.invoiceType || d.invoiceType || 'tax-invoice';
    const showGST = typeof d.invoiceOptions?.showGST === 'boolean' ? d.invoiceOptions.showGST : INVOICE_TYPES[type]?.showGST !== false;
    for (const it of d.items || []) {
      lines.push(toCsvLine([
        b.invoiceNumber, b.invoiceDate, INVOICE_TYPES[type]?.label || '',
        d.details?.dueDate || '', c.name || b.clientName || '', c.gstin || '', c.state || '', c.address || '', c.country || '',
        d.details?.placeOfSupply || '', it.name || '', it.hsn || '', Number(it.quantity) || 0, it.unit || '',
        Number(it.rate) || 0,
        // The discount as the amount it came to, so a percent or per-unit
        // discount re-imports as the same rupees off the line.
        r2(resolveLineDiscount(it, !showGST || !!d.taxInclusive)),
        Number(it.taxPercent) || 0, Number(it.cessPercent) || 0, d.taxInclusive ? 'Yes' : 'No', d.customNotes || '',
        r2(d.totals?.invoiceDiscountAmount) || '', Number(d.totals?.roundOff) ? 'Yes' : 'No',
      ]));
    }
  }
  return lines.join('\n');
}

// -------------------------------------------------------------- purchases --

export const PURCHASE_COLUMNS = [
  'Invoice Number', 'Invoice Date', 'Supplier Name', 'Supplier GSTIN', 'Supplier Address',
  'Item Name', 'HSN/SAC', 'Quantity', 'Rate', 'GST %', 'Cess %', 'Inter-state', 'Payment Status', 'Note',
];
const PURCHASE_FIELDS = {
  invoiceNumber: ['Invoice Number', 'Invoice No', 'Bill No', 'Bill Number', 'Number', 'Supplier Invoice No'],
  date: ['Invoice Date', 'Date', 'Bill Date'],
  supplierName: ['Supplier Name', 'Supplier', 'Vendor', 'Vendor Name', 'Party', 'Party Name'],
  supplierGstin: ['Supplier GSTIN', 'GSTIN', 'Vendor GSTIN', 'Party GSTIN'],
  supplierAddress: ['Supplier Address', 'Address'],
  itemName: ['Item Name', 'Item', 'Product', 'Description', 'Particulars'],
  hsn: ['HSN/SAC', 'HSN', 'SAC', 'HSN Code'],
  quantity: ['Quantity', 'Qty'],
  rate: ['Rate', 'Price', 'Unit Price', 'UnitPrice', 'Price/Unit', 'Price per Unit'],
  taxPercent: ['GST Rate', 'Tax Rate', 'Tax Percent', 'GST %', 'Tax %', 'GST', 'Tax'],
  cessPercent: ['Cess %', 'Cess', 'Cess Rate'],
  interstate: ['Inter-state', 'Interstate', 'IGST', 'Inter State'],
  paymentStatus: ['Payment Status', 'Status', 'Paid'],
  note: ['Note', 'Notes', 'Remarks'],
};
const PAYMENT_STATUSES = ['Unpaid', 'Partial', 'Paid'];

/**
 * CSV text -> purchase records ready for savePurchase.
 * opts: { profile, existing: [purchases] } - a bill already booked (same
 * supplier GSTIN or name, same invoice number) is skipped.
 * `inferInterstate(gstin)` (optional) fills Inter-state when the column is blank.
 */
export function purchaseCsvToRecords(text, { profile = {}, existing = [], inferInterstate = null } = {}) {
  const { records } = rowsToRecords(text, PURCHASE_FIELDS);
  const errors = [];
  if (!records.length) return { purchases: [], errors: ['The file has no rows under the header.'], skipped: [], warnings: [] };
  const order = dateOrderNote(records.map((r) => r.date));
  if (order.error) return { purchases: [], errors: [order.error], skipped: [], warnings: [] };
  const keyOf = (gstin, name, num) => `${(gstin || name || '').trim().toUpperCase()}::${String(num || '').trim().toUpperCase()}`;
  // A booked bill is found by GSTIN or by supplier name, so a CSV row that
  // leaves out the GSTIN still matches a bill saved with one.
  const booked = new Set((existing || []).flatMap((p) => [
    p.supplierGstin && keyOf(p.supplierGstin, '', p.invoiceNumber),
    p.supplierName && keyOf('', p.supplierName, p.invoiceNumber),
  ].filter(Boolean)));
  const isBooked = (r) => (r.supplierGstin && booked.has(keyOf(r.supplierGstin, '', r.invoiceNumber)))
    || (r.supplierName && booked.has(keyOf('', r.supplierName, r.invoiceNumber)));
  const groups = new Map();
  for (const r of records) {
    if (!r.invoiceNumber) { errors.push(`Row ${r._line}: no invoice number.`); continue; }
    if (!r.supplierName && !r.supplierGstin) { errors.push(`Row ${r._line}: no supplier name or GSTIN.`); continue; }
    const key = keyOf(r.supplierGstin, r.supplierName, r.invoiceNumber);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const purchases = [];
  const skipped = [];
  for (const rows of groups.values()) {
    const head = rows[0];
    const label = `${head.supplierName || head.supplierGstin} ${head.invoiceNumber}`;
    const fail = (msg) => errors.push(`Bill ${label}: ${msg}`);
    if (isBooked(head)) { skipped.push(label); continue; }
    const date = toIsoDate(head.date);
    if (!date) { fail(`date "${head.date || ''}" is not a date (use YYYY-MM-DD or DD-MM-YYYY).`); continue; }
    const items = [];
    let bad = false;
    for (const r of rows) {
      const quantity = toNum(r.quantity, 1);
      const rate = toNum(r.rate, NaN);
      const taxPercent = toNum(r.taxPercent, 0);
      const cessPercent = toNum(r.cessPercent, 0);
      if (!r.itemName) { fail(`row ${r._line} has no item name.`); bad = true; break; }
      if (![quantity, rate, taxPercent, cessPercent].every((v) => Number.isFinite(v) && v >= 0) || taxPercent > 100) {
        fail(`row ${r._line}: quantity, rate, GST % and cess % must be numbers, 0 or more.`); bad = true; break;
      }
      items.push({ name: r.itemName, hsn: r.hsn || '', quantity, rate, taxPercent, cessPercent });
    }
    if (bad) continue;
    // Same arithmetic as the purchase form (PurchaseBills calcPurchaseTotal).
    const t = items.reduce((acc, it) => {
      const amount = it.quantity * it.rate;
      const tax = amount * it.taxPercent / 100;
      const cess = amount * it.cessPercent / 100;
      return { taxable: acc.taxable + amount, tax: acc.tax + tax, cess: acc.cess + cess, total: acc.total + amount + tax + cess };
    }, { taxable: 0, tax: 0, cess: 0, total: 0 });
    const gstin = (head.supplierGstin || '').toUpperCase();
    const inferred = head.interstate === '' && inferInterstate ? inferInterstate(gstin) : null;
    const status = PAYMENT_STATUSES.find((s) => s.toLowerCase() === String(head.paymentStatus || '').trim().toLowerCase()) || 'Unpaid';
    purchases.push({
      date,
      supplierName: head.supplierName || gstin,
      supplierAddress: head.supplierAddress || '',
      supplierGstin: gstin,
      invoiceNumber: head.invoiceNumber,
      ownerGstin: profile?.gstin || '',
      ownerName: profile?.businessName || '',
      items,
      totalAmount: t.total,
      totalTax: t.tax,
      taxableAmount: t.taxable,
      applyRoundOff: false,
      roundOff: 0,
      paymentStatus: status,
      interstate: typeof inferred === 'boolean' ? inferred : yes(head.interstate),
      note: head.note || '',
      importedAt: new Date().toISOString(),
    });
  }
  return { purchases, errors, skipped, warnings: order.warning ? [order.warning] : [] };
}

// Purchases -> CSV in the import's own columns (one row per item).
export function purchasesToCsv(purchases) {
  const lines = [toCsvLine(PURCHASE_COLUMNS)];
  for (const p of purchases || []) {
    for (const it of p.items || []) {
      lines.push(toCsvLine([
        p.invoiceNumber || '', p.date || '', p.supplierName || '', p.supplierGstin || '', p.supplierAddress || '',
        it.name || '', it.hsn || '', Number(it.quantity) || 0, Number(it.rate) || 0, Number(it.taxPercent) || 0,
        Number(it.cessPercent) || 0, p.interstate ? 'Yes' : 'No', p.paymentStatus || 'Unpaid', p.note || '',
      ]));
    }
  }
  return lines.join('\n');
}

// Templates with one example bill, for the "Download template" buttons.
export const SALES_TEMPLATE = [
  toCsvLine(SALES_COLUMNS),
  toCsvLine(['INV/2026-27/0101', '2026-10-01', 'Tax Invoice', '2026-10-31', 'Sharma Traders', '27ABCDE1234F1Z5', 'Maharashtra', 'Shop 4, MG Road, Pune', 'India', '', 'Steel rod 8mm', '7214', 10, 'Kg', 72, 0, 18, 0, 'No', '', '', 'No']),
  toCsvLine(['INV/2026-27/0101', '2026-10-01', 'Tax Invoice', '2026-10-31', 'Sharma Traders', '27ABCDE1234F1Z5', 'Maharashtra', 'Shop 4, MG Road, Pune', 'India', '', 'Cutting charges', '998898', 1, 'Nos', 150, 0, 18, 0, 'No', '', '', 'No']),
].join('\n');
export const PURCHASE_TEMPLATE = [
  toCsvLine(PURCHASE_COLUMNS),
  toCsvLine(['SUP/552', '2026-10-03', 'Gupta Steel', '27AAACG1234K1Z2', 'Bhosari, Pune', 'Steel rod 8mm', '7214', 100, 60, 18, 0, 'No', 'Unpaid', '']),
].join('\n');

// #170 - items of imported invoices that are not yet in Products become
// products (name, HSN, unit, rate, GST, cess; stock 0), one per name, as the
// purchase import already does. Products already saved are never changed.
export function newProductsFromBills(bills, products = []) {
  const known = new Set(products.map((p) => String(p.name || '').trim().toLowerCase()));
  const out = [];
  for (const bill of bills) {
    for (const it of bill?.data?.items || []) {
      const name = String(it.name || '').trim();
      const key = name.toLowerCase();
      if (!name || known.has(key)) continue;
      known.add(key);
      out.push({ name, hsn: it.hsn || '', unit: it.unit || 'Nos', sellingPrice: it.rate, rate: it.rate,
        taxPercent: it.taxPercent, cessPercent: it.cessPercent || 0, stock: 0, description: '' });
    }
  }
  return out;
}
