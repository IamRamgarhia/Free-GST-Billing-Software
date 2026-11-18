// v1.10.85 - the review of #168 / #135, and #171 (discount on purchase lines),
// #160 (serial numbers on purchase lines).
//
// Run: `node scripts/purchase-lines-test.mjs`

import {
  returnableLines, returnProblem, debitNoteFromBill, debitNoteTotals, returnedOnBill, withReturns, editProblem,
  notesToRestamp, freeDnNumber, unmatchedLines, rcmNetOfReturns, purchaseReturnsTax, debitNoteStock,
} from '../src/utils/debitNotes.js';
import {
  purchaseTotals, purchaseLineTax, purchaseUnitCost, lineDiscountFields, lineWithQuantity, purchaseHasSerial, billFormFromPo, poRemainingItems,
  withBillDiscount,
} from '../src/utils/purchaseOrders.js';
import { purchaseBalance, purchaseStatus, markPurchasePaid, validatePurchasePayments } from '../src/utils/purchasePayments.js';
import { supplierOutstanding, periodMonths } from '../src/utils/partyOutstanding.js';
import { releaseChallansPlan, reabsorbChallansPlan, orderStatus } from '../src/utils/salesOrders.js';
import { ownPrefixProblem, prefixClashWarning, belongsToProfile } from '../src/utils.js';
import { purchaseCsvToRecords, salesCsvToBills, emptyImportMessage } from '../src/utils/bulkCsv.js';
import { productKey, findLineProduct, purchaseStockPlan, purchaseStockReversal, lineProductHint } from '../src/utils/purchaseStock.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n     expected: ${e}\n     actual:   ${a}`); }
}
const r2 = (n) => Math.round(n * 100) / 100;

const bill = {
  id: 'pur_1', invoiceNumber: 'DCP/118', date: '2026-11-02', supplierName: 'DiceCodes Paper Mart', interstate: false,
  ownerGstin: '29ABCDE1234F1ZW', ownerName: 'DiceCodes',
  items: [
    { name: 'A4 Paper', quantity: 10, rate: 250, taxPercent: 12, cessPercent: 0 },
    { name: 'Gel Pen', quantity: 100, rate: 10, taxPercent: 18, cessPercent: 0 },
  ],
};
const dnOf = (b, qty, extra = {}) => ({ id: `dn_${Math.random()}`, ...debitNoteFromBill(b, [], qty, { date: '2026-11-14' }), ...extra });

console.log('\n[review 1] Editing a bill that has returns');
{
  const dn = dnOf(bill, { 0: 2 });
  eq(editProblem(bill, bill.items, [dn]), '', 'Unchanged lines: fine');
  eq(editProblem(bill, [{ ...bill.items[0], quantity: 2 }, bill.items[1]], [dn]), '', 'Down to exactly what went back: fine');
  eq(/cannot be less than 2/.test(editProblem(bill, [{ ...bill.items[0], quantity: 1 }, bill.items[1]], [dn])), true, 'Below what went back: refused');
  eq(/cannot be removed or renamed/.test(editProblem(bill, [bill.items[1]], [dn])), true, 'The returned line removed: refused');
  eq(/cannot be removed or renamed/.test(editProblem(bill, [{ ...bill.items[0], name: 'A3 Paper' }, bill.items[1]], [dn])), true, 'The returned line renamed: refused');
  eq(editProblem(bill, [bill.items[0]], [dn]), '', 'A line with nothing returned can go');
  eq(editProblem(bill, [bill.items[1], bill.items[0]], [dn]), '', 'Lines moved around: still found by name');
  eq(editProblem(bill, [], [{ ...dn, cancelled: true }]), '', 'Only a cancelled debit note: anything goes');
  const [b] = withReturns([bill], [dn]);
  const paid = markPurchasePaid({ ...b }, '2026-11-20');
  eq([paid.payments[0].amount, purchaseStatus(paid)], [r2(3980 - 560), 'Paid'], 'Paid on the edit form records the balance less the return (3980 - 560)');
}

console.log('\n[review 3] Debit notes of a bill with no business');
{
  const old = { ...bill, ownerGstin: '', ownerName: '' };
  const dn = debitNoteFromBill(old, [], { 0: 1 }, { owner: { gstin: '27AAPFS9999Q1Z1', name: 'DiceCodes West' } });
  eq([dn.ownerGstin, dn.ownerName], ['27AAPFS9999Q1Z1', 'DiceCodes West'], 'Takes the open business');
  eq(belongsToProfile(dn, { gstin: '29ABCDE1234F1ZW', businessName: 'DiceCodes' }), false, 'So it does not show under another company');
  eq(debitNoteFromBill(bill, [], { 0: 1 }, { owner: { gstin: 'X', name: 'Y' } }).ownerGstin, '29ABCDE1234F1ZW', 'A bill with a business keeps its own');
  const stale = { id: 'dn_9', purchaseId: 'pur_1', ownerGstin: '', ownerName: '' };
  eq(notesToRestamp([bill], [stale]).map((d) => [d.id, d.ownerGstin, d.ownerName]), [['dn_9', '29ABCDE1234F1ZW', 'DiceCodes']], 'A bill assigned (or edited) to a business: its debit notes follow');
  eq(notesToRestamp([bill], [{ ...stale, ownerGstin: '29ABCDE1234F1ZW', ownerName: 'DiceCodes' }]), [], 'Already the same: nothing to save');
  eq(notesToRestamp([{ ...bill, ownerGstin: '', ownerName: '' }], [stale]), [], 'A bill still without a business: left alone');
}

console.log('\n[review 4] Reverse charge: 3.1(d) less the returns');
{
  const rcm = { ...bill, reverseCharge: true };
  const dn = dnOf(rcm, { 0: 2 });
  eq(dn.reverseCharge, true, 'The debit note knows its bill was reverse charge');
  const ret = purchaseReturnsTax([dn, dnOf(bill, { 0: 1 })].filter((d) => d.reverseCharge));
  eq(rcmNetOfReturns({ txval: 3500, iamt: 0, camt: 240, samt: 240, csamt: 0 }, ret), { txval: 3000, iamt: 0, camt: 210, samt: 210, csamt: 0 }, '3500 taxable, 480 tax less 2 reams (500, 60): 3000 and 210 + 210');
  eq(rcmNetOfReturns({ txval: 100, iamt: 0, camt: 5, samt: 5, csamt: 0 }, ret).camt, 0, 'Never below 0');
}

console.log('\n[review 5] A bill sent back in full owes nothing (round-off too)');
{
  const ro = { ...bill, items: [{ name: 'Rice', quantity: 3, rate: 33.3, taxPercent: 5 }], applyRoundOff: true };
  const t = purchaseTotals(ro.items, true);
  eq([r2(t.total), t.roundOff !== 0], [104.9, true], 'A bill of 104.90 rounded to 105');
  const all = dnOf(ro, { 0: 3 });
  eq(returnedOnBill(ro, [all]), r2(t.finalTotal), 'Everything returned: the whole bill, round-off too');
  const [b] = withReturns([ro], [all]);
  eq([purchaseBalance(b), purchaseStatus(b)], [0, 'Paid'], 'Balance 0');
  eq(supplierOutstanding([b], periodMonths('fy', 2026)).length, 0, 'And it leaves Party Outstanding');
  eq(returnedOnBill(ro, [dnOf(ro, { 0: 1 })]), r2(purchaseTotals([{ quantity: 1, rate: 33.3, taxPercent: 5 }]).total), 'Part returned: no round-off');
}

console.log('\n[review 6] Products found by id, and lines with no product');
{
  const withId = { ...bill, items: [{ ...bill.items[0], productId: 'p_x', name: 'Copier paper' }] };
  const dn = dnOf(withId, { 0: 2 });
  eq(dn.items[0].productId, 'p_x', 'The bill line\'s productId is kept');
  eq(debitNoteStock(dn, [{ id: 'p_x', name: 'A4 Paper (renamed)' }]), { p_x: -2 }, 'Stock found by id although the name differs');
  eq(unmatchedLines(dnOf(bill, { 0: 1, 1: 1 }), [{ id: 'p1', name: 'A4 Paper' }]), ['Gel Pen'], 'A returned line with no product is named (for the warning)');
}

console.log('\n[review 7] The debit note date');
{
  eq(returnProblem(bill, [], { 0: 1 }, '2026-11-01'), "The debit note date cannot be before the bill's date (2026-11-02)", 'Before the bill: refused');
  eq(returnProblem(bill, [], { 0: 1 }, '2026-11-02'), '', 'The bill\'s own date: fine');
}

console.log('\n[review 8] An old own prefix SO / DN');
{
  const seriesMap = { '29ABCDE1234F1ZW': { brandPrefix: 'SO' } };
  eq(ownPrefixProblem('SO', { seriesMap, businessKey: '29ABCDE1234F1ZW' }), '', 'A business already numbering with SO keeps saving its settings');
  eq(/Sales Orders/.test(prefixClashWarning('so')), true, '...with a warning');
  eq(ownPrefixProblem('SO', { seriesMap: {}, businessKey: '29ABCDE1234F1ZW' }), 'SO is used for every business by default. Choose another prefix.', 'A new SO prefix is refused');
  eq(ownPrefixProblem('INV', { seriesMap: { k: { brandPrefix: 'INV' } }, businessKey: 'k' }) !== '', true, 'Old rules unchanged for the other prefixes');
  eq(prefixClashWarning('ACME'), '', 'No warning for other prefixes');
}

console.log('\n[review 9] Cancelling an invoice that took over challans');
{
  const so = 'SO/26-27/0001';
  const dc = { id: 'DC1', invoiceNumber: 'DC1', invoiceType: 'delivery-challan', status: 'unpaid', convertedTo: 'INV1',
    data: { details: { salesOrderNo: so }, items: [{ id: 'l1', productId: 'p1', name: 'Chair', quantity: 4 }], stockApplied: {} } };
  const inv = { id: 'INV1', invoiceNumber: 'INV1', invoiceType: 'tax-invoice', status: 'unpaid',
    data: { details: { salesOrderNo: so }, items: [{ id: 'l1', productId: 'p1', name: 'Chair', quantity: 10 }], stockApplied: { p1: -10 } } };
  const rel = releaseChallansPlan(inv, [dc, inv]);
  eq([rel.patches.length, rel.patches[0].convertedTo, rel.patches[0].releasedFrom, rel.patches[0].data.stockApplied, rel.changes],
    [1, undefined, 'INV1', { p1: -4 }, { p1: -4 }], 'Released: not converted any more, its 4 chairs out of stock again (the invoice put back 10)');
  const order = { id: so, invoiceNumber: so, invoiceType: 'sales-order', data: { items: [{ id: 'l1', name: 'Chair', quantity: 10 }] } };
  eq(orderStatus(order, [rel.patches[0], { ...inv, status: 'cancelled' }]), 'partly-dispatched', 'The order counts the challan again: Partly dispatched');
  const back = reabsorbChallansPlan(inv, [rel.patches[0], inv]);
  eq([back.patches[0].convertedTo, back.patches[0].releasedFrom, back.patches[0].data.stockApplied, back.changes],
    ['INV1', undefined, {}, { p1: 4 }], 'Undo the cancel: taken in again, its 4 back (the invoice takes 10 out again)');
  eq(reabsorbChallansPlan(inv, [{ ...rel.patches[0], convertedTo: 'INV2' }, inv]).patches.length, 0, 'Not if the challan was invoiced again meanwhile');
  eq(releaseChallansPlan({ ...inv, data: { ...inv.data, details: {} } }, [dc]).patches.length, 0, 'An invoice from no order: nothing changes');
}

console.log('\n[review 10] A debit note number already in use is skipped');
{
  let n = 0;
  const next = async () => `DN/26-27/000${++n}`;
  eq(await freeDnNumber(next, [{ dnNumber: 'DN/26-27/0001' }, { dnNumber: 'dn/26-27/0002' }]), 'DN/26-27/0003', 'Counter put back by an old backup: the next free number');
}

console.log('\n[#171] Discount on purchase lines');
{
  const plain = { quantity: 10, rate: 250, taxPercent: 12, cessPercent: 0 };
  eq(purchaseLineTax(plain), { gross: 2500, discount: 0, amount: 2500, tax: 300, cess: 0, total: 2800 }, 'No discount: exactly as before');
  eq(purchaseLineTax({ ...plain, discount: 10, discountType: 'percent' }), { gross: 2500, discount: 250, amount: 2250, tax: 270, cess: 0, total: 2520 }, '10%: taxable 2250, GST on that');
  eq(purchaseLineTax({ ...plain, discount: 100 }).amount, 2400, 'An amount (₹100) off the line');
  eq(purchaseLineTax({ ...plain, discount: 9999 }).amount, 0, 'Never more than the line');
  eq(purchaseLineTax({ quantity: '2', rate: '100', taxPercent: '28', cessPercent: '12', discount: '50', discountType: 'percent' }).cess, 12, 'Cess on the discounted value too (form strings)');
  eq(purchaseTotals([plain, { ...plain, discount: 10, discountType: 'percent' }]).taxable, 4750, 'Bill totals');
  eq([purchaseUnitCost(plain), purchaseUnitCost({ ...plain, discount: 10, discountType: 'percent' })], [250, 225], 'Cost price for Products: 225 after 10% off');
  eq([lineDiscountFields(plain), lineDiscountFields({ discount: '5', discountType: 'percent' }), lineDiscountFields({ discount: 0, discountType: 'percent' })],
    [{}, { discount: 5, discountType: 'percent' }, {}], 'Saved only when there is a discount');
  eq(lineWithQuantity({ quantity: 10, discount: 100 }, 2).discount, 20, 'Part of a line: an amount off is shared out');
  eq(lineWithQuantity({ quantity: 10, discount: 10, discountType: 'percent' }, 2).discount, 10, '...a percent stays');
  const db = { ...bill, items: [{ name: 'A4 Paper', quantity: 10, rate: 250, taxPercent: 12, discount: 10, discountType: 'percent' }, { name: 'Gel Pen', quantity: 100, rate: 10, taxPercent: 18, discount: 100 }] };
  const dn = dnOf(db, { 0: 2, 1: 10 });
  eq(debitNoteTotals(dn).taxable, 450 + 90, 'A return of discounted lines returns the discounted value (2 x 225 + 10 x 9)');
  eq(returnableLines(db, [])[0].discount, 10, 'The return window shows the discount');
  const po = { id: 'po_1', items: [{ name: 'Ink', quantity: 10, rate: 50, taxPercent: 18, discount: 50 }] };
  eq(billFormFromPo(po, []).items[0].discount, 50, 'A bill made from a PO keeps its discount');
  eq(poRemainingItems(po, [{ fromPo: 'po_1', items: [{ name: 'Ink', quantity: 6 }] }])[0].discount, 20, '...shared out over what is still to come');
  const csv = purchaseCsvToRecords('Date,Supplier Name,Invoice Number,Item Name,Quantity,Rate,GST %\n2026-11-02,DiceCodes Paper Mart,X1,Pen,2,10,18\n', {});
  eq(csv.purchases?.[0]?.totalAmount, 23.6, 'CSV import totals unchanged (now through the shared maths)');
}

console.log('\n[#160] Serial numbers on purchase lines');
{
  const p = { items: [{ name: 'Phone', serialNo: '356938035643809, 356938035643817' }, { name: 'Case' }] };
  eq([purchaseHasSerial(p, '356938035643817'), purchaseHasSerial(p, '43809'), purchaseHasSerial(p, '999'), purchaseHasSerial(p, '')], [true, true, false, false], 'Found by a whole or part serial / IMEI');
}

console.log('\n[v1.10.86] Discount on the whole purchase bill (before GST)');
{
  const lines = [
    { name: 'Steel', quantity: 1, rate: 6000, taxPercent: 18 },
    { name: 'Rice', quantity: 1, rate: 4000, taxPercent: 5 },
  ];
  const d = withBillDiscount(lines, 1000, 'fixed');
  eq(d.map(i => i.billDiscShare), [600, 400], '₹1,000 off is shared by value: 600 and 400');
  const t = purchaseTotals(d);
  eq([r2(t.taxable), r2(t.tax), r2(t.finalTotal), t.billDiscount], [9000, 1152, 10152, 1000], 'GST on what is left, at each line\'s rate: 972 + 180 = 1,152 ITC');
  eq(withBillDiscount(lines, 10, 'percent').map(i => i.billDiscShare), [600, 400], '10% the same');
  eq(withBillDiscount(lines, 150, 'percent').map(i => i.billDiscShare), [6000, 4000], 'A percent never above 100');
  eq(withBillDiscount(lines, 0, 'fixed'), lines, 'No discount: lines unchanged');
  eq(withBillDiscount(d, 0).some(i => 'billDiscShare' in i), false, 'Taking it off drops the old parts');
  eq(withBillDiscount(d, 500, 'fixed').map(i => i.billDiscShare), [300, 200], 'A new amount replaces the old parts');
  const three = withBillDiscount([1, 2, 3].map(() => ({ quantity: 1, rate: 100, taxPercent: 18 })), 100, 'fixed');
  eq(r2(three.reduce((s, i) => s + i.billDiscShare, 0)), 100, 'The parts add up to the exact paise (33.34 + 33.33 + 33.33)');
  eq(withBillDiscount([{ ...lines[0], discount: 10, discountType: 'percent' }, lines[1]], 940, 'fixed').map(i => i.billDiscShare), [540, 400],
    'Shared by value after line discounts (5,400 and 4,000)');
  eq(withBillDiscount([{ quantity: '2', rate: '50', taxPercent: '18' }], '10', 'fixed')[0].billDiscShare, 10, 'Form strings work');
  eq(purchaseUnitCost({ quantity: 10, rate: 600, taxPercent: 18, billDiscShare: 600 }), 540, 'Cost price for Products after the bill discount');
  eq(lineDiscountFields(d[0]), { billDiscShare: 600 }, 'Saved with the line');
  eq(purchaseTotals(lines).billDiscount, 0, 'A bill without one: 0');

  const db = { ...bill, items: [{ name: 'Steel', quantity: 10, rate: 600, taxPercent: 18 }, { name: 'Rice', quantity: 10, rate: 400, taxPercent: 5 }] };
  const dbd = { ...db, billDiscountValue: 10, billDiscountType: 'percent', items: withBillDiscount(db.items, 10, 'percent') };
  eq(purchaseBalance(dbd), 10152, 'What is owed to the supplier follows');
  eq(validatePurchasePayments({ ...dbd, payments: [{ id: 'a', amount: 10152, date: '2026-11-03', mode: 'upi' }] }), '', 'Paying the discounted total: fine (the server check too)');
  eq(validatePurchasePayments({ ...dbd, payments: [{ id: 'a', amount: 11000, date: '2026-11-03', mode: 'upi' }] }) !== '', true, '...the total before the discount: refused');
  const dn = dnOf(dbd, { 0: 2 });
  eq([dn.items[0].billDiscShare, debitNoteTotals(dn).taxable, debitNoteTotals(dn).tax], [120, 1080, 194.4], 'Returning 2 of 10: their part of the discount goes too (taxable 1,080, GST 194.40)');
  eq(editProblem(dbd, dbd.items, [dn], { value: 10, type: 'percent' }), '', 'Same discount on a bill with a return: fine');
  eq(/cannot change/.test(editProblem(dbd, dbd.items, [dn], { value: 5, type: 'percent' })), true, 'A changed discount on a bill with a return: refused');
  eq(/cannot change/.test(editProblem(dbd, dbd.items, [dn], { value: 10, type: 'fixed' })), true, '...or ₹ in place of %');
  eq(editProblem(dbd, dbd.items, [], { value: 5, type: 'percent' }), '', 'No returns: free to change');
  eq(editProblem(db, db.items, [dnOf(db, { 0: 1 })], { value: 0, type: 'percent' }), '', 'No discount before or after: fine');
}

console.log('\n[#199] One product per item from Purchases');
{
  let n = 0;
  const newId = () => `prod_new${++n}`;
  const pen = { id: 'p_pen', name: 'Blue Pen', stock: 10, purchasePrice: 5, barcode: '8901234567890' };
  const paper = { id: 'p_paper', name: 'A4 Paper', stock: 0 };
  const products = [pen, paper];
  const stockOf = (plan, id) => plan.writes.find((p) => p.id === id)?.stock;
  eq(productKey('  Blue   Pen '), 'blue pen', 'Name key: trimmed, inner spaces collapsed, lower case');
  eq(findLineProduct(products, { name: 'blue  pen' })?.id, 'p_pen', 'Extra inner spaces still find the product');
  eq(findLineProduct(products, { name: '8901234567890' })?.id, 'p_pen', 'A barcode typed as the name finds the product');
  eq(findLineProduct(products, { name: 'Pen (blue)', barcode: '8901234567890' })?.id, 'p_pen', "The line's own barcode finds the product");
  eq(findLineProduct(products, { name: 'Renamed', productId: 'p_pen' })?.id, 'p_pen', 'productId wins over the name');
  eq(findLineProduct(products, { name: 'blue pen', productId: 'gone' })?.id, 'p_pen', 'A deleted product id falls back to the name');

  const add = purchaseStockPlan(products, [{ name: 'Blue  Pen', quantity: 5, rate: 6 }, { name: 'Gel Pen', quantity: 3, rate: 10 }, { name: 'gel pen', quantity: 2, rate: 10 }], [], newId);
  eq(add.items.map((i) => i.productId), ['p_pen', 'prod_new1', 'prod_new1'], 'New bill: each line keeps its productId (two lines of a new item share one)');
  eq([stockOf(add, 'p_pen'), stockOf(add, 'prod_new1'), add.writes.length], [15, 5, 2], 'Stock: Blue Pen +5, one new Gel Pen with 5, no duplicate');
  eq(add.writes.find((p) => p.id === 'p_pen').purchasePrice, 6, 'Latest cost on the existing product');
  eq(purchaseStockPlan(products, [{ name: 'DiceCodes Pen', barcode: '8901234567890', quantity: 1, rate: 5 }], [], newId).writes.map((p) => p.id), ['p_pen'], 'Same barcode: linked, no new product');
  eq(purchaseStockPlan(products, [{ name: 'Blue Pen (from GSTR-2B)', quantity: 1, rate: 5 }], [], newId).writes.length, 0, 'A GSTR-2B placeholder line moves no stock');

  // Editing: the line renamed but still the same product (productId kept).
  const saved = add.items;
  const afterAdd = products.map((p) => (p.id === 'p_pen' ? { ...p, stock: 15 } : p)).concat({ id: 'prod_new1', name: 'Gel Pen', stock: 5 });
  const renamed = purchaseStockPlan(afterAdd, [{ ...saved[0], name: 'Blue Pen 0.7mm', quantity: 7 }], [saved[0]], newId);
  eq([renamed.items[0].productId, stockOf(renamed, 'p_pen'), renamed.writes.length], ['p_pen', 17, 1], 'Rename + qty 5 -> 7: same product, stock +2, no new product');
  const moved = purchaseStockPlan(afterAdd, [{ name: 'A4 Paper', quantity: 5, rate: 200 }], [saved[0]], newId);
  eq([stockOf(moved, 'p_pen'), stockOf(moved, 'p_paper')], [10, 5], 'Line changed to another product: the old one gives back 5, the new one gets 5');
  const removed = purchaseStockPlan(afterAdd, [], [saved[0]], newId);
  eq(stockOf(removed, 'p_pen'), 10, 'Line removed: its stock comes back out');
  const oldBill = [{ name: 'blue pen', quantity: 4, rate: 5 }];
  eq(stockOf(purchaseStockPlan(products, [{ name: 'Blue Pen', quantity: 6, rate: 5 }], oldBill, newId), 'p_pen'), 12, 'Old bill (no productId) edited: matched by name, stock +2');
  eq(purchaseStockReversal(afterAdd, saved), { p_pen: -5, prod_new1: -5 }, 'Deleting the bill takes each product back out by productId');
  eq(purchaseStockReversal(products, oldBill), { p_pen: -4 }, '...and an old bill by name');

  eq(lineProductHint(products, { name: 'Notebook' }), { kind: 'new' }, 'Form hint: a name with no product is a new product');
  eq(lineProductHint(products, { name: 'blue pen' }), null, '...no hint for a product name');
  eq(lineProductHint(products, { name: 'Blue Pen 0.7', productId: 'p_pen' })?.product?.id, 'p_pen', '...a renamed line says which product it still is');
  eq(lineProductHint(products, { name: '' }), null, '...nothing for an empty line');

  const dn = dnOf({ ...bill, items: [{ ...bill.items[0], name: 'A4  paper', productId: 'p_paper' }] }, { 0: 2 });
  eq(dn.items[0].productId, 'p_paper', 'A return to supplier carries the productId');
  eq(debitNoteStock(dn, [{ ...paper, name: 'Renamed paper' }]), { p_paper: -2 }, '...and takes stock from that product even after a rename');
}

console.log('\n[#213] Import says why nothing was imported');
{
  const flipkartHead = 'Order Id,FSN,Tracking ID,Invoice No.,Product,Quantity,Invoice Amount\nOD1,FSN1,TRK1,,DiceCodes Pen,1,100\n';
  eq(/Flipkart orders file, but none of its orders has an invoice number/.test(salesCsvToBills(flipkartHead).errors[0]), true, 'Flipkart file with no invoice numbers: says so');
  const cancelled = 'Invoice Number,Invoice Date,Invoice Type,Client Name,Item Name,Quantity,Rate\nA1,2026-11-01,Sale[Cancelled],DiceCodes,Pen,1,10\n';
  eq(salesCsvToBills(cancelled).errors, ['All the invoices in the file are cancelled, so there is nothing to import.'], 'Every row cancelled: says so');
  const meesho = 'Reason for Credit Entry,Sub Order No,Order Date,SKU,Quantity\nDELIVERED,123_1,2026-11-01,PEN-1,1\n';
  const m = salesCsvToBills(meesho).errors;
  eq([m.length, /marketplace orders file \(Sub Order No, SKU\).*Template/.test(m[0])], [1, true], 'Meesho-like file: one message naming its columns and the Template');
  eq(/marketplace orders file/.test(purchaseCsvToRecords(meesho).errors[0]), true, '...same on the purchase import');
  const quoted = 'Invoice Number,Invoice Date,Client Name,Item Name\n"A1,2026-11-01,DiceCodes,Pen\nA2,2026-11-02,DiceCodes,Ink\n';
  eq(/opening quote/.test(salesCsvToBills(quoted).errors[0]), true, 'An unclosed quote swallowing the file: says to save it again from Excel');
  eq(emptyImportMessage('Invoice Number,Item Name\n'), 'The file has no rows under the header.', 'Only a header: the plain message');
  const neg = 'Invoice Number,Invoice Date,Supplier Name,Item Name,Quantity,Rate\nS1,2026-11-01,DiceCodes Paper Mart,A4 Paper,-2,250\n';
  eq(/returns \(negative quantities\) are not imported.*Return to supplier/.test(purchaseCsvToRecords(neg).errors[0]), true, 'A negative purchase quantity: says to use Return to supplier');
}

console.log(`\npurchase-lines-test: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
