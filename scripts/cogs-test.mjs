// v1.10.84 (#146) - Profit & Loss subtracts the cost of the goods sold.
// Run: `node scripts/cogs-test.mjs`
//
// Reported: with no expenses entered, the whole revenue showed as profit.
import { costOfGoodsSold } from '../src/utils/products.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n     expected: ${e}\n     actual:   ${a}`); }
}

const products = [
  { id: 'p1', name: 'A4 Paper', kind: 'goods', purchasePrice: 60, sellingPrice: 100 },
  { id: 'p2', name: 'Stapler', kind: 'goods', purchasePrice: '', sellingPrice: 150 },
  { id: 'p3', name: 'Printer setup', kind: 'service', purchasePrice: 500 },
];
const bill = (invoiceType, items, extra = {}) => ({ invoiceType, data: { items }, ...extra });

console.log('\n[#146] Cost of goods sold = quantity sold x purchase price');
eq(costOfGoodsSold([bill('tax-invoice', [{ productId: 'p1', name: 'A4 Paper', quantity: 10 }])], products),
  { cost: 600, missing: [] }, '10 sold at a purchase price of 60 cost 600');
eq(costOfGoodsSold([bill('tax-invoice', [{ name: 'a4 paper ', quantity: 3 }])], products).cost,
  180, 'a line typed by name (no product link) still finds its product');
eq(costOfGoodsSold([bill('tax-invoice', [{ productId: 'p2', name: 'Stapler', quantity: 4 }])], products),
  { cost: 0, missing: ['Stapler'] }, 'no purchase price: costs 0 and is listed so the user can fill it in');
eq(costOfGoodsSold([bill('tax-invoice', [{ name: 'Hand-typed item', quantity: 1 }])], products).missing,
  ['Hand-typed item'], 'a line that is not a product is listed too');

console.log('\n[#146] Credit notes, services, charges, quotes');
eq(costOfGoodsSold([
  bill('tax-invoice', [{ productId: 'p1', name: 'A4 Paper', quantity: 10 }]),
  bill('credit-note', [{ productId: 'p1', name: 'A4 Paper', quantity: 2 }]),
], products).cost, 480, 'a credit note takes the returned goods back out (8 x 60)');
eq(costOfGoodsSold([bill('tax-invoice', [
  { productId: 'p3', name: 'Printer setup', quantity: 1 },
  { name: 'Website design', hsn: '998314', quantity: 1 },
  { name: 'Delivery charges', isCharge: true, quantity: 1 },
])], products), { cost: 0, missing: [] }, 'a service, a SAC line and a delivery charge cost nothing and are not listed');
eq(costOfGoodsSold([
  bill('proforma', [{ productId: 'p1', name: 'A4 Paper', quantity: 5 }]),
  bill('delivery-challan', [{ productId: 'p1', name: 'A4 Paper', quantity: 5 }]),
  bill('tax-invoice', [{ productId: 'p1', name: 'A4 Paper', quantity: 5 }], { status: 'cancelled' }),
], products).cost, 0, 'quotes, challans and cancelled invoices sold nothing');

console.log('\n────────────────────────────────────────');
console.log(`Passed: ${passed}   Failed: ${failed}`);
if (failed) process.exit(1);
