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

    // 100 crore and above: the crore count is itself a number in words
    // ("One Hundred and Fifty Crore"). convertToWords only handles 0-99, so
    // ₹150 crore used to print "undefined Crore".
    if (crore > 99) res += getIndianFormatString(crore) + ' Crore ';
    else if (crore > 0) res += convertToWords(crore) + ' Crore ';
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
  // The word lists carry trailing spaces, which printed "One  Hundred".
  return (result + ' Only').replace(/\s+/g, ' ');
};

export const formatCurrency = (amount, currency = 'INR') => {
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency || 'INR',
    minimumFractionDigits: 2
  }).format(amount || 0);
};

// v1.10.66 (#63) — CSV cells that start with = + - @ (or a tab / carriage
// return) are run as FORMULAS by Excel, LibreOffice and Google Sheets. A client
// or item named `=HYPERLINK("http://evil.example","Invoice")` turned into a
// live link inside an exported ledger. Such text is prefixed with an
// apostrophe so the spreadsheet shows it as plain text. Plain numbers —
// including negatives such as a credit note's -500.00 — are left alone so the
// amount columns still add up.
const CSV_FORMULA_START = /^[=+\-@\t\r]/;
const CSV_PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;
export const toCsvCell = (value) => {
  let s = String(value ?? '');
  if (s.length > 1 && CSV_FORMULA_START.test(s) && !CSV_PLAIN_NUMBER.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsvLine = (cells) => cells.map(toCsvCell).join(',');

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
//
// `taxIncluded`: the line's qty × rate already includes tax ("Prices include
// tax") or no tax is charged at all (bill of supply). A with-tax discount is
// then taken off as entered - backing tax out of it again under-discounted
// the line (₹118 off an inclusive ₹1,180 line took only ₹100 off).
export const resolveLineDiscount = (item = {}, taxIncluded = false) => {
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
    // v1.10.80: on a price that already includes tax (or carries no tax) the
    // with-tax amount comes off as entered. Only lines set since then carry
    // withTaxRule 2: older saved lines keep the old maths (tax backed out),
    // so their GSTR-1 figures and reprints still match the saved totals.
    if (taxIncluded && item.withTaxRule === 2) return Math.min(net, raw);
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
  const discount = resolveLineDiscount(item, taxInclusive);
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

  // v1.10.83 - an export or a supply to an SEZ under a LUT is zero-rated: no
  // IGST and no cess on the invoice. The items keep their GST rate (GSTR-1 and
  // the e-invoice report the rate with a zero amount). Same export test as the
  // place-of-supply logic below; never with reverse charge.
  const lutClientCountry = (client.country || '').trim();
  const lutZeroRated = isIndia && showGST && !!invoiceOptions.isLUT && !invoiceOptions.reverseCharge
    && (!!client.isSEZ || (!!lutClientCountry && lutClientCountry !== 'India' && !getStateCode((details.placeOfSupply || '').trim())));

  // Per-line rounded values feed BOTH the invoice PDF and the GSTR-1
  // export so their totals agree. Prior code summed raw floats for one
  // and rounded per-line for the other → GSTN "amount_mismatch".
  const lines = items.map((item) => {
    const qty = finiteNonNeg(item.quantity);
    const rate = finiteNonNeg(item.rate);
    // v1.10.22 — read discount through resolveLineDiscount so percent-mode
    // items are computed correctly. Fixed-mode items behave identically.
    const disc = resolveLineDiscount(item, !showGST || taxInclusive);
    const taxPct = finiteNonNeg(item.taxPercent);
    const cessPct = finiteNonNeg(item.cessPercent);
    const gross = qty * rate;
    const afterDisc = Math.max(0, gross - disc);
    // v1.10.39 — Reported: clicking "Bill of Supply (No GST)" doesn't
    // remove GST from the total. Root cause: prior code computed
    // `taxable = afterDisc / (1 + taxPct / 100)` when tax-inclusive
    // AND `tax = taxable * taxPct / 100` UNCONDITIONALLY. Only `cess`
    // was gated on showGST. Result: switching to Bill of Supply left
    // line-level tax computed → summed into taxTotal → added to
    // igst/cgst/sgst → grand total inflated by the tax the invoice
    // type says isn't applicable. Now: showGST=false zeros the tax
    // AND treats the invoice as always tax-exclusive (taxable = full
    // afterDisc value), which is what a Bill of Supply / Delivery
    // Challan actually is.
    const applyTax = !!showGST && !lutZeroRated;
    const taxable = (applyTax && taxInclusive && taxPct > 0) ? afterDisc / (1 + taxPct / 100) : afterDisc;
    const tax = applyTax ? r2(taxable * taxPct / 100) : 0;
    const cess = applyTax ? r2(taxable * cessPct / 100) : 0;
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
  // v1.10.66 (#61) — a client outside India makes this an export, and an
  // export's place of supply is outside India, so any tax charged is IGST —
  // never CGST + SGST. The CLIENT'S COUNTRY decides it, not the currency: an
  // Indian client can be billed in USD without the supply leaving the state.
  // An explicit Indian place of supply (goods delivered here for a foreign
  // buyer) still wins, so that case follows the normal state comparison.
  const clientCountry = (client.country || '').trim();
  const isExportClient = isIndia && !!clientCountry && clientCountry !== 'India'
    && !getStateCode((details.placeOfSupply || '').trim());

  if (isIndia && showGST && !placeOfSupplyRaw && !isExportClient) {
    warnings.push('Place of supply is not set. Falling back to client state.');
  }

  const isInterstate = isIndia && (isSEZ || isExportClient || (
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
  //
  // The ₹50L threshold belongs to 194Q and 206C(1H) only. Other sections
  // (194C, 194J, 194I, 194H, 194O, 195, CGST 52, 206C(1)) have their own small
  // thresholds or none, and the user ticks TDS/TCS when it applies, so they
  // are worked out from rupee one. Applying ₹50L to them made TDS 0 on every
  // ordinary 194J invoice. No section given = the threshold sections (their
  // defaults), which keeps older saved invoices computing as before.
  const tcsThresholded = !invoiceOptions.tcsSection || invoiceOptions.tcsSection === '206C(1H)';
  const tdsThresholded = !invoiceOptions.tdsSection || invoiceOptions.tdsSection === '194Q';
  const tcsCumBefore = tcsThresholded ? (Number(invoiceOptions.tcsCumulativeThisYear) || 0) : Infinity;
  const tdsCumBefore = tdsThresholded ? (Number(invoiceOptions.tdsCumulativeThisYear) || 0) : Infinity;

  // The base at portal-facing gross (including GST).
  const receiptIncludingGst = r2(taxableAmount + taxTotal + cessTotal);
  // Which amount each section is worked out on:
  //   • TCS 206C(1H) / 206C(1): the amount received, GST included
  //     (CBDT Circular 17/2020).
  //   • TCS under CGST section 52: the net taxable value, without GST.
  //   • TDS (194C, 194J, 194I, 194H, 194O, 194Q...): the value WITHOUT GST
  //     when the invoice shows GST separately (CBDT Circular 23/2017; for
  //     194Q, Circular 13/2021). It used to be worked out on the amount with
  //     GST, overstating TDS by the GST rate (₹11,800 instead of ₹10,000 on a
  //     ₹1,00,000 + 18% invoice at 10%).
  const tcsBase = invoiceOptions.tcsSection === '52' ? taxableAmount : receiptIncludingGst;
  const tdsBase = taxableAmount;

  // Portion of THIS invoice that sits above the ₹50L threshold. If the
  // cumulative was already ≥ threshold, whole invoice is taxable. If
  // it was below, only the excess portion attracts TCS.
  const marginalTcsBase = tcsCumBefore >= TDS_TCS_THRESHOLD
    ? tcsBase
    : Math.max(0, (tcsCumBefore + tcsBase) - TDS_TCS_THRESHOLD);
  const marginalTdsBase = tdsCumBefore >= TDS_TCS_THRESHOLD
    ? tdsBase
    : Math.max(0, (tdsCumBefore + tdsBase) - TDS_TCS_THRESHOLD);

  const tcsRate = Number(invoiceOptions.tcsRate) || 0;
  const tdsRate = Number(invoiceOptions.tdsRate) || 0;
  const tcsAmount = invoiceOptions.showTCS && tcsRate > 0
    ? r2(marginalTcsBase * tcsRate / 100) : 0;
  // v1.10.83 - TDS the client actually deducted, recorded with a payment
  // (Dashboard → Record Payment → Client deducted TDS), stays as recorded while
  // its section and rate are unchanged: reopening and saving the invoice used
  // to work it out again, and the ₹50L threshold of 194Q could make it 0.
  const rec = invoiceOptions.tdsRecorded;
  const recordedTds = rec && rec.section === invoiceOptions.tdsSection && Number(rec.rate) === tdsRate
    && isFinite(Number(rec.amount)) ? r2(Math.max(0, Number(rec.amount))) : null;
  const tdsAmount = invoiceOptions.showTDS && tdsRate > 0
    ? (recordedTds ?? r2(marginalTdsBase * tdsRate / 100)) : 0;

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
    taxInclusive: !!(taxInclusive && showGST && !lutZeroRated),
    lutZeroRated,
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

// The totals of an invoice made from a recurring template. Shared by the
// server (which makes the invoices) and the Recurring screen (which shows
// their amount), so both always agree. GST follows the template's own
// showGST when it has one, else its type (as the printed invoice does): a
// template made on the Recurring screen has no invoiceOptions.showGST, and
// the server used to charge GST on its bills of supply and challans.
export const templateTotals = (tpl, profile, extraOptions = {}) => {
  const t = tpl || {};
  const invoiceOptions = { ...(t.invoiceOptions || {}), ...extraOptions };
  const typeShowsGst = (INVOICE_TYPES[t.invoiceType || 'tax-invoice'] || INVOICE_TYPES['tax-invoice']).showGST;
  return computeInvoiceTotals({
    items: t.items || [],
    profile,
    client: { name: t.clientName, state: t.clientState, gstin: t.clientGstin, country: t.clientCountry, isSEZ: !!t.isSEZ },
    details: { placeOfSupply: t.placeOfSupply || '' },
    showGST: typeof invoiceOptions.showGST === 'boolean' ? invoiceOptions.showGST : typeShowsGst,
    taxInclusive: !!t.taxInclusive,
    invoiceOptions,
  });
};

// Invoice type configuration
export const INVOICE_TYPES = {
  'tax-invoice': {
    label: 'Tax Invoice',
    prefix: 'INV',
    title: 'TAX INVOICE',
    showGST: true,
    description: 'Standard GST tax invoice',
  },
  // v1.10.73 - a priced offer for work or supply (QUO/26-27/080 style). Like a
  // proforma it is not a sale and never reaches GST returns; convert it to a
  // tax invoice once the client accepts.
  'quotation': {
    label: 'Quotation',
    prefix: 'QUO',
    title: 'QUOTATION',
    showGST: true,
    description: 'Priced offer for work or supply — not a tax document. Convert it to a tax invoice when accepted',
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

// v1.10.73 - optional order / dispatch / reference details on an invoice,
// the boxes a Tally-style invoice carries. One list drives the editor and
// every PDF design, so a field can never be typed in but not printed.
export const ORDER_DETAIL_FIELDS = [
  { key: 'workDetails', label: 'Work details', wide: true, placeholder: 'e.g. Supply and installation of high mast lights, scope as per annexure' },
  { key: 'revisionNo', label: 'Revision No', placeholder: 'e.g. Rev-1' },
  { key: 'vehicleNo', label: 'Vehicle No', placeholder: 'e.g. TS09AB1234' },
  { key: 'periodFrom', label: 'Service period from', type: 'date' },
  { key: 'periodTo', label: 'Service period to', type: 'date' },
  { key: 'buyerOrderNo', label: "Buyer's Order No", placeholder: 'PO / work order number' },
  { key: 'buyerOrderDate', label: 'Order date', type: 'date' },
  { key: 'referenceNo', label: 'Reference No & Date' },
  { key: 'otherReferences', label: 'Other references' },
  { key: 'deliveryNote', label: 'Delivery Note' },
  { key: 'deliveryNoteDate', label: 'Delivery note date', type: 'date' },
  { key: 'dispatchDocNo', label: 'Dispatch Doc No' },
  { key: 'dispatchedThrough', label: 'Dispatched through', placeholder: 'e.g. VRL Logistics, by road' },
  { key: 'destination', label: 'Destination' },
  { key: 'paymentTerms', label: 'Mode / Terms of payment', placeholder: 'e.g. 30 days, NEFT' },
  { key: 'deliveryTerms', label: 'Terms of delivery', wide: true },
];
// Whether a Customize option is on. Most are on unless switched off; a few are
// off unless chosen; the Tally-style extras are on by default only in that
// design. The Customize panel and the printed invoice both use this, so a tick
// box can never show one thing while the invoice prints another (and the first
// click always flips what you see - it used to take two clicks for options
// that had never been saved).
export const OPTIONS_OFF_BY_DEFAULT = ['showRoundOff', 'showAccountLabel', 'showCess', 'reverseCharge', 'showSystemGeneratedNote'];
export const OPTIONS_ON_FOR_TALLY = ['showHsnSummary', 'showTaxInWords', 'showDeclaration', 'showCustomerSeal'];
export const invoiceOptionOn = (options, key, style = options?.pdfStyle) => {
  const v = options?.[key];
  if (v !== undefined && v !== null) return !!v;
  if (OPTIONS_OFF_BY_DEFAULT.includes(key)) return false;
  if (OPTIONS_ON_FOR_TALLY.includes(key)) return style === 'tally';
  return true;
};
export const DEFAULT_DECLARATION = 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.';

// dd-Mon-yy for printing (31-Aug-26), the way Tally prints dates.
export const formatShortDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-');
};
// The filled-in order details, ready to print as label / value pairs.
// v1.10.84 (#126) - plus the fields the user named (details.customFields:
// [{ label, value }]), e.g. an optician's R SPH / L SPH or a patient name.
export const filledOrderDetails = (details = {}) => [
  ...ORDER_DETAIL_FIELDS
    .filter((f) => String(details[f.key] || '').trim())
    .map((f) => ({ ...f, value: f.type === 'date' ? formatShortDate(details[f.key]) : String(details[f.key]).trim() })),
  ...customFieldsOf(details)
    .filter((f) => f.label && f.value)
    .map((f, i) => ({ key: `custom${i}`, label: f.label, value: f.value, custom: true })),
];
// v1.10.84 (#172) - the Invoices search also finds a bill by its order /
// dispatch / reference details (marketplace order ID, AWB in Dispatch Doc No,
// your own fields) and the client's phone or GSTIN.
export const billMatchesSearch = (bill, query) => {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const c = bill?.data?.client || {};
  return [bill?.clientName, bill?.invoiceNumber, c.phone, c.gstin,
    ...filledOrderDetails(bill?.data?.details || {}).map((f) => f.value)]
    .some((v) => String(v || '').toLowerCase().includes(q));
};
export const customFieldsOf = (details = {}) => (Array.isArray(details?.customFields) ? details.customFields : [])
  .map((f) => ({ label: String(f?.label || '').trim(), value: String(f?.value || '').trim() }));

// v1.10.70 - where a PDF page is allowed to end.
//
// `edges` are candidate y positions (the tops and bottoms of table rows and
// footer blocks). `keepWhole` are [top, bottom] spans a page edge must never
// pass through. An edge that is safe in one column is not safe in the column
// beside it: the invoice footer puts bank details and terms on the left and
// the signature and stamp on the right, so the gap between bank details and
// terms runs straight through the stamp. The page broke there, printing the
// top of the stamp at the foot of page 1 and the rest on page 2 (ERR-024).
export const safePageBoundaries = (edges, keepWhole) => {
  const spans = (keepWhole || []).filter(([t, b]) => b - t > 2);
  const inside = (y) => spans.some(([t, b]) => y > t + 1 && y < b - 1);
  return [...new Set(edges)].filter((y) => !inside(y)).sort((a, b) => a - b);
};

// v1.10.67 (#66 item 7, @sangwanmail-eng) — which documents are actual sales.
// A proforma/estimate is only a quote and a delivery challan moves goods
// without selling them, so neither is turnover. A credit note reduces it. A
// cancelled document counts for nothing at all (#66 item 12).
export const SALES_INVOICE_TYPES = ['tax-invoice', 'bill-of-supply', 'composition'];
export const isCancelledBill = (bill) => (bill?.status || '') === 'cancelled';
export const countsAsSales = (bill) => !isCancelledBill(bill)
  && SALES_INVOICE_TYPES.includes(bill?.invoiceType || 'tax-invoice');
export const isCreditNote = (bill) => (bill?.invoiceType || '') === 'credit-note'
  && !isCancelledBill(bill);
// +1 for a sale, -1 for a credit note, 0 for quotes, challans and anything cancelled.
export const salesSign = (bill) => (countsAsSales(bill) ? 1 : (isCreditNote(bill) ? -1 : 0));

// One invoice line's tax for the GST returns: taxable value, CGST, SGST or
// UTGST, IGST and cess.
// v1.10.77 (#89) - the line tax is rounded to the paisa, as on the invoice
// (computeInvoiceTotals), and CGST and SGST are each exactly half of it, NOT
// rounded here: every return table adds lines up and rounds once (round2 at
// output), so CGST = SGST = round(total / 2), as the invoice prints them. It used to give CGST the half rounded DOWN and SGST
// the half rounded UP per line, so every odd-paisa line put a paisa more in
// SGST; over a few dozen lines the HSN summary showed CGST 6,778.56 against
// SGST 6,782.56 for a 5% item. Rounding each half per line instead drifts
// from the invoice total by a paisa per line.
// v1.10.31 - cess and UTGST flow through here too.
export const splitLineTax = (item, isInterState, taxInclusive = false, isIntraUT = false) => {
  const { afterDiscount, taxAmount: rawTax } = calculateLineItemTax(item, taxInclusive);
  const paise = Math.round(rawTax * 100);
  const taxAmount = paise / 100;
  const cess = Math.round(afterDiscount * (Number(item.cessPercent) || 0)) / 100;
  if (isInterState) return { taxable: afterDiscount, cgst: 0, sgst: 0, utgst: 0, igst: taxAmount, cess };
  // An odd paisa leaves exactly half a paisa. Added up in floating point,
  // x.xx5 lands a hair either side, so screen, CSV and JSON rounded the same
  // half paisa differently. A 0.0000001 nudge makes every total of these
  // halves round it UP, everywhere, without moving anything else.
  const half = paise / 200 + (paise % 2 ? 1e-7 : 0);
  // 5 UTs without a legislature: CGST + UTGST; the SGST bucket stays zero.
  return { taxable: afterDiscount, cgst: half, sgst: isIntraUT ? 0 : half, utgst: isIntraUT ? half : 0, igst: 0, cess };
};

// v1.10.76 (#81) - GSTR-3B Table 6: input tax credit set off against output
// tax in the order the law requires (Section 49(5), 49A, Rule 88A). Each head
// used to be reduced only by its own credit, so CGST/SGST credit was stranded
// against an IGST liability and the cash payable was overstated.
//   1. IGST credit pays IGST, then CGST and SGST (it must be used up first;
//      the law allows any order between those two, so it goes first to
//      whatever their own credit cannot cover - otherwise CGST credit could be
//      left stranded while SGST is paid in cash)
//   2. CGST credit pays CGST, then IGST - never SGST
//   3. SGST credit pays SGST, then IGST - never CGST
// liability, credit: { igst, cgst, sgst }. Returns payable (cash), used (credit
// applied, by liability head) and carry (credit left over, by credit head).
export const setOffITC = (liability, credit) => {
  const r = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const due = { igst: r(liability?.igst), cgst: r(liability?.cgst), sgst: r(liability?.sgst) };
  const left = { igst: r(credit?.igst), cgst: r(credit?.cgst), sgst: r(credit?.sgst) };
  const used = { igst: 0, cgst: 0, sgst: 0 };
  const pay = (from, to, cap = Infinity) => {
    const amt = Math.min(left[from], due[to], cap);
    if (amt <= 0) return;
    left[from] = r(left[from] - amt); due[to] = r(due[to] - amt); used[to] = r(used[to] + amt);
  };
  pay('igst', 'igst');
  pay('igst', 'cgst', Math.max(0, due.cgst - left.cgst));
  pay('igst', 'sgst', Math.max(0, due.sgst - left.sgst));
  pay('igst', 'cgst'); pay('igst', 'sgst');
  pay('cgst', 'cgst'); pay('cgst', 'igst');
  pay('sgst', 'sgst'); pay('sgst', 'igst');
  return { payable: due, used, carry: left };
};

// v1.10.76 (#80) - stock, as a record each bill keeps of what it has done.
// Stock used to be taken out once, on a bill's first save, for EVERY type,
// and never again: editing a quantity left stock wrong, quotations and
// proformas took stock out though they sell nothing, and credit notes took
// it out instead of putting returned goods back.
// Now every bill saves data.stockApplied ({ productId: change }) and each
// save applies only the difference from what the bill last did.
const STOCK_SIGN = {
  'tax-invoice': -1, 'bill-of-supply': -1, composition: -1, 'delivery-challan': -1,
  'credit-note': 1, quotation: 0, proforma: 0,
};
// What a bill of this type and status should have done to stock.
export const stockEffect = (items, invoiceType, status) => {
  const sign = status === 'cancelled' ? 0 : (STOCK_SIGN[invoiceType || 'tax-invoice'] ?? -1);
  const out = {};
  if (!sign) return out;
  for (const it of items || []) {
    const q = Number(it?.quantity) || 0;
    if (!it?.productId || !q) continue;
    out[it.productId] = Math.round(((out[it.productId] || 0) + sign * q) * 1000) / 1000;
  }
  return out;
};
// What a saved bill has already done to stock. Bills saved before v1.10.76
// have no record: the editor had taken the quantity out for every type (put
// back again on cancel), and recurring bills made by the server never touched
// stock - so that is what they are taken to have done.
export const appliedStock = (bill) => {
  if (!bill?.data) return {};
  if (bill.data.stockApplied) return bill.data.stockApplied;
  if (bill.autoGenerated || bill.status === 'cancelled') return {};
  return stockEffect(bill.data.items, 'tax-invoice', bill.status);
};
// v1.10.83 (#121) - a product saved as a Service (kind: 'service') has no
// stock: it is never counted, never low and never "out of stock". Products
// saved before this have no kind and stay Goods.
export const isServiceProduct = (p) => p?.kind === 'service';
// Stock to show and alert on, or null when it is not tracked: a service, or a
// product whose stock was never entered (null/blank is "not tracked", not 0).
export const trackedStock = (p) => (isServiceProduct(p) || p?.stock === null || p?.stock === undefined || p?.stock === ''
  ? null : (Number(p.stock) || 0));
// Products at or below the low-stock threshold (services and untracked left out).
export const findLowStock = (products, threshold) => (products || [])
  .filter((p) => trackedStock(p) !== null && trackedStock(p) <= Number(threshold));
// The products a stock change ({ productId: change }) touches, with their new
// stock (store.js applyStockChanges saves them). A service is left out.
export const stockUpdates = (products, changes) => Object.keys(changes || {})
  .filter((id) => changes[id])
  .map((id) => (products || []).find((p) => p.id === id))
  .filter((p) => p && !isServiceProduct(p))
  .map((p) => ({ ...p, stock: Math.round(((Number(p.stock) || 0) + changes[p.id]) * 1000) / 1000 }));
// Change needed to go from one record to another (zero entries left out).
export const stockDelta = (from, to) => {
  const out = {};
  for (const id of new Set([...Object.keys(from || {}), ...Object.keys(to || {})])) {
    const d = Math.round(((Number(to?.[id]) || 0) - (Number(from?.[id]) || 0)) * 1000) / 1000;
    if (d) out[id] = d;
  }
  return out;
};

// v1.10.76 (#83) - the Subtotal an invoice prints. With "Prices include tax"
// totals.subtotal is the tax-INCLUSIVE gross, so printing it above the CGST/SGST
// rows added the tax twice on paper (Subtotal 2,400 + tax 320 "=" Total 2,400).
// Printed instead: taxable value before discount, so that
// Subtotal - Discount + taxes = Total, the same as for exclusive prices.
export const printedSubtotal = (t) => (t?.taxInclusive
  ? Math.round(((Number(t.taxableAmount) || 0) + (Number(t.totalDiscount) || 0)) * 100) / 100
  : (Number(t?.subtotal) || 0));

// What this client has already been billed in the financial year of
// `invoiceDate` (sales only, rupees, including GST), for the ₹50L threshold of
// sections 194Q / 206C(1H). `excludeId` leaves out the invoice being edited.
// Used by the invoice screen and the server's recurring invoices, so both
// count the same way (the invoice screen used to always pass 0, which made
// TCS/TDS 0 on any invoice under ₹50L however much the client had bought).
export const clientYearToDate = (bills, clientName, invoiceDate, excludeId = null) => {
  const name = String(clientName || '').trim().toLowerCase();
  if (!name) return 0;
  const fy = getFinancialYearLabel(invoiceDate ? parseLocalDate(invoiceDate) : new Date());
  return (bills || []).reduce((sum, b) => {
    if (!b || b.id === excludeId || !countsAsSales(b)) return sum;
    if ((b.currency || 'INR') !== 'INR') return sum;
    if (String(b.clientName || '').trim().toLowerCase() !== name) return sum;
    if (!b.invoiceDate || getFinancialYearLabel(parseLocalDate(b.invoiceDate)) !== fy) return sum;
    return sum + (Number(b.totalAmount) || 0);
  }, 0);
};

// Marking an invoice Paid by hand: record a payment for whatever is still
// owed, so payment history, receipts and reports agree with the status. Used
// by the Dashboard and the Clients screen (Clients used to set the paid amount
// only, with no payment). The id gives the payment a real receipt number.
export const markPaidPatch = (bill, note = 'Marked paid') => {
  const payments = Array.isArray(bill.payments) ? bill.payments : [];
  const already = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  // TDS the client deducts is not paid to us (see amountDue).
  const outstanding = Math.max(0, amountDue(bill) - already);
  const now = new Date();
  const amount = Math.round(outstanding * 100) / 100;
  const add = outstanding > 0.005;
  return {
    // What the payments add up to (it used to be the invoice total, even
    // when more had been received or TDS was deducted).
    paidAmount: Math.round((already + (add ? amount : 0)) * 100) / 100,
    payments: add
      ? [...payments, { id: `pay_${now.getTime()}`, amount, date: localToday(), mode: 'other', note, recordedAt: now.toISOString(), auto: true }]
      : payments,
  };
};

// v1.10.77 (#86) - choosing Unpaid takes back the payment that choosing Paid
// recorded (auto: true, or older ones noted "Marked paid ..."). It used to
// leave it, so an "Unpaid" invoice still showed the full amount as Paid and
// never offered a reminder. Payments you recorded (or edited) are kept, and
// the status then follows what they cover. Older "Marked paid" payments have
// no auto flag; they are recognised by that note with mode "other".
export const isAutoPaidPayment = (p) => !!p && (p.auto === true
  || (p.auto === undefined && p.mode === 'other' && /^Marked paid/i.test(String(p.note || ''))));
export const markUnpaidPatch = (bill) => {
  const payments = (Array.isArray(bill.payments) ? bill.payments : []).filter((p) => !isAutoPaidPayment(p));
  const paidAmount = Math.round(payments.reduce((s, p) => s + (Number(p.amount) || 0), 0) * 100) / 100;
  return { payments, paidAmount, status: paymentStatusFor(bill, paidAmount) };
};

// The online documentation. Help buttons link straight to the section for
// their screen, and the sidebar User Guide opens the start (v1.10.75). The
// build of docs-site checks that every doc="page#section" used in src exists.
export const DOCS_URL = 'https://dicecodes.com/free-gst-software-documentation/';
export const docsLink = (doc = '') => {
  const [page, section] = String(doc).split('#');
  if (!page || page === 'index') return DOCS_URL + (section ? `#${section}` : '');
  return `${DOCS_URL}${page}.html${section ? `#${section}` : ''}`;
};

// GSTR-1 B2C Large: an inter-state sale to an unregistered buyer above this
// invoice value is reported invoice by invoice. The limit fell from ₹2.5 lakh
// to ₹1 lakh for invoices from 1 August 2024 (Notification 12/2024-CT).
export const b2clThreshold = (invoiceDate) =>
  (String(invoiceDate || '') >= '2024-08-01' ? 100000 : 250000);

// GST rates the GST portal accepts in GSTR-1. 40% is the GST 2.0 rate from
// 22 Sep 2025; 12% and 28% stay for older invoices and the items still taxed so.
export const GST_PORTAL_RATES = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28, 40];

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
  { name: 'India', code: 'IN', currency: 'INR', currencySymbol: '₹', taxLabel: 'GST', taxIdLabel: 'GSTIN', taxIdPlaceholder: '22AAAAA0000A1Z5', bankLabel: 'IFSC Code', postalLabel: 'PIN Code', stateLabel: 'State', hasStates: true, taxRates: [0, 0.1, 0.25, 3, 5, 12, 18, 28, 40], taxIdRegex: /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d][A-Z][A-Z\d]$/ },
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

// v1.10.68 (#68, idea from @deppen12) — a GSTIN carries its own facts, so the
// state can be filled in and a typo caught without any API key or internet:
//   27 ABCDE1234F 2 Z 5
//   |  |          | | +- checksum over the first 14 characters
//   |  |          | +--- Z for a regular taxpayer (D = TDS, C = TCS)
//   |  |          +----- which registration of that PAN in that state
//   |  +---------------- the PAN, whose 4th letter is the kind of entity
//   +------------------- the state (2011 census code)
const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const PAN_ENTITY_TYPES = {
  P: 'Individual', C: 'Company', F: 'Firm / LLP', H: 'HUF', A: 'Association of persons',
  T: 'Trust', B: 'Body of individuals', L: 'Local authority', J: 'Artificial juridical person',
  G: 'Government',
};
const GSTIN_TAXPAYER_TYPES = { Z: 'Regular', D: 'TDS deductor', C: 'TCS collector' };

// Luhn mod 36 over the first 14 characters. Verified against real GSTINs:
// it rejects a single mistyped or transposed character, which is the whole
// point — a wrong GSTIN is only discovered when the return is rejected.
export const gstinChecksumOk = (value) => {
  const gstin = String(value || '').trim().toUpperCase();
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z][A-Z][0-9A-Z]$/.test(gstin)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i += 1) {
    const product = GSTIN_CHARS.indexOf(gstin[i]) * (i % 2 ? 2 : 1);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36] === gstin[14];
};

// Everything the number itself says. `state` is null for a code we do not
// know (96/97/99 are used for foreign country, other territory and centre
// jurisdiction), so callers can tell "unknown" from "wrong".
export const decodeGstin = (value) => {
  const gstin = String(value || '').trim().toUpperCase();
  if (gstin.length !== 15) return null;
  const stateCode = gstin.slice(0, 2);
  const pan = gstin.slice(2, 12);
  return {
    gstin,
    stateCode,
    state: stateNameForCode(stateCode),
    pan,
    entityType: PAN_ENTITY_TYPES[pan[3]] || null,
    registration: gstin[12],
    taxpayerType: GSTIN_TAXPAYER_TYPES[gstin[13]] || null,
    checksumOk: gstinChecksumOk(gstin),
  };
};

// v1.10.31 — GST-H1: legacy codes normalized.
// AP was reorganised in June 2014; old GSTINs with prefix `28` (before
// bifurcation) should map to the current code `37` (Andhra Pradesh).
// Daman & Diu had legacy code `25` before the 2020 merger into DNH+DD (`26`).
// Without normalisation, a `28ABCDE…` GSTIN and the current state "Andhra
// Pradesh" produced different codes → interstate/intrastate mis-classification.
const LEGACY_STATE_CODE_MAP = { '28': '37', '25': '26' };

// v1.10.68 — code -> state name. Built from INDIAN_STATES so the value is
// spelled exactly like the entry in the State dropdown: a title-cased copy
// would read "Dadra And Nagar Haveli..." and match no option at all.
const STATE_NAME_BY_CODE = INDIAN_STATES.reduce((acc, name) => {
  const code = GST_STATE_CODES[name.trim().toLowerCase()];
  if (code && !acc[code]) acc[code] = name;
  return acc;
}, {});
export const stateNameForCode = (code) => STATE_NAME_BY_CODE[String(code || '').trim()] || null;

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

// v1.10.76 (#82) - is a purchase inter-state? Compares the state in the
// supplier's GSTIN with the business's own (from its GSTIN, else its state).
// true / false when both are known, null when either is not - the caller then
// leaves the user's choice alone.
export const isInterstateSupply = (supplierGstin, profile) => {
  const g = String(supplierGstin || '').trim();
  if (!/^\d{2}[A-Z0-9]{13}$/i.test(g)) return null;
  const theirs = getStateCode(g);
  const ours = getStateCode(profile?.gstin || '') || getStateCode(profile?.state || '');
  if (!theirs || !ours) return null;
  return theirs !== ours;
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
  const d = parseLocalDate(dateStr);
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
  // Under a LUT (totals.lutZeroRated) no tax is charged: rates 0, and the
  // prices had no tax in them to back out.
  const zeroRated = !!totals?.lutZeroRated;
  const taxInclusive = !!opts.taxInclusive && !zeroRated;
  const fromStateCode = getStateCode(profile.state || profile.gstin);
  const toStateCode = getStateCode(client.state || client.gstin);
  // The invoice's own split (computeInvoiceTotals, which follows place of
  // supply, SEZ and exports) decides the per-item rates. Comparing the client's
  // state here could disagree with it - IGST rates on items whose header
  // carried CGST + SGST - and the portal rejects such a bill.
  const isInterstate = typeof totals?.isInterstate === 'boolean'
    ? totals.isInterstate
    : !!(fromStateCode && toStateCode && fromStateCode !== toStateCode);

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
  if (!fromPincode) throw new Error('Your business PIN code is missing. Add it in Settings → Company → Company Details (PIN Code), then click E-Way Bill again.');
  if (!toPincode) throw new Error("The client's PIN code is missing. Fill PIN Code under Billed To on this invoice (or on the client in Clients), then click E-Way Bill again.");

  const itemList = items.map((item, idx) => {
    // v1.10.1 — back-calculate taxable when the invoice is MRP-inclusive.
    // v1.10.22 — honour discountType (percent | fixed).
    // v1.10.31 — GST-C5: cess rate now populated per item (was 0).
    const gross = (Number(item.quantity) || 0) * (Number(item.rate) || 0) - resolveLineDiscount(item, taxInclusive);
    const taxRate = zeroRated ? 0 : Number(item.taxPercent) || 0;
    const cessRate = zeroRated ? 0 : Number(item.cessPercent) || 0;
    const taxable = taxInclusive && taxRate > 0
      ? gross / (1 + taxRate / 100)
      : gross;
    return {
      itemNo: idx + 1,
      productName: item.name || '',
      productDesc: item.name || '',
      hsnCode: Number(item.hsn) || 0,
      quantity: item.quantity || 0,
      qtyUnit: getUnitUQC(item.unit) === 'NA' ? 'OTH' : getUnitUQC(item.unit), // NA is not an e-way bill unit
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
    // Local date: toISOString() is UTC, which in India is the previous day
    // for a local midnight, so every due date was shown a day early.
    if (diff >= 0 && diff <= 60) out.push({ label, dueDate: toLocalIsoDate(dueDate), daysAway: diff });
  };
  // From LAST month: its returns fall due this month (GSTR-3B for September
  // is due 20 October) and are the most urgent ones. Starting at this month
  // left them out of the list entirely.
  for (let i = -1; i < 3; i++) {
    const nextMonth = new Date(t.getFullYear(), t.getMonth() + i, 1);
    const m = nextMonth.getMonth();
    const y = nextMonth.getFullYear();
    push(`GSTR-1 (${nextMonth.toLocaleString('en-IN', { month: 'short', year: 'numeric' })})`, new Date(y, m + 1, 11));
    push(`GSTR-3B (${nextMonth.toLocaleString('en-IN', { month: 'short', year: 'numeric' })})`, new Date(y, m + 1, 20));
    // Quarterly TDS / TCS — applies to the quarter the month falls into.
    const quarterEnd = m % 3 === 2; // Mar / Jun / Sep / Dec
    if (quarterEnd) {
      // The January-March quarter is due later: 26Q on 31 May, 27EQ on 15 May.
      const isQ4 = m === 2;
      push(`Form 26Q (TDS Q ending ${nextMonth.toLocaleString('en-IN', { month: 'short' })})`, isQ4 ? new Date(y, 4, 31) : new Date(y, m + 2, 0)); // last day of next month after quarter
      push(`Form 27EQ (TCS Q ending ${nextMonth.toLocaleString('en-IN', { month: 'short' })})`, isQ4 ? new Date(y, 4, 15) : new Date(y, m + 1, 15));
    }
  }

  // Advance-tax installments — same 60-day lookahead. Users on the presumptive
  // scheme (single 15-Mar payment) still see all four so they can plan cashflow,
  // but the interest calc only fires against the 15-Mar row.
  // Each date is tried this year and next; push() keeps only the ones 0-60
  // days away. (The 15 March instalment used to jump to next year from
  // 1 March, so it never showed in the fortnight it is due.)
  const advDates = [
    { label: 'Advance Tax Installment 1 (15% cumulative)', month: 5 },   // 15 Jun
    { label: 'Advance Tax Installment 2 (45% cumulative)', month: 8 },   // 15 Sep
    { label: 'Advance Tax Installment 3 (75% cumulative)', month: 11 },  // 15 Dec
    { label: 'Advance Tax Installment 4 (100% — final)',    month: 2 },   // 15 Mar
  ];
  for (const y of [t.getFullYear(), t.getFullYear() + 1]) {
    advDates.forEach(a => push(a.label, new Date(y, a.month, 15)));
    // ITR for the year that ended on 31 March: 31 July / 31 October. It used
    // to point at the NEXT year's deadline from April, so the one actually
    // due that July never appeared.
    push('ITR filing (non-audit) — due', new Date(y, 6, 31));
    push('ITR filing (audit / §44AB) — due', new Date(y, 9, 31));
  }

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
// v1.10.51 — Does this rich-text HTML contain any actual visible text?
//
// Adapted from a fix proposed by @venkateshpabbati in #38. The previous
// idiom, duplicated in five places, was:
//
//     html.replace(/<[^>]*>/g, '').trim()
//
// which strips tags but leaves HTML ENTITIES encoded. So `<p>&nbsp;</p>`
// — precisely what a rich-text editor leaves behind when the user clears
// the field — survives as the literal string "&nbsp;" and reads as
// non-empty. The invoice then printed a "Terms & Conditions" heading with
// nothing underneath it.
//
// Parsing decodes entities, and String.trim() treats U+00A0 as
// whitespace, so a cleared field correctly reads as empty. Parsing is
// also robust against tag text the regex mis-handles, e.g.
// `<div title="a>b">`.
//
// Note this is an EMPTINESS CHECK, not a sanitisation boundary — the
// rendering path still runs the HTML through DOMPurify. Parsing with
// DOMParser is inert: it builds a detached document that never executes
// scripts or loads resources.
export const htmlHasText = (html) => {
  if (!html) return false;
  try {
    const doc = new DOMParser().parseFromString(String(html), 'text/html');
    return (doc.body?.textContent || '').trim().length > 0;
  } catch {
    // Non-browser context (SSR, tests) — fall back to the old behaviour
    // rather than reporting every field as empty.
    return String(html).replace(/<[^>]*>/g, '').trim().length > 0;
  }
};

// ERR-006 - a client's paper is saved and restored WITH its custom size: the
// key 'custom' alone came back with no width, which getPaperSize reads as
// 80mm, i.e. a thermal receipt. Falls back to the invoice's current paper, not
// to A4 (a shop that prints everything on 80mm keeps it). Tested in tax-test.
export const clientPaperPrefs = (options = {}) => ({
  preferredPaperSize: options.paperSize || 'a4',
  preferredCustomPaperWidth: options.customPaperWidth || 80,
  preferredCustomPaperHeight: options.customPaperHeight || 297,
});
export const clientPaperOptions = (cli, prev = {}) => ({
  paperSize: cli?.preferredPaperSize || prev.paperSize || 'a4',
  customPaperWidth: cli?.preferredCustomPaperWidth || prev.customPaperWidth || 80,
  customPaperHeight: cli?.preferredCustomPaperHeight || prev.customPaperHeight || 297,
});

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

// v1.10.53 — THE single definition of "which financial year is this date in".
//
// India's FY runs 1 April → 31 March, so the FY that a date belongs to is
// NOT its calendar year for January, February and March — those months
// belong to the FY that started the previous April.
//
// This existed correctly inside getFYOptions and the ITR helper, but
// store.js had reimplemented it as a bare `new Date().getFullYear()`,
// which stamped the WRONG financial year onto every invoice number minted
// between 1 Jan and 31 Mar — three months a year, on the number that gets
// reported in GSTR-1. Anything that needs the FY of a date calls this.
//
//   getFinancialYearStart(new Date('2027-01-15')) === 2026   (FY 2026-27)
//   getFinancialYearStart(new Date('2027-04-01')) === 2027   (FY 2027-28)
// v1.10.60 — reported (#50, @sangwanmail-eng): "Terms and conditions show
// as paragraph in formatted".
//
// The 13 built-in presets all use real <ul>/<li> markup and render as
// lists. But many users type or paste their own terms from Word as ONE
// paragraph with the numbers typed by hand:
//
//   <p>1. Payment due in 15 days. 2. Interest 18% p.a. 3. ...</p>
//
// That is genuinely a single paragraph, so no stylesheet can separate it —
// the app was faithfully rendering what was written. It still reads as a
// wall of text on the invoice, which is the complaint.
//
// This splits such a paragraph at the numbering. It is deliberately
// conservative: it needs THREE OR MORE markers before it will touch
// anything, so ordinary prose containing "Section 2. of the Act" or a
// price like "Rs 2. 50" is left alone. Content already using <li> or <br>
// is skipped entirely — that is already structured.
export const splitNumberedTerms = (html) => {
  if (!html || typeof html !== 'string') return html;
  // v1.10.77 (#84) - plain text (a Terms template typed in Settings, which
  // has no formatting) keeps its line breaks. HTML ignores them, so separate
  // lines printed as one paragraph.
  if (!/<[a-z!/][^>]*>/i.test(html) && /\n/.test(html)) return html.trim().replace(/\r?\n/g, '<br />');
  if (/<(li|br)[ />]/i.test(html)) return html;   // already structured — leave it alone
  const marker = /(^|[\s>])(\d{1,2})\.\s+/g;
  const count = (html.match(marker) || []).length;
  if (count < 3) return html;                         // not a list
  // Break before every marker except the first, so item 1 keeps its place.
  let seen = 0;
  return html.replace(marker, (m, pre, num) => {
    seen += 1;
    return seen === 1 ? m : `${pre}<br />${num}. `;
  });
};

// v1.10.77 (#84) - the saved business profile that is the SAME business as
// this one: the same GSTIN, or the same name on a saved profile that has no
// GSTIN yet (ignoring case and spaces). Saving updates that profile instead of
// adding a duplicate; matching on the name only let the same GSTIN be saved
// twice under two spellings. A different GSTIN is a different business (two
// branches can share a name), and a profile without a GSTIN never overwrites
// one that has it. `loaded` is the saved profile the form was loaded from:
// with the same name it is the one to update (a corrected GSTIN typo).
export const findSameBusiness = (list, p, loaded = null) => {
  const norm = (v) => String(v || '').trim().replace(/\s+/g, ' ').toUpperCase();
  const gstin = norm(p?.gstin);
  const name = norm(p?.businessName);
  return (list || []).find((bp) => (gstin && norm(bp.gstin) === gstin) || (name && norm(bp.businessName) === name && !norm(bp.gstin)))
    || (loaded && name && norm(loaded.businessName) === name ? loaded : null);
};

// v1.10.64 — requested (#55, @sangwanmail-eng): "keep both companies' data
// stored and displayed separately based on their respective GST numbers. An
// invoice belonging to one company should not appear under the other."
//
// Multi-business profiles already switch the letterhead, but every list —
// dashboard, GST returns, reports — showed ALL invoices regardless of which
// business was active. Two businesses meant one mixed set of books.
//
// Scoping by GSTIN rather than by a profile id is deliberate, and it is what
// makes this safe to ship:
//
//   * Older invoices carry NO profile id — the field was added later. Had we
//     filtered on it, every historical invoice would have vanished from the
//     user's books the moment they updated. In accounting software that is
//     the worst failure available.
//   * Every invoice, however old, stores the seller's details at save time
//     under `data.profile`, so the GSTIN is always there to match on.
//   * It survives a rename. This user has invoices reading "Dice Codes" and
//     "Anahat Exclusive" under one GSTIN — the same business, renamed. GSTIN
//     keeps them together; matching on name would have split them in two.
//
// A business with no GSTIN yet (not registered, or mid-setup) falls back to
// its name. And anything we cannot attribute at all is SHOWN, never hidden —
// if in doubt the user sees their invoice.
const normaliseGstin = (v) => String(v || '').trim().toUpperCase();
const normaliseName = (v) => String(v || '').trim().toLowerCase();

// v1.10.65 (#58 item 3) — expenses, purchase bills and recurring templates
// have no `data.profile` block: invoices snapshot the seller onto themselves,
// those records never did. So they also carry a plain `ownerGstin` /
// `ownerName`, stamped when they are saved.
//
// Note the field names. A purchase bill already has `supplierGstin` and an
// expense has `vendorGstin` — those are the OTHER party. Confusing the two
// would file your own purchases under your supplier's business, so the
// owning business is named `owner*` and never read from those fields.
export const getRecordSeller = (record) => ({
  gstin: normaliseGstin(record?.data?.profile?.gstin ?? record?.ownerGstin),
  name: normaliseName(record?.data?.profile?.businessName ?? record?.ownerName),
});

/**
 * Has this record never been attributed to any business?
 *
 * These are records saved before businesses were kept separate. They show
 * under every business, because hiding them would be worse than showing them
 * twice — which is also why the user is offered the chance to assign them
 * rather than having it done silently on their behalf.
 */
export const isUnassignedToBusiness = (record) => {
  const seller = getRecordSeller(record);
  return !seller.gstin && !seller.name;
};

/**
 * Does this saved record belong to the business currently selected?
 *
 * Returns TRUE when it cannot be determined, so an un-attributable record is
 * always visible rather than silently lost.
 */
export const belongsToProfile = (record, profile) => {
  if (!profile) return true;                     // no active business — show everything
  const seller = getRecordSeller(record);
  const activeGstin = normaliseGstin(profile.gstin);
  const activeName = normaliseName(profile.businessName);

  // Prefer GSTIN: unique per taxpayer, and unaffected by renames.
  if (seller.gstin && activeGstin) return seller.gstin === activeGstin;
  // Fall back to the business name when either side has no GSTIN.
  if (seller.name && activeName) return seller.name === activeName;
  // Not attributable — show it.
  return true;
};

export const getFinancialYearStart = (date = new Date()) => (
  date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1
);

// "2026-27" — the short form used on invoice numbers and FY dropdowns.
export const getFinancialYearLabel = (date = new Date()) => {
  const y = getFinancialYearStart(date);
  return `${y}-${String(y + 1).slice(-2)}`;
};

// Fiscal-year dropdown options for the last N years. Was previously
// duplicated in 5 files (Dashboard / PurchaseBills / ExpenseTracker /
// GSTReturns / ReportsView) — extracted here so a bugfix only has to
// touch one place. Each entry: { value, label, from, to }.
export const getFYOptions = (n = 5, today = new Date()) => {
  const currentYear = getFinancialYearStart(today);
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
  const d = parseLocalDate(dateStr);
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
  // v1.10.84 (#143) - a service with no quantity: the line's amount is its
  // rate (quantity is held at 1 and printed as "-"), and GSTR-1 reports UQC
  // NA with quantity 0, as the portal expects.
  { label: 'NA',      uqc: 'NA',  kind: 'both' },
];

// Default unit per invoice mode — used when adding a new line item so the user
// doesn't have to flip the unit dropdown 90% of the time.
// v1.10.77 (#87) - delivery / shipping charges. Added as their own invoice
// line (SAC 996812), so every total, GST return, HSN summary, report and
// export includes them with no special case. Delivery billed with the goods
// is a composite supply, taxed at the rate of the goods (the principal
// supply), so the line starts at the highest GST rate on the invoice; the
// user can change it. isCharge keeps it out of stock and product sales.
export const DELIVERY_SAC = '996812';
export const deliveryChargeLine = (items, amount = 0) => {
  const goodsRates = (items || []).filter((i) => !i.isCharge).map((i) => Number(i.taxPercent) || 0);
  return {
    id: `dlv-${Date.now()}`, name: 'Delivery charges', description: '', hsn: DELIVERY_SAC,
    quantity: 1, unit: 'Nos', rate: Number(amount) || 0, discount: 0,
    taxPercent: goodsRates.length ? Math.max(...goodsRates) : 18, cessPercent: 0, isCharge: true,
  };
};

export const getDefaultUnitForMode = (mode) => {
  if (mode === 'services') return 'Hrs';
  if (mode === 'mixed') return 'Pcs';
  return 'Pcs'; // goods (default) - #66 item 2
};

// Filter units by invoice mode for the dropdown. Service mode hides
// kg/ltr/box etc. (the user can still pick them via "Add custom…" if
// they truly need a goods unit on a service invoice — rare).
// v1.10.83 - in Services mode the units a freelancer reaches for come first.
const SERVICE_UNITS_FIRST = ['Hrs', 'Day', 'Month', 'Project', 'Nos'];
export const filterUnitsByMode = (units, mode) => {
  if (mode === 'mixed' || !mode) return units;
  const list = units.filter(u => u.kind === mode || u.kind === 'both' || u.custom);
  if (mode !== 'services') return list;
  const rank = (u) => { const i = SERVICE_UNITS_FIRST.indexOf(u.label); return i === -1 ? SERVICE_UNITS_FIRST.length : i; };
  return list.map((u, i) => [u, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([u]) => u);
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
// v1.10.77 - GSTR-1 HSN summary: a service (SAC 99xxxx) has no unit; the
// portal expects UQC "NA" and quantity 0 for it (delivery charges, setup fees).
export const hsnUqc = (item) => (/^99/.test(String(item?.hsn || '').trim()) ? 'NA' : getUnitUQC(item?.unit));

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
// v1.10.83 - `total` (in the invoice currency) adds the invoice value in the
// base currency, e.g. "1 USD = 84.1000 INR · Total ₹84,100.00".
export const formatExchangeRateLine = (currency, rate, baseCurrency = 'INR', total = null) => {
  if (!rate || !currency || currency === baseCurrency) return '';
  const line = `1 ${currency} = ${Number(rate).toFixed(4)} ${baseCurrency}`;
  if (total === null || !(Number(rate) > 0)) return line;
  return `${line} · Total ${formatCurrency(Math.round(Number(total) * Number(rate) * 100) / 100, baseCurrency)}`;
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
  // v1.10.37 — Reported: bank account name often differs from the trading
  // name (proprietor's personal name for sole proprietorships, HUF name,
  // abbreviated Pvt Ltd name, etc.). Client NEFT/RTGS transfers fail with
  // "beneficiary name mismatch" when the name doesn't match exactly.
  // Optional — falls back to profile.businessName on the PDF render.
  accountHolderName: '',
  accountNumber: '',
  // v1.10.37 — Optional. NEFT/RTGS doesn't strictly need this but corporate
  // finance teams often categorize by type, and wholesale users routinely
  // use CC/OD accounts. 'savings' | 'current' | 'cc' | 'od' | ''.
  accountType: '',
  ifsc: '',
  swift: '',
  // v1.10.83 - getting paid from abroad: IBAN (for clients in Europe / the
  // Gulf) and a PayPal / Wise / Payoneer link, printed on foreign-currency invoices.
  iban: '',
  paymentLink: '',
  // RBI purpose code for payments from abroad (utils/purposeCodes.js).
  purposeCode: '',
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
export const isValidUpiId = (s) => /^[\w.-]+@[\w.-]+$/.test(String(s || '').trim());

// ========== Feature modules ==========
// Each module can be turned off by the user in Settings → Features. `core`
// modules are always on (creating invoices, managing clients, the dashboard)
// — disabling them would leave the app unusable. Turning a module off only
// hides it; no data is ever deleted.
//
// v1.10.83 - the sidebar is listed item by item in MENU_ITEMS (order,
// switch, one plain line each), and the other modules are grouped by the
// screen they live on, so the Features tab reads like the app itself.
// `module: null` = always shown (Settings, Support & About with the
// DiceCodes branding, and Lock app, which only appears once a PIN is set).
// `section` is the part of the sidebar: 'main' (top) or 'bottom'.
export const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', module: 'dashboard', core: true, section: 'main', help: 'Your sales, dues and shortcuts at a glance.' },
  { id: 'new', label: 'New invoice', module: 'invoicing', core: true, section: 'main', help: 'Tax invoices, quotations, credit notes and challans.' },
  { id: 'clients', label: 'Clients', module: 'clients', core: true, section: 'main', help: 'The people and businesses you bill.' },
  { id: 'inventory', label: 'Products', module: 'inventory', section: 'main', help: 'Your product and service list, with stock.' },
  { id: 'expenses', label: 'Expenses', module: 'expenses', section: 'main', help: 'Rent, salaries and other running costs.' },
  { id: 'purchases', label: 'Purchases', module: 'purchases', section: 'main', help: 'Bills from your suppliers, for stock and input tax credit.' },
  { id: 'recurring', label: 'Recurring', module: 'recurring', section: 'main', help: 'Invoices that repeat every week, month or year.' },
  { id: 'receipts', label: 'Receipts', module: 'receipts', section: 'main', help: 'Payment receipts for money you receive.' },
  { id: 'cashbook', label: 'Cash book', module: 'cashBook', section: 'main', help: 'Cash in and out with names and notes, and the cash in hand.' },
  { id: 'reports', label: 'Reports', module: 'reports', section: 'main', help: 'Sales, profit and loss, dues and stock reports.' },
  { id: 'filing', label: 'GST returns', module: 'gstReturns', section: 'main', indiaOnly: true, help: 'GSTR-1 and GSTR-3B files, with a filing guide.' },
  { id: 'incometax', label: 'Income tax', module: 'incomeTax', section: 'main', indiaOnly: true, help: 'Old vs new regime calculator and bank statement import.' },
  { id: 'guide', label: 'User guide', module: 'guide', section: 'top', help: 'The ? button at the top right: opens the online help.' },
  { id: 'notifications', label: 'Notifications', module: 'notifications', section: 'top', help: 'Bell at the top right: overdue invoices, GST due dates and low stock.' },
  { id: 'lock', label: 'Lock app', module: null, section: 'top', help: 'Padlock at the top right, shown only when a PIN is set.' },
  { id: 'offline', label: 'Offline mode', module: 'offlineButton', section: 'top', help: 'Wi-Fi button at the top right: turn Offline mode on or off, and see what changes.' },
  { id: 'darkMode', label: 'Dark mode', module: 'darkMode', section: 'top', help: 'Moon / sun button at the top right: light or dark screens.' },
  { id: 'support', label: 'Support & About', module: null, section: 'bottom', help: 'Who makes this app, version and how to get help.' },
  { id: 'controlpanel', label: 'Control Panel', module: 'controlPanel', section: 'bottom', help: 'Update, backup, restore and move to another PC.' },
  { id: 'settings', label: 'Settings', module: null, section: 'bottom', help: 'Always here, so you can turn things back on.' },
];

export const FEATURE_GROUPS = [
  {
    id: 'menu',
    label: 'Menu',
    modules: MENU_ITEMS.filter(m => m.module).map(m => ({
      id: m.module, label: m.label, help: m.help, core: !!m.core, indiaOnly: !!m.indiaOnly, defaultOn: true,
    })),
  },
  {
    id: 'invoice',
    label: 'Invoice screen',
    modules: [
      // v1.10.83 - this switch used to do nothing (the TDS / TCS boxes always
      // showed), so its default is now "on": updating changes nothing for
      // anyone who bills with TDS. New installs get it from their business type.
      { id: 'tdsTcs', label: 'TDS / TCS', help: 'Show tax deducted or collected at source on an invoice.', defaultOn: true, indiaOnly: true },
      { id: 'ewayBill', label: 'E-way bill', help: 'Button to download the e-way bill file for goods you send.', defaultOn: true, indiaOnly: true },
      // v1.10.83 (#111) - off by default: only businesses above the turnover
      // limit need it, and everyone else should never see it.
      { id: 'einvoice', label: 'E-invoicing (IRN)', help: 'Only if your yearly turnover is above ₹5 crore: make the e-invoice file and print the IRN with its QR code.', defaultOn: false, indiaOnly: true },
      // v1.10.84 (#129) - cafes and shops find or add the customer by phone.
      { id: 'phoneFirst', label: 'Customer phone box', help: 'A phone box at the top of the invoice: typing a number fills in that customer, or adds a new one with just a name. Clients shows their visits.', defaultOn: true },
      { id: 'upiQr', label: 'UPI QR code', help: 'Print a UPI QR code so customers can pay by scanning.', defaultOn: true, indiaOnly: true },
      // v1.10.84 (#140) - glass, mirror, flex, tile shops; off until wanted.
      { id: 'sizeBilling', label: 'Size billing (Sq.ft)', help: 'For glass, mirror, flex and tile shops: an item line can be "Sq.ft" - type Length x Width in inches and the pieces, pick 3 or 6 inch rounding, and the square feet and amount are worked out. The invoice prints Size and SQFT columns.', defaultOn: false },
    ],
  },
  {
    id: 'purchases',
    label: 'Purchases screen',
    modules: [
      // v1.10.83 (#112) - a tab on the Purchases screen; off until wanted.
      { id: 'purchaseOrders', label: 'Purchase orders', help: 'Send orders to suppliers and turn them into bills when goods arrive.', defaultOn: false },
      { id: 'gstr2b', label: 'GSTR-2B matching', help: 'Match your purchase bills with GSTR-2B (a tab on GST returns).', defaultOn: true, indiaOnly: true },
    ],
  },
  {
    id: 'products',
    label: 'Products screen',
    modules: [
      // v1.10.83 (#115) - off by default: most shops buy and sell, they do not make.
      { id: 'manufacturing', label: 'Manufacturing (bill of materials)', help: 'Say what goes into a product, then "Make" it to move the stock.', defaultOn: false },
    ],
  },
  {
    id: 'reports',
    label: 'Reports screen',
    modules: [
      // v1.10.83 (#112) - off by default: most shops have one branch, and the
      // picker on every form would only be noise for them.
      { id: 'costCentres', label: 'Cost centres', help: 'Tag bills, purchases and expenses with a branch, site or project, and see profit for each.', defaultOn: false },
    ],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    modules: [
      { id: 'googleDrive', label: 'Google Drive', help: 'Save invoice PDFs and backups to your Google Drive.', defaultOn: true },
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
    body: `<p><strong>Tax Status:</strong> SUPPLY MEANT FOR EXPORT/SUPPLY TO SEZ UNIT OR SEZ DEVELOPER FOR AUTHORISED OPERATIONS UNDER BOND OR LETTER OF UNDERTAKING WITHOUT PAYMENT OF INTEGRATED TAX. LUT ARN: <em>[insert LUT ARN]</em>.</p>
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
//
// v1.10.73 - 206C(1H) (TCS on sale of goods) was omitted from 1 April 2025 by
// the Finance Act 2025, so new invoices can no longer pick it. Invoices saved
// with it keep it and reprint unchanged (see REMOVED_TCS_SECTIONS).
export const REMOVED_TCS_SECTIONS = { '206C(1H)': '206C(1H) — removed from 1 April 2025 (older invoices only)' };
export const TCS_SECTIONS = [
  // 0.5% since 10 July 2024 (Notification 15/2024-Central Tax; 1% before).
  // Saved invoices keep the rate they were made with.
  { code: '52',       label: 'CGST 52 — E-commerce operator', rate: 0.5 },
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

// v1.10.79 (#94) - where the editor keeps an invoice's PDF in Saved Invoices:
// <client>/<month>/<TYPE>_<number>.pdf (see saveToInvoicesFolder).
export const savedPdfNameFor = (bill) => ({
  fileName: `${INVOICE_TYPES[bill?.invoiceType || bill?.data?.invoiceType || 'tax-invoice']?.prefix || 'INV'}_${String(bill?.invoiceNumber || bill?.id || '').replace(/\//g, '-')}.pdf`,
  clientName: bill?.data?.client?.name || 'General',
});

// v1.10.79 (#95) - a place of supply the way the GST portal writes it:
// "10-Bihar". Takes a code, a state name or a GSTIN.
export const placeOfSupplyLabel = (stateOrCode) => {
  const raw = String(stateOrCode || '').trim();
  const code = /^\d{2}$/.test(raw) ? raw : getStateCode(raw);
  if (!code) return raw;
  const name = PORTAL_STATE_NAMES[code] || INDIAN_STATES.find((s) => getStateCode(s) === code);
  return name ? `${code}-${name}` : code;
};
// The GST portal's own spelling where it differs from INDIAN_STATES.
const PORTAL_STATE_NAMES = {
  '01': 'Jammu & Kashmir', '26': 'Dadra & Nagar Haveli & Daman & Diu', '35': 'Andaman & Nicobar Islands', '97': 'Other Territory',
};

// v1.10.79 (#96) - a quantity that was added up (6356.96 kg over many
// invoices) comes out of floating point as 6356.959999999999. Round it once,
// where it is shown or exported: 3 decimals on screen (grams, millilitres),
// 2 for the GST portal (its quantity field takes 2).
export const roundQty = (n, places = 3) => {
  const f = 10 ** places;
  return Math.round((Number(n) || 0) * f) / f;
};

// v1.10.78 (#93) - the next number of a document counter: one more than the
// last one used, but at least `start`, so a business can carry on from its
// paper bill book (1001). A number already used is never handed out again.
// Only tax invoices pass a start ("Start numbering from" in Settings; see
// startFor); every other type counts from 1.
export const MAX_START_NUMBER = 999999999;
export const nextCounterValue = (current, start = 1) => {
  const last = Math.max(0, Math.floor(Number(current) || 0));
  const from = Math.min(MAX_START_NUMBER, Math.max(1, Math.floor(Number(start) || 1)));
  return Math.max(last + 1, from);
};
// The start a document type uses: Settings' start for tax invoices, else 1.
export const startFor = (invoiceType, numberSettings) =>
  ((invoiceType || 'tax-invoice') === 'tax-invoice' ? numberSettings?.startNumber : 1);

// ---- v1.10.79 (#95) invoice number series ----
// Each business can have its own series (own prefix, start, counters) or use
// the shared one. Invoices are stored under their number, so a business with
// its own series must print a prefix no other series uses.
export const DOC_TYPE_PREFIXES = ['INV', 'QUO', 'EST', 'BOS', 'COMP', 'CN', 'DC', 'RCP'];
export const DEFAULT_NUMBER_SETTINGS = { format: 'branded', brandPrefix: '', separator: '/', showFinYear: true, startNumber: 1, padDigits: 4 };
// Who a series belongs to: the GSTIN, else the business name (as belongsToProfile matches).
export const businessKeyOf = (profile) => {
  const gstin = String(profile?.gstin || '').trim().toUpperCase();
  if (gstin) return gstin;
  const name = String(profile?.businessName || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return name ? `NAME:${name}` : '';
};
// The settings a business numbers with: its own series, else the shared one.
export const numberSeriesFor = (shared, seriesMap, businessKey) => {
  const base = { ...DEFAULT_NUMBER_SETTINGS, ...(shared || {}) };
  const own = businessKey ? seriesMap?.[businessKey] : null;
  return own ? { ...base, ...own, own: true } : { ...base, own: false };
};
// The counter a document type uses in that series.
export const counterKeyFor = (typePrefix, series, businessKey) =>
  (series?.own && businessKey ? `counter_${typePrefix}@${businessKey}` : `counter_${typePrefix}`);
// A document number. With a brand prefix, tax invoices print the brand alone
// (ACME/2026-27/0001) and every other type the brand and its type
// (ACME-QUO/..., ACME-DC/..., ACME-RCP/...): they count separately, so one
// prefix for all of them made a quotation collide with an invoice of the same
// number. A per-type prefix from Print Settings (explicitPrefix) is used as is.
export const formatDocNumber = ({ settings, typePrefix, next, explicitPrefix = false, fyLabel = '' }) => {
  const s = { ...DEFAULT_NUMBER_SETTINGS, ...(settings || {}) };
  const brand = String(s.brandPrefix || '').trim();
  const pfx = explicitPrefix ? typePrefix : (brand ? (typePrefix === 'INV' ? brand : `${brand}-${typePrefix}`) : typePrefix);
  const sep = s.separator || '/';
  if (s.format === 'random') return `${pfx}${sep}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const padded = String(next).padStart(s.padDigits || 4, '0');
  // fyStyle 'short' writes 26-27 instead of 2026-27 (two characters fewer
  // against the portal's 16).
  const fy = s.fyStyle === 'short' ? String(fyLabel).replace(/^\d\d(?=\d\d-)/, '') : fyLabel;
  return s.showFinYear && fy ? `${pfx}${sep}${fy}${sep}${padded}` : `${pfx}${sep}${padded}`;
};

// v1.10.84 (#145) - the counter value a hand-typed number stands for, when it
// is written exactly as the series writes its numbers (same prefix, year,
// separator; any zero padding); otherwise null. `format` is the series'
// value -> number function.
export const seriesNumberOf = (typed, format) => {
  const t = String(typed || '').trim();
  const m = t.match(/(\d+)$/);
  const n = m ? Number(m[1]) : 0;
  if (!(n >= 1) || n > MAX_START_NUMBER) return null;
  const w = String(format(n));
  const wm = w.match(/(\d+)$/);
  return wm && Number(wm[1]) === n && w.slice(0, -wm[1].length) === t.slice(0, -m[1].length) ? n : null;
};

// GST (CGST Rule 46 / 53): an invoice, bill of supply or credit note number is
// at most 16 characters of letters, digits, "-" and "/"; GSTR-1 refuses any
// other. Why this number format breaks that, or '' when it does not.
export const GST_DOC_NUMBER = /^[A-Za-z0-9\-/]{1,16}$/;
// Checked: what GSTR-1 refuses. (Bills of supply have the same legal limit;
// the default COMP/2026-27/0001 is 17 characters - to be decided separately.)
const GST_NUMBERED_TYPES = ['tax-invoice', 'credit-note'];
export const numberFormatProblem = (settings, { nextInvoice = 1, own = false, customPrefixes = {}, fyLabel = '' } = {}) => {
  const s = { ...DEFAULT_NUMBER_SETTINGS, ...(settings || {}) };
  if (s.format !== 'random' && !/^[-/]$/.test(s.separator || '/')) return `The GST portal does not accept "${s.separator}" in invoice numbers. Use / or -.`;
  for (const type of GST_NUMBERED_TYPES) {
    const override = own ? '' : String(customPrefixes?.[type] || '').trim();
    const sample = formatDocNumber({
      settings: s.format === 'random' ? { ...s, format: 'branded', showFinYear: false, padDigits: 6 } : s,
      typePrefix: override || INVOICE_TYPES[type].prefix, explicitPrefix: !!override,
      next: type === 'tax-invoice' ? nextInvoice : 1, fyLabel,
    });
    if (!GST_DOC_NUMBER.test(sample)) {
      return `${INVOICE_TYPES[type].label} numbers would look like ${sample}: ${sample.length} characters, but the GST portal allows 16. Use a shorter prefix, the short year (${String(fyLabel).replace(/^\d\d(?=\d\d-)/, '') || '26-27'}), or fewer digits.`;
    }
  }
  return '';
};
// Why a business's own prefix cannot be used, or '' when it can. Its numbers
// must never look like another series' numbers.
export const ownPrefixProblem = (prefix, { shared, seriesMap, businessKey, customPrefixes } = {}) => {
  const p = String(prefix || '').trim().toUpperCase();
  if (!p) return 'A business with its own numbering needs its own prefix, such as its initials.';
  if (DOC_TYPE_PREFIXES.includes(p)) return `${p} is used for every business by default. Choose another prefix.`;
  if (p === String(shared?.brandPrefix || '').trim().toUpperCase()) return `${p} is the shared numbering's prefix. Choose another.`;
  const takenBy = Object.entries(seriesMap || {}).find(([k, v]) => k !== businessKey && String(v?.brandPrefix || '').trim().toUpperCase() === p);
  if (takenBy) return `Another business already numbers with ${p}. Choose another.`;
  if (Object.values(customPrefixes || {}).some((v) => String(v || '').trim().toUpperCase() === p)) return `${p} is a document prefix in Print Settings. Choose another.`;
  return '';
};

// v1.10.74 - today's LOCAL date as YYYY-MM-DD (toISOString is UTC, so before
// 05:30 IST it gave yesterday). Call it when needed, not once at load.
export const toLocalIsoDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const localToday = () => toLocalIsoDate(new Date());

// A YYYY-MM-DD string as a LOCAL date. new Date('2026-04-01') is midnight UTC,
// which west of Greenwich is still 31 March - the wrong month, quarter and
// financial year. Anything else is passed to new Date() as before.
export const parseLocalDate = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
};

// What the client still has to pay to settle a bill: the total less any TDS
// the client deducts (they pay "Net Receivable" and deposit the TDS with the
// government). Without this an invoice with TDS could never become Paid.
export const amountDue = (bill) => {
  const total = Number(bill?.totalAmount) || 0;
  const tds = Number(bill?.data?.totals?.tdsAmount) || 0;
  return Math.round((total - Math.min(Math.max(0, tds), total)) * 100) / 100;
};
// Status a bill's payments put it in (cancelled is never decided here).
export const paymentStatusFor = (bill, paid) => {
  const due = amountDue(bill);
  if (due > 0 && paid >= due - 0.005) return 'paid';
  return paid > 0.005 ? 'partial' : 'unpaid';
};

// v1.10.83 (#117) - the purchase tax as the bill shows it: IGST between
// states, otherwise CGST + SGST, half each. SGST takes the odd paisa, so the
// two always add up to the tax exactly (filing needs the heads separately).
export function splitPurchaseTax(tax, interstate) {
  const t = Math.round((Number(tax) || 0) * 100) / 100;
  if (interstate) return { cgst: 0, sgst: 0, igst: t };
  const cgst = Math.round(t * 50) / 100;
  return { cgst, sgst: Math.round((t - cgst) * 100) / 100, igst: 0 };
}
