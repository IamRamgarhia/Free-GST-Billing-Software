// v1.10.86 (#197) - scan a return label: the exact-match lookup on the
// Dashboard search, and the credit note made from the invoice it finds.
//
// Run: `node scripts/scan-return-test.mjs`
import assert from 'node:assert/strict';
import { findScannedInvoice, creditNoteDraft } from '../src/utils/scanReturn.js';
import { stockEffect } from '../src/utils.js';

let passed = 0;
const ok = (cond, name) => { assert.ok(cond, name); passed += 1; };

const inv = (no, orderNo, awb, extra = {}) => ({
  id: no, invoiceNumber: no, invoiceType: 'tax-invoice', clientName: 'Asha Test', totalAmount: 210,
  ...extra,
  data: { invoiceType: extra.invoiceType || 'tax-invoice', client: { name: 'Asha Test', state: 'Maharashtra' }, details: { invoiceNumber: no, buyerOrderNo: orderNo, dispatchDocNo: awb, dispatchedThrough: 'Flipkart', ...(extra.details || {}) },
    items: [{ productId: 'p1', name: 'Steel Tiffin', quantity: 2, rate: 105, taxPercent: 5 }], stockApplied: { p1: -2 } },
});
const a = inv('FKTEST0001', 'OD100001', 'FMPC0000001');
const b = inv('FKTEST0002', 'OD100002', 'FMPC0000002');
const bills = [a, b];

// Order ID, AWB and invoice number, whatever the case and spacing.
for (const q of ['OD100001', 'fmpc0000001', '  FMPC0000001\n', 'fmpc 000 0001', 'fktest0001'])
  ok(findScannedInvoice(bills, q)?.bill === a, `finds the invoice by "${q.trim()}"`);
// Exact only: part of a code, or empty text, shows no card.
for (const q of ['OD1000', 'FMPC', 'Asha', '', '   ', null])
  ok(findScannedInvoice(bills, q) === null, `no card for "${q}"`);
// Several invoices with the same order ID: no card (the list shows them).
ok(findScannedInvoice([...bills, inv('FKTEST0003', 'OD100001', 'FMPC0000009')], 'OD100001') === null, 'several matches: no card');
ok(findScannedInvoice([...bills, inv('FKTEST0003', 'OD100001', 'FMPC0000009')], 'FMPC0000009')?.bill.invoiceNumber === 'FKTEST0003', 'the other code still finds one');
// Only sales invoices count: a cancelled invoice, a quotation or the credit
// note carrying the same AWB is not "the invoice".
ok(findScannedInvoice([inv('FKTEST0001', 'OD1', 'AWB1', { status: 'cancelled' })], 'AWB1') === null, 'cancelled invoice left out');
ok(findScannedInvoice([inv('QT/1', 'OD1', 'AWB1', { invoiceType: 'quotation' })], 'AWB1') === null, 'quotation left out');
const cn = inv('CN/26-27/0001', 'OD100001', 'FMPC0000001', { invoiceType: 'credit-note', details: { originalInvoiceRef: 'FKTEST0001' } });
const withCn = findScannedInvoice([...bills, cn], 'FMPC0000001');
ok(withCn?.bill === a, 'the credit note with the same AWB does not hide the invoice');
ok(withCn.creditNotes.length === 1 && withCn.creditNotes[0] === cn, 'the credit note already made is found');
ok(findScannedInvoice([...bills, { ...cn, status: 'cancelled' }], 'OD100001').creditNotes.length === 0, 'a cancelled credit note does not count');
ok(findScannedInvoice(bills, 'OD100002').creditNotes.length === 0, 'no credit note yet');

// The credit note draft: a new credit note against the invoice, its items and
// order details kept, no stock record of its own (so saving puts back what it
// shows, not the sale's record undone twice); the invoice itself unchanged.
const draft = creditNoteDraft({ ...a, status: 'paid', payments: [{ amount: 210 }], convertedTo: 'X', printedCount: 3 });
ok(draft.invoiceType === 'credit-note' && draft.data.invoiceType === 'credit-note', 'type is credit note');
ok(draft.data.details.originalInvoiceRef === 'FKTEST0001', 'original invoice referenced');
ok(draft.data.details.buyerOrderNo === 'OD100001' && draft.data.details.dispatchDocNo === 'FMPC0000001', 'order ID and AWB kept');
// v1.10.86 (#209) - and the e-commerce operator, so the return nets off in GSTR-1 Table 14.
ok(creditNoteDraft(inv('FKTEST0009', 'OD9', 'AWB9', { details: { ecoGstin: '29ABCDE1234F1C7' } })).data.details.ecoGstin === '29ABCDE1234F1C7', 'e-commerce operator GSTIN kept');
ok(draft.data.client?.name === 'Asha Test' && draft.data.client.state === 'Maharashtra', 'client kept as on the invoice');
ok(draft.data.items[0].quantity === 2 && draft.data.items[0].rate === 105 && draft.data.items[0].taxPercent === 5, 'items, quantities, rates, GST kept');
ok(!('stockApplied' in draft.data), 'no stock record carried over');
ok(!draft.convertedTo && !draft.printedCount && draft.status === '' && draft.payments.length === 0, 'no payments, print count or conversion carried over');
ok(a.data.stockApplied.p1 === -2 && !a.data.details.originalInvoiceRef, 'the invoice itself is not changed');
ok(stockEffect(draft.data.items, 'credit-note', '').p1 === 2, 'saved, it puts the 2 back');
ok(stockEffect([{ ...draft.data.items[0], quantity: 1 }], 'credit-note', '').p1 === 1, 'a partial return puts back 1');

console.log(`scan-return-test: ${passed} passed, 0 failed`);
