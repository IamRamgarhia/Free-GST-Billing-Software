// v1.10.86 - (#148, #194) Supplier statement.
//
// Run: `node scripts/supplier-statement-test.mjs`
//
// Bills owed (Credit), payments, TDS kept back and returns (Debit), a running
// balance, the opening balance for a date range, and a closing balance that
// agrees with the purchase list's "Balance due".

import { supplierStatement, supplierList, supplierStatementMessage } from '../src/utils/supplierStatement.js';
import { purchaseBalance } from '../src/utils/purchasePayments.js';
import { withReturns } from '../src/utils/debitNotes.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  if (actual === expected) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
}

const line = (rate, quantity = 1, taxPercent = 18) => ({ name: `Item ${rate}`, quantity, rate, taxPercent, cessPercent: 0 });
const bills = [
  // 1000 + 18% = 1180; paid 500 by UPI on 10 Apr, 680 by cash on 5 May.
  { id: 'b1', supplierName: 'DiceCodes Supplies', supplierGstin: '29ABCDE1234F1ZW', invoiceNumber: 'S-1', date: '2026-04-02', items: [line(1000)],
    payments: [{ id: 'p1', amount: 500, date: '2026-04-10', mode: 'upi', reference: 'UTR9' }, { id: 'p2', amount: 680, date: '2026-05-05', mode: 'cash' }] },
  // 2000 + 18% = 2360, unpaid, one item worth 590 sent back on a debit note.
  { id: 'b2', supplierName: 'dicecodes supplies ', invoiceNumber: 'S-2', date: '2026-05-01', items: [line(500, 4)] },
  // An old bill marked Paid with no payment details: 118, counts as paid.
  { id: 'b3', supplierName: 'DiceCodes Supplies', invoiceNumber: 'S-3', date: '2026-03-15', items: [line(100)], paymentStatus: 'Paid' },
  // 10000 + 18%, TDS of 10 kept back, unpaid.
  { id: 'b4', supplierName: 'DiceCodes Supplies', invoiceNumber: 'S-4', date: '2026-06-01', items: [line(10000)], tdsAmount: 10 },
  // Another supplier: never in this statement.
  { id: 'x', supplierName: 'Other Traders', invoiceNumber: 'O-1', date: '2026-04-05', items: [line(50)] },
];
const notes = [
  { id: 'dn1', dnNumber: 'DN/26-27/0001', purchaseId: 'b2', date: '2026-05-20', items: [{ ...line(500, 1), line: 0 }] },
  { id: 'dn2', dnNumber: 'DN/26-27/0002', purchaseId: 'b2', date: '2026-05-21', cancelled: true, items: [{ ...line(500, 1), line: 0 }] },
];

console.log('\n[#194] Whole account');
{
  const st = supplierStatement(bills, notes, 'DiceCodes Supplies');
  eq(st.opening, 0, 'no date range: opening 0');
  eq(st.rows.map((r) => r.kind).join(','), 'bill,payment,bill,payment,bill,payment,return,bill,tds', 'rows in date order, bill before its payments');
  eq(st.rows[0].particulars, 'Purchase bill S-3', 'old bill');
  eq(st.rows[1].particulars, 'Marked paid: S-3', 'old bill marked Paid counts as paid');
  eq(st.rows[3].particulars, 'Paid (UPI UTR9) for S-1', 'payment says how and the reference');
  eq(st.rows[6].particulars, 'Goods returned: debit note DN/26-27/0001 on S-2', 'the cancelled debit note is left out');
  eq(st.rows[6].debit, 590, 'return at its value with GST');
  eq(st.rows[8].debit, 10, 'TDS kept back');
  eq(st.totals.billed, 118 + 1180 + 2360 + 11800, 'billed');
  eq(st.totals.paid, 118 + 1180, 'paid');
  eq(st.totals.returned, 590, 'returned');
  eq(st.totals.tds, 10, 'TDS');
  eq(st.closing, 2360 - 590 + 11800 - 10, 'closing = what is still owed');
  const listed = withReturns(bills, notes).filter((p) => p.id !== 'x').reduce((s, p) => s + purchaseBalance(p), 0);
  eq(st.closing, Math.round(listed * 100) / 100, 'closing agrees with Balance due on the purchase list');
  eq(st.rows[st.rows.length - 1].balance, st.closing, 'last running balance = closing');
}

console.log('\n[#194] Date range');
{
  const st = supplierStatement(bills, notes, 'DiceCodes Supplies', { from: '2026-05-01', to: '2026-05-31' });
  eq(st.opening, 1180 - 500, 'opening: S-3 settled, S-1 part paid before 1 May');
  eq(st.rows.map((r) => r.kind).join(','), 'bill,payment,return', 'only May rows');
  eq(st.closing, 680 - 680 + 2360 - 590, 'closing at 31 May');
  eq(st.totals.billed, 2360, 'billed in May only');
}

console.log('\n[#194] Returned after paying in full: they owe you');
{
  const paid = [{ ...bills[1], payments: [{ id: 'q', amount: 2360, date: '2026-05-02', mode: 'cash' }] }];
  const st = supplierStatement(paid, notes, 'DiceCodes Supplies');
  eq(st.closing, -590, 'minus balance: the supplier owes the refund');
}

console.log('\n[#194] Bill sent back in full: its round-off goes too');
{
  const b = { id: 'r', supplierName: 'DiceCodes Supplies', invoiceNumber: 'R-1', date: '2026-07-01', applyRoundOff: true, items: [line(10.3)] };
  const dn = { id: 'rd', purchaseId: 'r', dnNumber: 'DN/1', date: '2026-07-02', items: [{ ...line(10.3), line: 0 }] };
  eq(supplierStatement([b], [dn], 'DiceCodes Supplies').closing, 0, 'nothing owed');
}

console.log('\n[#194] Supplier list and message');
{
  const list = supplierList(bills);
  eq(list.map((s) => s.name).join('|'), 'DiceCodes Supplies|Other Traders', 'one per name, any case, A-Z');
  eq(list[0].gstin, '', 'latest bill gives the details');
  const st = supplierStatement(bills, notes, 'DiceCodes Supplies');
  const msg = supplierStatementMessage('DiceCodes Supplies', st, { businessName: 'DiceCodes' }, '');
  eq(msg.includes('*Balance we owe:'), true, 'message says what we owe');
  eq(supplierStatement([], [], 'Nobody').rows.length, 0, 'unknown supplier: empty');
}

console.log('\n────────────────────────────────────────');
console.log(`Passed: ${passed}   Failed: ${failed}`);
if (failed) process.exit(1);
