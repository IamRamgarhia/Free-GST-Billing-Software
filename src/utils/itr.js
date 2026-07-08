// ============================================================================
// Indian Income Tax helpers — FY 2024-25 (Assessment Year 2025-26)
// ----------------------------------------------------------------------------
// Everything here is pure math. UI components in components/IncomeTax*.jsx
// consume these helpers. Kept in a separate file so the tax logic can be
// unit-tested and audited by a CA without loading React.
// ============================================================================

// ----------------------------- Regimes ---------------------------------------

/**
 * OLD REGIME slabs for FY 2024-25 (individuals below 60 years).
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
 */
export const OLD_REGIME_SLABS = [
  { upto: 250_000, rate: 0 },
  { upto: 500_000, rate: 0.05 },
  { upto: 1_000_000, rate: 0.20 },
  { upto: Infinity, rate: 0.30 },
];

/**
 * NEW REGIME (Section 115BAC) slabs for FY 2024-25 as of Union Budget 2024:
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
 *
 * New regime is the DEFAULT since FY 2023-24 — assessees who want the old
 * regime must actively opt out.
 */
export const NEW_REGIME_SLABS = [
  { upto: 300_000, rate: 0 },
  { upto: 700_000, rate: 0.05 },
  { upto: 1_000_000, rate: 0.10 },
  { upto: 1_200_000, rate: 0.15 },
  { upto: 1_500_000, rate: 0.20 },
  { upto: Infinity, rate: 0.30 },
];

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
  return round2(regularTax * tierRate + specialTax * cappedSpecialRate);
}

/**
 * Section 87A rebate — makes small taxpayers effectively pay zero.
 * Old regime: ≤ ₹5L income → up to ₹12,500 rebate.
 * New regime: ≤ ₹7L income → up to ₹25,000 rebate.
 */
export function computeRebate87A(taxableIncome, tax, regime = 'new') {
  if (regime === 'old') {
    if (taxableIncome <= 500_000) return Math.min(tax, 12_500);
    return 0;
  }
  if (taxableIncome <= 700_000) return Math.min(tax, 25_000);
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
 * Cap each declared deduction to its statutory limit under old regime.
 * Returns the sum of allowed deductions.
 */
export function computeAllowedDeductions(userDeductions = {}, regime = 'old') {
  if (regime === 'new') {
    // Only 80CCD(2) — employer NPS contribution — is allowed under new regime.
    return Number(userDeductions['80CCD2']) || 0;
  }
  let total = 0;
  for (const [section, cap] of Object.entries(DEDUCTION_CAPS)) {
    const claimed = Number(userDeductions[section]) || 0;
    total += Math.min(claimed, cap);
  }
  // 80CCD(2) is available in both regimes and doesn't have a fixed cap
  // (10-14% of salary — user's responsibility to enter valid figure).
  total += Number(userDeductions['80CCD2']) || 0;
  return total;
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
  } = inputs;

  // Standard deduction only applies against salary income
  const stdDed = salary > 0 ? standardDeduction(regime) : 0;
  const salaryAfterStd = Math.max(0, salary - stdDed);

  // Gross Total Income = sum of heads (excludes special-rate gains)
  const gti = salaryAfterStd + businessIncome + housePropertyIncome + otherSources;

  // Chapter VI-A deductions (only under old regime for most; §80CCD(2) always)
  const allowedDeductions = computeAllowedDeductions(deductions, regime);

  // Total taxable income under normal slabs
  const taxableIncome = Math.max(0, gti - allowedDeductions);

  // Slab tax on normal income
  const slabs = regime === 'new' ? NEW_REGIME_SLABS : OLD_REGIME_SLABS;
  const slabTax = computeSlabTax(taxableIncome, slabs);

  // Special-rate taxes
  const stcgTax = round2(stcgAtSpecialRate * 0.15);
  const ltcgTaxable = Math.max(0, ltcgAtSpecialRate - 100_000); // ₹1L exempt under §112A
  const ltcgTax = round2(ltcgTaxable * 0.10);

  const taxBeforeRebate = slabTax + stcgTax + ltcgTax;

  // Rebate under 87A only applies to normal slab tax, not special-rate
  const rebate = computeRebate87A(taxableIncome, slabTax, regime);
  const taxAfterRebate = Math.max(0, taxBeforeRebate - rebate);

  // Total income for surcharge tier (includes special-rate income)
  const totalIncomeForSurcharge = taxableIncome + stcgAtSpecialRate + ltcgAtSpecialRate;
  const surcharge = computeSurcharge(taxAfterRebate, totalIncomeForSurcharge, regime);

  const cess = computeCess(taxAfterRebate + surcharge);
  const totalTax = round2(taxAfterRebate + surcharge + cess);

  return {
    // Inputs echoed for the summary
    grossTotalIncome: round2(gti),
    salaryAfterStd: round2(salaryAfterStd),
    standardDeduction: round2(stdDed),
    allowedDeductions: round2(allowedDeductions),
    taxableIncome: round2(taxableIncome),

    // Computation steps
    slabTax: round2(slabTax),
    stcgTax: round2(stcgTax),
    ltcgTax: round2(ltcgTax),
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
 *   - Heavy (> 12,000 kg gross weight): ₹1,000 per tonne
 *   - Light: ₹7,500
 */
export function compute44AE({ heavyVehicleMonths = 0, heavyVehicleTonnage = 0, lightVehicleMonths = 0, declaredIncome }) {
  const heavy = round2(Number(heavyVehicleMonths) * Number(heavyVehicleTonnage) * 1000);
  const light = round2(Number(lightVehicleMonths) * 7500);
  const deemed = heavy + light;
  const finalIncome = Math.max(deemed, Number(declaredIncome) || 0);
  return {
    heavyIncome: heavy,
    lightIncome: light,
    deemedIncome: deemed,
    presumptiveIncome: round2(finalIncome),
    section: '44AE',
    notes: [],
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
 * Advance-tax installment schedule for FY 2024-25.
 * Each entry: due date + cumulative % of total tax to have paid by that date.
 */
export const ADVANCE_TAX_SCHEDULE = [
  { installment: 1, dueDate: '2024-06-15', cumulativePct: 0.15, label: 'By 15 June' },
  { installment: 2, dueDate: '2024-09-15', cumulativePct: 0.45, label: 'By 15 Sept' },
  { installment: 3, dueDate: '2024-12-15', cumulativePct: 0.75, label: 'By 15 Dec' },
  { installment: 4, dueDate: '2025-03-15', cumulativePct: 1.00, label: 'By 15 March' },
];

/**
 * Compute the advance-tax schedule.
 * @param {number} totalTax — total tax liability for the FY (after §87A rebate)
 * @param {number} tdsAlreadyDeducted — TDS credit already claimed
 * @param {Array<{date:string, amount:number}>} paid — installments already paid
 * @param {'regular'|'presumptive'} mode — presumptive allows single 15-Mar payment
 * @returns {object}
 */
export function computeAdvanceTaxSchedule(totalTax, tdsAlreadyDeducted = 0, paid = [], mode = 'regular') {
  const netLiability = Math.max(0, totalTax - (Number(tdsAlreadyDeducted) || 0));
  if (netLiability < 10_000) {
    return {
      netLiability, applies: false,
      note: 'Net liability (after TDS) is below ₹10,000 — no advance tax required.',
      schedule: [],
    };
  }
  // Presumptive-mode assessees: single 100% installment on 15 March
  const rows = (mode === 'presumptive' ? [ADVANCE_TAX_SCHEDULE[3]] : ADVANCE_TAX_SCHEDULE)
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
  };
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
  // Presumptive: single installment at 15-Mar, 1 month × 1% on shortfall.
  if (schedule.mode === 'presumptive' || schedule.schedule.length === 1) {
    const only = schedule.schedule[0];
    const shortfall = round2(netLiab - (only?.totalPaidByDue || 0));
    return round2(Math.max(0, shortfall) * 0.01);
  }
  let interest = 0;
  const [i1, i2, i3, i4] = schedule.schedule;
  if (i1 && i1.totalPaidByDue < 0.12 * netLiab) {
    const shortfall = round2(netLiab * 0.15 - i1.totalPaidByDue);
    interest += Math.max(0, shortfall) * 0.03;
  }
  if (i2 && i2.totalPaidByDue < 0.36 * netLiab) {
    const shortfall = round2(netLiab * 0.45 - i2.totalPaidByDue);
    interest += Math.max(0, shortfall) * 0.03;
  }
  if (i3) {
    const shortfall = round2(netLiab * 0.75 - i3.totalPaidByDue);
    interest += Math.max(0, shortfall) * 0.03;
  }
  if (i4) {
    const shortfall = round2(netLiab - i4.totalPaidByDue);
    interest += Math.max(0, shortfall) * 0.01;
  }
  return round2(interest);
}

/**
 * Section 234B interest — for shortfall of ≥ 10% of total tax by 31 Mar.
 * 1% per month from 1 Apr of the AY until date of payment.
 * @param {object} schedule — output of computeAdvanceTaxSchedule
 * @param {string} assessmentPaymentDate — ISO date; defaults to today
 */
export function compute234BInterest(schedule, assessmentPaymentDate) {
  if (!schedule.applies) return 0;
  const paidByYearEnd = schedule.totalPaid;
  const netLiab = schedule.netLiability;
  if (paidByYearEnd >= 0.9 * netLiab) return 0;
  const shortfall = round2(netLiab - paidByYearEnd);
  // From April 1 of AY. For FY 2024-25, that's 2025-04-01.
  const fyEnd = new Date('2025-04-01');
  const payDate = assessmentPaymentDate ? new Date(assessmentPaymentDate) : new Date();
  // v1.10.1 — Rule 119A: count calendar-month parts, not 30-day chunks.
  // Prior code: `Math.ceil((payDate - fyEnd) / (30 days))` over-counted
  // on the boundary (1-Apr → 31-May came out as 3 months instead of 2).
  // Same-day payment (payDate = fyEnd) charged for 1 month with no time
  // elapsed via `Math.max(1, ...)` — now handled via ms>0 check.
  if (payDate <= fyEnd) return 0;
  const yearDiff = payDate.getFullYear() - fyEnd.getFullYear();
  const monthDiff = payDate.getMonth() - fyEnd.getMonth();
  let months = yearDiff * 12 + monthDiff;
  // If payment date is later in its month than fyEnd (2025-04-01), the
  // partial month counts as one full month per Rule 119A.
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
