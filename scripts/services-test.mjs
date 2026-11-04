// v1.10.83 (#121) - a product can be a Service: no stock, never "out of stock".
// And the Products / Clients sample files import back with zero errors.
//
// Run: `node scripts/services-test.mjs`
//
// Reported: "I added printing service and it shows out of stock" and "for
// import features where are the sample files to fill data".

import { stockEffect, stockDelta, stockUpdates, trackedStock, findLowStock, isServiceProduct, toCsvLine, getUnitUQC, hsnUqc, generateEWayBillJSON } from '../src/utils.js';
import { closingStock, bulkRowToProduct } from '../src/utils/products.js';
import { productsCsvToList, clientsCsvToList, PRODUCTS_SAMPLE, CLIENTS_SAMPLE } from '../src/utils/listCsv.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n     expected: ${e}\n     actual:   ${a}`); }
}

const paper = { id: 'paper', name: 'A4 Paper', unit: 'Nos', stock: 10 };
const printing = { id: 'print', name: 'Printing service', kind: 'service', unit: 'Page' };
const oldService = { id: 'old', name: 'Old printing', unit: 'Nos', stock: 0 }; // saved before #121: Goods
const uncounted = { id: 'nocount', name: 'Never counted', unit: 'Nos' };
const products = [paper, printing, oldService, uncounted];

console.log('\n[#121] Selling a service moves no stock; goods still do');
{
  const items = [
    { productId: 'paper', quantity: 3 },
    { productId: 'print', quantity: 100 },
  ];
  const record = stockEffect(items, 'tax-invoice', 'unpaid');
  const updates = stockUpdates(products, stockDelta({}, record));
  eq(updates.map((p) => [p.id, p.stock]), [['paper', 7]], 'Invoice save: only the goods line changes stock (10 - 3 = 7)');
  eq(updates.some((p) => p.id === 'print'), false, 'Invoice save: the service is not saved with a stock, so no "out of stock" toast');
  const cancel = stockUpdates(products, stockDelta(record, stockEffect(items, 'tax-invoice', 'cancelled')));
  eq(cancel.map((p) => [p.id, p.stock]), [['paper', 13]], 'Cancelling puts back only the goods');
  eq(stockUpdates(products, { print: 50 }).length, 0, 'A purchase or credit note adds nothing to a service');
  eq(stockUpdates(products, { nocount: -2 }).map((p) => p.stock), [-2], 'Goods with no stock entered start counting when sold (as before)');
  eq(stockUpdates(products, { gone: -1 }).length, 0, 'A product deleted since is skipped');
}

console.log('\n[#121] Stock shown and alerted on');
{
  eq(isServiceProduct(printing), true, 'kind: service is a service');
  eq(isServiceProduct(oldService), false, 'A product saved before (no kind) stays Goods');
  eq(trackedStock(printing), null, 'A service has no stock to show');
  eq(trackedStock(uncounted), null, 'Stock never entered is "not tracked", not 0');
  eq(trackedStock({ stock: '' }), null, 'Blank stock is "not tracked"');
  eq(trackedStock({ stock: 0 }), 0, 'A real stock of 0 is 0 (Out of Stock)');
  eq(trackedStock({ ...printing, stock: 0 }), null, 'A service with an old stock of 0 is still not shown');
  eq(findLowStock(products, 5).map((p) => p.id), ['old'], 'Low stock / notifications: no service, no uncounted product');
  eq(findLowStock([{ id: 'a', stock: 5 }, { id: 'b', stock: 6 }], 5).map((p) => p.id), ['a'], 'Low stock: at or below the threshold');
}

console.log('\n[#121] Stock report and bulk edit');
{
  const qty = closingStock(products, [], [], '2026-10-31');
  eq([qty.has('print'), qty.get('paper')], [false, 10], 'Stock report leaves the service out');
  const bill = { invoiceDate: '2026-11-05', data: { items: [], stockApplied: { paper: -2, print: -5 } } };
  eq(closingStock(products, [bill], [], '2026-10-31').get('paper'), 12, 'A later invoice is undone for goods; its service line is ignored');
  eq('stock' in bulkRowToProduct(printing, { sellingPrice: '6' }).product, true, 'Bulk edit keeps the stock key out of the saved JSON...');
  eq(bulkRowToProduct(printing, { sellingPrice: '6' }).product.stock, undefined, '...as undefined: a service gets no stock');
  eq(bulkRowToProduct(uncounted, { sellingPrice: '6' }).product.stock, undefined, 'Editing a price does not start counting an uncounted product');
  eq(bulkRowToProduct(paper, { stock: '4' }).product.stock, 4, 'Goods stock still saves');
}

console.log('\n[#121] Products sample file imports back with zero errors');
{
  const r = productsCsvToList(PRODUCTS_SAMPLE);
  eq(r.errors, [], 'No errors');
  eq(r.products.length, 2, 'Both example rows');
  eq([r.products[0].kind, r.products[0].stock, r.products[0].hsn, r.products[0].taxPercent, r.products[0].purchasePrice], [undefined, 50, '4802', 18, 220], 'Goods row: stock, HSN, GST %, purchase price');
  eq([r.products[1].kind, 'stock' in r.products[1], r.products[1].unit, r.products[1].sellingPrice, r.products[1].rate], ['service', false, 'Page', 5, 5], 'Service row: no stock, its unit and price');
  eq(productsCsvToList(PRODUCTS_SAMPLE, r.products).skipped, 2, 'Importing it again skips both (same names)');
  // The Products screen's CSV export (InventoryView) imports back.
  const exported = [
    toCsvLine(['Name', 'Type', 'HSN/SAC', 'Purchase price', 'Selling price', 'GST %', 'Unit', 'Stock']),
    toCsvLine(['Pen', 'Goods', '9608', 4, 10, 18, 'Pcs', 0]),
    toCsvLine(['Design work', 'Service', '998391', 0, 1500, 18, 'Hrs', '']),
  ].join('\r\n');
  const back = productsCsvToList(exported);
  eq([back.errors.length, back.products[0].stock, back.products[0].hsn, back.products[1].kind], [0, 0, '9608', 'service'], 'The Products export imports back');
  const old = productsCsvToList('name,hsn,rate,gst%,unit,stock\nTea,0902,100,5,Kg,\n');
  eq([old.products[0].sellingPrice, old.products[0].taxPercent, 'stock' in old.products[0]], [100, 5, false], 'Old headings (rate, gst%) still work; blank stock is not counted');
  eq(productsCsvToList('name,type\nX,Repair\n').errors, ['Row 2 (X): Type must be Goods or Service'], 'An unknown Type is a named error');
  eq(productsCsvToList('name,gst %\nX,150\n').errors, ['Row 2 (X): GST % must be 0 to 100'], 'GST % over 100 is refused');
  eq(productsCsvToList('name,stock\nX,abc\n').errors, ['Row 2 (X): stock must be a number'], 'Stock that is not a number is refused');
}

console.log('\n[#121] Clients sample file imports back with zero errors');
{
  const r = clientsCsvToList(CLIENTS_SAMPLE);
  eq(r.errors, [], 'No errors');
  eq(r.clients.map((c) => c.name), ['Demo Traders', 'Sample Studio'], 'Both example rows');
  eq(r.clients[0].address, 'Shop 4, Demo Market, Pune', 'An address with a comma stays whole');
  eq([r.clients[0].state, r.clients[0].gstin], ['Maharashtra', '27AAAAA0000A1Z5'], 'State and GSTIN');
  eq(clientsCsvToList(CLIENTS_SAMPLE, [{ name: ' demo traders ' }]).skipped, 1, 'A client already saved is skipped (any case, trimmed)');
  eq(clientsCsvToList('﻿Customer Name,Mobile\r\nRavi,98000\r\n').clients[0], { name: 'Ravi', address: '', state: '', gstin: '', email: '', phone: '98000' }, 'Excel BOM and other headings (Customer Name, Mobile)');
}

console.log('\n[#143] Unit NA: a service with no quantity');
{
  eq(getUnitUQC('NA'), 'NA', 'NA is a unit with UQC NA');
  eq(hsnUqc({ unit: 'NA', hsn: '8443' }), 'NA', 'GSTR-1 reports UQC NA even when the code is not a 99 SAC');
  const ewb = generateEWayBillJSON(
    { gstin: '29ABCDE1234F1ZW', businessName: 'DiceCodes', state: 'Karnataka', pin: '560001' }, { name: 'Buyer', state: 'Karnataka', pin: '560002' },
    { invoiceNumber: 'DC/1', invoiceDate: '2026-11-07' }, [{ name: 'Setup fee', hsn: '998313', quantity: 1, unit: 'NA', rate: 500, taxPercent: 18 }],
    { subtotal: 500, cgst: 45, sgst: 45, igst: 0, total: 590 }, 'tax-invoice');
  eq(ewb.billLists?.[0]?.itemList?.[0]?.qtyUnit ?? ewb.itemList?.[0]?.qtyUnit, 'OTH', 'E-way bill gets OTH, not NA (not an e-way bill unit)');
}

console.log('\n────────────────────────────────────────');
console.log(`Passed: ${passed}   Failed: ${failed}`);
if (failed) process.exit(1);
