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
  '80D':     100_000,   // Health insurance: ₹25k self+family + ₹25-50k parents (senior)
  '80TTA':   10_000,    // Savings-account interest (individuals below 60)
  '80TTB':   50_000,    // Bank/PO deposit interest (senior citizens 60+)
  '80E':     Infinity,  // Education loan interest — no cap, 8-year max claim
  '80G':     Infinity,  // Donations — 50% or 100% of qualifying, subject to limits
  '80GG':    60_000,    // Rent paid when HRA not received (min 25% of AGI - rent-10%AGI - ₹5000/month)
  '80DDB':   100_000,   // Specified serious illness (₹1L for seniors, ₹40k otherwise)
  '80U':     125_000,   // Self-disability (₹75k / ₹1.25L for severe)
  '24b':     200_000,   // Home-loan interest on self-occupied property
};

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
 */
export function computeSurcharge(tax, totalIncome, regime = 'new') {
  if (!Number.isFinite(totalIncome)) return 0;
  if (totalIncome <= 5_000_000) return 0;                 // ≤ ₹50L
  if (totalIncome <= 10_000_000) return round2(tax * 0.10); // > ₹50L to ₹1Cr
  if (totalIncome <= 20_000_000) return round2(tax * 0.15); // > ₹1Cr to ₹2Cr
  if (totalIncome <= 50_000_000) return round2(tax * 0.25); // > ₹2Cr to ₹5Cr
  return round2(tax * (regime === 'new' ? 0.25 : 0.37));   // > ₹5Cr
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
