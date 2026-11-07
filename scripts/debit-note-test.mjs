// v1.10.85 (#168) - purchase returns / debit notes: what can go back, the
// debit note's totals and number, stock, what you owe the supplier, GSTR-3B
// ITC, cost centres and closing stock.
//
// Run: `node scripts/debit-note-test.mjs`

import {
  returnableLines, returnProblem, debitNoteFromBill, debitNoteTotals, debitNoteStock, returnedOnBill, withReturns,
  purchaseReturnsTax, netItc, dnCounterKey, formatDnNumber,
} from '../src/utils/debitNotes.js';
import { purchaseBalance, purchaseStatus, purchasePaymentDue, validatePurchasePayments, markPurchasePaid } from '../src/utils/purchasePayments.js';
import { stockDelta, setOffITC } from '../src/utils.js';
import { costCentreReport } from '../src/utils/costCentres.js';
import { closingStock } from '../src/utils/products.js';
import { supplierOutstanding, periodMonths } from '../src/utils/partyOutstanding.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n     expected: ${e}\n     actual:   ${a}`); }
}

// 10 reams @ 250 + 12% and 100 pens @ 10 + 18%: taxable 3500, GST 480, total 3980.
const bill = {
  id: 'pur_1', invoiceNumber: 'DCP/118', date: '2026-11-02', supplierName: 'DiceCodes Paper Mart', supplierGstin: '29AAAAA0000A1Z5',
  interstate: false, costCentre: 'cc_shop', costCentreName: 'Shop', ownerGstin: '29ABCDE1234F1ZW', ownerName: 'DiceCodes',
  items: [
    { name: 'A4 Paper', hsn: '4802', quantity: 10, rate: 250, taxPercent: 12, cessPercent: 0 },
    { name: 'Gel Pen', hsn: '9608', quantity: 100, rate: 10, taxPercent: 18, cessPercent: 0 },
  ],
  totalAmount: 3980, totalTax: 480, taxableAmount: 3500, paymentStatus: 'Unpaid',
};
const products = [{ id: 'p_paper', name: 'A4 Paper', stock: 10 }, { id: 'p_pen', name: 'gel pen', stock: 100 }];

console.log('\n[#168] Choosing what goes back');
{
  eq(returnableLines(bill, []).map((l) => [l.name, l.bought, l.returned, l.left]), [['A4 Paper', 10, 0, 10], ['Gel Pen', 100, 0, 100]], 'Nothing returned yet: everything can go back');
  eq(returnProblem(bill, [], {}), 'Enter the quantity going back on at least one line', 'Nothing chosen: refused');
  eq(returnProblem(bill, [], { 0: 11 }), 'A4 Paper: only 10 can go back (10 bought, 0 already returned)', 'More than was bought: refused');
  eq(returnProblem(bill, [], { 0: -1 }), 'A4 Paper: the quantity cannot be less than 0', 'A negative quantity: refused');
  eq(returnProblem(bill, [], { 0: 2 }), '', '2 reams back: fine');
}

const dn = { id: 'dn_1', dnNumber: 'DN/26-27/0001', ...debitNoteFromBill(bill, [], { 0: 2, 1: 10 }, { date: '2026-11-14', reason: 'Damaged' }) };
console.log('\n[#168] The debit note');
{
  eq([dn.purchaseId, dn.billNumber, dn.billDate, dn.supplierName, dn.supplierGstin, dn.interstate], ['pur_1', 'DCP/118', '2026-11-02', 'DiceCodes Paper Mart', '29AAAAA0000A1Z5', false], 'Against the bill: its number, date and supplier');
  eq(dn.items.map((i) => [i.line, i.name, i.quantity, i.rate, i.taxPercent]), [[0, 'A4 Paper', 2, 250, 12], [1, 'Gel Pen', 10, 10, 18]], 'The returned lines at the bill\'s rates and GST');
  eq([dn.costCentre, dn.ownerGstin, dn.reason], ['cc_shop', '29ABCDE1234F1ZW', 'Damaged'], 'Same cost centre and business as the bill; the reason kept');
  eq(debitNoteTotals(dn), { taxable: 600, cgst: 39, sgst: 39, igst: 0, tax: 78, cess: 0, total: 678 }, 'Taxable 600 (500 + 100), GST 78 split CGST + SGST, total 678');
  eq(debitNoteTotals({ ...dn, interstate: true }), { taxable: 600, cgst: 0, sgst: 0, igst: 78, tax: 78, cess: 0, total: 678 }, 'From another state: all IGST');
  eq(debitNoteTotals({ items: [{ quantity: 1, rate: 100, taxPercent: 28, cessPercent: 12 }] }).cess, 12, 'Cess goes back too');
  eq(returnableLines(bill, [dn]).map((l) => l.left), [8, 90], 'After it: 8 reams and 90 pens can still go back');
  eq(returnProblem(bill, [dn], { 0: 9 }), 'A4 Paper: only 8 can go back (10 bought, 2 already returned)', 'Cannot return more than is left');
  eq(returnableLines(bill, [{ ...dn, cancelled: true }]).map((l) => l.left), [10, 100], 'A cancelled debit note returns nothing');
  eq(returnableLines(bill, [{ ...dn, purchaseId: 'pur_2' }]).map((l) => l.left), [10, 100], 'A debit note against another bill does not count');
}

console.log('\n[#168] Number series');
{
  eq(formatDnNumber(1, '2026-11-14'), 'DN/26-27/0001', 'DN/26-27/0001');
  eq(formatDnNumber(5, '2027-04-01'), 'DN/27-28/0005', 'The year follows the debit note\'s date');
  eq([dnCounterKey('29ABCDE1234F1ZW'), dnCounterKey('')], ['counter_DN@29ABCDE1234F1ZW', 'counter_DN'], 'Each business its own counter');
}

console.log('\n[#168] Stock');
{
  const applied = debitNoteStock(dn, products);
  eq(applied, { p_paper: -2, p_pen: -10 }, 'The returned goods go out of stock (found by name, any case)');
  eq(debitNoteStock({ ...dn, cancelled: true }, products), {}, 'Cancelled: no stock effect');
  eq(stockDelta(applied, debitNoteStock({ ...dn, cancelled: true }, products)), { p_paper: 2, p_pen: 10 }, 'Cancelling puts the goods back');
  eq(stockDelta(applied, {}), { p_paper: 2, p_pen: 10 }, 'Deleting puts the goods back');
  eq(debitNoteStock({ items: [{ name: 'Not a product', quantity: 3 }] }, products), {}, 'A line that is no product moves nothing');
  const asOf = '2026-11-10';
  const before = closingStock([{ id: 'p_paper', stock: 8 }], [], [], asOf, [], [{ ...dn, stockApplied: { p_paper: -2 } }]);
  eq(before.get('p_paper'), 10, 'Stock report: the stock on a date before the return is 2 more than today');
  eq(closingStock([{ id: 'p_paper', stock: 8 }], [], [], asOf, [], [{ ...dn, cancelled: true, stockApplied: {} }]).get('p_paper'), 8, 'A cancelled return changes nothing');
}

console.log('\n[#168] What you owe the supplier');
{
  const [b] = withReturns([bill], [dn]);
  eq(returnedOnBill(bill, [dn]), 678, 'The return takes 678 off the bill');
  eq([purchaseBalance(b), purchaseStatus(b), purchasePaymentDue(b)], [3302, 'Unpaid', 3302], 'Unpaid bill: 3980 - 678 = 3302 still to pay');
  const paid = markPurchasePaid(b, '2026-11-20');
  eq([paid.payments[0].amount, purchaseStatus(paid), purchaseBalance(paid)], [3302, 'Paid', 0], 'Mark as paid pays 3302, and the bill is Paid');
  eq(validatePurchasePayments(paid), '', 'The server accepts that payment');
  const fullyPaid = { ...bill, payments: [{ id: 'x', amount: 3980, date: '2026-11-03', mode: 'upi' }] };
  eq([purchaseBalance(withReturns([fullyPaid], [dn])[0]), validatePurchasePayments(fullyPaid)], [0, ''], 'Paid in full before the return: nothing owed, payments still valid (the supplier owes the refund)');
  eq(purchaseStatus(withReturns([bill], [{ ...dn, ...debitNoteFromBill(bill, [], { 0: 10, 1: 100 }) }])[0]), 'Paid', 'Everything returned: nothing to pay');
  eq(withReturns([{ ...bill, _returned: 678 }], [])[0]._returned, undefined, 'No debit notes left: an old _returned is dropped');
  const months = periodMonths('fy', 2026);
  eq(supplierOutstanding(withReturns([bill], [dn]), months)[0].total, 3302, 'Party Outstanding (suppliers): 3302');
  eq(supplierOutstanding(withReturns([bill], [{ ...dn, cancelled: true }]), months)[0].total, 3980, 'A cancelled debit note: back to 3980');
}

console.log('\n[#168] GSTR-3B input tax credit');
{
  const inNov = (d) => String(d || '').startsWith('2026-11');
  const ret = purchaseReturnsTax([dn, { ...dn, id: 'dn_2', cancelled: true }, { ...dn, id: 'dn_3', date: '2026-12-01' }], inNov);
  eq(ret, { taxable: 600, igst: 0, cgst: 39, sgst: 39, cess: 0 }, 'November: one debit note (the cancelled one and December\'s left out)');
  const itc = { igst: 0, cgst: 240, sgst: 240, cess: 0 };
  eq(netItc(itc, ret), { avl: { igst: 0, cgst: 201, sgst: 201, cess: 0 }, rev: { igst: 0, cgst: 0, sgst: 0, cess: 0 } }, '4(A)(5) is net of the return: 240 - 39 = 201 CGST and SGST');
  const big = netItc({ igst: 0, cgst: 10, sgst: 10, cess: 0 }, ret);
  eq(big, { avl: { igst: 0, cgst: 0, sgst: 0, cess: 0 }, rev: { igst: 0, cgst: 29, sgst: 29, cess: 0 } }, 'Returns more than the month\'s ITC: 4(A)(5) is 0 and 29 is reversed in 4(B)(2)');
  const liability = { igst: 0, cgst: 100, sgst: 100 };
  eq(setOffITC({ igst: liability.igst + big.rev.igst, cgst: liability.cgst + big.rev.cgst, sgst: liability.sgst + big.rev.sgst }, big.avl).payable, { igst: 0, cgst: 129, sgst: 129 }, 'The reversed ITC is paid in cash with the tax');
}

console.log('\n[#168] Cost centres and purchases total');
{
  const { rows, total } = costCentreReport({ purchases: [bill], debitNotes: [dn], centres: [{ id: 'cc_shop', name: 'Shop' }] });
  eq([rows.find((r) => r.id === 'cc_shop').purchases, total.purchases], [2900, 2900], 'Purchases at the bill\'s cost centre: 3500 - 600 = 2900');
  eq(costCentreReport({ purchases: [bill], debitNotes: [{ ...dn, cancelled: true }], centres: [] }).total.purchases, 3500, 'A cancelled debit note takes nothing off');
}

console.log(`\ndebit-note-test: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
