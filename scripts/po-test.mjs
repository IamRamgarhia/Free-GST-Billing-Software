// v1.10.83 (#112) - purchase orders: totals, status from received quantities,
// the bill a PO turns into, and PO numbering.
//
// Run: `node scripts/po-test.mjs`

import { purchaseTotals, poStatus, poRemainingItems, billFormFromPo, poCounterKey, formatPoNumber } from '../src/utils/purchaseOrders.js';
import { nextCounterValue, splitPurchaseTax, seriesNumberOf, formatDocNumber } from '../src/utils.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n     expected: ${e}\n     actual:   ${a}`); }
}

const po = {
  id: 'po_1', poNumber: 'PO/26-27/0001', supplierName: 'DiceCodes Paper Mart', supplierGstin: '29AAAAA0000A1Z5', interstate: false,
  items: [
    { name: 'A4 Paper', hsn: '4802', quantity: 10, unit: 'Ream', rate: 250, taxPercent: 12, cessPercent: 0 },
    { name: 'Gel Pen', hsn: '9608', quantity: 100, unit: 'Pcs', rate: 10, taxPercent: 18, cessPercent: 0 },
  ],
};

console.log('\n[#112] PO totals');
{
  const t = purchaseTotals(po.items);
  eq([t.taxable, t.tax, t.cess, t.finalTotal], [3500, 480, 0, 3980], '10 x 250 @ 12% + 100 x 10 @ 18%: taxable 3500, tax 480, total 3980');
  eq(splitPurchaseTax(t.tax, false), { cgst: 240, sgst: 240, igst: 0 }, 'Within the state: CGST and SGST half each');
  eq(splitPurchaseTax(t.tax, true), { cgst: 0, sgst: 0, igst: 480 }, 'Inter-state: all IGST');
  eq(purchaseTotals([{ quantity: 2, rate: 100, taxPercent: 28, cessPercent: 12 }]).finalTotal, 280, 'Cess is added on top of GST');
  eq(purchaseTotals([{ quantity: 1, rate: 100.4, taxPercent: 0 }], true).roundOff.toFixed(2), '-0.40', 'Round-off still works for bills');
}

console.log('\n[#112] Status from the bills saved from the PO');
{
  const bill = (items, fromPo = 'po_1') => ({ fromPo, items });
  eq(poStatus(po, []), 'open', 'No bills: Open');
  eq(poStatus(po, [bill([{ name: 'A4 Paper', quantity: 10 }, { name: 'Gel Pen', quantity: 100 }], 'po_2')]), 'open', 'A bill from another PO does not count');
  eq(poStatus(po, [{ items: [{ name: 'A4 Paper', quantity: 10 }] }]), 'open', 'A bill not made from a PO does not count');
  eq(poStatus(po, [bill([{ name: 'A4 Paper', quantity: 10 }, { name: 'Gel Pen', quantity: 100 }])]), 'received', 'Everything on one bill: Received');
  eq(poStatus(po, [bill([{ name: 'A4 Paper', quantity: 10 }])]), 'partly-received', 'A line removed: Partly received');
  eq(poStatus(po, [bill([{ name: 'A4 Paper', quantity: 6 }, { name: 'Gel Pen', quantity: 100 }])]), 'partly-received', 'A quantity reduced: Partly received');
  const two = [bill([{ name: 'A4 Paper', quantity: 6 }, { name: 'Gel Pen', quantity: 100 }]), bill([{ name: ' a4 paper ', quantity: 4 }])];
  eq(poStatus(po, two), 'received', 'The rest on a second bill: Received (names match whatever the case and spaces)');
  eq(poStatus(po, [bill([{ name: 'A4 Paper', quantity: 12 }, { name: 'Gel Pen', quantity: 100 }])]), 'received', 'More than ordered still counts as Received');
  eq(poStatus({ ...po, cancelled: true }, two), 'cancelled', 'Cancelled stays cancelled');
  eq(poStatus({ ...po, cancelled: true }, []), 'cancelled', 'Cancelled before any bill');
  eq(poRemainingItems(po, [bill([{ name: 'A4 Paper', quantity: 6 }])]).map(i => [i.name, i.quantity]), [['A4 Paper', 4], ['Gel Pen', 100]], 'What is still to come');
  const dup = { id: 'po_3', items: [{ name: 'Ink', quantity: 5 }, { name: 'Ink', quantity: 5 }] };
  eq(poRemainingItems(dup, [{ fromPo: 'po_3', items: [{ name: 'Ink', quantity: 7 }] }]).map(i => i.quantity), [3], 'Two lines of the same item share what came, first line first');
  eq(poRemainingItems({ id: 'po_4', items: [{ name: 'Rice', quantity: 0.3 }] }, [{ fromPo: 'po_4', items: [{ name: 'Rice', quantity: 0.1 }, { name: 'Rice', quantity: 0.2 }] }]).length, 0, 'Decimal quantities add up without float dust');
}

console.log('\n[#112] Convert to purchase bill');
{
  const f = billFormFromPo(po, []);
  eq([f.supplierName, f.supplierGstin, f.interstate, f.invoiceNumber, f.fromPo], ['DiceCodes Paper Mart', '29AAAAA0000A1Z5', false, '', 'po_1'], 'Supplier filled in, bill number left empty, linked to the PO');
  eq(f.items[0], { name: 'A4 Paper', hsn: '4802', quantity: 10, unit: 'Ream', rate: 250, taxPercent: 12, cessPercent: 0 }, 'Items with rates, HSN, GST and unit');
  eq(billFormFromPo(po, [{ fromPo: 'po_1', items: [{ name: 'A4 Paper', quantity: 10 }] }]).items.map(i => i.name), ['Gel Pen'], 'A second bill gets only what is still to come');
}

console.log('\n[#112] PO numbers');
{
  eq(formatPoNumber(1, '2026-10-29'), 'PO/26-27/0001', 'PO/26-27/0001');
  eq(formatPoNumber(42, '2027-03-31'), 'PO/26-27/0042', '31 March is still 2026-27');
  eq(formatPoNumber(43, '2027-04-01'), 'PO/27-28/0043', '1 April starts 2027-28 (the count carries on)');
  eq(formatPoNumber(12345, '2026-10-29'), 'PO/26-27/12345', 'More than four digits');
  eq(poCounterKey('29ABCDE1234F1ZW'), 'counter_PO@29ABCDE1234F1ZW', 'Each business has its own counter');
  eq(poCounterKey(''), 'counter_PO', 'No business selected: one shared counter');
  eq([nextCounterValue(undefined), nextCounterValue(7)], [1, 8], 'The counter starts at 1 and only goes up, so a number is never reused');
}

console.log('\n[#145] A hand-typed number that fits the series moves the counter');
{
  const fmt = (settings) => (n) => formatDocNumber({ settings, typePrefix: 'INV', next: n, fyLabel: '2026-27' });
  const branded = fmt({ brandPrefix: 'DC', showFinYear: true, padDigits: 4 });
  eq(seriesNumberOf('DC/2026-27/0042', branded), 42, 'Written exactly like the series: its number');
  eq(seriesNumberOf('DC/2026-27/42', branded), 42, 'Without the zero padding: still the series');
  eq(seriesNumberOf(' DC/2026-27/0042 ', branded), 42, 'Spaces around it are ignored');
  eq(seriesNumberOf('DC/2025-26/0042', branded), null, 'Another financial year: not this series');
  eq(seriesNumberOf('XY/2026-27/0042', branded), null, 'Another prefix: not this series');
  eq(seriesNumberOf('PAPER-17', branded), null, 'A paper bill book number in its own style: left alone');
  eq(seriesNumberOf('DC/2026-27/ABC', branded), null, 'No number at the end: left alone');
  eq(seriesNumberOf('DC/2026-27/0000', branded), null, 'Zero is not a number the series uses');
  const plain = fmt({ brandPrefix: '', showFinYear: false, padDigits: 3 });
  eq(seriesNumberOf('INV/007', plain), 7, 'A series without the year: INV/007 is 7');
  eq(seriesNumberOf('INV/2026-27/007', plain), null, 'Year added where the series has none: left alone');
  eq(seriesNumberOf('DC/0042', () => `DC/${Math.random().toString(36).slice(2, 8)}`), null, 'Random numbering: never followed');
}

console.log('\n────────────────────────────────────────');
console.log(`Passed: ${passed}   Failed: ${failed}`);
if (failed) process.exit(1);
