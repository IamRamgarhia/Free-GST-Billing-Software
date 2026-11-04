import { useState, useEffect, useRef, useMemo } from 'react';
import { FileText, Download, Upload, ExternalLink, CheckCircle, ChevronDown, ChevronRight, AlertTriangle, BookOpen, BarChart3 } from 'lucide-react';
import { getAllBills, getAllExpenses, getAllPurchases, getProfile, getEnabledModules } from '../store';
import { hsnTable, stripEmpty, lineTreatment, nilTable, expTable, exportNote, b2bInvType, docIssueSummary, docIssueDetails, cleanGstin, gstinFormatOk, hsnSplitFrom, hsnSummary, mergeHsnRows, hsnRowValue, hsnCsvRow, HSN_CSV_HEADERS, billIsInterstate, billSplit, isExportBill, hsnSign } from '../utils/gstr1Json';
import { formatCurrency, INVOICE_TYPES, getStateCode, formatDateGST, getFilingPeriod, getFYOptions, belongsToProfile, toCsvLine, isCancelledBill, b2clThreshold, GST_PORTAL_RATES, setOffITC, placeOfSupplyLabel, countsAsSales, parseLocalDate, isModuleEnabled } from '../utils';
import { toast } from './Toast';
import HelpButton from './HelpButton';
import { billInInr } from '../utils/fx';
import { zeroRatedTotals, withoutZeroRated } from '../utils/lut';

const GST_TYPES = ['tax-invoice', 'credit-note'];
// GSTR-1 Table 13 "nature of document" codes.
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const QUARTERS = [
  { id: 'Q1', label: 'Q1 (Apr–Jun)', months: [3, 4, 5] },
  { id: 'Q2', label: 'Q2 (Jul–Sep)', months: [6, 7, 8] },
  { id: 'Q3', label: 'Q3 (Oct–Dec)', months: [9, 10, 11] },
  { id: 'Q4', label: 'Q4 (Jan–Mar)', months: [0, 1, 2] },
];

// v1.10.6 — audit L4: local copy removed, imported from utils above.

function downloadCSV(filename, headers, rows) {
  // v1.10.66 (#63) — toCsvLine stops a cell such as a client name starting
  // with "=" from running as a spreadsheet formula when the file is opened.
  const lines = [toCsvLine(headers)];
  rows.forEach(row => lines.push(toCsvLine(row)));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function round2(n) { return Math.round(n * 100) / 100; }

// v1.10.84 (#166) - one Table 12 list (B2B or B2C) with its own total. Rows
// come from hsnSummary, the same rows the CSV and the JSON are written from.
const num = { textAlign: 'right' };
const sumOf = (rows, f) => rows.reduce((s, r) => s + f(r), 0);
function HsnTable({ rows }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead><tr><th>HSN</th><th>Description</th><th>UQC</th><th style={num}>Rate</th><th style={num}>Qty</th><th style={num}>Taxable</th><th style={num}>CGST</th><th style={num}>SGST</th><th style={num}>IGST</th><th style={num}>Total Value</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.hsn_sc}|${r.rt}|${r.uqc}`}>
              <td><span className="invoice-badge">{r.hsn_sc}</span></td>
              <td className="font-medium">{r.desc}</td>
              <td>{r.uqc}</td>
              <td style={num}>{r.rt}%</td>
              <td style={num}>{r.qty}</td>
              <td style={num}>{formatCurrency(r.txval)}</td>
              <td style={num}>{formatCurrency(r.camt)}</td>
              <td style={num}>{formatCurrency(r.samt)}</td>
              <td style={num}>{formatCurrency(r.iamt)}</td>
              <td style={num} className="font-bold">{formatCurrency(hsnRowValue(r))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--border)' }}>
          <td colSpan={5}>Total</td>
          <td style={num}>{formatCurrency(sumOf(rows, (r) => r.txval))}</td>
          <td style={num}>{formatCurrency(sumOf(rows, (r) => r.camt))}</td>
          <td style={num}>{formatCurrency(sumOf(rows, (r) => r.samt))}</td>
          <td style={num}>{formatCurrency(sumOf(rows, (r) => r.iamt))}</td>
          <td style={num}>{formatCurrency(sumOf(rows, hsnRowValue))}</td>
        </tr></tfoot>
      </table>
    </div>
  );
}

// v1.10.74 - filed marks for one business, falling back to the old shared key.
function readFilingStatus(key) {
  try { return JSON.parse(localStorage.getItem(key) || localStorage.getItem('gst_filing_status') || '{}'); } catch { return {}; }
}

// billSplit, billIsInterstate and isExportBill live in utils/gstr1Json.js so
// the HSN summary (Table 12) can be tested; see v1.10.84 (#166) there.
// v1.10.83 - SEZ "without payment" (SEWOP) only when the invoice charged no
// tax. The LUT tick, or LUT words in the terms (old invoices; the export terms
// preset has them), cannot make an invoice that charged IGST into SEWOP.
// einvoice.js isLut uses the same rule.
const TAX_KEYS = ['igst', 'cgst', 'sgst', 'utgst', 'rcmTaxIgst', 'rcmTaxCgst', 'rcmTaxSgst', 'rcmTaxUtgst'];
const billIsLut = (bill) => (!!bill?.data?.invoiceOptions?.isLUT || /\bLUT\b|Letter of Undertaking/i.test(bill?.data?.customTerms || ''))
  && !TAX_KEYS.some((k) => Number(bill?.data?.totals?.[k]) > 0);

function getTaxableAmount(totals) {
  return totals?.taxableAmount ?? ((totals?.subtotal || 0) - (totals?.totalDiscount || 0));
}

// ========== GSTR-2B reconciliation helpers ==========
// Normalises an invoice number for fuzzy matching: uppercase, strip non-alphanumeric.
function normInv(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

// A purchase bill's taxable value, tax and invoice value as booked. Cess is
// part of the invoice value the supplier reports in 2B (`val`); leaving it
// out flagged every bill with cess as an amount mismatch.
function purchaseBookTotals(p) {
  return (p?.items || []).reduce((acc, it) => {
    const amount = (Number(it.quantity) || 0) * (Number(it.rate) || 0);
    const tax = amount * (Number(it.taxPercent) || 0) / 100;
    const cess = amount * (Number(it.cessPercent) || 0) / 100;
    return { taxable: acc.taxable + amount, tax: acc.tax + tax, cess: acc.cess + cess, total: acc.total + amount + tax + cess };
  }, { taxable: 0, tax: 0, cess: 0, total: 0 });
}

// Given the raw GSTR-2B JSON `data` block and the user's purchase records, return
// a flat array of reconciliation rows with status: matched | amount_mismatch |
// book_only | twob_only.
function buildReconciliation(twoBData, purchases, periodPurchases = purchases) {
  if (!twoBData) return [];
  const twoBSuppliers = twoBData.docdata?.b2b || twoBData.b2b || [];
  const rows = [];

  // Build a quick-lookup map for the user's purchases keyed on (supplier GSTIN, normalized invoice no.)
  const bookByKey = new Map();
  (purchases || []).forEach(p => {
    const key = `${(p.supplierGstin || '').toUpperCase()}::${normInv(p.invoiceNumber)}`;
    bookByKey.set(key, p);
  });

  // Track which book entries we've already matched so we can find leftover "book-only"
  const matchedBookKeys = new Set();

  twoBSuppliers.forEach(sup => {
    const ctin = (sup.ctin || '').toUpperCase();
    const supName = sup.trdnm || '';
    (sup.inv || []).forEach(inv => {
      const key = `${ctin}::${normInv(inv.inum)}`;
      const book = bookByKey.get(key);
      const twoBVal = Number(inv.val || 0);
      const twoBTaxable = (inv.items || []).reduce((s, it) => s + Number(it.txval || 0), 0);
      const twoBIgst = (inv.items || []).reduce((s, it) => s + Number(it.igst || 0), 0);
      const twoBCgst = (inv.items || []).reduce((s, it) => s + Number(it.cgst || 0), 0);
      const twoBSgst = (inv.items || []).reduce((s, it) => s + Number(it.sgst || 0), 0);

      if (!book) {
        rows.push({
          status: 'twob_only',
          supplier: supName, ctin,
          invoiceNumber: inv.inum, date: inv.dt,
          twoBVal, twoBTaxable, twoBIgst, twoBCgst, twoBSgst,
          bookVal: 0, bookTaxable: 0, bookIgst: 0, bookCgst: 0, bookSgst: 0,
          itcAvailable: inv.itcavl !== 'N',
        });
        return;
      }
      matchedBookKeys.add(key);

      const bookTotals = purchaseBookTotals(book);
      // P1 #22: include round-off in the book-side total so 2B matching
      // doesn't flag every rounded supplier bill as amount_mismatch. The
      // supplier's 2B `val` is the rounded number; our line-item math was
      // paise-precise → always mismatched by a few paise until we account
      // for the round-off separately.
      if (book.applyRoundOff && typeof book.roundOff === 'number') {
        bookTotals.total += book.roundOff;
      }
      const bookIgst = book.interstate ? bookTotals.tax : 0;
      const bookCgst = book.interstate ? 0 : bookTotals.tax / 2;
      const bookSgst = book.interstate ? 0 : bookTotals.tax / 2;

      const valDiff = Math.abs(twoBVal - bookTotals.total);
      const taxableDiff = Math.abs(twoBTaxable - bookTotals.taxable);
      const status = (valDiff <= 1 && taxableDiff <= 1) ? 'matched' : 'amount_mismatch';

      rows.push({
        status,
        supplier: supName || book.supplierName || '',
        ctin,
        invoiceNumber: inv.inum, date: inv.dt,
        twoBVal, twoBTaxable, twoBIgst, twoBCgst, twoBSgst,
        bookVal: bookTotals.total, bookTaxable: bookTotals.taxable,
        bookIgst, bookCgst, bookSgst,
        itcAvailable: inv.itcavl !== 'N',
        valDiff, taxableDiff,
      });
    });
  });

  // Anything in our books that didn't match a 2B entry — supplier hasn't filed yet
  // v1.10.74 - only purchases of the selected period can be "Books only"; a
  // 2B statement covers one period, so older bills were all flagged missing.
  // Matching above still looks at every purchase, for bills booked late.
  (periodPurchases || []).forEach(p => {
    const key = `${(p.supplierGstin || '').toUpperCase()}::${normInv(p.invoiceNumber)}`;
    if (matchedBookKeys.has(key)) return;
    const totals = purchaseBookTotals(p);
    rows.push({
      status: 'book_only',
      supplier: p.supplierName || '', ctin: (p.supplierGstin || '').toUpperCase(),
      invoiceNumber: p.invoiceNumber, date: p.date,
      twoBVal: 0, twoBTaxable: 0, twoBIgst: 0, twoBCgst: 0, twoBSgst: 0,
      bookVal: totals.total, bookTaxable: totals.taxable,
      bookIgst: p.interstate ? totals.tax : 0,
      bookCgst: p.interstate ? 0 : totals.tax / 2,
      bookSgst: p.interstate ? 0 : totals.tax / 2,
      itcAvailable: false,
    });
  });

  return rows;
}

// ========== Filing Guide Steps ==========
const GSTR1_STEPS = [
  {
    title: 'Login to GST Portal',
    details: `1. Open gst.gov.in in your browser (Chrome/Firefox recommended).
2. Click "Login" at top-right → Enter your GSTIN or Username → Enter Password → Enter Captcha → Click "LOGIN".
3. If you have 2FA enabled, enter the OTP sent to your registered mobile.
4. After login, you'll see the Dashboard. Click "Returns" in the top menu → Click "Returns Dashboard".
IMPORTANT: Use your authorized signatory credentials. Only the primary authorized signatory or additional users with filing rights can file returns.`
  },
  {
    title: 'Select Return Period for GSTR-1',
    details: `1. On the Returns Dashboard page, select "Financial Year" (e.g., 2025-26) and "Return Filing Period" (select the month, e.g., March).
2. Click "SEARCH" button.
3. The page will show all returns for that period. Find "GSTR-1" tile.
4. Click "PREPARE ONLINE" if you have fewer than 500 invoices. Click "PREPARE OFFLINE" if you have 500+ invoices (you'll download the offline tool, import the JSON from this app, and upload).
5. For QRMP scheme users: Select the quarter end month. You file quarterly but can use IFF (Invoice Furnishing Facility) monthly for B2B invoices.
NOTE: GSTR-1 must be filed BEFORE GSTR-3B. Due date: 11th of next month (monthly filers) or 13th of month after quarter (QRMP).`
  },
  {
    title: 'Table 4A — B2B Invoices (Registered Clients)',
    details: `1. Click "4A, 4B, 4C, 6B, 6C — B2B Invoices" tile.
2. Click "+ ADD INVOICE" button.
3. For EACH B2B invoice from your GSTR-1 tab above, enter:
   • Receiver GSTIN — Enter the 15-digit GSTIN (e.g., 03AABCU9603R1ZN). Portal auto-validates.
   • Invoice Number — Must match EXACTLY as on your invoice (e.g., INV/2025-26/0001).
   • Invoice Date — DD/MM/YYYY format. Must fall within the return period.
   • Invoice Value — Total invoice amount INCLUDING tax (the "Total" column in B2B table above).
   • Place of Supply — Select the state. For intra-state, this is YOUR state. For inter-state, this is the BUYER's state.
   • Reverse Charge — Select "N" (No) for normal supplies. Select "Y" only if the buyer pays GST under reverse charge (Section 9(3)/9(4)).
   • Invoice Type — "Regular" for normal invoices, "SEZ supplies with payment" / "SEZ supplies without payment" for SEZ.
   • Click "ADD" under tax details → Enter Rate (e.g., 18%), Taxable Value, IGST or CGST+SGST amounts.
4. Click "SAVE" after each invoice.
5. Repeat for ALL B2B invoices.
TIP: Use the "GSTR-1 JSON" export from this app and upload via offline tool to skip manual entry.
COMMON ERROR: "Invoice number already exists" — each invoice number must be unique within the period.`
  },
  {
    title: 'Table 5 — B2C Large (Inter-state > ₹1 Lakh)',
    details: `This table is ONLY for inter-state invoices to UNREGISTERED persons (no GSTIN) where invoice value EXCEEDS ₹1,00,000 (₹2,50,000 for invoices before 1 Aug 2024).
1. Click "5A, 5B — B2C (Large) Invoices" tile.
2. Click "+ ADD INVOICE".
3. Enter: Place of Supply (buyer's state), Invoice Number, Invoice Date, Invoice Value, Taxable Value, IGST Amount, Cess (if any).
4. Only IGST applies here (never CGST/SGST) since these are inter-state.
5. Click "SAVE".
NOTE: If you have no inter-state B2C invoices above ₹1 lakh, skip this table entirely.`
  },
  {
    title: 'Table 7 — B2C Small (All Other B2C)',
    details: `This covers ALL remaining B2C invoices: intra-state B2C of any value + inter-state B2C up to ₹1 lakh.
1. Click "7 — B2C (Others)" tile.
2. Data is entered in AGGREGATE (not individual invoices). Group by: Supply Type (Intra/Inter), Place of Supply, and Tax Rate.
3. For each combination, enter: Type (Intra-State/Inter-State), Place of Supply, Rate (e.g., 18%), Taxable Value, CGST/SGST or IGST.
4. Use the B2C table in your GSTR-1 tab above — it's already aggregated by rate.
5. Click "SAVE".
IMPORTANT: Intra-state B2C → enter CGST + SGST. Inter-state B2C → enter IGST only.`
  },
  {
    title: 'Table 9B — Credit/Debit Notes',
    details: `Only if you issued Credit Notes or Debit Notes during this period.
1. Click "9B — Credit/Debit Notes (Registered)" for notes to GSTIN holders.
2. Enter: Receiver GSTIN, Note Number, Note Date, Note Type (Credit/Debit), Note Value, Place of Supply, Taxable Value, Tax Amounts.
3. For unregistered persons: Click "9B — Credit/Debit Notes (Unregistered)" and enter without GSTIN.
4. Credit Notes reduce your liability. Debit Notes increase it.
RULE: Credit note must reference the original invoice. Must be issued before September 30 following the end of the financial year of the original invoice or before filing annual return, whichever is earlier (Section 34 of CGST Act).`
  },
  {
    title: 'Table 12 — HSN-wise Summary of Outward Supplies',
    details: `Mandatory reporting based on your turnover:
• Turnover up to ₹1.5 Crore — HSN summary NOT mandatory (but recommended)
• Turnover ₹1.5 Cr to ₹5 Cr — 4-digit HSN code mandatory
• Turnover above ₹5 Crore — 6-digit HSN code mandatory
1. Click "12 — HSN-wise Summary of outward supplies".
2. For each HSN/SAC code, enter: HSN Code, Description, UQC (Unit — NOS/KGS/MTR etc.), Total Quantity, Taxable Value, IGST, CGST, SGST, Cess.
3. Use the HSN Summary from your GSTR-1 tab above.
4. Click "SAVE".
COMMON ERROR: "Invalid HSN code" — ensure HSN codes match the official HSN Master list. Services use SAC codes (starting with 99).`
  },
  {
    title: 'Table 13 — Documents Issued During the Period',
    details: `1. Click "13 — Documents Issued during the tax period".
2. Enter the serial number range for each document type:
   • Invoices for outward supply — From: INV/2025-26/0001, To: INV/2025-26/0015, Total: 15, Cancelled: 0
   • Credit Notes — From/To range, Total issued, Cancelled count
   • Debit Notes — same
   • Delivery Challans — same
3. Net Issued = Total - Cancelled (auto-calculated).
4. Use the Document Summary from your GSTR-1 tab above.
5. Click "SAVE".`
  },
  {
    title: 'Preview, Submit & File GSTR-1',
    details: `1. After filling all tables, scroll to bottom and click "PREVIEW" button.
2. Review the summary carefully. Check:
   • Total taxable value matches your records
   • B2B + B2C totals are correct
   • Tax amounts (IGST, CGST, SGST) match
   • HSN summary totals match
3. If everything looks correct, click "SUBMIT" button.
⚠️ WARNING: After clicking SUBMIT, data is FROZEN. You CANNOT edit any table after submission. Only proceed if you're sure.
4. After submission, click "FILE GSTR-1" button (appears after submit).
5. Select filing method:
   • DSC (Digital Signature Certificate) — for companies and LLPs (mandatory)
   • EVC (Electronic Verification Code) — OTP sent to registered mobile/email. Available for proprietors, partnerships, HUFs.
6. Enter OTP or sign with DSC → Click "FILE".
7. You'll see ARN (Acknowledgement Reference Number). Save this for your records.
DONE! GSTR-1 is filed. Now proceed to GSTR-3B.`
  },
];

const GSTR3B_STEPS = [
  {
    title: 'Navigate to GSTR-3B',
    details: `1. Login to gst.gov.in (if not already logged in).
2. Go to Returns → Returns Dashboard.
3. Select the same Financial Year and Period as your GSTR-1.
4. Click "SEARCH".
5. Find "GSTR-3B" tile → Click "PREPARE ONLINE".
NOTE: File GSTR-3B AFTER GSTR-1 is filed. From July 2025, Table 3 is auto-populated from your GSTR-1 data. Due date: 20th of next month (monthly) or 22nd/24th after quarter (QRMP, based on your state).`
  },
  {
    title: 'Table 3.1 — Outward Supplies & Tax Liability',
    details: `This table shows your OUTPUT TAX liability. From July 2025, it's auto-populated from GSTR-1.
1. Click "3.1 — Tax on outward and reverse charge inward supplies".
2. Verify/Enter these rows:
   (a) Outward taxable supplies (other than zero-rated, nil-rated, exempted):
       • Taxable Value = Your total taxable value from GSTR-1 Summary
       • IGST = Total IGST from all invoices
       • CGST = Total CGST from all invoices
       • SGST = Total SGST from all invoices
   (b) Outward taxable supplies (zero rated): Enter if you have exports or supplies to SEZ.
   (c) Other outward supplies (nil rated, exempted): Enter exempt/nil-rated supply values.
   (d) Inward supplies (liable to reverse charge): Enter if you received services under RCM (e.g., from unregistered persons, legal services, GTA).
   (e) Non-GST outward supplies: Enter non-taxable supplies (e.g., petroleum, alcohol).
3. Click "CONFIRM" when done.
IMPORTANT: Values here MUST match your GSTR-1. Any mismatch will be flagged by the system and may trigger a notice under Section 61.`
  },
  {
    title: 'Table 3.2 — Inter-state Supplies to Unregistered Persons',
    details: `Only required if you made INTER-STATE supplies to UNREGISTERED persons or composition dealers.
1. Click "3.2 — Inter-State supplies".
2. For supplies to unregistered persons:
   • Select Place of Supply (buyer's state)
   • Enter Taxable Value and IGST Amount
   • Add row for each state you supplied to
3. For supplies to composition dealers: Same format, separate section.
4. Click "CONFIRM".
NOTE: This data must reconcile with your GSTR-1 B2C Large (Table 5) data. If you have no inter-state B2C supplies, leave blank.`
  },
  {
    title: 'Table 4 — Input Tax Credit (ITC)',
    details: `This is where you CLAIM your ITC to reduce tax liability.
1. Click "4 — Eligible ITC".
2. Section (A) — ITC Available:
   (1) Import of goods — ITC from Bill of Entry (customs)
   (2) Import of services — ITC from invoices for imported services
   (3) Inward supplies liable to reverse charge — ITC on RCM supplies you paid tax on
   (4) Inward supplies from ISD — ITC distributed by Input Service Distributor
   (5) All other ITC — THIS IS YOUR MAIN ITC. Enter IGST, CGST, SGST from eligible purchase invoices.
       Use the ITC values from your GSTR-3B tab above (from Expense Tracker).
3. Section (B) — ITC Reversed: Enter if you need to reverse ITC (Rule 42/43 — common credit reversal, exempt supplies ratio).
4. Net ITC = (A) minus (B).
5. Click "CONFIRM".
CRITICAL RULES:
• ITC is only valid if supplier has filed THEIR GSTR-1 (check GSTR-2B auto-populated statement)
• ITC must be claimed within the time limit — Section 16(4): Due date of September return or annual return filing date
• ITC cannot exceed GSTR-2B values + 5% tolerance (Rule 36(4) — now removed, but system still validates against GSTR-2B)
• Retain all invoices and proof of payment for ITC claims`
  },
  {
    title: 'Table 5 — Exempt, Nil-Rated and Non-GST Inward Supplies',
    details: `1. Click "5 — Values of exempt, nil-rated and non-GST inward supplies".
2. Enter values for:
   • Inter-State inward supplies (exempt/nil/non-GST)
   • Intra-State inward supplies (exempt/nil/non-GST)
3. Examples: Purchase of milk, fresh vegetables, unprocessed food grains, educational services, healthcare services.
4. Click "CONFIRM".
NOTE: This is informational only — no tax impact. But incorrect reporting can trigger scrutiny.`
  },
  {
    title: 'Table 6 — Tax Payment (Calculate Net Payable)',
    details: `This auto-calculates based on Tables 3 and 4.
1. Click "6.1 — Payment of Tax".
2. Review the auto-calculated amounts:
   • Tax Payable = Output Tax (Table 3.1) for each head (IGST, CGST, SGST)
   • ITC Claimed = From Table 4, auto-set against each tax head
   • Tax Paid through ITC = Amount of ITC utilized
   • Tax/Cess Paid in Cash = Remaining amount to pay via cash
3. ITC utilization order (mandatory as per Section 49):
   • IGST credit → First set off against IGST liability → Then CGST → Then SGST
   • CGST credit → First against CGST → Then IGST (NOT SGST)
   • SGST credit → First against SGST → Then IGST (NOT CGST)
4. If cash payment is needed:
   • Click "CREATE CHALLAN" → Select payment method (Net Banking / NEFT/RTGS / Over the Counter)
   • Pay the amount → Challan will reflect in Electronic Cash Ledger
   • Come back and click "MAKE PAYMENT / POST CREDIT TO LEDGER"
5. If ITC fully covers your liability, no cash payment needed. Click "POST CREDIT TO LEDGER" directly.`
  },
  {
    title: 'Preview, Submit, Pay & File GSTR-3B',
    details: `1. Click "PREVIEW DRAFT GSTR-3B" at the bottom.
2. Review ALL values carefully:
   • Output tax matches GSTR-1 totals
   • ITC matches your purchase records and GSTR-2B
   • Net payable amount is correct
3. Check the "I have reconciled..." declaration checkbox.
4. Click "SUBMIT" button.
⚠️ WARNING: After SUBMIT, data is FROZEN. You cannot change any values.
5. After submit:
   • If tax is payable → Click "MAKE PAYMENT / POST CREDIT TO LEDGER" → System will utilize ITC first, then debit cash ledger.
   • If no tax payable (ITC covers everything) → Click "POST CREDIT TO LEDGER".
6. Click "FILE GSTR-3B" (appears after payment/posting).
7. Select filing method: DSC or EVC (same as GSTR-1).
8. Enter OTP or sign → Click "FILE".
9. Save the ARN number.
DONE! Both GSTR-1 and GSTR-3B are filed for this period.

LATE FILING CONSEQUENCES:
• Late fee: ₹50/day (₹25 CGST + ₹25 SGST) — capped at ₹5,000 per return for taxpayers with turnover, ₹500 for nil returns (CGST Amendment Act 2023, FY 2023-24 onwards)
• Interest: 18% p.a. on outstanding tax from due date (Section 50)
• Cannot file next month's return until current month is filed
• E-way bill generation blocked after 2 months of non-filing`
  },
];

const NIL_GSTR1_STEPS = [
  {
    title: 'Login & Navigate',
    details: `1. Login to gst.gov.in → Returns → Returns Dashboard.
2. Select Financial Year and Month → Click "SEARCH".
3. Find GSTR-1 tile → Click "PREPARE ONLINE".`
  },
  {
    title: 'Verify All Tables are Empty',
    details: `1. All tables (4A, 5, 7, 9, 12, 13) should show ZERO or be empty.
2. If any table has data from a previous session, DELETE it.
3. There should be NO invoices, NO credit notes, NO HSN entries.`
  },
  {
    title: 'Submit & File NIL GSTR-1',
    details: `1. Click "GENERATE GSTR-1 SUMMARY" at the bottom.
2. Check that all values show ₹0.00.
3. Tick the declaration checkbox: "I/We hereby declare that the information..."
4. Click "FILE GSTR-1 (NIL)" button. This special button appears when all tables are empty.
5. Select EVC/DSC → Enter OTP → File.
6. Save ARN number.
IMPORTANT: Filing NIL GSTR-1 is mandatory even with zero sales. Non-filing attracts ₹20/day penalty (₹10 CGST + ₹10 SGST), max ₹500 per return.`
  },
];

const NIL_GSTR3B_STEPS = [
  {
    title: 'Login & Navigate',
    details: `1. Login to gst.gov.in → Returns → Returns Dashboard.
2. Select same period → Click "SEARCH".
3. Find GSTR-3B tile → Click "PREPARE ONLINE".`
  },
  {
    title: 'Verify All Values are Zero',
    details: `1. Table 3.1 — All outward supply values should be ₹0.
2. Table 4 — No ITC to claim (all zeros).
3. Table 5 — Exempt supplies should be ₹0 (unless you have exempt inward supplies).
4. Table 6 — Tax payable should be ₹0 across IGST, CGST, SGST.`
  },
  {
    title: 'Submit & File NIL GSTR-3B',
    details: `1. Click "SUBMIT" at the bottom.
2. Since no tax is payable, no payment step is needed.
3. Click "FILE GSTR-3B (NIL)" — this special button appears when all values are zero.
4. Tick the declaration: "I verify that to the best of my knowledge..."
5. Select EVC/DSC → Enter OTP → File.
6. Save ARN number.
NOTE: Even for NIL return, you MUST file both GSTR-1 and GSTR-3B separately. They are different returns.
PENALTY: ₹20/day late fee for NIL GSTR-3B (₹10 CGST + ₹10 SGST), capped at ₹500 per return.`
  },
];

function StepList({ steps, title, doc }) {
  const [expanded, setExpanded] = useState({});
  const [checked, setChecked] = useState({});
  return (
    <div className="glass-panel mb-4">
      <div className="table-header"><h3>{title}{doc && <HelpButton title={title} doc={doc} size={16} />}</h3></div>
      <div style={{ padding: '0.5rem 0' }}>
        {steps.map((step, i) => (
          <div key={i} style={{ borderBottom: i < steps.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 1.25rem', cursor: 'pointer' }} onClick={() => setExpanded(p => ({ ...p, [i]: !p[i] }))}>
              <button className="icon-btn" onClick={e => { e.stopPropagation(); setChecked(p => ({ ...p, [i]: !p[i] })); }}
                style={{ color: checked[i] ? '#059669' : 'var(--text-muted)', background: checked[i] ? '#ecfdf5' : 'transparent', width: 26, height: 26, borderRadius: 6, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle size={16} />
              </button>
              <span style={{ flex: 1, fontWeight: 600, fontSize: '0.85rem', color: checked[i] ? '#059669' : 'var(--text)', textDecoration: checked[i] ? 'line-through' : 'none' }}>
                Step {i + 1}: {step.title}
              </span>
              {expanded[i] ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
            </div>
            {expanded[i] && (
              <div style={{ padding: '0 1.25rem 0.75rem 3.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{step.details}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ========== Main Component ==========
export default function GSTReturns() {
  const [bills, setBills] = useState([]);
  // v1.10.74 - cancelled invoices, kept apart so they reach only the Table 13
  // document count (the portal wants them in "Cancelled"), never the tax tables.
  const [cancelledBills, setCancelledBills] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [profile, setProfile] = useState({});
  const [filterMode, setFilterMode] = useState('month');
  const [fyFilter, setFyFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [quarterFilter, setQuarterFilter] = useState('Q1');
  const [activeTab, setActiveTab] = useState('gstr1');
  const [gstr2bData, setGstr2bData] = useState(null); // imported 2B JSON
  const [gstr2bFilter, setGstr2bFilter] = useState('all'); // all | matched | mismatch | bookOnly | twoBOnly
  const gstr2bInputRef = useRef(null);

  const handleImport2B = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      // Accept both wrapped {data: ...} and bare formats
      const root = json?.data || json;
      if (!root?.docdata && !root?.b2b) {
        toast('That doesn\'t look like a GSTR-2B JSON. Expected docdata.b2b array.', 'error');
        return;
      }
      setGstr2bData(root);
      const supplierCount = (root.docdata?.b2b || root.b2b || []).length;
      toast(`Imported GSTR-2B for ${root.gstin || '?'} — ${supplierCount} suppliers`, 'success');
    } catch (err) {
      console.error(err);
      toast('Failed to parse GSTR-2B JSON', 'error');
    }
    if (gstr2bInputRef.current) gstr2bInputRef.current.value = '';
  };
  const [guideTab, setGuideTab] = useState('regular');
  // v1.10.74 - filed marks are kept per business GSTIN: each GSTIN files its
  // own returns, so one business's "Filed" must not show on another's. Marks
  // saved before this under the shared key are still read until the business
  // saves its own.
  const filingKey = profile.gstin ? `gst_filing_status_${String(profile.gstin).trim().toUpperCase()}` : 'gst_filing_status';
  const [filingState, setFilingState] = useState(() => ({ key: filingKey, data: readFilingStatus(filingKey) }));
  // Re-read when the business (and so the key) changes once the profile loads.
  if (filingState.key !== filingKey) setFilingState({ key: filingKey, data: readFilingStatus(filingKey) });
  const filingStatus = filingState.data;
  const setFilingStatus = (data) => setFilingState({ key: filingKey, data });

  const fyOptions = getFYOptions();
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = currentYear; y >= currentYear - 5; y--) yearOptions.push(y);

  const loadData = async () => {
    try {
      const [b, e, p] = await Promise.all([getAllBills(), getAllExpenses(), getProfile()]);
      // v1.10.64 (#55) — a GST return must cover ONE GSTIN. Showing another
      // business's invoices here would misstate the return being filed.
      // v1.10.67 (#66 item 12) — a cancelled invoice is not reported.
      // v1.10.83 - returns are in rupees: an invoice in USD, EUR... is turned
      // into rupees at the exchange rate saved on it. One without a rate stays
      // as it is, marked fxMissing, and is listed as an error below.
      const inRupees = (bill) => billInInr(bill) || { ...bill, fxMissing: true };
      // #141 - every table, file and check below reads this cleaned GSTIN.
      const withCleanGstin = (bill) => (bill.data?.client?.gstin
        ? { ...bill, data: { ...bill.data, client: { ...bill.data.client, gstin: cleanGstin(bill.data.client.gstin) } } }
        : bill);
      setBills((b || []).filter(bill => belongsToProfile(bill, p) && !isCancelledBill(bill)).map(inRupees).map(withCleanGstin));
      setCancelledBills((b || []).filter(bill => belongsToProfile(bill, p) && isCancelledBill(bill)));
      // v1.10.66 (#64) — and only its own expenses and purchases. Left
      // unfiltered, GSTR-3B Table 4 claimed input tax credit on purchases made
      // by a different GSTIN.
      setExpenses((e || []).filter(r => belongsToProfile(r, p))); setProfile(p || {});
      // Purchases endpoint may not exist on older server versions
      try { const pur = await getAllPurchases(); setPurchases((pur || []).filter(r => belongsToProfile(r, p))); } catch { /* ignore — older servers don't have this endpoint */ }
    } catch { toast('Failed to load data', 'error'); }
  };

  useEffect(() => {
    const now = new Date();
    const fy = fyOptions[0];
    if (fy) setFyFilter(fy.value);
    setYearFilter(String(now.getFullYear()));
    setMonthFilter(String(now.getMonth()));
    // Auto-detect current quarter
    const m = now.getMonth();
    const q = QUARTERS.find(q => q.months.includes(m));
    if (q) setQuarterFilter(q.id);
    loadData();
  }, []);

  // ========== Period filtering ==========
  const filterByPeriod = (date) => {
    if (!date) return false;
    if (filterMode === 'fy') {
      const fy = fyOptions.find(f => f.value === fyFilter);
      return fy ? date >= fy.from && date <= fy.to : true;
    } else if (filterMode === 'quarter') {
      // Local date: new Date('2026-04-01') is UTC midnight, which west of
      // Greenwich is 31 March - the previous month, quarter and year.
      const d = parseLocalDate(date);
      const q = QUARTERS.find(q => q.id === quarterFilter);
      if (!q) return false;
      // Determine the year for the quarter based on FY context
      const yr = parseInt(yearFilter);
      return q.months.includes(d.getMonth()) && d.getFullYear() === yr;
    } else {
      const d = parseLocalDate(date);
      return d.getFullYear() === parseInt(yearFilter) && d.getMonth() === parseInt(monthFilter);
    }
  };

  // v1.10.4 — audit H13. Prior code rebuilt these arrays every render
  // (clicking any of ~10 tab pills with 500 bills × 5 items ran
  // ~20k operations per interaction). Now memoized on the same
  // input deps used by filterByPeriod. The downstream computations
  // (b2bRows, hsnMap, warnings, etc.) still run per render but consume
  // stable arrays — subsequent memoizations can layer on later without
  // touching this file's export helpers.
  const periodGstBills = useMemo(() => bills.filter(bill => {
    const type = bill.invoiceType || 'tax-invoice';
    if (!GST_TYPES.includes(type)) return false;
    if (!bill.data) return false;
    return filterByPeriod(bill.invoiceDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [bills, filterMode, fyFilter, quarterFilter, monthFilter, yearFilter]);
  // v1.10.83 - an invoice in another currency with no exchange rate is kept
  // OUT of every total (its dollars are not rupees) and listed as an error
  // until the rate is added: a missing figure is fixable, a wrong one is filed.
  const filteredBills = useMemo(() => periodGstBills.filter(b => !b.fxMissing), [periodGstBills]);
  const noRateBills = useMemo(() => periodGstBills.filter(b => b.fxMissing), [periodGstBills]);
  const allFilteredBills = useMemo(() => bills.filter(bill => bill.data && filterByPeriod(bill.invoiceDate)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bills, filterMode, fyFilter, quarterFilter, monthFilter, yearFilter]);
  const cancelledInPeriod = useMemo(() => cancelledBills.filter(bill => bill.data && filterByPeriod(bill.invoiceDate)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cancelledBills, filterMode, fyFilter, quarterFilter, monthFilter, yearFilter]);
  const filteredExpenses = useMemo(() => expenses.filter(exp => filterByPeriod(exp.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expenses, filterMode, fyFilter, quarterFilter, monthFilter, yearFilter]);

  // ========== Classification ==========
  const creditNotes = filteredBills.filter(b => (b.invoiceType || 'tax-invoice') === 'credit-note');
  const regularBills = filteredBills.filter(b => (b.invoiceType || 'tax-invoice') !== 'credit-note');
  // v1.10.66 (#61) - exports (isExportBill, utils/gstr1Json.js) stay in
  // regularBills, so the HSN and document summaries still include them.
  const exportBills = regularBills.filter(isExportBill);
  // v1.10.84 - an export is without payment (WOPAY) when it charged no IGST
  // under a LUT: the zero-rated totals, or the LUT tick / LUT words with no tax.
  const exportWopay = (bill) => !!bill.data?.totals?.lutZeroRated || billIsLut(bill);
  // v1.10.83 - GSTR-1 Table 6A, in rupees (each invoice at its own rate). WPAY
  // = with payment of IGST, WOPAY = without (under a LUT).
  const exportRows = [...exportBills, ...noRateBills.filter(isExportBill)].map(b => {
    const t = b.data?.totals || {};
    const rates = [...new Set((b.data?.items || []).map(i => Number(i.taxPercent) || 0))];
    return {
      id: b.id, invoiceNo: b.invoiceNumber || '', date: b.invoiceDate || '',
      client: b.data?.client?.name || b.clientName || '', country: b.data?.client?.country || '',
      type: exportWopay(b) ? 'WOPAY' : 'WPAY', rates: rates.join(', '),
      currency: b.fxFrom?.currency || b.currency || 'INR', fxRate: b.fxFrom?.rate || (b.fxMissing ? 0 : 1),
      value: t.total || 0, taxable: getTaxableAmount(t), igst: t.igst || 0, cess: t.cess || 0, missing: !!b.fxMissing,
    };
  });
  const b2bRegular = regularBills.filter(b => b.data?.client?.gstin && !isExportBill(b));
  const b2cRegular = regularBills.filter(b => !b.data?.client?.gstin && !isExportBill(b));
  const b2cLarge = b2cRegular.filter(b => {
    const isInter = billIsInterstate(b);
    return isInter && (b.totalAmount || 0) > b2clThreshold(b.invoiceDate);
  });
  const b2cSmall = b2cRegular.filter(b => {
    const isInter = billIsInterstate(b);
    return !(isInter && (b.totalAmount || 0) > b2clThreshold(b.invoiceDate));
  });

  // v1.10.31 — Helper: is this bill intra-UT (business + client in same Union
  // Territory without legislature)? Value comes from computeInvoiceTotals'
  // `totals.isIntraUT` when available; falls back to state-code inspection
  // for legacy bills computed before that flag existed.
  const billIsIntraUT = (bill) => {
    if (bill?.data?.totals?.isIntraUT) return true;
    return false; // Legacy bills default to false — will treat as SGST which is safe
  };

  // v1.10.84 - each line's GST treatment (gstr1Json.lineTreatment): taxable
  // lines go in B2B / B2C / exports as before; nil-rated, exempt and non-GST
  // lines (0% lines, and bills of supply) go in Table 8 and GSTR-3B 3.1(c) /
  // 3.1(e) instead. Bills of supply were in no table at all before.
  const treatmentOf = (bill, item) => lineTreatment({
    invoiceType: bill.invoiceType || 'tax-invoice', isExport: isExportBill(bill),
    taxPercent: item.taxPercent, gstTreatment: item.gstTreatment,
  });
  const taxableLine = (bill) => (item) => treatmentOf(bill, item) === 'taxable';
  const supplyBills = allFilteredBills.filter(b => b.invoiceType === 'bill-of-supply' && !b.fxMissing);
  const nilRows = [...filteredBills, ...supplyBills].flatMap(bill => (bill.data?.items || []).map(item => {
    const treatment = treatmentOf(bill, item);
    if (treatment === 'taxable') return null;
    const isInter = billIsInterstate(bill);
    const split = billSplit(bill, item, isInter, !!bill.data?.taxInclusive, billIsIntraUT(bill));
    return {
      interstate: isInter, b2b: !!bill.data?.client?.gstin, treatment,
      txval: hsnSign(bill) * split.taxable, onTaxInvoice: bill.invoiceType !== 'bill-of-supply',
    };
  }).filter(Boolean));
  const nilSum = (pred) => nilRows.filter(pred).reduce((t, r) => t + r.txval, 0);

  // ========== B2B Rows ==========
  // v1.10.31 — GST-C2 fix: also read totals.utgst (was ignored → intra-UT
  // bills lost 50% of tax in the CSV export). And GST-C3: expose cess so
  // GSTR-3B and every summary row includes it.
  const b2bRows = b2bRegular.map(bill => {
    const { client, totals, details } = bill.data;
    const isInterState = billIsInterstate(bill);
    const pos = getStateCode(details?.placeOfSupply || client?.state || '');
    // For GSTR-1 payload compat, UTGST goes into the SGST bucket (GSTN
    // schema has no separate utgst field; `samt` covers both).
    const sgstBucket = isInterState ? 0 : ((totals?.sgst || 0) + (totals?.utgst || 0));
    return {
      gstin: client.gstin, clientName: client.name || bill.clientName || '',
      invoiceNo: bill.invoiceNumber || '', date: bill.invoiceDate || '', pos,
      supplyType: isInterState ? 'Inter' : 'Intra',
      taxable: getTaxableAmount(totals),
      cgst: isInterState ? 0 : (totals?.cgst || 0),
      sgst: sgstBucket,
      igst: isInterState ? (totals?.igst || 0) : 0,
      cess: totals?.cess || 0,
      total: totals?.total || 0,
    };
  });

  // ========== B2C by Rate ==========
  const b2cByRate = {};
  // v1.10.74 - B2C is sales invoices only. Exports are reported once, in
  // 3.1(b), and credit notes are subtracted once through cnTotals below; both
  // used to land here too (an unregistered credit note was added here and then
  // subtracted, so it never reduced the tax).
  const b2cBills = b2cRegular;
  b2cBills.forEach(bill => {
    const { items } = bill.data;
    const isInterState = billIsInterstate(bill);
    const isIntraUT = billIsIntraUT(bill);
    (items || []).forEach(item => {
      const rate = item.taxPercent || 0;
      if (!b2cByRate[rate]) b2cByRate[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, total: 0 };
      const split = billSplit(bill, item, isInterState, !!bill.data?.taxInclusive, isIntraUT);
      b2cByRate[rate].taxable += split.taxable;
      b2cByRate[rate].cgst += split.cgst;
      // GST-C2: UTGST folded into SGST bucket for GSTR-1 payload compatibility.
      b2cByRate[rate].sgst += split.sgst + split.utgst;
      b2cByRate[rate].igst += split.igst;
      b2cByRate[rate].cess += split.cess;
      b2cByRate[rate].total += split.taxable + split.cgst + split.sgst + split.utgst + split.igst + split.cess;
    });
  });
  const b2cRates = Object.keys(b2cByRate).map(Number).sort((a, b) => a - b);

  // v1.10.79 (#95) - the screen shows Table 7 the way the portal takes it: one
  // row per supply type, place of supply and rate. It used to add every state
  // into one row per rate, so inter-state sales to Bihar, Punjab... could not
  // be read off it. B2C Large (Table 5) invoices are listed under it.
  const b2cPos = (bill) => getStateCode(bill.data?.details?.placeOfSupply || bill.data?.client?.state || bill.data?.profile?.state || '');
  const b2cTable7 = (() => {
    const rows = {};
    b2cSmall.forEach(bill => {
      const isInter = billIsInterstate(bill);
      const isIntraUT = billIsIntraUT(bill);
      const pos = b2cPos(bill);
      (bill.data.items || []).forEach(item => {
        const rate = item.taxPercent || 0;
        const key = `${isInter ? 'INTER' : 'INTRA'}_${pos}_${rate}`;
        if (!rows[key]) rows[key] = { inter: isInter, pos, rate, taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 };
        const split = billSplit(bill, item, isInter, !!bill.data?.taxInclusive, isIntraUT);
        rows[key].taxable += split.taxable; rows[key].cgst += split.cgst; rows[key].sgst += split.sgst + split.utgst;
        rows[key].igst += split.igst; rows[key].cess += split.cess;
      });
    });
    return Object.values(rows).sort((a, b) => (a.inter - b.inter) || a.pos.localeCompare(b.pos) || a.rate - b.rate);
  })();

  // ========== HSN Summary ==========
  // v1.10.84 (#166) - one builder (utils/gstr1Json.js hsnSummary) for the
  // screen, the CSV files and the JSON, so the three always agree.
  const hsnSum = hsnSummary([...filteredBills, ...supplyBills]); // v1.10.84 - bills of supply too
  const hsnRows = hsnSum.rows;
  const hsnB2B = hsnRows.filter((r) => r.b2b);
  const hsnB2C = hsnRows.filter((r) => !r.b2b);

  // ========== Totals ==========
  // v1.10.31 — GST-C3: sumRows now carries cess. GST-H2: credit notes
  // netted from grandTotals so GSTR-3B outward supply table reflects
  // the actual liability (was over-stated by full CN amount).
  const sumRows = (rows) => rows.reduce((acc, r) => ({
    taxable: acc.taxable + r.taxable, cgst: acc.cgst + r.cgst, sgst: acc.sgst + r.sgst,
    igst: acc.igst + r.igst, cess: acc.cess + (r.cess || 0), total: acc.total + r.total,
  }), { taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, total: 0 });
  const b2bTotals = sumRows(b2bRows);
  const b2cTotals = b2cRates.reduce((acc, rate) => {
    const d = b2cByRate[rate];
    return {
      taxable: acc.taxable + d.taxable, cgst: acc.cgst + d.cgst, sgst: acc.sgst + d.sgst,
      igst: acc.igst + d.igst, cess: acc.cess + (d.cess || 0), total: acc.total + d.total,
    };
  }, { taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, total: 0 });
  // v1.10.31 — GST-H2: subtract credit note totals from outward supply.
  const cnTotals = (creditNotes || []).reduce((acc, b) => {
    const t = b.data?.totals || {};
    const isInter = billIsInterstate(b);
    return {
      taxable: acc.taxable + (getTaxableAmount(t) || 0),
      cgst: acc.cgst + (isInter ? 0 : (t.cgst || 0)),
      sgst: acc.sgst + (isInter ? 0 : ((t.sgst || 0) + (t.utgst || 0))),
      igst: acc.igst + (isInter ? (t.igst || 0) : 0),
      cess: acc.cess + (t.cess || 0),
      total: acc.total + (t.total || 0),
    };
  }, { taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, total: 0 });
  const grandTotals = {
    taxable: Math.max(0, b2bTotals.taxable + b2cTotals.taxable - cnTotals.taxable),
    cgst: Math.max(0, b2bTotals.cgst + b2cTotals.cgst - cnTotals.cgst),
    sgst: Math.max(0, b2bTotals.sgst + b2cTotals.sgst - cnTotals.sgst),
    igst: Math.max(0, b2bTotals.igst + b2cTotals.igst - cnTotals.igst),
    cess: Math.max(0, b2bTotals.cess + b2cTotals.cess - cnTotals.cess),
    total: b2bTotals.total + b2cTotals.total - cnTotals.total, // signed — CN nets down
    cnTotals, // exposed for UI reconciliation display
  };

  // ========== GSTR-3B ==========
  // v1.10.66 (#61) — exports are zero-rated supplies, GSTR-3B 3.1(b). IGST paid
  // on an export is still tax payable, so it joins the output tax below even
  // though the export itself is reported outside 3.1(a).
  // v1.10.83 - supplies to an SEZ are zero-rated too and belong in 3.1(b),
  // not in 3.1(a) with the B2B sales (see zeroRatedTotals in utils/lut.js).
  // GSTR-1 still lists them in B2B (SEWP / SEWOP), as the portal wants.
  const zeroRated = zeroRatedTotals(filteredBills, isExportBill);
  const exportTotals = zeroRated.zero; // 3.1(b)
  const outward31aAll = withoutZeroRated(grandTotals, zeroRated.inDomestic);
  // v1.10.84 - nil-rated / exempt / non-GST lines of tax invoices are in the
  // invoice totals; they are reported in 3.1(c) / 3.1(e), not 3.1(a).
  const outward31a = { ...outward31aAll, taxable: outward31aAll.taxable - nilSum(r => r.onTaxInvoice) }; // 3.1(a)
  const outputTax = { cgst: outward31a.cgst, sgst: outward31a.sgst, igst: outward31a.igst + exportTotals.igst };
  // ITC from expenses — P1 #15 fix: route to IGST when the expense is
  // interstate (vendor charged IGST, e.g. AWS / Google / Adobe from an
  // out-of-state office). Was unconditionally splitting 50/50 into
  // CGST/SGST → mis-routed ITC in GSTR-3B Table 4(A). Legacy expense
  // records without the field default to intrastate (safest — preserves
  // pre-v1.6.8 behaviour so no book values shift silently).
  const itcFromExpensesOnly = filteredExpenses.reduce((acc, e) => {
    const gst = e.gstAmount || 0;
    if (e.interstate) {
      return { cgst: acc.cgst, sgst: acc.sgst, igst: acc.igst + gst };
    }
    const half = Math.round((gst / 2) * 100) / 100;
    return { cgst: acc.cgst + half, sgst: acc.sgst + (gst - half), igst: acc.igst };
  }, { cgst: 0, sgst: 0, igst: 0 });
  // ITC from purchase bills
  const filteredPurchases = purchases.filter(p => filterByPeriod(p.date));
  // ITC from purchases — route to IGST when the purchase is interstate (supplier charged IGST),
  // otherwise split CGST/SGST. Without this, an interstate purchase incorrectly added its tax
  // to CGST+SGST in the GSTR-3B Table 4(A).
  const itcFromPurchases = filteredPurchases.reduce((acc, p) => {
    const tax = p.totalTax || purchaseBookTotals(p).tax;
    if (p.interstate) {
      return { cgst: acc.cgst, sgst: acc.sgst, igst: acc.igst + tax };
    }
    const half = Math.round((tax / 2) * 100) / 100;
    return { cgst: acc.cgst + half, sgst: acc.sgst + (tax - half), igst: acc.igst };
  }, { cgst: 0, sgst: 0, igst: 0 });
  // Compensation cess paid on purchases is input tax credit too (GSTR-3B
  // Table 4(A) csamt); it was always reported as 0.
  const itcCessFromPurchases = filteredPurchases.reduce((s, p) => s + purchaseBookTotals(p).cess, 0);
  // Combined ITC
  const itcFromExpenses = {
    cgst: itcFromExpensesOnly.cgst + itcFromPurchases.cgst,
    sgst: itcFromExpensesOnly.sgst + itcFromPurchases.sgst,
    igst: itcFromExpensesOnly.igst + itcFromPurchases.igst,
  };
  // v1.10.76 (#81) - credit set off across heads in the legal order (see setOffITC).
  const setOff = setOffITC(outputTax, itcFromExpenses);
  const netTax = setOff.payable;
  const itcCarry = setOff.carry;
  const hasCarry = itcCarry.igst + itcCarry.cgst + itcCarry.sgst > 0;

  // ========== Document Summary ==========
  // v1.10.74 - Table 13 counts cancelled documents too: "Total" is every
  // number issued in the series, "Cancelled" the ones cancelled, and the
  // portal's net issued is the difference.
  // v1.10.79 - one row per number series, under the portal's document
  // nature (1 invoices, 5 credit notes, 12 delivery challans). It was one row
  // per type, so two series (a changed prefix, a business's own numbering)
  // made a from/to that spanned both; quotations and proformas, which are not
  // reported, were listed; and the file numbered natures by list position.
  // Table 13 (gstr1Json.docIssueSummary, tested; ERR-056).
  const docSummary = docIssueSummary([...allFilteredBills, ...cancelledInPeriod]);

  // ========== Validation Warnings ==========
  const warnings = [];
  noRateBills.forEach(bill => {
    warnings.push({ type: 'error', msg: `Invoice ${bill.invoiceNumber} is in ${bill.currency || bill.data?.invoiceOptions?.currency} with no exchange rate, so it is left out of this return until you add the rate. Open it (Invoice Details → Currency): if its amounts are really in rupees (older versions could keep the last client's currency), set the currency to INR; otherwise enter the exchange rate.` });
  });
  filteredBills.forEach(bill => {
    const { client, items } = bill.data;
    // v1.10.83 - a client abroad has no GSTIN: the number there is their own
    // tax ID (VAT, EIN...), and an export has no Indian state.
    if (isExportBill(bill)) {
      (items || []).forEach(item => {
        if (!item.hsn || item.hsn === 'N/A') warnings.push({ type: 'warning', msg: `Invoice ${bill.invoiceNumber}: Item "${item.name || 'Unnamed'}" has no HSN/SAC code` });
      });
      return;
    }
    // Official GSTIN format (gstinFormatOk); the GSTIN was cleaned on load (#141).
    if (client?.gstin && !gstinFormatOk(client.gstin)) {
      warnings.push({ type: 'error', msg: `Invoice ${bill.invoiceNumber}: Invalid client GSTIN format — ${client.gstin}` });
    }
    (items || []).forEach(item => {
      if (!item.hsn || item.hsn === 'N/A') {
        warnings.push({ type: 'warning', msg: `Invoice ${bill.invoiceNumber}: Item "${item.name || 'Unnamed'}" has no HSN/SAC code` });
      }
    });
    if (client?.gstin && !client?.state) {
      warnings.push({ type: 'warning', msg: `Invoice ${bill.invoiceNumber}: Client ${client.name} has GSTIN but no State — Place of Supply may be wrong` });
    }
    // v1.10.79 (#95) - an inter-state sale needs the buyer's state as place of
    // supply; the portal refuses an inter-state row whose state is your own.
    if (!client?.gstin && billIsInterstate(bill) && !isExportBill(bill) && countsAsSales(bill)) {
      const pos = getStateCode(bill.data?.details?.placeOfSupply || client?.state || '');
      if (!pos || pos === (getStateCode(profile.gstin || '') || getStateCode(profile.state || ''))) {
        warnings.push({ type: 'error', msg: `Invoice ${bill.invoiceNumber}: inter-state sale to ${client?.name || 'an unregistered buyer'} without the buyer's state as Place of Supply. Open the invoice and set Place of Supply.` });
      }
    }
  });
  if (!profile.gstin) {
    warnings.push({ type: 'error', msg: 'Your business GSTIN is not set. Go to Settings → Company Details to add it.' });
  }
  // v1.10.66 (#61) — exports are left out of the GSTR-1 file (see isExportBill).
  // Put first, so the three-message limit on the banner can never hide it.
  if (exportBills.length > 0) {
    const listed = exportBills.slice(0, 3).map(b => b.invoiceNumber).join(', ') + (exportBills.length > 3 ? ', …' : '');
    // v1.10.84 - they are in the JSON file now (Table 6A).
    warnings.unshift({ type: 'warning', msg: `${exportBills.length} export invoice(s) (${listed}) are in Table 6A of the GSTR-1 file. For goods, add the shipping bill number, date and port code on the portal after uploading; their value is in GSTR-3B 3.1(b).` });
  }

  // ========== Filing Period Key ==========
  const getPeriodKey = () => {
    if (filterMode === 'month') return `${monthFilter}_${yearFilter}`;
    if (filterMode === 'quarter') return `${quarterFilter}_${yearFilter}`;
    return fyFilter;
  };
  const periodKey = getPeriodKey();

  // v1.10.74 - the return period (MMYYYY) in the JSON files. A quarterly
  // (QRMP) return is filed for the quarter's last month, and a full year is
  // shown as March of the year it ends. It used to be the month of the first
  // bill in the list, which could be any month of the quarter or year.
  const getReturnPeriod = () => {
    if (filterMode === 'month') return String(parseInt(monthFilter) + 1).padStart(2, '0') + yearFilter;
    if (filterMode === 'quarter') {
      const q = QUARTERS.find(x => x.id === quarterFilter);
      const lastMonth = q ? q.months[q.months.length - 1] : 2;
      return String(lastMonth + 1).padStart(2, '0') + yearFilter;
    }
    const fy = fyOptions.find(f => f.value === fyFilter);
    return fy ? `03${fy.to.slice(0, 4)}` : getFilingPeriod(new Date().toISOString());
  };
  // Table 12 comes in a B2B and a B2C list from the May 2025 return.
  const hsnSplit = hsnSplitFrom(getReturnPeriod());
  const periodFiling = filingStatus[periodKey] || {};

  // v1.10.18 — reported: "in every option give option to change or edit
  // because by mistake if click happens user can change that". Now the R1
  // and 3B status pills at the top toggle on click (Pending → Filed → Pending)
  // so a mistaken Mark Filed can be reverted without hunting through
  // settings. `markFiled` remains a set-only helper for the explicit
  // Mark-Filed button; toggling uses `toggleFiled` below.
  const toggleFiled = (returnType) => {
    const next = !periodFiling[returnType];
    const updated = {
      ...filingStatus,
      [periodKey]: {
        ...periodFiling,
        [returnType]: next,
        [`${returnType}Date`]: next ? new Date().toISOString() : null,
      },
    };
    setFilingStatus(updated);
    try { localStorage.setItem(filingKey, JSON.stringify(updated)); } catch { /* localStorage full */ }
    toast(`${returnType.toUpperCase()} marked as ${next ? 'filed' : 'pending'} for this period`, 'success');
  };

  const markFiled = (returnType) => {
    const updated = { ...filingStatus, [periodKey]: { ...periodFiling, [returnType]: true, [`${returnType}Date`]: new Date().toISOString() } };
    setFilingStatus(updated);
    try { localStorage.setItem(filingKey, JSON.stringify(updated)); } catch { /* localStorage full */ }
    toast(`${returnType.toUpperCase()} marked as filed for this period`, 'success');
  };

  // A period with purchase bills has input tax credit to claim (and maybe
  // reverse charge), so it is not a NIL GSTR-3B even with no sales.
  const isNilReturn = filteredBills.length === 0 && filteredExpenses.length === 0 && filteredPurchases.length === 0;

  // ========== CSV Exports ==========
  const exportB2B = () => {
    if (b2bRows.length === 0) { toast('No B2B data to export', 'warning'); return; }
    downloadCSV('GSTR1_B2B_Invoices.csv',
      ['GSTIN/UIN', 'Receiver Name', 'Invoice Number', 'Invoice Date', 'Invoice Value', 'Place of Supply', 'Reverse Charge', 'Invoice Type', 'Supply Type', 'Taxable Value', 'CGST Amount', 'SGST Amount', 'IGST Amount'],
      b2bRegular.map(bill => {
        const { client, totals, details } = bill.data;
        const isInter = billIsInterstate(bill);
        const pos = getStateCode(details?.placeOfSupply || client?.state || '');
        return [client.gstin, client.name || bill.clientName || '', bill.invoiceNumber || '', formatDateGST(bill.invoiceDate), (totals?.total || 0).toFixed(2), placeOfSupplyLabel(pos), 'N', 'Regular', isInter ? 'Inter State' : 'Intra State', getTaxableAmount(totals).toFixed(2), isInter ? 0 : (totals?.cgst || 0).toFixed(2), isInter ? 0 : ((totals?.sgst || 0) + (totals?.utgst || 0)).toFixed(2), isInter ? (totals?.igst || 0).toFixed(2) : 0];
      }));
    toast('B2B CSV downloaded — matches GSTR-1 Table 4A format', 'success');
  };

  const exportB2C = () => {
    if (b2cRates.length === 0 && b2cLarge.length === 0) { toast('No B2C data to export', 'warning'); return; }
    const b2csData = {};
    b2cSmall.forEach(bill => {
      const { profile: prof, client, items, details } = bill.data;
      const isInter = billIsInterstate(bill);
      const pos = getStateCode(details?.placeOfSupply || client?.state || prof?.state || '');
      const splyType = isInter ? 'INTER' : 'INTRA';
      (items || []).forEach(item => {
        const rate = item.taxPercent || 0;
        const key = `${splyType}_${pos}_${rate}`;
        if (!b2csData[key]) b2csData[key] = { splyType, pos, rate, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
        const split = billSplit(bill, item, isInter, !!bill.data?.taxInclusive, billIsIntraUT(bill));
        b2csData[key].taxable += split.taxable; b2csData[key].cgst += split.cgst; b2csData[key].sgst += split.sgst + split.utgst; b2csData[key].igst += split.igst;
        b2csData[key].cess = (b2csData[key].cess || 0) + split.cess;
      });
    });
    downloadCSV('GSTR1_B2C_Small.csv', ['Type', 'Place of Supply', 'Rate', 'Taxable Value', 'CGST Amount', 'SGST Amount', 'IGST Amount', 'Cess Amount'],
      Object.values(b2csData).map(d => [d.splyType === 'INTER' ? 'Inter State' : 'Intra State', placeOfSupplyLabel(d.pos), d.rate + '%', d.taxable.toFixed(2), d.cgst.toFixed(2), d.sgst.toFixed(2), d.igst.toFixed(2), (d.cess || 0).toFixed(2)]));
    if (b2cLarge.length > 0) {
      downloadCSV('GSTR1_B2C_Large.csv', ['Invoice Number', 'Invoice Date', 'Invoice Value', 'Place of Supply', 'Taxable Value', 'IGST Amount', 'Cess Amount'],
        b2cLarge.map(bill => { const { client, totals, details } = bill.data; const pos = getStateCode(details?.placeOfSupply || client?.state || ''); return [bill.invoiceNumber, formatDateGST(bill.invoiceDate), (totals?.total || 0).toFixed(2), placeOfSupplyLabel(pos), getTaxableAmount(totals).toFixed(2), (totals?.igst || 0).toFixed(2), (totals?.cess || 0).toFixed(2)]; }));
    }
    toast('B2C CSV downloaded', 'success');
  };

  const exportHSN = () => {
    if (hsnRows.length === 0) { toast('No HSN data', 'warning'); return; }
    // v1.10.84 (#166) - from the May 2025 return the portal takes Table 12 as
    // two lists, so the CSV comes as two files (a list with no rows is left
    // out). Earlier periods keep the one combined file.
    if (!hsnSplit) {
      downloadCSV('GSTR1_HSN_Summary.csv', HSN_CSV_HEADERS, mergeHsnRows(hsnRows).map(hsnCsvRow));
    } else {
      [['B2B', hsnB2B], ['B2C', hsnB2C]].forEach(([part, rows]) => {
        if (rows.length) downloadCSV(`GSTR1_HSN_${part}.csv`, HSN_CSV_HEADERS, rows.map(hsnCsvRow));
      });
    }
    toast(hsnSplit ? 'HSN CSV downloaded - B2B and B2C files, GSTR-1 Table 12 format' : 'HSN CSV downloaded - GSTR-1 Table 12 format', 'success');
  };

  const exportCDNR = () => {
    const cdnrBills = creditNotes.filter(b => b.data?.client?.gstin);
    const cdnurBills = creditNotes.filter(b => !b.data?.client?.gstin);
    if (cdnrBills.length === 0 && cdnurBills.length === 0) { toast('No Credit Notes', 'warning'); return; }
    if (cdnrBills.length > 0) {
      downloadCSV('GSTR1_CDNR.csv', ['GSTIN/UIN', 'Receiver Name', 'Note Number', 'Note Date', 'Note Type', 'Place of Supply', 'Reverse Charge', 'Note Value', 'Taxable Value', 'IGST Amount', 'CGST Amount', 'SGST Amount'],
        cdnrBills.map(bill => { const { client, totals } = bill.data; const isInter = billIsInterstate(bill); const pos = getStateCode(bill.data.details?.placeOfSupply || client?.state || ''); return [client.gstin, client.name || bill.clientName, bill.invoiceNumber, formatDateGST(bill.invoiceDate), 'C', pos, 'N', (totals?.total || 0).toFixed(2), getTaxableAmount(totals).toFixed(2), isInter ? (totals?.igst || 0).toFixed(2) : '0.00', isInter ? '0.00' : (totals?.cgst || 0).toFixed(2), isInter ? '0.00' : ((totals?.sgst || 0) + (totals?.utgst || 0)).toFixed(2)]; }));
    }
    if (cdnurBills.length > 0) {
      downloadCSV('GSTR1_CDNUR.csv', ['Note Number', 'Note Date', 'Note Type', 'Place of Supply', 'Note Value', 'Taxable Value', 'IGST Amount', 'Cess Amount'],
        cdnurBills.map(bill => { const { client, totals } = bill.data; const pos = getStateCode(bill.data.details?.placeOfSupply || client?.state || ''); return [bill.invoiceNumber, formatDateGST(bill.invoiceDate), 'C', pos, (totals?.total || 0).toFixed(2), getTaxableAmount(totals).toFixed(2), (totals?.igst || 0).toFixed(2), (totals?.cess || 0).toFixed(2)]; }));
    }
    toast('Credit Notes exported', 'success');
  };

  const exportExports = () => {
    if (exportRows.length === 0) { toast('No export invoices', 'warning'); return; }
    downloadCSV('GSTR1_Exports_6A.csv', ['Export Type', 'Invoice Number', 'Invoice Date', 'Invoice Value (INR)', 'Rate', 'Taxable Value (INR)', 'IGST (INR)', 'Cess (INR)', 'Client', 'Country', 'Currency', 'Exchange Rate'],
      // An invoice with no rate has no rupee figures yet: left out (it is listed as an error).
      exportRows.filter(r => !r.missing).map(r => [r.type, r.invoiceNo, formatDateGST(r.date), r.value.toFixed(2), r.rates, r.taxable.toFixed(2), r.igst.toFixed(2), r.cess.toFixed(2), r.client, r.country, r.currency, r.missing ? 'MISSING' : r.fxRate]));
    toast('Exports (Table 6A) CSV downloaded', 'success');
  };

  const exportDocSummary = () => {
    if (Object.keys(docSummary).length === 0) { toast('No documents', 'warning'); return; }
    downloadCSV('GSTR1_Doc_Summary.csv', ['Document Type', 'Sr. No. From', 'Sr. No. To', 'Total Number', 'Cancelled'],
      Object.entries(docSummary).map(([, d]) => [d.type, d.from, d.to, d.total, d.cancelled]));
    toast('Document Summary CSV downloaded', 'success');
  };

  const exportGSTR3B = () => {
    downloadCSV('GSTR3B_Summary.csv', ['Description', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Total'], [
      ['3.1(a) Outward taxable supplies', outward31a.taxable.toFixed(2), outward31a.igst.toFixed(2), outward31a.cgst.toFixed(2), outward31a.sgst.toFixed(2), (outward31a.igst + outward31a.cgst + outward31a.sgst).toFixed(2)],
      ['3.1(b) Zero rated (exports, SEZ)', exportTotals.taxable.toFixed(2), exportTotals.igst.toFixed(2), '0.00', '0.00', exportTotals.igst.toFixed(2)],
      ['4(A) ITC Available', '', itcFromExpenses.igst.toFixed(2), itcFromExpenses.cgst.toFixed(2), itcFromExpenses.sgst.toFixed(2), (itcFromExpenses.igst + itcFromExpenses.cgst + itcFromExpenses.sgst).toFixed(2)],
      ['6.1 ITC utilised', '', setOff.used.igst.toFixed(2), setOff.used.cgst.toFixed(2), setOff.used.sgst.toFixed(2), (setOff.used.igst + setOff.used.cgst + setOff.used.sgst).toFixed(2)],
      ['6.1 Tax Payable in cash', '', netTax.igst.toFixed(2), netTax.cgst.toFixed(2), netTax.sgst.toFixed(2), (netTax.igst + netTax.cgst + netTax.sgst).toFixed(2)],
      ['ITC carried forward', '', itcCarry.igst.toFixed(2), itcCarry.cgst.toFixed(2), itcCarry.sgst.toFixed(2), (itcCarry.igst + itcCarry.cgst + itcCarry.sgst).toFixed(2)],
    ]);
    toast('GSTR-3B summary CSV downloaded', 'success');
  };

  // ========== GSTR-3B JSON Export (GSTN offline tool format, schema v1.7) ==========
  // Matches the schema accepted by https://services.gst.gov.in/services/auth/dashboard
  // Upload via: GST portal → Returns → GSTR-3B → Prepare Offline → Upload JSON
  const exportGSTR3BJSON = () => {
    if (filteredBills.length === 0 && filteredExpenses.length === 0) {
      toast('No data to export for this period', 'warning');
      return;
    }
    const gstin = profile.gstin || '';
    const ret_period = getReturnPeriod();

    // Outward supplies — currently we only emit Table 3.1(a). Zero-rated / nil / exempt
    // require invoice-level categorization which is on the v1.5 roadmap; for now those
    // rows are zero-filled rather than omitted (the portal expects the structure even
    // if values are 0).
    const sup_details = {
      osup_det: {
        // v1.10.31 — GST-C3: cess populated (was hardcoded 0 → GSTR-1 emitted
        // cess but GSTR-3B did not → Section 61 mismatch notice for
        // tobacco / coal / aerated / motor-vehicle sellers).
        txval: round2(outward31a.taxable),
        iamt: round2(outward31a.igst),
        camt: round2(outward31a.cgst),
        samt: round2(outward31a.sgst),
        csamt: round2(outward31a.cess),
      },
      // v1.10.66 (#61) — exports, kept out of osup_det above. v1.10.83 - and SEZ supplies.
      osup_zero: { txval: round2(exportTotals.taxable), iamt: round2(exportTotals.igst), csamt: round2(exportTotals.cess) },
      osup_nil_exmp: { txval: round2(nilSum(r => r.treatment !== 'nongst')) }, // v1.10.84 - 3.1(c)
      // v1.10.31 — GST-M10: RCM inward supplies populated from purchases
      // flagged as reverse-charge (was hardcoded 0 → self-remit RCM liability
      // never reported → interest u/s 50).
      isup_rev: (() => {
        // v1.10.74 - only this return period's purchases; was every purchase ever
        // recorded, so past reverse-charge tax was declared again each period.
        const rcmPurchases = filteredPurchases.filter(p => !!p.reverseCharge);
        if (rcmPurchases.length === 0) return { txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
        const t = rcmPurchases.reduce((acc, p) => ({
          txval: acc.txval + (Number(p.taxableAmount) || 0),
          iamt: acc.iamt + (p.interstate ? (Number(p.totalTax) || 0) : 0),
          camt: acc.camt + (p.interstate ? 0 : (Number(p.totalTax) || 0) / 2),
          samt: acc.samt + (p.interstate ? 0 : (Number(p.totalTax) || 0) / 2),
          csamt: acc.csamt + (Number(p.totalCess) || purchaseBookTotals(p).cess),
        }), { txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 });
        return {
          txval: round2(t.txval), iamt: round2(t.iamt),
          camt: round2(t.camt), samt: round2(t.samt), csamt: round2(t.csamt),
        };
      })(),
      osup_nongst: { txval: round2(nilSum(r => r.treatment === 'nongst')) }, // v1.10.84 - 3.1(e)
    };

    const itc_elg = {
      itc_avl: [
        { ty: 'IMPG', iamt: 0, camt: 0, samt: 0, csamt: 0 },
        { ty: 'IMPS', iamt: 0, camt: 0, samt: 0, csamt: 0 },
        { ty: 'ISRC', iamt: 0, camt: 0, samt: 0, csamt: 0 },
        { ty: 'ISD',  iamt: 0, camt: 0, samt: 0, csamt: 0 },
        { ty: 'OTH',
          iamt: round2(itcFromExpenses.igst),
          camt: round2(itcFromExpenses.cgst),
          samt: round2(itcFromExpenses.sgst),
          csamt: round2(itcCessFromPurchases),
        },
      ],
      itc_inelg: [
        { ty: 'RUL', iamt: 0, camt: 0, samt: 0, csamt: 0 },
        { ty: 'OTH', iamt: 0, camt: 0, samt: 0, csamt: 0 },
      ],
    };

    const inward_sup = {
      isup_details: [
        { ty: 'GST',    inter: 0, intra: 0 },
        { ty: 'NONGST', inter: 0, intra: 0 },
      ],
    };

    // v1.10.43 — GSTR-3B root schema fields required by the offline
    // utility. Same fix pattern as GSTR-1 above: version + hash gate
    // the entire file, and were previously missing → portal rejected
    // with "Error in JSON structure validation" before any per-section
    // check ran. `"hash": "hash"` is the reference placeholder; the
    // portal computes the real hash on receipt.
    const gstr3b = {
      gstin, ret_period,
      version: 'GST3.0.4',
      hash: 'hash',
      sup_details, itc_elg, inward_sup,
    };
    const blob = new Blob([JSON.stringify(gstr3b, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `GSTR3B_${gstin || 'export'}_${ret_period}.json`; a.click();
    URL.revokeObjectURL(url);
    toast('GSTR-3B JSON exported — upload to GST portal offline tool', 'success');
  };

  // v1.10.43 — GSTR portal validation pre-flight. Reported: users
  // uploading our JSON to gst.gov.in were hitting "Error in JSON
  // structure validation" and per-invoice RET191xxx codes with no
  // in-app warning. Root causes traced against the offline utility
  // schema + published error-code list (RET191106 / RET191113 / …):
  //   - Missing root fields `version` / `hash` / `gt` / `cur_gt`
  //     (portal rejects the whole file before per-row checks)
  //   - Invoice number rules (RET191115): ≤16 chars, only [A-Za-z0-9-/]
  //   - Non-standard tax rate (RET191175): allowed {0, 0.25, 3, 5, 12,
  //     18, 28} only — the app permits customTaxRates for internal use
  //     but portal rejects them
  //   - HSN summary rules (Jan-2025 Table 12 mandatory):
  //       * items with no HSN cannot appear in hsn.data (was 'N/A' →
  //         regex fail on portal)
  //       * min HSN digit length gated by AATO (≤5Cr → 4-digit, >5Cr
  //         → 6-digit), user-selectable in profile (`aatoBand`).
  //
  // This function returns { blocked, warnings } so callers can decide
  // whether to abort (`blocked` non-empty) or just toast (`warnings`).
  const GST_STANDARD_RATES = GST_PORTAL_RATES;
  const INUM_REGEX = /^[A-Za-z0-9\-/]{1,16}$/;
  const validateGSTR1 = (bills) => {
    const blocked = [];
    const warnings = [];
    const aatoAbove5Cr = !!profile.aatoAbove5Cr;
    const minHsnDigits = aatoAbove5Cr ? 6 : 4;

    // Invoice number rules (RET191115) — portal rejects the whole file
    // if any inum is >16 chars or has disallowed chars. Collect the
    // offenders so the user can fix them in the source invoice.
    // v1.10.83 - an invoice in another currency without a rate would go into
    // the HSN summary in dollars as if they were rupees.
    // v1.10.83 (#133) - things the portal refuses the whole file for.
    if (!profile.gstin) blocked.push('Your business GSTIN is not set (Settings → Company).');
    if (filterMode === 'fy') blocked.push('A GSTR-1 file is for one month (or one quarter if you file quarterly). Choose Month or Quarter above.');
    const noPos = bills.filter(b => (b.data?.client?.gstin || billIsInterstate(b)) && !isExportBill(b)
      && !getStateCode(b.data?.details?.placeOfSupply || b.data?.client?.state || ''));
    if (noPos.length > 0) blocked.push(`${noPos.length} invoice(s) have no place of supply (${noPos.slice(0, 3).map(b => b.invoiceNumber).join(', ')}). Open each and set the client's state or Place of Supply.`);
    const noRate = noRateBills;
    if (noRate.length > 0) {
      blocked.push(`${noRate.length} invoice(s) in a foreign currency have no exchange rate (${noRate.slice(0, 3).map(b => b.invoiceNumber).join(', ')}). Open each: if the amounts are really in rupees, set the currency to INR; otherwise enter the exchange rate.`);
    }
    const badInums = bills.filter(b => !INUM_REGEX.test(b.invoiceNumber || ''));
    if (badInums.length > 0) {
      blocked.push(`${badInums.length} invoice number(s) violate portal rules (≤16 chars, only letters, digits, "-" or "/"). First: ${badInums.slice(0, 3).map(b => b.invoiceNumber).join(', ')}`);
    }

    // Tax rate rules (RET191175). Custom rates set in Print Settings →
    // customTaxRates work in-app but the portal has a fixed slab list.
    const badRates = new Set();
    let badRateItemCount = 0;
    bills.forEach(bill => {
      (bill.data?.items || []).forEach(item => {
        const rate = Number(item.taxPercent) || 0;
        if (!GST_STANDARD_RATES.includes(rate)) {
          badRates.add(rate);
          badRateItemCount += 1;
        }
      });
    });
    if (badRateItemCount > 0) {
      blocked.push(`${badRateItemCount} item(s) use non-standard tax rate(s) [${Array.from(badRates).sort().join(', ')}%]. Portal accepts only ${GST_STANDARD_RATES.join(', ')}%.`);
    }

    // HSN min-digit gate (Table 12 mandatory since Jan-2025). We only
    // WARN here — we still filter the offenders out of hsn.data below
    // so the file uploads. This lets users move forward while nudging
    // them to fix the source products.
    let missingHsnItemCount = 0;
    let shortHsnItemCount = 0;
    bills.forEach(bill => {
      (bill.data?.items || []).forEach(item => {
        const hsn = String(item.hsn || '').trim();
        if (!hsn || hsn === 'N/A') missingHsnItemCount += 1;
        else if (hsn.replace(/\D/g, '').length < minHsnDigits) shortHsnItemCount += 1;
      });
    });
    if (missingHsnItemCount > 0) {
      warnings.push(`${missingHsnItemCount} item(s) have no HSN — dropped from HSN summary. GSTR-1 Table 12 requires an HSN per item.`);
    }
    if (shortHsnItemCount > 0) {
      warnings.push(`${shortHsnItemCount} item(s) have HSN shorter than ${minHsnDigits} digits (required for ${aatoAbove5Cr ? '>' : '≤'}₹5 Cr AATO). Portal may reject.`);
    }

    return { blocked, warnings };
  };

  // ========== GSTR-1 JSON Export ==========
  const exportGSTR1JSON = () => {
    if (filteredBills.length === 0) { toast('No invoices to export', 'warning'); return; }

    // v1.10.43 — Pre-flight validation. Abort with a clear message if
    // any BLOCKING rule is broken (bad invoice number, non-standard
    // rate). Show warnings but proceed for merely lossy issues
    // (missing HSN → dropped from summary).
    const { blocked, warnings } = validateGSTR1(filteredBills);
    if (blocked.length > 0) {
      toast(`GSTR-1 export blocked — fix these first: ${blocked.join(' · ')}`, 'error', 12000);
      return;
    }

    const gstin = profile.gstin || '';
    const fp = getReturnPeriod();

    const b2bMap = {};
    b2bRegular.forEach(bill => {
      const { client, totals, items, details } = bill.data;
      const ctin = client.gstin;
      const isInter = billIsInterstate(bill);
      const isIntraUT = billIsIntraUT(bill);
      const isRcm = !!bill.data?.invoiceOptions?.reverseCharge;
      const pos = getStateCode(details?.placeOfSupply || client?.state || '');
      const rateMap = {};
      (items || []).filter(taxableLine(bill)).forEach(item => {
        const rate = item.taxPercent || 0;
        if (!rateMap[rate]) rateMap[rate] = { txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
        // v1.10.31 — GST-C2/H7: pass isIntraUT so UTGST folds into SGST bucket.
        const split = billSplit(bill, item, isInter, !!bill.data?.taxInclusive, isIntraUT);
        rateMap[rate].txval += split.taxable;
        rateMap[rate].iamt += split.igst;
        rateMap[rate].camt += split.cgst;
        rateMap[rate].samt += split.sgst + split.utgst;
        rateMap[rate].csamt += split.cess;
      });
      const rchrg = isRcm ? 'Y' : 'N';
      const isSEZ = !!client?.isSEZ;
      // v1.10.31 — GST-M3 + L5: `isLUT` now uses explicit flag first, term-
      // scanning fallback for legacy bills (was false-positive on "no LUT
      // applicable" text). Also GST-M9: SEZ + RCM combination — GSTN rejects
      // SEWP/SEWOP with rchrg='Y'. Coerce inv_typ to 'R' if rchrg='Y'.
      const isLUT = billIsLut(bill);
      // v1.10.84 - deemed exports (the client's tick) are DE.
      const invType = b2bInvType({ deemedExport: !!client?.isDeemedExport, rcm: isRcm, sez: isSEZ, lut: isLUT });
      // An invoice whose lines are all nil-rated / exempt is only in Table 8.
      if (!Object.keys(rateMap).length) return;
      if (!b2bMap[ctin]) b2bMap[ctin] = { ctin, inv: [] };
      // v1.10.31 — GST-C1: `val` per-invoice for RCM must reconcile with
      // per-rate iamt/camt/samt/csamt. When RCM, computeInvoiceTotals excludes
      // tax from `total`, but the per-rate map STILL emits the notional tax.
      // Portal validation requires `val ≈ txval + iamt + camt + samt + csamt`.
      // For RCM, we emit val inclusive of notional tax so both sides balance.
      // Also GST-H5: subtract round-off from val so per-rate sum matches.
      const rateTotal = Object.values(rateMap).reduce((s, d) => s + d.txval + d.iamt + d.camt + d.samt + d.csamt, 0);
      const val = isRcm ? round2(rateTotal) : round2((totals?.total || 0) - (totals?.roundOff || 0));
      b2bMap[ctin].inv.push({
        inum: bill.invoiceNumber, idt: formatDateGST(bill.invoiceDate), val, pos, rchrg, inv_typ: invType,
        itms: Object.entries(rateMap).map(([rt, d], i) => ({ num: i + 1, itm_det: { rt: Number(rt), txval: round2(d.txval), iamt: round2(d.iamt), camt: round2(d.camt), samt: round2(d.samt), csamt: round2(d.csamt) } })),
      });
    });

    // v1.10.83 (#133) - credit notes to buyers without a GSTIN (not exports):
    // a large inter-state one goes in Table 9B (cdnur, as B2CL); the rest
    // reduce their B2CS row, as the portal expects (and as GSTR-3B and the HSN
    // summary already do). typ "OE" (not e-commerce) on every B2CS row.
    const unregNotes = creditNotes.filter(b => !b.data?.client?.gstin && !isExportBill(b));
    const isLargeNote = (b) => billIsInterstate(b) && (b.totalAmount || 0) > b2clThreshold(b.invoiceDate);
    const b2csMap = {};
    const addB2cs = (bill, sign) => {
      const { profile: prof, client, items, details } = bill.data;
      const isInter = billIsInterstate(bill);
      const isIntraUT = billIsIntraUT(bill);
      const pos = getStateCode(details?.placeOfSupply || client?.state || prof?.state || '');
      const splyTy = isInter ? 'INTER' : 'INTRA';
      (items || []).filter(taxableLine(bill)).forEach(item => {
        const rate = Number(item.taxPercent) || 0; const key = `${splyTy}_${pos}_${rate}`;
        if (!b2csMap[key]) b2csMap[key] = { sply_ty: splyTy, pos, typ: 'OE', rt: rate, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
        const split = billSplit(bill, item, isInter, !!bill.data?.taxInclusive, isIntraUT);
        b2csMap[key].txval += sign * split.taxable;
        b2csMap[key].iamt += sign * split.igst;
        b2csMap[key].camt += sign * split.cgst;
        b2csMap[key].samt += sign * (split.sgst + split.utgst); // v1.10.31 — UTGST folded
        b2csMap[key].csamt += sign * split.cess; // v1.10.31 — cess from split
      });
    };
    b2cSmall.forEach(bill => addB2cs(bill, 1));
    unregNotes.filter(b => !isLargeNote(b)).forEach(bill => addB2cs(bill, -1));
    const cdnurArr = unregNotes.filter(isLargeNote).map(bill => {
      const { client, totals, items, details } = bill.data;
      const rateMap = {};
      (items || []).filter(taxableLine(bill)).forEach(item => {
        const rate = Number(item.taxPercent) || 0; if (!rateMap[rate]) rateMap[rate] = { txval: 0, iamt: 0, csamt: 0 };
        const split = billSplit(bill, item, true, !!bill.data?.taxInclusive);
        rateMap[rate].txval += split.taxable; rateMap[rate].iamt += split.igst; rateMap[rate].csamt += split.cess;
      });
      if (!Object.keys(rateMap).length) return null;
      return { typ: 'B2CL', ntty: 'C', nt_num: bill.invoiceNumber, nt_dt: formatDateGST(bill.invoiceDate), val: round2(totals?.total || 0),
        pos: getStateCode(details?.placeOfSupply || client?.state || ''),
        itms: Object.entries(rateMap).map(([rt, d], i) => ({ num: i + 1, itm_det: { rt: Number(rt), txval: round2(d.txval), iamt: round2(d.iamt), csamt: round2(d.csamt) } })) };
    }).filter(Boolean);
    // v1.10.84 - Table 6A: export invoices; their credit notes go in cdnur as
    // EXPWP / EXPWOP. They were left for the user to type in by hand.
    const exportLines = (bill) => (bill.data?.items || []).map(item => {
      const split = billSplit(bill, item, true, !!bill.data?.taxInclusive);
      return { rt: Number(item.taxPercent) || 0, txval: split.taxable, iamt: split.igst, csamt: split.cess };
    });
    const expArr = expTable(exportBills.map(bill => ({
      inum: bill.invoiceNumber, idt: formatDateGST(bill.invoiceDate), val: bill.data?.totals?.total || 0,
      wopay: exportWopay(bill), lines: exportLines(bill),
    })));
    creditNotes.filter(isExportBill).forEach(bill => cdnurArr.push(exportNote({
      nt_num: bill.invoiceNumber, nt_dt: formatDateGST(bill.invoiceDate), val: bill.data?.totals?.total || 0,
      wopay: exportWopay(bill), lines: exportLines(bill),
    })));
    const b2csArr = Object.values(b2csMap).map(d => ({ ...d, txval: round2(d.txval), iamt: round2(d.iamt), camt: round2(d.camt), samt: round2(d.samt), csamt: round2(d.csamt) }));

    const b2clMap = {};
    b2cLarge.forEach(bill => {
      const { client, totals, items, details } = bill.data;
      const pos = getStateCode(details?.placeOfSupply || client?.state || '');
      const rateMap = {};
      (items || []).filter(taxableLine(bill)).forEach(item => {
        const rate = item.taxPercent || 0; if (!rateMap[rate]) rateMap[rate] = { txval: 0, iamt: 0, csamt: 0 };
        // P1 #23: pass taxInclusive as 3rd arg. Pre-v1.6.8 this was omitted
        // so tax-inclusive B2CL bills inflated taxable + IGST values.
        const split = billSplit(bill, item, true, !!bill.data?.taxInclusive);
        rateMap[rate].txval += split.taxable; rateMap[rate].iamt += split.igst;
        rateMap[rate].csamt += split.cess; // rounded per line, as on the invoice
      });
      if (!Object.keys(rateMap).length) return;
      if (!b2clMap[pos]) b2clMap[pos] = { pos, inv: [] };
      b2clMap[pos].inv.push({ inum: bill.invoiceNumber, idt: formatDateGST(bill.invoiceDate), val: round2(totals?.total || 0), itms: Object.entries(rateMap).map(([rt, d], i) => ({ num: i + 1, itm_det: { rt: Number(rt), txval: round2(d.txval), iamt: round2(d.iamt), csamt: round2(d.csamt) } })) });
    });

    const cdnrMap = {};
    creditNotes.filter(b => b.data?.client?.gstin && !isExportBill(b)).forEach(bill => {
      const { client, totals, items, details } = bill.data;
      const ctin = client.gstin;
      const isInter = billIsInterstate(bill);
      const pos = getStateCode(details?.placeOfSupply || client?.state || '');
      const rateMap = {};
      (items || []).filter(taxableLine(bill)).forEach(item => {
        const rate = item.taxPercent || 0; if (!rateMap[rate]) rateMap[rate] = { txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
        // UTGST goes in samt, as for B2B (it was dropped for intra-UT notes).
        const split = billSplit(bill, item, isInter, !!bill.data?.taxInclusive, billIsIntraUT(bill));
        rateMap[rate].txval += split.taxable; rateMap[rate].iamt += split.igst; rateMap[rate].camt += split.cgst; rateMap[rate].samt += split.sgst + split.utgst;
        rateMap[rate].csamt += split.cess;
      });
      // Same rchrg / inv_typ derivation as B2B — credit notes carry the same
      // classification as the original supply (P1 #11, #12, #13).
      const rchrg = bill.data?.invoiceOptions?.reverseCharge ? 'Y' : 'N';
      const isSEZ = !!client?.isSEZ;
      // v1.10.83 - same rules as B2B: the LUT tick first, "LUT" as a word, and
      // SEZ with reverse charge filed as R.
      const isLUT = billIsLut(bill);
      const invType = b2bInvType({ deemedExport: !!client?.isDeemedExport, rcm: rchrg === 'Y', sez: isSEZ, lut: isLUT });
      if (!Object.keys(rateMap).length) return;
      if (!cdnrMap[ctin]) cdnrMap[ctin] = { ctin, nt: [] };
      cdnrMap[ctin].nt.push({ ntty: 'C', nt_num: bill.invoiceNumber, nt_dt: formatDateGST(bill.invoiceDate), val: round2(totals?.total || 0), pos, rchrg, inv_typ: invType,
        itms: Object.entries(rateMap).map(([rt, d], i) => ({ num: i + 1, itm_det: { rt: Number(rt), txval: round2(d.txval), iamt: round2(d.iamt), camt: round2(d.camt), samt: round2(d.samt), csamt: round2(d.csamt) } })) });
    });

    // v1.10.43 - the portal rejects an HSN of 'N/A' or blank, so hsnSummary
    // leaves those lines out; the pre-flight warning told the user how many.
    const unknownUnitCount = hsnSum.customUnit;

    const docDet = docIssueDetails(docSummary);

    // v1.10.83 (#133) - as India Compliance writes it (accepted by the portal):
    // gstin, fp, version and hash, then the tables. The turnover fields gt /
    // cur_gt were only for 2017-18 returns and are no longer sent. Blank values
    // and empty tables are removed: the portal rejects them.
    const gstr1 = stripEmpty({
      gstin, fp,
      version: 'GST3.1.6',
      hash: 'hash',
      b2b: Object.values(b2bMap), b2cs: b2csArr,
      b2cl: Object.values(b2clMap),
      cdnr: Object.values(cdnrMap),
      cdnur: cdnurArr,
      exp: expArr,
      nil: nilTable(nilRows),
      hsn: hsnTable(hsnRows, fp),
      doc_issue: { doc_det: docDet },
    });

    const blob = new Blob([JSON.stringify(gstr1, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `GSTR1_${gstin || 'export'}_${fp}.json`; a.click();
    URL.revokeObjectURL(url);

    // Collect any lossy warnings (from pre-flight + UQC fallback) into
    // a single toast so the user knows what to fix at source without
    // hitting the portal.
    const postWarnings = [...warnings];
    if (unknownUnitCount > 0) {
      postWarnings.push(`${unknownUnitCount} item(s) used a custom unit and were exported as UQC 'OTH'.`);
    }
    if (postWarnings.length > 0) {
      toast(`GSTR-1 JSON exported. ⚠ ${postWarnings.join(' · ')}`, 'warning', 10000);
    } else {
      toast('GSTR-1 JSON exported — upload to GST portal offline tool', 'success');
    }
  };

  // ========== RENDER ==========
  const totalTax = grandTotals.cgst + grandTotals.sgst + grandTotals.igst;
  const netPayable = netTax.igst + netTax.cgst + netTax.sgst;

  return (
    <div className="dashboard-container">
      {/* Header row: title + period selector + portal link */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>GST Returns</h1>
        <HelpButton title="GST Returns — how to use" doc="gst-returns" />
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
          <select className="form-input" value={filterMode} onChange={e => setFilterMode(e.target.value)} style={{ width: 'auto', minWidth: '120px' }}>
            <option value="month">Monthly</option>
            <option value="quarter">Quarterly (QRMP)</option>
            <option value="fy">Full Year</option>
          </select>
          {filterMode === 'fy' ? (
            <select className="form-input" value={fyFilter} onChange={e => setFyFilter(e.target.value)} style={{ width: 'auto' }}>
              {fyOptions.map(fy => <option key={fy.value} value={fy.value}>{fy.label}</option>)}
            </select>
          ) : filterMode === 'quarter' ? (
            <>
              <select className="form-input" value={quarterFilter} onChange={e => setQuarterFilter(e.target.value)} style={{ width: 'auto' }}>
                {QUARTERS.map(q => <option key={q.id} value={q.id}>{q.label}</option>)}
              </select>
              <select className="form-input" value={yearFilter} onChange={e => setYearFilter(e.target.value)} style={{ width: 'auto', minWidth: '80px' }}>
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </>
          ) : (
            <>
              <select className="form-input" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} style={{ width: 'auto' }}>
                {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select className="form-input" value={yearFilter} onChange={e => setYearFilter(e.target.value)} style={{ width: 'auto', minWidth: '80px' }}>
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </>
          )}
          {/* Filing status — v1.10.18: clickable to toggle. Reported: "in
              every option give option to change or edit because by mistake
              if click happens user can change that". */}
          <button type="button" onClick={() => toggleFiled('gstr1')}
            title={periodFiling.gstr1 ? 'Click to mark as pending' : 'Click to mark as filed'}
            style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '10px', border: 'none', cursor: 'pointer', background: periodFiling.gstr1 ? '#ecfdf5' : '#fef2f2', color: periodFiling.gstr1 ? '#059669' : '#dc2626', fontWeight: 600 }}>
            R1 {periodFiling.gstr1 ? 'Filed' : 'Pending'}
          </button>
          <button type="button" onClick={() => toggleFiled('gstr3b')}
            title={periodFiling.gstr3b ? 'Click to mark as pending' : 'Click to mark as filed'}
            style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '10px', border: 'none', cursor: 'pointer', background: periodFiling.gstr3b ? '#ecfdf5' : '#fef2f2', color: periodFiling.gstr3b ? '#059669' : '#dc2626', fontWeight: 600 }}>
            3B {periodFiling.gstr3b ? 'Filed' : 'Pending'}
          </button>
          <HelpButton title="Return period and filed status" doc="gst-returns#period" size={16} />
        </div>
        <a href="https://gst.gov.in" target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
          <ExternalLink size={14} /> GST Portal
        </a>
      </div>

      {/* Warnings — collapsed by default, only errors show */}
      {warnings.filter(w => w.type === 'error').length > 0 && (
        <div style={{ padding: '0.5rem 0.75rem', marginBottom: '0.75rem', borderRadius: '8px', background: 'var(--danger-light, #fef2f2)', fontSize: '0.8rem', color: '#dc2626' }}>
          <AlertTriangle size={13} style={{ verticalAlign: '-2px', marginRight: '0.35rem' }} />
          {warnings.filter(w => w.type === 'error').slice(0, 3).map(w => w.msg).join(' | ')}
          <HelpButton title="Warnings" doc="gst-returns#warnings" size={16} />
        </div>
      )}
      {/* v1.10.74 - warnings (missing HSN, GSTIN without a state) were worked
          out but never shown; a missing HSN drops the item from Table 12. */}
      {warnings.filter(w => w.type === 'warning').length > 0 && (() => {
        const list = warnings.filter(w => w.type === 'warning');
        return (
          <div style={{ padding: '0.5rem 0.75rem', marginBottom: '0.75rem', borderRadius: '8px', background: 'var(--warn-bg)', color: 'var(--warn-text)', fontSize: '0.8rem' }}>
            <AlertTriangle size={13} style={{ verticalAlign: '-2px', marginRight: '0.35rem' }} />
            {list.slice(0, 3).map(w => w.msg).join(' | ')}
            {list.length > 3 && ` | +${list.length - 3} more`}
            <HelpButton title="Warnings" doc="gst-returns#warnings" size={16} />
          </div>
        );
      })()}

      {/* NIL Return notice */}
      {isNilReturn && (
        <div style={{ padding: '0.5rem 0.75rem', marginBottom: '0.75rem', borderRadius: '8px', background: 'var(--warn-bg)', color: 'var(--warn-text)', fontSize: '0.8rem' }}>
          No invoices, purchase bills or expenses found — file a NIL return on the GST portal. NIL returns are mandatory.
          <HelpButton title="NIL returns" doc="gst-returns#nil-return" size={16} />
        </div>
      )}

      {/* Compact summary + tabs in one row */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'stretch', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div className="glass-panel" style={{ padding: '0.75rem 1rem', flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', gap: '0.75rem 1.5rem', flexWrap: 'wrap' }}>
          <div><p className="stat-label" style={{ margin: 0, fontSize: '0.7rem' }}>Invoices</p><strong style={{ fontSize: '1.25rem' }}>{filteredBills.length}</strong></div>
          <div style={{ width: '1px', height: '2rem', background: 'var(--border)' }} />
          <div><p className="stat-label" style={{ margin: 0, fontSize: '0.7rem' }}>Taxable</p><strong style={{ fontSize: '1rem' }}>{formatCurrency(grandTotals.taxable)}</strong></div>
          <div style={{ width: '1px', height: '2rem', background: 'var(--border)' }} />
          <div><p className="stat-label" style={{ margin: 0, fontSize: '0.7rem' }}>Tax</p><strong style={{ fontSize: '1rem' }}>{formatCurrency(totalTax)}</strong></div>
          <div style={{ width: '1px', height: '2rem', background: 'var(--border)' }} />
          <div><p className="stat-label" style={{ margin: 0, fontSize: '0.7rem' }}>Net Payable</p><strong style={{ fontSize: '1rem', color: 'var(--primary)' }}>{formatCurrency(netPayable)}</strong></div>
          <HelpButton title="Summary strip" doc="gst-returns#summary-strip" size={16} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[
          { id: 'gstr1', label: 'GSTR-1', icon: BarChart3 },
          { id: 'gstr3b', label: 'GSTR-3B', icon: FileText },
          // v1.10.83 - Settings → Features → GSTR-2B matching off hides this tab.
          ...(isModuleEnabled('gstr2b', getEnabledModules()) ? [{ id: 'gstr2b', label: 'GSTR-2B Reconciliation', icon: CheckCircle }] : []),
          { id: 'tds', label: 'TDS / TCS Report', icon: FileText },
          { id: 'guide', label: 'Filing Guide', icon: BookOpen },
        ].map(tab => (
          <button key={tab.id} className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab(tab.id)} style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}>
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
        <HelpButton title="This tab" doc={{ gstr1: 'gst-returns#gstr-1', gstr3b: 'gst-returns#gstr-3b', gstr2b: 'gst-returns#gstr-2b', tds: 'gst-returns#tds-tcs', guide: 'gst-returns#filing-guide' }[activeTab]} size={16} style={{ alignSelf: 'center' }} />
      </div>

      {/* ===================== GSTR-1 TAB ===================== */}
      {activeTab === 'gstr1' && (
        <>
          {/* Actions bar */}
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={exportGSTR1JSON} style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}><Upload size={13} /> JSON Export</button>
            <button className="btn btn-secondary" onClick={exportB2B} style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}><Download size={13} /> B2B</button>
            <button className="btn btn-secondary" onClick={exportB2C} style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}><Download size={13} /> B2C</button>
            <button className="btn btn-secondary" onClick={exportHSN} style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}><Download size={13} /> HSN</button>
            <button className="btn btn-secondary" onClick={exportCDNR} style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}><Download size={13} /> CDNR</button>
            <button className="btn btn-secondary" onClick={exportDocSummary} style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}><Download size={13} /> Docs</button>
            {exportRows.length > 0 && <button className="btn btn-secondary" onClick={exportExports} style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}><Download size={13} /> Exports</button>}
            <HelpButton title="GSTR-1 downloads" doc="gst-returns#gstr-1-files" size={16} />
            {!periodFiling.gstr1 && (
              <button className="btn btn-secondary" onClick={() => markFiled('gstr1')} style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem', marginLeft: 'auto', color: '#059669', borderColor: '#bbf7d0' }}>
                <CheckCircle size={13} /> Mark Filed
              </button>
            )}
          </div>

          {/* B2B — Table 4A */}
          <div className="glass-panel mb-4">
            <div className="table-header">
              <h3>B2B Sales — Table 4A<HelpButton title="B2B Sales" doc="gst-returns#b2b" size={16} /></h3>
              <span className="text-muted" style={{ fontSize: '0.82rem' }}>{b2bRows.length} invoice{b2bRows.length !== 1 ? 's' : ''}</span>
            </div>
            {b2bRows.length === 0 ? (
              <p style={{ padding: '1rem 1.25rem', margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>No B2B invoices for this period.</p>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr>
                    <th>GSTIN</th><th>Client</th><th>Invoice No</th><th>Date</th><th>POS</th><th>Type</th>
                    <th style={{ textAlign: 'right' }}>Taxable</th><th style={{ textAlign: 'right' }}>CGST</th>
                    <th style={{ textAlign: 'right' }}>SGST</th><th style={{ textAlign: 'right' }}>IGST</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr></thead>
                  <tbody>
                    {/* v1.10.6 — audit L13: was key={i}; use invoiceNo which is
                        stable across sorts. */}
                    {b2bRows.map((r, i) => (
                      <tr key={r.invoiceNo || `b2b-${i}`}>
                        <td><span className="invoice-badge">{r.gstin}</span></td>
                        <td className="font-medium">{r.clientName}</td>
                        <td>{r.invoiceNo}</td>
                        <td className="text-muted">{r.date ? new Date(r.date).toLocaleDateString('en-IN') : ''}</td>
                        <td className="text-muted">{r.pos}</td>
                        <td><span className="type-badge">{r.supplyType}</span></td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(r.taxable)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(r.cgst)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(r.sgst)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(r.igst)}</td>
                        <td style={{ textAlign: 'right' }} className="font-bold">{formatCurrency(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--border)' }}>
                    <td colSpan={6}>B2B Total</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(b2bTotals.taxable)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(b2bTotals.cgst)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(b2bTotals.sgst)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(b2bTotals.igst)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(b2bTotals.total)}</td>
                  </tr></tfoot>
                </table>
              </div>
            )}
          </div>

          {/* v1.10.83 - Exports, Table 6A, in rupees. */}
          {exportRows.length > 0 && (
            <div className="glass-panel mb-4">
              <div className="table-header">
                <h3>Exports — Table 6A<HelpButton title="Exports in GSTR-1" doc="gst-returns#exports" size={16} /></h3>
                <span className="text-muted" style={{ fontSize: '0.82rem' }}>{exportRows.length} invoice{exportRows.length !== 1 ? 's' : ''} · in ₹ at each invoice&apos;s exchange rate</span>
              </div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr>
                    <th>Type</th><th>Invoice No</th><th>Date</th><th>Client</th><th>Billed in</th><th>Rate %</th>
                    <th style={{ textAlign: 'right' }}>Taxable (₹)</th><th style={{ textAlign: 'right' }}>IGST (₹)</th><th style={{ textAlign: 'right' }}>Invoice value (₹)</th>
                  </tr></thead>
                  <tbody>
                    {exportRows.map(r => (
                      <tr key={r.id || r.invoiceNo}>
                        <td><span className="type-badge" title={r.type === 'WOPAY' ? 'Without payment of IGST (under LUT)' : 'With payment of IGST'}>{r.type}</span></td>
                        <td>{r.invoiceNo}</td>
                        <td className="text-muted">{r.date ? new Date(r.date).toLocaleDateString('en-IN') : ''}</td>
                        <td className="font-medium">{r.client}{r.country ? <span className="text-muted"> · {r.country}</span> : null}</td>
                        <td className="text-muted">{r.currency === 'INR' ? 'INR' : r.missing ? <span style={{ color: 'var(--danger)' }}>{r.currency}, no rate</span> : `${r.currency} @ ${r.fxRate}`}</td>
                        <td className="text-muted">{r.rates}</td>
                        <td style={{ textAlign: 'right' }}>{r.missing ? '—' : formatCurrency(r.taxable)}</td>
                        <td style={{ textAlign: 'right' }}>{r.missing ? '—' : formatCurrency(r.igst)}</td>
                        <td style={{ textAlign: 'right' }} className="font-bold">{r.missing ? '—' : formatCurrency(r.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ padding: '0.6rem 1.25rem', margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                These are in Table 6A of the JSON file. For services nothing more is needed; for goods, add the shipping bill number, date and port code on the portal after uploading.
              </p>
            </div>
          )}

          {/* Credit/Debit Notes — Table 9B */}
          {creditNotes.length > 0 && (
            <div className="glass-panel mb-4">
              <div className="table-header">
                <h3>Credit/Debit Notes — Table 9B<HelpButton title="Credit/Debit Notes" doc="gst-returns#credit-notes" size={16} /></h3>
                <span className="text-muted" style={{ fontSize: '0.85rem' }}>{creditNotes.length} note{creditNotes.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr><th>GSTIN</th><th>Client</th><th>Note No</th><th>Date</th><th style={{ textAlign: 'right' }}>Taxable</th><th style={{ textAlign: 'right' }}>Tax</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                  <tbody>
                    {/* v1.10.6 — audit L13: was key={i}; use bill.id which is stable. */}
                    {creditNotes.map((bill, i) => {
                      const { client, totals } = bill.data;
                      return (
                        <tr key={bill.id || `cn-${i}`}>
                          <td><span className="invoice-badge">{client?.gstin || 'Unregistered'}</span></td>
                          <td className="font-medium">{client?.name || bill.clientName}</td>
                          <td>{bill.invoiceNumber}</td>
                          <td className="text-muted">{bill.invoiceDate ? new Date(bill.invoiceDate).toLocaleDateString('en-IN') : ''}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(getTaxableAmount(totals))}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency((totals?.cgst || 0) + (totals?.sgst || 0) + (totals?.igst || 0))}</td>
                          <td style={{ textAlign: 'right' }} className="font-bold">{formatCurrency(totals?.total || 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* B2C — Table 7 (only show if data exists) */}
          <div className="glass-panel mb-4">
            <div className="table-header">
              <h3>B2C Sales — Table 7<HelpButton title="B2C Sales" doc="gst-returns#b2c" size={16} /></h3>
              <span className="text-muted" style={{ fontSize: '0.82rem' }}>
                {b2cBills.length} invoice{b2cBills.length !== 1 ? 's' : ''}
                {b2cLarge.length > 0 && <> ({b2cLarge.length} B2C Large)</>}
              </span>
            </div>
            {b2cRates.length === 0 ? (
              <p style={{ padding: '1rem 1.25rem', margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>No B2C invoices for this period.</p>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr><th>Type</th><th>Place of supply</th><th>Rate %</th><th style={{ textAlign: 'right' }}>Taxable</th><th style={{ textAlign: 'right' }}>CGST</th><th style={{ textAlign: 'right' }}>SGST</th><th style={{ textAlign: 'right' }}>IGST</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                  <tbody>
                    {b2cTable7.map(d => (
                      <tr key={`${d.inter}-${d.pos}-${d.rate}`}>
                        <td>{d.inter ? 'Inter-state' : 'Intra-state'}</td>
                        <td>{placeOfSupplyLabel(d.pos) || '-'}</td>
                        <td><span className="type-badge">{d.rate}%</span></td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(d.taxable)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(d.cgst)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(d.sgst)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(d.igst)}</td>
                        <td style={{ textAlign: 'right' }} className="font-bold">{formatCurrency(d.taxable + d.cgst + d.sgst + d.igst + d.cess)}</td>
                      </tr>
                    ))}
                    {b2cLarge.map(bill => {
                      const t = bill.data?.totals || {};
                      const taxable = getTaxableAmount(t);
                      return (
                        <tr key={bill.id} title="B2C Large (Table 5): an inter-state sale to an unregistered buyer above the limit is reported invoice by invoice">
                          <td>Inter-state, large</td>
                          <td>{placeOfSupplyLabel(b2cPos(bill)) || '-'}</td>
                          <td className="text-muted" style={{ fontSize: '0.78rem' }}>{bill.invoiceNumber}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(taxable)}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(0)}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(0)}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(t.igst || 0)}</td>
                          <td style={{ textAlign: 'right' }} className="font-bold">{formatCurrency(taxable + (t.igst || 0) + (t.cess || 0))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot><tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--border)' }}>
                    <td colSpan={3}>B2C Total</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(b2cTotals.taxable)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(b2cTotals.cgst)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(b2cTotals.sgst)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(b2cTotals.igst)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(b2cTotals.total)}</td>
                  </tr></tfoot>
                </table>
              </div>
            )}
          </div>

          {/* HSN Summary — Table 12 */}
          <div className="glass-panel mb-4">
            <div className="table-header">
              <h3>HSN Summary — Table 12<HelpButton title="HSN Summary" doc="gst-returns#hsn-summary" size={16} /></h3>
              <span className="text-muted" style={{ fontSize: '0.82rem' }}>{hsnRows.length} code{hsnRows.length !== 1 ? 's' : ''}</span>
            </div>
            {hsnSum.missingHsn > 0 && (
              <p style={{ padding: '0.5rem 0.75rem', margin: '0 1.25rem 0.5rem', borderRadius: '8px', fontSize: '0.8rem', background: 'var(--warn-bg)', color: 'var(--warn-text)' }}>
                <AlertTriangle size={13} style={{ verticalAlign: '-2px' }} /> {hsnSum.missingHsn} invoice line{hsnSum.missingHsn !== 1 ? 's have' : ' has'} no HSN code and {hsnSum.missingHsn !== 1 ? 'are' : 'is'} left out of Table 12 - the portal needs an HSN for every line. Add the HSN to the product (Products page) and to the invoice.
              </p>
            )}
            {hsnRows.length === 0 ? (
              <p style={{ padding: '1rem 1.25rem', margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>No items found.</p>
            ) : (hsnSplit ? [['B2B (buyers with a GSTIN)', hsnB2B], ['B2C', hsnB2C]] : [['', mergeHsnRows(hsnRows)]]).map(([title, rows]) => (
              <div key={title || 'all'}>
                {title && <h4 style={{ margin: 0, padding: '0.75rem 1.25rem 0.4rem', fontSize: '0.9rem' }}>{title} <span className="text-muted" style={{ fontWeight: 'normal', fontSize: '0.8rem' }}>- {rows.length} row{rows.length !== 1 ? 's' : ''}</span></h4>}
                {rows.length === 0 ? (
                  <p style={{ padding: '0 1.25rem 0.75rem', margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>None in this period.</p>
                ) : <HsnTable rows={rows} />}
              </div>
            ))}
          </div>

          {/* Document Summary — Table 13 */}
          <div className="glass-panel mb-4">
            <div className="table-header"><h3>Document Summary — Table 13<HelpButton title="Document Summary" doc="gst-returns#doc-summary" size={16} /></h3></div>
            {Object.keys(docSummary).length === 0 ? (
              <p style={{ padding: '1rem 1.25rem', margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>No documents issued.</p>
            ) : (
              <div className="table-scroll">
                <table className="data-table" style={{ minWidth: '400px' }}>
                  <thead><tr><th>Document Type</th><th>From</th><th>To</th><th style={{ textAlign: 'right' }}>Total Issued</th><th style={{ textAlign: 'right' }}>Cancelled</th></tr></thead>
                  <tbody>
                    {Object.entries(docSummary).map(([prefix, d]) => (
                      <tr key={prefix}>
                        <td className="font-medium">{d.type}</td>
                        <td className="text-muted">{d.from}</td>
                        <td className="text-muted">{d.to}</td>
                        <td style={{ textAlign: 'right' }} className="font-bold">{d.total}</td>
                        <td style={{ textAlign: 'right' }}>{d.cancelled}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Grand Summary */}
          <div className="glass-panel">
            <div className="table-header"><h3>GSTR-1 Summary Totals<HelpButton title="GSTR-1 Summary Totals" doc="gst-returns#gstr-1-summary" size={16} /></h3></div>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Category</th><th style={{ textAlign: 'right' }}>Taxable</th><th style={{ textAlign: 'right' }}>CGST</th><th style={{ textAlign: 'right' }}>SGST</th><th style={{ textAlign: 'right' }}>IGST</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                <tbody>
                  <tr><td className="font-medium">B2B Sales</td><td style={{ textAlign: 'right' }}>{formatCurrency(b2bTotals.taxable)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(b2bTotals.cgst)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(b2bTotals.sgst)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(b2bTotals.igst)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(b2bTotals.total)}</td></tr>
                  <tr><td className="font-medium">B2C Sales</td><td style={{ textAlign: 'right' }}>{formatCurrency(b2cTotals.taxable)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(b2cTotals.cgst)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(b2cTotals.sgst)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(b2cTotals.igst)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(b2cTotals.total)}</td></tr>
                </tbody>
                <tfoot><tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--border)' }}>
                  <td>Grand Total</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(grandTotals.taxable)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(grandTotals.cgst)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(grandTotals.sgst)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(grandTotals.igst)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(grandTotals.total)}</td>
                </tr></tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ===================== GSTR-3B TAB ===================== */}
      {activeTab === 'gstr3b' && (
        <>
          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem', alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={exportGSTR3B} style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}><Download size={13} /> 3B CSV</button>
            <button className="btn btn-primary" onClick={exportGSTR3BJSON} style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}><Upload size={13} /> 3B JSON</button>
            <HelpButton title="GSTR-3B downloads" doc="gst-returns#gstr-3b-files" size={16} />
            {!periodFiling.gstr3b && (
              <button className="btn btn-secondary" onClick={() => markFiled('gstr3b')} style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem', marginLeft: 'auto', color: '#059669', borderColor: '#bbf7d0' }}>
                <CheckCircle size={13} /> Mark Filed
              </button>
            )}
          </div>

          {/* Table 3.1 — Output Tax */}
          <div className="glass-panel mb-4">
            <div className="table-header"><h3>Table 3.1 — Outward Supplies & Tax<HelpButton title="Table 3.1" doc="gst-returns#table-3-1" size={16} /></h3></div>
            <div className="table-scroll">
              <table className="data-table" style={{ minWidth: '600px' }}>
                <thead><tr><th>Nature of Supplies</th><th style={{ textAlign: 'right' }}>Taxable Value</th><th style={{ textAlign: 'right' }}>IGST</th><th style={{ textAlign: 'right' }}>CGST</th><th style={{ textAlign: 'right' }}>SGST</th></tr></thead>
                <tbody>
                  <tr><td className="font-medium">(a) Outward taxable supplies (other than zero-rated, nil-rated and exempted)</td><td style={{ textAlign: 'right' }}>{formatCurrency(outward31a.taxable)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(outward31a.igst)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(outward31a.cgst)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(outward31a.sgst)}</td></tr>
                  <tr><td className="font-medium">(b) Zero-rated supplies (exports, SEZ)</td><td style={{ textAlign: 'right' }}>{formatCurrency(exportTotals.taxable)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(exportTotals.igst)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(0)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(0)}</td></tr>
                  <tr><td className="font-medium">(c) Other outward supplies (nil rated, exempted)</td><td style={{ textAlign: 'right' }}>{formatCurrency(0)}</td><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>N/A</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 3.2 — Inter-state Supplies */}
          {(() => {
            const interStateB2C = {};
            b2cBills.forEach(bill => {
              const { client, items, details } = bill.data;
              const isInter = billIsInterstate(bill);
              if (!isInter) return;
              const pos = getStateCode(details?.placeOfSupply || client?.state || '');
              const posName = client?.state || pos;
              (items || []).forEach(item => {
                if (!interStateB2C[posName]) interStateB2C[posName] = { pos: posName, taxable: 0, igst: 0 };
                // v1.10.74 - pass the tax-inclusive flag like every other call,
                // or a tax-inclusive bill's taxable value and IGST come out too high.
                const split = billSplit(bill, item, true, !!bill.data?.taxInclusive);
                interStateB2C[posName].taxable += split.taxable;
                interStateB2C[posName].igst += split.igst;
              });
            });
            const rows = Object.values(interStateB2C);
            if (rows.length === 0) return null;
            return (
              <div className="glass-panel mb-4">
                <div className="table-header"><h3>Table 3.2 — Inter-state Supplies to Unregistered Persons<HelpButton title="Table 3.2" doc="gst-returns#table-3-2" size={16} /></h3></div>
                <div className="table-scroll">
                  <table className="data-table" style={{ minWidth: '400px' }}>
                    <thead><tr><th>Place of Supply</th><th style={{ textAlign: 'right' }}>Taxable Value</th><th style={{ textAlign: 'right' }}>IGST</th></tr></thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i}><td className="font-medium">{r.pos}</td><td style={{ textAlign: 'right' }}>{formatCurrency(r.taxable)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(r.igst)}</td></tr>
                      ))}
                    </tbody>
                    <tfoot><tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--border)' }}>
                      <td>Total</td><td style={{ textAlign: 'right' }}>{formatCurrency(rows.reduce((s, r) => s + r.taxable, 0))}</td><td style={{ textAlign: 'right' }}>{formatCurrency(rows.reduce((s, r) => s + r.igst, 0))}</td>
                    </tr></tfoot>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* Table 4 — ITC */}
          <div className="glass-panel mb-4">
            <div className="table-header"><h3>Table 4 — Eligible ITC (from Expenses & Purchases)<HelpButton title="Table 4 — Eligible ITC" doc="gst-returns#table-4-itc" size={16} /></h3></div>
            <div className="table-scroll">
              <table className="data-table" style={{ minWidth: '500px' }}>
                <thead><tr><th>Details</th><th style={{ textAlign: 'right' }}>IGST</th><th style={{ textAlign: 'right' }}>CGST</th><th style={{ textAlign: 'right' }}>SGST</th></tr></thead>
                <tbody>
                  <tr><td className="font-medium">(A) ITC Available — All other ITC</td><td style={{ textAlign: 'right' }}>{formatCurrency(itcFromExpenses.igst)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(itcFromExpenses.cgst)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(itcFromExpenses.sgst)}</td></tr>
                  <tr className="font-bold"><td>Net ITC Available</td><td style={{ textAlign: 'right' }}>{formatCurrency(itcFromExpenses.igst)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(itcFromExpenses.cgst)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(itcFromExpenses.sgst)}</td></tr>
                </tbody>
              </table>
            </div>
            <p className="field-hint" style={{ padding: '0.75rem 1.25rem' }}>
              ITC calculated from Expense Tracker and Purchase Bills entries with GST. Verify against GSTR-2B on the GST portal for actual eligible ITC.
            </p>
          </div>

          {/* Table 6 — Tax Payment */}
          <div className="glass-panel mb-4">
            <div className="table-header"><h3>Table 6 — Tax Payment Summary<HelpButton title="Table 6 — Tax Payment" doc="gst-returns#table-6-payment" size={16} /></h3></div>
            <div className="table-scroll">
              <table className="data-table" style={{ minWidth: '600px' }}>
                <thead><tr><th>Description</th><th style={{ textAlign: 'right' }}>IGST</th><th style={{ textAlign: 'right' }}>CGST</th><th style={{ textAlign: 'right' }}>SGST</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                <tbody>
                  <tr><td className="font-medium">Output Tax Liability</td><td style={{ textAlign: 'right' }}>{formatCurrency(outputTax.igst)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(outputTax.cgst)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(outputTax.sgst)}</td><td style={{ textAlign: 'right' }} className="font-bold">{formatCurrency(outputTax.igst + outputTax.cgst + outputTax.sgst)}</td></tr>
                  <tr><td className="font-medium" style={{ color: '#059669' }}>Less: ITC utilised</td><td style={{ textAlign: 'right', color: '#059669' }}>-{formatCurrency(setOff.used.igst)}</td><td style={{ textAlign: 'right', color: '#059669' }}>-{formatCurrency(setOff.used.cgst)}</td><td style={{ textAlign: 'right', color: '#059669' }}>-{formatCurrency(setOff.used.sgst)}</td><td style={{ textAlign: 'right', color: '#059669' }}>-{formatCurrency(setOff.used.igst + setOff.used.cgst + setOff.used.sgst)}</td></tr>
                </tbody>
                <tfoot><tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--border)' }}>
                  <td>Net Tax Payable</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(netTax.igst)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(netTax.cgst)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(netTax.sgst)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--primary)', fontSize: '1.1rem' }}>{formatCurrency(netTax.igst + netTax.cgst + netTax.sgst)}</td>
                </tr>
                {hasCarry && (
                  <tr style={{ color: 'var(--text-muted)' }}>
                    <td>ITC carried forward</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(itcCarry.igst)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(itcCarry.cgst)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(itcCarry.sgst)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(itcCarry.igst + itcCarry.cgst + itcCarry.sgst)}</td>
                  </tr>
                )}</tfoot>
              </table>
            </div>
            <p className="field-hint" style={{ padding: '0.75rem 1.25rem' }}>
              Credit is set off in the order the law requires: IGST credit first (against IGST, then CGST, then SGST); CGST credit against CGST, then IGST; SGST credit against SGST, then IGST. CGST credit never pays SGST, and SGST credit never pays CGST.
            </p>
          </div>

          {/* Net Payable */}
          <div className="glass-panel" style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.25rem' }}>Net GST Payable<HelpButton title="Net GST Payable" doc="gst-returns#net-payable" size={16} /></p>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', margin: 0 }}>
              {formatCurrency(netPayable)}
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
              {netPayable === 0 ? 'ITC covers your liability' : 'Pay via Electronic Cash Ledger'}
            </p>
          </div>
        </>
      )}

      {/* ===================== GSTR-2B RECONCILIATION TAB ===================== */}
      {activeTab === 'gstr2b' && (() => {
        const reconRows = buildReconciliation(gstr2bData, purchases, filteredPurchases);
        const stats = reconRows.reduce((acc, r) => {
          acc.total += 1;
          acc[r.status] = (acc[r.status] || 0) + 1;
          return acc;
        }, { total: 0, matched: 0, amount_mismatch: 0, book_only: 0, twob_only: 0 });
        const visibleRows = gstr2bFilter === 'all' ? reconRows : reconRows.filter(r => r.status === gstr2bFilter);

        const exportReconCSV = () => {
          if (reconRows.length === 0) { toast('Nothing to export', 'warning'); return; }
          downloadCSV('GSTR2B_Reconciliation.csv',
            ['Status', 'Supplier GSTIN', 'Supplier Name', 'Invoice No.', 'Invoice Date', '2B Value', 'Books Value', 'Diff', '2B Taxable', 'Books Taxable', '2B IGST', '2B CGST', '2B SGST', 'ITC Available'],
            reconRows.map(r => [
              r.status, r.ctin, r.supplier, r.invoiceNumber, r.date,
              r.twoBVal.toFixed(2), r.bookVal.toFixed(2), (r.twoBVal - r.bookVal).toFixed(2),
              r.twoBTaxable.toFixed(2), r.bookTaxable.toFixed(2),
              r.twoBIgst.toFixed(2), r.twoBCgst.toFixed(2), r.twoBSgst.toFixed(2),
              r.itcAvailable ? 'Y' : 'N',
            ])
          );
          toast('Reconciliation CSV downloaded', 'success');
        };

        // Use the global .status-pill utility — color flows via the --pill-color CSS var,
        // background is auto-derived with a 14% mix so dark/light look identical.
        const STATUS_BADGES = {
          matched:         { label: '✓ Matched',         color: 'var(--success)' },
          amount_mismatch: { label: '⚠ Amount mismatch', color: '#d97706' },
          book_only:       { label: '⚠ Books only',      color: 'var(--danger)' },
          twob_only:       { label: '⚠ 2B only',         color: 'var(--purple)' },
        };

        return (
          <>
            {/* Help banner */}
            <div className="glass-panel" style={{ padding: '0.85rem 1rem', marginBottom: '0.75rem', borderLeft: '3px solid var(--primary)' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                <strong>How to use:</strong> Download your GSTR-2B JSON from the GST portal
                (<a href="https://services.gst.gov.in/services/auth/dashboard" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>services.gst.gov.in</a>
                {' '}→ Returns → GSTR-2B → Download JSON), then click <strong>Import 2B JSON</strong> below.
                We match each 2B entry against your <em>Purchase Bills</em> by supplier GSTIN + invoice number, and flag mismatches so you can claim ITC accurately.
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input ref={gstr2bInputRef} type="file" accept=".json,application/json" onChange={handleImport2B} style={{ display: 'none' }} />
              <button className="btn btn-primary" onClick={() => gstr2bInputRef.current?.click()} style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}>
                <Upload size={13} /> Import 2B JSON
              </button>
              {gstr2bData && (
                <>
                  <button className="btn btn-secondary" onClick={exportReconCSV} style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}>
                    <Download size={13} /> Export reconciliation CSV
                  </button>
                  <button className="btn btn-secondary" onClick={() => { setGstr2bData(null); setGstr2bFilter('all'); }} style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}>
                    Clear
                  </button>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    Imported for {gstr2bData.gstin || '?'} · period {gstr2bData.rtnprd || gstr2bData.fp || '?'}
                    <HelpButton title="Reading the GSTR-2B results" doc="gst-returns#gstr-2b-results" size={16} />
                  </span>
                </>
              )}
            </div>

            {!gstr2bData && (
              <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <CheckCircle size={36} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                <p style={{ margin: 0, fontSize: '0.9rem' }}>Import your GSTR-2B JSON to reconcile against your purchase records.</p>
                {purchases.length === 0 && (
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: '#d97706' }}>
                    ⚠ You have no purchase bills recorded yet. Add some in the Purchases view first, otherwise everything will show as "2B only".
                  </p>
                )}
              </div>
            )}

            {gstr2bData && (
              <>
                {/* Summary stats */}
                <div className="glass-panel" style={{ padding: '0.85rem 1rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                    {[
                      { k: 'all', label: 'Total entries', count: stats.total, color: 'var(--text-primary)' },
                      { k: 'matched', label: '✓ Matched', count: stats.matched, color: '#059669' },
                      { k: 'amount_mismatch', label: '⚠ Amount mismatch', count: stats.amount_mismatch, color: '#d97706' },
                      { k: 'book_only', label: '⚠ Books only', count: stats.book_only, color: '#dc2626' },
                      { k: 'twob_only', label: '⚠ 2B only', count: stats.twob_only, color: '#7c3aed' },
                    ].map(s => (
                      <button key={s.k}
                        onClick={() => setGstr2bFilter(s.k)}
                        className={gstr2bFilter === s.k ? 'type-chip type-chip-active' : 'type-chip'}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.1rem', padding: '0.5rem 0.7rem', textAlign: 'left' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.label}</span>
                        <strong style={{ fontSize: '1.05rem', color: s.color }}>{s.count}</strong>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Table */}
                <div className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
                  <table className="data-table" style={{ width: '100%', minWidth: '900px' }}>
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Supplier</th>
                        <th>Invoice No.</th>
                        <th>Date</th>
                        <th style={{ textAlign: 'right' }}>2B Value</th>
                        <th style={{ textAlign: 'right' }}>Books Value</th>
                        <th style={{ textAlign: 'right' }}>Diff</th>
                        <th>ITC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.length === 0 ? (
                        <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No entries match this filter.</td></tr>
                      ) : visibleRows.map((r, i) => {
                        const badge = STATUS_BADGES[r.status];
                        const diff = r.twoBVal - r.bookVal;
                        return (
                          // v1.10.6 — audit L13: use invoice + GSTIN combo (stable across filters).
                          <tr key={`${r.gstin || 'x'}-${r.invoice || i}`}>
                            <td><span className="status-pill" style={{ '--pill-color': badge.color }}>{badge.label}</span></td>
                            <td>
                              <div style={{ fontWeight: 500 }}>{r.supplier || '—'}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{r.ctin}</div>
                            </td>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{r.invoiceNumber}</td>
                            <td style={{ fontSize: '0.78rem' }}>{r.date || '—'}</td>
                            <td style={{ textAlign: 'right' }}>{r.twoBVal > 0 ? formatCurrency(r.twoBVal) : '—'}</td>
                            <td style={{ textAlign: 'right' }}>{r.bookVal > 0 ? formatCurrency(r.bookVal) : '—'}</td>
                            <td style={{ textAlign: 'right', color: Math.abs(diff) > 1 ? '#dc2626' : 'var(--text-muted)', fontWeight: Math.abs(diff) > 1 ? 600 : 400 }}>
                              {diff !== 0 ? (diff > 0 ? '+' : '') + formatCurrency(diff) : '—'}
                            </td>
                            <td style={{ fontSize: '0.78rem', color: r.itcAvailable ? '#059669' : '#94a3b8' }}>{r.itcAvailable ? '✓' : '✗'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        );
      })()}

      {/* ===================== TDS / TCS REPORT TAB ===================== */}
      {activeTab === 'tds' && (() => {
        // Aggregate TDS (deducted by buyers) and TCS (collected by us) across all bills
        // in the filtered period, grouped by client + section + quarter. The data feeds
        // Form 26Q (TDS quarterly return) and Form 27EQ (TCS quarterly return) inputs.
        const tdsRows = []; // each row: { client, gstin, section, quarter, taxable, tds }
        const tcsRows = [];
        filteredBills.forEach(bill => {
          const t = bill.data?.totals || {};
          const opt = bill.data?.invoiceOptions || {};
          const client = bill.data?.client || {};
          const date = new Date(bill.invoiceDate);
          if (isNaN(date.getTime())) return;
          const m = date.getMonth(); // 0=Jan
          const fyQuarter = m >= 3 && m <= 5 ? 'Q1' : m >= 6 && m <= 8 ? 'Q2' : m >= 9 && m <= 11 ? 'Q3' : 'Q4';
          const taxable = t.taxableAmount ?? ((t.subtotal || 0) - (t.totalDiscount || 0));
          if (t.tdsAmount > 0) {
            tdsRows.push({
              clientName: client.name || bill.clientName || '—',
              clientGstin: client.gstin || '',
              clientPan: client.pan || '',
              section: opt.tdsSection || '194Q',
              rate: opt.tdsRate || 0,
              quarter: fyQuarter,
              invoiceNumber: bill.invoiceNumber,
              date: bill.invoiceDate,
              taxable,
              tds: t.tdsAmount,
            });
          }
          if (t.tcsAmount > 0) {
            tcsRows.push({
              clientName: client.name || bill.clientName || '—',
              clientGstin: client.gstin || '',
              clientPan: client.pan || '',
              section: opt.tcsSection || '206C(1H)',
              rate: opt.tcsRate || 0,
              quarter: fyQuarter,
              invoiceNumber: bill.invoiceNumber,
              date: bill.invoiceDate,
              taxable,
              tcs: t.tcsAmount,
            });
          }
        });

        const tdsTotal = tdsRows.reduce((acc, r) => ({ taxable: acc.taxable + r.taxable, tds: acc.tds + r.tds }), { taxable: 0, tds: 0 });
        const tcsTotal = tcsRows.reduce((acc, r) => ({ taxable: acc.taxable + r.taxable, tcs: acc.tcs + r.tcs }), { taxable: 0, tcs: 0 });

        // Section-wise summary for TDS: groups by section + quarter
        const tdsBySection = {};
        tdsRows.forEach(r => {
          const k = `${r.section}_${r.quarter}`;
          if (!tdsBySection[k]) tdsBySection[k] = { section: r.section, quarter: r.quarter, count: 0, taxable: 0, tds: 0 };
          tdsBySection[k].count += 1; tdsBySection[k].taxable += r.taxable; tdsBySection[k].tds += r.tds;
        });
        const tcsBySection = {};
        tcsRows.forEach(r => {
          const k = `${r.section}_${r.quarter}`;
          if (!tcsBySection[k]) tcsBySection[k] = { section: r.section, quarter: r.quarter, count: 0, taxable: 0, tcs: 0 };
          tcsBySection[k].count += 1; tcsBySection[k].taxable += r.taxable; tcsBySection[k].tcs += r.tcs;
        });

        const exportTDSCSV = () => {
          if (tdsRows.length === 0) { toast('No TDS entries in this period', 'warning'); return; }
          downloadCSV('TDS_Receivable_Report.csv',
            ['Quarter', 'Section', 'Rate %', 'Invoice No.', 'Date', 'Client', 'Client GSTIN', 'Client PAN', 'Taxable Value', 'TDS Amount'],
            tdsRows.map(r => [r.quarter, r.section, r.rate, r.invoiceNumber, r.date, r.clientName, r.clientGstin, r.clientPan, r.taxable.toFixed(2), r.tds.toFixed(2)])
          );
          toast('TDS report exported', 'success');
        };
        const exportTCSCSV = () => {
          if (tcsRows.length === 0) { toast('No TCS entries in this period', 'warning'); return; }
          downloadCSV('TCS_Collected_Report.csv',
            ['Quarter', 'Section', 'Rate %', 'Invoice No.', 'Date', 'Client', 'Client GSTIN', 'Client PAN', 'Taxable Value', 'TCS Amount'],
            tcsRows.map(r => [r.quarter, r.section, r.rate, r.invoiceNumber, r.date, r.clientName, r.clientGstin, r.clientPan, r.taxable.toFixed(2), r.tcs.toFixed(2)])
          );
          toast('TCS report exported', 'success');
        };

        return (
          <>
            <div className="glass-panel" style={{ padding: '0.85rem 1rem', marginBottom: '0.75rem', borderLeft: '3px solid var(--primary)' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                <strong>What this is:</strong> Aggregates TDS (tax deducted by your clients on payments to you — Section 194C/194J/194Q etc.)
                and TCS (tax collected by you from clients — CGST section 52, 206C(1), or 206C(1H) on invoices before April 2025) across the selected period.
                Use the CSV exports as input for <strong>Form 26Q</strong> (TDS) and <strong>Form 27EQ</strong> (TCS) quarterly returns,
                or hand the file to your CA. Filed at <a href="https://www.tin-nsdl.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>tin-nsdl.com</a>.
              </p>
            </div>

            {/* TDS section */}
            <div className="glass-panel" style={{ padding: '0.85rem 1rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>TDS Receivable (deducted by clients)<HelpButton title="TDS Receivable" doc="gst-returns#tds-receivable" size={16} /></h3>
                  <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Total TDS your clients should have deducted. You can claim this as credit against your own income tax.
                  </p>
                </div>
                <button className="btn btn-secondary" onClick={exportTDSCSV} style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }} disabled={tdsRows.length === 0}>
                  <Download size={13} /> Export TDS CSV
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem', marginBottom: '0.6rem' }}>
                <div className="glass-panel" style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-secondary)' }}>
                  <p className="stat-label" style={{ margin: 0, fontSize: '0.7rem' }}>Invoices with TDS</p>
                  <strong style={{ fontSize: '1rem' }}>{tdsRows.length}</strong>
                </div>
                <div className="glass-panel" style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-secondary)' }}>
                  <p className="stat-label" style={{ margin: 0, fontSize: '0.7rem' }}>Taxable value</p>
                  <strong style={{ fontSize: '1rem' }}>{formatCurrency(tdsTotal.taxable)}</strong>
                </div>
                <div className="glass-panel" style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-secondary)' }}>
                  <p className="stat-label" style={{ margin: 0, fontSize: '0.7rem' }}>Total TDS receivable</p>
                  <strong style={{ fontSize: '1rem', color: '#0f766e' }}>{formatCurrency(tdsTotal.tds)}</strong>
                </div>
              </div>
              {Object.values(tdsBySection).length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ width: '100%', fontSize: '0.78rem' }}>
                    <thead>
                      <tr><th>Quarter</th><th>Section</th><th>Invoices</th><th style={{ textAlign: 'right' }}>Taxable</th><th style={{ textAlign: 'right' }}>TDS</th></tr>
                    </thead>
                    <tbody>
                      {Object.values(tdsBySection).sort((a, b) => a.quarter.localeCompare(b.quarter) || a.section.localeCompare(b.section)).map((r, i) => (
                        <tr key={`tds-${i}`}>
                          <td>{r.quarter}</td>
                          <td style={{ fontFamily: 'monospace' }}>{r.section}</td>
                          <td>{r.count}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(r.taxable)}</td>
                          <td style={{ textAlign: 'right', color: '#0f766e', fontWeight: 600 }}>{formatCurrency(r.tds)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, textAlign: 'center', padding: '0.75rem' }}>
                  No invoices with TDS in this period. Enable TDS on an invoice via <em>Customize → TDS</em>.
                </p>
              )}
            </div>

            {/* TCS section */}
            <div className="glass-panel" style={{ padding: '0.85rem 1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>TCS Collected (from clients)<HelpButton title="TCS Collected" doc="gst-returns#tcs-collected" size={16} /></h3>
                  <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    TCS you collected from buyers. Must be deposited to the Income Tax Department and reported in Form 27EQ quarterly.
                  </p>
                </div>
                <button className="btn btn-secondary" onClick={exportTCSCSV} style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }} disabled={tcsRows.length === 0}>
                  <Download size={13} /> Export TCS CSV
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem', marginBottom: '0.6rem' }}>
                <div className="glass-panel" style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-secondary)' }}>
                  <p className="stat-label" style={{ margin: 0, fontSize: '0.7rem' }}>Invoices with TCS</p>
                  <strong style={{ fontSize: '1rem' }}>{tcsRows.length}</strong>
                </div>
                <div className="glass-panel" style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-secondary)' }}>
                  <p className="stat-label" style={{ margin: 0, fontSize: '0.7rem' }}>Taxable value</p>
                  <strong style={{ fontSize: '1rem' }}>{formatCurrency(tcsTotal.taxable)}</strong>
                </div>
                <div className="glass-panel" style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-secondary)' }}>
                  <p className="stat-label" style={{ margin: 0, fontSize: '0.7rem' }}>Total TCS collected</p>
                  <strong style={{ fontSize: '1rem', color: '#d97706' }}>{formatCurrency(tcsTotal.tcs)}</strong>
                </div>
              </div>
              {Object.values(tcsBySection).length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ width: '100%', fontSize: '0.78rem' }}>
                    <thead>
                      <tr><th>Quarter</th><th>Section</th><th>Invoices</th><th style={{ textAlign: 'right' }}>Taxable</th><th style={{ textAlign: 'right' }}>TCS</th></tr>
                    </thead>
                    <tbody>
                      {Object.values(tcsBySection).sort((a, b) => a.quarter.localeCompare(b.quarter) || a.section.localeCompare(b.section)).map((r, i) => (
                        <tr key={`tcs-${i}`}>
                          <td>{r.quarter}</td>
                          <td style={{ fontFamily: 'monospace' }}>{r.section}</td>
                          <td>{r.count}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(r.taxable)}</td>
                          <td style={{ textAlign: 'right', color: '#d97706', fontWeight: 600 }}>{formatCurrency(r.tcs)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, textAlign: 'center', padding: '0.75rem' }}>
                  No invoices with TCS in this period. Enable TCS on an invoice via <em>Customize → TCS</em>.
                </p>
              )}
            </div>
          </>
        );
      })()}

      {/* ===================== FILING GUIDE TAB ===================== */}
      {activeTab === 'guide' && (
        <>
          {/* Quick Start */}
          <div className="glass-panel" style={{ padding: '0.75rem 1rem', marginBottom: '0.75rem', borderLeft: '3px solid var(--primary)' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              <strong>Steps:</strong> Review GSTR-1 & 3B tabs → Export JSON → Upload to gst.gov.in → File GSTR-1 first, then GSTR-3B.
              <span style={{ color: 'var(--text-muted)' }}> | Due: R1 by 11th, 3B by 20th of next month | Late fee: ₹50/day</span>
            </p>
          </div>

          {/* Tab selector within guide */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  {[
                    { id: 'regular', label: 'Regular Filing (With Sales)' },
                    { id: 'nil', label: 'NIL Return (No Sales)' },
                    { id: 'errors', label: 'Common Errors & Fixes' },
                  ].map(tab => (
                    <button key={tab.id} className={`btn ${guideTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setGuideTab(tab.id)} style={{ fontSize: '0.82rem' }}>
                      {tab.label}
                    </button>
                  ))}
                </div>

                {guideTab === 'regular' && (
                  <>
                    <StepList steps={GSTR1_STEPS} title="GSTR-1 — Sales Return (File This First)" doc="gst-returns#guide-gstr1-steps" />

                    <div className="glass-panel p-4 mb-4" style={{ background: '#f0fdf4' }}>
                      <h4 style={{ color: '#059669', marginBottom: '0.5rem', fontSize: '0.9rem' }}>GSTR-1 Pro Tips<HelpButton title="Pro Tips" doc="gst-returns#guide-pro-tips" size={16} /></h4>
                      <ul style={{ fontSize: '0.82rem', color: '#047857', lineHeight: 1.8, paddingLeft: '1.25rem' }}>
                        <li><strong>Fastest method:</strong> Export GSTR-1 JSON from the GSTR-1 tab above → Go to GST portal → GSTR-1 → Prepare Offline → Download Offline Tool → Import JSON → Upload. Saves 90% of time.</li>
                        <li>If turnover {'<'} ₹5 Cr, opt for QRMP scheme — file quarterly instead of monthly. Apply via Services → User Services → Opt-in for QRMP.</li>
                        <li>Amendments to previous period invoices: Use Table 9A (not 4A). You can amend within the September return of the following FY.</li>
                        <li>Export invoices (zero-rated): Report in Table 6A with shipping bill details.</li>
                        <li>Advances received: Report in Table 11A (tax on advance received) — adjust when invoice is issued (Table 11B).</li>
                      </ul>
                    </div>

                    <StepList steps={GSTR3B_STEPS} title="GSTR-3B — Summary Return + Tax Payment (File After GSTR-1)" doc="gst-returns#guide-gstr3b-steps" />

                    <div className="glass-panel p-4 mb-4" style={{ background: '#eff6ff' }}>
                      <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>GSTR-3B Pro Tips<HelpButton title="Pro Tips" doc="gst-returns#guide-pro-tips" size={16} /></h4>
                      <ul style={{ fontSize: '0.82rem', color: '#1e40af', lineHeight: 1.8, paddingLeft: '1.25rem' }}>
                        <li><strong>From July 2025:</strong> Table 3 auto-populates from GSTR-1 — just VERIFY, don't re-enter values.</li>
                        <li><strong>ITC matching:</strong> Always check GSTR-2B statement BEFORE claiming ITC. Go to Returns → GSTR-2B → Download. Only claim ITC that appears in GSTR-2B.</li>
                        <li><strong>ITC utilization order (Section 49):</strong> IGST credit first (against IGST → CGST → SGST), then CGST (against CGST → IGST), then SGST (against SGST → IGST).</li>
                        <li><strong>Payment:</strong> Use Electronic Credit Ledger (ITC) first. Pay remaining via Electronic Cash Ledger. Create challan via Services → Payments → Create Challan.</li>
                        <li><strong>Interest calculation:</strong> If you file late, interest is 18% p.a. calculated on tax payable (not total liability). Interest starts from day after due date.</li>
                        <li><strong>Reverse charge:</strong> If you paid RCM (restaurant/legal/GTA services), report in 3.1(d) AND claim ITC in Table 4(A)(3).</li>
                      </ul>
                    </div>
                  </>
                )}

                {guideTab === 'nil' && (
                  <>
                    <div className="glass-panel p-4 mb-4" style={{ borderLeft: '4px solid #f59e0b', background: 'var(--warn-bg)', color: 'var(--warn-text)' }}>
                      <h4 style={{ color: '#92400e', marginBottom: '0.5rem', fontSize: '0.9rem' }}>When to File NIL Return<HelpButton title="NIL returns" doc="gst-returns#nil-return" size={16} /></h4>
                      <ul style={{ fontSize: '0.85rem', color: '#a16207', lineHeight: 1.8, paddingLeft: '1.25rem' }}>
                        <li>You had <strong>ZERO outward supplies</strong> (no sales/services) during the period</li>
                        <li>You have <strong>NO input tax credit</strong> to claim</li>
                        <li>You have <strong>NO tax liability</strong> (including reverse charge)</li>
                        <li>You have <strong>NO inward supplies</strong> liable to reverse charge</li>
                        <li>If ANY of the above has a value, you MUST file a regular return — not NIL</li>
                      </ul>
                      <p style={{ fontSize: '0.85rem', color: '#92400e', marginTop: '0.5rem', fontWeight: 600 }}>
                        MANDATORY: You must file NIL returns every month/quarter even with zero activity. Non-filing for 6 continuous months can result in suo-motu GSTIN cancellation under Section 29(2)(c).
                      </p>
                    </div>

                    <StepList steps={NIL_GSTR1_STEPS} title="NIL GSTR-1 — File First (Even with Zero Sales)" doc="gst-returns#nil-return" />
                    <StepList steps={NIL_GSTR3B_STEPS} title="NIL GSTR-3B — File After NIL GSTR-1" doc="gst-returns#nil-return" />

                    <div className="glass-panel p-4" style={{ background: '#f0fdf4' }}>
                      <h4 style={{ color: '#059669', marginBottom: '0.5rem', fontSize: '0.9rem' }}>NIL Return Quick Summary<HelpButton title="NIL returns" doc="gst-returns#nil-return" size={16} /></h4>
                      <ul style={{ fontSize: '0.82rem', color: '#047857', lineHeight: 1.8, paddingLeft: '1.25rem' }}>
                        <li>NIL GSTR-1 and NIL GSTR-3B are <strong>separate returns</strong> — file both</li>
                        <li>NIL filing takes 2-3 minutes per return — just login, verify zeros, submit, file</li>
                        <li>Late fee for NIL: ₹20/day (₹10 CGST + ₹10 SGST), capped at ₹500 per return</li>
                        <li>You can file NIL returns by SMS to <strong>14409</strong> from the registered mobile: <code>NIL R1 &lt;GSTIN&gt; &lt;MMYYYY&gt;</code> for GSTR-1, <code>NIL 3B &lt;GSTIN&gt; &lt;MMYYYY&gt;</code> for GSTR-3B, <code>NIL C8 &lt;GSTIN&gt; &lt;MMYYYY&gt;</code> for CMP-08 (a quarterly return uses the quarter's last month, e.g. 062026). Then confirm with <code>CNF R1 &lt;code&gt;</code> (or CNF 3B / CNF C8) using the code you receive.</li>
                        <li>QRMP users filing quarterly: NIL return covers the entire quarter</li>
                        <li>Even if you had no sales but had purchases with GST → file REGULAR return (not NIL) to claim ITC</li>
                      </ul>
                    </div>
                  </>
                )}

                {guideTab === 'errors' && (
                  <>
                    <div className="glass-panel mb-4">
                      <div className="table-header"><h3>Common GST Portal Errors & How to Fix Them<HelpButton title="Common GST Portal Errors" doc="gst-returns#guide-errors" size={16} /></h3></div>
                      <div style={{ padding: '1rem 1.25rem' }}>
                        {[
                          { error: '"Invalid GSTIN" when adding B2B invoice', fix: 'Verify the client GSTIN on the portal: Services → User Services → Search Taxpayer. The GSTIN must be active. Cancelled/surrendered GSTINs are rejected. Also check for typos — GSTIN is 15 characters: 2 digits (state) + 10 chars (PAN) + 1 entity code + 1 check digit.' },
                          { error: '"Invoice number already exists for this recipient"', fix: 'Each invoice number must be unique per GSTIN per period. If you\'re re-filing after amendment, use Table 9A for amendments, not Table 4A. If duplicate, check if invoice was already reported in a previous period.' },
                          { error: '"Place of Supply mismatch" or wrong tax type', fix: 'If supply is INTER-STATE (different states), only IGST applies. If INTRA-STATE (same state), only CGST+SGST. POS must match the buyer\'s state for inter-state. Common mistake: Delhi business billing Delhi client but selecting different POS.' },
                          { error: '"Invoice date is not within the return period"', fix: 'Invoice date must fall within the filing period. E.g., for March 2026 return, dates must be 01/03/2026 to 31/03/2026. If you missed an invoice, report in the current period — it\'s allowed but must be before September of next FY.' },
                          { error: '"HSN code is invalid" in Table 12', fix: 'Use valid HSN codes from the official HSN Master (downloadable from cbic.gov.in). Services use SAC codes starting with 99. Common: 998314 (IT services), 9954 (construction), 9983 (professional services). The portal validates against the master list.' },
                          { error: '"GSTR-3B cannot be filed — GSTR-1 not filed"', fix: 'You MUST file GSTR-1 before GSTR-3B for the same period. Go back and file GSTR-1 first. This is a hard block — no workaround.' },
                          { error: '"ITC claimed exceeds GSTR-2B available ITC"', fix: 'You cannot claim more ITC than what\'s in your auto-populated GSTR-2B statement. Check Returns → GSTR-2B to see eligible ITC. If a supplier hasn\'t filed their GSTR-1, their invoice won\'t appear in your GSTR-2B and you can\'t claim that ITC yet.' },
                          { error: '"Previous period return not filed"', fix: 'GST returns must be filed sequentially. You cannot file March return if February is pending. File all pending returns in order starting from the earliest unfiled period.' },
                          { error: '"Taxable value and tax amount mismatch"', fix: 'The portal validates that tax = taxable value × rate. E.g., if taxable value is ₹10,000 at 18%, IGST must be ₹1,800 (or CGST ₹900 + SGST ₹900). Rounding differences up to ₹1 are allowed.' },
                          { error: '"EVC generation failed" or "OTP not received"', fix: 'Try after 5 minutes. Check registered mobile number is correct (Profile → Update). For companies, EVC is not available — use DSC only. If DSC fails, check USB token is inserted and emsigner utility is running.' },
                          { error: '"Challan amount does not match liability"', fix: 'Create challan AFTER submitting GSTR-3B, not before. The challan amount must match the "Tax payable in cash" column. If you overpaid, excess stays in Electronic Cash Ledger for future use or refund.' },
                        ].map((item, i) => (
                          <div key={i} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: i < 10 ? '1px solid var(--border)' : 'none' }}>
                            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#dc2626', marginBottom: '0.25rem' }}>Error: {item.error}</p>
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>Fix: {item.fix}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="glass-panel p-4" style={{ background: '#f8fafc' }}>
                      <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>Key GST Rules to Remember<HelpButton title="Key GST Rules" doc="gst-returns#guide-rules" size={16} /></h4>
                      <ul style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: '1.25rem' }}>
                        <li><strong>Section 16(4):</strong> ITC for any invoice must be claimed by the due date of September return of the following FY, or the date of filing annual return — whichever is earlier.</li>
                        <li><strong>Section 34:</strong> Credit notes must be issued before September 30 following the end of FY of the original invoice or annual return filing — whichever is earlier.</li>
                        <li><strong>Section 31:</strong> Tax invoice must be issued at or before the time of supply. For services, within 30 days of supply.</li>
                        <li><strong>Section 49:</strong> ITC utilization order is mandatory: IGST first (against IGST→CGST→SGST), then CGST (→CGST→IGST), then SGST (→SGST→IGST). Cross-utilization of CGST↔SGST is NOT allowed.</li>
                        <li><strong>Rule 36(4):</strong> ITC can only be claimed for invoices that appear in GSTR-2B. No provisional ITC beyond GSTR-2B.</li>
                        <li><strong>Section 50:</strong> Interest on late payment is 18% p.a. on NET tax payable (after ITC). Calculated from the day after due date to date of payment.</li>
                        <li><strong>Section 73/74:</strong> Tax department can issue notice for short payment within 3 years (73) or 5 years for fraud (74). Maintain all records for at least 6 years.</li>
                        <li><strong>Section 29(2)(c):</strong> GSTIN cancellation if returns not filed for 6+ continuous months (quarterly filers: 2 consecutive quarters).</li>
                        <li><strong>E-way Bill:</strong> Cannot generate e-way bills if GSTR-3B not filed for 2+ consecutive months.</li>
                      </ul>
                    </div>
                  </>
                )}
        </>
      )}
    </div>
  );
}
