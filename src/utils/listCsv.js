// v1.10.83 (#121) - Products and Clients CSV import, and their sample files.
// Reported: "for import features where are the sample files to fill data".
// Pure functions (no fetch / React), so scripts/csv-test.mjs can import each
// sample back through the same code the screens use. Headings are matched
// loosely (case, spaces, %, / ignored), so the Products export imports back.
import { toCsvLine } from '../utils.js';
import { rowsToRecords, toNum, percentPart } from './bulkCsv.js';
import { barcodeProblem, normaliseBarcode } from './barcode.js';
import { levelCsvFields, levelPricesFromRecord } from './priceLevels.js';

const PRODUCT_FIELDS = {
  name: ['name', 'product', 'product name', 'item', 'item name'],
  type: ['type', 'kind', 'goods or service', 'goods/service'],
  hsn: ['hsn', 'hsn code', 'sac', 'sac code', 'hsn/sac'],
  unit: ['unit'],
  purchasePrice: ['purchase price', 'cost', 'cost price'],
  sellingPrice: ['selling price', 'rate', 'price', 'sale price'],
  taxPercent: ['gst%', 'gst rate', 'tax%', 'tax rate', 'tax', 'taxpercent'],
  stock: ['stock', 'quantity', 'opening stock', 'opening stock quantity', 'opening qty', 'stock quantity'],
  description: ['description'],
  // v1.10.84 (#130) - Vyapar's item file says whether its prices hold the tax.
  taxInclusive: ['tax inclusive', 'tax inclusive (y/n)', 'inclusive of tax'],
  // v1.10.85 (#137) - the product's barcode (optional, one per product).
  barcode: ['barcode', 'bar code', 'barcode no', 'ean', 'upc'],
};

const CLIENT_FIELDS = {
  name: ['name', 'client', 'client name', 'customer', 'customer name', 'party name', 'party'],
  gstin: ['gstin', 'gst number', 'gst no'],
  phone: ['phone', 'mobile', 'phone number', 'phone no', 'mobile no', 'contact no', 'party phone no'],
  email: ['email', 'email id'],
  address: ['address', 'billing address'],
  state: ['state'],
};

// Already in the list (trimmed name, any case), or a repeat inside the file.
const dedupe = (existing) => {
  const known = new Set((existing || []).map((x) => String(x.name || '').trim().toLowerCase()));
  return (name) => {
    const k = name.toLowerCase();
    if (known.has(k)) return true;
    known.add(k);
    return false;
  };
};

// v1.10.84 (#134) - a saved product with empty details gets them from the
// file; a value already there is never changed. 0 counts as empty for the
// prices, and for GST % only when the product has no HSN either (left so by an
// import that read only the name; an exempt item with its HSN keeps its 0%).
const blank = (v) => v === undefined || v === null || String(v).trim() === '';
const FILL = {
  hsn: blank, unit: blank, description: blank, stock: blank, barcode: blank,
  purchasePrice: (v) => blank(v) || Number(v) === 0,
  sellingPrice: (v) => blank(v) || Number(v) === 0,
  taxPercent: (v, p) => blank(v) || (Number(v) === 0 && blank(p.hsn)),
};
export function fillBlanks(saved, fresh) {
  const add = {};
  for (const [k, isEmpty] of Object.entries(FILL)) {
    if (isEmpty(saved[k], saved) && !FILL[k](fresh[k], fresh)) add[k] = fresh[k];
  }
  if ('sellingPrice' in add) add.rate = add.sellingPrice; // mirror for older readers
  // v1.10.85 - a level price the saved product does not have yet.
  const levelAdd = Object.fromEntries(Object.entries(fresh.levelPrices || {}).filter(([id]) => !(Number(saved.levelPrices?.[id]) > 0)));
  if (Object.keys(levelAdd).length) add.levelPrices = { ...(saved.levelPrices || {}), ...levelAdd };
  return Object.keys(add).length ? { ...saved, ...add } : null;
}

// v1.10.85 - `levels` (Price levels on): each level's "<name> price" column
// is read into levelPrices; a saved product without level prices gets them.
// Rows (CSV text or a sheet) -> { products, updates, skipped, errors }. A row
// with a problem is left out and named in errors. A name already saved is not
// added again (importing twice is safe): its empty details are filled in
// (updates), or it is skipped when there is nothing to fill.
export function productsCsvToList(text, existing = [], levels = []) {
  const { records } = rowsToRecords(text, { ...PRODUCT_FIELDS, ...levelCsvFields(levels) });
  const key = (n) => String(n || '').trim().toLowerCase();
  const saved = new Map((existing || []).map((p) => [key(p.name), p]));
  const seen = new Set();
  const out = { products: [], updates: [], skipped: 0, errors: [] };
  // #137 - barcodes already taken: saved products, then rows added from this file.
  const codes = (existing || []).filter((p) => p.barcode).map((p) => ({ id: p.id, name: p.name, barcode: p.barcode }));
  for (const r of records) {
    const name = r.name || '';
    if (!name) continue;
    const type = String(r.type || '').toLowerCase();
    if (type && !/^(goods?|g|products?|services?|s)$/.test(type)) { out.errors.push(`Row ${r._line} (${name}): Type must be Goods or Service`); continue; }
    const service = type.startsWith('s');
    const nums = { purchasePrice: toNum(r.purchasePrice), sellingPrice: toNum(r.sellingPrice), taxPercent: toNum(percentPart(r.taxPercent)), stock: toNum(r.stock, null) };
    const bad = Object.entries(nums).find(([k, v]) => (k === 'stock' ? v !== null && !Number.isFinite(v) : !Number.isFinite(v)));
    if (bad) { out.errors.push(`Row ${r._line} (${name}): ${bad[0] === 'stock' ? 'stock' : bad[0] === 'taxPercent' ? 'GST %' : 'price'} must be a number`); continue; }
    if (nums.taxPercent < 0 || nums.taxPercent > 100) { out.errors.push(`Row ${r._line} (${name}): GST % must be 0 to 100`); continue; }
    const lv = levelPricesFromRecord(r, levels, toNum);
    if (lv.error) { out.errors.push(`Row ${r._line} (${name}): ${lv.error}`); continue; }
    if (seen.has(key(name))) { out.skipped++; continue; }
    // A barcode is used only for a new product, or a saved one without one;
    // one that another product has (saved, or higher up in the file) is refused.
    const old = saved.get(key(name));
    const code = normaliseBarcode(r.barcode);
    const ownId = old ? old.id : `_row${r._line}`;
    if (code && !(old && old.barcode)) {
      const problem = barcodeProblem(code, codes, ownId);
      if (problem) { out.errors.push(`Row ${r._line} (${name}): ${problem}`); continue; }
      codes.push({ id: ownId, name, barcode: code });
    }
    seen.add(key(name));
    // Our product prices are before tax: take the tax out of an inclusive one.
    if (/^(y|yes|true|1)$/i.test(String(r.taxInclusive || '').trim()) && nums.taxPercent > 0) {
      nums.sellingPrice = Math.round(nums.sellingPrice / (1 + nums.taxPercent / 100) * 100) / 100;
    }
    const product = {
      name,
      ...(service ? { kind: 'service' } : {}),
      hsn: r.hsn || '',
      purchasePrice: nums.purchasePrice,
      sellingPrice: nums.sellingPrice,
      rate: nums.sellingPrice, // mirror for older readers
      taxPercent: nums.taxPercent,
      unit: r.unit || 'Nos',
      // A service has no stock; goods with a blank stock are "not tracked yet".
      ...(!service && nums.stock !== null ? { stock: nums.stock } : {}),
      description: r.description || '',
      ...(code ? { barcode: code } : {}),
      ...(Object.keys(lv.prices).length ? { levelPrices: lv.prices } : {}),
    };
    if (!old) { out.products.push(product); continue; }
    const filled = fillBlanks(old, product);
    if (filled) out.updates.push(filled); else out.skipped++;
  }
  return out;
}

export function clientsCsvToList(text, existing = []) {
  const { records } = rowsToRecords(text, CLIENT_FIELDS);
  const seen = dedupe(existing);
  const out = { clients: [], skipped: 0, errors: [] };
  for (const r of records) {
    const name = r.name || '';
    if (!name) continue;
    if (seen(name)) { out.skipped++; continue; }
    out.clients.push({ name, address: r.address || '', state: r.state || '', gstin: (r.gstin || '').toUpperCase(), email: r.email || '', phone: r.phone || '' });
  }
  return out;
}

// Sample files (demo data, not real businesses) for "Download sample file".
export const PRODUCTS_SAMPLE = [
  toCsvLine(['Name', 'Type', 'HSN/SAC', 'Unit', 'Purchase Price', 'Selling Price', 'GST %', 'Stock', 'Description', 'Barcode']),
  toCsvLine(['Demo A4 Paper Ream 75 GSM', 'Goods', '4802', 'Nos', 220, 280, 18, 50, 'Sample goods row - replace with your own', '']),
  toCsvLine(['Demo Printing service', 'Service', '998912', 'Page', '', 5, 18, '', 'Sample service row - a service has no stock', '']),
].join('\n');

export const CLIENTS_SAMPLE = [
  toCsvLine(['Name', 'GSTIN', 'Phone', 'Email', 'Address', 'State']),
  toCsvLine(['Demo Traders', '27AAAAA0000A1Z5', '9800000001', 'accounts@demo-traders.example', 'Shop 4, Demo Market, Pune', 'Maharashtra']),
  toCsvLine(['Sample Studio', '', '9800000002', 'hello@sample-studio.example', '12 Sample Street, Kolkata', 'West Bengal']),
].join('\n');
