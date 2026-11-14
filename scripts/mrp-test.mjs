// v1.10.86 - (#189, #192) MRP on products and invoices.
//
// Run: `node scripts/mrp-test.mjs`
//
// MRP is information only: the import keeps it as typed (it already includes
// tax), a blank or 0 MRP adds nothing, the MRP column is off unless chosen,
// and the invoice totals never read it.

import { invoiceOptionOn, computeInvoiceTotals } from '../src/utils.js';
import { productsCsvToList, PRODUCTS_SAMPLE } from '../src/utils/listCsv.js';
import { lineInUnit } from '../src/utils/stock.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  if (actual === expected) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
}

console.log('\n[#189] Product import reads MRP');
{
  const r = productsCsvToList('Name,Selling Price,MRP,GST %,Tax inclusive\nDiceCodes Pen,10,15,18,Yes\nDiceCodes Ink,20,,18,\n', []);
  eq(r.errors.length, 0, 'no errors');
  eq(r.products[0].mrp, 15, 'MRP kept as typed, even when prices include tax');
  eq(r.products[0].sellingPrice, 8.47, 'the selling price still has its tax taken out');
  eq('mrp' in r.products[1], false, 'a blank MRP adds no field');
  const m = productsCsvToList('Name,M.R.P.\nDiceCodes Pen,12\n', []).products[0];
  eq(m.mrp, 12, '"M.R.P." heading is read too');
  const bad = productsCsvToList('Name,MRP\nDiceCodes Pen,abc\n', []);
  eq(bad.errors.length, 1, 'MRP that is not a number is refused');
}

console.log('\n[#189] A saved product without MRP gets it; one with MRP keeps its own');
{
  const existing = [{ id: 'a', name: 'DiceCodes Pen', sellingPrice: 10, rate: 10, taxPercent: 18, hsn: '9608' },
    { id: 'b', name: 'DiceCodes Ink', sellingPrice: 20, rate: 20, taxPercent: 18, hsn: '3215', mrp: 30 }];
  const r = productsCsvToList('Name,MRP\nDiceCodes Pen,15\nDiceCodes Ink,99\n', existing);
  eq(r.updates.find((p) => p.id === 'a')?.mrp, 15, 'the product without MRP gets it');
  const ink = r.updates.find((p) => p.id === 'b');
  eq(ink ? ink.mrp : 30, 30, 'the one with an MRP keeps its own');
}

console.log('\n[#189] Sample file imports back with its MRP');
{
  const r = productsCsvToList(PRODUCTS_SAMPLE, []);
  eq(r.products[0].mrp, 340, 'goods row MRP');
  eq('mrp' in r.products[1], false, 'service row has none');
}

console.log('\n[#189] MRP on a line in the second unit (Box = 12 Pcs)');
{
  const pen = { id: 'pen', name: 'DiceCodes Pen', unit: 'Pcs', sellingPrice: 10, rate: 10, mrp: 15, altUnit: 'Box', altFactor: 12 };
  const line = { id: 'l1', name: pen.name, productId: 'pen', unit: 'Pcs', quantity: 2, rate: 10, mrp: 15 };
  const box = lineInUnit(line, pen, 'Box');
  eq(box.mrp, 180, 'Box: MRP 12 x 15');
  eq(lineInUnit(box, pen, 'Pcs').mrp, 15, 'back to Pcs: the piece MRP');
  eq(lineInUnit({ ...box, mrp: 170 }, pen, 'Pcs').mrp, 170, 'an MRP typed on the box line stays when going back');
  eq(lineInUnit({ ...line, mrp: 14 }, pen, 'Box').mrp, 14, 'a piece MRP typed by hand stays too');
  eq(lineInUnit({ ...line, mrp: '' }, pen, 'Box').mrp, '', 'a cleared MRP stays blank');
  eq('mrp' in lineInUnit({ id: 'old', unit: 'Pcs', quantity: 1, rate: 10 }, pen, 'Box'), false, 'an old line without MRP gets none');
  eq(lineInUnit(line, { ...pen, mrp: undefined }, 'Box').mrp, 15, 'a product without MRP leaves the line as it is');
  eq(lineInUnit(box, pen, 'Kg').mrp, 15, 'a box line moved to another unit gets the piece MRP back, like its rate');
}

console.log('\n[#189] MRP column is off unless chosen');
eq(invoiceOptionOn({}, 'showMRP'), false, 'unset: off (old invoices print no MRP)');
eq(invoiceOptionOn({ showMRP: true }, 'showMRP'), true, 'chosen: on');
eq(invoiceOptionOn({ pdfStyle: 'tally' }, 'showMRP'), false, 'off in the Tally design too');

console.log('\n[#189] MRP never changes the totals');
{
  const items = [{ id: 1, name: 'Pen', quantity: 2, rate: 100, taxPercent: 18, discount: 0 }];
  const base = { profile: { country: 'India', state: 'Karnataka' }, client: { state: 'Karnataka' }, details: { placeOfSupply: 'Karnataka' } };
  const a = computeInvoiceTotals({ ...base, items, invoiceOptions: {} });
  const b = computeInvoiceTotals({ ...base, items: items.map((i) => ({ ...i, mrp: 150 })), invoiceOptions: { showMRP: true } });
  eq(a.total, 236, 'the total is 2 x 100 + 18% GST');
  eq(JSON.stringify(b), JSON.stringify(a), 'same totals with and without MRP');
}

console.log('\n────────────────────────────────────────');
console.log(`Passed: ${passed}   Failed: ${failed}`);
if (failed) process.exit(1);
