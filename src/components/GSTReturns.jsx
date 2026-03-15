import { useState, useEffect } from 'react';
import { FileText, Download, Upload, ExternalLink, CheckCircle, ChevronDown, ChevronRight, AlertTriangle, BookOpen, BarChart3, ClipboardList } from 'lucide-react';
import { getAllBills, getAllExpenses, getProfile } from '../store';
import { formatCurrency, INVOICE_TYPES, calculateLineItemTax, getStateCode, formatDateGST, getFilingPeriod } from '../utils';
import { toast } from './Toast';

const GST_TYPES = ['tax-invoice', 'credit-note'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const QUARTERS = [
  { id: 'Q1', label: 'Q1 (Apr–Jun)', months: [3, 4, 5] },
  { id: 'Q2', label: 'Q2 (Jul–Sep)', months: [6, 7, 8] },
  { id: 'Q3', label: 'Q3 (Oct–Dec)', months: [9, 10, 11] },
  { id: 'Q4', label: 'Q4 (Jan–Mar)', months: [0, 1, 2] },
];

function getFYOptions() {
  const now = new Date();
  const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const options = [];
  for (let i = 0; i < 5; i++) {
    const y = currentYear - i;
    options.push({ value: `${y}-${y + 1}`, label: `FY ${y}-${String(y + 1).slice(-2)}`, from: `${y}-04-01`, to: `${y + 1}-03-31` });
  }
  return options;
}

function downloadCSV(filename, headers, rows) {
  const escape = (val) => { const s = String(val ?? ''); return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const lines = [headers.map(escape).join(',')];
  rows.forEach(row => lines.push(row.map(escape).join(',')));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function round2(n) { return Math.round(n * 100) / 100; }

function computeItemTaxSplit(item, isInterState) {
  const { afterDiscount, taxAmount } = calculateLineItemTax(item);
  if (isInterState) return { taxable: afterDiscount, cgst: 0, sgst: 0, igst: taxAmount };
  const half = Math.round((taxAmount / 2) * 100) / 100;
  return { taxable: afterDiscount, cgst: half, sgst: taxAmount - half, igst: 0 };
}

function getTaxableAmount(totals) {
  return totals?.taxableAmount ?? ((totals?.subtotal || 0) - (totals?.totalDiscount || 0));
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
    title: 'Table 5 — B2C Large (Inter-state > ₹2.5 Lakh)',
    details: `This table is ONLY for inter-state invoices to UNREGISTERED persons (no GSTIN) where invoice value EXCEEDS ₹2,50,000.
1. Click "5A, 5B — B2C (Large) Invoices" tile.
2. Click "+ ADD INVOICE".
3. Enter: Place of Supply (buyer's state), Invoice Number, Invoice Date, Invoice Value, Taxable Value, IGST Amount, Cess (if any).
4. Only IGST applies here (never CGST/SGST) since these are inter-state.
5. Click "SAVE".
NOTE: If you have no inter-state B2C invoices above ₹2.5L, skip this table entirely.`
  },
  {
    title: 'Table 7 — B2C Small (All Other B2C)',
    details: `This covers ALL remaining B2C invoices: intra-state B2C of any value + inter-state B2C below ₹2.5 lakh.
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
• Late fee: ₹50/day (₹25 CGST + ₹25 SGST), max ₹10,000 per return
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

function StepList({ steps, title }) {
  const [expanded, setExpanded] = useState({});
  const [checked, setChecked] = useState({});
  return (
    <div className="glass-panel mb-4">
      <div className="table-header"><h3>{title}</h3></div>
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
  const [expenses, setExpenses] = useState([]);
  const [profile, setProfile] = useState({});
  const [filterMode, setFilterMode] = useState('month');
  const [fyFilter, setFyFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [quarterFilter, setQuarterFilter] = useState('Q1');
  const [activeTab, setActiveTab] = useState('gstr1');
  const [guideTab, setGuideTab] = useState('regular');
  const [filingStatus, setFilingStatus] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gst_filing_status') || '{}'); } catch { return {}; }
  });

  const fyOptions = getFYOptions();
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = currentYear; y >= currentYear - 5; y--) yearOptions.push(y);

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

  const loadData = async () => {
    try {
      const [b, e, p] = await Promise.all([getAllBills(), getAllExpenses(), getProfile()]);
      setBills(b); setExpenses(e); setProfile(p || {});
    } catch { toast('Failed to load data', 'error'); }
  };

  // ========== Period filtering ==========
  const filterByPeriod = (date) => {
    if (!date) return false;
    if (filterMode === 'fy') {
      const fy = fyOptions.find(f => f.value === fyFilter);
      return fy ? date >= fy.from && date <= fy.to : true;
    } else if (filterMode === 'quarter') {
      const d = new Date(date);
      const q = QUARTERS.find(q => q.id === quarterFilter);
      if (!q) return false;
      // Determine the year for the quarter based on FY context
      const yr = parseInt(yearFilter);
      return q.months.includes(d.getMonth()) && d.getFullYear() === yr;
    } else {
      const d = new Date(date);
      return d.getFullYear() === parseInt(yearFilter) && d.getMonth() === parseInt(monthFilter);
    }
  };

  const filteredBills = bills.filter(bill => {
    const type = bill.invoiceType || 'tax-invoice';
    if (!GST_TYPES.includes(type)) return false;
    if (!bill.data) return false;
    return filterByPeriod(bill.invoiceDate);
  });
  const allFilteredBills = bills.filter(bill => bill.data && filterByPeriod(bill.invoiceDate));
  const filteredExpenses = expenses.filter(exp => filterByPeriod(exp.date));

  // ========== Classification ==========
  const creditNotes = filteredBills.filter(b => (b.invoiceType || 'tax-invoice') === 'credit-note');
  const regularBills = filteredBills.filter(b => (b.invoiceType || 'tax-invoice') !== 'credit-note');
  const b2bRegular = regularBills.filter(b => b.data?.client?.gstin);
  const b2cRegular = regularBills.filter(b => !b.data?.client?.gstin);
  const b2cLarge = b2cRegular.filter(b => {
    const isInter = b.data?.profile?.state && b.data?.client?.state && b.data.profile.state.toLowerCase() !== b.data.client.state.toLowerCase();
    return isInter && (b.totalAmount || 0) > 250000;
  });
  const b2cSmall = b2cRegular.filter(b => {
    const isInter = b.data?.profile?.state && b.data?.client?.state && b.data.profile.state.toLowerCase() !== b.data.client.state.toLowerCase();
    return !(isInter && (b.totalAmount || 0) > 250000);
  });

  // ========== B2B Rows ==========
  const b2bRows = b2bRegular.map(bill => {
    const { client, totals, details } = bill.data;
    const isInterState = bill.data.profile?.state && client?.state && bill.data.profile.state.toLowerCase() !== client.state.toLowerCase();
    const pos = getStateCode(details?.placeOfSupply || client?.state || '');
    return {
      gstin: client.gstin, clientName: client.name || bill.clientName || '',
      invoiceNo: bill.invoiceNumber || '', date: bill.invoiceDate || '', pos,
      supplyType: isInterState ? 'Inter' : 'Intra',
      taxable: getTaxableAmount(totals),
      cgst: isInterState ? 0 : (totals?.cgst || 0), sgst: isInterState ? 0 : (totals?.sgst || 0),
      igst: isInterState ? (totals?.igst || 0) : 0, total: totals?.total || 0,
    };
  });

  // ========== B2C by Rate ==========
  const b2cByRate = {};
  const b2cBills = filteredBills.filter(b => !b.data?.client?.gstin);
  b2cBills.forEach(bill => {
    const { profile: prof, client, items } = bill.data;
    const isInterState = prof?.state && client?.state && prof.state !== client.state;
    (items || []).forEach(item => {
      const rate = item.taxPercent || 0;
      if (!b2cByRate[rate]) b2cByRate[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
      const split = computeItemTaxSplit(item, isInterState);
      b2cByRate[rate].taxable += split.taxable; b2cByRate[rate].cgst += split.cgst;
      b2cByRate[rate].sgst += split.sgst; b2cByRate[rate].igst += split.igst;
      b2cByRate[rate].total += split.taxable + split.cgst + split.sgst + split.igst;
    });
  });
  const b2cRates = Object.keys(b2cByRate).map(Number).sort((a, b) => a - b);

  // ========== HSN Summary ==========
  const hsnMap = {};
  filteredBills.forEach(bill => {
    const { profile: prof, client, items } = bill.data;
    const isInterState = prof?.state && client?.state && prof.state !== client.state;
    (items || []).forEach(item => {
      const hsn = item.hsn || 'N/A';
      if (!hsnMap[hsn]) hsnMap[hsn] = { hsn, description: item.name || '', quantity: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 };
      const split = computeItemTaxSplit(item, isInterState);
      hsnMap[hsn].quantity += item.quantity || 0; hsnMap[hsn].taxable += split.taxable;
      hsnMap[hsn].cgst += split.cgst; hsnMap[hsn].sgst += split.sgst; hsnMap[hsn].igst += split.igst;
      hsnMap[hsn].totalTax += split.cgst + split.sgst + split.igst;
    });
  });
  const hsnRows = Object.values(hsnMap).sort((a, b) => a.hsn.localeCompare(b.hsn));

  // ========== Totals ==========
  const sumRows = (rows) => rows.reduce((acc, r) => ({ taxable: acc.taxable + r.taxable, cgst: acc.cgst + r.cgst, sgst: acc.sgst + r.sgst, igst: acc.igst + r.igst, total: acc.total + r.total }), { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });
  const b2bTotals = sumRows(b2bRows);
  const b2cTotals = b2cRates.reduce((acc, rate) => { const d = b2cByRate[rate]; return { taxable: acc.taxable + d.taxable, cgst: acc.cgst + d.cgst, sgst: acc.sgst + d.sgst, igst: acc.igst + d.igst, total: acc.total + d.total }; }, { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });
  const grandTotals = { taxable: b2bTotals.taxable + b2cTotals.taxable, cgst: b2bTotals.cgst + b2cTotals.cgst, sgst: b2bTotals.sgst + b2cTotals.sgst, igst: b2bTotals.igst + b2cTotals.igst, total: b2bTotals.total + b2cTotals.total };

  // ========== GSTR-3B ==========
  const outputTax = { cgst: grandTotals.cgst, sgst: grandTotals.sgst, igst: grandTotals.igst };
  const itcFromExpenses = filteredExpenses.reduce((acc, e) => {
    const gst = e.gstAmount || 0;
    const half = Math.round((gst / 2) * 100) / 100;
    return { cgst: acc.cgst + half, sgst: acc.sgst + (gst - half), igst: acc.igst };
  }, { cgst: 0, sgst: 0, igst: 0 });
  const netTax = {
    cgst: Math.max(0, outputTax.cgst - itcFromExpenses.cgst),
    sgst: Math.max(0, outputTax.sgst - itcFromExpenses.sgst),
    igst: Math.max(0, outputTax.igst - itcFromExpenses.igst),
  };

  // ========== Document Summary ==========
  const docSummary = {};
  allFilteredBills.forEach(bill => {
    const type = bill.invoiceType || 'tax-invoice';
    const prefix = INVOICE_TYPES[type]?.prefix || 'INV';
    if (!docSummary[prefix]) docSummary[prefix] = { type: INVOICE_TYPES[type]?.label || type, from: bill.invoiceNumber, to: bill.invoiceNumber, total: 0 };
    docSummary[prefix].total++;
    if (bill.invoiceNumber < docSummary[prefix].from) docSummary[prefix].from = bill.invoiceNumber;
    if (bill.invoiceNumber > docSummary[prefix].to) docSummary[prefix].to = bill.invoiceNumber;
  });

  // ========== Validation Warnings ==========
  const warnings = [];
  filteredBills.forEach(bill => {
    const { client, items } = bill.data;
    if (client?.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}[A-Z]{1}\d{1}$/.test(client.gstin)) {
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
  });
  if (!profile.gstin) {
    warnings.push({ type: 'error', msg: 'Your business GSTIN is not set. Go to Settings → Company Details to add it.' });
  }

  // ========== Filing Period Key ==========
  const getPeriodKey = () => {
    if (filterMode === 'month') return `${monthFilter}_${yearFilter}`;
    if (filterMode === 'quarter') return `${quarterFilter}_${yearFilter}`;
    return fyFilter;
  };
  const periodKey = getPeriodKey();
  const periodFiling = filingStatus[periodKey] || {};

  const markFiled = (returnType) => {
    const updated = { ...filingStatus, [periodKey]: { ...periodFiling, [returnType]: true, [`${returnType}Date`]: new Date().toISOString() } };
    setFilingStatus(updated);
    localStorage.setItem('gst_filing_status', JSON.stringify(updated));
    toast(`${returnType.toUpperCase()} marked as filed for this period`, 'success');
  };

  const isNilReturn = filteredBills.length === 0 && filteredExpenses.length === 0;

  // ========== CSV Exports ==========
  const exportB2B = () => {
    if (b2bRows.length === 0) { toast('No B2B data to export', 'warning'); return; }
    downloadCSV('GSTR1_B2B_Invoices.csv',
      ['GSTIN/UIN', 'Receiver Name', 'Invoice Number', 'Invoice Date', 'Invoice Value', 'Place of Supply', 'Reverse Charge', 'Invoice Type', 'Supply Type', 'Taxable Value', 'CGST Amount', 'SGST Amount', 'IGST Amount'],
      b2bRegular.map(bill => {
        const { client, profile: prof, totals, details } = bill.data;
        const isInter = prof?.state && client?.state && prof.state.toLowerCase() !== client.state.toLowerCase();
        const pos = getStateCode(details?.placeOfSupply || client?.state || '');
        return [client.gstin, client.name || bill.clientName || '', bill.invoiceNumber || '', formatDateGST(bill.invoiceDate), (totals?.total || 0).toFixed(2), pos, 'N', 'Regular', isInter ? 'Inter State' : 'Intra State', getTaxableAmount(totals).toFixed(2), isInter ? 0 : (totals?.cgst || 0).toFixed(2), isInter ? 0 : (totals?.sgst || 0).toFixed(2), isInter ? (totals?.igst || 0).toFixed(2) : 0];
      }));
    toast('B2B CSV downloaded — matches GSTR-1 Table 4A format', 'success');
  };

  const exportB2C = () => {
    if (b2cRates.length === 0 && b2cLarge.length === 0) { toast('No B2C data to export', 'warning'); return; }
    const b2csData = {};
    b2cSmall.forEach(bill => {
      const { profile: prof, client, items, details } = bill.data;
      const isInter = prof?.state && client?.state && prof.state.toLowerCase() !== client.state.toLowerCase();
      const pos = getStateCode(details?.placeOfSupply || client?.state || prof?.state || '');
      const splyType = isInter ? 'INTER' : 'INTRA';
      (items || []).forEach(item => {
        const rate = item.taxPercent || 0;
        const key = `${splyType}_${pos}_${rate}`;
        if (!b2csData[key]) b2csData[key] = { splyType, pos, rate, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
        const split = computeItemTaxSplit(item, isInter);
        b2csData[key].taxable += split.taxable; b2csData[key].cgst += split.cgst; b2csData[key].sgst += split.sgst; b2csData[key].igst += split.igst;
      });
    });
    downloadCSV('GSTR1_B2C_Small.csv', ['Type', 'Place of Supply', 'Rate', 'Taxable Value', 'CGST Amount', 'SGST Amount', 'IGST Amount', 'Cess Amount'],
      Object.values(b2csData).map(d => [d.splyType === 'INTER' ? 'Inter State' : 'Intra State', d.pos, d.rate + '%', d.taxable.toFixed(2), d.cgst.toFixed(2), d.sgst.toFixed(2), d.igst.toFixed(2), '0.00']));
    if (b2cLarge.length > 0) {
      downloadCSV('GSTR1_B2C_Large.csv', ['Invoice Number', 'Invoice Date', 'Invoice Value', 'Place of Supply', 'Taxable Value', 'IGST Amount', 'Cess Amount'],
        b2cLarge.map(bill => { const { client, totals, details } = bill.data; const pos = getStateCode(details?.placeOfSupply || client?.state || ''); return [bill.invoiceNumber, formatDateGST(bill.invoiceDate), (totals?.total || 0).toFixed(2), pos, getTaxableAmount(totals).toFixed(2), (totals?.igst || 0).toFixed(2), '0.00']; }));
    }
    toast('B2C CSV downloaded', 'success');
  };

  const exportHSN = () => {
    if (hsnRows.length === 0) { toast('No HSN data', 'warning'); return; }
    const hsnDetailed = {};
    filteredBills.forEach(bill => {
      const { profile: prof, client, items } = bill.data;
      const isInter = prof?.state && client?.state && prof.state.toLowerCase() !== client.state.toLowerCase();
      (items || []).forEach(item => {
        const hsn = item.hsn || 'N/A'; const rate = item.taxPercent || 0; const key = `${hsn}_${rate}`;
        if (!hsnDetailed[key]) hsnDetailed[key] = { hsn, desc: item.name || '', uqc: 'NOS', qty: 0, rate, taxable: 0, cgst: 0, sgst: 0, igst: 0, totalValue: 0 };
        const split = computeItemTaxSplit(item, isInter);
        hsnDetailed[key].qty += item.quantity || 0; hsnDetailed[key].taxable += split.taxable;
        hsnDetailed[key].cgst += split.cgst; hsnDetailed[key].sgst += split.sgst; hsnDetailed[key].igst += split.igst;
        hsnDetailed[key].totalValue += split.taxable + split.cgst + split.sgst + split.igst;
      });
    });
    downloadCSV('GSTR1_HSN_Summary.csv', ['HSN', 'Description', 'UQC', 'Total Quantity', 'Rate %', 'Taxable Value', 'IGST Amount', 'CGST Amount', 'SGST Amount', 'Cess Amount', 'Total Value'],
      Object.values(hsnDetailed).map(r => [r.hsn, r.desc, r.uqc, r.qty, r.rate, r.taxable.toFixed(2), r.igst.toFixed(2), r.cgst.toFixed(2), r.sgst.toFixed(2), '0.00', r.totalValue.toFixed(2)]));
    toast('HSN CSV downloaded — GSTR-1 Table 12 format', 'success');
  };

  const exportCDNR = () => {
    const cdnrBills = creditNotes.filter(b => b.data?.client?.gstin);
    const cdnurBills = creditNotes.filter(b => !b.data?.client?.gstin);
    if (cdnrBills.length === 0 && cdnurBills.length === 0) { toast('No Credit Notes', 'warning'); return; }
    if (cdnrBills.length > 0) {
      downloadCSV('GSTR1_CDNR.csv', ['GSTIN/UIN', 'Receiver Name', 'Note Number', 'Note Date', 'Note Type', 'Place of Supply', 'Reverse Charge', 'Note Value', 'Taxable Value', 'IGST Amount', 'CGST Amount', 'SGST Amount'],
        cdnrBills.map(bill => { const { client, profile: prof, totals } = bill.data; const isInter = prof?.state && client?.state && prof.state.toLowerCase() !== client.state.toLowerCase(); const pos = getStateCode(bill.data.details?.placeOfSupply || client?.state || ''); return [client.gstin, client.name || bill.clientName, bill.invoiceNumber, formatDateGST(bill.invoiceDate), 'C', pos, 'N', (totals?.total || 0).toFixed(2), getTaxableAmount(totals).toFixed(2), isInter ? (totals?.igst || 0).toFixed(2) : '0.00', isInter ? '0.00' : (totals?.cgst || 0).toFixed(2), isInter ? '0.00' : (totals?.sgst || 0).toFixed(2)]; }));
    }
    if (cdnurBills.length > 0) {
      downloadCSV('GSTR1_CDNUR.csv', ['Note Number', 'Note Date', 'Note Type', 'Place of Supply', 'Note Value', 'Taxable Value', 'IGST Amount', 'Cess Amount'],
        cdnurBills.map(bill => { const { client, totals } = bill.data; const pos = getStateCode(bill.data.details?.placeOfSupply || client?.state || ''); return [bill.invoiceNumber, formatDateGST(bill.invoiceDate), 'C', pos, (totals?.total || 0).toFixed(2), getTaxableAmount(totals).toFixed(2), (totals?.igst || 0).toFixed(2), '0.00']; }));
    }
    toast('Credit Notes exported', 'success');
  };

  const exportDocSummary = () => {
    if (Object.keys(docSummary).length === 0) { toast('No documents', 'warning'); return; }
    downloadCSV('GSTR1_Doc_Summary.csv', ['Document Type', 'Sr. No. From', 'Sr. No. To', 'Total Number', 'Cancelled'],
      Object.entries(docSummary).map(([, d]) => [d.type, d.from, d.to, d.total, 0]));
    toast('Document Summary CSV downloaded', 'success');
  };

  const exportGSTR3B = () => {
    downloadCSV('GSTR3B_Summary.csv', ['Description', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Total'], [
      ['3.1(a) Outward taxable supplies', grandTotals.taxable.toFixed(2), grandTotals.igst.toFixed(2), grandTotals.cgst.toFixed(2), grandTotals.sgst.toFixed(2), (grandTotals.igst + grandTotals.cgst + grandTotals.sgst).toFixed(2)],
      ['4(A) ITC Available', '', itcFromExpenses.igst.toFixed(2), itcFromExpenses.cgst.toFixed(2), itcFromExpenses.sgst.toFixed(2), (itcFromExpenses.igst + itcFromExpenses.cgst + itcFromExpenses.sgst).toFixed(2)],
      ['6.1 Tax Payable', '', netTax.igst.toFixed(2), netTax.cgst.toFixed(2), netTax.sgst.toFixed(2), (netTax.igst + netTax.cgst + netTax.sgst).toFixed(2)],
    ]);
    toast('GSTR-3B summary CSV downloaded', 'success');
  };

  // ========== GSTR-1 JSON Export ==========
  const exportGSTR1JSON = () => {
    if (filteredBills.length === 0) { toast('No invoices to export', 'warning'); return; }
    const gstin = profile.gstin || '';
    const fp = filterMode === 'month'
      ? String(parseInt(monthFilter) + 1).padStart(2, '0') + yearFilter
      : getFilingPeriod(filteredBills[0]?.invoiceDate);

    const b2bMap = {};
    b2bRegular.forEach(bill => {
      const { client, profile: prof, totals, items, details } = bill.data;
      const ctin = client.gstin;
      if (!b2bMap[ctin]) b2bMap[ctin] = { ctin, inv: [] };
      const isInter = prof?.state && client?.state && prof.state.toLowerCase() !== client.state.toLowerCase();
      const pos = getStateCode(details?.placeOfSupply || client?.state || '');
      const rateMap = {};
      (items || []).forEach(item => {
        const rate = item.taxPercent || 0;
        if (!rateMap[rate]) rateMap[rate] = { txval: 0, iamt: 0, camt: 0, samt: 0 };
        const split = computeItemTaxSplit(item, isInter);
        rateMap[rate].txval += split.taxable; rateMap[rate].iamt += split.igst; rateMap[rate].camt += split.cgst; rateMap[rate].samt += split.sgst;
      });
      b2bMap[ctin].inv.push({
        inum: bill.invoiceNumber, idt: formatDateGST(bill.invoiceDate), val: round2(totals?.total || 0), pos, rchrg: 'N', inv_typ: 'R',
        itms: Object.entries(rateMap).map(([rt, d], i) => ({ num: i + 1, itm_det: { rt: Number(rt), txval: round2(d.txval), iamt: round2(d.iamt), camt: round2(d.camt), samt: round2(d.samt), csamt: 0 } })),
      });
    });

    const b2csMap = {};
    b2cSmall.forEach(bill => {
      const { profile: prof, client, items, details } = bill.data;
      const isInter = prof?.state && client?.state && prof.state.toLowerCase() !== client.state.toLowerCase();
      const pos = getStateCode(details?.placeOfSupply || client?.state || prof?.state || '');
      const splyTy = isInter ? 'INTER' : 'INTRA';
      (items || []).forEach(item => {
        const rate = item.taxPercent || 0; const key = `${splyTy}_${pos}_${rate}`;
        if (!b2csMap[key]) b2csMap[key] = { sply_ty: splyTy, pos, rt: rate, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
        const split = computeItemTaxSplit(item, isInter);
        b2csMap[key].txval += split.taxable; b2csMap[key].iamt += split.igst; b2csMap[key].camt += split.cgst; b2csMap[key].samt += split.sgst;
      });
    });
    const b2csArr = Object.values(b2csMap).map(d => ({ ...d, txval: round2(d.txval), iamt: round2(d.iamt), camt: round2(d.camt), samt: round2(d.samt) }));

    const b2clMap = {};
    b2cLarge.forEach(bill => {
      const { client, totals, items, details } = bill.data;
      const pos = getStateCode(details?.placeOfSupply || client?.state || '');
      if (!b2clMap[pos]) b2clMap[pos] = { pos, inv: [] };
      const rateMap = {};
      (items || []).forEach(item => {
        const rate = item.taxPercent || 0; if (!rateMap[rate]) rateMap[rate] = { txval: 0, iamt: 0 };
        const split = computeItemTaxSplit(item, true); rateMap[rate].txval += split.taxable; rateMap[rate].iamt += split.igst;
      });
      b2clMap[pos].inv.push({ inum: bill.invoiceNumber, idt: formatDateGST(bill.invoiceDate), val: round2(totals?.total || 0), itms: Object.entries(rateMap).map(([rt, d], i) => ({ num: i + 1, itm_det: { rt: Number(rt), txval: round2(d.txval), iamt: round2(d.iamt), csamt: 0 } })) });
    });

    const cdnrMap = {};
    creditNotes.filter(b => b.data?.client?.gstin).forEach(bill => {
      const { client, profile: prof, totals, items, details } = bill.data;
      const ctin = client.gstin; if (!cdnrMap[ctin]) cdnrMap[ctin] = { ctin, nt: [] };
      const isInter = prof?.state && client?.state && prof.state.toLowerCase() !== client.state.toLowerCase();
      const pos = getStateCode(details?.placeOfSupply || client?.state || '');
      const rateMap = {};
      (items || []).forEach(item => {
        const rate = item.taxPercent || 0; if (!rateMap[rate]) rateMap[rate] = { txval: 0, iamt: 0, camt: 0, samt: 0 };
        const split = computeItemTaxSplit(item, isInter); rateMap[rate].txval += split.taxable; rateMap[rate].iamt += split.igst; rateMap[rate].camt += split.cgst; rateMap[rate].samt += split.sgst;
      });
      cdnrMap[ctin].nt.push({ ntty: 'C', nt_num: bill.invoiceNumber, nt_dt: formatDateGST(bill.invoiceDate), val: round2(totals?.total || 0), pos, rchrg: 'N', inv_typ: 'R',
        itms: Object.entries(rateMap).map(([rt, d], i) => ({ num: i + 1, itm_det: { rt: Number(rt), txval: round2(d.txval), iamt: round2(d.iamt), camt: round2(d.camt), samt: round2(d.samt), csamt: 0 } })) });
    });

    const hsnJsonMap = {};
    filteredBills.forEach(bill => {
      const { profile: prof, client, items } = bill.data;
      const isInter = prof?.state && client?.state && prof.state !== client.state;
      (items || []).forEach(item => {
        const hsn = item.hsn || ''; const rate = item.taxPercent || 0; const key = `${hsn}_${rate}`;
        if (!hsnJsonMap[key]) hsnJsonMap[key] = { hsn_sc: hsn, desc: item.name || '', uqc: 'NOS', qty: 0, rt: rate, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
        const split = computeItemTaxSplit(item, isInter);
        hsnJsonMap[key].qty += item.quantity || 0; hsnJsonMap[key].txval += split.taxable; hsnJsonMap[key].iamt += split.igst; hsnJsonMap[key].camt += split.cgst; hsnJsonMap[key].samt += split.sgst;
      });
    });

    const docDet = Object.entries(docSummary).map(([, d], i) => ({ doc_num: i + 1, docs: [{ num: 1, from: d.from, to: d.to, totnum: d.total, cancel: 0, net_issue: d.total }] }));

    const gstr1 = {
      gstin, fp,
      b2b: Object.values(b2bMap), b2cs: b2csArr,
      ...(Object.keys(b2clMap).length > 0 ? { b2cl: Object.values(b2clMap) } : {}),
      ...(Object.keys(cdnrMap).length > 0 ? { cdnr: Object.values(cdnrMap) } : {}),
      hsn: { data: Object.values(hsnJsonMap).map((r, i) => ({ num: i + 1, ...r, txval: round2(r.txval), iamt: round2(r.iamt), camt: round2(r.camt), samt: round2(r.samt) })) },
      doc_issue: { doc_det: docDet },
    };

    const blob = new Blob([JSON.stringify(gstr1, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `GSTR1_${gstin || 'export'}_${fp}.json`; a.click();
    URL.revokeObjectURL(url);
    toast(`GSTR-1 JSON exported — upload to GST portal offline tool`, 'success');
  };

  // ========== RENDER ==========
  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">GST Returns</h1>
          <p className="page-subtitle">Self-file your GSTR-1 & GSTR-3B — all data, exports, and step-by-step guidance in one place</p>
        </div>
        <a href="https://gst.gov.in" target="_blank" rel="noopener noreferrer" className="btn btn-primary">
          <ExternalLink size={16} /> Open GST Portal
        </a>
      </div>

      {/* Important Dates */}
      <div className="glass-panel p-4 mb-4" style={{ borderLeft: '4px solid var(--primary)' }}>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
          <div><strong>GSTR-1 Due:</strong> 11th of next month (monthly) / 13th after quarter (QRMP)</div>
          <div><strong>GSTR-3B Due:</strong> 20th of next month (monthly) / 22nd-24th after quarter (QRMP)</div>
          <div><strong>Late Fee:</strong> ₹50/day (₹20 for NIL) + 18% interest</div>
        </div>
      </div>

      {/* Period Selector */}
      <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Period</label>
            <select className="form-input" value={filterMode} onChange={e => setFilterMode(e.target.value)}>
              <option value="month">Monthly</option>
              <option value="quarter">Quarterly (QRMP)</option>
              <option value="fy">Full Year</option>
            </select>
          </div>
          {filterMode === 'fy' ? (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Fiscal Year</label>
              <select className="form-input" value={fyFilter} onChange={e => setFyFilter(e.target.value)}>
                {fyOptions.map(fy => <option key={fy.value} value={fy.value}>{fy.label}</option>)}
              </select>
            </div>
          ) : filterMode === 'quarter' ? (
            <>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Quarter</label>
                <select className="form-input" value={quarterFilter} onChange={e => setQuarterFilter(e.target.value)}>
                  {QUARTERS.map(q => <option key={q.id} value={q.id}>{q.label}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Year</label>
                <select className="form-input" value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Month</label>
                <select className="form-input" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
                  {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Year</label>
                <select className="form-input" value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </>
          )}

          {/* Filing status badges */}
          <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto', alignItems: 'center' }}>
            {periodFiling.gstr1 ? (
              <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: '12px', background: '#ecfdf5', color: '#059669', fontWeight: 600 }}>GSTR-1 Filed</span>
            ) : (
              <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: '12px', background: '#fef2f2', color: '#dc2626', fontWeight: 600 }}>GSTR-1 Pending</span>
            )}
            {periodFiling.gstr3b ? (
              <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: '12px', background: '#ecfdf5', color: '#059669', fontWeight: 600 }}>GSTR-3B Filed</span>
            ) : (
              <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: '12px', background: '#fef2f2', color: '#dc2626', fontWeight: 600 }}>GSTR-3B Pending</span>
            )}
          </div>
        </div>
      </div>

      {/* Validation Warnings */}
      {warnings.length > 0 && (
        <div className="glass-panel p-4 mb-4" style={{ borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
          <h4 style={{ color: '#92400e', marginBottom: '0.5rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={16} /> Validation Issues ({warnings.length})
          </h4>
          <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
            {warnings.slice(0, 20).map((w, i) => (
              <p key={i} style={{ fontSize: '0.8rem', color: w.type === 'error' ? '#dc2626' : '#a16207', margin: '0.2rem 0', lineHeight: 1.5 }}>
                {w.type === 'error' ? '✗' : '⚠'} {w.msg}
              </p>
            ))}
            {warnings.length > 20 && <p style={{ fontSize: '0.8rem', color: '#a16207' }}>...and {warnings.length - 20} more</p>}
          </div>
        </div>
      )}

      {/* NIL Return */}
      {isNilReturn && (
        <div className="glass-panel p-4 mb-4" style={{ borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
          <h4 style={{ color: '#92400e', marginBottom: '0.25rem' }}>NIL Return Period</h4>
          <p style={{ fontSize: '0.85rem', color: '#a16207' }}>
            No invoices or expenses found. You should file a NIL return on the GST portal.
            NIL returns are mandatory — skipping leads to ₹20/day penalty and possible GSTIN cancellation after 6 months.
          </p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '1rem' }}>
        <div className="stat-card">
          <div><p className="stat-label">Total Invoices</p><h2 className="stat-value">{filteredBills.length}</h2></div>
        </div>
        <div className="stat-card">
          <div><p className="stat-label">Taxable Value</p><h2 className="stat-value" style={{ fontSize: '1.1rem' }}>{formatCurrency(grandTotals.taxable)}</h2></div>
        </div>
        <div className="stat-card">
          <div><p className="stat-label">Total Tax</p><h2 className="stat-value" style={{ fontSize: '1.1rem' }}>{formatCurrency(grandTotals.cgst + grandTotals.sgst + grandTotals.igst)}</h2></div>
        </div>
        <div className="stat-card">
          <div><p className="stat-label">Net Tax Payable</p><h2 className="stat-value" style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>{formatCurrency(netTax.igst + netTax.cgst + netTax.sgst)}</h2></div>
        </div>
      </div>

      {/* Tab Selector */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[
          { id: 'gstr1', label: 'GSTR-1', icon: BarChart3 },
          { id: 'gstr3b', label: 'GSTR-3B', icon: FileText },
          { id: 'guide', label: 'Filing Guide', icon: BookOpen },
        ].map(tab => (
          <button key={tab.id} className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab(tab.id)}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* ===================== GSTR-1 TAB ===================== */}
      {activeTab === 'gstr1' && (
        <>
          {/* Export bar */}
          <div className="glass-panel p-3 mb-4" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: '0.85rem', marginRight: '0.5rem' }}>Export:</span>
            <button className="btn btn-primary" onClick={exportGSTR1JSON} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}><Upload size={14} /> GSTR-1 JSON</button>
            <button className="btn btn-secondary" onClick={exportB2B} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}><Download size={14} /> B2B CSV</button>
            <button className="btn btn-secondary" onClick={exportB2C} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}><Download size={14} /> B2C CSV</button>
            <button className="btn btn-secondary" onClick={exportHSN} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}><Download size={14} /> HSN CSV</button>
            <button className="btn btn-secondary" onClick={exportCDNR} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}><Download size={14} /> CDNR CSV</button>
            <button className="btn btn-secondary" onClick={exportDocSummary} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}><Download size={14} /> Docs CSV</button>
            {!periodFiling.gstr1 && (
              <button className="btn btn-secondary" onClick={() => markFiled('gstr1')} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', marginLeft: 'auto', color: '#059669', borderColor: '#bbf7d0' }}>
                <CheckCircle size={14} /> Mark GSTR-1 as Filed
              </button>
            )}
          </div>

          {/* B2B — Table 4A */}
          <div className="glass-panel mb-4">
            <div className="table-header">
              <h3>B2B Sales — Table 4A (Clients with GSTIN)</h3>
              <span className="text-muted" style={{ fontSize: '0.85rem' }}>{b2bRows.length} invoice{b2bRows.length !== 1 ? 's' : ''}</span>
            </div>
            {b2bRows.length === 0 ? (
              <div className="empty-state"><FileText size={40} /><p>No B2B invoices for this period.</p></div>
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
                    {b2bRows.map((r, i) => (
                      <tr key={i}>
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

          {/* Credit/Debit Notes — Table 9B */}
          {creditNotes.length > 0 && (
            <div className="glass-panel mb-4">
              <div className="table-header">
                <h3>Credit/Debit Notes — Table 9B</h3>
                <span className="text-muted" style={{ fontSize: '0.85rem' }}>{creditNotes.length} note{creditNotes.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr><th>GSTIN</th><th>Client</th><th>Note No</th><th>Date</th><th style={{ textAlign: 'right' }}>Taxable</th><th style={{ textAlign: 'right' }}>Tax</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                  <tbody>
                    {creditNotes.map((bill, i) => {
                      const { client, totals } = bill.data;
                      return (
                        <tr key={i}>
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

          {/* B2C — Table 7 */}
          <div className="glass-panel mb-4">
            <div className="table-header">
              <h3>B2C Sales — Table 7 (Without GSTIN)</h3>
              <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                {b2cBills.length} invoice{b2cBills.length !== 1 ? 's' : ''}
                {b2cLarge.length > 0 && <> ({b2cLarge.length} B2C Large &gt;₹2.5L)</>}
              </span>
            </div>
            {b2cRates.length === 0 ? (
              <div className="empty-state"><FileText size={40} /><p>No B2C invoices for this period.</p></div>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr><th>Rate %</th><th style={{ textAlign: 'right' }}>Taxable</th><th style={{ textAlign: 'right' }}>CGST</th><th style={{ textAlign: 'right' }}>SGST</th><th style={{ textAlign: 'right' }}>IGST</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                  <tbody>
                    {b2cRates.map(rate => {
                      const d = b2cByRate[rate];
                      return (
                        <tr key={rate}>
                          <td><span className="type-badge">{rate}%</span></td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(d.taxable)}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(d.cgst)}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(d.sgst)}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(d.igst)}</td>
                          <td style={{ textAlign: 'right' }} className="font-bold">{formatCurrency(d.total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot><tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--border)' }}>
                    <td>B2C Total</td>
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
              <h3>HSN Summary — Table 12</h3>
              <span className="text-muted" style={{ fontSize: '0.85rem' }}>{hsnRows.length} HSN code{hsnRows.length !== 1 ? 's' : ''}</span>
            </div>
            {hsnRows.length === 0 ? (
              <div className="empty-state"><FileText size={40} /><p>No items found.</p></div>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr><th>HSN</th><th>Description</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Taxable</th><th style={{ textAlign: 'right' }}>CGST</th><th style={{ textAlign: 'right' }}>SGST</th><th style={{ textAlign: 'right' }}>IGST</th><th style={{ textAlign: 'right' }}>Total Tax</th></tr></thead>
                  <tbody>
                    {hsnRows.map((r, i) => (
                      <tr key={i}>
                        <td><span className="invoice-badge">{r.hsn}</span></td>
                        <td className="font-medium">{r.description}</td>
                        <td style={{ textAlign: 'right' }}>{r.quantity}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(r.taxable)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(r.cgst)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(r.sgst)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(r.igst)}</td>
                        <td style={{ textAlign: 'right' }} className="font-bold">{formatCurrency(r.totalTax)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--border)' }}>
                    <td colSpan={2}>Total</td>
                    <td style={{ textAlign: 'right' }}>{hsnRows.reduce((s, r) => s + r.quantity, 0)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(hsnRows.reduce((s, r) => s + r.taxable, 0))}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(hsnRows.reduce((s, r) => s + r.cgst, 0))}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(hsnRows.reduce((s, r) => s + r.sgst, 0))}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(hsnRows.reduce((s, r) => s + r.igst, 0))}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(hsnRows.reduce((s, r) => s + r.totalTax, 0))}</td>
                  </tr></tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Document Summary — Table 13 */}
          <div className="glass-panel mb-4">
            <div className="table-header"><h3>Document Summary — Table 13</h3></div>
            {Object.keys(docSummary).length === 0 ? (
              <div className="empty-state"><FileText size={40} /><p>No documents issued.</p></div>
            ) : (
              <div className="table-scroll">
                <table className="data-table" style={{ minWidth: '400px' }}>
                  <thead><tr><th>Document Type</th><th>From</th><th>To</th><th style={{ textAlign: 'right' }}>Total Issued</th></tr></thead>
                  <tbody>
                    {Object.entries(docSummary).map(([prefix, d]) => (
                      <tr key={prefix}>
                        <td className="font-medium">{d.type}</td>
                        <td className="text-muted">{d.from}</td>
                        <td className="text-muted">{d.to}</td>
                        <td style={{ textAlign: 'right' }} className="font-bold">{d.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Grand Summary */}
          <div className="glass-panel">
            <div className="table-header"><h3>GSTR-1 Summary Totals</h3></div>
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
          {/* Export bar */}
          <div className="glass-panel p-3 mb-4" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={exportGSTR3B} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}><Download size={14} /> GSTR-3B Summary CSV</button>
            {!periodFiling.gstr3b && (
              <button className="btn btn-secondary" onClick={() => markFiled('gstr3b')} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', marginLeft: 'auto', color: '#059669', borderColor: '#bbf7d0' }}>
                <CheckCircle size={14} /> Mark GSTR-3B as Filed
              </button>
            )}
          </div>

          {/* Table 3.1 — Output Tax */}
          <div className="glass-panel mb-4">
            <div className="table-header"><h3>Table 3.1 — Outward Supplies & Tax</h3></div>
            <div className="table-scroll">
              <table className="data-table" style={{ minWidth: '600px' }}>
                <thead><tr><th>Nature of Supplies</th><th style={{ textAlign: 'right' }}>Taxable Value</th><th style={{ textAlign: 'right' }}>IGST</th><th style={{ textAlign: 'right' }}>CGST</th><th style={{ textAlign: 'right' }}>SGST</th></tr></thead>
                <tbody>
                  <tr><td className="font-medium">(a) Outward taxable supplies (other than zero-rated, nil-rated and exempted)</td><td style={{ textAlign: 'right' }}>{formatCurrency(grandTotals.taxable)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(grandTotals.igst)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(grandTotals.cgst)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(grandTotals.sgst)}</td></tr>
                  <tr><td className="font-medium">(b) Zero-rated supplies</td><td style={{ textAlign: 'right' }}>{formatCurrency(0)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(0)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(0)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(0)}</td></tr>
                  <tr><td className="font-medium">(c) Non-GST supplies</td><td style={{ textAlign: 'right' }}>{formatCurrency(0)}</td><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>N/A</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 3.2 — Inter-state Supplies */}
          {(() => {
            const interStateB2C = {};
            b2cBills.forEach(bill => {
              const { profile: prof, client, items, details } = bill.data;
              const isInter = prof?.state && client?.state && prof.state.toLowerCase() !== client.state.toLowerCase();
              if (!isInter) return;
              const pos = getStateCode(details?.placeOfSupply || client?.state || '');
              const posName = client?.state || pos;
              (items || []).forEach(item => {
                if (!interStateB2C[posName]) interStateB2C[posName] = { pos: posName, taxable: 0, igst: 0 };
                const split = computeItemTaxSplit(item, true);
                interStateB2C[posName].taxable += split.taxable;
                interStateB2C[posName].igst += split.igst;
              });
            });
            const rows = Object.values(interStateB2C);
            if (rows.length === 0) return null;
            return (
              <div className="glass-panel mb-4">
                <div className="table-header"><h3>Table 3.2 — Inter-state Supplies to Unregistered Persons</h3></div>
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
            <div className="table-header"><h3>Table 4 — Eligible ITC (from Expenses)</h3></div>
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
              ITC calculated from Expense Tracker entries with GST. Verify against GSTR-2B on the GST portal for actual eligible ITC.
            </p>
          </div>

          {/* Table 6 — Tax Payment */}
          <div className="glass-panel mb-4">
            <div className="table-header"><h3>Table 6 — Tax Payment Summary</h3></div>
            <div className="table-scroll">
              <table className="data-table" style={{ minWidth: '600px' }}>
                <thead><tr><th>Description</th><th style={{ textAlign: 'right' }}>IGST</th><th style={{ textAlign: 'right' }}>CGST</th><th style={{ textAlign: 'right' }}>SGST</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                <tbody>
                  <tr><td className="font-medium">Output Tax Liability</td><td style={{ textAlign: 'right' }}>{formatCurrency(outputTax.igst)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(outputTax.cgst)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(outputTax.sgst)}</td><td style={{ textAlign: 'right' }} className="font-bold">{formatCurrency(outputTax.igst + outputTax.cgst + outputTax.sgst)}</td></tr>
                  <tr><td className="font-medium" style={{ color: '#059669' }}>Less: ITC Claimed</td><td style={{ textAlign: 'right', color: '#059669' }}>-{formatCurrency(itcFromExpenses.igst)}</td><td style={{ textAlign: 'right', color: '#059669' }}>-{formatCurrency(itcFromExpenses.cgst)}</td><td style={{ textAlign: 'right', color: '#059669' }}>-{formatCurrency(itcFromExpenses.sgst)}</td><td style={{ textAlign: 'right', color: '#059669' }}>-{formatCurrency(itcFromExpenses.igst + itcFromExpenses.cgst + itcFromExpenses.sgst)}</td></tr>
                </tbody>
                <tfoot><tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--border)' }}>
                  <td>Net Tax Payable</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(netTax.igst)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(netTax.cgst)}</td><td style={{ textAlign: 'right' }}>{formatCurrency(netTax.sgst)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--primary)', fontSize: '1.1rem' }}>{formatCurrency(netTax.igst + netTax.cgst + netTax.sgst)}</td>
                </tr></tfoot>
              </table>
            </div>
          </div>

          {/* Net Payable Highlight */}
          <div className="glass-panel p-6" style={{ textAlign: 'center', background: 'linear-gradient(135deg, #eff6ff, #f0fdf4)' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Total GST Payable This Period</p>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)', margin: 0 }}>
              {formatCurrency(netTax.igst + netTax.cgst + netTax.sgst)}
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              {netTax.igst + netTax.cgst + netTax.sgst === 0 ? 'No tax payable — ITC covers your liability' : 'Pay via Electronic Cash Ledger on the GST portal'}
            </p>
          </div>
        </>
      )}

      {/* ===================== FILING GUIDE TAB ===================== */}
      {activeTab === 'guide' && (
        <>
          {/* Quick Start */}
          <div className="glass-panel p-4 mb-4" style={{ borderLeft: '4px solid var(--primary)' }}>
            <h4 style={{ marginBottom: '0.5rem', fontSize: '0.95rem' }}>Self-File Your GST Returns — Complete Guide</h4>
            <ol style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: '1.25rem' }}>
              <li>Select your filing period (month/quarter) above and review the <strong>GSTR-1</strong> and <strong>GSTR-3B</strong> tabs</li>
              <li>Fix any validation warnings shown above</li>
              <li>Export <strong>GSTR-1 JSON</strong> and upload to GST portal, OR enter data manually following the steps below</li>
              <li>File <strong>GSTR-1 FIRST</strong>, then <strong>GSTR-3B</strong> — this order is mandatory</li>
              <li>If you had NO sales/expenses this month, follow the <strong>NIL Return</strong> steps below</li>
              <li>Mark each return as filed to track your compliance</li>
            </ol>
          </div>

          {/* Prerequisites */}
          <div className="glass-panel p-4 mb-4" style={{ background: '#f8fafc' }}>
            <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>Before You Start — Checklist</h4>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 2rem' }}>
                <div>☐ GST portal login credentials ready (GSTIN + password)</div>
                <div>☐ Mobile phone for OTP verification (EVC)</div>
                <div>☐ All invoices for the period entered in this software</div>
                <div>☐ Expense invoices entered for ITC claims</div>
                <div>☐ DSC (Digital Signature) if you're a Company/LLP</div>
                <div>☐ GSTR-2B reviewed on portal for ITC matching</div>
                <div>☐ Previous period returns filed (required to file current)</div>
                <div>☐ Net banking/UPI ready if tax payment is required</div>
              </div>
            </div>
          </div>

          {/* Due Dates Reference */}
          <div className="glass-panel p-4 mb-4">
            <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem' }}>GST Return Due Dates (As per CGST Act 2017)</h4>
            <div className="table-scroll">
              <table className="data-table" style={{ minWidth: '500px', fontSize: '0.82rem' }}>
                <thead><tr><th>Return</th><th>Frequency</th><th>Due Date</th><th>Late Fee</th></tr></thead>
                <tbody>
                  <tr><td className="font-medium">GSTR-1</td><td>Monthly</td><td>11th of next month</td><td>₹50/day (max ₹10,000)</td></tr>
                  <tr><td className="font-medium">GSTR-1 (QRMP)</td><td>Quarterly</td><td>13th of month after quarter</td><td>₹50/day (max ₹10,000)</td></tr>
                  <tr><td className="font-medium">IFF (QRMP only)</td><td>Monthly (optional)</td><td>13th of next month</td><td>No late fee (optional)</td></tr>
                  <tr><td className="font-medium">GSTR-3B</td><td>Monthly</td><td>20th of next month</td><td>₹50/day (max ₹10,000) + 18% interest</td></tr>
                  <tr><td className="font-medium">GSTR-3B (QRMP)</td><td>Quarterly</td><td>22nd/24th of month after quarter</td><td>₹50/day (max ₹10,000) + 18% interest</td></tr>
                  <tr><td className="font-medium">NIL GSTR-1</td><td>Monthly/Quarterly</td><td>Same as regular</td><td>₹20/day (max ₹500)</td></tr>
                  <tr><td className="font-medium">NIL GSTR-3B</td><td>Monthly/Quarterly</td><td>Same as regular</td><td>₹20/day (max ₹500)</td></tr>
                  <tr><td className="font-medium">GSTR-9 (Annual)</td><td>Yearly</td><td>31st December of next FY</td><td>₹200/day (max 0.5% of turnover)</td></tr>
                </tbody>
              </table>
            </div>
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
                    <StepList steps={GSTR1_STEPS} title="GSTR-1 — Sales Return (File This First)" />

                    <div className="glass-panel p-4 mb-4" style={{ background: '#f0fdf4' }}>
                      <h4 style={{ color: '#059669', marginBottom: '0.5rem', fontSize: '0.9rem' }}>GSTR-1 Pro Tips</h4>
                      <ul style={{ fontSize: '0.82rem', color: '#047857', lineHeight: 1.8, paddingLeft: '1.25rem' }}>
                        <li><strong>Fastest method:</strong> Export GSTR-1 JSON from the GSTR-1 tab above → Go to GST portal → GSTR-1 → Prepare Offline → Download Offline Tool → Import JSON → Upload. Saves 90% of time.</li>
                        <li>If turnover {'<'} ₹5 Cr, opt for QRMP scheme — file quarterly instead of monthly. Apply via Services → User Services → Opt-in for QRMP.</li>
                        <li>Amendments to previous period invoices: Use Table 9A (not 4A). You can amend within the September return of the following FY.</li>
                        <li>Export invoices (zero-rated): Report in Table 6A with shipping bill details.</li>
                        <li>Advances received: Report in Table 11A (tax on advance received) — adjust when invoice is issued (Table 11B).</li>
                      </ul>
                    </div>

                    <StepList steps={GSTR3B_STEPS} title="GSTR-3B — Summary Return + Tax Payment (File After GSTR-1)" />

                    <div className="glass-panel p-4 mb-4" style={{ background: '#eff6ff' }}>
                      <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>GSTR-3B Pro Tips</h4>
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
                    <div className="glass-panel p-4 mb-4" style={{ borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
                      <h4 style={{ color: '#92400e', marginBottom: '0.5rem', fontSize: '0.9rem' }}>When to File NIL Return</h4>
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

                    <StepList steps={NIL_GSTR1_STEPS} title="NIL GSTR-1 — File First (Even with Zero Sales)" />
                    <StepList steps={NIL_GSTR3B_STEPS} title="NIL GSTR-3B — File After NIL GSTR-1" />

                    <div className="glass-panel p-4" style={{ background: '#f0fdf4' }}>
                      <h4 style={{ color: '#059669', marginBottom: '0.5rem', fontSize: '0.9rem' }}>NIL Return Quick Summary</h4>
                      <ul style={{ fontSize: '0.82rem', color: '#047857', lineHeight: 1.8, paddingLeft: '1.25rem' }}>
                        <li>NIL GSTR-1 and NIL GSTR-3B are <strong>separate returns</strong> — file both</li>
                        <li>NIL filing takes 2-3 minutes per return — just login, verify zeros, submit, file</li>
                        <li>Late fee for NIL: ₹20/day (₹10 CGST + ₹10 SGST), capped at ₹500 per return</li>
                        <li>You can file NIL returns via SMS: Send <code>NIL space GSTIN space Return Period</code> to 14409. Verify with OTP.</li>
                        <li>QRMP users filing quarterly: NIL return covers the entire quarter</li>
                        <li>Even if you had no sales but had purchases with GST → file REGULAR return (not NIL) to claim ITC</li>
                      </ul>
                    </div>
                  </>
                )}

                {guideTab === 'errors' && (
                  <>
                    <div className="glass-panel mb-4">
                      <div className="table-header"><h3>Common GST Portal Errors & How to Fix Them</h3></div>
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
                      <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>Key GST Rules to Remember</h4>
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
