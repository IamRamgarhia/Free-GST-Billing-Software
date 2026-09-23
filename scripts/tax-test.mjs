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
  salesSign,
  isCancelledBill,
  getDefaultUnitForMode,
  decodeGstin,
  gstinChecksumOk,
  stateNameForCode,
  INDIAN_STATES,
} from '../src/utils.js';
import {
  compute44AE,
  computeSurcharge,
  computeAdvanceTaxSchedule,
  compute234CInterest,
  compute234BInterest,
  compute234AInterest,
  DEDUCTION_CAPS,
  effectiveDeductionCap,
  computeTax,
  computeAllowedDeductions,
  computeRebate87A,
  getAdvanceTaxSchedule,
  getCapitalGainsConfig,
  get87AConfig,
  getOldRegimeSlabs,
  getNewRegimeSlabs,
  CURRENT_FY,
  NEW_REGIME_SLABS_FY_2025_26,
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
  // v1.10.31 — Test now specifies fy so compute234BInterest picks the
  // correct April-1 anchor (was hardcoded to 2025-04-01; now FY-relative).
  const sched = { applies: true, netLiability: 100000, totalPaid: 0, fy: '2024-25' };
  // 1-Apr-2025 to 31-May-2025 = 2 calendar months. 1% × 2 × 100000 = 2000.
  const int234b = compute234BInterest(sched, '2025-05-31');
  approx(int234b, 2000, 'Apr-1 to May-31 = 2 calendar months → 2000');
}

// ═══════════════════════════════════════════════════════════════════════════
// v1.10.31 — Audit-driven test cases. Every Critical/High tax finding from
// the July 2026 comprehensive audit gets a regression test here.
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n[V31-C2] FY 25-26 new regime — Budget 2025 slabs + ₹60k rebate at ₹12L');
{
  // Salaried ₹12L income, new regime FY 25-26. Correct tax = ₹0 after 87A.
  const r = computeTax({ salary: 1_275_000, regime: 'new', fy: '2025-26' });
  approx(r.totalTax, 0, '₹12.75L salary FY 25-26 new regime → ₹0 tax (75k std ded + 60k rebate on ₹12L)');
  // Above the ₹12L threshold: normal slab tax kicks in.
  const r2 = computeTax({ salary: 1_400_000, regime: 'new', fy: '2025-26' });
  truthy(r2.totalTax > 0, '₹14L salary above rebate threshold → some tax');
}

console.log('\n[V31-C4] Capital gains rates — post-July-2024 (STCG 20%, LTCG 12.5%, exempt ₹1.25L)');
{
  const cg = getCapitalGainsConfig('2025-26');
  approx(cg.stcgRate, 0.20, 'STCG rate FY 25-26 = 20% (Finance No.2 Act 2024)');
  approx(cg.ltcgRate, 0.125, 'LTCG rate FY 25-26 = 12.5%');
  approx(cg.ltcgExemption, 125_000, 'LTCG exemption FY 25-26 = ₹1.25L');
  // ₹10L LTCG at 12.5% over ₹1.25L exemption = ₹1,09,375
  const r = computeTax({ ltcgAtSpecialRate: 1_000_000, regime: 'new', fy: '2025-26' });
  approx(r.ltcgTax, 109_375, '₹10L LTCG → ₹1,09,375 tax at 12.5% over ₹1.25L exempt');
  // ₹5L STCG at 20% = ₹1,00,000
  const r2 = computeTax({ stcgAtSpecialRate: 500_000, regime: 'new', fy: '2025-26' });
  approx(r2.stcgTax, 100_000, '₹5L STCG → ₹1,00,000 tax at 20%');
}

console.log('\n[V31-C1] 15% surcharge cap on 111A/112A gains now wired through computeTax');
{
  // ₹5.5Cr salary + ₹10L LTCG. New regime tier at ₹5.5Cr is 25%.
  // LTCG tax (post exempt): (10L - 1.25L) × 12.5% = ~₹1,09,375
  // Slab tax on ₹5.5Cr: ~₹1,63,20,000. Surcharge = slab × 25% + LTCG × 15%.
  const r = computeTax({ salary: 55_000_000, ltcgAtSpecialRate: 1_000_000, regime: 'new', fy: '2025-26' });
  // Without wiring: surcharge would be 25% on LTCG tax too. Now capped at 15%.
  // The specific ratio: specialRateTax = ₹1,09,375. Its surcharge = 15% × 1,09,375 = ₹16,406.
  // Meanwhile slab-tax-portion surcharge is at 25%. Total surcharge should
  // reflect the blend.
  truthy(r.specialRateTax > 0, 'specialRateTax populated (₹1L+ from LTCG)');
  truthy(r.surcharge > 0, 'surcharge computed');
  // Direct check: computeSurcharge with specialRateTax = specialRateTax
  const specialSurcharge = computeSurcharge(r.specialRateTax, 55_000_000, 'new', { specialRateTax: r.specialRateTax });
  approx(specialSurcharge, r.specialRateTax * 0.15, '15% cap on specialRateTax portion honored');
}

console.log('\n[V31-C3] Advance-tax due dates are FY-relative');
{
  const s2526 = getAdvanceTaxSchedule('2025-26');
  eq(s2526[0].dueDate, '2025-06-15', 'FY 25-26 Q1 due = 15 Jun 2025');
  eq(s2526[3].dueDate, '2026-03-15', 'FY 25-26 Q4 due = 15 Mar 2026');
  const s2425 = getAdvanceTaxSchedule('2024-25');
  eq(s2425[0].dueDate, '2024-06-15', 'FY 24-25 Q1 due = 15 Jun 2024');
  // Filter test: FY 25-26 filer paying 2025-06-14 → counted for Q1.
  const sched = computeAdvanceTaxSchedule(500_000, 0, [{ date: '2025-06-14', amount: 75_000 }], 'regular', '2025-26');
  approx(sched.schedule[0].totalPaidByDue, 75_000, 'FY 25-26 payment 2025-06-14 counts toward Q1');
}

console.log('\n[V31-H1] effectiveDeductionCap wired into computeAllowedDeductions');
{
  // Non-senior with non-senior parents claiming ₹1L for 80D. Statute cap = ₹50k.
  const total = computeAllowedDeductions({ '80D': 100_000 }, 'old', { selfSenior: false, parentsSenior: false });
  approx(total, 50_000, 'Non-senior 80D capped at ₹50k (not ₹1L which was the static max)');
  // Senior claiming ₹1L for 80D — allowed the full ₹1L (self ₹50k + parents ₹50k).
  const total2 = computeAllowedDeductions({ '80D': 100_000 }, 'old', { selfSenior: true, parentsSenior: true });
  approx(total2, 100_000, 'Both senior 80D allows full ₹1L');
}

console.log('\n[V31-H5] 80CCD(2) capped at 10% of salary (14% for govt)');
{
  // Salary ₹10L, claiming ₹5L employer NPS. Cap should be ₹1L (10%).
  const total = computeAllowedDeductions({ '80CCD2': 500_000 }, 'new', { salary: 1_000_000 });
  approx(total, 100_000, '80CCD(2) private-sector capped at 10% of salary');
  const total2 = computeAllowedDeductions({ '80CCD2': 500_000 }, 'new', { salary: 1_000_000, isGovtEmployee: true });
  approx(total2, 140_000, '80CCD(2) govt-sector capped at 14% of salary');
  // Excessive claim without salary context → 0 allowed (no cap basis).
  const total3 = computeAllowedDeductions({ '80CCD2': 500_000 }, 'new', {});
  approx(total3, 0, '80CCD(2) without salary context → 0 allowed (safe default)');
}

console.log('\n[V31-H6] Senior / super-senior old-regime basic exemption slabs');
{
  const senior = getOldRegimeSlabs(65);
  eq(senior[0].upto, 300_000, 'Senior (60-80) first slab up to ₹3L');
  const superSenior = getOldRegimeSlabs(85);
  eq(superSenior[0].upto, 500_000, 'Super senior (80+) first slab up to ₹5L');
  const regular = getOldRegimeSlabs(30);
  eq(regular[0].upto, 250_000, 'Regular (<60) first slab up to ₹2.5L');
  // Senior with ₹3L income old regime → ₹0 tax (was ₹2,500 before fix).
  const r = computeTax({ salary: 300_000, regime: 'old', fy: '2025-26', age: 65 });
  approx(r.slabTax, 0, 'Senior with ₹3L salary → ₹0 slab tax');
}

console.log('\n[V31-H2] 87A eligibility uses TOTAL income including capital gains');
{
  // Old regime, salary ₹5.3L → after ₹50k std ded = ₹4.8L slab-taxable.
  // Plus ₹50k LTCG → total income under Section 2(45) = ₹5.3L > ₹5L threshold.
  // Rebate must be DENIED. Note: LTCG is counted at gross (₹50k), not
  // post-exemption ₹0, because Section 87A eligibility uses total income
  // per Section 2(45), which includes gross capital gains.
  const r = computeTax({ salary: 530_000, ltcgAtSpecialRate: 50_000, regime: 'old', fy: '2025-26' });
  approx(r.rebate87A, 0, '₹5.3L salary + ₹50k LTCG → total ₹5.3L > ₹5L → 87A rebate DENIED');
  // Same salary, no capital gains → total ₹4.8L < ₹5L → rebate applies.
  const r2 = computeTax({ salary: 530_000, regime: 'old', fy: '2025-26' });
  truthy(r2.rebate87A > 0, '₹5.3L salary alone → total ₹4.8L → 87A rebate applies');
}

console.log('\n[V31-H3] Marginal relief on surcharge crossings');
{
  // Income ₹50,00,010 old regime. Base tax (before surcharge) ~₹13,12,503.
  // Without relief: 10% surcharge = ~₹1,31,250. That's ₹1.3L extra tax for
  // ₹10 extra income — reduced to ₹10 by marginal relief.
  const tax_at_5cr = 1_312_500; // rough
  const sr = computeSurcharge(tax_at_5cr, 5_000_010, 'old');
  // Marginal relief caps surcharge at delta between thresholds. Actual value
  // depends on exact tax — we just verify it's WAY under ₹1.3L.
  truthy(sr < 50_000, `Marginal relief at ₹50,00,010 caps surcharge (got ₹${sr.toFixed(0)}, way under raw ₹1,31,250)`);
}

console.log('\n[V31-H4] Rule 119A ₹100 rounding on 234B shortfall');
{
  // Shortfall = ₹1,49,999 → round down to ₹1,49,900.
  // At 1% × 2 months → ₹2,998 (not ₹2,999.98).
  const sched = { applies: true, netLiability: 149_999, totalPaid: 0, fy: '2024-25' };
  const int234b = compute234BInterest(sched, '2025-05-31');
  approx(int234b, 2998, 'Rule 119A: shortfall ₹1,49,999 → interest on ₹1,49,900');
}

console.log('\n[V31-M2] Section 234A — late-filing interest');
{
  // FY 25-26 (due 31-Jul-2026). Filed 15-Aug-2026 → 1 month at 1%.
  // Outstanding ₹1L → interest = 100_000 × 0.01 × 1 = ₹1,000.
  const int1 = compute234AInterest(100_000, 0, '2026-08-15', undefined, '2025-26');
  approx(int1, 1000, '₹1L outstanding, 15 days late (rounded to 1 month) → ₹1,000');
  // Filed exactly on due date → ₹0.
  const int2 = compute234AInterest(100_000, 0, '2026-07-31', undefined, '2025-26');
  approx(int2, 0, 'Filed on due date → no 234A');
  // Filed 3 months + 1 day late → 4 months × 1% × ₹1L = ₹4,000.
  const int3 = compute234AInterest(100_000, 0, '2026-11-01', undefined, '2025-26');
  approx(int3, 4000, '3m+1d late (Rule 119A: rounds up to 4 months) → ₹4,000');
  // Taxes fully paid via TDS + advance → no outstanding → no 234A.
  const int4 = compute234AInterest(100_000, 100_000, '2026-08-15', undefined, '2025-26');
  approx(int4, 0, 'Zero outstanding (fully paid via TDS/advance) → no 234A');
  // Rule 119A rounding — ₹1,49,999 outstanding → interest on ₹1,49,900.
  const int5 = compute234AInterest(149_999, 0, '2026-08-15', undefined, '2025-26');
  approx(int5, 1499, 'Rule 119A: ₹1,49,999 rounded down to ₹1,49,900 for interest calc');
  // Explicit dueDate override (audit case, 31-Oct-2026).
  const int6 = compute234AInterest(100_000, 0, '2026-11-15', '2026-10-31', '2025-26');
  approx(int6, 1000, 'Audit case: due 31-Oct, filed 15-Nov → 1 month');
}

console.log('\n[V31-M3] §44AE parity — isEligible, negative clamp, declared-below-deemed');
{
  // 2 heavy vehicles × 12 tonnes × 12 months → ₹2,88,000 deemed.
  const ok = compute44AE({ heavyVehicleMonths: 24, heavyVehicleTonnage: 12, lightVehicleMonths: 0 });
  eq(ok.isEligible, true, 'Small fleet within 10-vehicle cap → eligible');
  approx(ok.deemedIncome, 288_000, '2 vehicles × 12t × 12m × ₹1,000 = ₹2,88,000');
  // 11 heavy vehicles × 12 months → 132 vehicle-months → implied fleet 11 > 10.
  const over = compute44AE({ heavyVehicleMonths: 132, heavyVehicleTonnage: 15, lightVehicleMonths: 0 });
  eq(over.isEligible, false, 'Implied fleet > 10 → NOT eligible');
  truthy(over.notes.some(n => /fleet.*10/i.test(n)), 'Note explains the 10-vehicle disqualifier');
  // Negative input is clamped to 0 (was silently producing negative income).
  const neg = compute44AE({ heavyVehicleMonths: -5, heavyVehicleTonnage: 15, lightVehicleMonths: 0 });
  approx(neg.deemedIncome, 0, 'Negative vehicle-months clamped to 0');
  // Declared income below deemed → warning added.
  const under = compute44AE({ heavyVehicleMonths: 24, heavyVehicleTonnage: 12, lightVehicleMonths: 0, declaredIncome: 100_000 });
  truthy(under.notes.some(n => /less than the presumptive minimum/i.test(n)), 'Warns when declared < deemed');
}

// ─────────────────────────────────────────────────────────────────────
// v1.10.66 (#61) — IGST vs CGST + SGST, and the flag the invoice relies on.
// The printed tax rows now follow `isInterstate` from these totals, so the
// flag has to be right in every case the rows can be asked to describe.
// ─────────────────────────────────────────────────────────────────────
console.log('\n[V66-#61] Interstate decision and the isInterstate flag');
{
  const items = [{ quantity: 1, rate: 1000, discount: 0, taxPercent: 18 }];
  const profile = { country: 'India', state: 'Punjab', gstin: '03AAAAA1111A1Z1' };
  const run = (client, details = {}, invoiceOptions = {}) =>
    computeInvoiceTotals({ items, profile, client, details, invoiceOptions });

  const inter = run({ state: 'Delhi' }, { placeOfSupply: 'Delhi' });
  eq([inter.isInterstate, inter.igst, inter.cgst], [true, 180, 0], 'Delhi client, place of supply Delhi → IGST');

  const intra = run({ state: 'Punjab' }, { placeOfSupply: 'Punjab' });
  eq([intra.isInterstate, intra.igst, intra.cgst, intra.sgst], [false, 0, 90, 90], 'Same state → CGST + SGST');

  // The case #61 reported: the engine charged CGST + SGST while the invoice,
  // comparing state names on its own, printed an "IGST ₹0.00" row.
  const posGoverns = run({ state: 'Delhi' }, { placeOfSupply: 'Punjab' });
  eq([posGoverns.isInterstate, posGoverns.igst, posGoverns.cgst], [false, 0, 90], 'Delhi client supplied in Punjab → place of supply governs');

  const byGstin = run({ gstin: '07BBBBB2222B1Z2' });
  eq([byGstin.isInterstate, byGstin.igst], [true, 180], 'Client known only by an out-of-state GSTIN → IGST');

  const exportClient = run({ country: 'United States', state: 'California' }, {}, { currency: 'USD' });
  eq([exportClient.isInterstate, exportClient.igst, exportClient.cgst], [true, 180, 0], 'Client outside India → IGST, never CGST + SGST');
  truthy(!exportClient.warnings.some(w => /Place of supply is not set/.test(w)), 'No "place of supply not set" warning for an export');

  // PR #60 made any non-INR currency an export. Currency is not place of supply.
  const usdInState = run({ country: 'India', state: 'Punjab' }, { placeOfSupply: 'Punjab' }, { currency: 'USD' });
  eq([usdInState.isInterstate, usdInState.igst, usdInState.cgst], [false, 0, 90], 'Indian client in the same state billed in USD stays CGST + SGST');

  const deliveredHere = run({ country: 'United States' }, { placeOfSupply: 'Punjab' });
  eq([deliveredHere.isInterstate, deliveredHere.cgst], [false, 90], 'Foreign client with an explicit Indian place of supply follows that place');

  const noCountry = run({ state: 'Punjab' });
  eq(noCountry.isInterstate, false, 'A client with no country recorded is treated as Indian');

  eq(typeof intra.isInterstate, 'boolean', 'isInterstate is always a boolean');
}

// ─────────────────────────────────────────────────────────────────────
// v1.10.67 (#66 items 7 and 12) — what counts as turnover. The dashboard
// cards, Reports, GST Returns and Income Tax all lean on this one rule.
// ─────────────────────────────────────────────────────────────────────
console.log('\n[V67-#66] Sales documents, credit notes and cancelled invoices');
{
  const doc = (invoiceType, status) => ({ invoiceType, status });
  eq(salesSign(doc('tax-invoice', 'unpaid')), 1, 'A tax invoice is a sale');
  eq(salesSign(doc('bill-of-supply', 'paid')), 1, 'A bill of supply is a sale');
  eq(salesSign(doc('composition', 'paid')), 1, 'A composition bill of supply is a sale');
  eq(salesSign(doc('credit-note', 'unpaid')), -1, 'A credit note takes money back off sales');
  eq(salesSign(doc('proforma', 'unpaid')), 0, 'A proforma is a quote, not a sale');
  eq(salesSign(doc('delivery-challan', 'unpaid')), 0, 'A delivery challan sells nothing');
  eq(salesSign(doc('tax-invoice', 'cancelled')), 0, 'A cancelled invoice counts for nothing');
  eq(salesSign(doc('credit-note', 'cancelled')), 0, 'A cancelled credit note counts for nothing either');
  eq(salesSign({ status: 'unpaid' }), 1, 'A bill with no type recorded is treated as a tax invoice');
  truthy(isCancelledBill({ status: 'cancelled' }), 'isCancelledBill spots the cancelled status');
  truthy(!isCancelledBill({ status: 'overdue' }), 'and leaves every other status alone');
  eq(getDefaultUnitForMode('goods'), 'Pcs', 'Goods default to Pcs (#66 item 2)');
  eq(getDefaultUnitForMode('mixed'), 'Pcs', 'Mixed invoices default to Pcs too');
  eq(getDefaultUnitForMode('services'), 'Hrs', 'Services still default to Hrs');
}

// ─────────────────────────────────────────────────────────────────────
// v1.10.68 (#68) — what a GSTIN says on its own, with no API key and no
// internet. The state it names decides place of supply, so a wrong one
// silently swaps CGST + SGST for IGST on every invoice to that client.
// ─────────────────────────────────────────────────────────────────────
console.log('\n[V68-#68] Reading a GSTIN offline');
{
  const real = decodeGstin('27AAPFU0939F1ZV');
  eq([real.stateCode, real.state, real.pan, real.entityType, real.taxpayerType, real.checksumOk],
    ['27', 'Maharashtra', 'AAPFU0939F', 'Firm / LLP', 'Regular', true],
    'A real GSTIN gives state, PAN, entity type and passes its own checksum');
  eq(decodeGstin('29AAGCB7383J1Z4').entityType, 'Company', 'The 4th letter of the PAN says Company');

  truthy(!gstinChecksumOk('27AAPFU0939F1ZW'), 'A wrong last character is rejected');
  truthy(!gstinChecksumOk('72AAPFU0939F1ZV'), 'Transposed state digits are rejected');
  truthy(!gstinChecksumOk('27AAPFU9039F1ZV'), 'Transposed digits inside the PAN are rejected');
  truthy(!gstinChecksumOk('27AAPFU0939F1Z'), 'A 14-character GSTIN is rejected');

  eq(stateNameForCode('03'), 'Punjab', 'Code 03 is Punjab');
  eq(stateNameForCode('37'), 'Andhra Pradesh', 'Code 37 is Andhra Pradesh, after the 2014 split');
  eq(stateNameForCode('26'), 'Dadra and Nagar Haveli and Daman and Diu', 'Code 26 is the merged UT, spelled the way the dropdown spells it');
  eq(stateNameForCode('96'), null, 'An unknown code returns null instead of a guess');
  // A filled-in state has to match a State dropdown option exactly, or the
  // client is left holding a state the form cannot show.
  const strays = INDIAN_STATES.filter((s) => stateNameForCode(getStateCode(s)) !== s);
  eq(strays, [], 'Every state survives name -> code -> name unchanged');

  eq(decodeGstin(''), null, 'Empty input decodes to null');
  eq(decodeGstin('27AAPFU0939F1Z'), null, 'A short string decodes to null');
}

console.log('\n────────────────────────────────────────');
console.log(`Passed: ${passed}   Failed: ${failed}`);
if (failed) process.exit(1);
