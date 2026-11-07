// v1.10.83 - cash book maths: validation, the cash recorded elsewhere (and
// never counting one payment twice), running balance, periods.
//
// Run: `node scripts/cashbook-test.mjs`

import { validateCashEntry, cleanCashEntry, linkedCashLines, ownCashLines, cashBookView, cashSummary, periodRange } from '../src/utils/cashBook.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; console.log(`  ok ${label}`); }
  else { failed++; console.log(`  FAIL ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
}
const sum = (lines) => lines.reduce((s, l) => s + (l.type === 'in' ? l.amount : -l.amount), 0);

console.log('\n[cash book] Checking an entry');
{
  const ok = { type: 'in', amount: 500, date: '2026-10-29', name: 'Ramesh' };
  eq(validateCashEntry(ok), '', 'A plain Money in entry is fine');
  eq(validateCashEntry({ ...ok, amount: '250.50' }), '', 'An amount typed as text is fine');
  eq(validateCashEntry({ ...ok, type: '' }), 'Choose Money in or Money out', 'In or Out is required');
  eq(validateCashEntry({ ...ok, amount: 0 }), 'Enter an amount more than 0', 'Zero is refused');
  eq(validateCashEntry({ ...ok, amount: -5 }), 'Enter an amount more than 0', 'A negative amount is refused');
  eq(validateCashEntry({ ...ok, amount: 'abc' }), 'Enter an amount more than 0', 'Text that is not a number is refused');
  eq(validateCashEntry({ ...ok, amount: 0.004 }), 'Enter an amount more than 0', 'Less than a paisa is refused');
  eq(validateCashEntry({ ...ok, date: '' }), 'Enter a date', 'A date is required');
  eq(validateCashEntry({ ...ok, date: '2026-02-30' }), 'Enter a date', '30 February is not a date');
  eq(validateCashEntry({ ...ok, name: 'x'.repeat(121) }), 'The name is too long (120 letters at most)', 'A very long name is refused');
  eq(validateCashEntry({ ...ok, id: '' }), 'Invalid entry', 'An empty id is refused');
  eq(validateCashEntry([]), 'Invalid entry', 'Not an object');
  const clean = cleanCashEntry({ ...ok, amount: '100.456', name: '  Ramesh ', extra: 'dropped', createdAt: 'T' });
  eq([clean.amount, clean.name, clean.extra, clean.createdAt], [100.46, 'Ramesh', undefined, 'T'], 'Stored rounded to the paisa, trimmed, unknown fields dropped');
}

console.log('\n[cash book] A payment and its receipt are one line');
{
  const bill = (id, payments, extra = {}) => ({ id, invoiceNumber: id, clientName: 'Mehta Traders', invoiceType: 'tax-invoice', payments, ...extra });
  // 1. Recorded on the Dashboard: the payment, and a receipt with the payment's id.
  const pDash = { id: 'pay_a1', amount: 1000, date: '2026-10-01', mode: 'cash' };
  const rDash = { id: 'pay_a1', receiptNo: 'RCPT-A1', amount: 1000, date: '2026-10-01', paymentMode: 'cash', billId: 'INV-1', againstInvoice: 'INV-1', source: 'auto-from-payment' };
  // 2. Made on the Receipts page against an invoice: the payment carries the receipt id and number.
  const rPage = { id: 'rcp_b2', receiptNo: 'RCP/26-27/0002', amount: 300, date: '2026-10-02', paymentMode: 'Cash', againstInvoice: 'INV-2' };
  const pPage = { id: 'rcp_b2', receiptNo: 'RCP/26-27/0002', amount: 300, date: '2026-10-02', mode: 'cash' };
  // 3. Older records: no shared id or number, only the same amount, date and mode.
  const pOld = { amount: 250, date: '2026-10-03', mode: 'cash' };
  const rOld = { id: 'rcp_old', receiptNo: 'RCPT-OLD', amount: 250, date: '2026-10-03', paymentMode: 'Cash', againstInvoice: 'INV-3' };
  // 4. A cash payment with no receipt at all.
  const pAlone = { id: 'pay_d4', amount: 75, date: '2026-10-04', mode: 'cash', recordedAt: '2026-10-04T10:00:00Z' };
  // 5. A cash receipt not against any invoice (an advance).
  const rAdvance = { id: 'rcp_e5', receiptNo: 'RCP/26-27/0005', amount: 2000, date: '2026-10-05', paymentMode: 'Cash', clientName: 'Sharma' };
  // 6. Not cash: left out on both sides.
  const pUpi = { id: 'pay_f6', amount: 900, date: '2026-10-06', mode: 'upi' };
  const rUpi = { id: 'pay_f6', receiptNo: 'RCPT-F6', amount: 900, date: '2026-10-06', paymentMode: 'upi', billId: 'INV-6' };
  const bills = [bill('INV-1', [pDash]), bill('INV-2', [pPage]), bill('INV-3', [pOld]), bill('INV-4', [pAlone]), bill('INV-6', [pUpi])];
  const receipts = [rDash, rPage, rOld, rAdvance, rUpi];
  const lines = linkedCashLines({ bills, receipts });
  eq(lines.map((l) => l.key).sort(), ['payment:INV-4:pay_d4', 'receipt:pay_a1', 'receipt:rcp_b2', 'receipt:rcp_e5', 'receipt:rcp_old'].sort(), 'Each cash payment shows once');
  eq(sum(lines), 1000 + 300 + 250 + 75 + 2000, 'Cash in counts each payment once (3625, not 4950)');
  eq(lines.find((l) => l.key === 'payment:INV-4:pay_d4').label, 'Invoice INV-4 payment', 'An invoice payment says where it came from');
  eq(lines.find((l) => l.key === 'receipt:rcp_b2').label, 'Receipt RCP/26-27/0002 · INV-2', 'A receipt says its number and invoice');
  eq(linkedCashLines({ bills, receipts: [] }).length, 4, 'With no receipts, the four cash payments show from the invoices');

  // Two equal cash payments on one invoice the same day, one receipt: one pairs, one shows.
  const twin = bill('INV-7', [{ amount: 100, date: '2026-10-07', mode: 'cash' }, { amount: 100, date: '2026-10-07', mode: 'cash' }]);
  const twinR = { id: 'rcp_t', amount: 100, date: '2026-10-07', paymentMode: 'Cash', againstInvoice: 'INV-7' };
  eq(sum(linkedCashLines({ bills: [twin], receipts: [twinR] })), 200, 'Two equal payments with one receipt: both counted, neither twice');

  // A receipt matched by id is not taken by an older look-alike payment first.
  const strong = bill('INV-8', [{ amount: 50, date: '2026-10-08', mode: 'cash' }, { id: 'pay_s', amount: 50, date: '2026-10-08', mode: 'cash' }]);
  const strongR = { id: 'pay_s', amount: 50, date: '2026-10-08', paymentMode: 'cash', billId: 'INV-8' };
  eq(sum(linkedCashLines({ bills: [strong], receipts: [strongR] })), 100, 'An exact link is paired before a look-alike');

  // Another business's invoice with the same number is not paired with this receipt.
  const otherBiz = bill('INV-9', [{ amount: 400, date: '2026-10-09', mode: 'cash' }], { ownerGstin: '29AAAAA0000A1Z5' });
  const thisBizR = { id: 'rcp_9', amount: 400, date: '2026-10-09', paymentMode: 'Cash', againstInvoice: 'INV-9', ownerGstin: '03BBBBB1111B1Z1' };
  eq(linkedCashLines({ bills: [otherBiz], receipts: [thisBizR] }).length, 2, "A receipt never pairs with another business's invoice");

  // A credit-note refund in cash is money out; a dollar invoice is left out; Marked-paid (mode other) is left out.
  const cn = bill('CN-1', [{ id: 'pay_cn', amount: 60, date: '2026-10-10', mode: 'cash' }], { invoiceType: 'credit-note' });
  const usd = bill('EXP-1', [{ id: 'pay_usd', amount: 99, date: '2026-10-10', mode: 'cash' }], { currency: 'USD' });
  const auto = bill('INV-10', [{ id: 'pay_auto', amount: 500, date: '2026-10-10', mode: 'other', auto: true }]);
  eq(linkedCashLines({ bills: [cn, usd, auto] }).map((l) => [l.key, l.type]), [['payment:CN-1:pay_cn', 'out']], 'Credit-note refund is out; other currencies and Marked paid are left out');
}

console.log('\n[cash book] Expenses');
{
  const expenses = [
    { id: 'e1', date: '2026-10-11', amount: 120, paymentMode: 'Cash', description: 'Tea', vendorName: '', category: 'Meals & Entertainment' },
    { id: 'e2', date: '2026-10-11', amount: 5000, paymentMode: 'Bank Transfer', description: 'Rent' },
  ];
  const lines = linkedCashLines({ expenses });
  eq(lines.map((l) => [l.key, l.type, l.amount, l.name, l.label]), [['expense:e1', 'out', 120, 'Tea', 'Expense']], 'Only the cash expense, as money out');
}

console.log('\n[cash book] Payments to suppliers on purchase bills (#123)');
{
  const purchase = (id, payments) => ({ id, invoiceNumber: `GS/${id}`, supplierName: 'Gupta Steel', date: '2026-10-05', payments });
  const purchases = [
    purchase('1', [
      { id: 'pp_upi', amount: 5000, date: '2026-10-10', mode: 'upi' },
      { id: 'pp_cash', amount: 6800, date: '2026-10-12', mode: 'cash', reference: 'Vch 12', note: 'Balance', recordedAt: '2026-10-12T10:00:00Z' },
    ]),
    // Mark as paid: mode Other, how it was paid is unknown, so not cash.
    purchase('2', [{ id: 'pp_auto', amount: 900, date: '2026-10-13', mode: 'other', auto: true }]),
    // A bill from before payments existed, marked Paid: nothing to show.
    { id: '3', invoiceNumber: 'OLD-1', supplierName: 'Arora', paymentStatus: 'Paid' },
  ];
  const lines = linkedCashLines({ purchases });
  eq(lines.map((l) => [l.key, l.type, l.amount, l.label, l.name, l.note, l.view]),
    [['purchase:1:pp_cash', 'out', 6800, 'Purchase bill GS/1 payment', 'Gupta Steel', 'Vch 12 · Balance', 'purchases']],
    'Only the cash payment shows, once, as money out');
  // With everything else in the book too, the supplier payment is still counted once.
  const all = linkedCashLines({ purchases, expenses: [{ id: 'e1', date: '2026-10-12', amount: 50, paymentMode: 'Cash', description: 'Tea' }] });
  eq([all.filter((l) => l.source === 'purchase').length, sum(all)], [1, -6850], 'Counted once alongside other cash');
  eq(linkedCashLines({ purchases: [purchase('4', [{ amount: 300, date: '2026-10-14', mode: 'Cash' }])] })[0].key, 'purchase:4:2026-10-14:300', 'An old payment without an id still gets a steady key');
}

console.log('\n[cash book] Balance and periods');
{
  const own = ownCashLines([
    { id: 'o1', type: 'in', amount: 5000, date: '2026-09-30', category: 'Opening balance', createdAt: '2026-09-30T09:00:00Z' },
    { id: 'o2', type: 'out', amount: 200, date: '2026-10-01', name: 'Auto', category: 'Transport', createdAt: '2026-10-01T09:00:00Z' },
    { id: 'o3', type: 'in', amount: 1500.5, date: '2026-10-15', name: 'Counter sale', category: 'Sales', createdAt: '2026-10-15T09:00:00Z' },
    { id: 'o4', type: 'out', amount: 0.1, date: '2026-10-15', name: 'Change', createdAt: '2026-10-15T10:00:00Z' },
    { id: 'o5', type: 'out', amount: 0.2, date: '2026-10-15', name: 'Change', createdAt: '2026-10-15T11:00:00Z' },
    { id: 'o6', type: 'out', amount: 1000, date: '2026-11-02', name: 'Deposit', category: 'Deposit to bank', createdAt: '2026-11-02T09:00:00Z' },
  ]);
  const all = cashBookView(own);
  eq(all.rows.map((r) => r.balance), [5000, 4800, 6300.5, 6300.4, 6300.2, 5300.2], 'Running balance, oldest first, to the paisa');
  eq([all.opening, all.closing], [0, 5300.2], 'All dates: nothing brought in');
  const oct = cashBookView(own, periodRange('month', '2026-10-20'));
  eq([oct.opening, oct.totals, oct.closing, oct.rows.length], [5000, { in: 1500.5, out: 200.3, net: 1300.2 }, 6300.2, 4], 'October: September brought in, then in and out');
  const search = cashBookView(own, { search: 'change' });
  eq([search.rows.length, search.totals.out, search.rows[0].balance], [2, 0.3, 6300.4], 'Search narrows the lines; each keeps its true balance');
  eq(cashSummary(own, '2026-10-15'), { inHand: 6300.2, today: { in: 1500.5, out: 0.3, net: 1500.2 }, month: { in: 1500.5, out: 200.3, net: 1300.2 } }, 'Cash in hand leaves out a later date');
  eq(periodRange('lastMonth', '2026-01-10'), { from: '2025-12-01', to: '2025-12-31' }, 'Last month across a new year');
  eq(periodRange('month', '2028-02-05'), { from: '2028-02-01', to: '2028-02-29' }, 'February in a leap year');
  eq(periodRange('fy', '2027-03-31'), { from: '2026-04-01', to: '2027-03-31' }, '31 March is still the year that began in April');
  eq(periodRange('fy', '2027-04-01'), { from: '2027-04-01', to: '2028-03-31' }, '1 April starts the next');
  eq(periodRange('all'), { from: '', to: '' }, 'All dates');
}

// v1.10.85 (#165): Paid / Unpaid / Partly paid expenses. An expense saved
// before (no status) is Paid, as before; the Cash book shows only cash paid.
{
  const { expenseStatus, expensePaid, expenseDue } = await import('../src/utils/expensePayment.js');
  const old = { id: 'e1', amount: 1000, paymentMode: 'Cash', date: '2026-11-01' };
  const unpaid = { id: 'e2', amount: 500, paymentMode: 'Cash', date: '2026-11-02', paymentStatus: 'unpaid' };
  const part = { id: 'e3', amount: 800, paymentMode: 'Cash', date: '2026-11-03', paymentStatus: 'partial', paidAmount: 300 };
  eq([expenseStatus(old), expensePaid(old), expenseDue(old)], ['paid', 1000, 0], '#165 an old expense (no status) is Paid in full, as before');
  eq([expensePaid(unpaid), expenseDue(unpaid)], [0, 500], '#165 an Unpaid expense: nothing paid, all due');
  eq([expensePaid(part), expenseDue(part)], [300, 500], '#165 Partly paid: the paid part and the rest due');
  eq(expensePaid({ amount: 100, paymentStatus: 'partial', paidAmount: 250 }), 100, '#165 a paid part above the amount is capped at the amount');
  const lines = linkedCashLines({ expenses: [old, unpaid, part] });
  eq(lines.map((l) => `${l.key}:${l.amount}`), ['expense:e1:1000', 'expense:e3:300'], '#165 the Cash book shows only cash paid: none for Unpaid, the paid part for Partly paid');
}

console.log('\n────────────────────────────────────────');
console.log(`Passed: ${passed}   Failed: ${failed}`);
if (failed) process.exit(1);
