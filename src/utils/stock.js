// v1.10.85 (#148, #142) - stock features, the pure parts:
//   - alternate units (Box = 12 Pcs) on a product and on an invoice or purchase line;
//   - one category tree (Garments > Men > Shirts > Formal) and a brand per product,
//     for filtering (the "stock groups" of #148 are these categories);
//   - stock adjustments (damaged, lost, found, ...) as records of their own;
//   - the purchase order for low stock;
//   - the Products report's filters and where a serial number was bought and sold.
// No React, no storage (tested in scripts/stock-test.mjs).
import { baseQty, calculateLineItemTax, salesSign, roundQty, isServiceProduct, trackedStock } from '../utils.js';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const low = (s) => String(s ?? '').trim().toLowerCase();

// ---- Categories and brands ----
// A category is saved as its path, levels joined by " > ". A main category
// and up to 3 sub-levels.
export const CATEGORY_LEVELS = 4;
const SEP = ' > ';
const levelsOf = (s) => String(s ?? '').split('>').map((x) => x.trim().replace(/\s+/g, ' ')).filter(Boolean);
export const normaliseCategory = (s) => levelsOf(s).join(SEP);
export const categoryProblem = (s) => (levelsOf(s).length > CATEGORY_LEVELS
  ? 'A category can have a main category and up to 3 sub-levels, such as Garments > Men > Shirts > Formal' : '');

// Every category in use and every level above it, for the pickers and filters
// ("Garments", "Garments > Men", "Garments > Men > Shirts"), sorted. The same
// path typed in other capitals counts once (the first spelling is kept).
export function categoryOptions(products) {
  const seen = new Map();
  for (const p of products || []) {
    const parts = levelsOf(p?.category);
    for (let i = 1; i <= parts.length; i++) {
      const path = parts.slice(0, i).join(SEP);
      if (!seen.has(low(path))) seen.set(low(path), path);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

// Is the product in this category or any level below it? '' = any.
export const inCategory = (product, category) => {
  const want = low(normaliseCategory(category));
  if (!want) return true;
  const has = low(normaliseCategory(product?.category));
  return has === want || has.startsWith(want + SEP);
};

export function brandOptions(products) {
  const seen = new Map();
  for (const p of products || []) {
    const b = String(p?.brand ?? '').trim();
    if (b && !seen.has(low(b))) seen.set(low(b), b);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

// The product filters of Products and Reports: item name (part of it), category
// (with its sub-levels) and brand. Blank filters match everything.
export const productMatches = (product, { item = '', category = '', brand = '' } = {}) => {
  if (item && !low(product?.name).includes(low(item))) return false;
  if (brand && low(product?.brand) !== low(brand)) return false;
  return inCategory(product, category);
};

// ---- Alternate units (#148) ----
// A product sold in a second unit: altUnit 'Box', altFactor 12 (Box = 12 of
// its unit), and optionally altPrice, its own selling price per box.
export const hasAltUnit = (p) => !!String(p?.altUnit ?? '').trim() && Number(p?.altFactor) > 0 && Number(p?.altFactor) !== 1;
export const altUnitText = (p) => (hasAltUnit(p) ? `1 ${p.altUnit} = ${Number(p.altFactor)} ${p.unit || 'Nos'}` : '');

// Why the product form's second unit cannot be saved, or '' (blank = none).
export function altUnitProblem({ unit, altUnit, altFactor, altPrice }) {
  const alt = String(altUnit ?? '').trim();
  if (!alt) return '';
  if (low(alt) === low(unit || 'Nos')) return 'The second unit must be different from the unit';
  const f = Number(altFactor);
  if (!Number.isFinite(f) || f <= 0 || f === 1) return `Say how many ${unit || 'Nos'} make one ${alt} (a number more than 0, not 1)`;
  if (String(altPrice ?? '').trim() !== '' && !(Number(altPrice) >= 0)) return `The price per ${alt} must be a number`;
  return '';
}

// A line without the alternate-unit fields.
const plainLine = (line) => {
  const next = { ...line };
  delete next.unitFactor;
  delete next.baseUnit;
  return next;
};

// The line when its unit is changed to `unit`. The product's second unit
// bills by it: unitFactor and baseUnit are kept (stock counts factor x qty)
// and the rate is the box price, else factor x the base price. Back to the
// base unit: the base price. Any other unit: the unit changes, and a line that
// was in boxes goes back to the base price (a box price per Kg would be wrong).
// Options: kind 'purchase' starts from the purchase price instead of the
// selling price; levelPrice (a number) is the client's price level, which
// then wins over the box price (factor x the level price).
// v1.10.86 - the line's MRP follows its unit: per box it is the product's
// piece MRP x pieces per box, back in pieces the piece MRP. Only an MRP the
// app filled in changes (it still equals piece MRP x the old factor); one the
// user typed, or cleared, stays as it is. Lines without an MRP are untouched.
const mrpInUnit = (line, product, factor) => {
  const piece = Number(product?.mrp) || 0;
  if (!(piece > 0) || line?.mrp === undefined || line.mrp === null || line.mrp === '') return {};
  const was = piece * (Number(line.unitFactor) > 0 ? Number(line.unitFactor) : 1);
  return Math.abs(Number(line.mrp) - was) < 0.005 ? { mrp: r2(piece * factor) } : {};
};

export function lineInUnit(line, product, unit, { kind = 'sale', levelPrice = null } = {}) {
  const wasBox = Number(line?.unitFactor) > 0 && Number(line.unitFactor) !== 1;
  const next = { ...plainLine(line), unit };
  if (!hasAltUnit(product)) return next;
  const level = kind === 'sale' && Number(levelPrice) > 0 ? Number(levelPrice) : null;
  const base = kind === 'purchase' ? Number(product.purchasePrice) || 0 : (level ?? (Number(product.sellingPrice ?? product.rate) || 0));
  if (unit === product.altUnit) {
    const factor = Number(product.altFactor);
    const own = kind === 'sale' && level === null && String(product.altPrice ?? '').trim() !== '' && Number(product.altPrice) > 0;
    return { ...next, unitFactor: factor, baseUnit: product.unit || 'Nos', rate: own ? Number(product.altPrice) : r2(base * factor), ...mrpInUnit(line, product, factor) };
  }
  return unit === (product.unit || 'Nos') || wasBox ? { ...next, rate: base, ...mrpInUnit(line, product, 1) } : next;
}

// ---- Stock adjustments ----
// Stock that changes outside a bill: goods damaged, lost, found, used in the
// shop, or a correction to the opening count. Saved one record each
// (data/stock-adjustments) with the stock it moved, like a production entry,
// so the stock report can work back through it.
export const ADJUST_REASONS = [
  { id: 'damaged', label: 'Damaged', out: true },
  { id: 'lost', label: 'Lost or stolen', out: true },
  { id: 'inhouse', label: 'Used in the shop', out: true },
  { id: 'found', label: 'Found', out: false },
  { id: 'opening', label: 'Opening stock correction', out: null },
];
export const reasonLabel = (id) => ADJUST_REASONS.find((r) => r.id === id)?.label || id || '';

// Why this adjustment cannot be saved, or ''. `direction` is 'add' or 'remove'.
export function adjustmentProblem({ product, quantity, direction, reason, date }) {
  if (!product?.id) return 'Choose the product';
  if (isServiceProduct(product)) return 'A service has no stock';
  const q = Number(quantity);
  if (!Number.isFinite(q) || q <= 0) return 'Enter a quantity more than 0';
  if (direction !== 'add' && direction !== 'remove') return 'Choose Add or Remove';
  if (!ADJUST_REASONS.some((r) => r.id === reason)) return 'Choose a reason';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return 'Enter the date';
  return '';
}

// The record to save. quantity is signed (+ added, - removed), in the base unit.
export function makeAdjustment({ product, quantity, direction, reason, note = '', date }) {
  const signed = roundQty((direction === 'remove' ? -1 : 1) * Number(quantity));
  return {
    date,
    productId: product.id,
    productName: product.name || '',
    unit: product.unit || 'Nos',
    quantity: signed,
    reason,
    note: String(note || '').trim(),
    stockApplied: { [product.id]: signed },
    createdAt: new Date().toISOString(),
  };
}

// ---- Low stock -> a purchase order ----
// One PO line per low product: enough to reach twice the low-stock level
// (level x 2 - stock, at least 1), at its purchase price.
export function reorderLines(products, threshold) {
  const level = Math.max(0, Number(threshold) || 0);
  return (products || []).filter((p) => trackedStock(p) !== null).map((p) => ({
    name: p.name || '',
    hsn: p.hsn || '',
    quantity: Math.max(1, roundQty(level * 2 - trackedStock(p))),
    unit: p.unit || 'Nos',
    rate: Number(p.purchasePrice) || 0,
    taxPercent: Number(p.taxPercent) || 0,
    cessPercent: Number(p.cessPercent) || 0,
  }));
}

// ---- Reports -> Product Performance ----
// Quantity (in the base unit), revenue before tax, number of lines and last
// sale for each item sold, filtered by item, category and brand. A line finds
// its product by productId, else by name; a category or brand filter leaves
// out lines with no product.
export function productSales(bills, products, filter = {}) {
  const byId = new Map((products || []).map((p) => [p.id, p]));
  const byName = new Map((products || []).map((p) => [low(p.name), p]));
  const narrowed = !!(filter.category || filter.brand);
  const out = {};
  for (const b of bills || []) {
    const sign = salesSign(b);
    for (const item of b.data?.items || []) {
      if (item.isCharge) continue; // delivery charges are not a product
      const name = String(item.name || item.description || '').trim();
      if (!name) continue;
      const product = (item.productId && byId.get(item.productId)) || byName.get(low(name));
      if (filter.item && !low(name).includes(low(filter.item))) continue;
      if (narrowed && (!product || !productMatches(product, { category: filter.category, brand: filter.brand }))) continue;
      if (!out[name]) out[name] = { name, hsn: item.hsn || '', qty: 0, revenue: 0, txns: 0, lastSold: '', category: product?.category || '', brand: product?.brand || '' };
      const row = out[name];
      // Revenue is the line's taxable value (after discount, tax backed out of
      // tax-inclusive prices), as the invoices show it.
      const { afterDiscount } = calculateLineItemTax(item, !!(b.data?.totals?.taxInclusive ?? b.data?.taxInclusive));
      row.qty += sign * baseQty(item);
      row.revenue += sign * afterDiscount;
      row.txns += 1;
      if (!row.lastSold || b.invoiceDate > row.lastSold) row.lastSold = b.invoiceDate;
      if (item.hsn && !row.hsn) row.hsn = item.hsn;
    }
  }
  return Object.values(out).map((r) => ({ ...r, qty: roundQty(r.qty), revenue: r2(r.revenue) }));
}

// Where a serial number / IMEI (or part of one, 3 characters or more) was
// bought - purchase lines carry them (#160) - and sold: an invoice line whose
// name or description holds it.
export function serialTrail(query, purchases, bills) {
  const q = low(query);
  if (q.length < 3) return { bought: [], sold: [] };
  const bought = [];
  for (const p of purchases || []) {
    for (const it of p.items || []) {
      if (low(it.serialNo).includes(q)) bought.push({ date: p.date || '', supplierName: p.supplierName || '', invoiceNumber: p.invoiceNumber || '', name: it.name || '', serialNo: it.serialNo });
    }
  }
  const sold = [];
  for (const b of bills || []) {
    if (!salesSign(b)) continue;
    for (const it of b.data?.items || []) {
      if ([it.serialNo, it.name, it.description].some((t) => low(t).includes(q))) {
        sold.push({ date: b.invoiceDate || '', clientName: b.clientName || b.data?.client?.name || '', invoiceNumber: b.invoiceNumber || b.id || '', name: it.name || '', creditNote: salesSign(b) < 0 });
      }
    }
  }
  const byDate = (a, b) => String(a.date).localeCompare(String(b.date));
  return { bought: bought.sort(byDate), sold: sold.sort(byDate) };
}
