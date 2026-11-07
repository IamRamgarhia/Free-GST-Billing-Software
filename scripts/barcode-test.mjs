// v1.10.85 (#137, #158) - barcodes: the Code 128 encoder against the
// standard's own patterns and hand-worked checksums, the product barcode
// rules, scanning onto an invoice, labels for a purchase, and the label sheet.
//
// Run: `node scripts/barcode-test.mjs`

import { CODE128_PATTERNS, code128Values, code128Modules, code128Svg, barcodeProblem, findByBarcode, nextInternalCode,
  addScannedLine, labelQtysFromBill, labelSheetHtml, LABEL_LAYOUTS, mrpOf, moduleWidthMm, barsWidthMm, codeFitsLabel } from '../src/utils/barcode.js';
import { productsCsvToList } from '../src/utils/listCsv.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; console.log(`  ok ${label}`); }
  else { failed++; console.log(`  FAIL ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
}
const sum = (s) => [...s].reduce((a, c) => a + Number(c), 0);

console.log('\n[Code 128] The pattern table');
eq(CODE128_PATTERNS.length, 107, '107 symbols: values 0-105 and Stop');
eq(CODE128_PATTERNS.slice(0, 106).every((p) => p.length === 6 && sum(p) === 11), true, 'every symbol is 3 bars + 3 spaces, 11 modules wide');
eq([CODE128_PATTERNS[106].length, sum(CODE128_PATTERNS[106])], [7, 13], 'Stop is 4 bars + 3 spaces, 13 modules');
eq(CODE128_PATTERNS.every((p) => (Number(p[0]) + Number(p[2]) + Number(p[4]) + (p.length > 6 ? Number(p[6]) : 0)) % 2 === 0), true,
  'the bars of every symbol add up to an even number (the parity rule a typo in the table breaks)');
eq(new Set(CODE128_PATTERNS).size, 107, 'no two symbols alike');

console.log('\n[Code 128] Known patterns, as printed in the standard (1 = bar, 0 = space)');
const mod = (p) => [...p].map((w, i) => (i % 2 ? '0' : '1').repeat(Number(w))).join('');
eq(mod(CODE128_PATTERNS[0]), '11011001100', 'value 0 (space)');
eq(mod(CODE128_PATTERNS[33]), '10100011000', 'value 33 ("A")');
eq(mod(CODE128_PATTERNS[103]), '11010000100', 'Start A');
eq(mod(CODE128_PATTERNS[104]), '11010010000', 'Start B');
eq(mod(CODE128_PATTERNS[105]), '11010011100', 'Start C');
eq(mod(CODE128_PATTERNS[106]), '1100011101011', 'Stop');

console.log('\n[Code 128] Checksums worked by hand');
// Start B 104 + P 48x1 + J 42x2 + J 42x3 + 1 17x4 + 2 18x5 + 3 19x6 + C 35x7 = 879; 879 mod 103 = 55.
eq(code128Values('PJJ123C'), [104, 48, 42, 42, 17, 18, 19, 35, 55, 106], '"PJJ123C": checksum 55');
// Set C (two digits per symbol) for runs of 4+ digits.
// Start C 105 + 20x1 + 00x2 + 00x3 + 01x4 = 129; 129 mod 103 = 26.
eq(code128Values('20000001'), [105, 20, 0, 0, 1, 26, 106], '"20000001" (Make one): Start C, 20 00 00 01, checksum 26');
// Start B 104 + A 33x1 + B 34x2 + 1 17x3 + Code C 99x4 + 23x5 + 45x6 = 1037; mod 103 = 7.
eq(code128Values('AB12345'), [104, 33, 34, 17, 99, 23, 45, 7, 106], '"AB12345": an odd run keeps its first digit in set B, then Code C 23 45, checksum 7');
// Start C 105 + 12x1 + 34x2 + 56x3 + 78x4 + Code B 100x5 + A 33x6 + B 34x7 + C 35x8 = 1881; mod 103 = 27.
eq(code128Values('12345678ABC'), [105, 12, 34, 56, 78, 100, 33, 34, 35, 27, 106], '"12345678ABC": Start C, then Code B for the letters, checksum 27');
eq(code128Values('A1B2').slice(0, 1), [104], 'short digit runs stay in set B');
// 104 + 33 = 137; mod 103 = 34.
eq(code128Modules('A'), '11010010000' + '10100011000' + '10001011000' + '1100011101011', '"A": Start B, A, checksum 34, Stop - module for module');
eq(code128Modules('abc~').length, 11 * 6 + 13, 'length: 11 modules per symbol (start, 4 characters, checksum) + 13 for Stop');
let threw = false; try { code128Values('₹10'); } catch { threw = true; }
eq(threw, true, 'a character set B cannot print (₹) is refused, never drawn wrong');

console.log('\n[Code 128] SVG');
const svg = code128Svg('20000001');
eq(/^<svg [^>]*viewBox="0 0 99 10"/.test(svg), true, 'width: 10 quiet + 6 symbols x 11 (start, 4 pairs, checksum) + 13 Stop + 10 quiet = 99 modules');
eq((svg.match(/M\d+ 0h\d+v10h-\d+z/g) || []).length, 6 * 3 + 4, 'one rectangle per bar: 3 per symbol, 4 in Stop');
eq(svg.includes('M10 0h2v10h-2z'), true, 'the first bar starts after the 10-module quiet zone, 2 wide (Start C)');
eq(/width="25.146mm"/.test(code128Svg('20000001', 0.254)), true, 'with a bar width: 99 modules x 0.254 mm, never stretched across');

console.log('\n[Code 128] Bar width in whole printer dots, and what fits a label');
eq(moduleWidthMm('20000001', barsWidthMm('a4-65')), { x: 0.254, modules: 99, fits: true }, '38 x 21 mm label: 2 dots (0.254 mm) a bar');
eq(moduleWidthMm('20000001', 60).x, 0.381, 'a wide label: at most 3 dots (0.381 mm)');
eq([codeFitsLabel('8901234567890', 'a4-65'), codeFitsLabel('8901234567890', 'a4-40')], [false, true], 'a 13-digit code is too long for 38 mm (warned), fine on 48 mm');
eq(codeFitsLabel('₹1', 'a4-65'), false, 'a code that cannot be drawn does not fit');

console.log('\n[Products] A barcode is optional and each product has its own');
const products = [
  { id: 'p1', name: 'DiceCodes Pen', barcode: '8901234567890', sellingPrice: 10, taxPercent: 18 },
  { id: 'p2', name: 'DiceCodes Ink', barcode: '20000007' },
  { id: 'p3', name: 'DiceCodes Register' },
];
eq(barcodeProblem('', products, 'p3'), '', 'blank is fine');
eq(barcodeProblem(' 8901234567890 ', products, 'p1'), '', 'its own code, with spaces round it, is fine');
eq(/already on DiceCodes Pen/.test(barcodeProblem('8901234567890', products, 'p3')), true, 'a code another product has is refused, naming that product');
eq(/already on DiceCodes Ink/.test(barcodeProblem('20000007', products, undefined)), true, 'a new product cannot take it either');
eq(/letters, digits/.test(barcodeProblem('₹99', products, 'p3')), true, 'a character a label cannot print is refused');
eq(/up to 24/.test(barcodeProblem('9'.repeat(25), products, 'p3')), true, 'longer than fits a label (24) is refused');
eq(findByBarcode(products, ' 20000007\n')?.id, 'p2', 'a scan with a line end finds the product');
eq(findByBarcode(products, 'abc'), null, 'an unknown code finds nothing');
eq(findByBarcode([{ id: 'x', barcode: 'ABC-1' }], 'abc-1')?.id, 'x', 'Caps Lock on the scanner still finds it');
eq(nextInternalCode([]), '20000001', '"Make one" starts at 20000001');
eq(nextInternalCode(products), '20000008', '...and goes on from the highest made so far');
eq(nextInternalCode([{ barcode: '20000001' }, { barcode: '20000002' }, { barcode: '8901234567890' }]), '20000003', 'other codes do not change the count');
eq(mrpOf(products[0]), 11.8, 'MRP is the selling price with GST');

console.log('\n[Invoice] Scanning adds the product, scanning again adds 1');
const fill = (line) => ({ ...line, name: 'DiceCodes Pen', productId: 'p1', rate: 10, hsn: '9608' });
let n = 0;
const blank = () => ({ id: `new${++n}`, name: '', quantity: 1 });
let items = [{ id: 'a', name: '', quantity: 1 }];
items = addScannedLine(items, products[0], fill, blank);
eq(items.map((i) => [i.id, i.name, i.quantity]), [['a', 'DiceCodes Pen', 1]], 'the first scan fills the empty line');
items = addScannedLine(items, products[0], fill, blank);
eq(items.map((i) => [i.id, i.quantity]), [['a', 2]], 'the same code again: quantity 2, no second line');
const withCharge = [...items, { id: 'd', name: 'Delivery charges', isCharge: true, quantity: 1 }];
const ink = addScannedLine(withCharge, products[1], (l) => ({ ...l, name: 'DiceCodes Ink', productId: 'p2' }), blank);
eq(ink.map((i) => i.id), ['a', 'new1', 'd'], 'another product adds a line, before the delivery charges');
eq(withCharge[0].quantity, 2, 'the list it was given is not changed');
const boxLine = [{ id: 'bx', productId: 'p1', name: 'DiceCodes Pen', quantity: 1, unit: 'Box', unitFactor: 12, baseUnit: 'Pcs' }];
const afterBox = addScannedLine(boxLine, products[0], fill, blank);
eq(afterBox.map((i) => [i.id, i.quantity, i.unit || '']), [['bx', 1, 'Box'], ['new2', 1, '']], 'a line in Boxes is left alone: the scanned piece goes on a line of its own');

console.log('\n[Purchase] Labels for a bill: by productId, else by name, in the base unit');
const rice = { id: 'p4', name: 'DiceCodes Rice', unit: 'Kg' };
const bill = { id: 'b1', items: [
  { name: 'DiceCodes Ink', productId: 'p2', quantity: 3 },
  { name: 'dicecodes pen ', quantity: 2.5 },
  { name: 'DiceCodes Pen', quantity: 1 },
  { name: 'Freight', quantity: 1 },
  { name: 'DiceCodes Register', quantity: 0 },
  { name: 'DiceCodes Ink', productId: 'p2', quantity: 2, unit: 'Box', unitFactor: 12, baseUnit: 'Pcs' },
  { name: 'DiceCodes Rice', quantity: 25.5 },
] };
const fromBill = labelQtysFromBill(bill, [...products, rice]);
eq(fromBill.rows.map((r) => [r.product.id, r.qty]), [['p2', 27], ['p1', 4], ['p4', 1]],
  '3 + 2 boxes of 12 = 27; 2.5 rounds up to 3, + 1; 25.5 Kg of rice gets one label, not 26');
eq(fromBill.unmatched, ['Freight'], 'a line with no product is named');
const returned = labelQtysFromBill(bill, [...products, rice], [{ purchaseId: 'b1', items: [{ line: 0, name: 'DiceCodes Ink', quantity: 1 }] }]);
eq(returned.rows[0].qty, 26, 'one ink sent back on a debit note: one label fewer');

console.log('\n[Labels] The sheet');
const lbl = { name: 'DiceCodes <Pen> & Co', code: '20000001', price: 'MRP ₹11.80', business: 'DiceCodes' };
const html = labelSheetHtml(Array(70).fill(lbl), 'a4-65');
eq((html.match(/class="label"/g) || []).length, 70, '70 labels drawn');
eq((html.match(/class="sheet"/g) || []).length, 2, '65 per A4 sheet: 2 sheets');
eq(html.includes('&lt;Pen&gt; &amp; Co') && !html.includes('<Pen>'), true, 'names are escaped (no HTML from a product name)');
eq(/size: A4 portrait/.test(html), true, 'A4 page');
const roll = labelSheetHtml([{ name: 'x', code: '1' }, { name: 'y', code: '2' }], 'roll-50x25');
eq([(roll.match(/class="sheet"/g) || []).length, /size: 50mm 25mm/.test(roll)], [2, true], 'thermal roll: one label per 50 x 25 mm page');
const bad = labelSheetHtml([{ name: 'Old', code: '₹12' }, { name: 'Good', code: '20000001' }], 'a4-65');
eq([/invalid code/.test(bad), (bad.match(/<svg /g) || []).length], [true, 1], 'a stored code that cannot be drawn shows "invalid code"; the other labels still print');
eq(/class="biz"|class="price"/.test(roll), false, 'business name and price are left out when not wanted');
eq(LABEL_LAYOUTS.filter((l) => !l.roll).every((l) => l.left * 2 + l.cols * l.w + (l.cols - 1) * l.gapX <= 210.5 && l.top + l.rows * l.h <= 297), true,
  'every A4 grid fits on the sheet');

console.log('\n[Import] The products CSV carries the barcode');
const csv = productsCsvToList([
  'Name,Barcode,Selling price',
  'DiceCodes Stapler,8909999000011,90',
  'DiceCodes Clip,8901234567890,5',
  'DiceCodes Tape,8909999000011,30',
  'DiceCodes Register,20000009,50',
].join('\n'), products);
eq(csv.products.map((p) => [p.name, p.barcode]), [['DiceCodes Stapler', '8909999000011']], 'a new product gets its barcode');
eq(csv.updates.map((p) => [p.id, p.barcode]), [['p3', '20000009']], 'a saved product with no barcode gets it filled in');
eq(csv.errors.length === 2 && /DiceCodes Pen/.test(csv.errors[0]) && /DiceCodes Stapler/.test(csv.errors[1]), true,
  'a code already on another product, or twice in the file, is refused with its row');
const sci = productsCsvToList('Name,Barcode\nDiceCodes Glue,8.90123E+12\n', products);
eq([sci.products.length, /set the Barcode column to Text/.test(sci.errors[0] || '')], [0, true], 'a code Excel turned into 8.90123E+12 is refused, saying how to fix it');
const off = productsCsvToList('Name,Barcode\nDiceCodes Glue,8909999000028\n', products, [], { barcodes: false });
eq(off.products[0]?.barcode, undefined, 'with Barcodes off the column is ignored');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
