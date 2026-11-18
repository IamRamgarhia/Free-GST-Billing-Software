// v1.10.86 (#199) - which product each purchase line is, and what saving a bill
// does to stock. Duplicates came from matching by name only: "Blue  Pen" (two
// spaces), a line renamed while editing, a name read off GSTR-2B or a photo.
// Now a line keeps the productId of the product it was matched to, and a line
// with no product is matched by name (spaces and case ignored) or barcode
// before a new product is made. Old bills (no productId) still match by name.
// Pure (no React, no fetch), so scripts/purchase-lines-test.mjs runs it.

import { baseQty, lineFactor, roundQty } from '../utils.js';
import { purchaseUnitCost } from './purchaseOrders.js';
import { isTwoBPlaceholder } from './gstr2bBill.js';
import { findByBarcode } from './barcode.js';

// "  Blue   Pen " and "blue pen" are the same product.
export const productKey = (name) => String(name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

// The product a line is: its productId, else the same name, else a barcode
// (the line's own, or a barcode typed as the name). null when none.
export function findLineProduct(products, line) {
  const list = products || [];
  const byId = line?.productId && list.find((p) => p.id === line.productId);
  if (byId) return byId;
  const key = productKey(line?.name);
  if (!key) return null;
  return list.find((p) => productKey(p.name) === key)
    || findByBarcode(list, line?.barcode) || findByBarcode(list, line?.name) || null;
}

const stocked = (it) => it?.name && !isTwoBPlaceholder(it.name); // #175 - a 2B placeholder is no product

// What saving a bill does to Products. `lines` are the bill's items as they
// will be saved; `priorLines` the items it had before an edit ([] for a new
// bill). Returns the lines with productId on each matched or new product, and
// the products to write (stock moved by what changed, new ones created).
// `newId` makes the id for a new product (the server keeps an id it is given).
export function purchaseStockPlan(products, lines, priorLines = [], newId) {
  const byId = new Map((products || []).map((p) => [p.id, p]));
  const delta = new Map();
  const add = (id, q) => delta.set(id, (delta.get(id) || 0) + q);
  // What the bill had added before the edit, per product.
  for (const it of (priorLines || []).filter(stocked)) {
    const prod = findLineProduct(products, it);
    if (prod) add(prod.id, -baseQty(it));
  }
  const updates = new Map();
  const created = new Map(); // key -> new product
  const items = (lines || []).map((it) => {
    if (!stocked(it)) return it;
    const qty = baseQty(it);
    const prod = findLineProduct(products, it);
    if (prod) {
      add(prod.id, qty);
      updates.set(prod.id, {
        ...(updates.get(prod.id) || prod),
        purchasePrice: purchaseUnitCost(it) / lineFactor(it), // v1.10.85 (#171) after its discount; #148 per base unit
        hsn: prod.hsn || it.hsn,
        taxPercent: prod.taxPercent || it.taxPercent,
        cessPercent: prod.cessPercent || it.cessPercent || 0,
      });
      return { ...it, productId: prod.id };
    }
    // New product - two lines of the same new item add up.
    const key = productKey(it.name);
    const had = created.get(key);
    const made = had
      ? { ...had, stock: roundQty(had.stock + qty) }
      : {
        id: newId(), name: String(it.name).trim().replace(/\s+/g, ' '), hsn: it.hsn || '',
        purchasePrice: purchaseUnitCost(it), sellingPrice: it.rate, rate: it.rate,
        taxPercent: it.taxPercent || 0, cessPercent: it.cessPercent || 0, unit: it.unit || 'Nos',
        stock: roundQty(qty), description: '',
      };
    created.set(key, made);
    return { ...it, productId: made.id };
  });
  // Products whose lines went (removed, or now another product) lose what they had.
  for (const id of delta.keys()) if (!updates.has(id) && byId.has(id)) updates.set(id, byId.get(id));
  // Not clamped at 0: sales may take stock below zero, and clamping made a
  // purchase edit and its undo leave different stock.
  const writes = [...updates.values()].map((p) => ({ ...p, stock: roundQty((Number(byId.get(p.id).stock) || 0) + (delta.get(p.id) || 0)) }));
  return { items, writes: [...writes, ...created.values()] };
}

// What deleting a bill takes back out of stock: { productId: -qty }.
export function purchaseStockReversal(products, lines) {
  const out = {};
  for (const it of (lines || []).filter(stocked)) {
    const prod = findLineProduct(products, it);
    if (prod) out[prod.id] = roundQty((out[prod.id] || 0) - baseQty(it));
  }
  return out;
}

// A line's hint in the form: 'new' (no product - one is made on save),
// 'linked' (renamed, but still the product picked: { product }), or null.
export function lineProductHint(products, line) {
  if (!stocked(line) || !productKey(line.name)) return null;
  const prod = findLineProduct(products, line);
  if (!prod) return { kind: 'new' };
  return productKey(prod.name) !== productKey(line.name) && prod.id === line.productId ? { kind: 'linked', product: prod } : null;
}
