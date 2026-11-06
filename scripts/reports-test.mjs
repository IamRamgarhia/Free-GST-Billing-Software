// v1.10.84 (#146) - Profit & Loss cost of goods sold.
//
// Run: `node scripts/reports-test.mjs`
//
// COGS = quantity sold x the product's Purchase price, without GST. A credit
// note takes the returned cost back off, cancelled/quote/challan lines cost
// nothing, delivery charges are not goods, and a foreign-currency invoice uses
// the exchange rate saved on it.

import { billCogs, cogsOfBills, productIndex, unitCostOf } from '../src/utils/cogs.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; console.log(`  ok ${label}`); }
  else { failed++; console.log(`  FAIL ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
}

const products = [
  { id: 'p1', name: 'Pen', purchasePrice: 5 },
  { id: 'p2', name: 'Ink', purchasePrice: 20 },
  { id: 'p3', name: 'Free sample', purchasePrice: '' },
  { id: 'p4', name: 'Made chair', purchasePrice: 0, madeHere: true, bom: [{ productId: 'p5', qty: 2 }] },
  { id: 'p5', name: 'Wood', purchasePrice: 100 },
];
const index = productIndex(products);

const bill = (items, extra = {}) => ({
  invoiceType: 'tax-invoice', status: 'unpaid', currency: 'INR',
  data: { items, totals: {} },
  ...extra,
});

console.log('\n[#146] Cost of goods sold');
eq(unitCostOf(products[0]), 5, 'purchase price is the unit cost');
eq(unitCostOf(products[2]), 0, 'no purchase price means no cost, not a guess at the selling price');
eq(unitCostOf(products[3]), 0, 'a made product with no purchase price is not costed from its BOM here');
eq(billCogs(bill([{ productId: 'p1', quantity: 3, rate: 10 }]), index), 15, '3 pens at ₹5 cost ₹15');

console.log('\n[#146] Name fallback, returns and non-goods lines');
eq(billCogs(bill([{ name: ' pen ', quantity: 2, rate: 10 }]), index), 10, 'an old line with no productId matches the product by name');
eq(billCogs(bill([{ productId: 'p1', quantity: 4, rate: 10 }], { invoiceType: 'credit-note' }), index), -20, 'a credit note takes the returned cost back off');
eq(billCogs(bill([{ productId: 'p1', quantity: 2, rate: 10 }], { status: 'cancelled' }), index), 0, 'a cancelled invoice costs nothing');
eq(billCogs(bill([{ productId: 'p1', quantity: 2, rate: 10 }], { invoiceType: 'proforma' }), index), 0, 'a quote costs nothing');
eq(billCogs(bill([{ isCharge: true, name: 'Delivery', quantity: 1, rate: 50 }]), index), 0, 'delivery charge is not goods');
eq(billCogs(bill([{ name: 'Unknown item', quantity: 2, rate: 10 }]), index), 0, 'an item with no product costs nothing');
eq(billCogs(bill([{ productId: 'p2', quantity: 2, rate: 30 }]), index), 40, 'different products add up');

console.log('\n[#146] Currency and the whole report');
eq(billCogs(bill([{ productId: 'p2', quantity: 1, rate: 30 }], {
  currency: 'USD', data: { items: [{ productId: 'p2', quantity: 1, rate: 30 }], totals: {}, invoiceOptions: { exchangeRate: 80 } },
}), index, { base: 'INR' }), 0.25, '₹20 cost in a USD invoice at ₹80/USD is $0.25');
eq(billCogs(bill([{ productId: 'p2', quantity: 1, rate: 30 }], {
  currency: 'USD', data: { items: [{ productId: 'p2', quantity: 1, rate: 30 }], totals: {}, invoiceOptions: {} },
}), index, { base: 'INR' }), 0, 'a foreign invoice with no exchange rate has no cost to state');
eq(cogsOfBills([
  bill([{ productId: 'p1', quantity: 2 }]),
  bill([{ name: 'ink', quantity: 1 }]),
  bill([{ productId: 'p1', quantity: 1 }], { invoiceType: 'credit-note' }),
], index), 25, 'the report adds every bill, returns included');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
