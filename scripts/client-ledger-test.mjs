// v1.10.85 (#157, #148) - a client's account: payment history, the latest
// payment on an invoice, statement items, outstanding against a credit limit,
// and the WhatsApp / email text of the Statement and Aging PDFs.
//
// Run: `node scripts/client-ledger-test.mjs`

import {
  clientPaymentHistory, latestPaymentDate, statementItems, itemLabel, clientOutstanding,
  creditLimitCheck, findSavedClient, statementShareMessage, agingShareMessage,
} from '../src/utils/clientLedger.js';

let passed = 0, failed = 0;
function ok(cond, label, got) {
  if (cond) { passed++; console.log(`  ok ${label}`); }
  else { failed++; console.log(`  FAIL ${label}\n${JSON.stringify(got, null, 1)}`); }
}

const dice = { businessName: 'DiceCodes', gstin: '27AAAAA0000A1Z5' };
const other = { businessName: 'Other Co', gstin: '29BBBBB0000B1Z5' };
const mine = { profile: { businessName: 'DiceCodes', gstin: '27AAAAA0000A1Z5' } };
const theirs = { profile: { businessName: 'Other Co', gstin: '29BBBBB0000B1Z5' } };
const bill = (id, extra) => ({ id, invoiceNumber: id, clientName: 'Demo Traders', invoiceType: 'tax-invoice', status: 'unpaid', totalAmount: 1000, data: { ...mine }, ...extra });

// ---- payment history ----
const bills = [
  bill('INV-1', { payments: [{ id: 'pay_a', amount: 400, date: '2026-11-02', mode: 'upi', note: 'part' }, { id: 'pay_b', amount: 100, date: '2026-11-05', mode: 'cash' }] }),
  bill('INV-2', { payments: [{ id: 'c_in', amount: 50, date: '2026-11-06', mode: 'credit-applied' }, { id: 'rc', amount: 300, date: '2026-11-04', mode: 'cheque', receiptNo: 'RCP/26-27/0003' }] }),
  bill('INV-X', { clientName: 'Someone Else', payments: [{ id: 'pay_x', amount: 999, date: '2026-11-01', mode: 'cash' }] }),
];
const receipts = [
  { id: 'pay_a', clientName: 'Demo Traders', amount: 400, date: '2026-11-02', paymentMode: 'upi' },             // auto receipt of pay_a
  { id: 'r2', receiptNo: 'RCP/26-27/0003', clientName: 'demo traders', amount: 300, date: '2026-11-04' },       // linked by receipt no.
  { id: 'r3', receiptNo: 'RCP/26-27/0004', clientName: 'Demo Traders ', amount: 2000, date: '2026-11-07', paymentMode: 'Bank Transfer', note: 'advance' },
];
const hist = clientPaymentHistory('Demo Traders', bills, receipts);
ok(hist.length === 4, 'four payments: two + one on invoices, one advance receipt (no duplicates, no credit move)', hist);
ok(hist.map((h) => h.date).join() === '2026-11-07,2026-11-05,2026-11-04,2026-11-02', 'newest first', hist.map((h) => h.date));
ok(hist[0].invoiceNumber === '' && hist[0].receiptNo === 'RCP/26-27/0004' && hist[0].amount === 2000 && hist[0].note === 'advance', 'a receipt on no invoice is listed with its receipt number', hist[0]);
ok(hist[3].mode === 'UPI' && hist[3].invoiceNumber === 'INV-1' && hist[3].note === 'part', 'mode named, invoice and note kept', hist[3]);
ok(!hist.some((h) => h.amount === 999), "another client's payments are not listed", hist);

ok(latestPaymentDate(bills[0]) === '2026-11-05', 'latest payment date of an invoice', latestPaymentDate(bills[0]));
ok(latestPaymentDate(bills[1]) === '2026-11-04', 'a credit applied is not a payment received', latestPaymentDate(bills[1]));
ok(latestPaymentDate(bill('INV-9')) === '', 'no payments: no date', '');

// ---- statement items ----
const items = statementItems({ data: { items: [
  { name: 'Steel chair', quantity: 4, unit: 'Nos', rate: 1500, discount: 0 },
  { name: 'Delivery', quantity: 1, rate: 200, discount: 50 },
  { name: '  ', quantity: 1, rate: 10 },
] } });
ok(items.length === 2 && items[0].amount === 6000 && items[1].amount === 150, 'items: name, qty x rate less discount; blank lines left out', items);
ok(itemLabel(items[0]) === 'Steel chair x 4 Nos' && itemLabel(items[1]) === 'Delivery x 1', 'item label: name x qty unit', items.map(itemLabel));

// ---- outstanding and credit limit ----
const ledger = [
  bill('S1', { payments: [{ amount: 300 }] }),                                             // owes 700
  bill('S2', { status: 'paid', payments: [{ amount: 1000 }] }),                             // owes 0
  bill('S3', { totalAmount: 500, payments: [{ amount: 700 }] }),                            // overpaid: 0 (credit)
  bill('Q1', { invoiceType: 'proforma' }),                                                  // quotation: 0
  bill('C1', { status: 'cancelled' }),                                                      // cancelled: 0
  bill('CN', { invoiceType: 'credit-note', totalAmount: 200 }),                             // credit note: -200
  bill('T1', { totalAmount: 1100, data: { ...mine, totals: { tdsAmount: 100 } } }),         // TDS: owes 1000
  bill('O1', { data: { ...theirs } }),                                                      // other business: 0
  bill('P1', { paidAmount: 250 }),                                                          // old paidAmount field: owes 750
];
ok(clientOutstanding('demo traders', ledger, dice) === 2250, 'outstanding: sales less payments, TDS and credit notes; this business only', clientOutstanding('Demo Traders', ledger, dice));
ok(clientOutstanding('Demo Traders', ledger, other) === 1000, "the other business sees only its own invoice", clientOutstanding('Demo Traders', ledger, other));
ok(clientOutstanding('Demo Traders', ledger, dice, 'S1') === 1550, 'the invoice being edited is left out', clientOutstanding('Demo Traders', ledger, dice, 'S1'));
ok(clientOutstanding('', ledger, dice) === 0, 'no client: nothing', 0);

ok(creditLimitCheck(5000, 4000, 1500).over === true && creditLimitCheck(5000, 4000, 1500).by === 500, 'over the limit by 500', creditLimitCheck(5000, 4000, 1500));
ok(creditLimitCheck(5000, 4000, 1000).over === false, 'exactly at the limit is not over', creditLimitCheck(5000, 4000, 1000));
ok(creditLimitCheck('', 99999, 1).over === false && creditLimitCheck(0, 99999, 1).over === false, 'no limit never warns', '');

const saved = [{ id: 'c1', name: 'Demo Traders' }, { id: 'c2', name: 'Sample Studio' }];
ok(findSavedClient(saved, 'c2', 'Demo Traders')?.id === 'c2', 'the picked client wins', '');
ok(findSavedClient(saved, null, ' demo traders ')?.id === 'c1', 'else the same name', '');
ok(findSavedClient(saved, null, '') === undefined, 'no name: none', '');

// ---- share text ----
const sm = statementShareMessage('Demo Traders', { total: 5000, paid: 2000, unpaid: 3000 }, { businessName: 'DiceCodes' });
ok(sm.startsWith('*DiceCodes*') && sm.includes('Statement of account: Demo Traders') && /\*Outstanding: .*3,000/.test(sm), 'statement message: business, client, outstanding', sm);
ok(statementShareMessage('A', { total: 1, paid: 1, unpaid: 0 }, {}).includes('Nothing outstanding'), 'statement message when settled', '');
const am = agingShareMessage('Demo Traders', { total: 4000, d90plus: 1000 }, { businessName: 'DiceCodes' });
ok(/Total outstanding: .*4,000/.test(am) && /Over 90 days: .*1,000/.test(am), 'aging message: total and over 90 days', am);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
