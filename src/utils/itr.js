// ============================================================================
// Indian Income Tax helpers — FY 2024-25 and FY 2025-26 (current filing season)
// ----------------------------------------------------------------------------
// Everything here is pure math. UI components in components/IncomeTax*.jsx
// consume these helpers. Kept in a separate file so the tax logic can be
// unit-tested and audited by a CA without loading React.
//
// v1.10.31 — Comprehensive tax law update from audit findings:
//   - Budget 2025 new-regime slabs + ₹60k / ₹12L 87A rebate for FY 25-26
//   - Finance (No. 2) Act 2024 STCG 20%, LTCG 12.5% + ₹1.25L exemption
//     (effective 23-Jul-2024)
//   - Senior (60+) and super-senior (80+) old-regime basic exemption slabs
//   - Rule 119A ₹100 rounding for 234B / 234C
//   - Marginal relief on surcharge threshold crossings
//   - 80CCD(2) capped at 10 / 14% of salary
//   - effectiveDeductionCap wired into computeAllowedDeductions
//   - 87A eligibility uses total-income base (includes capital gains)
//   - Special-rate tax (LTCG/STCG) surcharge capped at 15% end-to-end
// ============================================================================

/**
 * v1.10.31 — Current filing season. Change ONE constant here; every
 * FY-relative slab / rate / due-date resolves via this. Setting a different
 * FY as CURRENT_FY makes the app default to that year end-to-end. Callers
 * that need a specific FY pass it explicitly.
 */
export const CURRENT_FY = '2025-26';

// ----------------------------- Regimes ---------------------------------------

/**
 * OLD REGIME slabs — individuals below 60 years.
 *
 * Rebate under Section 87A: full rebate if total income ≤ ₹5L (up to ₹12.5k tax).
 * Standard Deduction: ₹50,000 (for salaried / pensioners only).
 * Health & Education Cess: 4% on tax + surcharge (if any).
 *
 * Surcharge on tax:
 *   > ₹50L up to ₹1Cr  → 10%
 *   > ₹1Cr up to ₹2Cr  → 15%
 *   > ₹2Cr up to ₹5Cr  → 25%
 *   > ₹5Cr             → 37% (or 25% if opted for 115BAC — new regime)
 *
 * v1.10.31 — Old-regime slabs unchanged in Budget 2025.
 */
export const OLD_REGIME_SLABS = [
  { upto: 250_000, rate: 0 },
  { upto: 500_000, rate: 0.05 },
  { upto: 1_000_000, rate: 0.20 },
  { upto: Infinity, rate: 0.30 },
];

// Senior citizen (60+ but < 80) old-regime slabs — ₹3L basic exemption.
export const OLD_REGIME_SLABS_SENIOR = [
  { upto: 300_000, rate: 0 },
  { upto: 500_000, rate: 0.05 },
  { upto: 1_000_000, rate: 0.20 },
  { upto: Infinity, rate: 0.30 },
];

// Super senior (80+) old-regime slabs — ₹5L basic exemption.
export const OLD_REGIME_SLABS_SUPER_SENIOR = [
  { upto: 500_000, rate: 0 },
  { upto: 1_000_000, rate: 0.20 },
  { upto: Infinity, rate: 0.30 },
];

/**
 * v1.10.31 — Pick the right old-regime slab table by taxpayer age.
 *   age >= 80  → super senior (₹5L basic exemption)
 *   60 ≤ age < 80 → senior (₹3L basic exemption)
 *   else → regular (₹2.5L basic exemption)
 */
export function getOldRegimeSlabs(age) {
  const a = Number(age) || 0;
  if (a >= 80) return OLD_REGIME_SLABS_SUPER_SENIOR;
  if (a >= 60) return OLD_REGIME_SLABS_SENIOR;
  return OLD_REGIME_SLABS;
}

/**
 * NEW REGIME (Section 115BAC) — Budget 2024 slabs for FY 2024-25:
 *   0     - 3L  : 0%
 *   3L    - 7L  : 5%
 *   7L    - 10L : 10%
 *   10L   - 12L : 15%
 *   12L   - 15L : 20%
 *   15L+        : 30%
 *
 * Rebate under Section 87A (new regime): up to ₹25,000 for total income ≤ ₹7L
 * (effectively zero tax up to ₹7L).
 * Standard Deduction: ₹75,000 (raised from ₹50k in Budget 2024).
 */
export const NEW_REGIME_SLABS_FY_2024_25 = [
  { upto: 300_000, rate: 0 },
  { upto: 700_000, rate: 0.05 },
  { upto: 1_000_000, rate: 0.10 },
  { upto: 1_200_000, rate: 0.15 },
  { upto: 1_500_000, rate: 0.20 },
  { upto: Infinity, rate: 0.30 },
];

/**
 * NEW REGIME — Budget 2025 slabs for FY 2025-26 (major restructure):
 *   0     - 4L   : 0%
 *   4L    - 8L   : 5%
 *   8L    - 12L  : 10%
 *   12L   - 16L  : 15%
 *   16L   - 20L  : 20%
 *   20L   - 24L  : 25%
 *   24L+         : 30%
 *
 * Rebate under Section 87A (new regime FY 25-26): up to ₹60,000 for total
 * income ≤ ₹12L (effectively zero tax on income up to ₹12L for a taxpayer
 * with no capital gains).
 *
 * New regime remains the DEFAULT since FY 2023-24.
 */
export const NEW_REGIME_SLABS_FY_2025_26 = [
  { upto: 400_000, rate: 0 },
  { upto: 800_000, rate: 0.05 },
  { upto: 1_200_000, rate: 0.10 },
  { upto: 1_600_000, rate: 0.15 },
  { upto: 2_000_000, rate: 0.20 },
  { upto: 2_400_000, rate: 0.25 },
  { upto: Infinity, rate: 0.30 },
];

/**
 * v1.10.31 — Backward-compat alias for pre-v1.10.31 callers that read
 * NEW_REGIME_SLABS directly. Resolves to the CURRENT_FY's table.
 */
export const NEW_REGIME_SLABS = CURRENT_FY === '2025-26'
  ? NEW_REGIME_SLABS_FY_2025_26
  : NEW_REGIME_SLABS_FY_2024_25;

/**
 * v1.10.31 — Pick the new-regime slab table for a given FY. Extending
 * to a new FY = add a new SLABS constant + a case here.
 */
export function getNewRegimeSlabs(fy = CURRENT_FY) {
  if (fy === '2025-26') return NEW_REGIME_SLABS_FY_2025_26;
  return NEW_REGIME_SLABS_FY_2024_25; // FY 24-25 and earlier
}

/**
 * v1.10.31 — 87A rebate parameters per FY. Old regime unchanged.
 * New regime FY 25-26 raised threshold from ₹7L → ₹12L and cap from
 * ₹25,000 → ₹60,000 (Budget 2025).
 */
export function get87AConfig(regime, fy = CURRENT_FY) {
  if (regime === 'old') {
    return { threshold: 500_000, cap: 12_500 };
  }
  // new regime
  if (fy === '2025-26') return { threshold: 1_200_000, cap: 60_000 };
  return { threshold: 700_000, cap: 25_000 }; // FY 24-25
}

/**
 * v1.10.31 — Capital gains rates changed on 23-Jul-2024 (Finance No.2 Act 2024).
 * §111A STCG on listed equity: 15% → 20%
 * §112A LTCG on listed equity: 10% → 12.5%, exemption ₹1L → ₹1.25L
 *
 * For FY 2024-25, gains realised on/after 23-Jul-2024 use new rates. UI
 * asks the user to enter the split; if the user just says "₹X LTCG for
 * FY 24-25" without splitting, we default to the safer (higher) new rates.
 *
 * FY 2025-26 and later: always new rates.
 */
export function getCapitalGainsConfig(fy = CURRENT_FY) {
  if (fy === '2024-25') {
    // Transitional year — new rates apply to gains on/after 23-Jul-2024.
    // Since the app can't reliably split, default to the newer regime
    // (protects users from under-payment; caller can request 'preTransition'
    // for the exact pre-23-Jul-2024 rates).
    return {
      stcgRate: 0.20,
      ltcgRate: 0.125,
      ltcgExemption: 125_000,
      preTransition: { stcgRate: 0.15, ltcgRate: 0.10, ltcgExemption: 100_000 },
    };
  }
  // FY 2025-26 and later — post-transition rates.
  return {
    stcgRate: 0.20,
    ltcgRate: 0.125,
    ltcgExemption: 125_000,
    preTransition: { stcgRate: 0.15, ltcgRate: 0.10, ltcgExemption: 100_000 },
  };
}

/**
 * Deduction caps under OLD regime (per Section reference).
 * New regime disallows most of these — only NPS employer contribution (80CCD(2))
 * is available.
 */
export const DEDUCTION_CAPS = {
  '80C':     150_000,   // PPF, ELSS, LIC, EPF, tuition, home-loan principal, ULIP, NSC
  '80CCD1B': 50_000,    // Additional NPS (employee contribution beyond ₹1.5L 80C)
  '80D':     100_000,   // MAXIMUM only when BOTH self+family AND parents are seniors
  '80TTA':   10_000,    // Savings-account interest (individuals below 60)
  '80TTB':   50_000,    // Bank/PO deposit interest (senior citizens 60+)
  '80E':     Infinity,  // Education loan interest — no cap, 8-year max claim
  '80G':     Infinity,  // Donations — 50% or 100% of qualifying, subject to limits
  '80GG':    60_000,    // Rent paid when HRA not received (min 25% of AGI - rent-10%AGI - ₹5000/month)
  '80DDB':   100_000,   // Specified serious illness (₹1L for seniors, ₹40k otherwise)
  '80U':     125_000,   // Self-disability (₹75k / ₹1.25L for severe)
  '24b':     200_000,   // Home-loan interest on self-occupied property
};

/**
 * v1.10.1 — 80D and 80DDB caps are context-sensitive on senior status.
 * The static DEDUCTION_CAPS entry is only the maximum. This helper
 * returns the actual cap given the taxpayer's family setup, so the UI
 * doesn't silently allow ₹1L of 80D for a 30-year-old with 40-year-old
 * parents (statutory max is ₹50k for that case).
 *
 * @param {string} section — '80D', '80DDB', etc.
 * @param {{selfSenior?: boolean, parentsSenior?: boolean}} ctx
 */
export function effectiveDeductionCap(section, ctx = {}) {
  const s = String(section || '').toUpperCase();
  if (s === '80D') {
    const selfCap = ctx.selfSenior ? 50_000 : 25_000;      // 25k (<60) / 50k (60+)
    const parentsCap = ctx.parentsSenior ? 50_000 : 25_000; // 25k / 50k
    return selfCap + parentsCap;
  }
  if (s === '80DDB') {
    return ctx.selfSenior ? 100_000 : 40_000;
  }
  return DEDUCTION_CAPS[section] ?? Infinity;
}

// -------------------------- Tax calculation ---------------------------------

/**
 * Apply a slab table to a taxable-income figure.
 * @param {number} taxableIncome
 * @param {Array<{upto:number, rate:number}>} slabs
 * @returns {number} tax before rebate / cess / surcharge
 */
export function computeSlabTax(taxableIncome, slabs) {
  if (!Number.isFinite(taxableIncome) || taxableIncome <= 0) return 0;
  let remaining = taxableIncome;
  let lower = 0;
  let tax = 0;
  for (const slab of slabs) {
    const width = slab.upto - lower;
    const slice = Math.min(remaining, width);
    if (slice <= 0) break;
    tax += slice * slab.rate;
    remaining -= slice;
    lower = slab.upto;
    if (remaining <= 0) break;
  }
  return round2(tax);
}

/**
 * Surcharge on tax based on total income (both regimes use similar tiers).
 * New regime caps surcharge at 25% (instead of 37% for the top old-regime bracket).
 *
 * v1.10.1 — Finance Act 2022 caps surcharge on tax attributable to
 * sections 111A (STCG on equity), 112A (LTCG on equity) and 115AD
 * (FII gains) at 15%. Callers who have the special-rate portion of tax
 * can pass `opts.specialRateTax` and get the correct blended result.
 *
 * @param {number} tax — total tax before surcharge
 * @param {number} totalIncome
 * @param {'new'|'old'} regime
 * @param {{specialRateTax?: number}} opts — tax attributable to 111A/112A/115AD
 */
export function computeSurcharge(tax, totalIncome, regime = 'new', opts = {}) {
  if (!Number.isFinite(totalIncome)) return 0;
  if (totalIncome <= 5_000_000) return 0;

  const tier = (income) => {
    if (income <= 10_000_000) return 0.10;
    if (income <= 20_000_000) return 0.15;
    if (income <= 50_000_000) return 0.25;
    return regime === 'new' ? 0.25 : 0.37;
  };
  const tierRate = tier(totalIncome);
  const specialTax = Math.max(0, Number(opts.specialRateTax) || 0);
  const cappedSpecialRate = Math.min(tierRate, 0.15);
  const regularTax = Math.max(0, tax - specialTax);
  const rawSurcharge = regularTax * tierRate + specialTax * cappedSpecialRate;

  // v1.10.31 — Marginal relief. Statute mandates the extra tax + surcharge
  // from crossing a threshold cannot exceed the extra income beyond it.
  // For an income of ₹50,00,010 with tax ~₹13L, 10% surcharge = ₹1.3L —
  // but only ₹10 of extra income triggered it. Relief caps surcharge so
  // (tax + surcharge)_now ≤ tax_at_threshold + (income - threshold).
  //
  // Compute tax at the threshold-1 rupee (where surcharge is one tier lower
  // or zero) and use the delta as the ceiling for our surcharge.
  const thresholds = [50_000_000, 20_000_000, 10_000_000, 5_000_000];
  let applicableThreshold = 0;
  for (const t of thresholds) {
    if (totalIncome > t) { applicableThreshold = t; break; }
  }
  if (applicableThreshold === 0) return round2(rawSurcharge);

  // Surcharge that would apply if income were exactly at the threshold.
  const surchargeAtThreshold = (() => {
    if (applicableThreshold === 5_000_000) return 0; // Below any surcharge
    // The tier just below current: same fn with income at threshold - 1
    return computeSurchargeInner(tax, applicableThreshold - 1, regime, opts);
  })();

  const extraIncome = totalIncome - applicableThreshold;
  const extraTaxBurden = rawSurcharge - surchargeAtThreshold;
  if (extraTaxBurden > extraIncome) {
    // Cap: don't collect more extra tax than the extra income.
    const cappedSurcharge = surchargeAtThreshold + extraIncome;
    return round2(Math.max(0, cappedSurcharge));
  }
  return round2(rawSurcharge);
}

// Internal helper — same math as computeSurcharge but without the marginal
// relief guard (would infinitely recurse). Used by computeSurcharge above
// to compute the "surcharge at the previous threshold" reference.
function computeSurchargeInner(tax, totalIncome, regime, opts) {
  if (totalIncome <= 5_000_000) return 0;
  const tier = (income) => {
    if (income <= 10_000_000) return 0.10;
    if (income <= 20_000_000) return 0.15;
    if (income <= 50_000_000) return 0.25;
    return regime === 'new' ? 0.25 : 0.37;
  };
  const tierRate = tier(totalIncome);
  const specialTax = Math.max(0, Number(opts.specialRateTax) || 0);
  const cappedSpecialRate = Math.min(tierRate, 0.15);
  const regularTax = Math.max(0, tax - specialTax);
  return regularTax * tierRate + specialTax * cappedSpecialRate;
}

/**
 * Section 87A rebate — makes small taxpayers effectively pay zero.
 * Old regime: ≤ ₹5L income → up to ₹12,500 rebate.
 * New regime FY 24-25: ≤ ₹7L income → up to ₹25,000 rebate.
 * New regime FY 25-26: ≤ ₹12L income → up to ₹60,000 rebate (Budget 2025).
 *
 * v1.10.31 — Two audit findings baked in:
 *   ITR-C2: rebate config resolves via get87AConfig(regime, fy) so FY 25-26
 *           filers get the correct ₹60k cap / ₹12L threshold.
 *   ITR-H2: eligibility now uses TOTAL income (including 111A / 112A capital
 *           gains) not just slab-taxable income. A user with ₹4.8L slab
 *           income + ₹50k LTCG used to get ₹12,500 rebate — statute denies
 *           it because total income (₹5.3L) exceeds ₹5L threshold.
 */
export function computeRebate87A(totalIncome, tax, regime = 'new', fy = CURRENT_FY) {
  const { threshold, cap } = get87AConfig(regime, fy);
  if (totalIncome <= threshold) return Math.min(tax, cap);
  return 0;
}

/**
 * Health & Education Cess — 4% flat on (tax + surcharge - rebate).
 * Same in both regimes.
 */
export function computeCess(taxAfterRebateAndSurcharge) {
  return round2(Math.max(0, taxAfterRebateAndSurcharge) * 0.04);
}

/**
 * Standard deduction — automatically applied to salary income if declared.
 * Old regime: ₹50,000 · New regime: ₹75,000 (Union Budget 2024).
 */
export function standardDeduction(regime = 'new') {
  return regime === 'new' ? 75_000 : 50_000;
}

/**
 * Cap each declared deduction to its statutory limit.
 * Returns the sum of allowed deductions.
 *
 * v1.10.31 — Two audit findings baked in:
 *   ITR-H1: 80D + 80DDB caps now context-sensitive via effectiveDeductionCap.
 *           Previously 80D was hardcoded to ₹1L (the max), letting a 30-year-old
 *           with 40-year-old parents claim ₹1L when statutory max is ₹50k.
 *   ITR-H5: 80CCD(2) now capped at 10% of salary (14% for central govt
 *           employees). Previously uncapped — a user could enter ₹50L
 *           employer NPS and get full deduction (₹15.6L tax dodge at 30%).
 *
 * @param {object} userDeductions — { '80C': 150000, ... }
 * @param {'old'|'new'} regime
 * @param {object} ctx — { selfSenior?, parentsSenior?, salary?, isGovtEmployee? }
 */
export function computeAllowedDeductions(userDeductions = {}, regime = 'old', ctx = {}) {
  const salary = Math.max(0, Number(ctx.salary) || 0);
  // 80CCD(2) — employer NPS. Cap at 10% of salary (14% for central govt).
  // Available in BOTH regimes (unlike other Chapter VI-A deductions).
  const nps2Rate = ctx.isGovtEmployee ? 0.14 : 0.10;
  const nps2Cap = salary * nps2Rate;
  const rawNps2 = Number(userDeductions['80CCD2']) || 0;
  const allowedNps2 = Math.min(rawNps2, nps2Cap);

  if (regime === 'new') {
    // Only 80CCD(2) is allowed under new regime.
    return round2(allowedNps2);
  }

  let total = 0;
  for (const section of Object.keys(DEDUCTION_CAPS)) {
    const claimed = Number(userDeductions[section]) || 0;
    // Use effectiveDeductionCap for context-sensitive sections (80D, 80DDB).
    const cap = effectiveDeductionCap(section, ctx);
    total += Math.min(claimed, cap);
  }
  total += allowedNps2;
  return round2(total);
}

/**
 * End-to-end tax computation for one regime.
 *
 * @param {object} inputs
 * @param {number} inputs.salary       — gross salary (Form 16 box 1)
 * @param {number} inputs.businessIncome — business / professional income (P&L bottom line)
 * @param {number} inputs.housePropertyIncome — rent minus 30% standard deduction minus §24(b) home-loan interest
 * @param {number} inputs.capitalGains — realised gains (STCG/LTCG treated at their own rates below)
 * @param {number} inputs.otherSources — bank interest, dividends, etc.
 * @param {number} inputs.stcgAtSpecialRate — STCG on listed equity (15% flat)
 * @param {number} inputs.ltcgAtSpecialRate — LTCG on listed equity (10% over ₹1L, exempt below)
 * @param {object} inputs.deductions   — { '80C': 150000, '80D': 25000, ... }
 * @param {'old'|'new'} inputs.regime
 * @returns {object} breakdown
 */
export function computeTax(inputs) {
  const {
    salary = 0,
    businessIncome = 0,
    housePropertyIncome = 0,
    otherSources = 0,
    stcgAtSpecialRate = 0,
    ltcgAtSpecialRate = 0,
    deductions = {},
    regime = 'new',
    // v1.10.31 — new inputs from audit findings
    fy = CURRENT_FY,
    age = 0,                    // for senior/super-senior old-regime slabs
    selfSenior = false,         // for 80D / 80DDB context
    parentsSenior = false,      // for 80D
    isGovtEmployee = false,     // for 80CCD(2) cap (14% vs 10%)
  } = inputs;

  // Standard deduction only applies against salary income
  const stdDed = salary > 0 ? Math.min(salary, standardDeduction(regime)) : 0;
  const salaryAfterStd = Math.max(0, salary - stdDed);

  // Gross Total Income = sum of heads (excludes special-rate gains)
  const gti = salaryAfterStd + businessIncome + housePropertyIncome + otherSources;

  // Chapter VI-A deductions — pass context for 80D/80DDB/80CCD(2) caps.
  const deductionCtx = { selfSenior, parentsSenior, salary, isGovtEmployee };
  const allowedDeductions = computeAllowedDeductions(deductions, regime, deductionCtx);

  // Total taxable income under normal slabs
  const taxableIncome = Math.max(0, gti - allowedDeductions);

  // Slab tax on normal income — FY-aware new regime, age-aware old regime.
  const slabs = regime === 'new'
    ? getNewRegimeSlabs(fy)
    : getOldRegimeSlabs(age);
  const slabTax = computeSlabTax(taxableIncome, slabs);

  // v1.10.31 — Capital gains rates from FY config (post-23-Jul-2024 rates).
  const cgConfig = getCapitalGainsConfig(fy);
  const stcgTax = round2(stcgAtSpecialRate * cgConfig.stcgRate);
  const ltcgTaxable = Math.max(0, ltcgAtSpecialRate - cgConfig.ltcgExemption);
  const ltcgTax = round2(ltcgTaxable * cgConfig.ltcgRate);
  const specialRateTax = stcgTax + ltcgTax;

  const taxBeforeRebate = slabTax + specialRateTax;

  // v1.10.31 — 87A eligibility uses TOTAL INCOME under Section 2(45), which
  // includes the FULL 111A/112A gains (before the ₹1.25L LTCG exemption).
  // The exemption is a deduction for tax computation, not for total income.
  // A user with ₹4.8L slab + ₹50k LTCG has total income ₹5.3L → rebate denied
  // even though only ₹0 of the LTCG is taxable (below exemption).
  // Rebate itself applies only to slab tax.
  const totalIncomeForRebate = taxableIncome + stcgAtSpecialRate + ltcgAtSpecialRate;
  const rebate = computeRebate87A(totalIncomeForRebate, slabTax, regime, fy);
  const taxAfterRebate = Math.max(0, taxBeforeRebate - rebate);

  // v1.10.31 — Wire specialRateTax through to surcharge helper so the 15%
  // cap on 111A/112A gains actually fires (was dead code before). Total
  // income for surcharge tier also uses gross LTCG (Section 2(45)).
  const totalIncomeForSurcharge = taxableIncome + stcgAtSpecialRate + ltcgAtSpecialRate;
  const surcharge = computeSurcharge(taxAfterRebate, totalIncomeForSurcharge, regime, { specialRateTax });

  const cess = computeCess(taxAfterRebate + surcharge);
  const totalTax = round2(taxAfterRebate + surcharge + cess);

  return {
    // Inputs echoed for the summary
    fy,
    grossTotalIncome: round2(gti),
    salaryAfterStd: round2(salaryAfterStd),
    standardDeduction: round2(stdDed),
    allowedDeductions: round2(allowedDeductions),
    taxableIncome: round2(taxableIncome),

    // Computation steps
    slabTax: round2(slabTax),
    stcgTax: round2(stcgTax),
    ltcgTax: round2(ltcgTax),
    specialRateTax: round2(specialRateTax),
    taxBeforeRebate: round2(taxBeforeRebate),
    rebate87A: round2(rebate),
    taxAfterRebate: round2(taxAfterRebate),
    surcharge: round2(surcharge),
    cess: round2(cess),
    totalTax,
    regime,
  };
}

/**
 * Old-vs-New side-by-side comparison. Recommends the cheaper regime.
 * When they tie, recommend NEW (since it's the default and simpler).
 */
export function compareRegimes(inputs) {
  const old_ = computeTax({ ...inputs, regime: 'old' });
  const new_ = computeTax({ ...inputs, regime: 'new' });
  const savings = new_.totalTax - old_.totalTax;
  const recommended = savings > 0.5 ? 'old' : 'new';
  return { old: old_, new: new_, savings: round2(Math.abs(savings)), recommended };
}

// -------------------------- Bank-statement helpers ---------------------------

/**
 * Rule-based auto-categorization of bank transactions. Each rule is a
 * regex + category string. First match wins. Users can override any row
 * in the review grid.
 *
 * Categories map to ITR heads:
 *   'salary'         → Salary income (ITR-1 / ITR-2 head)
 *   'business_in'    → Business receipts (ITR-3 / ITR-4)
 *   'business_out'   → Business expense
 *   'interest'       → Interest income (other sources; 80TTA eligible)
 *   'rent_received'  → Rental income (house property)
 *   'investment'     → Excluded from ITR income (movements to MF/PPF/stocks)
 *   'deduction_80C'  → 80C claim (LIC / ELSS / PPF outflow)
 *   'deduction_80D'  → 80D claim (health insurance)
 *   'gst_paid'       → GST payment (business expense; not ITR-deductible directly)
 *   'transfer'       → Between own accounts / unclassified
 *   'personal'       → Personal spending — not ITR-relevant
 */
export const AUTO_CATEGORY_RULES = [
  { pattern: /\bsalary|sal\b|payroll/i,                         category: 'salary' },
  { pattern: /\bint\b|interest|savings interest|sb\s*int/i,     category: 'interest' },
  { pattern: /\brent\b|rental/i,                                category: 'rent_received' },
  { pattern: /\bsip\b|mutual fund|elss|mf\b/i,                  category: 'investment' },
  { pattern: /\bppf|nps\b/i,                                    category: 'investment' },
  { pattern: /\blic\b|life insurance/i,                         category: 'deduction_80C' },
  { pattern: /health insurance|mediclaim/i,                     category: 'deduction_80D' },
  { pattern: /\bgst\b|cgst|sgst|igst/i,                         category: 'gst_paid' },
  { pattern: /\bemi\b|home loan|housing loan/i,                 category: 'business_out' },
  { pattern: /\brent paid|office rent/i,                        category: 'business_out' },
  { pattern: /electric|utility|broadband|internet|telephone/i,  category: 'business_out' },
  { pattern: /aws|amazon web|azure|google cloud|adobe|figma/i,  category: 'business_out' },
  { pattern: /amazon|flipkart|swiggy|zomato/i,                  category: 'personal' },
  { pattern: /\batm|cash withdrawal/i,                          category: 'personal' },
  { pattern: /\bimps|neft|rtgs|upi/i,                           category: 'transfer' },
];

/**
 * Try each rule; return the first matching category, else 'transfer'.
 * @param {string} description raw bank-statement narration
 * @returns {string} category key from AUTO_CATEGORY_RULES
 */
export function autoCategorize(description) {
  const d = String(description || '');
  for (const rule of AUTO_CATEGORY_RULES) {
    if (rule.pattern.test(d)) return rule.category;
  }
  return 'transfer';
}

// ------------------------- CSV parsers per bank ------------------------------
// Detects the source bank from the CSV header row and returns a normalised
// array of { date, description, debit, credit, balance } transactions.
//
// Each bank has a slightly different CSV layout. We support the "big 7":
// SBI, HDFC, ICICI, Axis, Kotak, PNB, Yes Bank. Unknown formats fall back
// to a heuristic that looks for columns named Date / Narration / Debit /
// Credit / Balance in any order.

const BANK_FORMATS = [
  {
    name: 'SBI',
    match: (headers) => headers.some(h => /Txn Date/i.test(h)) && headers.some(h => /Value Date/i.test(h)),
    map: (row, hIdx) => ({
      date: row[hIdx.txnDate] || row[hIdx.valueDate],
      description: row[hIdx.description],
      debit: parseAmt(row[hIdx.debit]),
      credit: parseAmt(row[hIdx.credit]),
      balance: parseAmt(row[hIdx.balance]),
    }),
    headerMap: (headers) => ({
      txnDate: findCol(headers, /Txn Date/i),
      valueDate: findCol(headers, /Value Date/i),
      description: findCol(headers, /Description|Narration/i),
      debit: findCol(headers, /Debit/i),
      credit: findCol(headers, /Credit/i),
      balance: findCol(headers, /Balance/i),
    }),
  },
  {
    name: 'HDFC',
    match: (headers) => headers.some(h => /Narration/i.test(h)) && headers.some(h => /Withdrawal Amt/i.test(h)),
    map: (row, hIdx) => ({
      date: row[hIdx.date],
      description: row[hIdx.description],
      debit: parseAmt(row[hIdx.debit]),
      credit: parseAmt(row[hIdx.credit]),
      balance: parseAmt(row[hIdx.balance]),
    }),
    headerMap: (headers) => ({
      date: findCol(headers, /Date/i),
      description: findCol(headers, /Narration/i),
      debit: findCol(headers, /Withdrawal Amt/i),
      credit: findCol(headers, /Deposit Amt/i),
      balance: findCol(headers, /Closing Balance/i),
    }),
  },
  {
    name: 'ICICI',
    match: (headers) => headers.some(h => /Transaction Remarks/i.test(h)),
    map: (row, hIdx) => ({
      date: row[hIdx.date],
      description: row[hIdx.description],
      debit: parseAmt(row[hIdx.debit]),
      credit: parseAmt(row[hIdx.credit]),
      balance: parseAmt(row[hIdx.balance]),
    }),
    headerMap: (headers) => ({
      date: findCol(headers, /Transaction Date|Value Date/i),
      description: findCol(headers, /Transaction Remarks|Description/i),
      debit: findCol(headers, /Withdrawal Amount|Debit/i),
      credit: findCol(headers, /Deposit Amount|Credit/i),
      balance: findCol(headers, /Balance/i),
    }),
  },
  {
    name: 'Axis',
    match: (headers) => headers.some(h => /Tran Date/i.test(h)) && headers.some(h => /Particulars/i.test(h)),
    map: (row, hIdx) => ({
      date: row[hIdx.date],
      description: row[hIdx.description],
      debit: parseAmt(row[hIdx.debit]),
      credit: parseAmt(row[hIdx.credit]),
      balance: parseAmt(row[hIdx.balance]),
    }),
    headerMap: (headers) => ({
      date: findCol(headers, /Tran Date/i),
      description: findCol(headers, /Particulars/i),
      debit: findCol(headers, /Debit/i),
      credit: findCol(headers, /Credit/i),
      balance: findCol(headers, /Balance/i),
    }),
  },
  {
    name: 'Kotak',
    match: (headers) => headers.some(h => /Chq\/Ref No/i.test(h)) || headers.some(h => /Withdrawal\(Dr\)/i.test(h)),
    map: (row, hIdx) => ({
      date: row[hIdx.date],
      description: row[hIdx.description],
      debit: parseAmt(row[hIdx.debit]),
      credit: parseAmt(row[hIdx.credit]),
      balance: parseAmt(row[hIdx.balance]),
    }),
    headerMap: (headers) => ({
      date: findCol(headers, /Date/i),
      description: findCol(headers, /Description|Narration/i),
      debit: findCol(headers, /Withdrawal|Debit/i),
      credit: findCol(headers, /Deposit|Credit/i),
      balance: findCol(headers, /Balance/i),
    }),
  },
  {
    name: 'PNB',
    match: (headers) => headers.some(h => /Chq No/i.test(h)) && headers.some(h => /Narration/i.test(h)),
    map: (row, hIdx) => ({
      date: row[hIdx.date],
      description: row[hIdx.description],
      debit: parseAmt(row[hIdx.debit]),
      credit: parseAmt(row[hIdx.credit]),
      balance: parseAmt(row[hIdx.balance]),
    }),
    headerMap: (headers) => ({
      date: findCol(headers, /Transaction Date|Date/i),
      description: findCol(headers, /Narration/i),
      debit: findCol(headers, /Debit/i),
      credit: findCol(headers, /Credit/i),
      balance: findCol(headers, /Balance/i),
    }),
  },
  {
    name: 'Yes Bank',
    match: (headers) => headers.some(h => /Chq No\.|Instrument No/i.test(h)) && headers.some(h => /Value Date/i.test(h)),
    map: (row, hIdx) => ({
      date: row[hIdx.date],
      description: row[hIdx.description],
      debit: parseAmt(row[hIdx.debit]),
      credit: parseAmt(row[hIdx.credit]),
      balance: parseAmt(row[hIdx.balance]),
    }),
    headerMap: (headers) => ({
      date: findCol(headers, /Transaction Date|Value Date/i),
      description: findCol(headers, /Description|Narration/i),
      debit: findCol(headers, /Debit/i),
      credit: findCol(headers, /Credit/i),
      balance: findCol(headers, /Balance/i),
    }),
  },
  // Fallback — best-effort column detection.
  {
    name: 'Generic',
    match: () => true,
    map: (row, hIdx) => ({
      date: row[hIdx.date],
      description: row[hIdx.description],
      debit: parseAmt(row[hIdx.debit]),
      credit: parseAmt(row[hIdx.credit]),
      balance: parseAmt(row[hIdx.balance]),
    }),
    headerMap: (headers) => ({
      date: findCol(headers, /Date/i),
      description: findCol(headers, /Description|Narration|Particulars|Remarks/i),
      debit: findCol(headers, /Debit|Withdrawal|Dr/i),
      credit: findCol(headers, /Credit|Deposit|Cr/i),
      balance: findCol(headers, /Balance/i),
    }),
  },
];

/**
 * Parse a bank-statement CSV string. Returns:
 *   { bankName, transactions: [{ date, description, debit, credit, balance, category }] }
 *
 * The `category` field is auto-populated by `autoCategorize`. Users override
 * in the UI review grid.
 */
export function parseBankStatement(csvText) {
  const rows = parseCSV(csvText);
  if (rows.length < 2) throw new Error('CSV must have a header row + at least one transaction');
  // Find the actual header row — some banks prepend account-info lines
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const r = rows[i];
    if (r.some(c => /date/i.test(c)) && r.some(c => /balance|amount/i.test(c))) {
      headerRowIdx = i;
      break;
    }
  }
  const headers = rows[headerRowIdx];
  const dataRows = rows.slice(headerRowIdx + 1);

  const format = BANK_FORMATS.find(f => f.match(headers));
  const hIdx = format.headerMap(headers);

  const transactions = dataRows
    .filter(r => r.length >= 3 && r.some(c => c && String(c).trim())) // skip blank / footer rows
    .map(r => {
      const parsed = format.map(r, hIdx);
      if (!parsed.date) return null;
      return { ...parsed, category: autoCategorize(parsed.description) };
    })
    .filter(Boolean);

  return { bankName: format.name, transactions };
}

// --- tiny CSV helpers (kept in-file to avoid a dependency) --------------------

function parseCSV(text) {
  const lines = String(text || '').split(/\r?\n/);
  const rows = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    // Handles quoted fields containing commas / escaped double-quotes.
    const row = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuotes) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') inQuotes = false;
        else cur += c;
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ',') { row.push(cur); cur = ''; }
        else cur += c;
      }
    }
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

function findCol(headers, pattern) {
  return headers.findIndex(h => pattern.test(String(h || '').trim()));
}

function parseAmt(v) {
  if (v === null || v === undefined || v === '') return 0;
  const cleaned = String(v).replace(/[₹,\s]/g, '').replace(/^-$/, '0');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function round2(n) { return Math.round(n * 100) / 100; }

// ============================================================================
// Presumptive taxation — Sections 44AD, 44ADA, 44AE
// ----------------------------------------------------------------------------
// Small businesses can skip maintaining full books by declaring a fixed
// percentage of turnover / gross receipts as income. Available to individuals,
// HUFs, partnership firms (not LLPs); ITR-4 (Sugam) is the return form.
// Once opted in, must continue for 5 assessment years — opting out early
// disqualifies §44AD for the next 5 years.
// ============================================================================

/**
 * Section 44AD — presumptive business income for eligible businesses
 * (traders, retailers, manufacturers) with turnover up to ₹2 crore
 * (₹3 crore if aggregate cash receipts ≤ 5% of turnover, from FY 2023-24).
 *
 * Deemed income:
 *   - 6% of turnover received via banking channels / digital modes
 *   - 8% of turnover received in cash
 * User can voluntarily declare MORE than the deemed % if their actual
 * profit is higher (tax authorities never object to over-declaration).
 *
 * @param {object} input
 * @param {number} input.digitalReceipts — turnover via NEFT/UPI/RTGS/cheque
 * @param {number} input.cashReceipts    — turnover received in cash
 * @param {number} [input.declaredIncome] — optional user override (must ≥ deemed)
 * @returns { turnover, presumptiveIncome, isEligible, notes[] }
 */
export function compute44AD({ digitalReceipts = 0, cashReceipts = 0, declaredIncome }) {
  const digital = Math.max(0, Number(digitalReceipts) || 0);
  const cash = Math.max(0, Number(cashReceipts) || 0);
  const turnover = digital + cash;
  const notes = [];

  // Threshold: ₹2Cr default, ₹3Cr if cash receipts ≤ 5% of turnover
  const cashPct = turnover > 0 ? cash / turnover : 0;
  const threshold = cashPct <= 0.05 ? 30_000_000 : 20_000_000;
  const isEligible = turnover <= threshold;
  if (!isEligible) {
    notes.push(`Turnover of ${formatINR(turnover)} exceeds the §44AD limit of ${formatINR(threshold)}. You must maintain regular books and file ITR-3 with a Tax Audit Report (§44AB).`);
  }
  if (cashPct > 0.05 && turnover <= 30_000_000) {
    notes.push(`${(cashPct * 100).toFixed(1)}% of your turnover is in cash — above the 5% threshold. Reduce cash receipts to qualify for the ₹3Cr limit.`);
  }

  const deemed = round2(digital * 0.06 + cash * 0.08);
  const finalIncome = Math.max(deemed, Number(declaredIncome) || 0);

  if (Number(declaredIncome) && Number(declaredIncome) < deemed) {
    notes.push(`Declared income (${formatINR(declaredIncome)}) is less than the presumptive minimum (${formatINR(deemed)}). Assessee must maintain full books and file ITR-3.`);
  }

  return {
    turnover: round2(turnover),
    digitalReceipts: round2(digital),
    cashReceipts: round2(cash),
    deemedIncome: deemed,
    presumptiveIncome: round2(finalIncome),
    isEligible,
    section: '44AD',
    threshold,
    notes,
  };
}

/**
 * Section 44ADA — presumptive taxation for professionals
 * (doctors, lawyers, CAs, engineers, architects, technical consultants,
 * interior designers, film-industry professionals, and any notified profession).
 *
 * Turnover cap: ₹50L (was), ₹75L from FY 2023-24 (if cash receipts ≤ 5%).
 * Deemed income: **50% of gross receipts** — professionals get to write off
 * half their fees as expenses without proving anything.
 */
export function compute44ADA({ digitalReceipts = 0, cashReceipts = 0, declaredIncome }) {
  const digital = Math.max(0, Number(digitalReceipts) || 0);
  const cash = Math.max(0, Number(cashReceipts) || 0);
  const turnover = digital + cash;
  const notes = [];

  const cashPct = turnover > 0 ? cash / turnover : 0;
  const threshold = cashPct <= 0.05 ? 7_500_000 : 5_000_000;
  const isEligible = turnover <= threshold;
  if (!isEligible) {
    notes.push(`Gross receipts of ${formatINR(turnover)} exceed the §44ADA limit of ${formatINR(threshold)}. Full books + ITR-3 + audit (§44AB) apply.`);
  }

  const deemed = round2(turnover * 0.50);
  const finalIncome = Math.max(deemed, Number(declaredIncome) || 0);

  if (Number(declaredIncome) && Number(declaredIncome) < deemed) {
    notes.push(`Declared income is below 50% of gross receipts. Full books required.`);
  }

  return {
    turnover: round2(turnover),
    digitalReceipts: round2(digital),
    cashReceipts: round2(cash),
    deemedIncome: deemed,
    presumptiveIncome: round2(finalIncome),
    isEligible,
    section: '44ADA',
    threshold,
    notes,
  };
}

/**
 * Section 44AE — presumptive taxation for transporters (goods-carriage owners).
 * Applies when the assessee owns ≤ 10 goods vehicles at any time in the year.
 * Deemed income per vehicle per month:
 *   - Heavy (> 12,000 kg gross weight): ₹1,000 per tonne of gross weight
 *   - Light (≤ 12,000 kg gross weight):  ₹7,500 flat
 *
 * v1.10.31 — Parity with 44AD / 44ADA: added `isEligible`, negative-input
 * clamping (was silently multiplying negatives into a negative deemed),
 * a note when total vehicle-months / 12 exceeds 10 (proxy for the
 * "> 10 vehicles at any time" statutory disqualifier), and a warning when
 * declaredIncome is below the deemed floor. Prior version was permissive
 * enough that a user could type -5 into "vehicles" and the calculator
 * would report negative deemed income without complaint.
 */
export function compute44AE({ heavyVehicleMonths = 0, heavyVehicleTonnage = 0, lightVehicleMonths = 0, declaredIncome }) {
  const hMonths = Math.max(0, Number(heavyVehicleMonths) || 0);
  const hTonnes = Math.max(0, Number(heavyVehicleTonnage) || 0);
  const lMonths = Math.max(0, Number(lightVehicleMonths) || 0);
  const heavy = round2(hMonths * hTonnes * 1000);
  const light = round2(lMonths * 7500);
  const deemed = heavy + light;
  const finalIncome = Math.max(deemed, Number(declaredIncome) || 0);

  const notes = [];
  // A single vehicle owned for a full FY contributes 12 vehicle-months.
  // So (hMonths + lMonths) / 12 approximates the peak vehicle count. If
  // that's > 10, the assessee is outside §44AE eligibility. This is a
  // proxy — the statute checks vehicle count "at any time in the year",
  // not the annual average — so we surface it as a warning rather than
  // hard-disqualification.
  const impliedFleet = (hMonths + lMonths) / 12;
  const isEligible = impliedFleet <= 10.0001;
  if (!isEligible) {
    notes.push(`Implied fleet size ≈ ${impliedFleet.toFixed(1)} vehicles exceeds the §44AE cap of 10 goods carriages. Assessee must maintain regular books and file ITR-3 with a §44AB audit report.`);
  }
  if (Number(declaredIncome) && Number(declaredIncome) < deemed) {
    notes.push(`Declared income (${formatINR(declaredIncome)}) is less than the presumptive minimum (${formatINR(deemed)}). Assessee must maintain full books and file ITR-3.`);
  }

  return {
    heavyIncome: heavy,
    lightIncome: light,
    deemedIncome: deemed,
    presumptiveIncome: round2(finalIncome),
    isEligible,
    section: '44AE',
    notes,
  };
}

// ============================================================================
// Advance Tax — Sections 208, 234B, 234C
// ----------------------------------------------------------------------------
// Every assessee with tax liability ≥ ₹10,000 (after TDS) must pay advance
// tax in four installments. Missing them triggers interest under 234B/234C.
// Presumptive-taxation opters (§44AD/§44ADA) can pay 100% in one shot by 15 Mar.
// ============================================================================

/**
 * v1.10.31 — Advance-tax due dates are now derived from the FY, not
 * hardcoded strings. Prior code had `'2024-06-15'` etc. baked in — an FY
 * 25-26 filer paying on `'2025-06-14'` sorted AFTER the hardcoded string
 * and was flagged as late → phantom 234C interest up to 1% × 3 months ×
 * (₹5L × 15%) = ₹2,250 per quarter.
 *
 * Now `getAdvanceTaxSchedule(fy)` returns the correct dates for any FY.
 * For FY YYYY-YY, the four installments fall on:
 *   Q1  15-Jun-YYYY   (15%)
 *   Q2  15-Sep-YYYY   (45% cumulative)
 *   Q3  15-Dec-YYYY   (75%)
 *   Q4  15-Mar-(YYYY+1) (100%)
 */
export function getAdvanceTaxSchedule(fy = CURRENT_FY) {
  const startYear = Number(String(fy).split('-')[0]);
  if (!Number.isFinite(startYear)) {
    throw new Error(`Invalid FY: ${fy}. Expected format YYYY-YY (e.g. "2025-26").`);
  }
  const endYear = startYear + 1;
  return [
    { installment: 1, dueDate: `${startYear}-06-15`, cumulativePct: 0.15, label: 'By 15 June' },
    { installment: 2, dueDate: `${startYear}-09-15`, cumulativePct: 0.45, label: 'By 15 Sept' },
    { installment: 3, dueDate: `${startYear}-12-15`, cumulativePct: 0.75, label: 'By 15 Dec' },
    { installment: 4, dueDate: `${endYear}-03-15`,   cumulativePct: 1.00, label: 'By 15 March' },
  ];
}

// Backward-compat: legacy default export for callers not passing an FY.
// Resolves to CURRENT_FY.
export const ADVANCE_TAX_SCHEDULE = getAdvanceTaxSchedule(CURRENT_FY);

/**
 * Compute the advance-tax schedule.
 * @param {number} totalTax — total tax liability for the FY (after §87A rebate)
 * @param {number} tdsAlreadyDeducted — TDS credit already claimed
 * @param {Array<{date:string, amount:number}>} paid — installments already paid
 * @param {'regular'|'presumptive'} mode — presumptive allows single 15-Mar payment
 * @returns {object}
 */
export function computeAdvanceTaxSchedule(totalTax, tdsAlreadyDeducted = 0, paid = [], mode = 'regular', fy = CURRENT_FY) {
  const netLiability = Math.max(0, totalTax - (Number(tdsAlreadyDeducted) || 0));
  if (netLiability < 10_000) {
    return {
      netLiability, applies: false,
      note: 'Net liability (after TDS) is below ₹10,000 — no advance tax required.',
      schedule: [],
      fy,
    };
  }
  // v1.10.31 — Use FY-relative schedule instead of the stale-year default.
  const schedule = getAdvanceTaxSchedule(fy);
  // Presumptive-mode assessees: single 100% installment on 15 March
  const rows = (mode === 'presumptive' ? [schedule[3]] : schedule)
    .map((row, i, arr) => {
      const cumulativeDue = round2(netLiability * row.cumulativePct);
      const totalPaidByDue = paid
        .filter(p => p.date <= row.dueDate)
        .reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const shortfall = Math.max(0, cumulativeDue - totalPaidByDue);
      const prevCumulative = mode === 'presumptive' ? 0 : (arr[i - 1]?.cumulativePct || 0);
      const installmentDue = round2(netLiability * (row.cumulativePct - prevCumulative));
      return {
        ...row,
        installmentDue,
        cumulativeDue,
        totalPaidByDue,
        shortfall,
      };
    });
  const totalPaid = paid.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  return {
    applies: true,
    netLiability,
    totalPaid: round2(totalPaid),
    totalOutstanding: round2(Math.max(0, netLiability - totalPaid)),
    schedule: rows,
    mode,
    fy,
  };
}

/**
 * v1.10.31 — Rule 119A rounding helper.
 *
 * Rule 119A(a) of the Income Tax Rules: "the amount on which interest is
 * calculated shall be rounded off to the nearest one hundred rupees and,
 * for this purpose, any fraction of one hundred rupees shall be ignored".
 *
 * i.e. round DOWN to the nearest ₹100. Applied to every shortfall figure
 * before multiplying by the 1%-per-month rate in 234B / 234C.
 *
 * On a ₹1,49,999 shortfall: legally the interest is computed on ₹1,49,900,
 * not ₹1,49,999 — a difference of ₹0.99 per month. Small per case but
 * compounded across 234B (up to 12 months) and 234C (up to 3 months) it
 * matters for CA-audited returns.
 */
function rule119A(amount) {
  return Math.floor(Math.max(0, Number(amount) || 0) / 100) * 100;
}

/**
 * Section 234C interest — for shortfall in any installment.
 * 1% per month for 3 months for installments 1-3; 1% for 1 month for installment 4.
 * Waived if you paid ≥ 12% by 15 Jun / 36% by 15 Sept (i.e. slight under-payment ok).
 *
 * v1.10.1 — Presumptive-mode fix. A 44AD/44ADA/44AE assessee has ONE
 * installment (15-Mar, 100%). Prior code destructured
 * `[i1, i2, i3, i4]` from a 1-element array — i1 was the Q4 entry but
 * was treated as Q1 (3-month rate + 12% waiver test). Wrong section,
 * wrong month count. Now: presumptive mode gets a single-Q4 calc.
 */
export function compute234CInterest(schedule) {
  if (!schedule.applies || !schedule.schedule.length) return 0;
  const netLiab = schedule.netLiability;
  // v1.10.31 — Every shortfall wrapped in rule119A() before interest math.
  // Presumptive: single installment at 15-Mar, 1 month × 1% on shortfall.
  if (schedule.mode === 'presumptive' || schedule.schedule.length === 1) {
    const only = schedule.schedule[0];
    const shortfall = rule119A(netLiab - (only?.totalPaidByDue || 0));
    return round2(shortfall * 0.01);
  }
  let interest = 0;
  const [i1, i2, i3, i4] = schedule.schedule;
  if (i1 && i1.totalPaidByDue < 0.12 * netLiab) {
    const shortfall = rule119A(netLiab * 0.15 - i1.totalPaidByDue);
    interest += shortfall * 0.03;
  }
  if (i2 && i2.totalPaidByDue < 0.36 * netLiab) {
    const shortfall = rule119A(netLiab * 0.45 - i2.totalPaidByDue);
    interest += shortfall * 0.03;
  }
  if (i3) {
    const shortfall = rule119A(netLiab * 0.75 - i3.totalPaidByDue);
    interest += shortfall * 0.03;
  }
  if (i4) {
    const shortfall = rule119A(netLiab - i4.totalPaidByDue);
    interest += shortfall * 0.01;
  }
  return round2(interest);
}

/**
 * Section 234A interest — for late filing of the return past the due date.
 *
 * v1.10.31 — Section was entirely absent from the app; only 234B and 234C
 * were wired. 234A is a distinct charge (late FILING, not late PAYMENT)
 * that catches a common real-world situation: a taxpayer who paid enough
 * advance tax to escape 234B and 234C, but files their ITR after the due
 * date (say, 15-Aug instead of 31-Jul). They still owe 1% per month on
 * the unpaid net liability from the day after the due date until filing.
 *
 * Rate:   1% per month or part of a month (Rule 119A month counting)
 * Base:   net tax payable after TDS + advance tax + self-assessment paid
 *         so far — the "self-assessment tax outstanding on due date"
 * Period: (due date + 1 day) → filing date
 *
 * Due date defaults (individual, non-audit): 31-Jul of AY.
 * For audit cases (44AB, transfer pricing) it's 31-Oct — caller supplies
 * `dueDate` explicitly for those.
 *
 * @param {number} netTaxPayable — total tax after 87A rebate + surcharge + cess
 * @param {number} taxPaid — advance tax + TDS + self-assessment tax already paid
 * @param {string} filingDate — ISO date the ITR was actually filed
 * @param {string} [dueDate] — statutory due date; defaults to 31-Jul of the AY
 * @param {string} [fy] — FY string; used only to derive default dueDate
 * @returns {number}
 */
export function compute234AInterest(netTaxPayable, taxPaid, filingDate, dueDate, fy = CURRENT_FY) {
  const outstanding = Math.max(0, (Number(netTaxPayable) || 0) - (Number(taxPaid) || 0));
  if (outstanding <= 0) return 0;
  // Derive default due date from FY (31-Jul of AY = FY-end year + 1).
  let due;
  if (dueDate) {
    due = new Date(dueDate);
  } else {
    const startYear = Number(String(fy).split('-')[0]);
    if (!Number.isFinite(startYear)) return 0;
    due = new Date(`${startYear + 1}-07-31`);
  }
  const filed = filingDate ? new Date(filingDate) : new Date();
  if (!(filed > due)) return 0;
  // Rule 119A month counting: same logic as 234B — count calendar months
  // between due and filing date, count any partial month as one full month.
  const yearDiff = filed.getFullYear() - due.getFullYear();
  const monthDiff = filed.getMonth() - due.getMonth();
  let months = yearDiff * 12 + monthDiff;
  if (filed.getDate() > due.getDate()) months += 1;
  months = Math.max(1, months);
  const shortfall = rule119A(outstanding);
  return round2(shortfall * 0.01 * months);
}

/**
 * Section 234B interest — for shortfall of ≥ 10% of total tax by 31 Mar.
 * 1% per month from 1 Apr of the AY until date of payment.
 * @param {object} schedule — output of computeAdvanceTaxSchedule
 * @param {string} assessmentPaymentDate — ISO date; defaults to today
 */
export function compute234BInterest(schedule, assessmentPaymentDate, fy) {
  if (!schedule.applies) return 0;
  const paidByYearEnd = schedule.totalPaid;
  const netLiab = schedule.netLiability;
  if (paidByYearEnd >= 0.9 * netLiab) return 0;
  // v1.10.31 — Rule 119A: round shortfall down to nearest ₹100 before
  // multiplying by 1% per month.
  const shortfall = rule119A(netLiab - paidByYearEnd);
  // v1.10.31 — FY-relative April 1 (was hardcoded '2025-04-01'). Prefer
  // schedule.fy, then explicit fy param, then CURRENT_FY.
  const useFy = schedule?.fy || fy || CURRENT_FY;
  const startYear = Number(String(useFy).split('-')[0]);
  if (!Number.isFinite(startYear)) return 0;
  const fyEnd = new Date(`${startYear + 1}-04-01`);
  const payDate = assessmentPaymentDate ? new Date(assessmentPaymentDate) : new Date();
  // v1.10.1 — Rule 119A: count calendar-month parts, not 30-day chunks.
  if (payDate <= fyEnd) return 0;
  const yearDiff = payDate.getFullYear() - fyEnd.getFullYear();
  const monthDiff = payDate.getMonth() - fyEnd.getMonth();
  let months = yearDiff * 12 + monthDiff;
  // If payment date is later in its month than fyEnd, the partial month
  // counts as one full month per Rule 119A.
  if (payDate.getDate() > fyEnd.getDate()) months += 1;
  months = Math.max(1, months);
  return round2(shortfall * 0.01 * months);
}

// ============================================================================
// ITR-4 field mapping for the Filing Summary PDF
// ----------------------------------------------------------------------------
// Each entry maps a computed value to the exact line item on the ITR-4 form
// (AY 2025-26) so the user can copy-paste into the IT portal. Update annually
// when CBDT releases the new AY schema.
// ============================================================================

/**
 * Build the ITR-4 field list from computed tax + presumptive income + deductions.
 * Order matches the physical layout of ITR-4 Sugam.
 * Each row: { field, section, value, note? }
 */
export function buildITR4FieldMap(inputs, tax, presumptive, deductions) {
  const rows = [];
  // Personal info (user fills manually — we can't infer PAN from the app)
  rows.push({ section: 'Part A — General', field: 'PAN', value: '', note: 'Fill from your profile' });
  rows.push({ section: 'Part A — General', field: 'Filing Status', value: 'Filed under §139(1) — before due date' });
  rows.push({ section: 'Part A — General', field: 'Aadhaar', value: '', note: 'Must be linked' });

  // Nature of business
  if (presumptive?.section === '44AD') {
    rows.push({ section: 'Part A — Nature of Business', field: 'Section 44AD (Trading / Retail / Manufacturing)', value: 'Yes' });
    rows.push({ section: 'Part A — Nature of Business', field: 'Gross Turnover (digital)', value: presumptive.digitalReceipts });
    rows.push({ section: 'Part A — Nature of Business', field: 'Gross Turnover (cash)', value: presumptive.cashReceipts });
  } else if (presumptive?.section === '44ADA') {
    rows.push({ section: 'Part A — Nature of Business', field: 'Section 44ADA (Profession)', value: 'Yes' });
    rows.push({ section: 'Part A — Nature of Business', field: 'Gross Receipts', value: presumptive.turnover });
  } else if (presumptive?.section === '44AE') {
    rows.push({ section: 'Part A — Nature of Business', field: 'Section 44AE (Transport)', value: 'Yes' });
  }

  // Part B — Gross Total Income
  const salary = Number(inputs.salary) || 0;
  const std = tax.standardDeduction || 0;
  rows.push({ section: 'B — Income', field: 'B1. Salary (gross)', value: salary, note: salary > 0 ? 'From Form 16' : undefined });
  if (std) rows.push({ section: 'B — Income', field: '  Less: Standard Deduction', value: -std });
  rows.push({ section: 'B — Income', field: '  Net Salary', value: Math.max(0, salary - std) });
  rows.push({ section: 'B — Income', field: 'B2. House Property (net)', value: Number(inputs.housePropertyIncome) || 0 });
  rows.push({ section: 'B — Income', field: 'B3. Business / Profession', value: presumptive?.presumptiveIncome ?? (Number(inputs.businessIncome) || 0), note: presumptive ? `Presumptive @ §${presumptive.section}` : 'From books' });
  rows.push({ section: 'B — Income', field: 'B4. Other Sources', value: Number(inputs.otherSources) || 0 });
  rows.push({ section: 'B — Income', field: 'B5. Gross Total Income', value: tax.grossTotalIncome, bold: true });

  // Part C — Deductions
  if (tax.regime === 'old') {
    rows.push({ section: 'C — Deductions (Chapter VI-A)', field: '§80C', value: Math.min(150_000, Number(deductions?.['80C']) || 0) });
    rows.push({ section: 'C — Deductions (Chapter VI-A)', field: '§80CCD(1B) — NPS', value: Math.min(50_000, Number(deductions?.['80CCD1B']) || 0) });
    rows.push({ section: 'C — Deductions (Chapter VI-A)', field: '§80D — Health Insurance', value: Math.min(100_000, Number(deductions?.['80D']) || 0) });
    rows.push({ section: 'C — Deductions (Chapter VI-A)', field: '§80TTA — Savings Interest', value: Math.min(10_000, Number(deductions?.['80TTA']) || 0) });
    rows.push({ section: 'C — Deductions (Chapter VI-A)', field: '§80E — Education Loan Interest', value: Number(deductions?.['80E']) || 0 });
    rows.push({ section: 'C — Deductions (Chapter VI-A)', field: '§80G — Donations', value: Number(deductions?.['80G']) || 0 });
    rows.push({ section: 'C — Deductions (Chapter VI-A)', field: '  Total Chapter VI-A', value: tax.allowedDeductions, bold: true });
  } else {
    rows.push({ section: 'C — Deductions (Chapter VI-A)', field: '§80CCD(2) — Employer NPS', value: Number(deductions?.['80CCD2']) || 0, note: 'Only deduction allowed under new regime' });
  }

  // Part D — Tax computation
  rows.push({ section: 'D — Tax Computation', field: 'D1. Taxable Income', value: tax.taxableIncome, bold: true });
  rows.push({ section: 'D — Tax Computation', field: 'D2. Tax on Total Income (slab)', value: tax.slabTax });
  if (tax.stcgTax) rows.push({ section: 'D — Tax Computation', field: '   + STCG (15%)', value: tax.stcgTax });
  if (tax.ltcgTax) rows.push({ section: 'D — Tax Computation', field: '   + LTCG (10%)', value: tax.ltcgTax });
  if (tax.rebate87A) rows.push({ section: 'D — Tax Computation', field: '   − §87A Rebate', value: -tax.rebate87A });
  if (tax.surcharge) rows.push({ section: 'D — Tax Computation', field: '   + Surcharge', value: tax.surcharge });
  rows.push({ section: 'D — Tax Computation', field: '   + Health & Ed Cess (4%)', value: tax.cess });
  rows.push({ section: 'D — Tax Computation', field: 'D3. TOTAL TAX PAYABLE', value: tax.totalTax, bold: true, big: true });

  return rows;
}

// ---- internal ---------------------------------------------------------------
function formatINR(n) {
  const rounded = Math.round(Number(n) || 0);
  return '₹' + rounded.toLocaleString('en-IN');
}
