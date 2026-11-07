// v1.10.85 (#175) - bank matching: reading a statement, suggestions (exact,
// round-off, date window, name / number hints), duplicates and undo.
// Every name and number here is made up (demo brand DiceCodes).
//
// Run: `node scripts/bank-match-test.mjs`

import { parseBankStatement, parseBankRows, BANK_NAMES } from '../src/utils/itr.js';
import {
  toBankLines, freshLines, bookEntries, usedKeys, suggestFor, pickList, matchedLine, ignoredLine, expenseLine, openLine,
  bankPayment, invoiceWithPayment, invoiceWithoutPayment, receiptForPayment, expenseFromLine, bankSummary, nameInText,
  paymentKeyOf, purchaseWithPayments, payStateOf, withoutBankPayment,
} from '../src/utils/bankMatch.js';
import { withPurchasePayments, purchaseStatus, newPurchasePaymentId } from '../src/utils/purchasePayments.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; console.log(`  ok ${label}`); }
  else { failed++; console.log(`  FAIL ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
}

const HDFC = [
  'DiceCodes Demo Account Statement',
  'Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance',
  '03/11/26,NEFT CR-DICECODES CLIENT ONE-INV/26-27/0007,N123456789,03/11/26,,"11,800.00","61,800.00"',
  '04/11/26,UPI-SHARMA PAPER MART-PAYMENT,UPI998877,04/11/26,"5,900.00",,"55,900.00"',
  '05/11/26,SMS CHARGES,,05/11/26,17.70,,"55,882.30"',
  '06/11/26,IMPS-ROUNDOFF CLIENT,IMPS1111,06/11/26,,"2,360.00","58,242.30"',
].join('\n');

console.log('\n[bank match] Reading a statement');
const parsed = parseBankStatement(HDFC);
eq(parsed.bankName, 'HDFC', 'HDFC is detected from its columns');
eq(parsed.transactions[0].reference, 'N123456789', 'The Chq./Ref.No. column is the reference');
eq(parseBankStatement(HDFC, 'HDFC').bankName, 'HDFC', 'A chosen bank is used');
eq(BANK_NAMES.includes('SBI') && !BANK_NAMES.includes('Generic'), true, 'The bank list has SBI and not the fallback');
const lines = toBankLines(parsed.transactions, 'st1');
eq(lines.length, 4, 'Four transaction lines; the title row is skipped');
eq([lines[0].date, lines[0].credit, lines[0].debit, lines[0].status], ['2026-11-03', 11800, 0, 'open'], 'Date to YYYY-MM-DD, amounts with commas read');
eq(lines[2].debit, 17.7, 'A debit of 17.70');
const xl = parseBankRows([['Txn Date', 'Value Date', 'Description', 'Ref No./Cheque No.', 'Debit', 'Credit', 'Balance'], [46330, 46330, 'NEFT DiceCodes', 'R1', '', 1000, 5000]]);
eq([xl.bankName, toBankLines(xl.transactions, 'x')[0]?.date, xl.transactions[0].reference], ['SBI', '2026-11-04', 'R1'], 'Rows from an .xlsx: an Excel day number is a date');
eq(toBankLines([{ date: '05/11/2026 10:42:00', description: 'x', credit: 5 }], 's')[0]?.date, '2026-11-05', 'A date with the time after it');
eq(toBankLines([{ date: 'Opening balance', credit: 5 }, { date: '01/11/2026', credit: 0, debit: 0 }], 's').length, 0, 'Rows with no date or no amount are left out');
eq(['5 November 2026', '05-November-2026', '5 Nov 2026', 'November 5, 2026'].map((d) => toBankLines([{ date: d, description: 'x', credit: 5 }], 's')[0]?.date),
  ['2026-11-05', '2026-11-05', '2026-11-05', undefined], 'Dates with the month in full; month-first is not guessed');
const rowsOf = (rows) => parseBankRows(rows).transactions.map((t) => [t.description, t.debit, t.credit]);
eq(rowsOf([['Date', 'Description', 'Debit', 'Credit', 'Balance'], ['05/11/2026', 'NEFT DiceCodes', '', '1,000.00', '5000'], ['06/11/2026', 'Fee', '10', '', '4990']]),
  [['NEFT DiceCodes', 0, 1000], ['Fee', 10, 0]], 'Date, Description, Debit, Credit, Balance: "desCRiption" is not the credit column');
eq(rowsOf([['Date', 'Description', 'Amount', 'Balance'], ['05/11/2026', 'In', '1,000.00', '5000'], ['06/11/2026', 'Out', '-10', '4990']]),
  [['In', 0, 1000], ['Out', 10, 0]], 'One signed Amount column: minus is money out');
eq(rowsOf([['Date', 'Narration', 'Amount', 'Dr / Cr', 'Balance'], ['05/11/2026', 'In', '1000', 'CR', '5000'], ['06/11/2026', 'Out', '10', 'DR', '4990']]),
  [['In', 0, 1000], ['Out', 10, 0]], 'Amount with a Dr / Cr column');
eq(rowsOf([['Date', 'Particulars', 'Amount', 'Balance'], ['05/11/2026', 'In', '1000.00 Cr', '5000'], ['06/11/2026', 'Out', '10.00 Dr', '4990']]),
  [['In', 0, 1000], ['Out', 10, 0]], 'Amount written as "1000.00 Cr" / "10.00 Dr"');

console.log('\n[bank match] Duplicates');
const again = toBankLines(parsed.transactions, 'st2');
eq(freshLines(lines, again).length, 0, 'The same statement imported again adds nothing');
const overlap = toBankLines(parseBankStatement(HDFC + '\n07/11/26,NEFT CR-NEW,N222,07/11/26,,500.00,"58,742.30"').transactions, 'st3');
eq(freshLines(lines, overlap).map((l) => l.description), ['NEFT CR-NEW'], 'An overlapping statement adds only its new line');
const twin = [{ date: '2026-11-08', credit: 100, debit: 0, reference: '' }, { date: '2026-11-08', credit: 100, debit: 0, reference: '' }];
eq(freshLines([], twin).length, 2, 'Two equal payments on one day in one file both stay');
eq(freshLines([twin[0]], twin).length, 1, '... and only the one not saved yet is added');
eq(freshLines([{ date: '2026-11-08', credit: 0, debit: 100, reference: 'A-1' }], [{ date: '2026-11-08', credit: 100, debit: 0, reference: 'A-1' }]).length, 1, 'Money in and money out of the same amount are different lines');
const saved = [{ date: '2026-11-09', credit: 250, debit: 0, reference: '', description: 'UPI/DICECODES' }];
eq(freshLines(saved, [{ date: '2026-11-09', credit: 250, debit: 0, reference: 'UPI123', description: 'UPI/DICECODES' }]).length, 0, 'One file has the reference, the other not: the same description is the same line');
eq(freshLines(saved, [{ date: '2026-11-09', credit: 250, debit: 0, reference: '', description: 'IMPS OTHER' }]).length, 1, '... another description is another line');
eq(freshLines([{ ...saved[0], reference: 'R1' }], [{ ...saved[0], reference: 'R2' }]).length, 1, 'Both with references: different references are different lines');

console.log('\n[bank match] Suggestions');
const prof = { gstin: '07ABCDE1234F1Z5', businessName: 'DiceCodes' };
const invUnpaid = { id: 'b1', invoiceNumber: 'INV/26-27/0007', invoiceType: 'tax-invoice', clientName: 'DiceCodes Client One', invoiceDate: '2026-11-01', totalAmount: 11800, status: 'unpaid', payments: [], data: { profile: prof, totals: {} } };
const invRound = { id: 'b2', invoiceNumber: 'INV/26-27/0008', invoiceType: 'tax-invoice', clientName: 'Roundoff Client', invoiceDate: '2026-10-30', totalAmount: 2359.6, status: 'unpaid', payments: [], data: { profile: prof, totals: {} } };
const invPaid = { id: 'b3', invoiceNumber: 'INV/26-27/0009', invoiceType: 'tax-invoice', clientName: 'Third Client', invoiceDate: '2026-10-01', totalAmount: 500, status: 'paid', payments: [{ id: 'pay_x', amount: 500, date: '2026-11-07', mode: 'upi' }], data: { profile: prof, totals: {} } };
const invOld = { id: 'b4', invoiceNumber: 'INV/26-27/0010', invoiceType: 'tax-invoice', clientName: 'Late Client', invoiceDate: '2026-11-20', totalAmount: 11800, status: 'unpaid', payments: [], data: { profile: prof, totals: {} } };
const cancelled = { ...invUnpaid, id: 'b5', status: 'cancelled' };
const quote = { ...invUnpaid, id: 'b6', invoiceType: 'quotation' };
const dollars = { ...invUnpaid, id: 'b7', currency: 'USD' };
const bill = { id: 'p1', invoiceNumber: 'SPM/451', supplierName: 'Sharma Paper Mart', date: '2026-11-02', totalAmount: 5900, paymentStatus: 'Unpaid' };
const expPaid = { id: 'e1', amount: 17.7, date: '2026-11-05', category: 'Bank Charges', description: 'SMS charges', paymentStatus: 'paid' };
const expPart = { id: 'e2', amount: 5900, date: '2026-11-04', paymentStatus: 'partial', paidAmount: 100 };
const entries = bookEntries({ bills: [invUnpaid, invRound, invPaid, invOld, cancelled, quote, dollars], purchases: [bill], expenses: [expPaid, expPart] });
eq(entries.map((e) => e.key), ['invoice:b1:open', 'invoice:b2:open', 'invoice:b3:pay_x', 'invoice:b4:open', 'purchase:p1:open', 'expense:e1:paid'],
  'Cancelled invoices, quotations, other currencies and partly paid expenses are left out');

const best = (line) => suggestFor(line, entries)[0];
let s = best(lines[0]);
eq([s.key, s.record], ['invoice:b1:open', true], 'Exact: money in of 11,800 is the unpaid invoice of 11,800');
eq(s.why, ['Same amount', '2 days after the unpaid invoice', 'INV/26-27/0007 is in the description', 'DiceCodes Client One is in the description'], 'It says why: amount, date, number, name');
eq(suggestFor(lines[0], entries).map((x) => x.key), ['invoice:b1:open'], 'An invoice dated after the payment by more than 7 days is not suggested');
s = best(lines[1]);
eq([s.key, s.why.includes('Sharma Paper Mart is in the description')], ['purchase:p1:open', true], 'Money out of 5,900 is the unpaid purchase bill, with the supplier named');
eq(best(lines[2]).key, 'expense:e1:paid', 'Bank charges of 17.70 match the expense already entered');
s = best(lines[3]);
eq([s.key, s.why[0]], ['invoice:b2:open', 'Amount 0.40 apart (round-off)'], 'Round-off: 2,360 matches an invoice of 2,359.60');
const late = { id: 'l', date: '2026-11-20', description: 'UPI', reference: '', credit: 500, debit: 0 };
eq(suggestFor(late, entries).length, 0, 'Date window: a payment recorded 13 days earlier is not suggested');
eq(best({ ...late, date: '2026-11-14' })?.key, 'invoice:b3:pay_x', '... 7 days later it is (the payment already recorded)');
eq(suggestFor({ ...late, credit: 502 }, entries).length, 0, 'More than a rupee apart is not a match');
const twoSame = bookEntries({ bills: [{ ...invUnpaid, id: 'n1', invoiceNumber: 'INV-A', clientName: 'Alpha Stores' }, { ...invUnpaid, id: 'n2', invoiceNumber: 'INV-B', clientName: 'Kaveri Ventures' }] });
eq(suggestFor({ ...lines[0], description: 'NEFT KAVERI VENTURES' }, twoSame)[0].id, 'n2', 'Name hint: of two invoices of the same amount, the one whose client is named comes first');
eq(suggestFor({ ...lines[0], description: 'NEFT INVB' }, twoSame)[0].id, 'n2', 'Number hint: the invoice number in the description comes first');
eq(nameInText('The Traders Pvt Ltd', 'neftsomeone'), false, 'Common words of a name are not a hint');
eq(suggestFor({ ...lines[3], credit: 2359 }, entries).map((x) => x.key), [], 'Round-off: a payment short of an unpaid invoice is not offered (it would stay Partly paid)');
const cashBooks = bookEntries({
  bills: [{ ...invPaid, payments: [{ id: 'pay_c', amount: 500, date: '2026-11-07', mode: 'cash' }] }],
  purchases: [{ ...bill, payments: [{ id: 'pp_c', amount: 5900, date: '2026-11-04', mode: 'Cash' }] }],
  expenses: [{ ...expPaid, paymentMode: 'Cash' }, { ...expPaid, id: 'e9', paymentMode: 'UPI' }],
});
eq(cashBooks.map((e) => e.key), ['expense:e9:paid'], 'Payments and expenses paid in cash are never matched to the bank');
const legacy = { ...invPaid, payments: [{ amount: 200, date: '2026-11-07', mode: 'upi', note: 'a' }, { amount: 300, date: '2026-11-07', mode: 'upi', note: 'b' }] };
const k1 = bookEntries({ bills: [legacy] }).map((e) => e.key);
const k2 = bookEntries({ bills: [{ ...legacy, payments: legacy.payments.slice(1) }] }).map((e) => e.key);
eq([k1.length, k1[1] === k2[0], k1[1] === `invoice:b3:${paymentKeyOf(legacy.payments[1])}`], [2, true, true], 'An old payment with no id keeps its key when another is deleted');

console.log('\n[bank match] Confirm and undo');
const pay = bankPayment(lines[0], 'pay_bank1');
eq([pay.amount, pay.date, pay.mode, pay.reference], [11800, '2026-11-03', 'bank-transfer', 'N123456789'], 'The payment: bank date, Bank transfer, the statement reference');
const paidBill = invoiceWithPayment(invUnpaid, pay);
eq([paidBill.status, paidBill.paidAmount, paidBill.payments.length], ['paid', 11800, 1], 'Confirm records it: the invoice is Paid');
const receipt = receiptForPayment(paidBill, pay);
eq([receipt.id, receipt.billId, receipt.paymentMode, receipt.referenceNo, receipt.ownerGstin], ['pay_bank1', 'b1', 'bank-transfer', 'N123456789', prof.gstin], 'A receipt for it, of this business');
const matched = matchedLine(lines[0], best(lines[0]), { paymentId: pay.id });
eq([matched.status, matched.match.key, matched.match.recorded], ['matched', 'invoice:b1:pay_bank1', true], 'The line is matched to the payment recorded');
const after = bookEntries({ bills: [paidBill] });
eq(suggestFor(lines[0], after, usedKeys([matched])).length, 0, 'The payment it recorded is not offered to another line');
eq(suggestFor(lines[0], after).map((x) => x.key), ['invoice:b1:pay_bank1'], '(without the match it would be)');
const undone = invoiceWithoutPayment(paidBill, pay.id);
eq([undone.status, undone.paidAmount, undone.payments.length], ['unpaid', 0, 0], 'Undo takes the payment back: Unpaid again');
eq(invoiceWithoutPayment({ ...paidBill, status: 'cancelled' }, pay.id).status, 'cancelled', 'Undo leaves a cancelled invoice cancelled');
eq([openLine(matched).status, openLine(matched).match], ['open', null], 'Undo opens the line again');
eq(suggestFor(lines[0], bookEntries({ bills: [undone] }), usedKeys([openLine(matched)]))[0].key, 'invoice:b1:open', '... and the invoice is suggested again');

const pid = newPurchasePaymentId();
const paidPurchase = withPurchasePayments(bill, [bankPayment(lines[1], pid)]);
eq([purchaseStatus(paidPurchase), paidPurchase.paidAmount], ['Paid', 5900], 'Confirm on a purchase bill: Paid');
eq(purchaseStatus(withPurchasePayments(paidPurchase, [])), 'Unpaid', 'Undo: Unpaid again');
const returned = { ...bill, totalAmount: 5900, _returned: 900 };
const paidLess = purchaseWithPayments(returned, [bankPayment({ ...lines[1], debit: 5000 }, 'pp1')]);
eq([paidLess.paymentStatus, '_returned' in paidLess], ['Paid', false], 'A bill with goods returned is Paid by the rest; the returns are not saved on it');
const handPartial = { ...bill, paymentStatus: 'Partial' };
const before = payStateOf(handPartial);
const withBank = purchaseWithPayments(handPartial, [bankPayment(lines[1], 'pp2')]);
eq(withoutBankPayment('purchase', withBank, 'pp2', before).paymentStatus, 'Partial', 'Undo gives a bill back the status it had (Partly paid by hand)');
eq(withoutBankPayment('purchase', { ...withBank, payments: [...withBank.payments, { id: 'other', amount: 100, date: '2026-11-05' }] }, 'pp2', before).paymentStatus, 'Partial',
  '... worked out from the payments when another was added since');
const invBefore = payStateOf({ ...invUnpaid, status: 'overdue' });
eq(withoutBankPayment('invoice', invoiceWithPayment({ ...invUnpaid, status: 'overdue' }, pay), pay.id, invBefore).status, 'overdue', 'Undo gives an invoice back its status');

const exp = expenseFromLine(lines[2], prof);
eq([exp.amount, exp.category, exp.paymentStatus, exp.paymentMode, exp.ownerGstin, exp.date], [17.7, 'Bank Charges', 'paid', 'Bank Transfer', prof.gstin, '2026-11-05'], 'Add as expense: paid by bank transfer, this business');
const asExp = expenseLine(lines[2], exp);
eq([asExp.status, usedKeys([asExp]).has(`expense:${exp.id}:paid`)], ['expense', true], 'The line is the new expense, which no other line is offered');
eq(ignoredLine(lines[2]).status, 'ignored', 'Ignore');

console.log('\n[bank match] Hand pick and summary');
eq(pickList(lines[0], entries).map((e) => e.key).slice(0, 2), ['invoice:b4:open', 'invoice:b1:open'], 'Hand pick: credits only, nearest amount first (newest on a tie)');
eq(pickList(lines[0], entries, new Set(), 'late').map((e) => e.id), ['b4'], 'Hand pick search by name');
eq(pickList(lines[1], entries).every((e) => e.side === 'debit'), true, 'Debits offer bills and expenses');
const sum = bankSummary([matched, lines[1], ignoredLine(lines[2]), asExp]);
eq([sum.lines, sum.matched, sum.unmatched, sum.ignored, sum.moneyIn, sum.moneyOut, sum.unmatchedOut], [4, 2, 1, 1, 11800, 5935.4, 5900], 'Summary: matched, unmatched, ignored and totals');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
