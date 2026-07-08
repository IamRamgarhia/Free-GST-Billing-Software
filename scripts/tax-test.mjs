// v1.10.1 — Tax compliance test harness. Exercises every finding from
// the audit's Bundle 2 (GST / TDS / TCS / precision / ITR).
//
// Run: `node scripts/tax-test.mjs`
//
// Each test is a plain assertion — the file exits non-zero on any
// failure. Uses only the exported pure helpers from src/utils.js and
// src/utils/itr.js so we can run it without booting the React app.

import {
  calculateLineItemTax,
  generateEWayBillJSON,
  computeInvoiceTotals,
  isUnionTerritoryWithoutLegislature,
  getStateCode,
} from '../src/utils.js';
import {
  computeSurcharge,
  computeAdvanceTaxSchedule,
  compute234CInterest,
  compute234BInterest,
  DEDUCTION_CAPS,
  effectiveDeductionCap,
} from '../src/utils/itr.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
}
function approx(actual, expected, label, tol = 0.01) {
  const ok = Math.abs(actual - expected) < tol;
  if (ok) { passed++; console.log(`  ✓ ${label} (${actual})`); }
  else { failed++; console.log(`  ✗ ${label}  expected≈${expected}  actual=${actual}`); }
}
function truthy(x, label) { if (x) { passed++; console.log(`  ✓ ${label}`); } else { failed++; console.log(`  ✗ ${label}  (got ${JSON.stringify(x)})`); } }

// ─────────────────────────────────────────────────────────────────────
// C5 — Interstate detection when profile.state is BLANK
// ─────────────────────────────────────────────────────────────────────
console.log('\n[C5] Interstate detection when business state is blank');
{
  const r = computeInvoiceTotals({
    items: [{ quantity: 1, rate: 100000, discount: 0, taxPercent: 18 }],
    profile: { country: 'India', state: '' },
    client: { state: 'Karnataka' },
    details: { placeOfSupply: 'Karnataka' },
    showGST: true,
  });
  truthy(r.warnings && r.warnings.some(w => /state.*not set/i.test(w)),
    'blank business state produces a "state not set" warning');
  truthy(r.needsProfileFix, 'sets needsProfileFix flag');
}

// ─────────────────────────────────────────────────────────────────────
// C6 — UTGST for intra-UT supplies (Chandigarh)
// ─────────────────────────────────────────────────────────────────────
console.log('\n[C6] UTGST bucket for intra-UT supplies');
{
  eq(isUnionTerritoryWithoutLegislature('04'), true, 'Chandigarh (04) → UT w/o legislature');
  eq(isUnionTerritoryWithoutLegislature('35'), true, 'A&N (35) → UT w/o legislature');
  eq(isUnionTerritoryWithoutLegislature('38'), true, 'Ladakh (38) → UT w/o legislature');
  eq(isUnionTerritoryWithoutLegislature('31'), true, 'Lakshadweep (31) → UT w/o legislature');
  eq(isUnionTerritoryWithoutLegislature('26'), true, 'DN&DD (26) → UT w/o legislature');
  eq(isUnionTerritoryWithoutLegislature('07'), false, 'Delhi (07) → HAS legislature (SGST, not UTGST)');
  eq(isUnionTerritoryWithoutLegislature('34'), false, 'Puducherry (34) → HAS legislature');
  eq(isUnionTerritoryWithoutLegislature('27'), false, 'Maharashtra → not UT');

  // Intra-Chandigarh supply → CGST + UTGST, sgst=0, utgst=9%
  const r = computeInvoiceTotals({
    items: [{ quantity: 1, rate: 100, discount: 0, taxPercent: 18 }],
    profile: { country: 'India', state: 'Chandigarh' },
    client: { state: 'Chandigarh' },
    details: { placeOfSupply: 'Chandigarh' },
    showGST: true,
  });
  approx(r.cgst, 9, 'Chandigarh→Chandigarh: CGST = 9');
  approx(r.utgst, 9, 'Chandigarh→Chandigarh: UTGST = 9');
  approx(r.sgst, 0, 'Chandigarh→Chandigarh: SGST = 0');
  approx(r.igst, 0, 'Chandigarh→Chandigarh: IGST = 0');
}

// ─────────────────────────────────────────────────────────────────────
// C7 — E-Way Bill taxable value when tax-inclusive
// ─────────────────────────────────────────────────────────────────────
console.log('\n[C7] E-Way Bill respects tax-inclusive');
{
  const items = [{ quantity: 1, rate: 118, discount: 0, taxPercent: 18, hsn: '9018', name: 'Widget' }];
  const totals = computeInvoiceTotals({
    items, profile: { country: 'India', state: 'Maharashtra', gstin: '27ABCDE1234F1Z5' },
    client: { state: 'Maharashtra' }, details: { placeOfSupply: 'Maharashtra' },
    showGST: true, taxInclusive: true,
  });
  const ewb = generateEWayBillJSON(
    { country: 'India', state: 'Maharashtra', gstin: '27ABCDE1234F1Z5', pin: '400001', address: 'Mumbai' },
    { state: 'Maharashtra', gstin: '27ZZZZZ9999Z1Z9', pin: '400002', address: 'Mumbai' },
    { invoiceNumber: 'INV/1', invoiceDate: '2026-07-08' },
    items, totals, 'tax-invoice',
    { taxInclusive: true },   // NEW: fourth-arg-plus opts
  );
  // ₹118 gross MRP → taxable value should be ₹100
  approx(ewb.billLists[0].itemList[0].taxableAmount, 100, 'itemList[0].taxableAmount = 100 (was 118 in old code)');
  approx(ewb.billLists[0].totalValue, 100, 'totalValue = 100 (was 118)');
  approx(ewb.billLists[0].totInvValue, 118, 'totInvValue = 118 (unchanged)');
}

// ─────────────────────────────────────────────────────────────────────
// H6 — TCS 206C(1H) base includes GST
// ─────────────────────────────────────────────────────────────────────
console.log('\n[H6/H7] TCS/TDS on right base + 50L threshold');
{
  // ₹1,00,000 + 18% IGST + 0.1% TCS. Correct: TCS = 0.1% × 118000 = 118. Old = 100.
  // But NOT triggered because threshold not met (single invoice ₹1L << ₹50L).
  const rNotTriggered = computeInvoiceTotals({
    items: [{ quantity: 1, rate: 100000, discount: 0, taxPercent: 18 }],
    profile: { country: 'India', state: 'Maharashtra' },
    client: { state: 'Karnataka' }, details: { placeOfSupply: 'Karnataka' },
    showGST: true,
    invoiceOptions: { showTCS: true, tcsRate: 0.1, tcsCumulativeThisYear: 100000 }, // way below 50L
  });
  approx(rNotTriggered.tcsAmount, 0, 'below ₹50L cumulative → TCS = 0');

  // Now: cumulative already at 50L → next invoice DOES attract TCS on the marginal amount
  const rTriggered = computeInvoiceTotals({
    items: [{ quantity: 1, rate: 100000, discount: 0, taxPercent: 18 }],
    profile: { country: 'India', state: 'Maharashtra' },
    client: { state: 'Karnataka' }, details: { placeOfSupply: 'Karnataka' },
    showGST: true,
    invoiceOptions: { showTCS: true, tcsRate: 0.1, tcsCumulativeThisYear: 5000000 },
  });
  // Marginal amount for TCS = full invoice inv-value 118,000 (above threshold).
  // 0.1% × 118000 = 118
  approx(rTriggered.tcsAmount, 118, 'above ₹50L: TCS = 0.1% × 118000 = 118 (Circular 17/2020)');
}

// ─────────────────────────────────────────────────────────────────────
// M5 — RCM + tax-inclusive should not double-charge buyer
// ─────────────────────────────────────────────────────────────────────
console.log('\n[M5] RCM + tax-inclusive back-out embedded tax');
{
  const r = computeInvoiceTotals({
    items: [{ quantity: 1, rate: 118, discount: 0, taxPercent: 18 }],
    profile: { country: 'India', state: 'Maharashtra' },
    client: { state: 'Maharashtra' }, details: { placeOfSupply: 'Maharashtra' },
    showGST: true, taxInclusive: true,
    invoiceOptions: { reverseCharge: true },
  });
  // Under RCM the SELLER's invoice total = taxable value only (₹100), NOT the MRP.
  // Old code produced total=118 which meant buyer pays ₹118 to seller + ₹18 GST to govt.
  approx(r.total, 100, 'RCM + inclusive: seller invoice total = 100, not 118');
}

// ─────────────────────────────────────────────────────────────────────
// M8 — totalTaxCollected includes cess (+ UTGST)
// ─────────────────────────────────────────────────────────────────────
console.log('\n[M8] totalTaxCollected includes cess and UTGST');
{
  const r = computeInvoiceTotals({
    items: [{ quantity: 1, rate: 100, discount: 0, taxPercent: 18, cessPercent: 15 }],
    profile: { country: 'India', state: 'Chandigarh' },
    client: { state: 'Chandigarh' }, details: { placeOfSupply: 'Chandigarh' },
    showGST: true,
  });
  approx(r.totalTaxAmount, 9 + 9 + 0 + 15, 'total tax = CGST 9 + UTGST 9 + IGST 0 + cess 15 = 33');
}

// ─────────────────────────────────────────────────────────────────────
// M10 — non-numeric rate coerced safely
// ─────────────────────────────────────────────────────────────────────
console.log('\n[M10] Non-numeric rate/qty stays finite');
{
  const r = computeInvoiceTotals({
    items: [{ quantity: '3', rate: 'abc', discount: 0, taxPercent: 18 }],
    profile: { country: 'India', state: 'Maharashtra' },
    client: { state: 'Maharashtra' }, details: { placeOfSupply: 'Maharashtra' },
    showGST: true,
  });
  eq(Number.isFinite(r.total) && r.total >= 0, true, 'total is finite non-negative even with bad rate');
  approx(r.subtotal, 0, 'bad rate → subtotal 0');
}

// ─────────────────────────────────────────────────────────────────────
// H11 — Per-line rounding consistent between invoice and GSTR-1 export
// ─────────────────────────────────────────────────────────────────────
console.log('\n[H11] Rounding: sum-of-rounded-lines used consistently');
{
  const items = [
    { quantity: 1, rate: 42.05, discount: 0, taxPercent: 18 },
    { quantity: 1, rate: 42.05, discount: 0, taxPercent: 18 },
    { quantity: 1, rate: 42.05, discount: 0, taxPercent: 18 },
  ];
  const r = computeInvoiceTotals({
    items, profile: { country: 'India', state: 'Maharashtra' },
    client: { state: 'Maharashtra' }, details: { placeOfSupply: 'Maharashtra' },
    showGST: true,
  });
  // Per-line tax: 42.05 × 0.18 = 7.569 → round(7.57 / 2) = 3.785 each side.
  // Sum of 3 rounded-halves: CGST = 3 × 3.785 = 11.355
  const perLine = items.map(it => Math.round(it.rate * it.taxPercent) / 100);
  const perLineCgst = perLine.reduce((s, v) => s + v/2, 0);
  approx(r.cgst, Math.round(perLineCgst * 100) / 100,
    'invoice CGST equals sum-of-per-line-rounded-halves');
}

// ─────────────────────────────────────────────────────────────────────
// ITR fixes
// ─────────────────────────────────────────────────────────────────────
console.log('\n[H8] 234C for presumptive: 1% × 1 month × Q4 shortfall');
{
  const sched = computeAdvanceTaxSchedule(100000, 0, [], 'presumptive');
  // Presumptive: single 100% installment on 15-Mar (Q4). No advance paid.
  // Correct §234C = 1% × 1 month × 100000 = 1000
  const int234c = compute234CInterest(sched);
  approx(int234c, 1000, '234C = 1000 (single Q4 installment, 1% × 1 month)');
}

console.log('\n[H9] Surcharge 15% cap on 111A/112A gains');
{
  // ₹5.5Cr salary + ₹1L LTCG. Old code: 37% × entire tax including LTCG.
  // New: 15% cap applies to LTCG's share of tax.
  const s = computeSurcharge(1000000, 55000000, 'new', { specialRateTax: 15000 });
  // Regular-tax portion (985000) gets 25%. LTCG-tax portion (15000) gets 15%.
  // Expected: 25% × 985000 + 15% × 15000 = 246250 + 2250 = 248500
  approx(s, 248500, 'surcharge respects 15% cap on 111A/112A tax portion');
}

console.log('\n[H10] 80D cap depends on senior status');
{
  approx(effectiveDeductionCap('80D', { selfSenior: false, parentsSenior: false }), 50_000, '80D non-senior+non-senior parents = 50k');
  approx(effectiveDeductionCap('80D', { selfSenior: false, parentsSenior: true  }), 75_000, '80D non-senior + senior parents = 75k');
  approx(effectiveDeductionCap('80D', { selfSenior: true,  parentsSenior: true  }), 100_000, '80D both senior = 100k');
  approx(effectiveDeductionCap('80C', {}), 150_000, '80C untouched');
}

console.log('\n[M6] 234B uses calendar months (not 30-day months)');
{
  const sched = { applies: true, netLiability: 100000, totalPaid: 0 };
  // 1-Apr-2025 to 31-May-2025 = 2 calendar months. 1% × 2 × 100000 = 2000.
  const int234b = compute234BInterest(sched, '2025-05-31');
  approx(int234b, 2000, 'Apr-1 to May-31 = 2 calendar months → 2000');
}

console.log('\n────────────────────────────────────────');
console.log(`Passed: ${passed}   Failed: ${failed}`);
if (failed) process.exit(1);
