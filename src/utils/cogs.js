// v1.10.84 (#146) - cost of goods sold for the Profit & Loss report.
//
// A sale earns the selling price but costs what the goods cost us. Until now
// Profit & Loss subtracted only Expenses, so with no expenses entered the
// whole revenue looked like profit. COGS is the quantity sold on each invoice
// line times that product's Purchase price (Products page), all without GST.
//
// A credit note takes the returned goods' cost back off (salesSign -1), and a
// line that is not a product (delivery charges) adds nothing. Purchase price
// is kept in the business's own currency, so a foreign-currency invoice's cost
// is converted at the exchange rate saved on that invoice.
//
// Pure; tested in scripts/reports-test.mjs.
import { salesSign } from '../utils.js';
import { billRate } from './fx.js';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const keyOf = (value) => String(value || '').trim().toLowerCase();

// Products by id and by name. Name is the fallback for bills saved before a
// line kept its productId (and for lines typed by hand that match a product).
export const productIndex = (products) => {
  const byId = new Map();
  const byName = new Map();
  for (const product of products || []) {
    if (product?.id) byId.set(product.id, product);
    const key = keyOf(product?.name);
    if (key && !byName.has(key)) byName.set(key, product);
  }
  return { byId, byName };
};

export const unitCostOf = (product) => {
  const cost = Number(product?.purchasePrice);
  return isFinite(cost) && cost > 0 ? cost : 0;
};

// The cost of the goods on one bill, in `base` currency. `index` may be a
// productIndex() result (reuse it for many bills) or a product list.
export const billCogs = (bill, index, { base = 'INR' } = {}) => {
  if (!bill?.data) return 0;
  const sign = salesSign(bill);
  if (!sign) return 0;
  const products = index?.byId ? index : productIndex(index);
  const rate = billRate(bill, base);
  if (!rate) return 0; // a foreign-currency bill with no exchange rate: cost unknown
  let total = 0;
  for (const item of bill.data.items || []) {
    if (item.isCharge) continue; // delivery charge, not goods
    const product = (item.productId && products.byId.get(item.productId))
      || products.byName.get(keyOf(item.name || item.description));
    const qty = Number(item.quantity) || 0;
    if (!product || !qty) continue;
    // purchasePrice is in the base currency; the bill is in `rate` units of it.
    total += sign * qty * unitCostOf(product) / rate;
  }
  return r2(total);
};

export const cogsOfBills = (bills, index, options) => {
  const products = index?.byId ? index : productIndex(index);
  return r2((bills || []).reduce((sum, bill) => sum + billCogs(bill, products, options), 0));
};
