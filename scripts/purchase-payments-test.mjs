// v1.10.83 (#123) - payments to suppliers on purchase bills: what is owed,
// the status, Mark as paid / Unpaid, the checks the server makes, and what
// each supplier is owed.
//
// Run: `node scripts/purchase-payments-test.mjs`

import {
  purchaseOwed, purchasePaid, purchaseStatus, purchaseBalance, purchasePaymentDue,
  validatePurchasePayment, validatePurchasePayments, withPurchasePayments, markPurchasePaid, markPurchaseUnpaid,
} from '../src/utils/purchasePayments.js';
import { periodMonths, supplierOutstanding } from '../src/utils/partyOutstanding.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; console.log(`  ok ${label}`); }
  else { failed++; console.log(`  FAIL ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
}

// ₹10,000 + 18% GST = ₹11,800.
const bill = (extra = {}) => ({ id: 'pur_1', invoiceNumber: 'GS/0457', supplierName: 'Gupta Steel', date: '2026-10-05', items: [{ name: 'Rod', quantity: 10, rate: 1000, taxPercent: 18 }], ...extra });
const pay = (amount, mode = 'upi', extra = {}) => ({ id: `p${amount}`, amount, date: '2026-10-10', mode, ...extra });

console.log('\n[supplier payments] Balance and status');
{
  const b = bill();
  eq([purchaseOwed(b), purchasePaid(b), purchaseBalance(b), purchaseStatus(b)], [11800, 0, 11800, 'Unpaid'], 'A new bill owes its total and is Unpaid');
  const part = withPurchasePayments(b, [pay(5000)]);
  eq([part.paidAmount, purchaseBalance(part), part.paymentStatus], [5000, 6800, 'Partial'], '₹5,000 by UPI: Partly paid, ₹6,800 left');
  const full = withPurchasePayments(part, [...part.payments, pay(6800, 'cash')]);
  eq([full.paidAmount, purchaseBalance(full), full.paymentStatus], [11800, 0, 'Paid'], 'Then ₹6,800 cash: Paid, nothing left');
  const deleted = withPurchasePayments(full, full.payments.slice(0, 1));
  eq(deleted.paymentStatus, 'Partial', 'Deleting a payment makes it Partly paid again');
  eq(withPurchasePayments(full, []).paymentStatus, 'Unpaid', 'Deleting every payment makes it Unpaid');
  eq(purchaseStatus(withPurchasePayments(b, [pay(11799.996)])), 'Paid', 'Less than a paisa short is Paid');
}

console.log('\n[supplier payments] TDS you keep back');
{
  // TDS 2% under 194C on ₹10,000 taxable = ₹200; the supplier is owed ₹11,600.
  const b = bill({ tdsAmount: 200, tdsSection: '194C', tdsRate: 2 });
  eq([purchaseOwed(b), purchasePaymentDue(b)], [11600, 11600], 'Owed is the total less TDS');
  eq(withPurchasePayments(b, [pay(11600)]).paymentStatus, 'Paid', 'Paying the total less TDS is Paid');
  eq(purchaseOwed(bill({ tdsAmount: 99999 })), 0, 'TDS more than the total never makes the amount owed negative');
}

console.log('\n[supplier payments] Bills saved before payments existed');
{
  eq([purchaseStatus(bill({ paymentStatus: 'Paid' })), purchaseBalance(bill({ paymentStatus: 'Paid' }))], ['Paid', 0], 'An old bill marked Paid stays Paid and owes nothing');
  eq([purchaseStatus(bill({ paymentStatus: 'Partial' })), purchaseBalance(bill({ paymentStatus: 'Partial' }))], ['Partial', 11800], 'An old Partial bill stays Partly paid; with no amounts it still shows the total');
  eq(purchaseStatus(bill({ paymentStatus: 'nonsense' })), 'Unpaid', 'Anything else is Unpaid');
  eq(purchaseStatus(bill({ paymentStatus: 'Paid', payments: [pay(1000)] })), 'Partial', 'Once payments are recorded they decide, not the old mark');
  eq(purchasePaymentDue(bill({ paymentStatus: 'Paid' })), 11800, 'A payment on an old Paid bill starts at the full amount');
}

console.log('\n[supplier payments] Mark as paid and Unpaid');
{
  const today = '2026-10-29';
  const paid = markPurchasePaid(withPurchasePayments(bill(), [pay(5000)]), today);
  const auto = paid.payments[1];
  eq([paid.paymentStatus, auto.amount, auto.mode, auto.auto, auto.date], ['Paid', 6800, 'other', true, today], 'Mark as paid records one payment (mode Other) for the balance');
  const back = markPurchaseUnpaid(paid);
  eq([back.paymentStatus, back.payments.length, purchaseBalance(back)], ['Partial', 1, 6800], 'Unpaid takes back only that payment; yours stay');
  eq(markPurchaseUnpaid(markPurchasePaid(bill(), today)).paymentStatus, 'Unpaid', 'Paid then Unpaid on a bill with no payments is Unpaid again');
  // v1.10.85 (#184) - Paid records how it was paid; Cash reaches the Cash book.
  eq(markPurchasePaid(bill(), today, new Date(), 'cash').payments.slice(-1)[0].mode, 'cash', 'marked paid in cash: the payment is a cash payment');
  eq(markPurchasePaid(bill(), today).payments.slice(-1)[0].mode, 'other', 'no mode given: other, as before');
  eq(markPurchasePaid(bill({ tdsAmount: 11800 }), today).payments, undefined, 'Nothing owed: marked Paid without a ₹0 payment');
  eq(markPurchasePaid(bill({ tdsAmount: 11800 }), today).paymentStatus, 'Paid', '...and it is Paid');
}

console.log('\n[supplier payments] Checks before saving');
{
  eq(validatePurchasePayment(pay(500)), '', 'A plain payment is fine');
  eq(validatePurchasePayment({ ...pay(500), amount: '250.50' }), '', 'An amount typed as text is fine');
  eq(validatePurchasePayment({ ...pay(500), amount: 0 }), 'Enter an amount more than 0', 'Zero is refused');
  eq(validatePurchasePayment({ ...pay(500), amount: -1 }), 'Enter an amount more than 0', 'A negative amount is refused');
  eq(validatePurchasePayment({ ...pay(500), amount: 'abc' }), 'Enter an amount more than 0', 'Not a number is refused');
  eq(validatePurchasePayment({ ...pay(500), date: '' }), 'Enter the payment date', 'A date is required');
  eq(validatePurchasePayment({ ...pay(500), date: '2026-02-30' }), 'Enter the payment date', '30 February is not a date');
  eq(validatePurchasePayment({ ...pay(500), reference: 'x'.repeat(61) }), 'The reference / cheque no. is too long (60 letters at most)', 'A very long reference is refused');
  eq(validatePurchasePayment([]), 'Invalid payment', 'Not an object');
  eq(validatePurchasePayments(bill()), '', 'A bill with no payments is fine');
  eq(validatePurchasePayments(bill({ payments: 'x' })), 'Invalid payments', 'Payments must be a list');
  eq(validatePurchasePayments(bill({ payments: [pay(11800.9)] })), '', 'Up to a rupee over the bill is allowed (rounding)');
  eq(validatePurchasePayments(bill({ payments: [pay(6000), pay(6000)] })), 'Payments of 12000.00 are more than the 11800.00 this bill comes to', 'More than a rupee over is refused');
  eq(validatePurchasePayments(bill({ tdsAmount: 200, payments: [pay(11800)] })), 'Payments of 11800.00 are more than the 11600.00 this bill comes to', 'The limit is the total less TDS');
  eq(validatePurchasePayments(bill({ payments: [pay(100, 'cash', { date: 'x' })] })), 'Enter the payment date', 'Each payment is checked');
}

console.log('\n[supplier payments] What each supplier is owed');
{
  const fy = periodMonths('fy', 2026);
  const rows = supplierOutstanding([
    bill({ id: 'a', payments: [pay(5000)] }),                                       // 6,800 in Oct
    bill({ id: 'b', supplierName: 'gupta steel ', date: '2026-11-02' }),            // 11,800 in Nov, same supplier
    bill({ id: 'c', date: '2026-02-10' }),                                          // before the year: Earlier
    bill({ id: 'd', supplierName: 'Arora Paper', paymentStatus: 'Paid' }),          // old Paid: nothing
    bill({ id: 'e', supplierName: 'Bansal', tdsAmount: 200, payments: [pay(11600)] }), // paid in full less TDS
    bill({ id: 'f', supplierName: 'Later', date: '2027-05-01' }),                   // after the year
  ], fy);
  eq(rows.map((r) => [r.name, r.earlier, r.months, r.total]), [['Gupta Steel', 11800, { '2026-10': 6800, '2026-11': 11800 }, 30400]], 'One row per supplier, by month, paid bills left out');
}

console.log('\n────────────────────────────────────────');
console.log(`Passed: ${passed}   Failed: ${failed}`);
if (failed) process.exit(1);
