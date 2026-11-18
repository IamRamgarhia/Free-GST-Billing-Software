// v1.10.85 (#157, #148) - a client's account: payment history, the latest
// payment on an invoice, statement items, outstanding against a credit limit,
// and the WhatsApp / email text of the Statement and Aging PDFs.
//
// Run: `node scripts/client-ledger-test.mjs`

import {
  clientPaymentHistory, latestPaymentDate, statementItems, itemLabel, clientOutstanding,
  creditLimitCheck, findSavedClient, statementShareMessage, agingShareMessage,
  clientAccount, thisInvoiceDue, paidTowards, missingRateNote, balanceReminderMessage,
  clientKey, onAccountReceipts, openingOf, openingDue, openingFields, fyStartDate,
} from '../src/utils/clientLedger.js';
import { withNextReceiptNo, paymentReceiptNo, receiptForPayment, withReceiptPayment } from '../src/utils/bankMatch.js';
import { clientsCsvToList } from '../src/utils/listCsv.js';
import { formatDocNumber, businessKeyOf } from '../src/utils.js';

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

// ---- review fixes (v1.10.85) ----
// 7. An old bill marked Paid with no payments and no paidAmount is paid.
ok(clientOutstanding('Demo Traders', [bill('OLD', { status: 'paid' })], dice) === 0, 'an old bill marked Paid with no payment recorded owes nothing', '');

// 4. Another currency: converted at the bill's own rate; no rate = left out and named.
const fx = [
  bill('U1', { currency: 'USD', totalAmount: 100, payments: [{ amount: 40 }], data: { ...mine, invoiceOptions: { currency: 'USD', exchangeRate: 83 } } }), // 60 x 83 = 4980
  bill('U2', { currency: 'USD', totalAmount: 50, data: { ...mine, invoiceOptions: { currency: 'USD' } } }),                                           // no rate
  bill('E1', { currency: 'EUR', totalAmount: 10, data: { ...mine, invoiceOptions: { currency: 'EUR' } } }),                                           // no rate
  bill('R1', { totalAmount: 500 }),
];
const acc = clientAccount('Demo Traders', fx, dice);
ok(acc.owed === 5480, 'a USD invoice counts at its saved rate (60 x 83) plus the rupee one', acc);
ok(acc.missing.join() === 'USD,EUR', 'invoices with no rate are left out and listed', acc.missing);
ok(missingRateNote(acc.missing) === '2 invoices in USD and EUR without an exchange rate left out', 'the note says how many and which currencies', missingRateNote(acc.missing));
ok(missingRateNote(['USD']) === '1 invoice in USD without an exchange rate left out' && missingRateNote([]) === '', 'one invoice / none', '');

// Credit (overpayments) is counted apart, as clientCredit.js does.
const over = clientAccount('Demo Traders', [bill('OV', { totalAmount: 500, payments: [{ amount: 700 }] }), bill('OW', {})], dice);
ok(over.owed === 1000 && over.credit === 200, 'an overpayment is credit, not less owed on another bill', over);

// 3. This invoice: what is still due on it, after payments and credit applied, never below 0.
const totals = { total: 1180 };
ok(thisInvoiceDue({ totals }, dice).amount === 1180, 'a new invoice counts its total', '');
ok(thisInvoiceDue({ totals, paid: 500, creditApplied: 180 }, dice).amount === 500, 'less what was paid on it and the credit applied', thisInvoiceDue({ totals, paid: 500, creditApplied: 180 }, dice));
ok(thisInvoiceDue({ totals, paid: 2000 }, dice).amount === 0, 'never below 0', '');
ok(thisInvoiceDue({ totals: { total: 1100, tdsAmount: 100 } }, dice).amount === 1000, 'less TDS the client deducts', '');
ok(thisInvoiceDue({ totals: { total: 10 }, currency: 'USD', exchangeRate: 80 }, dice).amount === 800, 'an invoice in USD at its rate', '');
ok(thisInvoiceDue({ totals: { total: 10 }, currency: 'USD' }, dice).missing === 'USD', 'an invoice in USD with no rate is named', '');
ok(paidTowards({ payments: [{ amount: 900 }, { amount: -300, mode: 'credit-transferred-out' }] }) === 900, 'paid on it: credit moved to another invoice is not taken off', '');

// 4. v1.10.86 - Send reminder: the balance, the unpaid invoices oldest first, which are late.
const rem = balanceReminderMessage('Sharma Traders', [
  { number: 'INV/2', outstanding: 500, dueDate: '2026-11-10' },
  { number: 'INV/1', outstanding: 1180, dueDate: '2026-10-15' },
  { number: 'INV/3', outstanding: 0, dueDate: '' },
], dice, '2026-11-14');
const remLines = rem.split('\n');
ok(/balance of ₹1,680\.00/.test(remLines[0]), 'says the whole balance', remLines[0]);
ok(/INV\/1.*30 days ago/.test(remLines[1]) && /INV\/2.*4 days ago/.test(remLines[2]), 'oldest first, with how late', remLines);
ok(!rem.includes('INV/3') && remLines[remLines.length - 1] === '- DiceCodes', 'leaves out paid invoices, signed by the business', remLines);
const many = balanceReminderMessage('X', Array.from({ length: 7 }, (_, i) => ({ number: `N${i}`, outstanding: 1 })), dice, '2026-11-14');
ok(many.includes('- and 2 more') && !many.includes('N5'), 'five invoices at most', many);

// ---- v1.10.86 (#202) one name key: no duplicate ledgers ----
ok(clientKey('ABC Traders') === clientKey('abc traders') && clientKey('ABC Traders ') === clientKey('  abc   TRADERS'), 'name key: case and spaces (ends and inside) do not count', clientKey('  abc   TRADERS'));
ok(clientKey('ABC Traders') !== clientKey('ABC Traders Pvt Ltd') && clientKey(null) === '', 'a different name is a different key; none is empty', '');
const odd = [
  bill('K1', { clientName: 'ABC Traders' }),
  bill('K2', { clientName: 'abc traders' }),
  bill('K3', { clientName: 'ABC  Traders ' }),
];
ok(clientOutstanding('ABC Traders', odd, dice) === 3000, 'bills typed with other case or spaces fall into the same ledger', clientOutstanding('ABC Traders', odd, dice));
const savedAbc = [{ id: 'abc', name: 'ABC Traders' }];
ok(findSavedClient(savedAbc, null, 'abc  traders ')?.name === 'ABC Traders', 'a typed name is linked to the saved client (its exact name)', '');
ok(findSavedClient(savedAbc, null, 'ABC Trader') === undefined, 'a different name is not linked', '');
ok(clientsCsvToList('Name\nabc  TRADERS\n', savedAbc).skipped === 1, 'CSV import: a saved client with other spaces is skipped', '');

// ---- v1.10.86 (#202) Receipts page edit does not pay the invoice twice ----
// A payment recorded on the Dashboard has no receipt number of its own; its
// receipt (same id) is RCPT-... . Editing the receipt replaces the payment.
const dashPay = { id: 'pay_abc123', amount: 500, date: '2026-11-01', mode: 'cash', recordedAt: '2026-11-01T10:00:00Z', bankLineId: 'L1' };
const dashReceipt = receiptForPayment({ id: 'INV-7', invoiceNumber: 'INV-7', clientName: 'Demo Traders', data: { ...mine } }, dashPay);
ok(dashReceipt.receiptNo === 'RCPT-ABC123' && dashReceipt.id === 'pay_abc123', 'an older payment keeps its RCPT- receipt number', dashReceipt);
const edited = withReceiptPayment([dashPay], { id: dashReceipt.id, receiptNo: dashReceipt.receiptNo }, { id: dashReceipt.id, amount: 600, date: '2026-11-02', mode: 'upi', receiptNo: dashReceipt.receiptNo, recordedAt: 'now' });
ok(edited.length === 1 && edited[0].amount === 600 && edited[0].mode === 'upi', 'edit replaces the payment (matched by id), no second one', edited);
ok(edited[0].bankLineId === 'L1' && edited[0].recordedAt === '2026-11-01T10:00:00Z', 'the payment keeps its bank line and first recorded time', edited[0]);
const byNo = withReceiptPayment([{ id: 'x', amount: 1, receiptNo: 'RCP/26-27/0001' }], { id: 'rcp_9', receiptNo: 'RCP/26-27/0001' }, { id: 'rcp_9', amount: 2, receiptNo: 'RCP/26-27/0001' });
ok(byNo.length === 1 && byNo[0].amount === 2, 'matched by receipt number too', byNo);
ok(withReceiptPayment([dashPay], { id: 'rcp_new', receiptNo: 'RCP/26-27/0002' }, { id: 'rcp_new', amount: 50 }).length === 2, 'a new receipt adds its payment', '');

// ---- v1.10.86 (#202) sequential receipt numbers for every new payment ----
let counter = 4;
const reserve = async () => formatDocNumber({ typePrefix: 'RCP', next: ++counter, fyLabel: '2026-27' });
const p1 = await withNextReceiptNo({ id: 'pay_1', amount: 10 }, reserve);
const p2 = await withNextReceiptNo({ id: 'pay_2', amount: 20 }, reserve);
ok(p1.receiptNo === 'RCP/2026-27/0005' && p2.receiptNo === 'RCP/2026-27/0006', 'new payments take the next numbers of the RCP series', [p1, p2]);
ok(paymentReceiptNo(p1) === 'RCP/2026-27/0005' && receiptForPayment({ id: 'I' }, p1).receiptNo === 'RCP/2026-27/0005', 'the receipt uses the number stored on the payment', '');
const kept = await withNextReceiptNo({ id: 'pay_3', receiptNo: 'RCP/2026-27/0001' }, reserve);
ok(kept.receiptNo === 'RCP/2026-27/0001' && counter === 6, 'a payment that has a number keeps it (no number used up)', kept);
const offline = await withNextReceiptNo({ id: 'pay_zz9', amount: 5 }, async () => { throw new Error('offline'); });
ok(!offline.receiptNo && paymentReceiptNo(offline) === 'RCPT-ZZ9', 'counter not reachable: saved anyway with an RCPT- number', offline);

// ---- v1.10.86 (#214) opening balance ----
ok(fyStartDate('2026-11-19') === '2026-04-01' && fyStartDate('2027-02-10') === '2026-04-01' && fyStartDate('2027-04-01') === '2027-04-01', 'as on: 1 April of the financial year', '');
const of = openingFields({ openingBalance: '5000', openingBalanceDate: '' }, 'BIZ', '2026-11-19');
ok(of.openingBalance === 5000 && of.openingBalanceDate === '2026-04-01' && of.openingBalanceType === 'receivable' && of.openingBalanceBusiness === 'BIZ', 'form: amount, default date, owed to you, the business', of);
ok(openingFields({ openingBalance: '' }).openingBalance === '' && openingFields({ openingBalance: '-5' }).openingBalance === '', 'blank or minus: no opening balance', '');
const dk = businessKeyOf(dice);
const client = { name: 'Demo Traders', openingBalance: 5000, openingBalanceDate: '2026-04-01', openingBalanceType: 'receivable', openingBalanceBusiness: dk };
ok(openingOf(client, dice) === 5000 && openingOf(client, other) === 0, 'counts in its own business only', '');
ok(openingOf({ ...client, openingBalanceType: 'advance' }, dice) === -5000 && openingOf({ name: 'X' }, dice) === 0, 'an advance is minus; none is 0', '');
const obBills = [bill('OB1', { payments: [{ id: 'pay_ob1', amount: 200, receiptNo: 'RCP/26-27/0010' }] })];
const obReceipts = [
  { id: 'pay_ob1', receiptNo: 'RCP/26-27/0010', clientName: 'Demo Traders', amount: 200, date: '2026-05-01', ownerGstin: dice.gstin }, // on an invoice
  { id: 'r_old', clientName: 'Demo Traders', amount: 999, date: '2026-03-31', ownerGstin: dice.gstin },                               // before "as on"
  { id: 'r_on', clientName: 'demo  traders', amount: 1500, date: '2026-06-01', ownerGstin: dice.gstin },                              // on account
  { id: 'r_oth', clientName: 'Demo Traders', amount: 700, date: '2026-06-01', ownerGstin: other.gstin },                              // other business
];
ok(onAccountReceipts('Demo Traders', obBills, obReceipts).map((r) => r.id).join() === 'r_old,r_on,r_oth', 'receipts on no invoice', '');
const od = openingDue(client, obBills, obReceipts, dice);
ok(od.opening === 5000 && od.received === 1500 && od.due === 3500 && od.date === '2026-04-01', 'paid off by receipts on no invoice, on or after the date, this business', od);
ok(openingDue(client, obBills, [{ clientName: 'Demo Traders', amount: 9000, date: '2026-07-01' }], dice).due === 0, 'never below 0', '');
const withOb = clientAccount('Demo Traders', obBills, dice, null, od.due);
ok(withOb.owed === 4300, 'outstanding: bills (800) plus what is left of the opening balance (3500)', withOb);
ok(clientOutstanding('Nobody', [], dice, null, 2000) === 2000, 'a client with no bills owes their opening balance', '');
ok(clientAccount('Demo Traders', [], dice, null, -1000).credit === 1000, 'an advance is credit', '');
ok(creditLimitCheck(4000, withOb.owed, 0).over === true, 'the opening balance counts against the credit limit', '');
const obRem = balanceReminderMessage('Demo Traders', [{ number: 'Opening balance', outstanding: 3500, dueDate: '2026-04-01', opening: true }], dice, '2026-11-14');
ok(obRem.includes('- Opening balance: ₹3,500.00') && !obRem.includes('Invoice Opening'), 'reminder lists the opening balance', obRem);
const csvOb = clientsCsvToList('Name,Opening Balance\nNew One,"1,200"\nAdvance Co,-300\nNo Bal,\nBad,abc\n', [], '2026-11-19');
ok(csvOb.clients[0].openingBalance === 1200 && csvOb.clients[0].openingBalanceDate === '2026-04-01' && csvOb.clients[0].openingBalanceType === 'receivable', 'CSV: Opening Balance column', csvOb.clients[0]);
ok(csvOb.clients[1].openingBalanceType === 'advance' && csvOb.clients[1].openingBalance === 300, 'CSV: a minus amount is their advance', csvOb.clients[1]);
ok(!('openingBalance' in csvOb.clients[2]) && csvOb.errors.length === 1, 'CSV: blank adds nothing; not a number is an error', csvOb);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
