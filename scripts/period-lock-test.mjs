// v1.10.85 - closing the books up to a date (src/utils/periodLock.js).
// Run: `node scripts/period-lock-test.mjs`
import { lockProblem, bookedOn, isLockDate } from '../src/utils/periodLock.js';

let passed = 0, failed = 0;
const ok = (cond, label, extra = '') => { if (cond) { passed++; console.log(`  ok ${label}`); } else { failed++; console.log(`  FAIL ${label} ${extra}`); } };
const UP_TO = '2026-09-30';

const bill = (over = {}) => ({
  id: 'INV-1', invoiceNumber: 'DC/26-27/0007', invoiceType: 'tax-invoice', invoiceDate: '2026-09-15',
  clientName: 'DiceCodes Labs', totalAmount: 1180, totalTaxAmount: 180, status: 'unpaid', payments: [],
  data: { items: [{ name: 'Design', quantity: 1, rate: 1000, taxPercent: 18 }], totals: { total: 1180, taxableAmount: 1000 }, client: { gstin: '29ABCDE1234F2ZV' } },
  ...over,
});

ok(lockProblem('bills', null, bill(), '') === null, 'no lock date: everything allowed');
ok(lockProblem('bills', null, bill({ invoiceDate: '2026-10-01' }), UP_TO) === null, 'a new invoice after the lock date: allowed');
ok(/closed up to 2026-09-30/.test(lockProblem('bills', null, bill(), UP_TO) || ''), 'a new invoice dated in the closed period: refused');
ok(/cannot be deleted/.test(lockProblem('bills', bill(), null, UP_TO) || ''), 'deleting a closed-period invoice: refused');
ok(lockProblem('bills', bill({ invoiceDate: '2026-10-05' }), null, UP_TO) === null, 'deleting an open-period invoice: allowed');

const paid = bill({ status: 'paid', paidAmount: 1180, payments: [{ date: '2026-11-07', amount: 1180, mode: 'upi' }] });
ok(lockProblem('bills', bill(), paid, UP_TO) === null, 'recording a payment on an old invoice: allowed');
ok(lockProblem('bills', bill(), { ...bill(), printedAt: '2026-11-07T10:00:00Z', notes: 'sent by WhatsApp' }, UP_TO) === null, 'printing / notes on an old invoice: allowed');
ok(!!lockProblem('bills', bill(), bill({ totalAmount: 2360, data: { ...bill().data, totals: { total: 2360, taxableAmount: 2000 } } }), UP_TO), 'changing an old invoice\'s amount: refused');
ok(!!lockProblem('bills', bill(), bill({ status: 'cancelled' }), UP_TO), 'cancelling an old invoice: refused (it changes a filed return)');
ok(!!lockProblem('bills', bill(), bill({ invoiceDate: '2026-10-02' }), UP_TO), 'moving an old invoice out of the closed period: refused');
ok(!!lockProblem('bills', bill({ invoiceDate: '2026-10-02' }), bill(), UP_TO), 'moving an open invoice into the closed period: refused');

const purchase = { id: 'pur_1', date: '2026-09-10', invoiceNumber: 'S-44', supplierName: 'DiceCodes Supplies', items: [{ name: 'Paper', quantity: 10, rate: 50, taxPercent: 12 }], paymentStatus: 'Unpaid', payments: [] };
ok(lockProblem('purchases', purchase, { ...purchase, paymentStatus: 'Paid', payments: [{ date: '2026-11-01', amount: 560 }] }, UP_TO) === null, 'paying an old purchase bill: allowed');
ok(!!lockProblem('purchases', purchase, { ...purchase, items: [{ ...purchase.items[0], quantity: 12 }] }, UP_TO), 'changing an old purchase\'s items: refused');
ok(!!lockProblem('expenses', { id: 'e1', date: '2026-08-01', amount: 500, gstAmount: 0 }, { id: 'e1', date: '2026-08-01', amount: 600, gstAmount: 0 }, UP_TO), 'changing an old expense\'s amount: refused');
ok(lockProblem('expenses', { id: 'e1', date: '2026-08-01', amount: 500, paymentStatus: 'unpaid' }, { id: 'e1', date: '2026-08-01', amount: 500, paymentStatus: 'paid' }, UP_TO) === null, 'marking an old expense paid: allowed');
ok(lockProblem('profiles', null, { id: 'p' }, UP_TO) === null, 'records without a date (profiles, products) are never locked');
ok(bookedOn('bills', { invoiceDate: '2026-09-15T00:00:00' }) === '2026-09-15' && bookedOn('expenses', { date: '2026-08-01' }) === '2026-08-01', 'booked-on date');
ok(isLockDate('2026-09-30') && !isLockDate('30/09/2026') && !isLockDate(''), 'a lock date is YYYY-MM-DD');

console.log(`\nperiod-lock-test: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
