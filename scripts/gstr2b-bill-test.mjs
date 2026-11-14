// v1.10.86 - (#175) GSTR-2B "2B only" row -> purchase bill form.
//
// Run: `node scripts/gstr2b-bill-test.mjs`
//
// Supplier, GSTIN, invoice number and date, IGST or CGST + SGST, one line per
// GST rate at the taxable value, cess, the supplier's rounding, and a bill
// saved from it matching the 2B entry again (same GSTIN + number, totals
// within a rupee, as the reconciliation checks).

import { purchaseFromTwoB, twoBDate, twoBNoteCount, isTwoBPlaceholder } from '../src/utils/gstr2bBill.js';
import { purchaseTotals } from '../src/utils/purchaseOrders.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  if (actual === expected) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
}

const sup = { ctin: '27aaaaa0000a1z5', trdnm: 'DiceCodes Traders' };

console.log('\n[#175] Intra-state invoice with two rates');
{
  const inv = { inum: 'DT/101', dt: '05-10-2026', val: 1600, pos: '29', rev: 'N', itcavl: 'Y',
    items: [{ num: 1, rt: 18, txval: 1000, cgst: 90, sgst: 90, cess: 0 }, { num: 2, rt: 5, txval: 400, cgst: 10, sgst: 10, cess: 0 }] };
  const f = purchaseFromTwoB(sup, inv, { ownGstin: '29ABCDE1234F1ZW', period: '102026' });
  eq(f.supplierName, 'DiceCodes Traders', 'supplier name');
  eq(f.supplierGstin, '27AAAAA0000A1Z5', 'GSTIN in capitals');
  eq(f.invoiceNumber, 'DT/101', 'their invoice number');
  eq(f.date, '2026-10-05', 'date dd-mm-yyyy -> yyyy-mm-dd');
  eq(f.interstate, false, 'CGST + SGST: same state');
  eq(f.items.length, 2, 'one line per rate');
  eq(`${f.items[0].taxPercent}|${f.items[0].rate}|${f.items[0].quantity}`, '18|1000|1', 'line at 18%, qty 1 at the taxable value');
  eq(f.items[1].name, 'Purchase at 5% GST (from GSTR-2B)', 'line name says where it came from');
  eq(isTwoBPlaceholder(f.items[1].name), true, 'placeholder name is recognised (not added to Products)');
  eq(isTwoBPlaceholder('A4 paper'), false, 'a real item name is not');
  eq(f.applyRoundOff, false, 'exact total: no round-off');
  eq(f.note, 'From GSTR-2B (102026)', 'note');
  eq(f.reverseCharge, false, 'rev N: not reverse charge');
  eq(purchaseTotals(f.items, f.applyRoundOff).finalTotal, 1600, 'saved bill total = 2B value');
}

console.log('\n[#175] Inter-state with cess and a rounded value');
{
  const inv = { inum: 'X-9', dt: '12-10-2026', val: 1399, pos: '29', rev: 'Y', itcavl: 'N', rsn: 'P',
    items: [{ rt: 28, txval: 999.6, igst: 279.89, cess: 119.95 }] };
  const f = purchaseFromTwoB(sup, inv, { ownGstin: '29ABCDE1234F1ZW' });
  eq(f.interstate, true, 'IGST: between states');
  eq(Math.abs(f.items[0].cessPercent - 12) < 0.001, true, 'cess % from the cess amount');
  eq(f.applyRoundOff, true, 'supplier rounded to the rupee: round-off on');
  const t = purchaseTotals(f.items, f.applyRoundOff);
  eq(Math.abs(t.finalTotal - 1399) <= 1, true, 'saved total within a rupee of the 2B value (matches)');
  eq(Math.abs(t.taxable - 999.6) <= 1, true, 'taxable within a rupee (matches)');
  eq(f.note, 'From GSTR-2B. ITC not available as per 2B (P)', 'ITC not available is noted');
  eq(f.reverseCharge, true, 'rev Y: the bill is ticked Reverse charge');
}

console.log('\n[#175] Rate worked out when 2B has none; no tax uses place of supply');
{
  const f = purchaseFromTwoB(sup, { inum: '1', dt: '01-10-2026', val: 1120, items: [{ txval: 1000, cgst: 60, sgst: 60 }] });
  eq(f.items[0].taxPercent, 12, 'rate from the tax');
  const nil = purchaseFromTwoB(sup, { inum: '2', dt: '01-10-2026', val: 500, pos: '27', items: [{ rt: 0, txval: 500 }] }, { ownGstin: '29ABCDE1234F1ZW' });
  eq(nil.interstate, true, 'no tax, place of supply 27 vs our 29: inter-state');
  const same = purchaseFromTwoB(sup, { inum: '3', dt: '01-10-2026', val: 500, pos: '29', items: [{ rt: 0, txval: 500 }] }, { ownGstin: '29ABCDE1234F1ZW' });
  eq(same.interstate, false, 'no tax, same state: intra-state');
  const twoSame = purchaseFromTwoB(sup, { inum: '4', items: [{ rt: 18, txval: 100, igst: 18 }, { rt: 18, txval: 50, igst: 9 }] });
  eq(`${twoSame.items.length}|${twoSame.items[0].rate}`, '1|150', 'two items at one rate: one line');
  eq(twoSame.date, '', 'no date: left for the user');
  eq(purchaseFromTwoB({ ctin: '27AAAAA0000A1Z5' }, { inum: '5' }).supplierName, '27AAAAA0000A1Z5', 'no trade name: the GSTIN stands in');
}

console.log('\n[#175] Dates and notes');
eq(twoBDate('2026-10-05'), '2026-10-05', 'ISO kept');
eq(twoBDate('5/10/2026'), '', 'unreadable: blank');
eq(twoBNoteCount({ docdata: { cdnr: [{ nt: [{}, {}] }, { nt: [{}] }] } }), 3, 'credit / debit notes counted');
eq(twoBNoteCount({ docdata: { b2b: [] } }), 0, 'none');

console.log('\n────────────────────────────────────────');
console.log(`Passed: ${passed}   Failed: ${failed}`);
if (failed) process.exit(1);
