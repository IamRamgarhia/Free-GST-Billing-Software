// v1.10.85 (#148, #142) - alternate units, categories and brands, stock
// adjustments, the low-stock purchase order, the Products report filters and
// the serial number trail (src/utils/stock.js), and where stock and GSTR-1
// count a line billed in boxes.
//
// Run: `node scripts/stock-test.mjs`

import { normaliseCategory, categoryProblem, categoryOptions, inCategory, brandOptions, productMatches, hasAltUnit, altUnitText, altUnitProblem,
  lineInUnit, adjustmentProblem, makeAdjustment, reorderLines, productSales, serialTrail } from '../src/utils/stock.js';
import { stockEffect, baseQty, hsnUqc } from '../src/utils.js';
import { closingStock, costOfGoodsSold } from '../src/utils/products.js';
import { hsnSummary } from '../src/utils/gstr1Json.js';
import { debitNoteStock, returnableLines } from '../src/utils/debitNotes.js';
import { billFormFromPo } from '../src/utils/purchaseOrders.js';
import { lockProblem } from '../src/utils/periodLock.js';
import { productsCsvToList } from '../src/utils/listCsv.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; console.log(`  ok ${label}`); }
  else { failed++; console.log(`  FAIL ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
}

const pen = { id: 'pen', name: 'DiceCodes Gel Pen', unit: 'Pcs', sellingPrice: 10, rate: 10, purchasePrice: 6, taxPercent: 18, hsn: '9608', stock: 100,
  altUnit: 'Box', altFactor: 12, category: 'Stationery > Pens > Gel', brand: 'DiceCodes' };
const shirt = { id: 'shirt', name: 'DiceCodes Formal Shirt', unit: 'Pcs', sellingPrice: 800, purchasePrice: 500, stock: 3, category: 'Garments > Men > Shirts > Formal', brand: 'DiceWear' };
const tee = { id: 'tee', name: 'DiceCodes Tee', unit: 'Pcs', sellingPrice: 300, purchasePrice: 150, stock: 0, category: 'garments > men', brand: 'dicewear' };
const repair = { id: 'fix', name: 'Repair', kind: 'service', unit: 'Hrs', sellingPrice: 500 };
const products = [pen, shirt, tee, repair];

console.log('\n[#148] Alternate units on a product');
eq([hasAltUnit(pen), hasAltUnit(shirt), altUnitText(pen)], [true, false, '1 Box = 12 Pcs'], 'a second unit, and its line of text');
eq(altUnitProblem({ unit: 'Pcs', altUnit: '' }), '', 'none is fine');
eq(altUnitProblem({ unit: 'Pcs', altUnit: 'Box', altFactor: 12 }), '', 'Box = 12 Pcs is fine');
eq(/different/.test(altUnitProblem({ unit: 'Pcs', altUnit: 'pcs', altFactor: 12 })), true, 'the same unit twice is refused');
eq(/how many Pcs make one Box/.test(altUnitProblem({ unit: 'Pcs', altUnit: 'Box', altFactor: 1 })), true, 'a factor of 1 is refused');
eq(/how many/.test(altUnitProblem({ unit: 'Pcs', altUnit: 'Box', altFactor: 'x' })), true, 'a factor that is not a number is refused');

console.log('\n[#148] Picking the box on a line');
const line = { id: 'l1', name: pen.name, productId: 'pen', unit: 'Pcs', quantity: 2, rate: 10 };
const box = lineInUnit(line, pen, 'Box');
eq([box.unit, box.unitFactor, box.baseUnit, box.rate], ['Box', 12, 'Pcs', 120], 'Box: factor 12, rate 12 x 10');
eq(lineInUnit(line, { ...pen, altPrice: 110 }, 'Box').rate, 110, 'the box price saved on the product wins');
eq(lineInUnit(line, pen, 'Box', 'purchase').rate, 72, 'on a purchase: 12 x the purchase price');
const back = lineInUnit(box, pen, 'Pcs');
eq([back.unit, back.rate, 'unitFactor' in back, 'baseUnit' in back], ['Pcs', 10, false, false], 'back to Pcs: the piece price, no factor left');
const other = lineInUnit(box, pen, 'Kg');
eq([other.unit, other.rate, 'unitFactor' in other], ['Kg', 120, false], 'another unit: only the unit changes, and stock no longer multiplies');
eq(line.unit, 'Pcs', 'the line it was given is not changed');

console.log('\n[#148] Stock and GSTR-1 count the base unit');
eq(baseQty({ quantity: 2, unitFactor: 12 }), 24, '2 boxes = 24');
eq(baseQty({ quantity: 2.5 }), 2.5, 'a line with no factor: its quantity');
eq(stockEffect([box, { productId: 'shirt', quantity: 1 }], 'tax-invoice', 'unpaid'), { pen: -24, shirt: -1 }, 'invoice: 2 boxes take 24 pens out');
eq(stockEffect([box], 'credit-note', 'unpaid'), { pen: 24 }, 'credit note: 24 back');
eq(hsnUqc(box), 'PCS', 'HSN summary unit: PCS (the base unit), not BOX');
const bill = { invoiceType: 'tax-invoice', invoiceDate: '2026-11-10', data: { items: [{ ...box, hsn: '9608', taxPercent: 18 }, { name: pen.name, productId: 'pen', unit: 'Pcs', quantity: 5, rate: 10, hsn: '9608', taxPercent: 18 }], totals: {}, client: {}, profile: { state: 'Punjab' }, details: { placeOfSupply: 'Punjab' } } };
const hsn = hsnSummary([bill]).rows;
eq(hsn.map((r) => [r.hsn_sc, r.uqc, r.qty]), [['9608', 'PCS', 29]], 'one HSN row: 24 + 5 = 29 PCS');
eq(costOfGoodsSold([bill], products).cost, 174, 'cost of goods sold: 29 x 6');
eq(closingStock(products, [{ ...bill, data: { ...bill.data, stockApplied: stockEffect(bill.data.items, 'tax-invoice', 'unpaid') } }], [], '2026-11-01').get('pen'), 129, 'stock on 1 Nov adds back the 29 sold after it');
const purchase = { date: '2026-11-05', items: [{ name: pen.name, quantity: 3, unitFactor: 12, baseUnit: 'Pcs', unit: 'Box', rate: 72 }] };
eq(closingStock(products, [], [purchase], '2026-11-01').get('pen'), 64, 'a purchase of 3 boxes after the date takes 36 off');
const lines = returnableLines({ id: 'b1', items: purchase.items }, []);
eq([lines[0].unitFactor, lines[0].left], [12, 3], 'a purchase return line keeps the box (3 boxes can go back)');
eq(debitNoteStock({ items: [{ name: pen.name, quantity: 1, unitFactor: 12 }] }, products), { pen: -12 }, 'returning 1 box takes 12 out of stock');
eq(billFormFromPo({ id: 'po1', items: [{ name: pen.name, quantity: 2, unit: 'Box', unitFactor: 12, baseUnit: 'Pcs', rate: 72 }] }, []).items[0].unitFactor, 12, 'a PO in boxes becomes a bill in boxes');

console.log('\n[#148, #142] Categories (one tree, up to 4 levels) and brands');
eq(normaliseCategory(' Garments >Men>  Shirts  > Formal '), 'Garments > Men > Shirts > Formal', 'levels tidied');
eq(categoryProblem('A > B > C > D'), '', '4 levels are fine');
eq(/up to 3 sub-levels/.test(categoryProblem('A > B > C > D > E')), true, 'a 5th level is refused');
eq(categoryOptions(products), ['Garments', 'Garments > Men', 'Garments > Men > Shirts', 'Garments > Men > Shirts > Formal', 'Stationery', 'Stationery > Pens', 'Stationery > Pens > Gel'],
  'every category and the levels above it, once each (other capitals count once)');
eq(products.filter((p) => inCategory(p, 'Garments')).map((p) => p.id), ['shirt', 'tee'], 'a main category takes in its sub-levels');
eq(products.filter((p) => inCategory(p, 'garments > men > shirts')).map((p) => p.id), ['shirt'], 'a sub-level takes in only what is under it');
eq(products.filter((p) => inCategory(p, 'Garments > Me')).map((p) => p.id), [], 'part of a level name is not a match');
eq(brandOptions(products), ['DiceCodes', 'DiceWear'], 'brands, once each');
eq(products.filter((p) => productMatches(p, { brand: 'dicewear', category: 'Garments > Men' })).map((p) => p.id), ['shirt', 'tee'], 'brand and category together');
eq(products.filter((p) => productMatches(p, { item: 'tee' })).map((p) => p.id), ['tee'], 'by item name');

const csv = productsCsvToList('Name,Category,Brand\nDiceCodes Cap,Garments>Men> Caps>Summer>Kids,DiceWear\nDiceCodes Formal Shirt,Garments > Men,DiceWear\n', [{ ...shirt, category: '', brand: '' }]);
eq([csv.products[0]?.category, csv.products[0]?.brand], ['Garments > Men > Caps > Summer', 'DiceWear'], 'CSV import: category (a 5th level dropped) and brand');
eq([csv.updates[0]?.category, csv.updates[0]?.brand], ['Garments > Men', 'DiceWear'], 'CSV import: a saved product without them gets them filled in');

console.log('\nStock adjustments');
eq(adjustmentProblem({ product: pen, quantity: 2, direction: 'remove', reason: 'damaged', date: '2026-11-07' }), '', '2 damaged pens can be written off');
eq(adjustmentProblem({ product: repair, quantity: 1, direction: 'add', reason: 'found', date: '2026-11-07' }), 'A service has no stock', 'a service has no stock to adjust');
eq(adjustmentProblem({ product: pen, quantity: 0, direction: 'add', reason: 'found', date: '2026-11-07' }), 'Enter a quantity more than 0', 'quantity 0 is refused');
eq(adjustmentProblem({ product: pen, quantity: 1, direction: 'add', reason: 'stolen?', date: '2026-11-07' }), 'Choose a reason', 'an unknown reason is refused');
const adj = makeAdjustment({ product: pen, quantity: 2, direction: 'remove', reason: 'damaged', note: ' wet ', date: '2026-11-07' });
eq([adj.quantity, adj.stockApplied, adj.reason, adj.note, adj.productName], [-2, { pen: -2 }, 'damaged', 'wet', 'DiceCodes Gel Pen'], 'the record: -2, its stock move, reason and note');
eq(closingStock(products, [], [], '2026-11-01', [], [], [adj]).get('pen'), 102, 'the stock report on an earlier date adds the 2 written off after it back');
eq(closingStock(products, [], [], '2026-11-07', [], [], [adj]).get('pen'), 100, '...and on the day itself, they are gone');
eq(/closed up to/.test(lockProblem('stock-adjustments', null, adj, '2026-11-30') || ''), true, 'books closed: an adjustment dated in the closed period is refused');
eq(lockProblem('stock-adjustments', null, adj, '2026-10-31'), null, '...and allowed after it');

console.log('\nLow stock -> purchase order');
eq(reorderLines([shirt, tee, repair], 5).map((l) => [l.name, l.quantity, l.rate, l.unit]), [['DiceCodes Formal Shirt', 7, 500, 'Pcs'], ['DiceCodes Tee', 10, 150, 'Pcs']],
  'level 5: 5 x 2 - 3 = 7 shirts, 10 tees, at the purchase price; a service is left out');
eq(reorderLines([{ ...tee, stock: 20 }], 5)[0].quantity, 1, 'never less than 1');

console.log('\n[#142] Product Performance filters');
const sales = [
  { invoiceType: 'tax-invoice', invoiceDate: '2026-11-02', data: { items: [{ productId: 'pen', name: pen.name, quantity: 1, unitFactor: 12, unit: 'Box', rate: 120, taxPercent: 18 }, { name: 'DiceCodes Formal Shirt', quantity: 2, rate: 800, taxPercent: 5 }, { name: 'Delivery', isCharge: true, quantity: 1, rate: 50 }] } },
  { invoiceType: 'credit-note', invoiceDate: '2026-11-03', data: { items: [{ productId: 'shirt', name: 'DiceCodes Formal Shirt', quantity: 1, rate: 800, taxPercent: 5 }] } },
  { invoiceType: 'quotation', invoiceDate: '2026-11-04', data: { items: [{ productId: 'tee', name: 'DiceCodes Tee', quantity: 9, rate: 300 }] } },
];
const all = productSales(sales, products);
eq(all.map((r) => [r.name, r.qty, r.revenue]).sort(), [['DiceCodes Formal Shirt', 1, 800], ['DiceCodes Gel Pen', 12, 120], ['DiceCodes Tee', 0, 0]].sort(),
  'boxes counted in pieces; a credit note takes off; a quotation sells nothing; delivery is not a product');
eq(productSales(sales, products, { category: 'Garments' }).map((r) => r.name).sort(), ['DiceCodes Formal Shirt', 'DiceCodes Tee'], 'category Garments (by name or productId)');
eq(productSales(sales, products, { brand: 'DiceCodes' }).map((r) => r.name), ['DiceCodes Gel Pen'], 'brand DiceCodes');
eq(productSales(sales, products, { item: 'shirt' }).map((r) => r.name), ['DiceCodes Formal Shirt'], 'item name');

console.log('\n[#142, #160] Where a serial number was bought and sold');
const purchases = [{ date: '2026-10-01', supplierName: 'DiceCodes Distributors', invoiceNumber: 'DD-77', items: [{ name: 'DiceCodes Phone X', quantity: 2, serialNo: '356789012345671, 356789012345689' }] }];
const sold = [{ invoiceType: 'tax-invoice', invoiceNumber: 'INV/26-27/0009', invoiceDate: '2026-10-09', clientName: 'Riya', data: { items: [{ name: 'DiceCodes Phone X', description: 'IMEI 356789012345689' }] } }];
const trail = serialTrail('345689', purchases, sold);
eq([trail.bought.length, trail.bought[0]?.invoiceNumber, trail.bought[0]?.supplierName], [1, 'DD-77', 'DiceCodes Distributors'], 'bought: the supplier bill');
eq([trail.sold.length, trail.sold[0]?.invoiceNumber, trail.sold[0]?.clientName], [1, 'INV/26-27/0009', 'Riya'], 'sold: the invoice whose line names it');
eq(serialTrail('35', purchases, sold), { bought: [], sold: [] }, 'fewer than 3 characters: nothing (too many matches)');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
