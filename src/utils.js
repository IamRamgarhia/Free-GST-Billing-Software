export const numberToWords = (num) => {
  if (num === 0) return 'Zero Rupees Only';

  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertToWords = (n) => {
    if (n < 20) return a[n];
    return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
  };

  const getIndianFormatString = (n) => {
    let res = '';
    const crore = Math.floor(n / 10000000);
    n -= crore * 10000000;
    const lakh = Math.floor(n / 100000);
    n -= lakh * 100000;
    const thousand = Math.floor(n / 1000);
    n -= thousand * 1000;
    const hundred = Math.floor(n / 100);
    n -= hundred * 100;

    if (crore > 0) res += convertToWords(crore) + ' Crore ';
    if (lakh > 0) res += convertToWords(lakh) + ' Lakh ';
    if (thousand > 0) res += convertToWords(thousand) + ' Thousand ';
    if (hundred > 0) res += convertToWords(hundred) + ' Hundred ';
    if (n > 0) res += (res !== '' ? 'and ' : '') + convertToWords(n);
    return res.trim();
  };

  const roundedNum = Math.round(num * 100) / 100;
  const rupees = Math.floor(roundedNum);
  const paise = Math.round((roundedNum - rupees) * 100);

  let result = getIndianFormatString(rupees) + ' Rupees';
  if (paise > 0) {
    result += ' and ' + getIndianFormatString(paise) + ' Paise';
  }
  return result + ' Only';
};

export const formatCurrency = (amount, currency = 'INR') => {
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency || 'INR',
    minimumFractionDigits: 2
  }).format(amount || 0);
};

// Compute the per-item tax breakdown.
// `taxInclusive=true` means rate already includes tax (MRP-style) — back-calculate the
// taxable value. This matches the bill form's "Prices include tax" toggle.
//
// Inputs are defensively coerced: `Number(...)` turns strings (from CSV import) into
// numbers; `isFinite` filters out NaN/Infinity; `Math.max(0, ...)` clamps negatives.
// The form clamps these at input time via `clampNonNeg`, but anyone calling the
// helper directly (e.g. CSV import, recurring template materialisation) gets the
// same safety net here.
const finiteNonNeg = (n) => {
  const x = Number(n);
  return isFinite(x) && x > 0 ? x : 0;
};

// v1.10.22 → v1.10.25 — Resolve a line's effective discount amount from
// the (discountType, discountBase) matrix.
//
//   discountType  ∈ { 'fixed' (default), 'percent' }
//   discountBase  ∈ { 'net' (default), 'unit', 'with-tax' }
//
// The RETURN VALUE is always the discount deducted from the line's net
// value (qty × rate) before tax, so the existing downstream tax /
// GSTR-1 / e-Way Bill code paths need no changes.
//
// Percent mode is base-agnostic (percent of net = percent of tax-inclusive
// pro-rated back to net = percent of unit-price × qty). Only fixed mode
// actually branches on base:
//
//   fixed + net       → raw amount as entered
//   fixed + unit      → raw × qty (₹X off each unit)
//   fixed + with-tax  → raw / (1 + taxRate/100)  (back out tax so the
//                       consumer's total-inclusive drops by exactly raw)
//
// Every branch is clamped to the line's net value so a discount can't
// exceed the line (which would produce a negative taxable value the
// GST portal rejects).
//
// Backward-compat: items without `discountBase` fall through to 'net',
// so pre-v1.10.25 bills render byte-identically.
export const resolveLineDiscount = (item = {}) => {
  const qty = finiteNonNeg(item.quantity);
  const rate = finiteNonNeg(item.rate);
  const net = qty * rate;
  const raw = finiteNonNeg(item.discount);
  if (raw <= 0 || net <= 0) return 0;

  if (item.discountType === 'percent') {
    return Math.min(net, (net * Math.min(raw, 100)) / 100);
  }

  // Fixed-mode routing based on discountBase.
  const base = item.discountBase || 'net';
  if (base === 'unit') {
    return Math.min(net, qty * raw);
  }
  if (base === 'with-tax') {
    const taxRate = finiteNonNeg(item.taxPercent);
    const divisor = 1 + taxRate / 100;
    return Math.min(net, divisor > 0 ? raw / divisor : raw);
  }
  // default: net-amount base
  return Math.min(net, raw);
};

export const calculateLineItemTax = (item = {}, taxInclusive = false) => {
  const qty = finiteNonNeg(item.quantity);
  const rate = finiteNonNeg(item.rate);
  const discount = resolveLineDiscount(item);
  const taxRate = finiteNonNeg(item.taxPercent);
  const amount = qty * rate;
  const grossAfterDiscount = Math.max(0, amount - discount); // discount can't exceed line value
  if (taxInclusive && taxRate > 0) {
    const afterDiscount = grossAfterDiscount / (1 + taxRate / 100);
    const taxAmount = grossAfterDiscount - afterDiscount;
    return { amount, discount, afterDiscount, taxAmount, total: grossAfterDiscount };
  }
  const afterDiscount = grossAfterDiscount;
  const taxAmount = (afterDiscount * taxRate) / 100;
  return { amount, discount, afterDiscount, taxAmount, total: afterDiscount + taxAmount };
};

// ============================================================================
// v1.10.1 — Pure invoice totals computation.
//
// Prior to this release, the totals math lived inside a giant `useEffect`
// in InvoiceGenerator.jsx (~120 lines). That made it impossible to
// unit-test and let several bugs go unnoticed for months:
//
//   • UTGST bucket never existed (audit C6). Intra-Chandigarh supplies
//     went into SGST instead of UTGST, breaking GSTR-1 filings.
//   • Interstate detection short-circuited to intra-state when the
//     business profile had no state saved (C5). Users on a fresh install
//     shipped invoices with wrong tax splits.
//   • RCM + tax-inclusive charged the buyer twice — once for the
//     embedded tax in the MRP, once for the RCM remittance (M5).
//   • TCS 206C(1H) computed on the pre-GST base, not the receipt
//     including GST as CBDT Circular 17/2020 requires (H6).
//   • ₹50 lakh annual per-counterparty threshold for TDS/TCS never
//     enforced — flat-rate applied from rupee one (H7).
//   • `totalTaxAmount` in saved bills omitted cess (M8).
//   • Non-numeric `rate` from CSV import produced `NaN` totals (M10).
//
// Extracting to a pure function fixes each of those. The React effect
// now just calls this and stores the result in state.
//
// @param opts {{
//   items: Array,            // line items with quantity, rate, discount, taxPercent, cessPercent
//   profile: object,         // { country, state, gstin, ... }
//   client: object,          // { state, isSEZ, gstin, ... }
//   details: object,         // { placeOfSupply, ... }
//   showGST: boolean,
//   taxInclusive?: boolean,
//   invoiceOptions?: {
//     reverseCharge?: boolean,
//     showRoundOff?: boolean,
//     showTDS?: boolean, tdsRate?: number, tdsCumulativeThisYear?: number,
//     showTCS?: boolean, tcsRate?: number, tcsCumulativeThisYear?: number,
//   },
// }}
// @returns totals object with { subtotal, totalDiscount, taxableAmount,
//   cgst, sgst, utgst, igst, cess, tcsAmount, tdsAmount, roundOff,
//   total, netReceivable, totalTaxAmount, warnings, needsProfileFix,
//   isInterstate, isUnionTerritory, taxInclusive }
// ============================================================================

// Section 194Q / 206C(1H) counterparty annual threshold — currently ₹50L.
// Both sections apply only to receipts above this cumulative amount per
// buyer / seller in a financial year.
export const TDS_TCS_THRESHOLD = 5_000_000;

// Sum of an array of numbers, coercing safely.
const sum = (arr) => arr.reduce((s, n) => s + (Number(n) || 0), 0);
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function computeInvoiceTotals(opts) {
  // v1.10.33 — Destructure defaults only fire on `undefined`, not `null`.
  // Callers that pass `profile: null` (e.g. InvoiceGenerator mounted
  // before the /api/profile fetch resolves) bypassed the `= {}` default
  // and blew up on `profile.country` reading null. Explicit `|| {}`
  // normalises both cases so the totals calc never crashes on cold load.
  const rawOpts = opts || {};
  const items = rawOpts.items || [];
  const profile = rawOpts.profile || {};
  const client = rawOpts.client || {};
  const details = rawOpts.details || {};
  const showGST = rawOpts.showGST !== false;
  const taxInclusive = !!rawOpts.taxInclusive;
  const invoiceOptions = rawOpts.invoiceOptions || {};

  const warnings = [];
  const isIndia = (profile.country || 'India') === 'India';

  // Per-line rounded values feed BOTH the invoice PDF and the GSTR-1
  // export so their totals agree. Prior code summed raw floats for one
  // and rounded per-line for the other → GSTN "amount_mismatch".
  const lines = items.map((item) => {
    const qty = finiteNonNeg(item.quantity);
    const rate = finiteNonNeg(item.rate);
    // v1.10.22 — read discount through resolveLineDiscount so percent-mode
    // items are computed correctly. Fixed-mode items behave identically.
    const disc = resolveLineDiscount(item);
    const taxPct = finiteNonNeg(item.taxPercent);
    const cessPct = finiteNonNeg(item.cessPercent);
    const gross = qty * rate;
    const afterDisc = Math.max(0, gross - disc);
    const taxable = (taxInclusive && taxPct > 0) ? afterDisc / (1 + taxPct / 100) : afterDisc;
    const tax = r2(taxable * taxPct / 100);
    const cess = showGST ? r2(taxable * cessPct / 100) : 0;
    return { qty, rate, disc, taxPct, cessPct, gross, afterDisc, taxable: r2(taxable), tax, cess };
  });

  const subtotal = r2(sum(lines.map(l => l.gross)));
  const totalDiscount = r2(sum(lines.map(l => l.disc)));
  const taxableAmount = r2(sum(lines.map(l => l.taxable)));
  const taxTotal = r2(sum(lines.map(l => l.tax)));
  const cessTotal = r2(sum(lines.map(l => l.cess)));

  // Place of supply / interstate detection.
  const businessState = (profile.state || '').trim();
  const clientState = (client.state || '').trim();
  const placeOfSupplyRaw = (details.placeOfSupply || clientState || '').trim();
  const businessCode = getStateCode(businessState || profile.gstin);
  const posCode = getStateCode(placeOfSupplyRaw || client.gstin);
  const isSEZ = !!client.isSEZ;

  // v1.10.1 — Explicit blank-business-state guard. Prior code let this
  // silently fall through to intra-state (undefined !== 'X' is true but
  // then compared against clientState.toLowerCase() which for blank
  // gives false → isInterstate=false wrongly). Now surface a warning
  // and set a needsProfileFix flag so the UI can block save.
  let needsProfileFix = false;
  if (isIndia && showGST && !businessState) {
    warnings.push('Your business state is not set. Interstate/intra-state detection cannot be trusted. Set it in Settings → Company Details before issuing GST invoices.');
    needsProfileFix = true;
  }
  if (isIndia && showGST && !placeOfSupplyRaw) {
    warnings.push('Place of supply is not set. Falling back to client state.');
  }

  const isInterstate = isIndia && (isSEZ || (
    !!businessCode && !!posCode && businessCode !== posCode
  ));

  // UTGST for intra-UT supplies. When supplier & recipient are BOTH in
  // one of the 5 UTs without legislature, and it's intra-state (same
  // code), CGST + UTGST applies. Otherwise → CGST + SGST or IGST.
  const isIntraUT = isIndia && !isInterstate && !!businessCode &&
    businessCode === posCode &&
    isUnionTerritoryWithoutLegislature(businessCode);

  const half = r2(taxTotal / 2);
  const cgst = isIndia && !isInterstate ? half : 0;
  const sgst = isIndia && !isInterstate && !isIntraUT ? half : 0;
  const utgst = isIndia && isIntraUT ? half : 0;
  const igst = isIndia ? (isInterstate ? taxTotal : 0) : taxTotal;

  // RCM handling. Under Section 9(3)/9(4), the SUPPLIER doesn't collect
  // tax — the buyer remits it directly. Invoice total should be
  // taxable value only (or MRP-taxable for inclusive mode).
  const isReverseCharge = !!invoiceOptions.reverseCharge && !!showGST;

  // v1.10.1 — RCM + tax-inclusive fix. Prior code used
  // `subtotal - totalDiscount` for baseTotal, which for tax-inclusive
  // rates is the MRP (includes tax) → buyer paid MRP to seller AND paid
  // tax to govt under RCM = double tax. Now: back out embedded tax so
  // baseTotal = taxable value only.
  const baseTotal = isReverseCharge
    ? taxableAmount
    : (taxInclusive && showGST ? subtotal - totalDiscount : taxableAmount + taxTotal);

  // v1.10.1 — TDS 194Q / TCS 206C(1H): correct BASE and enforce the
  // ₹50L threshold.
  //
  // Section 206C(1H) requires TCS on the *receipt including GST* per
  // CBDT Circular 17/2020. Prior code used pre-GST subtotal.
  // Section 194Q is the buyer-side mirror (deducted by buyer) — the
  // seller shouldn't collect it, so we treat it as INFORMATION-ONLY on
  // the invoice (doesn't change total).
  //
  // Threshold: neither section applies until the running annual
  // cumulative for this counterparty exceeds ₹50L. Caller passes
  // `tcsCumulativeThisYear` / `tdsCumulativeThisYear` (from a per-
  // client running total maintained in the Clients module).
  const tcsCumBefore = Number(invoiceOptions.tcsCumulativeThisYear) || 0;
  const tdsCumBefore = Number(invoiceOptions.tdsCumulativeThisYear) || 0;

  // The base at portal-facing gross (including GST).
  const receiptIncludingGst = r2(taxableAmount + taxTotal + cessTotal);

  // Portion of THIS invoice that sits above the ₹50L threshold. If the
  // cumulative was already ≥ threshold, whole invoice is taxable. If
  // it was below, only the excess portion attracts TCS.
  const marginalTcsBase = tcsCumBefore >= TDS_TCS_THRESHOLD
    ? receiptIncludingGst
    : Math.max(0, (tcsCumBefore + receiptIncludingGst) - TDS_TCS_THRESHOLD);
  const marginalTdsBase = tdsCumBefore >= TDS_TCS_THRESHOLD
    ? receiptIncludingGst
    : Math.max(0, (tdsCumBefore + receiptIncludingGst) - TDS_TCS_THRESHOLD);

  const tcsRate = Number(invoiceOptions.tcsRate) || 0;
  const tdsRate = Number(invoiceOptions.tdsRate) || 0;
  const tcsAmount = invoiceOptions.showTCS && tcsRate > 0
    ? r2(marginalTcsBase * tcsRate / 100) : 0;
  const tdsAmount = invoiceOptions.showTDS && tdsRate > 0
    ? r2(marginalTdsBase * tdsRate / 100) : 0;

  // v1.10.22 — invoice-level (whole-bill) discount. Treated as a cash
  // discount / trade allowance: subtracted from the post-tax total.
  // Doesn't affect taxable value or the GSTR-1 payload. Users who need
  // pre-tax GST-compliant discount should use per-line discount instead.
  const invDiscValue = finiteNonNeg(invoiceOptions.invoiceDiscountValue);
  const invDiscType = invoiceOptions.invoiceDiscountType === 'percent' ? 'percent' : 'fixed';
  // v1.10.31 — GST-C4: cess is also subject to RCM under §8(2) of the GST
  // Compensation Cess Act. Buyer remits it, so the seller must not collect
  // it on-invoice. Previously left in the total → buyer paid supplier's cess
  // AND remitted own → double payment.
  const cessOnInvoice = isReverseCharge ? 0 : cessTotal;
  const preInvDiscTotal = baseTotal + tcsAmount + cessOnInvoice;
  const invoiceDiscountAmount = invDiscType === 'percent'
    ? Math.min(preInvDiscTotal, r2(preInvDiscTotal * Math.min(invDiscValue, 100) / 100))
    : Math.min(preInvDiscTotal, r2(invDiscValue));

  const totalBeforeRound = preInvDiscTotal - invoiceDiscountAmount;
  const roundOff = invoiceOptions.showRoundOff
    ? r2(Math.round(totalBeforeRound) - totalBeforeRound)
    : 0;
  const total = r2(totalBeforeRound + roundOff);

  // Under RCM, portal-facing tax breakdown still shows on the PDF
  // (buyer needs to know what to remit) but zeros are stored in the
  // payable total's cgst/sgst/igst.
  const zeroTaxOnTotals = isReverseCharge;

  // v1.10.1 — totalTaxAmount now includes cess AND UTGST. Prior calc
  // `cgst + sgst + igst` excluded both. Reports over-counted revenue
  // for tobacco/auto/coal sellers.
  // v1.10.31 — GST-C4: under RCM, cess is also zeroed for reporting.
  const totalTaxAmount = r2(
    (zeroTaxOnTotals ? 0 : cgst) +
    (zeroTaxOnTotals ? 0 : sgst) +
    (zeroTaxOnTotals ? 0 : utgst) +
    (zeroTaxOnTotals ? 0 : igst) +
    (zeroTaxOnTotals ? 0 : cessTotal)
  );

  const result = {
    // Base composition
    subtotal, totalDiscount, taxableAmount,
    // Tax breakdown
    cgst: zeroTaxOnTotals ? 0 : cgst,
    sgst: zeroTaxOnTotals ? 0 : sgst,
    utgst: zeroTaxOnTotals ? 0 : utgst,
    igst: zeroTaxOnTotals ? 0 : igst,
    cess: cessTotal,
    // Additions on top
    tcsAmount, tdsAmount, roundOff,
    // v1.10.22 — invoice-level (post-tax) discount amount + type + raw
    // value carried through so the preview / PDF can show its own line.
    invoiceDiscountAmount, invoiceDiscountType: invDiscType, invoiceDiscountValue: invDiscValue,
    // Grand
    total,
    netReceivable: r2(total - tdsAmount),
    totalTaxAmount,
    // Meta flags for the UI
    isInterstate, isIntraUT, isUnionTerritory: isIntraUT,
    taxInclusive: !!(taxInclusive && showGST),
    warnings, needsProfileFix,
    // Per-line rounded values (for GSTR-1 / E-Way Bill agreement)
    lines,
  };

  if (isReverseCharge) {
    result.rcmTaxCgst = cgst;
    result.rcmTaxSgst = sgst;
    result.rcmTaxUtgst = utgst;
    result.rcmTaxIgst = igst;
    result.rcmTaxTotal = r2(cgst + sgst + utgst + igst);
  }

  return result;
}

// Invoice type configuration
export const INVOICE_TYPES = {
  'tax-invoice': {
    label: 'Tax Invoice',
    prefix: 'INV',
    title: 'TAX INVOICE',
    showGST: true,
    description: 'Standard GST tax invoice',
  },
  'proforma': {
    label: 'Proforma / Estimate',
    prefix: 'EST',
    title: 'PROFORMA INVOICE',
    showGST: true,
    description: 'Quotation or estimate — not a legal tax document',
  },
  'bill-of-supply': {
    label: 'Bill of Supply (No GST)',
    prefix: 'BOS',
    title: 'BILL OF SUPPLY',
    showGST: false,
    description: 'For exempt goods/services or non-composition dealers selling exempt supplies',
  },
  'composition': {
    label: 'Composition (Bill of Supply)',
    prefix: 'COMP',
    title: 'BILL OF SUPPLY',
    showGST: false,
    description: 'For composition-scheme dealers under Section 10. Auto-adds Rule 46A declaration.',
  },
  'credit-note': {
    label: 'Credit Note',
    prefix: 'CN',
    title: 'CREDIT NOTE',
    showGST: true,
    description: 'Issued for returns, price adjustments, or corrections',
  },
  'delivery-challan': {
    label: 'Delivery Challan',
    prefix: 'DC',
    title: 'DELIVERY CHALLAN',
    showGST: false,
    description: 'For goods transport, job work, or supply on approval — not a tax document',
  },
};

// Indian states list for dropdowns
export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

// US States + DC
export const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware',
  'Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky',
  'Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi',
  'Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico',
  'New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania',
  'Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
  'Virginia','Washington','West Virginia','Wisconsin','Wyoming','District of Columbia'
];

// Canada Provinces & Territories
export const CANADA_PROVINCES = [
  'Alberta','British Columbia','Manitoba','New Brunswick','Newfoundland and Labrador',
  'Northwest Territories','Nova Scotia','Nunavut','Ontario','Prince Edward Island',
  'Quebec','Saskatchewan','Yukon'
];

// Australia States & Territories
export const AUSTRALIA_STATES = [
  'New South Wales','Victoria','Queensland','South Australia',
  'Western Australia','Tasmania','Australian Capital Territory','Northern Territory'
];

// Returns states/provinces list for a country, or [] if free-text is better
export const getStatesForCountry = (countryName) => {
  switch (countryName) {
    case 'India': return INDIAN_STATES;
    case 'United States': return US_STATES;
    case 'Canada': return CANADA_PROVINCES;
    case 'Australia': return AUSTRALIA_STATES;
    default: return [];
  }
};

// ========== Country Configuration ==========
// Each entry: { name, code, currency, currencySymbol, taxLabel, taxIdLabel, taxIdPlaceholder, bankLabel, postalLabel, stateLabel, hasStates, taxRates, taxIdRegex }
// taxRates: common rates for that country's tax dropdown (always allow custom entry)
// taxIdRegex: optional pattern for soft validation (warning only, never blocks save)
export const COUNTRIES = [
  { name: 'India', code: 'IN', currency: 'INR', currencySymbol: '₹', taxLabel: 'GST', taxIdLabel: 'GSTIN', taxIdPlaceholder: '22AAAAA0000A1Z5', bankLabel: 'IFSC Code', postalLabel: 'PIN Code', stateLabel: 'State', hasStates: true, taxRates: [0, 0.1, 0.25, 3, 5, 12, 18, 28], taxIdRegex: /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z][A-Z\d]$/ },
  { name: 'United Arab Emirates', code: 'AE', currency: 'AED', currencySymbol: 'AED', taxLabel: 'VAT', taxIdLabel: 'TRN', taxIdPlaceholder: '100123456700003', bankLabel: 'IBAN', postalLabel: 'Postal Code', stateLabel: 'Emirate', hasStates: false, taxRates: [0, 5], taxIdRegex: /^\d{15}$/ },
  { name: 'United States', code: 'US', currency: 'USD', currencySymbol: '$', taxLabel: 'Sales Tax', taxIdLabel: 'EIN / TIN', taxIdPlaceholder: '12-3456789', bankLabel: 'Routing Number', postalLabel: 'ZIP Code', stateLabel: 'State', hasStates: false, taxRates: [0, 4, 6, 7, 8, 9, 10], taxIdRegex: /^\d{2}-?\d{7}$/ },
  { name: 'United Kingdom', code: 'GB', currency: 'GBP', currencySymbol: '£', taxLabel: 'VAT', taxIdLabel: 'VAT Number', taxIdPlaceholder: 'GB123456789', bankLabel: 'Sort Code', postalLabel: 'Postcode', stateLabel: 'County', hasStates: false, taxRates: [0, 5, 20], taxIdRegex: /^GB\d{9}(\d{3})?$/i },
  { name: 'Australia', code: 'AU', currency: 'AUD', currencySymbol: 'A$', taxLabel: 'GST', taxIdLabel: 'ABN', taxIdPlaceholder: '12 345 678 901', bankLabel: 'BSB Number', postalLabel: 'Postcode', stateLabel: 'State/Territory', hasStates: false, taxRates: [0, 10], taxIdRegex: /^\d{2}\s?\d{3}\s?\d{3}\s?\d{3}$/ },
  { name: 'Canada', code: 'CA', currency: 'CAD', currencySymbol: 'CA$', taxLabel: 'GST/HST', taxIdLabel: 'GST/HST Number', taxIdPlaceholder: '123456789 RT 0001', bankLabel: 'Transit Number', postalLabel: 'Postal Code', stateLabel: 'Province', hasStates: false, taxRates: [0, 5, 13, 15], taxIdRegex: /^\d{9}\s?(RT)\s?\d{4}$/i },
  { name: 'Singapore', code: 'SG', currency: 'SGD', currencySymbol: 'S$', taxLabel: 'GST', taxIdLabel: 'GST Reg No.', taxIdPlaceholder: 'M12345678X', bankLabel: 'Bank Code', postalLabel: 'Postal Code', stateLabel: 'Region', hasStates: false, taxRates: [0, 9], taxIdRegex: /^[MTFG]\d{7,8}[A-Z]$/i },
  { name: 'Malaysia', code: 'MY', currency: 'MYR', currencySymbol: 'RM', taxLabel: 'SST', taxIdLabel: 'SST No.', taxIdPlaceholder: 'W10-1234-56789012', bankLabel: 'Bank Code', postalLabel: 'Postcode', stateLabel: 'State', hasStates: false, taxRates: [0, 6, 8, 10] },
  { name: 'Germany', code: 'DE', currency: 'EUR', currencySymbol: '€', taxLabel: 'MwSt', taxIdLabel: 'USt-IdNr.', taxIdPlaceholder: 'DE123456789', bankLabel: 'IBAN', postalLabel: 'PLZ', stateLabel: 'Bundesland', hasStates: false, taxRates: [0, 7, 19], taxIdRegex: /^DE\d{9}$/i },
  { name: 'France', code: 'FR', currency: 'EUR', currencySymbol: '€', taxLabel: 'TVA', taxIdLabel: 'N° TVA', taxIdPlaceholder: 'FR12345678901', bankLabel: 'IBAN', postalLabel: 'Code Postal', stateLabel: 'Région', hasStates: false, taxRates: [0, 5.5, 10, 20], taxIdRegex: /^FR[A-Z\d]{2}\d{9}$/i },
  { name: 'Netherlands', code: 'NL', currency: 'EUR', currencySymbol: '€', taxLabel: 'BTW', taxIdLabel: 'BTW-nummer', taxIdPlaceholder: 'NL123456789B01', bankLabel: 'IBAN', postalLabel: 'Postcode', stateLabel: 'Provincie', hasStates: false, taxRates: [0, 9, 21], taxIdRegex: /^NL\d{9}B\d{2}$/i },
  { name: 'South Africa', code: 'ZA', currency: 'ZAR', currencySymbol: 'R', taxLabel: 'VAT', taxIdLabel: 'VAT Number', taxIdPlaceholder: '4123456789', bankLabel: 'Branch Code', postalLabel: 'Postal Code', stateLabel: 'Province', hasStates: false, taxRates: [0, 15], taxIdRegex: /^4\d{9}$/ },
  { name: 'Nigeria', code: 'NG', currency: 'NGN', currencySymbol: '₦', taxLabel: 'VAT', taxIdLabel: 'TIN', taxIdPlaceholder: '12345678-0001', bankLabel: 'Bank Code', postalLabel: 'Postal Code', stateLabel: 'State', hasStates: false, taxRates: [0, 7.5] },
  { name: 'Kenya', code: 'KE', currency: 'KES', currencySymbol: 'KSh', taxLabel: 'VAT', taxIdLabel: 'KRA PIN', taxIdPlaceholder: 'A123456789Z', bankLabel: 'Bank Code', postalLabel: 'Postal Code', stateLabel: 'County', hasStates: false, taxRates: [0, 8, 16], taxIdRegex: /^[A-Z]\d{9}[A-Z]$/i },
  { name: 'Saudi Arabia', code: 'SA', currency: 'SAR', currencySymbol: 'SAR', taxLabel: 'VAT', taxIdLabel: 'VAT Number', taxIdPlaceholder: '300012345600003', bankLabel: 'IBAN', postalLabel: 'Postal Code', stateLabel: 'Region', hasStates: false, taxRates: [0, 15], taxIdRegex: /^3\d{14}$/ },
  { name: 'Nepal', code: 'NP', currency: 'NPR', currencySymbol: 'Rs', taxLabel: 'VAT', taxIdLabel: 'PAN/VAT No.', taxIdPlaceholder: '123456789', bankLabel: 'Bank Code', postalLabel: 'Postal Code', stateLabel: 'Province', hasStates: false, taxRates: [0, 13] },
  { name: 'Bangladesh', code: 'BD', currency: 'BDT', currencySymbol: '৳', taxLabel: 'VAT', taxIdLabel: 'BIN', taxIdPlaceholder: '123456789-0101', bankLabel: 'Bank Code', postalLabel: 'Postal Code', stateLabel: 'Division', hasStates: false, taxRates: [0, 5, 7.5, 10, 15] },
  { name: 'Sri Lanka', code: 'LK', currency: 'LKR', currencySymbol: 'Rs', taxLabel: 'VAT', taxIdLabel: 'VAT Reg No.', taxIdPlaceholder: '123456789-7000', bankLabel: 'Bank Code', postalLabel: 'Postal Code', stateLabel: 'Province', hasStates: false, taxRates: [0, 18] },
  { name: 'Pakistan', code: 'PK', currency: 'PKR', currencySymbol: 'Rs', taxLabel: 'GST', taxIdLabel: 'NTN', taxIdPlaceholder: '1234567-8', bankLabel: 'Bank Code', postalLabel: 'Postal Code', stateLabel: 'Province', hasStates: false, taxRates: [0, 5, 10, 17, 18] },
  { name: 'Philippines', code: 'PH', currency: 'PHP', currencySymbol: '₱', taxLabel: 'VAT', taxIdLabel: 'TIN', taxIdPlaceholder: '123-456-789-000', bankLabel: 'Bank Code', postalLabel: 'ZIP Code', stateLabel: 'Region', hasStates: false, taxRates: [0, 12] },
  { name: 'Indonesia', code: 'ID', currency: 'IDR', currencySymbol: 'Rp', taxLabel: 'PPN', taxIdLabel: 'NPWP', taxIdPlaceholder: '12.345.678.9-012.000', bankLabel: 'Bank Code', postalLabel: 'Kode Pos', stateLabel: 'Provinsi', hasStates: false, taxRates: [0, 11, 12] },
  { name: 'New Zealand', code: 'NZ', currency: 'NZD', currencySymbol: 'NZ$', taxLabel: 'GST', taxIdLabel: 'GST Number', taxIdPlaceholder: '123-456-789', bankLabel: 'Bank Branch', postalLabel: 'Postcode', stateLabel: 'Region', hasStates: false, taxRates: [0, 15] },
  { name: 'Other', code: 'XX', currency: 'USD', currencySymbol: '$', taxLabel: 'Tax', taxIdLabel: 'Tax ID', taxIdPlaceholder: 'Your tax registration number', bankLabel: 'Bank Routing', postalLabel: 'Postal Code', stateLabel: 'State/Region', hasStates: false, taxRates: [0, 5, 10, 15, 20] },
];

export const getCountryConfig = (countryName) => {
  if (!countryName) return COUNTRIES[0]; // default India
  return COUNTRIES.find(c => c.name === countryName) || COUNTRIES.find(c => c.code === countryName) || COUNTRIES[COUNTRIES.length - 1];
};

// Filter the country list according to the user's region preference.
// 'india' → only India + a synthetic "Other" entry as escape hatch.
// 'international' → everything except India.
// 'both' (default) → all 22 countries.
export const getCountriesForRegion = (regionMode = 'both') => {
  if (regionMode === 'india') {
    return COUNTRIES.filter(c => c.name === 'India' || c.name === 'Other');
  }
  if (regionMode === 'international') {
    return COUNTRIES.filter(c => c.name !== 'India');
  }
  return COUNTRIES;
};

// GST State Codes (as per GST portal) — used in GSTR-1 JSON export
const GST_STATE_CODES = {
  'jammu and kashmir': '01', 'himachal pradesh': '02', 'punjab': '03',
  'chandigarh': '04', 'uttarakhand': '05', 'haryana': '06',
  'delhi': '07', 'rajasthan': '08', 'uttar pradesh': '09',
  'bihar': '10', 'sikkim': '11', 'arunachal pradesh': '12',
  'nagaland': '13', 'manipur': '14', 'mizoram': '15',
  'tripura': '16', 'meghalaya': '17', 'assam': '18',
  'west bengal': '19', 'jharkhand': '20', 'odisha': '21',
  'chhattisgarh': '22', 'madhya pradesh': '23', 'gujarat': '24',
  'dadra and nagar haveli and daman and diu': '26', 'maharashtra': '27',
  'andhra pradesh': '37', 'karnataka': '29', 'goa': '30',
  'lakshadweep': '31', 'kerala': '32', 'tamil nadu': '33',
  'puducherry': '34', 'andaman and nicobar islands': '35',
  'telangana': '36', 'ladakh': '38',
};

// v1.10.31 — GST-H1: legacy codes normalized.
// AP was reorganised in June 2014; old GSTINs with prefix `28` (before
// bifurcation) should map to the current code `37` (Andhra Pradesh).
// Daman & Diu had legacy code `25` before the 2020 merger into DNH+DD (`26`).
// Without normalisation, a `28ABCDE…` GSTIN and the current state "Andhra
// Pradesh" produced different codes → interstate/intrastate mis-classification.
const LEGACY_STATE_CODE_MAP = { '28': '37', '25': '26' };

// Get 2-digit GST state code from state name or GSTIN
export const getStateCode = (stateOrGstin) => {
  if (!stateOrGstin) return '';
  const s = stateOrGstin.trim();
  // If it looks like a GSTIN (15 chars), extract first 2 digits
  if (/^\d{2}[A-Z0-9]{13}$/i.test(s)) {
    const prefix = s.substring(0, 2);
    return LEGACY_STATE_CODE_MAP[prefix] || prefix;
  }
  const code = GST_STATE_CODES[s.toLowerCase()] || '';
  return LEGACY_STATE_CODE_MAP[code] || code;
};

// v1.10.1 — Union Territories WITHOUT their own legislature use CGST +
// UTGST instead of CGST + SGST for intra-UT supplies. This is required
// by Chapter II of the GST Act and enforced by the GSTN portal.
//
// UTs WITH legislature (Delhi 07, Puducherry 34, J&K 01 post-2019) are
// treated as states — CGST + SGST as normal.
//
// The 5 UTs below are the ones that need UTGST. Codes are the 2-digit
// GST state code (matches getStateCode() output).
const UTS_WITHOUT_LEGISLATURE = new Set(['04', '26', '31', '35', '38']);
//                                        │      │      │      │      │
//    Chandigarh ─────────────────────────┘      │      │      │      │
//    Dadra & Nagar Haveli / Daman & Diu ────────┘      │      │      │
//    Lakshadweep ──────────────────────────────────────┘      │      │
//    Andaman & Nicobar Islands ───────────────────────────────┘      │
//    Ladakh ─────────────────────────────────────────────────────────┘
export const isUnionTerritoryWithoutLegislature = (stateCode) => {
  if (!stateCode) return false;
  return UTS_WITHOUT_LEGISLATURE.has(String(stateCode).padStart(2, '0'));
};

// Format date as DD-MM-YYYY (GST portal format).
// Guard against malformed input — `new Date("2026-13-45")` is an Invalid Date
// whose getDate() returns NaN, producing "NaN-NaN-NaN" in GSTR-1 export rows.
export const formatDateGST = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

// Generate E-Way Bill JSON (NIC portal format).
// Throws a friendly error if the seller isn't registered in India — E-Way Bill is an Indian
// GST-portal artifact and the JSON schema (state codes, CGST/SGST/IGST split) is meaningless
// for foreign invoices.
//
// Per the NIC schema, supplyType is the *direction* of the supply (O=Outward, I=Inward),
// NOT inter/intra-state. Seller-issued bills are always 'O'. The intra/inter-state
// distinction is captured by comparing fromStateCode and toStateCode.
//
// v1.10.1 — added `opts.taxInclusive` so the per-line taxable and header
// totalValue back-calculate correctly when the invoice is MRP-inclusive.
// Prior code hard-coded `taxable = qty*rate - discount` which reported
// the MRP (post-tax) value as taxable → the portal's own tax-consistency
// check (`taxableValue + tax ≈ totInvValue`) failed → E-Way Bill rejected.
export const generateEWayBillJSON = (profile, client, details, items, totals, invoiceType, opts = {}) => {
  if (profile?.country && profile.country !== 'India') {
    throw new Error('E-Way Bill is an Indian GST portal feature. Set business country to "India" in Settings to enable it.');
  }
  const taxInclusive = !!opts.taxInclusive;
  const fromStateCode = getStateCode(profile.state || profile.gstin);
  const toStateCode = getStateCode(client.state || client.gstin);
  const isInterstate = fromStateCode && toStateCode && fromStateCode !== toStateCode;

  // Pincodes are mandatory (the portal rejects 0). Try profile.pin / client.pin first,
  // then fall back to extracting digits from address. If still missing, throw — the user
  // must fill the field rather than submit a guaranteed-rejected payload.
  const extractPin = (obj) => {
    const direct = String(obj?.pin || obj?.pincode || '').replace(/\D/g, '');
    if (direct.length === 6) return Number(direct);
    const fromAddr = String(obj?.address || '').match(/\b(\d{6})\b/);
    return fromAddr ? Number(fromAddr[1]) : 0;
  };
  const fromPincode = extractPin(profile);
  const toPincode = extractPin(client);
  if (!fromPincode) throw new Error('Your business PIN code is required for the E-Way Bill. Set it in Settings → Company Details.');
  if (!toPincode) throw new Error("Client PIN code is required for the E-Way Bill. Add it in the client's address.");

  const itemList = items.map((item, idx) => {
    // v1.10.1 — back-calculate taxable when the invoice is MRP-inclusive.
    // v1.10.22 — honour discountType (percent | fixed).
    // v1.10.31 — GST-C5: cess rate now populated per item (was 0).
    const gross = (Number(item.quantity) || 0) * (Number(item.rate) || 0) - resolveLineDiscount(item);
    const taxRate = Number(item.taxPercent) || 0;
    const cessRate = Number(item.cessPercent) || 0;
    const taxable = taxInclusive && taxRate > 0
      ? gross / (1 + taxRate / 100)
      : gross;
    return {
      itemNo: idx + 1,
      productName: item.name || '',
      productDesc: item.name || '',
      hsnCode: Number(item.hsn) || 0,
      quantity: item.quantity || 0,
      qtyUnit: getUnitUQC(item.unit),
      taxableAmount: Math.round(taxable * 100) / 100,
      cgstRate: isInterstate ? 0 : taxRate / 2,
      sgstRate: isInterstate ? 0 : taxRate / 2,
      igstRate: isInterstate ? taxRate : 0,
      cessRate,
    };
  });

  return {
    version: '1.0.1221',
    billLists: [{
      userGstin: profile.gstin || '',
      supplyType: 'O', // Outward — seller-issued. Always O regardless of intra/inter-state.
      subSupplyType: 1, // 1=Supply
      docType: invoiceType === 'delivery-challan' ? 'CHL' : 'INV',
      docNo: details.invoiceNumber || '',
      docDate: formatDateGST(details.invoiceDate),
      fromGstin: profile.gstin || '',
      fromAddr1: (profile.address || '').substring(0, 120),
      fromPlace: profile.city || profile.state || '',
      fromPincode: fromPincode,
      fromStateCode: Number(fromStateCode) || 0,
      toGstin: client.gstin || 'URP',
      toAddr1: (client.address || '').substring(0, 120),
      toPlace: client.city || client.state || '',
      toPincode: toPincode,
      toStateCode: Number(toStateCode) || 0,
      // v1.10.1 — When tax-inclusive, subtotal is MRP-inclusive; the
      // pre-tax totalValue must back out the embedded tax. Prefer
      // totals.taxableAmount which computeInvoiceTotals fills correctly
      // for both modes; fall back to the old calc for legacy callers.
      totalValue: Math.round(((totals.taxableAmount != null ? totals.taxableAmount : (totals.subtotal - totals.totalDiscount))) * 100) / 100,
      cgstValue: Math.round((totals.cgst || 0) * 100) / 100,
      // v1.10.31 — GST-H7: UTGST folded into sgstValue bucket (NIC portal
      // has no separate UTGST field; sum must reconcile with totInvValue).
      sgstValue: Math.round(((totals.sgst || 0) + (totals.utgst || 0)) * 100) / 100,
      igstValue: Math.round((totals.igst || 0) * 100) / 100,
      // v1.10.31 — GST-C5: cess populated (was hardcoded 0 → NIC portal
      // rejected any invoice with cess for total-consistency mismatch).
      cessValue: Math.round((totals.cess || 0) * 100) / 100,
      totInvValue: Math.round(totals.total * 100) / 100,
      transMode: 1, // 1=Road
      // v1.10.31 — GST-C5: distance must be >= 1 (portal rejects 0). Caller
      // can pass `opts.distance`. If unset we default to 1 (minimum valid).
      transDistance: Math.max(1, Number(opts.distance) || 1),
      transporterName: '',
      transporterId: '',
      transDocNo: '',
      transDocDate: '',
      vehicleNo: '',
      vehicleType: 'R', // R=Regular
      itemList: itemList,
    }]
  };
};

// Upcoming Indian GST / TDS filing due dates relative to `today`. Returns an
// ordered list capped at 60 days out so the notifications centre doesn't show
// 3-month-distant items as "due soon".
//
// Cadence (monthly filer; QRMP / quarterly users will see the same dates but
// only need to act on their schedule):
//   GSTR-1   — 11th of the following month
//   GSTR-3B  — 20th of the following month
//   Form 26Q — 31st of the month following quarter end (Jul / Oct / Jan / Apr)
//   Form 27EQ — 15th of the month following quarter end
export const getUpcomingFilings = (today = new Date()) => {
  const out = [];
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const push = (label, dueDate) => {
    const diff = Math.round((dueDate - t) / 86400000);
    if (diff >= 0 && diff <= 60) out.push({ label, dueDate: dueDate.toISOString().split('T')[0], daysAway: diff });
  };
  // Iterate next 3 months so we catch upcoming month-end deadlines.
  for (let i = 0; i < 3; i++) {
    const nextMonth = new Date(t.getFullYear(), t.getMonth() + i, 1);
    const m = nextMonth.getMonth();
    const y = nextMonth.getFullYear();
    push(`GSTR-1 (${nextMonth.toLocaleString('en-IN', { month: 'short', year: 'numeric' })})`, new Date(y, m + 1, 11));
    push(`GSTR-3B (${nextMonth.toLocaleString('en-IN', { month: 'short', year: 'numeric' })})`, new Date(y, m + 1, 20));
    // Quarterly TDS / TCS — applies to the quarter the month falls into.
    const quarterEnd = m % 3 === 2; // Mar / Jun / Sep / Dec
    if (quarterEnd) {
      push(`Form 26Q (TDS Q ending ${nextMonth.toLocaleString('en-IN', { month: 'short' })})`, new Date(y, m + 2, 0)); // last day of next month after quarter
      push(`Form 27EQ (TCS Q ending ${nextMonth.toLocaleString('en-IN', { month: 'short' })})`, new Date(y, m + 1, 15));
    }
  }

  // Advance-tax installments — same 60-day lookahead. Users on the presumptive
  // scheme (single 15-Mar payment) still see all four so they can plan cashflow,
  // but the interest calc only fires against the 15-Mar row.
  const advDates = [
    { label: 'Advance Tax Installment 1 (15% cumulative)', date: new Date(t.getFullYear(), 5, 15) },   // 15 Jun
    { label: 'Advance Tax Installment 2 (45% cumulative)', date: new Date(t.getFullYear(), 8, 15) },   // 15 Sep
    { label: 'Advance Tax Installment 3 (75% cumulative)', date: new Date(t.getFullYear(), 11, 15) },  // 15 Dec
    { label: 'Advance Tax Installment 4 (100% — final)',    date: new Date(t.getFullYear() + (t.getMonth() >= 2 ? 1 : 0), 2, 15) }, // 15 Mar
  ];
  advDates.forEach(a => push(a.label, a.date));

  // ITR filing due dates (annually)
  const itrYear = t.getMonth() >= 3 ? t.getFullYear() : t.getFullYear() - 1;
  push('ITR filing (non-audit) — due', new Date(itrYear + 1, 6, 31));  // 31 July
  push('ITR filing (audit / §44AB) — due', new Date(itrYear + 1, 9, 31)); // 31 Oct

  return out.sort((a, b) => a.daysAway - b.daysAway);
};

// ============================================================================
// Paper / print sizes
// ----------------------------------------------------------------------------
// Invoices can render at 4 different sizes. A4 is the default (matches the
// current preview + PDF). A5 is half a sheet — same layout, smaller. Thermal
// 80mm and 58mm are receipt-printer strips: single-column compact layout,
// monospace-style typography, no decorative panels.
//
// Each entry:
//   jsPdfFormat  — passed to `new jsPDF({ format })`. For custom sizes it's
//                  an array [widthMm, heightMm]. Thermal uses a large-ish
//                  fixed height because jsPDF needs to know the page size
//                  up-front; extra whitespace is fine on roll paper.
//   cssClass     — applied to the invoice-preview container so styles
//                  branch on size.
//   kind         — 'sheet' | 'thermal'. Thermal switches to a completely
//                  compact template.
// ============================================================================
// ============================================================================
// Paper / print sizes — comprehensive list covering thermal receipt rolls
// AND standard office paper sizes. Each entry declares:
//
//   widthMm         — CONTENT width (printable area, not physical paper).
//                     For thermal rolls, this is smaller than the physical
//                     paper because the print head has margins it can't
//                     reach (e.g. 58mm roll → 48mm printable).
//   heightMm        — Content height (portrait). Thermal uses a large
//                     placeholder height since roll paper is continuous.
//   jsPdfFormat     — Either a jsPDF preset ('a4'/'a5'/'letter'/'legal')
//                     or a custom [widthMm, heightMm] tuple for thermal.
//   jsPdfOrientation— 'portrait' or 'landscape'.
//   cssClass        — Added to invoice-preview-container.
//   kind            — 'sheet' (A4/A5/Letter/Legal) or 'thermal' (roll).
//
// v1.8.5: expanded coverage based on user-shared 58mm printer spec sheet
// (which showed 48mm printable area, not 58mm). Added US Letter, Legal,
// B5, and thermal 76mm / 112mm variants.
// ============================================================================
export const PAPER_SIZES = {
  // ---- Sheet paper (A4 family, Letter, Legal, B5) ------------------------
  a4: {
    label: 'A4 Portrait (default)',
    hint: 'Standard business invoice — 210 × 297 mm',
    widthMm: 210, heightMm: 297,
    jsPdfFormat: 'a4', jsPdfOrientation: 'portrait',
    cssClass: 'paper-a4',
    kind: 'sheet',
  },
  a4Landscape: {
    label: 'A4 Landscape',
    hint: 'Sideways A4 — 297 × 210 mm. More columns fit; useful for detailed itemized invoices.',
    widthMm: 297, heightMm: 210,
    jsPdfFormat: 'a4', jsPdfOrientation: 'landscape',
    cssClass: 'paper-a4-landscape',
    kind: 'sheet',
  },
  a5: {
    label: 'A5 Portrait (compact)',
    hint: 'Half sheet — 148 × 210 mm. Fits smaller printers.',
    widthMm: 148, heightMm: 210,
    jsPdfFormat: 'a5', jsPdfOrientation: 'portrait',
    cssClass: 'paper-a5',
    kind: 'sheet',
  },
  a5Landscape: {
    label: 'A5 Landscape (2 per A4 sheet)',
    hint: 'Sideways A5 — 210 × 148 mm. Print two invoices per A4 sheet.',
    widthMm: 210, heightMm: 148,
    jsPdfFormat: 'a5', jsPdfOrientation: 'landscape',
    cssClass: 'paper-a5-landscape',
    kind: 'sheet',
  },
  letter: {
    label: 'US Letter (216 × 279 mm)',
    hint: 'US / Canada / Mexico standard business size.',
    widthMm: 216, heightMm: 279,
    jsPdfFormat: 'letter', jsPdfOrientation: 'portrait',
    cssClass: 'paper-letter',
    kind: 'sheet',
  },
  legal: {
    label: 'US Legal (216 × 356 mm)',
    hint: 'Longer than Letter — useful for detailed invoices with many line items.',
    widthMm: 216, heightMm: 356,
    jsPdfFormat: 'legal', jsPdfOrientation: 'portrait',
    cssClass: 'paper-legal',
    kind: 'sheet',
  },
  b5: {
    label: 'B5 (176 × 250 mm)',
    hint: 'Between A5 and A4 — used in some Asian markets.',
    widthMm: 176, heightMm: 250,
    jsPdfFormat: 'b5', jsPdfOrientation: 'portrait',
    cssClass: 'paper-b5',
    kind: 'sheet',
  },

  // ---- Thermal rolls ------------------------------------------------------
  // widthMm = ACTUAL PRINTABLE area (per user's shared printer spec sheet:
  // 58mm roll has 48mm printable, 80mm roll typically has 72mm printable).
  // The jsPdfFormat width matches so the PDF page = printable area, and the
  // thermal driver naturally handles the physical roll margin.
  thermal80: {
    label: '80mm Thermal (POS receipt)',
    hint: '80 mm wide roll · ~72 mm printable area. Standard restaurant / retail POS printers (Epson TM, Star TSP, etc.).',
    widthMm: 72, heightMm: 297,
    jsPdfFormat: [72, 297], jsPdfOrientation: 'portrait',
    cssClass: 'paper-thermal-80',
    kind: 'thermal',
  },
  thermal76: {
    label: '76mm Thermal (kitchen printer)',
    hint: '76 mm wide roll · ~68 mm printable area. Older Epson / Bixolon kitchen printers.',
    widthMm: 68, heightMm: 297,
    jsPdfFormat: [68, 297], jsPdfOrientation: 'portrait',
    cssClass: 'paper-thermal-76',
    kind: 'thermal',
  },
  thermal58: {
    label: '58mm Thermal (compact / mobile)',
    hint: '58 mm wide roll · ~48 mm printable area (most common on 58mm printers). Portable / battery / bluetooth thermal.',
    widthMm: 48, heightMm: 297,
    jsPdfFormat: [48, 297], jsPdfOrientation: 'portrait',
    cssClass: 'paper-thermal-58',
    kind: 'thermal',
  },
  thermal112: {
    label: '112mm Thermal (wide receipt)',
    hint: '112 mm wide roll · ~104 mm printable area. Airline boarding passes, warehouse labels, wider receipts.',
    widthMm: 104, heightMm: 297,
    jsPdfFormat: [104, 297], jsPdfOrientation: 'portrait',
    cssClass: 'paper-thermal-112',
    kind: 'thermal',
  },

  // ---- Custom (user-specified dimensions) ---------------------------------
  // A single "custom" preset that reads its actual dimensions from
  // invoiceOptions.customPaperWidth / customPaperHeight. The Customize
  // panel exposes two number inputs when this is selected.
  custom: {
    label: 'Custom size (thermal / roll / stationery)',
    hint: 'Enter any width + height in mm. Widths under 100mm auto-switch to thermal receipt layout (same behaviour as 58 / 80mm presets). Use for 40mm / 76mm / 90mm rolls, or A6 / letter / label stationery.',
    widthMm: 210, heightMm: 297, // fallback defaults if the user hasn't set custom values yet
    jsPdfFormat: [210, 297], jsPdfOrientation: 'portrait',
    cssClass: 'paper-custom',
    kind: 'custom',
  },
};

// Resolve a paper-size config, applying custom dimensions if this is the
// "custom" preset. Callers can pass the invoiceOptions object as the
// second argument to get width/height overrides applied.
export const getPaperSize = (key, options = {}) => {
  const base = PAPER_SIZES[key] || PAPER_SIZES.a4;
  if (base.kind !== 'custom') return base;
  const w = Math.max(30, Math.min(500, Number(options.customPaperWidth) || 80));
  const h = Math.max(50, Math.min(1200, Number(options.customPaperHeight) || 297));
  // Custom paper defaults to thermal-style rendering when width < 100mm.
  const kind = w < 100 ? 'thermal' : 'sheet';
  return {
    ...base,
    widthMm: w, heightMm: h,
    jsPdfFormat: [w, h],
    kind,
    cssClass: kind === 'thermal' ? 'paper-thermal-custom' : 'paper-custom',
  };
};

// Fiscal-year dropdown options for the last N years. Was previously
// duplicated in 5 files (Dashboard / PurchaseBills / ExpenseTracker /
// GSTReturns / ReportsView) — extracted here so a bugfix only has to
// touch one place. Each entry: { value, label, from, to }.
export const getFYOptions = (n = 5, today = new Date()) => {
  const currentYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const options = [];
  for (let i = 0; i < n; i++) {
    const y = currentYear - i;
    options.push({
      value: `${y}-${y + 1}`,
      label: `FY ${y}-${String(y + 1).slice(-2)}`,
      from: `${y}-04-01`,
      to: `${y + 1}-03-31`,
    });
  }
  return options;
};

// Get filing period as MMYYYY from a date range
export const getFilingPeriod = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${mm}${d.getFullYear()}`;
};

// ========== Units of Measurement ==========
// label = display, uqc = GST portal Unit Quantity Code (used in GSTR-1 HSN summary)
// Each unit is tagged with the kind of supply it usually measures so the
// service-mode invoice can prioritise time-based units in the dropdown and
// pick a sensible default ("Hrs" instead of "Nos") for new line items.
// `kind: 'goods' | 'services' | 'both'`. `'both'` shows in either mode.
export const BUILTIN_UNITS = [
  { label: 'Pcs',     uqc: 'PCS', kind: 'goods' },
  { label: 'Nos',     uqc: 'NOS', kind: 'both' },
  { label: 'Kg',      uqc: 'KGS', kind: 'goods' },
  { label: 'g',       uqc: 'GMS', kind: 'goods' },
  { label: 'Tonne',   uqc: 'TON', kind: 'goods' },
  { label: 'Ltr',     uqc: 'LTR', kind: 'goods' },
  { label: 'ml',      uqc: 'MLT', kind: 'goods' },
  { label: 'Mtr',     uqc: 'MTR', kind: 'goods' },
  { label: 'cm',      uqc: 'CMS', kind: 'goods' },
  { label: 'Ft',      uqc: 'FTS', kind: 'goods' },
  { label: 'In',      uqc: 'INS', kind: 'goods' },
  { label: 'Sq.ft',   uqc: 'SQF', kind: 'both'  }, // construction services use this too
  { label: 'Sq.m',    uqc: 'SQM', kind: 'both'  },
  { label: 'Hrs',     uqc: 'HRS', kind: 'services' },
  { label: 'Day',     uqc: 'DAY', kind: 'services' },
  { label: 'Week',    uqc: 'OTH', kind: 'services' },
  { label: 'Month',   uqc: 'OTH', kind: 'services' },
  { label: 'Year',    uqc: 'OTH', kind: 'services' },
  { label: 'Visit',   uqc: 'OTH', kind: 'services' },
  { label: 'Session', uqc: 'OTH', kind: 'services' },
  { label: 'Project', uqc: 'OTH', kind: 'services' },
  { label: 'Word',    uqc: 'OTH', kind: 'services' }, // translators / writers
  { label: 'Page',    uqc: 'OTH', kind: 'services' },
  { label: 'Box',     uqc: 'BOX', kind: 'goods' },
  { label: 'Dozen',   uqc: 'DOZ', kind: 'goods' },
  { label: 'Pair',    uqc: 'PRS', kind: 'goods' },
  { label: 'Set',     uqc: 'SET', kind: 'goods' },
  { label: 'Bag',     uqc: 'BAG', kind: 'goods' },
  { label: 'Roll',    uqc: 'ROL', kind: 'goods' },
  { label: 'Bottle',  uqc: 'BTL', kind: 'goods' },
];

// Default unit per invoice mode — used when adding a new line item so the user
// doesn't have to flip the unit dropdown 90% of the time.
export const getDefaultUnitForMode = (mode) => {
  if (mode === 'services') return 'Hrs';
  if (mode === 'mixed') return 'Nos';
  return 'Nos'; // goods (default)
};

// Filter units by invoice mode for the dropdown. Service mode hides
// kg/ltr/box etc. (the user can still pick them via "Add custom…" if
// they truly need a goods unit on a service invoice — rare).
export const filterUnitsByMode = (units, mode) => {
  if (mode === 'mixed' || !mode) return units;
  return units.filter(u => u.kind === mode || u.kind === 'both' || u.custom);
};

const CUSTOM_UNITS_KEY = 'gst_customUnits';

export const getCustomUnits = () => {
  try {
    const raw = localStorage.getItem(CUSTOM_UNITS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(u => u && typeof u.label === 'string') : [];
  } catch { return []; }
};

export const addCustomUnit = (label) => {
  const trimmed = (label || '').trim();
  if (!trimmed || trimmed.length > 20) return false;
  const existing = getCustomUnits();
  if (existing.some(u => u.label.toLowerCase() === trimmed.toLowerCase())) return false;
  if (BUILTIN_UNITS.some(u => u.label.toLowerCase() === trimmed.toLowerCase())) return false;
  const next = [...existing, { label: trimmed, uqc: 'OTH', custom: true }];
  try { localStorage.setItem(CUSTOM_UNITS_KEY, JSON.stringify(next)); } catch { return false; }
  return true;
};

export const removeCustomUnit = (label) => {
  const next = getCustomUnits().filter(u => u.label !== label);
  try { localStorage.setItem(CUSTOM_UNITS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
};

export const getAllUnits = () => [...BUILTIN_UNITS, ...getCustomUnits()];

export const getUnitUQC = (label) => {
  const u = getAllUnits().find(x => x.label === label);
  return u?.uqc || 'OTH';
};

// ========== Tax ID validation ==========
// Returns { ok: boolean, message: string }. Empty value is treated as ok (field is optional).
export const validateTaxId = (countryName, value) => {
  if (!value || !value.trim()) return { ok: true, message: '' };
  const cc = getCountryConfig(countryName);
  if (!cc.taxIdRegex) return { ok: true, message: '' };
  const ok = cc.taxIdRegex.test(value.trim().toUpperCase());
  return ok
    ? { ok: true, message: '' }
    : { ok: false, message: `${cc.taxIdLabel} format looks unusual. Expected like: ${cc.taxIdPlaceholder}` };
};

// ========== Country detection from browser locale ==========
// Maps Intl region code → COUNTRIES.name. Falls back to 'India' on no match.
export const detectCountryFromBrowser = () => {
  try {
    const locale = (navigator?.language || 'en-IN').split('-');
    const region = locale[1]?.toUpperCase() || '';
    const match = COUNTRIES.find(c => c.code === region);
    return match?.name || 'India';
  } catch { return 'India'; }
};

// ========== Currency exchange rate snapshot ==========
// Stored on the invoice itself so historical reports stay accurate even if rates change.
// User enters rate manually; we don't fetch from the network (offline-first).
export const formatExchangeRateLine = (currency, rate, baseCurrency = 'INR') => {
  if (!rate || !currency || currency === baseCurrency) return '';
  return `1 ${currency} = ${Number(rate).toFixed(4)} ${baseCurrency}`;
};

// ========== Payment accounts ==========
// Profiles store an array `paymentAccounts: [{ id, label, bankName,
// accountNumber, ifsc, swift, upiId, isDefault, notes }]`. The legacy flat
// fields (profile.bankName / accountNumber / ifsc / swift / upiId) are kept
// in place for backwards compatibility — `getPaymentAccounts(profile)`
// transparently synthesises a single entry from them when no array exists,
// so old invoices and old profiles keep working without a data migration.

const newAccountId = () => `acc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const getPaymentAccounts = (profile) => {
  if (!profile) return [];
  if (Array.isArray(profile.paymentAccounts) && profile.paymentAccounts.length > 0) {
    return profile.paymentAccounts;
  }
  // Synthesise a single legacy entry if any flat bank/UPI field is set.
  const hasLegacy = profile.bankName || profile.accountNumber || profile.ifsc || profile.swift || profile.upiId;
  if (!hasLegacy) return [];
  return [{
    id: 'legacy',
    label: profile.bankName ? `${profile.bankName}` : 'Default account',
    bankName: profile.bankName || '',
    accountNumber: profile.accountNumber || '',
    ifsc: profile.ifsc || '',
    swift: profile.swift || '',
    upiId: profile.upiId || '',
    isDefault: true,
    notes: '',
  }];
};

export const getDefaultAccount = (profile) => {
  const accounts = getPaymentAccounts(profile);
  return accounts.find(a => a.isDefault) || accounts[0] || null;
};

export const getAccountById = (profile, id) => {
  if (!id) return getDefaultAccount(profile);
  const accounts = getPaymentAccounts(profile);
  return accounts.find(a => a.id === id) || getDefaultAccount(profile);
};

// Create a fresh empty account ready for the user to fill in.
export const createEmptyAccount = (label = 'New account') => ({
  id: newAccountId(),
  label,
  bankName: '',
  accountNumber: '',
  ifsc: '',
  swift: '',
  upiId: '',
  isDefault: false,
  isActive: true,
  notes: '',
});

// Active accounts only — used to populate the new-invoice dropdown so
// archived/disabled accounts don't appear, but they remain editable in
// Settings and still resolve for historical invoices that referenced them.
export const getActiveAccounts = (profile) =>
  getPaymentAccounts(profile).filter(a => a.isActive !== false);

// Account number is sensitive — mask all but the last 4 digits for list rows.
// Preserves the visual cue of length without leaking the full number.
export const maskAccountNumber = (n) => {
  const s = String(n || '').trim();
  if (s.length <= 4) return s; // too short to mask
  return '••••' + s.slice(-4);
};

// Returns a NEW accounts array with the entry at fromIdx moved to toIdx.
// Pure — caller writes the result back to profile.paymentAccounts.
export const reorderAccounts = (accounts, fromIdx, toIdx) => {
  if (!Array.isArray(accounts)) return accounts;
  if (fromIdx === toIdx || fromIdx < 0 || fromIdx >= accounts.length) return accounts;
  if (toIdx < 0 || toIdx >= accounts.length) return accounts;
  const next = accounts.slice();
  const [moved] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, moved);
  return next;
};

// Returns a NEW accounts array with exactly one default — the one matching
// `accountId`. Used by the Settings UI's ⭐ buttons. If no match, returns
// the input unchanged.
export const setDefaultAccount = (accounts, accountId) => {
  if (!Array.isArray(accounts) || !accountId) return accounts;
  if (!accounts.some(a => a.id === accountId)) return accounts;
  return accounts.map(a => ({ ...a, isDefault: a.id === accountId }));
};

// Soft UPI VPA format check (warning-only). Allows alphanumerics, dot, hyphen,
// underscore on either side of the @ — covers Indian VPAs like
// "9999999999@upi", "acme.corp@hdfcbank", "merchant-1@paytm".
export const isValidUpiId = (s) => /^[\w.\-]+@[\w.\-]+$/.test(String(s || '').trim());

// ========== Feature modules ==========
// Each module can be turned off by the user in Settings → Modules. Modules in
// the 'core' group are always on (creating invoices, managing clients, settings)
// — disabling them would leave the app unusable.
//
// `nav` is the corresponding sidebar view id (or null if the module doesn't
// have its own page). When a module is disabled, its nav entry is hidden and
// any related fields/sections in other views are suppressed too.
export const FEATURE_GROUPS = [
  {
    id: 'sales',
    label: 'Sales & Invoicing',
    description: 'Invoice creation, recurring invoices, payment receipts',
    modules: [
      { id: 'invoicing', label: 'Tax invoices, proforma, credit notes', nav: 'new', core: true },
      { id: 'recurring', label: 'Recurring invoices', nav: 'recurring', defaultOn: true },
      { id: 'receipts',  label: 'Payment receipts',  nav: 'receipts',  defaultOn: true },
    ],
  },
  {
    id: 'directory',
    label: 'Directory',
    description: 'Clients and product catalog',
    modules: [
      { id: 'clients',   label: 'Clients',   nav: 'clients', core: true },
      { id: 'inventory', label: 'Products & Services (inventory)', nav: 'inventory', defaultOn: true },
    ],
  },
  {
    id: 'purchases',
    label: 'Purchases & Expenses',
    description: 'Vendor bills, expense tracking, ITC',
    modules: [
      { id: 'expenses',  label: 'Expense tracker', nav: 'expenses',  defaultOn: true },
      { id: 'purchases', label: 'Purchase bills',  nav: 'purchases', defaultOn: true },
      { id: 'gstr2b',    label: 'GSTR-2B reconciliation (purchase ITC matching)', nav: null, defaultOn: true, indiaOnly: true },
    ],
  },
  {
    id: 'gst',
    label: 'GST & Tax (India)',
    description: 'GSTR returns, e-Way Bill, TDS/TCS, HSN summaries',
    modules: [
      { id: 'gstReturns', label: 'GSTR-1 / GSTR-3B exports + filing guide', nav: 'filing', defaultOn: true, indiaOnly: true },
      { id: 'ewayBill',   label: 'E-Way Bill JSON export', nav: null, defaultOn: true, indiaOnly: true },
      { id: 'tdsTcs',     label: 'TDS / TCS on invoices', nav: null, defaultOn: false, indiaOnly: true },
      { id: 'incomeTax',  label: 'Income Tax Helper (regime calc + bank import)', nav: 'incometax', defaultOn: true, indiaOnly: true },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    description: 'Dashboards and financial reports',
    modules: [
      { id: 'dashboard', label: 'Dashboard', nav: 'dashboard', core: true },
      { id: 'reports',   label: 'Reports view', nav: 'reports', defaultOn: true },
    ],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    description: 'Cloud backup and payment QR codes',
    modules: [
      { id: 'googleDrive', label: 'Google Drive backup', nav: null, defaultOn: true },
      { id: 'upiQr',       label: 'UPI QR code on invoices', nav: null, defaultOn: true, indiaOnly: true },
    ],
  },
];

// v1.10.6 — audit L3: removed unused exports `ALL_MODULES` and
// `getModuleDefaults` (no importers anywhere in src/). Reintroduce
// if a future consumer needs the flat list.
const ALL_MODULES = FEATURE_GROUPS.flatMap(g => g.modules.map(m => ({ ...m, group: g.id })));

// Returns true if a module is currently enabled. Core modules can never be off.
// User overrides in localStorage (via Settings → Modules) take precedence over defaults.
export const isModuleEnabled = (moduleId, userMap = {}) => {
  const mod = ALL_MODULES.find(m => m.id === moduleId);
  if (!mod) return true; // unknown module — fail open rather than hiding things
  if (mod.core) return true;
  if (Object.prototype.hasOwnProperty.call(userMap, moduleId)) return !!userMap[moduleId];
  return mod.defaultOn !== false;
};

// ========== Built-in Terms & Conditions presets ==========
// Drop-in starter T&C wording grouped by India-common business types. Users pick a
// preset, edit it however they want, and optionally save the result as one of their
// own reusable templates via the existing Terms Templates feature in Settings.
//
// Each entry is rich HTML so the in-invoice rich editor renders bullets and bold
// correctly. Every preset includes an India-relevant jurisdiction line and an
// "all disputes subject to <city> jurisdiction" clause that the user can edit.
export const TERMS_PRESETS = [
  {
    id: 'generic-sme',
    label: 'Generic SME / Trader',
    region: 'IN',
    body: `<p><strong>Payment Terms</strong></p>
<ul>
  <li>Payment is due within <strong>15 days</strong> from the date of invoice.</li>
  <li>Goods once sold will not be taken back or exchanged.</li>
  <li>Interest @ <strong>18% p.a.</strong> will be charged on overdue payments.</li>
  <li>All cheques to be drawn in favour of the company name printed above.</li>
</ul>
<p><strong>Delivery & Title</strong></p>
<ul>
  <li>Goods remain the property of the seller until full payment is received.</li>
  <li>Risk passes to the buyer on dispatch from our premises.</li>
</ul>
<p><strong>Disputes:</strong> Subject to <em>[your city]</em> jurisdiction only.</p>`,
  },
  {
    id: 'freelancer',
    label: 'Freelancer / Consultant',
    region: 'IN',
    body: `<p><strong>Scope</strong></p>
<ul>
  <li>This invoice is for professional services as agreed in our scope of work.</li>
  <li>Any work outside the agreed scope will be quoted separately.</li>
</ul>
<p><strong>Payment</strong></p>
<ul>
  <li>Payment is due within <strong>7 days</strong> from invoice date.</li>
  <li>Late payments accrue interest at <strong>1.5% per month</strong>.</li>
  <li>TDS, if applicable, may be deducted under Section 194J. Please share Form 16A.</li>
</ul>
<p><strong>Intellectual Property:</strong> Final deliverables transfer to client only after the full invoice value is settled.</p>
<p>Disputes subject to <em>[your city]</em> jurisdiction.</p>`,
  },
  {
    id: 'manufacturer',
    label: 'Manufacturer / Wholesale',
    region: 'IN',
    body: `<p><strong>Order & Delivery</strong></p>
<ul>
  <li>Goods are dispatched ex-works unless otherwise agreed in writing.</li>
  <li>Delivery dates are estimates; we are not liable for delays caused by transporters or force majeure events.</li>
  <li>Buyer is responsible for inspection of goods at the time of delivery.</li>
</ul>
<p><strong>Payment</strong></p>
<ul>
  <li>Net <strong>30 days</strong> from date of invoice.</li>
  <li>Interest @ <strong>24% p.a.</strong> on overdue amounts.</li>
  <li>TDS under Section 194Q applicable for buyers with turnover &gt; ₹10 cr.</li>
</ul>
<p><strong>Returns:</strong> Goods sold are not returnable unless defective and notified within 7 days of delivery.</p>
<p>Subject to <em>[your city]</em> jurisdiction.</p>`,
  },
  {
    id: 'retail-shop',
    label: 'Retail Shop',
    region: 'IN',
    body: `<ul>
  <li><strong>No exchange or refund</strong> on goods once sold, except in case of manufacturing defects within 7 days, with original bill.</li>
  <li>Discounted items are not eligible for return or exchange.</li>
  <li>Goods may be exchanged of equal value within 7 days, subject to availability.</li>
  <li>Cheques to be drawn in favour of <em>[shop name]</em>. Interest @ 24% p.a. on dishonoured cheques.</li>
  <li>All disputes subject to <em>[your city]</em> jurisdiction only.</li>
</ul>`,
  },
  {
    id: 'restaurant',
    label: 'Restaurant / Café',
    region: 'IN',
    body: `<ul>
  <li>Service charge, where applicable, is at the discretion of the customer.</li>
  <li>GST as applicable is included as per current government rates.</li>
  <li>Cheques are not accepted. Card and UPI welcomed.</li>
  <li>We reserve the right of admission.</li>
  <li>Disputes subject to <em>[your city]</em> jurisdiction.</li>
</ul>`,
  },
  {
    id: 'it-saas',
    label: 'IT / Software Services',
    region: 'IN',
    body: `<p><strong>Service Terms</strong></p>
<ul>
  <li>Services are billed on a project / monthly retainer basis as agreed.</li>
  <li>Software licenses, third-party services, and infrastructure costs are billed at actuals.</li>
</ul>
<p><strong>Payment</strong></p>
<ul>
  <li>Net <strong>15 days</strong> from invoice date.</li>
  <li>Late payments accrue interest at <strong>18% p.a.</strong></li>
  <li>TDS under Section 194J applicable.</li>
</ul>
<p><strong>SLA & Support:</strong> Support is provided per the agreed SLA. Outages caused by hosting providers, third-party APIs, or scheduled maintenance are excluded.</p>
<p><strong>IP & Confidentiality:</strong> Custom code is licensed to client on full settlement. Confidential information is protected per the signed NDA.</p>
<p>Subject to <em>[your city]</em> jurisdiction.</p>`,
  },
  {
    id: 'construction',
    label: 'Construction / Contractor',
    region: 'IN',
    body: `<p><strong>Work & Materials</strong></p>
<ul>
  <li>Work is executed per the approved drawings and BOQ.</li>
  <li>Any change orders or additional work will be billed separately at agreed rates.</li>
  <li>Materials remain the property of the contractor until full payment is received.</li>
</ul>
<p><strong>Payment Schedule</strong></p>
<ul>
  <li>Payment as per agreed milestones in the contract.</li>
  <li>Final payment due within <strong>30 days</strong> of completion certificate.</li>
  <li>TDS under Section 194C applicable.</li>
  <li>Retention, if any, will be released as per the contract terms.</li>
</ul>
<p><strong>Defects Liability:</strong> 12 months from handover, covering workmanship only.</p>
<p>Subject to <em>[your city]</em> jurisdiction.</p>`,
  },
  {
    id: 'medical',
    label: 'Medical / Healthcare',
    region: 'IN',
    body: `<ul>
  <li>Medicines and consumables once sold cannot be exchanged or returned (Drugs and Cosmetics Rules).</li>
  <li>Services rendered are non-refundable.</li>
  <li>Payment is due at the time of service unless covered by a pre-authorized insurance claim.</li>
  <li>Insurance reimbursement is between patient and insurer; we provide all documentation needed.</li>
  <li>Disputes subject to <em>[your city]</em> jurisdiction.</li>
</ul>`,
  },
  {
    id: 'education',
    label: 'Educational Services / Coaching',
    region: 'IN',
    body: `<ul>
  <li>Fees are non-refundable once classes commence, except as per the published refund policy.</li>
  <li>Course material remains the property of the institute and may not be reproduced without permission.</li>
  <li>Late fee of ₹500 per month after the due date.</li>
  <li>The institute reserves the right to reschedule or cancel classes with prior notice.</li>
  <li>Disputes subject to <em>[your city]</em> jurisdiction.</li>
</ul>`,
  },
  {
    id: 'transport',
    label: 'Transport / Logistics',
    region: 'IN',
    body: `<ul>
  <li>Goods are carried at <strong>owner's risk</strong> unless transit insurance is separately arranged and paid for.</li>
  <li>Delivery times are best-effort estimates and not guaranteed.</li>
  <li>Liability for loss or damage is limited to ₹100 per consignment unless declared value is paid.</li>
  <li>Demurrage / detention charges as per the schedule attached.</li>
  <li>Payment due within <strong>15 days</strong>; interest @ 24% p.a. on overdue amounts.</li>
  <li>Subject to <em>[your city]</em> jurisdiction.</li>
</ul>`,
  },
  {
    id: 'real-estate-rent',
    label: 'Real Estate / Rental Invoice',
    region: 'IN',
    body: `<ul>
  <li>Rent is payable on or before the <strong>5th of every month</strong>.</li>
  <li>Late payments attract a penalty of ₹100 per day after grace period.</li>
  <li>TDS under Section 194I applicable for tenant if annual rent exceeds ₹2.4 lakh.</li>
  <li>Maintenance, electricity, and water charges are billed separately as per usage.</li>
  <li>Premises must be vacated in the same condition as handed over, normal wear and tear excepted.</li>
  <li>Disputes subject to <em>[your city]</em> jurisdiction.</li>
</ul>`,
  },
  {
    id: 'ecommerce',
    label: 'E-commerce Seller',
    region: 'IN',
    body: `<ul>
  <li>Returns accepted within 7 days of delivery, in original packaging, subject to product category policy.</li>
  <li>Refunds are processed to the original payment mode within 7-10 working days of return receipt.</li>
  <li>Products with broken seals, used items, and clearance-sale items are not returnable.</li>
  <li>Shipping charges, where applicable, are non-refundable.</li>
  <li>For warranty, please contact the manufacturer's authorized service center.</li>
  <li>Disputes subject to <em>[your city]</em> jurisdiction. Governed by the Consumer Protection Act, 2019.</li>
</ul>`,
  },
  {
    id: 'export',
    label: 'Export / International (LUT)',
    region: 'IN',
    body: `<p><strong>Tax Status:</strong> Supplied as a zero-rated export under <strong>LUT (Letter of Undertaking)</strong> — IGST not charged. Bond / LUT reference: <em>[insert LUT number]</em>.</p>
<p><strong>Payment</strong></p>
<ul>
  <li>Payable in <em>[USD/EUR/etc.]</em> by SWIFT wire transfer to the bank account printed above.</li>
  <li>All bank charges (sender + intermediary + beneficiary) are to be borne by the buyer.</li>
  <li>Payment due within <strong>30 days</strong> of invoice date.</li>
</ul>
<p><strong>Delivery:</strong> FOB / CIF as per Incoterms 2020 — see the contract for the agreed term.</p>
<p>Disputes subject to <em>[your city]</em>, India jurisdiction.</p>`,
  },
  {
    id: 'custom-blank',
    label: '— Start from blank —',
    region: '*',
    body: '',
  },
];

// v1.10.6 — audit L3: `getTermsPresets(region)` had no importers.
// Components read TERMS_PRESETS directly; that stays exported.

// ========== TDS / TCS (Income Tax Act) ==========
// Common TDS sections that appear on invoices. The buyer deducts this from the
// payment made to us (the seller); we surface it as an informational line so
// the client knows what to deduct, and so our records can track receivable TDS.
// Rates here are the default — users can override per-invoice.
export const TDS_SECTIONS = [
  { code: '194Q', label: '194Q — Purchase of goods (buyer turnover > ₹10cr)', rate: 0.1 },
  { code: '194C', label: '194C — Contractor / sub-contractor', rate: 1 },
  { code: '194C-co', label: '194C — Contractor (company)', rate: 2 },
  { code: '194J', label: '194J — Professional / technical services', rate: 10 },
  { code: '194J-tech', label: '194J — Technical services (lower rate)', rate: 2 },
  { code: '194I', label: '194I — Rent (land / building)', rate: 10 },
  { code: '194I-pm', label: '194I — Rent (plant / machinery)', rate: 2 },
  { code: '194H', label: '194H — Commission / brokerage', rate: 5 },
  { code: '194O', label: '194O — E-commerce participant', rate: 1 },
  { code: '195',  label: '195 — Payments to non-residents (varies)', rate: 0 },
  { code: 'custom', label: 'Custom section / rate', rate: 0 },
];

// TCS (Section 206C) is collected BY the seller from the buyer and added to the
// invoice total. Common cases:
export const TCS_SECTIONS = [
  { code: '206C(1H)', label: '206C(1H) — Sale of goods (seller turnover > ₹10cr)', rate: 0.1 },
  { code: '52',       label: 'CGST 52 — E-commerce operator', rate: 1 },
  { code: '206C(1)',  label: '206C(1) — Tendu leaves / scrap / minerals (varies)', rate: 1 },
  { code: 'custom',   label: 'Custom rate', rate: 0 },
];

// v1.10.6 — audit L3: getTDSSection / getTCSSection had no importers.
// Components filter TDS_SECTIONS / TCS_SECTIONS directly.

// ========== Round-off helper ==========
// Returns the delta needed to round the total to the nearest whole unit.
// e.g. 1234.67 → -0.67 (subtract); 1234.40 → +0.60 (add).
export const calculateRoundOff = (total) => {
  if (typeof total !== 'number' || isNaN(total)) return 0;
  const rounded = Math.round(total);
  return Math.round((rounded - total) * 100) / 100;
};

// ========== Currency name map (for amount-in-words) ==========
// Used by InvoicePreview when rendering "Amount in Words" footer for foreign currencies.
export const CURRENCY_NAMES = {
  INR: { major: 'Rupees',   minor: 'Paise' },
  USD: { major: 'Dollars',  minor: 'Cents' },
  EUR: { major: 'Euros',    minor: 'Cents' },
  GBP: { major: 'Pounds',   minor: 'Pence' },
  AUD: { major: 'Dollars',  minor: 'Cents' },
  CAD: { major: 'Dollars',  minor: 'Cents' },
  SGD: { major: 'Dollars',  minor: 'Cents' },
  AED: { major: 'Dirhams',  minor: 'Fils'  },
  SAR: { major: 'Riyals',   minor: 'Halalas' },
  MYR: { major: 'Ringgit',  minor: 'Sen'   },
  ZAR: { major: 'Rand',     minor: 'Cents' },
  NGN: { major: 'Naira',    minor: 'Kobo'  },
  KES: { major: 'Shillings',minor: 'Cents' },
  NPR: { major: 'Rupees',   minor: 'Paisa' },
  BDT: { major: 'Taka',     minor: 'Poisha'},
  LKR: { major: 'Rupees',   minor: 'Cents' },
  PKR: { major: 'Rupees',   minor: 'Paisa' },
  PHP: { major: 'Pesos',    minor: 'Centavos' },
  IDR: { major: 'Rupiah',   minor: 'Sen'   },
  NZD: { major: 'Dollars',  minor: 'Cents' },
};
