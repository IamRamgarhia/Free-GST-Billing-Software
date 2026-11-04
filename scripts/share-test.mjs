// v1.10.84 (#156) - one WhatsApp / email message for an invoice on every
// screen: business, client, number and dates, total, paid and balance due,
// status, and the UPI ID while money is still due on a rupee invoice.
//
// Run: `node scripts/share-test.mjs`

import { invoiceShareMessage } from '../src/utils/share.js';

let passed = 0, failed = 0;
function ok(cond, label, got) {
  if (cond) { passed++; console.log(`  ok ${label}`); }
  else { failed++; console.log(`  FAIL ${label}\n${got}`); }
}

const profile = { businessName: 'DiceCodes', upiId: 'dicecodes@upi' };
const bill = {
  invoiceNumber: 'DC/2026-27/0007', invoiceDate: '2026-11-05', clientName: 'Demo Traders',
  totalAmount: 1180, status: 'unpaid', data: { details: { dueDate: '2026-11-20' }, invoiceOptions: {} },
};

const unpaid = invoiceShareMessage(bill, profile);
ok(unpaid.startsWith('*DiceCodes*'), 'business name first', unpaid);
ok(unpaid.includes('Client: Demo Traders'), 'client name', unpaid);
ok(unpaid.includes('Invoice: *DC/2026-27/0007*'), 'invoice number', unpaid);
ok(unpaid.includes('05 Nov 2026') && unpaid.includes('Due: 20 Nov 2026'), 'date and due date (local, not shifted a day)', unpaid);
ok(/Amount due: .*1,180/.test(unpaid), 'amount due', unpaid);
ok(unpaid.includes('Status: UNPAID'), 'status', unpaid);
ok(unpaid.includes('Pay by UPI: dicecodes@upi'), 'UPI ID while money is due', unpaid);

const part = invoiceShareMessage({ ...bill, status: 'partial', payments: [{ amount: 500 }] }, profile);
ok(/Paid: .*500/.test(part) && /Balance due: .*680/.test(part), 'part paid: paid and balance', part);

const paid = invoiceShareMessage({ ...bill, status: 'paid', payments: [{ amount: 1180 }] }, profile);
ok(paid.includes('FULLY PAID') && !paid.includes('UPI'), 'fully paid: no UPI line', paid);

const usd = invoiceShareMessage({ ...bill, currency: 'USD' }, profile);
ok(!usd.includes('UPI'), 'foreign-currency invoice: no UPI line', usd);

const acct = invoiceShareMessage({ ...bill, data: { ...bill.data, invoiceOptions: { paymentAccountSnapshot: { upiId: 'shop2@upi' } } } }, profile);
ok(acct.includes('Pay by UPI: shop2@upi'), "the invoice's own bank account UPI wins", acct);

const noStatus = invoiceShareMessage({ ...bill, status: '' }, { businessName: '' });
ok(noStatus.includes('Status: UNPAID') && !noStatus.startsWith('**'), 'unsaved invoice: status worked out, no empty business line', noStatus);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
