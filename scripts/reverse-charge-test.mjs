// v1.10.86 - Reverse charge on purchase bills.
//
// Run: `node scripts/reverse-charge-test.mjs`
//
// Bills ticked Reverse charge go into GSTR-3B 3.1(d) (less returns on them),
// their tax is credit in 4(A)(3) instead of 4(A)(5) (the total credit is the
// same), and the supplier is owed the bill without its GST. Bills not ticked
// (every bill saved before) are unchanged.

import { rcmInward, splitRcmItc, purchaseReturnsTax, withReturns } from '../src/utils/debitNotes.js';
import { purchaseOwed, purchaseBalance, purchaseRcmTax, markPurchasePaid } from '../src/utils/purchasePayments.js';
import { supplierStatement } from '../src/utils/supplierStatement.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  if (actual === expected) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
}
const j = (o) => JSON.stringify(o);

const line = (name, rate, quantity = 1, taxPercent = 18, cessPercent = 0) => ({ name, quantity, rate, taxPercent, cessPercent });
// Intra-state GTA bill 1000 @ 18% (reverse charge), inter-state 500 @ 28% + 12% cess
// (reverse charge), and an ordinary bill 2000 @ 18% (not counted in 3.1(d)).
const gta = { id: 'r1', supplierName: 'DiceCodes Transport', invoiceNumber: 'GT-1', date: '2026-11-03', reverseCharge: true, interstate: false, items: [line('Freight', 100, 10)] };
const imp = { id: 'r2', supplierName: 'DiceCodes Goods', invoiceNumber: 'G-7', date: '2026-11-04', reverseCharge: true, interstate: true, items: [line('Cashew', 500, 1, 28, 12)] };
const normal = { id: 'n1', supplierName: 'DiceCodes Paper', invoiceNumber: 'P-1', date: '2026-11-05', interstate: false, items: [line('Paper', 2000)] };

console.log('\n[RCM] GSTR-3B 3.1(d): reverse-charge bills only');
{
  const d = rcmInward([gta, imp, normal], {});
  eq(j(d), j({ txval: 1500, iamt: 140, camt: 90, samt: 90, csamt: 60 }), 'taxable 1500, IGST 140, CGST 90, SGST 90, cess 60; the ordinary bill is left out');
  eq(j(rcmInward([normal], {})), j({ txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 }), 'no reverse-charge bill: all 0 (the return is as before)');
  const dn = { id: 'd1', purchaseId: 'r1', date: '2026-11-10', reverseCharge: true, items: [line('Freight', 400)] };
  const ret = purchaseReturnsTax([dn]);
  eq(j(rcmInward([gta], ret)), j({ txval: 600, iamt: 0, camt: 54, samt: 54, csamt: 0 }), 'returns on reverse-charge bills come off 3.1(d)');
  const legacy = { reverseCharge: true, interstate: true, taxableAmount: 100, totalTax: 18, totalCess: 0 };
  eq(j(rcmInward([legacy], {})), j({ txval: 100, iamt: 18, camt: 0, samt: 0, csamt: 0 }), 'a bill without lines uses its saved totals');
}

console.log('\n[RCM] GSTR-3B Table 4: the reverse-charge tax is 4(A)(3)');
{
  const avl = { igst: 500, cgst: 300, sgst: 300, cess: 60 };
  const { isrc, oth } = splitRcmItc(avl, { iamt: 140, camt: 90, samt: 90, csamt: 60 });
  eq(j(isrc), j({ igst: 140, cgst: 90, sgst: 90, cess: 60 }), '4(A)(3) = the 3.1(d) tax');
  eq(j(oth), j({ igst: 360, cgst: 210, sgst: 210, cess: 0 }), '4(A)(5) = the rest');
  eq(isrc.igst + oth.igst, 500, 'total credit unchanged');
  const capped = splitRcmItc({ igst: 50, cgst: 0, sgst: 0, cess: 0 }, { iamt: 140, camt: 0, samt: 0, csamt: 0 });
  eq(`${capped.isrc.igst}|${capped.oth.igst}`, '50|0', 'never more than the credit available (returns took the rest)');
  eq(j(splitRcmItc(avl, { iamt: 0, camt: 0, samt: 0, csamt: 0 }).oth), j(avl), 'no reverse charge: everything stays in 4(A)(5)');
}

console.log('\n[RCM] The supplier is owed the bill without GST');
{
  eq(purchaseRcmTax(gta), 180, 'GST you pay on the GTA bill');
  eq(purchaseOwed(gta), 1000, 'owed 1000, not 1180');
  eq(purchaseOwed({ ...gta, tdsAmount: 10 }), 990, 'less TDS too');
  eq(purchaseOwed(normal), 2360, 'an ordinary bill is owed in full, as before');
  eq(purchaseRcmTax(normal), 0, 'no reverse-charge tax on it');
  const paid = markPurchasePaid(gta, '2026-11-06', new Date('2026-11-06T10:00:00Z'), 'cash');
  eq(`${paid.payments[0].amount}|${paid.paymentStatus}`, '1000|Paid', 'Mark as paid records 1000 and the bill is Paid');
  const dn = { id: 'd1', purchaseId: 'r1', date: '2026-11-10', items: [{ ...line('Freight', 100, 4), line: 0 }] };
  const [withRet] = withReturns([gta], [dn]);
  eq(withRet._returned, 400, 'a return takes off its value without GST');
  eq(purchaseBalance(withRet), 600, 'balance 1000 - 400');
  const st = supplierStatement([gta], [dn], 'DiceCodes Transport');
  eq(st.closing, 600, 'supplier statement agrees');
  eq(st.rows[0].particulars, 'Purchase bill GT-1 (reverse charge: GST paid by you)', 'statement says so');
}

console.log('\n────────────────────────────────────────');
console.log(`Passed: ${passed}   Failed: ${failed}`);
if (failed) process.exit(1);
