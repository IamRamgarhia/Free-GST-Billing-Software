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
  safePageBoundaries,
  clientYearToDate,
  b2clThreshold,
  GST_PORTAL_RATES,
  markPaidPatch,
  getCountryConfig,
  invoiceOptionOn,
  filledOrderDetails,
  formatShortDate,
  docsLink,
  TCS_SECTIONS,
  INVOICE_TYPES,
  printedSubtotal,
  setOffITC,
  isInterstateSupply,
  stockEffect,
  appliedStock,
  stockDelta,
  splitLineTax,
  markUnpaidPatch,
  findSameBusiness,
  splitNumberedTerms,
  deliveryChargeLine,
  nextCounterValue,
  startFor,
  roundQty,
  placeOfSupplyLabel,
  businessKeyOf,
  numberSeriesFor,
  counterKeyFor,
  formatDocNumber,
  ownPrefixProblem,
  numberFormatProblem,
  savedPdfNameFor,
  numberToWords,
  resolveLineDiscount,
  getUpcomingFilings,
  amountDue,
  paymentStatusFor,
  templateTotals,
  parseLocalDate,
  formatDateGST,
} from '../src/utils.js';
import { splitPurchaseTax, clientPaperPrefs, clientPaperOptions, getPaperSize } from '../src/utils.js';
import { buildXlsx, colName } from '../src/utils/xlsx.js';
import { bulkRowToProduct, closingStock, stockValueOf } from '../src/utils/products.js';
import { upiNote, parseSupporters, shouldShowSupportNudge } from '../src/utils/supporters.js';
import { parseChangelog, inlineParts } from '../src/utils/changelog.js';
import { unzipSync, strFromU8 } from 'fflate';
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
  TAX_YEARS,
  yearLabel,
  filingDueDates,
  NEW_REGIME_SLABS_FY_2025_26,
  AUTO_CATEGORY_RULES,
  buildITR4FieldMap,
} from '../src/utils/itr.js';
import { periodMonths, partyOutstanding } from '../src/utils/partyOutstanding.js';

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

// ─────────────────────────────────────────────────────────────────────
// v1.10.70 (ERR-024) - a PDF page may never end inside the signature block
// or an image. The footer is two columns; an edge that is safe on the left
// (between bank details and terms) cut the stamp on the right in half.
// ─────────────────────────────────────────────────────────────────────
console.log('\n[V70-ERR-024] Where a PDF page may end');
{
  // The footer from the reported invoice, in pixels from the top:
  //   left column:  bank details 1000-1150, terms 1150-1400
  //   right column: signature block 1000-1250, stamp image 1080-1220
  const edges = [0, 1000, 1150, 1250, 1400];
  const keepWhole = [[1000, 1150], [1150, 1400], [1000, 1250], [1080, 1220]];
  const safe = safePageBoundaries(edges, keepWhole);
  truthy(!safe.includes(1150), 'The gap between bank details and terms is NOT a place to break - the stamp is beside it');
  truthy(!safe.includes(1250), 'Nor is the bottom of the signature block, while terms still run beside it');
  eq(safe, [0, 1000, 1400], 'Only the top of the footer and the bottom of the whole footer are safe');

  // Items-table rows sit edge to edge; every row edge must stay usable.
  const rows = [[100, 150], [150, 200], [200, 250]];
  eq(safePageBoundaries([100, 150, 200, 250], rows), [100, 150, 200, 250], 'Row edges between adjacent rows are all still safe');

  eq(safePageBoundaries([0, 300, 300, 600], []), [0, 300, 600], 'Duplicates are dropped and the list is sorted');
  eq(safePageBoundaries([500], [[400, 401]]), [500], 'Zero-height spans (hidden elements) are ignored');
}


// ─────────────────────────────────────────────────────────────────────
// v1.10.71 - fixes found while writing the documentation
// ─────────────────────────────────────────────────────────────────────
console.log('\n[V71] TDS / TCS threshold only for 194Q and 206C(1H)');
{
  const base = { items: [{ quantity: 1, rate: 100000, taxPercent: 18 }], profile: { country: 'India', state: 'Punjab' }, client: { state: 'Punjab' }, details: {}, showGST: true };
  const tds194J = computeInvoiceTotals({ ...base, invoiceOptions: { showTDS: true, tdsSection: '194J', tdsRate: 10 } });
  // TDS is on the value WITHOUT GST when GST is shown separately (CBDT
  // Circular 23/2017): 10% of 1,00,000, not of 1,18,000.
  eq(tds194J.tdsAmount, 10000, '194J at 10% applies from the first rupee, on the value without GST');
  eq(tds194J.netReceivable, 108000, 'Net receivable = 1,18,000 - 10,000 TDS');
  const tds194Q = computeInvoiceTotals({ ...base, invoiceOptions: { showTDS: true, tdsSection: '194Q', tdsRate: 0.1, tdsCumulativeThisYear: 5000000 } });
  eq(tds194Q.tdsAmount, 100, '194Q above ₹50 lakh: 0.1% of the value without GST (Circular 13/2021)');
  const tcs1H = computeInvoiceTotals({ ...base, invoiceOptions: { showTCS: true, tcsSection: '206C(1H)', tcsRate: 0.1, tcsCumulativeThisYear: 0 } });
  eq(tcs1H.tcsAmount, 0, '206C(1H) still waits for the ₹50 lakh threshold');
  const tcs1Hover = computeInvoiceTotals({ ...base, invoiceOptions: { showTCS: true, tcsSection: '206C(1H)', tcsRate: 0.1, tcsCumulativeThisYear: 4950000 } });
  eq(tcs1Hover.tcsAmount, 68, '206C(1H) charges only the part above ₹50 lakh (68,000 × 0.1%)');
  // '52' is the code TCS_SECTIONS stores. Section 52 TCS is on the net
  // taxable value, without GST.
  const tcs52 = computeInvoiceTotals({ ...base, invoiceOptions: { showTCS: true, tcsSection: '52', tcsRate: 1 } });
  eq(tcs52.tcsAmount, 1000, 'CGST section 52 TCS applies from the first rupee, on the taxable value');
}

console.log("\n[V71] A client's sales so far this financial year");
{
  const bills = [
    { id: 'a', clientName: 'Meera', invoiceDate: '2026-04-10', totalAmount: 100, invoiceType: 'tax-invoice' },
    { id: 'b', clientName: 'meera ', invoiceDate: '2027-03-31', totalAmount: 200, invoiceType: 'tax-invoice' },
    { id: 'c', clientName: 'Meera', invoiceDate: '2026-03-31', totalAmount: 400, invoiceType: 'tax-invoice' },
    { id: 'd', clientName: 'Meera', invoiceDate: '2026-05-01', totalAmount: 800, invoiceType: 'proforma' },
    { id: 'e', clientName: 'Meera', invoiceDate: '2026-05-01', totalAmount: 1600, invoiceType: 'tax-invoice', status: 'cancelled' },
    { id: 'f', clientName: 'Meera', invoiceDate: '2026-05-01', totalAmount: 3200, invoiceType: 'tax-invoice', currency: 'USD' },
    { id: 'g', clientName: 'Arjun', invoiceDate: '2026-05-01', totalAmount: 6400, invoiceType: 'tax-invoice' },
  ];
  eq(clientYearToDate(bills, 'Meera', '2026-09-24'), 300, 'Same client, same FY, rupee sales only (quotes, cancelled, USD, last FY and other clients left out)');
  eq(clientYearToDate(bills, 'Meera', '2026-09-24', 'a'), 200, 'The invoice being edited is not counted twice');
  eq(clientYearToDate(bills, '', '2026-09-24'), 0, 'No client name, nothing counted');
}

console.log('\n[V71] GST rates and the B2C Large limit');
{
  eq(b2clThreshold('2024-07-31'), 250000, 'Before 1 Aug 2024 B2C Large starts above ₹2.5 lakh');
  eq(b2clThreshold('2024-08-01'), 100000, 'From 1 Aug 2024 it starts above ₹1 lakh');
  truthy(GST_PORTAL_RATES.includes(40), 'The GSTR-1 export accepts the 40% rate');
  truthy(getCountryConfig('India').taxRates.includes(40), 'Invoices offer the 40% rate');
}

console.log('\n[V71] Marking an invoice paid records the balance as a payment');
{
  const p = markPaidPatch({ totalAmount: 1000, payments: [{ amount: 400 }] });
  eq(p.paidAmount, 1000, 'Paid amount becomes the total');
  eq(p.payments.length, 2, 'One payment is added');
  eq(p.payments[1].amount, 600, 'For exactly the balance');
  truthy(!!p.payments[1].id, 'With an id, so its receipt gets a real number');
  eq(markPaidPatch({ totalAmount: 1000, payments: [{ amount: 1000 }] }).payments.length, 1, 'Nothing added when already fully paid');
}

console.log('\n[V71] Income tax: bank categories and the ITR-4 80D line');
{
  const cat = (d) => (AUTO_CATEGORY_RULES.find((r) => r.pattern.test(d)) || {}).category;
  eq(cat('OFFICE RENT SEPT'), 'business_out', 'Office rent is an expense, not rent received');
  eq(cat('NEFT RENT FROM TENANT'), 'rent_received', 'Rent from a tenant is still rent received');
  const inputs = { salary: 1200000, deductions: { '80D': 90000 }, age: 0, parentsSenior: false };
  const row = buildITR4FieldMap(inputs, computeTax({ ...inputs, regime: 'old' }), null, inputs.deductions).find((r) => r.field.startsWith('§80D'));
  eq(row.value, 50000, 'The PDF shows the same ₹50,000 limit the tax used (was ₹1 lakh)');
  const senior = { ...inputs, age: 60, selfSenior: true, parentsSenior: true };
  const row2 = buildITR4FieldMap(senior, computeTax({ ...senior, regime: 'old' }), null, senior.deductions).find((r) => r.field.startsWith('§80D'));
  eq(row2.value, 90000, 'Senior self and parents allow up to ₹1 lakh, so all 90,000 counts');
}


console.log('\n[V73] Customize options, order details, Quotation, docs links');
{
  eq(invoiceOptionOn({}, 'showLogo'), true, 'An option never saved is on by default');
  eq(invoiceOptionOn({}, 'showRoundOff'), false, 'Round-off is off unless chosen');
  eq(invoiceOptionOn({ pdfStyle: 'tally' }, 'showHsnSummary'), true, 'Tally style shows the HSN summary by default');
  eq(invoiceOptionOn({ pdfStyle: 'classic' }, 'showHsnSummary'), false, 'Other designs do not, unless chosen');
  eq(invoiceOptionOn({ pdfStyle: 'tally', showHsnSummary: false }, 'showHsnSummary'), false, 'A saved choice always wins');
  // The first click must flip what the box shows (it took two clicks for never-saved options).
  const flipped = { showBusinessName: !invoiceOptionOn({}, 'showBusinessName') };
  eq(invoiceOptionOn(flipped, 'showBusinessName'), false, 'One click turns a default-on option off');

  eq(formatShortDate('2026-08-31'), '31-Aug-26', 'Dates print the Tally way');
  const od = filledOrderDetails({ buyerOrderNo: ' PO/118 ', vehicleNo: '', buyerOrderDate: '2026-08-02' });
  eq(od.map((f) => [f.key, f.value]), [['buyerOrderNo', 'PO/118'], ['buyerOrderDate', '02-Aug-26']], 'Only filled order details print, dates formatted');

  eq(INVOICE_TYPES.quotation.prefix, 'QUO', 'Quotations number as QUO');
  eq(salesSign({ invoiceType: 'quotation', totalAmount: 100 }), 0, 'A quotation is not a sale');

  eq(docsLink('invoices#toolbar'), 'https://dicecodes.com/free-gst-software-documentation/invoices.html#toolbar', 'Help links go to the docs section');
  eq(docsLink('index'), 'https://dicecodes.com/free-gst-software-documentation/', 'The docs home link');
  eq(TCS_SECTIONS.some((t) => t.code === '206C(1H)'), false, '206C(1H) (omitted from 1 April 2025) is not offered on new invoices');
}

console.log('\n[V75] Party outstanding by month');
{
  const fy = periodMonths('fy', 2026);
  eq([fy[0].key, fy[11].key, fy.length], ['2026-04', '2027-03', 12], 'Financial year runs April to March');
  const cal = periodMonths('calendar', 2026);
  eq([cal[0].key, cal[11].key], ['2026-01', '2026-12'], 'Calendar year runs January to December');
  const bills = [
    { clientName: 'Asha Traders', invoiceDate: '2026-04-10', totalAmount: 1000, paidAmount: 400 },
    { clientName: 'asha traders ', invoiceDate: '2026-04-20', totalAmount: 500 },
    { clientName: 'Asha Traders', invoiceDate: '2026-06-01', totalAmount: 300 },
    { clientName: 'Asha Traders', invoiceDate: '2026-02-01', totalAmount: 200 },
    { clientName: 'Bala & Sons', invoiceDate: '2026-05-05', totalAmount: 800, status: 'paid', paidAmount: 800 },
    { clientName: 'Bala & Sons', invoiceDate: '2026-05-06', totalAmount: 900, invoiceType: 'proforma' },
    { clientName: 'Bala & Sons', invoiceDate: '2026-05-07', totalAmount: 700, status: 'cancelled' },
    { clientName: 'Bala & Sons', invoiceDate: '2026-05-08', totalAmount: 50, currency: 'USD' },
    { clientName: 'Chetan', invoiceDate: '2027-04-02', totalAmount: 999 },
  ];
  const rows = partyOutstanding(bills, fy, 'INR');
  eq(rows.map((r) => r.name), ['Asha Traders'], 'Only parties with unpaid real sales in this currency, up to the period end');
  eq(rows[0].months, { '2026-04': 1100, '2026-06': 300 }, 'Unpaid balance lands in the invoice month; same party despite case and spaces');
  eq([rows[0].earlier, rows[0].total], [200, 1600], 'Still-unpaid bills from before the period show as Earlier and count in the total');
  eq(partyOutstanding(bills, fy, 'USD')[0].total, 50, 'Each currency is its own report');
}

console.log('\n[V76] #83 printed Subtotal with prices including tax');
{
  const inc = computeInvoiceTotals({
    items: [{ quantity: 1, rate: 300, discount: 0, taxPercent: 0 }, { quantity: 2, rate: 1050, discount: 0, taxPercent: 18 }],
    profile: { country: 'India', state: 'Punjab' }, client: { state: 'Punjab' }, details: { placeOfSupply: 'Punjab' },
    showGST: true, taxInclusive: true,
  });
  approx(inc.total, 2400, 'Total stays 2,400 (tax is inside the prices)');
  approx(printedSubtotal(inc), 2079.66, 'Printed Subtotal is the taxable value, not the tax-inclusive 2,400');
  approx(printedSubtotal(inc) - inc.totalDiscount + inc.cgst + inc.sgst, inc.total, 'Subtotal + CGST + SGST adds up to the Total on paper');
  const exc = computeInvoiceTotals({
    items: [{ quantity: 2, rate: 1000, discount: 0, taxPercent: 18 }],
    profile: { country: 'India', state: 'Punjab' }, client: { state: 'Punjab' }, details: { placeOfSupply: 'Punjab' }, showGST: true,
  });
  approx(printedSubtotal(exc), 2000, 'Without tax-inclusive prices the Subtotal is unchanged');
}

console.log('\n[V76] #81 GSTR-3B ITC set-off across heads');
{
  const a = setOffITC({ igst: 810, cgst: 0, sgst: 0 }, { igst: 0, cgst: 360, sgst: 360 });
  eq(a.payable, { igst: 90, cgst: 0, sgst: 0 }, 'CGST + SGST credit pays an IGST liability (the #81 example: 810 -> 90)');
  eq(a.carry, { igst: 0, cgst: 0, sgst: 0 }, 'No credit left over in that example');
  const b = setOffITC({ igst: 0, cgst: 0, sgst: 500 }, { igst: 0, cgst: 500, sgst: 0 });
  eq([b.payable.sgst, b.carry.cgst], [500, 500], 'CGST credit never pays SGST');
  const c = setOffITC({ igst: 100, cgst: 300, sgst: 300 }, { igst: 400, cgst: 0, sgst: 0 });
  eq(c.payable, { igst: 0, cgst: 0, sgst: 300 }, 'IGST credit pays IGST first, then CGST, then SGST');
  const d = setOffITC({ igst: 0, cgst: 100, sgst: 100 }, { igst: 0, cgst: 150, sgst: 150 });
  eq([d.payable, d.carry], [{ igst: 0, cgst: 0, sgst: 0 }, { igst: 0, cgst: 50, sgst: 50 }], 'Intra-state only: same as before, extra credit carried forward');
  const e = setOffITC({ igst: 0, cgst: 100, sgst: 100 }, { igst: 100, cgst: 100, sgst: 0 });
  eq([e.payable, e.carry], [{ igst: 0, cgst: 0, sgst: 0 }, { igst: 0, cgst: 0, sgst: 0 }], 'IGST credit goes where it avoids cash: SGST here, as CGST has its own credit');
}

console.log('\n[V76] #82 purchase inter-state from the supplier GSTIN');
{
  eq(isInterstateSupply('27AABCU9603R1ZM', { gstin: '07AAAAA0000A1Z5' }), true, 'Maharashtra supplier, Delhi business: inter-state');
  eq(isInterstateSupply('07BBBBB1111B1Z2', { gstin: '07AAAAA0000A1Z5' }), false, 'Same state: not inter-state');
  eq(isInterstateSupply('27AABCU9603R1ZM', { state: 'Maharashtra' }), false, 'Business state used when it has no GSTIN');
  eq(isInterstateSupply('27AABCU96', { gstin: '07AAAAA0000A1Z5' }), null, 'A half-typed GSTIN changes nothing');
  eq(isInterstateSupply('27AABCU9603R1ZM', {}), null, 'Unknown business state changes nothing');
}

console.log('\n[V76] #80 stock follows the invoice');
{
  const items = (q) => [{ productId: 'pen', quantity: q }, { name: 'free text line', quantity: 3 }];
  eq(stockEffect(items(10), 'tax-invoice', 'unpaid'), { pen: -10 }, 'A sale takes stock out (lines without a product are ignored)');
  eq(stockEffect(items(10), 'quotation', 'unpaid'), {}, 'A quotation moves no stock');
  eq(stockEffect(items(10), 'proforma', 'unpaid'), {}, 'A proforma moves no stock');
  eq(stockEffect(items(4), 'credit-note', 'unpaid'), { pen: 4 }, 'A credit note puts returned goods back');
  eq(stockEffect(items(10), 'tax-invoice', 'cancelled'), {}, 'A cancelled invoice moves nothing');
  const saved = { status: 'unpaid', data: { items: items(10), invoiceType: 'tax-invoice', stockApplied: { pen: -10 } } };
  eq(stockDelta(appliedStock(saved), stockEffect(items(15), 'tax-invoice', 'unpaid')), { pen: -5 }, 'Editing 10 -> 15 takes exactly 5 more (the #80 example)');
  eq(stockDelta(appliedStock(saved), stockEffect(items(10), 'tax-invoice', 'unpaid')), {}, 'Saving again unchanged moves nothing');
  eq(stockDelta(appliedStock(saved), stockEffect(items(10), 'quotation', 'unpaid')), { pen: 10 }, 'Turning it into a quotation gives the stock back');
  const legacy = { status: 'unpaid', data: { items: items(10), invoiceType: 'quotation' } };
  eq(appliedStock(legacy), { pen: -10 }, 'A quotation saved before v1.10.76 is known to have taken stock out');
  eq(appliedStock({ ...legacy, autoGenerated: true }), {}, 'A recurring bill made by the server never touched stock');
  eq(appliedStock({ ...legacy, status: 'cancelled' }), {}, 'An old cancelled bill had its stock put back');
  const oldCancelledInv = { status: 'cancelled', data: { items: items(10), invoiceType: 'tax-invoice' } };
  eq(stockDelta(appliedStock(oldCancelledInv), stockEffect(items(10), 'tax-invoice', 'unpaid')), { pen: -10 }, 'Un-cancelling an old cancelled invoice takes its stock out again');
  const challan = { status: 'unpaid', data: { items: items(10), invoiceType: 'delivery-challan', stockApplied: { pen: -10 } } };
  eq(stockDelta(appliedStock(challan), stockEffect(items(10), 'tax-invoice', 'unpaid')), {}, 'A challan converted to an invoice: the invoice takes over its stock, nothing moves twice');
}

console.log('\n[V77] #89 CGST and SGST are equal halves in the GST returns');
{
  // 25 lines at 5% whose tax lands on an odd paisa (the reporter's HSN summary drifted by ₹0.25).
  const lines = Array.from({ length: 25 }, (_, i) => ({ quantity: 1, rate: 20.3 + i * 0.2, taxPercent: 5, discount: 0 }));
  const sum = lines.map((l) => splitLineTax(l, false)).reduce((a, x) => ({ c: a.c + x.cgst, s: a.s + x.sgst }), { c: 0, s: 0 });
  eq(Math.round(sum.c * 100), Math.round(sum.s * 100), 'Over 25 odd-paisa lines CGST and SGST stay exactly equal');
  // And they add up to what one invoice with those 25 lines prints (no paisa drift per line).
  const many = computeInvoiceTotals({ items: lines, profile: { country: 'India', state: 'Punjab' }, client: { state: 'Punjab' }, details: { placeOfSupply: 'Punjab' }, showGST: true });
  eq([Math.round(sum.c * 100) / 100, Math.round(sum.s * 100) / 100], [many.cgst, many.sgst], '25 lines: GST return CGST and SGST equal the invoice CGST and SGST');
  const one = { quantity: 9, rate: 232.804, taxPercent: 5, discount: 0 };
  const inv = computeInvoiceTotals({ items: [one], profile: { country: 'India', state: 'Punjab' }, client: { state: 'Punjab' }, details: { placeOfSupply: 'Punjab' }, showGST: true });
  const ln = splitLineTax(one, false);
  eq([Math.round(ln.cgst * 100) / 100, Math.round(ln.sgst * 100) / 100], [inv.cgst, inv.sgst], 'A line splits the same way the invoice prints it');
  const ut = splitLineTax(one, false, false, true);
  eq([ut.sgst, ut.utgst === ln.cgst], [0, true], 'UT without a legislature: CGST + UTGST, no SGST');
  approx(splitLineTax(one, true).igst, 104.76, 'Inter-state: all IGST');
  // 300 lines (fixed pseudo-random): the half paisa always rounds up, and
  // round() and toFixed(2) agree, so screen, CSV and JSON show the same CGST.
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const big = Array.from({ length: 300 }, () => ({ quantity: 1 + Math.floor(rnd() * 9), rate: Math.round(rnd() * 50000) / 100, taxPercent: [5, 12, 18, 28][Math.floor(rnd() * 4)], discount: 0 }));
  const raw = big.reduce((a, l) => a + splitLineTax(l, false).cgst, 0);
  const paise = big.reduce((a, l) => a + Math.round(splitLineTax(l, true).igst * 100), 0);
  eq([Math.round(raw * 100) / 100, Number(raw.toFixed(2))], [Math.ceil(paise / 2) / 100, Math.ceil(paise / 2) / 100], '300 lines: CGST is half the tax with the half paisa rounded up, same by round() and toFixed(2)');
}

console.log('\n[V77] #86 choosing Unpaid takes back the "Paid" payment');
{
  const bill = { totalAmount: 2778, payments: [] };
  const paid = { ...bill, ...markPaidPatch(bill) };
  eq(paid.payments.length === 1 && paid.payments[0].auto === true, true, 'Choosing Paid records one payment, marked as automatic');
  eq(markUnpaidPatch(paid), { payments: [], paidAmount: 0, status: 'unpaid' }, 'Choosing Unpaid removes it: nothing paid, reminder shows again');
  const legacy = { totalAmount: 2778, payments: [{ amount: 2778, note: 'Marked paid (bulk)', mode: 'other' }] };
  eq(markUnpaidPatch(legacy).paidAmount, 0, 'Also for a "Marked paid" payment saved before v1.10.77');
  const withReceipt = { totalAmount: 1000, payments: [{ amount: 400, receiptNo: 'RCT/1', mode: 'upi' }, { amount: 600, note: 'Marked paid', auto: true }] };
  eq(markUnpaidPatch(withReceipt).paidAmount === 400 && markUnpaidPatch(withReceipt).status, 'partial', 'A payment with a receipt is kept, so it becomes Partial');
  const edited = { totalAmount: 500, payments: [{ amount: 500, note: 'Marked paid', mode: 'other', auto: false }] };
  eq(markUnpaidPatch(edited).paidAmount, 500, 'A Marked paid payment you edited is yours now: kept');
  const typed = { totalAmount: 500, payments: [{ amount: 500, note: 'Marked paid by cheque', mode: 'cheque' }] };
  eq(markUnpaidPatch(typed).paidAmount, 500, 'A payment you noted "Marked paid" yourself (not mode other) is kept');
}

console.log('\n[V77] #84 duplicate business profiles, terms line breaks');
{
  const saved = [{ id: 'a', businessName: 'Anant Exports', gstin: '09AABCU9355J1ZS' }, { id: 'b', businessName: 'DiceCodes', gstin: '' }];
  eq(findSameBusiness(saved, { businessName: 'ANANT EXPORTS PVT', gstin: '09aabcu9355j1zs' })?.id, 'a', 'Same GSTIN under another spelling is the same business');
  eq(findSameBusiness(saved, { businessName: '  dicecodes ', gstin: '' })?.id, 'b', 'No GSTIN: the same name (case and spaces ignored)');
  eq(findSameBusiness(saved, { businessName: 'Anant Exports', gstin: '27AAAAA0000A1Z5' }), null, 'Same name but a different GSTIN is a different business');
  eq(findSameBusiness(saved, { businessName: 'Anant Exports', gstin: '' }), null, 'No GSTIN never overwrites a saved profile that has one');
  eq(findSameBusiness(saved, { businessName: 'Anant Exports', gstin: '09AABCU9355J1ZT' }, saved[0])?.id, 'a', 'Loaded profile with a corrected GSTIN typo: that profile is updated');
  eq(splitNumberedTerms('* Warranty by the maker.\n* Subject to Delhi only.'), '* Warranty by the maker.<br />* Subject to Delhi only.', 'Plain-text terms keep their line breaks');
  eq(splitNumberedTerms('<p>a</p>\n<p>b</p>'), '<p>a</p>\n<p>b</p>', 'Formatted terms are left as they are');
}

console.log('\n[V77] #87 delivery charges, #85 Excel export');
{
  const line = deliveryChargeLine([{ taxPercent: 5 }, { taxPercent: 18 }, { taxPercent: 12, isCharge: true }], 150);
  eq([line.name, line.hsn, line.rate, line.taxPercent, line.isCharge, line.productId], ['Delivery charges', '996812', 150, 18, true, undefined], 'Delivery charges: SAC 996812, taxed at the highest goods rate, never stock');
  eq(deliveryChargeLine([]).taxPercent, 18, 'With no goods yet it starts at 18%');
  const t = computeInvoiceTotals({ items: [{ quantity: 2, rate: 500, taxPercent: 12 }, deliveryChargeLine([{ taxPercent: 12 }], 100)],
    profile: { country: 'India', state: 'Punjab' }, client: { state: 'Punjab' }, details: { placeOfSupply: 'Punjab' }, showGST: true });
  approx(t.total, 1232, 'It is in the invoice total with its GST (1,000 + 100 + 12%)');

  eq([colName(0), colName(25), colName(26), colName(701)], ['A', 'Z', 'AA', 'ZZ'], 'Excel column letters');
  const files = unzipSync(buildXlsx([['Party', 'Total'], ['A & B <Traders>', 1234.5], ['=SUM(1)', 0]], 'Party Outstanding'));
  const sheet = strFromU8(files['xl/worksheets/sheet1.xml']);
  eq(['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml'].every((f) => files[f]), true, 'The .xlsx has every part Excel needs');
  eq(sheet.includes('<c r="B2"><v>1234.5</v></c>'), true, 'Numbers are stored as numbers (Excel can total them)');
  eq(sheet.includes('A &amp; B &lt;Traders&gt;'), true, 'Text is escaped');
  eq(sheet.includes('<t xml:space="preserve">=SUM(1)</t>'), true, 'Text that looks like a formula stays text, never a formula');
  eq(sheet.includes('<c r="A1" t="inlineStr" s="1">'), true, 'Header row is bold');
}

console.log('\n[V77] #85 bulk product edit, closing stock');
{
  const pen = { id: 'p1', name: 'Pen', hsn: '9608', purchasePrice: 5, sellingPrice: 10, rate: 10, taxPercent: 18, unit: 'Nos', stock: 50 };
  const ok = bulkRowToProduct(pen, { sellingPrice: '12', stock: '40' });
  eq([ok.product.sellingPrice, ok.product.rate, ok.product.stock, ok.product.id, ok.product.hsn], [12, 12, 40, 'p1', '9608'], 'Bulk edit: typed numbers saved as numbers, selling price mirrored to rate, id kept');
  eq(!!bulkRowToProduct(pen, { name: '  ' }).error, true, 'Bulk edit: a blank name is refused');
  eq(!!bulkRowToProduct(pen, { taxPercent: '150' }).error, true, 'Bulk edit: GST % over 100 is refused');
  eq(!!bulkRowToProduct(pen, { stock: 'abc' }).error, true, 'Bulk edit: stock that is not a number is refused');
  eq(bulkRowToProduct({ id: 'x', name: 'Old', rate: 7 }, { hsn: '1' }).product.sellingPrice, 7, 'Bulk edit: an old product with only rate keeps its price');

  const products = [{ id: 'p1', name: 'Pen', stock: 50 }, { id: 'p2', name: 'Ink', stock: 3 }];
  const bills = [
    { invoiceDate: '2026-09-20', status: 'paid', data: { stockApplied: { p1: -10 } } },
    { invoiceDate: '2026-10-05', status: 'paid', data: { stockApplied: { p1: -5, p2: -1 } } },
    { invoiceDate: '2026-10-06', status: 'cancelled', data: { stockApplied: {} } },
  ];
  const purchases = [{ date: '2026-10-02', items: [{ name: ' pen ', quantity: 20 }] }, { date: '2026-09-01', items: [{ name: 'Ink', quantity: 4 }] }];
  const sep = closingStock(products, bills, purchases, '2026-09-30');
  eq([sep.get('p1'), sep.get('p2')], [35, 4], 'Closing stock 30 Sep: later purchases taken off, later sales added back (50 - 20 + 5; 3 + 1)');
  eq(closingStock(products, bills, purchases, '2026-10-31').get('p1'), 50, 'Closing stock today equals current stock');
  eq(stockValueOf({ purchasePrice: 5, sellingPrice: 10 }, 35), { price: 5, value: 175, atCost: true }, 'Stock is valued at purchase price');
  eq(stockValueOf({ sellingPrice: 10 }, 3), { price: 10, value: 30, atCost: false }, 'No purchase price: valued at selling price, marked');
}

console.log('\n[V78] #93 start numbering from (tax invoices)');
{
  const settings = { startNumber: 1001 };
  eq(nextCounterValue(undefined, startFor('tax-invoice', settings)), 1001, 'A new book with Start 1001: the first tax invoice is 1001');
  eq(nextCounterValue(1001, startFor('tax-invoice', settings)), 1002, 'Then 1002, 1003...');
  eq(nextCounterValue(5, startFor('tax-invoice', settings)), 1001, 'Already at 0005: raising the start jumps to 1001');
  eq(nextCounterValue(1200, startFor('tax-invoice', settings)), 1201, 'A start below the last number never reuses a number');
  eq(nextCounterValue(0, startFor(undefined, settings)), 1001, 'An invoice saved before types existed counts as a tax invoice');
  eq([nextCounterValue(0, startFor('quotation', settings)), nextCounterValue(3, startFor('credit-note', settings)), nextCounterValue(0, startFor('delivery-challan', settings))], [1, 4, 1], 'Quotations, credit notes and challans keep their own count from 1');
  eq(nextCounterValue(0), 1, 'No start (receipts): from 1');
  eq([nextCounterValue(0, '1001'), nextCounterValue(0, 1001.7), nextCounterValue(0, -5), nextCounterValue(7.9, 1), nextCounterValue(0, '')], [1001, 1001, 1, 8, 1], 'Text, decimals, negatives and blanks are made safe');
  eq(nextCounterValue(0, 1e15), 999999999, 'A start is capped at 999999999');
}

console.log('\n[V79] #96 quantities, #95 places of supply and per-business numbering');
{
  let sum = 0; for (let i = 0; i < 400; i++) sum += 15.8924; // floating point drifts
  eq([roundQty(sum), roundQty(6356.959999999999), roundQty(0.1 + 0.2), roundQty(6356.959999999999, 2)], [6356.96, 6356.96, 0.3, 6356.96], 'Added-up quantities are rounded (6356.9599999 -> 6356.96)');
  eq([placeOfSupplyLabel('10'), placeOfSupplyLabel('Bihar'), placeOfSupplyLabel('03AAAAA0000A1Z5'), placeOfSupplyLabel('')], ['10-Bihar', '10-Bihar', '03-Punjab', ''], 'Place of supply written the portal way: 10-Bihar');

  const brand = { brandPrefix: 'ACME', separator: '/', showFinYear: true, padDigits: 4 };
  const fmt = (settings, typePrefix, next, extra = {}) => formatDocNumber({ settings, typePrefix, next, fyLabel: '2026-27', ...extra });
  eq([fmt(brand, 'INV', 6), fmt(brand, 'QUO', 6), fmt(brand, 'DC', 1), fmt(brand, 'RCP', 2)],
    ['ACME/2026-27/0006', 'ACME-QUO/2026-27/0006', 'ACME-DC/2026-27/0001', 'ACME-RCP/2026-27/0002'],
    'Brand prefix: invoices ACME/..., other types ACME-QUO/... so a quotation never collides with an invoice');
  eq([fmt({}, 'INV', 7), fmt({ ...brand, showFinYear: false }, 'INV', 7), fmt(brand, 'RPT', 3, { explicitPrefix: true })],
    ['INV/2026-27/0007', 'ACME/0007', 'RPT/2026-27/0003'], 'No brand: type prefix; no FY; a Print Settings per-type prefix is used as is');

  const dicecodes = { businessName: 'DiceCodes', gstin: '29abcde1234f1zw' };
  const anant = { businessName: '  Anant  Exports ', gstin: '' };
  eq([businessKeyOf(dicecodes), businessKeyOf(anant), businessKeyOf(null)], ['29ABCDE1234F1ZW', 'NAME:anant exports', ''], 'A business is known by its GSTIN, else its name');
  const shared = { brandPrefix: '', startNumber: 1 };
  const map = { [businessKeyOf(anant)]: { brandPrefix: 'AE', startNumber: 502 } };
  const a = numberSeriesFor(shared, map, businessKeyOf(dicecodes));
  const b = numberSeriesFor(shared, map, businessKeyOf(anant));
  eq([a.own, b.own, b.brandPrefix, b.startNumber, b.separator], [false, true, 'AE', 502, '/'], 'A business without its own numbering uses the shared one; one with it uses its own');
  eq([counterKeyFor('INV', a, businessKeyOf(dicecodes)), counterKeyFor('INV', b, businessKeyOf(anant))], ['counter_INV', 'counter_INV@NAME:anant exports'], 'Each own series has its own counters');
  eq([fmt(a, 'INV', nextCounterValue(1225, startFor('tax-invoice', a))), fmt(b, 'INV', nextCounterValue(undefined, startFor('tax-invoice', b)))],
    ['INV/2026-27/1226', 'AE/2026-27/0502'], '#95: firm A continues at 1226, firm B starts its own series at 0502');

  const ctx = { shared: { brandPrefix: 'ACME' }, seriesMap: map, businessKey: businessKeyOf(dicecodes), customPrefixes: { 'tax-invoice': 'RPT' } };
  eq([!!ownPrefixProblem('', ctx), !!ownPrefixProblem('inv', ctx), !!ownPrefixProblem('ACME', ctx), !!ownPrefixProblem('AE', ctx), !!ownPrefixProblem('RPT', ctx), ownPrefixProblem('KS', ctx)],
    [true, true, true, true, true, ''], 'An own prefix must be set and unlike any other series (type prefixes, shared, other businesses, Print Settings)');
  eq(ownPrefixProblem('AE', { ...ctx, businessKey: businessKeyOf(anant) }), '', 'A business may keep its own prefix when it saves again');
}

console.log('\n[V79] GST 16-character numbers, short year, portal state names, saved PDF names');
{
  const fy = '2026-27';
  eq(numberFormatProblem({}, { fyLabel: fy }), '', 'Default INV/2026-27/0001 (16) and CN/2026-27/0001 fit the GST limit');
  eq(/Credit Note .* 18 characters/.test(numberFormatProblem({ brandPrefix: 'XY' }, { fyLabel: fy })), true, 'Brand XY: XY-CN/2026-27/0001 is 18 characters and is refused');
  eq(numberFormatProblem({ brandPrefix: 'XY', fyStyle: 'short' }, { fyLabel: fy }), '', 'With the short year it fits: XY-CN/26-27/0001 (16)');
  eq(formatDocNumber({ settings: { brandPrefix: 'KS', fyStyle: 'short' }, typePrefix: 'CN', next: 7, fyLabel: fy }), 'KS-CN/26-27/0007', 'Short year writes 26-27');
  eq(/ACME\/2026-27\/0001/.test(numberFormatProblem({ brandPrefix: 'ACME' }, { fyLabel: fy })), true, 'A 4-letter brand with the full year is already too long for a tax invoice');
  eq(/does not accept "#"/.test(numberFormatProblem({ separator: '#' }, { fyLabel: fy })), true, 'The # separator is refused (the portal rejects it)');
  eq(/12345/.test(numberFormatProblem({}, { fyLabel: fy, nextInvoice: 12345 })), true, 'Past 9999 the number grows to 17 characters and is flagged');
  eq(numberFormatProblem({ brandPrefix: 'KS' }, { fyLabel: fy, own: true, customPrefixes: { 'tax-invoice': 'VERYLONGPREFIX' } }).includes('VERYLONG'), false, 'An own series ignores Print Settings per-type prefixes');
  eq([placeOfSupplyLabel('01'), placeOfSupplyLabel('26'), placeOfSupplyLabel('97')], ['01-Jammu & Kashmir', '26-Dadra & Nagar Haveli & Daman & Diu', '97-Other Territory'], 'Places of supply spelt as on the GST portal');
  eq(savedPdfNameFor({ invoiceNumber: 'INV/2026-27/0007', invoiceType: 'tax-invoice', data: { client: { name: 'Meera' } } }), { fileName: 'INV_INV-2026-27-0007.pdf', clientName: 'Meera' }, 'Saved PDF found under the name the editor saves it with');
  eq(savedPdfNameFor({ invoiceNumber: 'CN/2026-27/0002', invoiceType: 'credit-note', data: {} }), { fileName: 'CN_CN-2026-27-0002.pdf', clientName: 'General' }, 'A credit note, no client: the General folder');
}

console.log('\n[Audit 2026-10] Math and wiring fixes');
{
  eq(numberToWords(1500000000), 'One Hundred and Fifty Crore Rupees Only', '₹150 crore in words (was "undefined Crore")');
  eq(numberToWords(12345678.9), 'One Crore Twenty Three Lakh Forty Five Thousand Six Hundred and Seventy Eight Rupees and Ninety Paise Only', 'Crore, lakh and paise still read as before');

  // A with-tax discount on a line whose price already includes tax comes off as entered.
  const inclItem = { quantity: 1, rate: 1180, discount: 118, discountType: 'fixed', discountBase: 'with-tax', taxPercent: 18, withTaxRule: 2 };
  // A line saved before v1.10.80 (no withTaxRule) keeps the old maths, so its
  // GSTR-1 figures and reprints match the total saved with it (₹1,080).
  const oldLine = { ...inclItem, withTaxRule: undefined };
  approx(resolveLineDiscount(oldLine, true), 100, 'A with-tax discount saved before v1.10.80 is read as before');
  approx(computeInvoiceTotals({ items: [oldLine], profile: { country: 'India', state: 'Punjab' }, client: { state: 'Punjab' }, details: {}, showGST: true, taxInclusive: true }).total, 1080, 'An old saved invoice still totals ₹1,080 (its saved total)');
  approx(resolveLineDiscount(inclItem, true), 118, 'With-tax discount on a tax-inclusive line: ₹118 off');
  approx(resolveLineDiscount({ ...inclItem, rate: 1000 }), 100, 'With-tax discount on a tax-exclusive line: tax backed out (₹118 -> ₹100)');
  const inclTotals = computeInvoiceTotals({ items: [inclItem], profile: { country: 'India', state: 'Punjab' }, client: { state: 'Punjab' }, details: {}, showGST: true, taxInclusive: true });
  approx(inclTotals.total, 1062, 'Inclusive ₹1,180 less ₹118 with-tax discount = ₹1,062');
  const bos = computeInvoiceTotals({ items: [{ ...inclItem, rate: 1000 }], profile: { country: 'India', state: 'Punjab' }, client: { state: 'Punjab' }, details: {}, showGST: false });
  approx(bos.total, 882, 'Bill of supply (no tax): a with-tax discount comes off as entered');

  // Filing calendar: local dates, March advance tax, this July's ITR, Q4 TDS/TCS returns.
  const due = (today, label) => getUpcomingFilings(today).find((f) => f.label.startsWith(label))?.dueDate;
  eq(due(new Date(2026, 9, 1), 'GSTR-3B'), '2026-10-20', 'GSTR-3B due on the 20th (not the 19th, as toISOString gave in India)');
  eq(due(new Date(2027, 2, 2), 'Advance Tax Installment 4'), '2027-03-15', 'The 15 March advance-tax instalment shows in early March');
  eq(due(new Date(2026, 5, 10), 'ITR filing (non-audit)'), '2026-07-31', 'In June the ITR due this 31 July shows (not next year)');
  eq(due(new Date(2026, 3, 5), 'Form 26Q'), '2026-05-31', 'Form 26Q for January-March is due 31 May');
  eq(due(new Date(2026, 3, 5), 'Form 27EQ'), '2026-05-15', 'Form 27EQ for January-March is due 15 May');

  eq(parseLocalDate('2026-04-01').getMonth(), 3, 'A YYYY-MM-DD date is read as a local date');
  eq(formatDateGST('2026-04-01'), '01-04-2026', 'GST date format from a local date');

  // TDS: the client pays Net Receivable, so that settles the bill.
  const tdsBill = { totalAmount: 118000, data: { totals: { tdsAmount: 10000 } }, payments: [] };
  eq(amountDue(tdsBill), 108000, 'Amount due = total less TDS');
  eq([paymentStatusFor(tdsBill, 108000), paymentStatusFor(tdsBill, 50000), paymentStatusFor(tdsBill, 0)], ['paid', 'partial', 'unpaid'], 'Paid once Net Receivable is received');
  const marked = markPaidPatch({ ...tdsBill, payments: [{ amount: 8000 }] });
  eq([marked.payments[1].amount, marked.paidAmount], [100000, 108000], 'Mark Paid records the balance of Net Receivable, and paidAmount is what was received');

  // Recurring templates: GST follows the type when the template does not say.
  const tpl = { invoiceType: 'bill-of-supply', clientName: 'A', clientState: 'Punjab', items: [{ quantity: 2, rate: 500, taxPercent: 18 }] };
  const prof = { country: 'India', state: 'Punjab' };
  eq(templateTotals(tpl, prof).total, 1000, 'A bill-of-supply template charges no GST');
  eq(templateTotals({ ...tpl, invoiceType: 'tax-invoice' }, prof).total, 1180, 'A tax-invoice template charges GST');
  eq(templateTotals({ ...tpl, invoiceType: 'tax-invoice', placeOfSupply: 'Haryana' }, prof).igst, 180, "A template's place of supply decides IGST");

  // E-Way Bill item rates follow the invoice's own split.
  const ewbTotals = computeInvoiceTotals({ items: [{ quantity: 1, rate: 100, taxPercent: 18 }], profile: { country: 'India', state: 'Punjab' }, client: { state: 'Punjab' }, details: { placeOfSupply: 'Haryana' }, showGST: true });
  const ewb = generateEWayBillJSON({ country: 'India', state: 'Punjab', pin: '141001' }, { state: 'Punjab', pin: '141002' }, { invoiceNumber: 'X', invoiceDate: '2026-10-01' }, [{ quantity: 1, rate: 100, taxPercent: 18 }], ewbTotals, 'tax-invoice');
  eq([ewb.billLists[0].itemList[0].igstRate, ewb.billLists[0].itemList[0].cgstRate, ewb.billLists[0].igstValue], [18, 0, 18], 'E-Way Bill item rates match the IGST the invoice charged');
}

console.log('\n[Audit 2026-10] Income tax marginal relief');
{
  const t = (inc, regime) => computeTax({ businessIncome: inc, regime, fy: '2025-26' });
  approx(t(1_210_000, 'new').totalTax, 10400, '₹12.1L new regime: tax capped at the ₹10,000 above ₹12L, + 4% cess (was ₹63,960)');
  approx(t(1_250_000, 'new').totalTax, 52000, '₹12.5L new regime: ₹50,000 + cess');
  approx(t(1_300_000, 'new').totalTax, 78000, '₹13L: past the relief band, normal slab tax');
  approx(t(530_000, 'old').rebate87A, 0, 'Old regime has no 87A marginal relief');
  const base = t(5_000_000, 'old');
  const over = t(5_010_000, 'old');
  approx((over.taxAfterRebate + over.surcharge) - (base.taxAfterRebate + base.surcharge), 10000, '₹10,000 over ₹50L: extra tax + surcharge = ₹10,000 (surcharge marginal relief)');
  // §234B: tax paid after 31 March is not advance tax.
  const sched = computeAdvanceTaxSchedule(100000, 0, [{ date: '2026-06-10', amount: 100000 }], 'regular', '2025-26');
  approx(compute234BInterest(sched, '2026-06-10'), 3000, '234B: ₹1L all paid in June -> 1% x 3 months (paying late no longer wipes it out)');
}

console.log('\n[V80] Support page: UPI payment note and the supporters tracker');
{
  eq(upiNote('DiceCodes'), 'Free GST Billing support - DiceCodes', 'The payment note names the business that paid');
  eq(upiNote(''), 'Free GST Billing support', 'No business name: the plain note');
  eq(upiNote('M/S Sharma & Sons #12'), 'Free GST Billing support - M S Sharma Sons 12', 'Characters some UPI apps refuse are dropped');
  eq(upiNote('A Very Long Business Name Private Limited Company of India').length <= 50, true, 'The note is kept to 50 characters');

  const t = parseSupporters({ totalReceived: 12450.4, supporters: 37, goal: { amount: 50000, label: 'Balance sheet' }, thanks: ['Asha', '  Ravi  ', 42, ''], updated: '2026-10-19' });
  eq([t.totalReceived, t.supporters, t.goal, t.thanks, t.updated], [12450, 37, { amount: 50000, label: 'Balance sheet' }, ['Asha', 'Ravi'], '2026-10-19'], 'The tracker file is read: total, supporters, goal, names');
  eq([parseSupporters(null), parseSupporters([]), parseSupporters({ totalReceived: -5 }), parseSupporters({ totalReceived: 'lots' })], [null, null, null, null], 'A missing or broken file shows nothing');
  const odd = parseSupporters({ totalReceived: 10, supporters: 'many', goal: { amount: 0 }, thanks: 'Asha', updated: 'yesterday' });
  eq([odd.supporters, odd.goal, odd.thanks, odd.updated], [null, null, [], ''], 'Odd values are left out, never shown as they are');
  eq(parseSupporters({ totalReceived: 1, thanks: ['<img src=x onerror=alert(1)>'.repeat(5)] }).thanks[0].length, 60, 'Names are cut to 60 characters (and shown as text, never HTML)');

  // Daily support card on the Dashboard.
  const day = new Date(2026, 9, 24, 10, 0);
  const show = (n, st, at = day) => shouldShowSupportNudge(n, st, at);
  eq([show(9, {}), show(10, {})], [false, true], 'The daily card waits for 10 invoices');
  eq(show(50, { hiddenOn: '2026-10-24' }), false, '"Not today" hides it for the rest of the day');
  eq(show(50, { hiddenOn: '2026-10-24' }, new Date(2026, 9, 25, 0, 5)), true, 'It is back the next morning (local date, not UTC)');
  eq([show(50, { snoozedUntil: day.getTime() + 1 }), show(50, { snoozedUntil: day.getTime() - 1 })], [false, true], '"Hide for 30 days" holds until the date passes');
  eq(show(500, { never: true }), false, 'The old "Don\'t show again" is still honoured');
  eq(show(50, { snoozedAt: day.getTime() }), true, 'The old 120-day snooze no longer hides it');
}

console.log('\n[V83] Supporters with their amounts');
{
  const t = parseSupporters({ totalReceived: 804, supporters: 2, thanks: ['A', 'B'], people: [
    { name: 'Kuldeep Suthar', amount: 101, date: '2026-10-29' }, { name: '  Niraj  Kumar ', amount: 501.4 },
    { name: '', amount: 5 }, { name: 'Bad', amount: -1 }, { name: 'Text', amount: 'lots' }, 'junk', null,
  ] });
  eq(t.people, [{ name: 'Kuldeep Suthar', amount: 101, date: '2026-10-29' }, { name: 'Niraj Kumar', amount: 501, date: '' }],
    'Each supporter with amount and date; blank, negative and broken entries are left out');
  eq(parseSupporters({ totalReceived: 10, thanks: ['A'] }).people, [], 'An older file (names only) still works: no amounts');
}

console.log('\n[V83] #117 Purchases: CGST + SGST, or IGST');
{
  const s = (tax, inter) => { const x = splitPurchaseTax(tax, inter); return [x.cgst, x.sgst, x.igst]; };
  eq(s(180, false), [90, 90, 0], 'Intra-state 18% on ₹1,000: CGST ₹90 + SGST ₹90');
  eq(s(180, true), [0, 0, 180], 'Inter-state: all IGST');
  eq(s(10.01, false), [5.01, 5, 0], 'An odd paisa: CGST + SGST still add up to the tax exactly');
  eq(s(0.03, false).reduce((a, b) => a + b, 0), 0.03, 'Tiny amounts add up too');
  eq(s(undefined, false), [0, 0, 0], 'No tax: zeros, never NaN');
}

console.log('\n[V81] What\'s new: the changelog on the Support page');
{
  const md = `# Changelog\n\n---\n\n## [1.10.82] - unreleased\n\n**Not out yet.**\n\n## [1.10.81] - 2026-10-31\n\n**Checks your PC first.**\n\n### How to update\n\n1. Click Update.\n#### On 1.10.72 or older\nUse the launcher.\n\n### Fixed\n- **Old Node.js** (#109): fixed.\n  - Node.js 18 or newer,\n    with npm 7.\n  - Windows 10 or 11.\n- CSV dates\n  read day first.\n\n---\n\n## [1.10.80] - 2026-10-24\n\n**CSV import.**\n\n### Added\nSee the list.\n- Lock button.\n`;
  const e = parseChangelog(md);
  eq(e.map((x) => `${x.version} ${x.date}`), ['1.10.81 2026-10-31', '1.10.80 2026-10-24'], 'Released versions only, newest first (an unreleased entry is left out)');
  eq([e[0].summary, e[0].sections.map((s) => s.title)], ['Checks your PC first.', ['Fixed']], 'The summary, and no "How to update" section');
  eq(e[0].sections[0].blocks, [
    { kind: 'item', text: '**Old Node.js** (#109): fixed.', children: ['Node.js 18 or newer, with npm 7.', 'Windows 10 or 11.'] },
    { kind: 'item', text: 'CSV dates read day first.', children: [] },
  ], 'Items, nested items and wrapped lines');
  eq(e[1].sections[0].blocks.map((b) => b.kind), ['para', 'item'], 'A plain line is a paragraph');
  eq(inlineParts('**B** *i* `c` [x](https://a.b) [y](docs/z.md) [j](javascript:alert(1))').map((p) => p.t),
    ['b', 'text', 'i', 'text', 'code', 'text', 'link', 'text'], 'Bold, italic, code and http links; other links stay text');
  eq(inlineParts('[j](javascript:alert(1))').some((p) => p.t === 'link'), false, 'A javascript: link is never a link');
}

console.log('\n[ERR-006] A client on custom paper keeps its width');
{
  const saved = clientPaperPrefs({ paperSize: 'custom', customPaperWidth: 210, customPaperHeight: 297 });
  eq(saved, { preferredPaperSize: 'custom', preferredCustomPaperWidth: 210, preferredCustomPaperHeight: 297 }, 'the width and height are saved with the size');
  const back = clientPaperOptions(saved, { paperSize: '80mm' });
  eq([back.paperSize, back.customPaperWidth, getPaperSize(back.paperSize, back).kind], ['custom', 210, 'sheet'], 'picking the client restores 210mm, a sheet, not an 80mm receipt');
  eq(clientPaperOptions({}, { paperSize: '80mm' }).paperSize, '80mm', 'a client with no preference keeps the invoice\'s paper (not A4)');
  eq(clientPaperOptions(undefined, {}).paperSize, 'a4', 'nothing set anywhere: A4');
}

console.log('\n[v1.10.84] Tax year 2026-27 (Income-tax Act 2025; rates as FY 2025-26, Finance Act 2026)');
{
  eq(TAX_YEARS, ['2026-27', '2025-26'], 'the year picker offers tax year 2026-27 (first) and FY 2025-26');
  eq(CURRENT_FY, '2026-27', 'the default year is 2026-27');
  for (const fy of TAX_YEARS) {
    eq(getNewRegimeSlabs(fy), NEW_REGIME_SLABS_FY_2025_26, `${fy}: new-regime slabs are the FY 2025-26 ones (4L/8L/12L...)`);
    eq(get87AConfig('new', fy), { threshold: 1_200_000, cap: 60_000 }, `${fy}: new-regime rebate up to ₹60,000 on income to ₹12L`);
    // ₹12.75L salary - ₹75,000 standard deduction = ₹12L: no tax at all.
    eq(computeTax({ salary: 1_275_000, regime: 'new', fy }).totalTax, 0, `${fy}: ₹12.75L salary pays no tax in the new regime`);
  }
  eq(getNewRegimeSlabs('2024-25') === NEW_REGIME_SLABS_FY_2025_26, false, 'FY 2024-25 keeps its own (older) slabs');
  eq(yearLabel('2026-27'), 'Tax year 2026-27', 'the new Act names the year "Tax year"');
  eq(yearLabel('2025-26'), 'FY 2025-26 (AY 2026-27)', 'earlier years keep FY and AY');
  // Finance Act 2026: non-audit business returns are due 31 August, from AY 2026-27.
  eq(filingDueDates('2025-26'), { salary: '2026-07-31', business: '2026-08-31', audit: '2026-10-31' }, 'FY 2025-26 due dates');
  eq(filingDueDates('2026-27'), { salary: '2027-07-31', business: '2027-08-31', audit: '2027-10-31' }, 'tax year 2026-27 due dates');
}

console.log('\n────────────────────────────────────────');
console.log(`Passed: ${passed}   Failed: ${failed}`);
if (failed) process.exit(1);
