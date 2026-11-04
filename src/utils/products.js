// v1.10.77 (#85) - product helpers for bulk edit and the stock report.
import { appliedStock, isCancelledBill, isServiceProduct, salesSign } from '../utils.js';

const num = (v) => (v === '' || v === null || v === undefined ? 0 : Number(v));

// One edited row of the bulk-edit grid -> the product to save, or { error }.
// Same rules as the single product form: a name is required, GST % 0-100,
// and the selling price is mirrored to `rate` for older readers.
export const bulkRowToProduct = (product, edits) => {
  const merged = { ...product, ...edits };
  const name = String(merged.name ?? '').trim();
  if (!name) return { error: 'a product needs a name' };
  const gst = num(merged.taxPercent);
  if (!Number.isFinite(gst) || gst < 0 || gst > 100) return { error: `${name}: GST % must be 0 to 100` };
  for (const k of ['purchasePrice', 'sellingPrice', 'stock']) {
    if (!Number.isFinite(num(merged[k]))) return { error: `${name}: ${k === 'stock' ? 'stock' : 'price'} must be a number` };
  }
  const sellingPrice = num(edits.sellingPrice ?? product.sellingPrice ?? product.rate);
  // #121 - a service keeps no stock; a blank stock stays "not tracked" (it
  // used to become 0, so editing a price made it "Out of Stock").
  const blank = merged.stock === '' || merged.stock === null || merged.stock === undefined;
  return {
    product: {
      ...product,
      name,
      hsn: String(merged.hsn ?? '').trim(),
      purchasePrice: num(merged.purchasePrice),
      sellingPrice,
      rate: sellingPrice,
      taxPercent: gst,
      unit: merged.unit || 'Nos',
      stock: isServiceProduct(merged) || blank ? undefined : num(merged.stock),
    },
  };
};

// Closing stock of each product at the end of a day (YYYY-MM-DD), worked
// back from today's stock: take off what purchases dated after it brought in,
// and add back what invoices dated after it took out (each invoice's own
// stock record, see appliedStock). Stock typed in by hand on the Products
// screen has no date, so it counts as if it happened today.
// v1.10.83 (#115) - production entries dated after it are undone the same
// way, from each entry's own stock record (raw materials back, made goods out).
// v1.10.83 (#121) - services have no stock and are left out.
// Returns Map(productId -> quantity).
export const closingStock = (products, bills, purchases, asOf, productions = []) => {
  const qty = new Map((products || []).filter((p) => !isServiceProduct(p)).map((p) => [p.id, Number(p.stock) || 0]));
  const byName = new Map((products || []).map((p) => [String(p.name || '').trim().toLowerCase(), p.id]));
  for (const pur of purchases || []) {
    if (!pur?.date || pur.date <= asOf) continue;
    for (const it of pur.items || []) {
      const id = it.productId || byName.get(String(it.name || '').trim().toLowerCase());
      if (id && qty.has(id)) qty.set(id, qty.get(id) - (Number(it.quantity) || 0));
    }
  }
  for (const b of bills || []) {
    if (!b?.invoiceDate || b.invoiceDate <= asOf || isCancelledBill(b)) continue;
    for (const [id, change] of Object.entries(appliedStock(b))) {
      if (qty.has(id)) qty.set(id, qty.get(id) - change);
    }
  }
  for (const pr of productions || []) {
    if (!pr?.date || pr.date <= asOf) continue;
    for (const [id, change] of Object.entries(pr.stockApplied || {})) {
      if (qty.has(id)) qty.set(id, qty.get(id) - (Number(change) || 0));
    }
  }
  for (const [id, q] of qty) qty.set(id, Math.round(q * 1000) / 1000);
  return qty;
};

// Value of a quantity at the product's purchase price (cost), or at its
// selling price when no purchase price is known.
export const stockValueOf = (product, quantity) => {
  const cost = Number(product?.purchasePrice) || 0;
  const price = cost > 0 ? cost : (Number(product?.sellingPrice) || Number(product?.rate) || 0);
  return { price, value: Math.round(price * (Number(quantity) || 0) * 100) / 100, atCost: cost > 0 };
};

// v1.10.84 (#146) - cost of goods sold, for Profit & Loss: quantity sold x
// the product's Purchase price. Profit used to be sales minus Expenses only, so
// with no expenses entered all the sales showed as profit. Credit notes
// (salesSign -1) take their goods back out; quotes and challans (0) count
// nothing. A line finds its product by productId, else by name. Services,
// charge lines (delivery) and SAC lines (99...) cost nothing. A goods line
// whose product has no purchase price, or that is not a product at all, counts
// 0 and its name is listed in `missing` so the report can ask for the price.
export const costOfGoodsSold = (bills, products) => {
  const byId = new Map((products || []).map((p) => [p.id, p]));
  const byName = new Map((products || []).map((p) => [String(p.name || '').trim().toLowerCase(), p]));
  const missing = new Set();
  let cost = 0;
  for (const bill of bills || []) {
    const sign = salesSign(bill);
    if (!sign) continue;
    for (const it of bill.data?.items || []) {
      const qty = Number(it.quantity) || 0;
      if (!qty || it.isCharge || /^99/.test(String(it.hsn || '').trim())) continue;
      const p = (it.productId && byId.get(it.productId)) || byName.get(String(it.name || '').trim().toLowerCase());
      if (isServiceProduct(p)) continue;
      const price = Number(p?.purchasePrice) || 0;
      if (price > 0) cost += sign * qty * price;
      else if (String(it.name || '').trim()) missing.add(String(p?.name || it.name).trim());
    }
  }
  return { cost: Math.round(cost * 100) / 100, missing: [...missing] };
};
