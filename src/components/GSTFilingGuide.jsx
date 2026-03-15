import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, CheckCircle, ExternalLink } from 'lucide-react';

const GSTR1_STEPS = [
  {
    title: 'Login to GST Portal',
    details: 'Go to gst.gov.in → Login with your GSTIN credentials → Navigate to Returns → Returns Dashboard.',
  },
  {
    title: 'Select Return Period',
    details: 'Select the Financial Year and Return Filing Period (month) → Click "Search" → Under GSTR-1, click "Prepare Online" (or "Prepare Offline" for bulk upload).',
  },
  {
    title: 'Table 4A — B2B Invoices',
    details: 'Click "4A, 4B, 4C, 6B, 6C — B2B Invoices" → Click "Add Invoice" → Enter receiver GSTIN, Invoice No, Date, Total Value, Place of Supply, and tax details (CGST/SGST or IGST). Use your FreeGSTBill B2B report data to fill each invoice. Add all invoices with GSTIN clients.',
  },
  {
    title: 'Table 5 — B2C Large (Inter-state > ₹2.5L)',
    details: 'Click "5A, 5B — B2C (Large) Invoices" → Add inter-state invoices above ₹2.5 lakh to unregistered persons. Enter Place of Supply, Rate, Taxable Value, and IGST. Check your FreeGSTBill B2C report for invoices meeting this threshold.',
  },
  {
    title: 'Table 7 — B2C Small (Others)',
    details: 'Click "7 — B2C (Others)" → This is for all remaining B2C invoices (intra-state + inter-state below ₹2.5L). Enter aggregated taxable value and tax by rate. FreeGSTBill auto-aggregates this in your B2C report.',
  },
  {
    title: 'Table 9 — HSN Summary',
    details: 'Click "12 — HSN-wise Summary of Outward Supplies" → Enter each HSN/SAC code with total quantity, taxable value, and tax breakup. Use your FreeGSTBill HSN Summary report. HSN is mandatory if turnover > ₹5 Crore (6-digit) or > ₹1.5 Crore (4-digit).',
  },
  {
    title: 'Table 13 — Document Summary',
    details: 'Click "13 — Documents Issued" → Enter the range of invoice numbers issued during the period. Example: From INV/2025-26/0001 To INV/2025-26/0015, Total: 15, Cancelled: 0. FreeGSTBill shows this in the Document Summary tab.',
  },
  {
    title: 'Preview & Submit',
    details: 'Click "Preview" → Review all tables → Click "Submit" (this freezes the data) → Click "File GSTR-1" → Use DSC or EVC to file. Once filed, you cannot modify.',
  },
];

const GSTR3B_STEPS = [
  {
    title: 'Navigate to GSTR-3B',
    details: 'Login → Returns Dashboard → Select period → Under GSTR-3B, click "Prepare Online".',
  },
  {
    title: 'Table 3.1 — Outward Supplies',
    details: 'Enter (a) Taxable outward supplies to registered persons (B2B total from FreeGSTBill), (b) Taxable outward supplies to unregistered persons (B2C total), (c) Zero-rated/export supplies, (d) Inward supplies on reverse charge, (e) Non-GST supplies. Fill taxable value and tax (IGST, CGST, SGST/UTGST, Cess).',
  },
  {
    title: 'Table 3.2 — Inter-state Supplies',
    details: 'Enter unregistered inter-state supplies and composition dealer supplies, broken down by Place of Supply. Only required for inter-state B2C supplies above ₹2.5 lakh.',
  },
  {
    title: 'Table 4 — Input Tax Credit (ITC)',
    details: 'Enter ITC from (A) Import of goods, (B) Import of services, (C) Inward supplies on reverse charge, (D) ITC from ISD, (E) All other ITC. Use your FreeGSTBill Expenses GST total for eligible ITC in row (E). Also enter ITC reversed and net ITC available.',
  },
  {
    title: 'Table 5 — Exempt & Non-GST Supplies',
    details: 'Enter exempt, nil-rated, and non-GST inward supplies. Split by inter-state and intra-state.',
  },
  {
    title: 'Table 6 — Payment of Tax',
    details: 'Tax payable = Output tax (Table 3.1) minus ITC (Table 4). Pay via Electronic Cash Ledger or Electronic Credit Ledger. If ITC covers the liability, no cash payment is needed. Any excess ITC carries forward.',
  },
  {
    title: 'Preview, Submit & Pay',
    details: 'Preview → Submit (freezes data) → "Make Payment / Post Credit to Ledger" → Create Challan if cash payment is needed → File with DSC or EVC.',
  },
];

const NIL_RETURN_STEPS = [
  {
    title: 'Check if NIL Return Applies',
    details: 'You can file a NIL return if: (1) No outward supplies (sales) during the period, (2) No inward supplies on reverse charge, (3) No ITC to claim, (4) No tax liability. If any of these have values, you must file a regular return.',
  },
  {
    title: 'File NIL GSTR-1',
    details: 'Login → Returns → GSTR-1 → Select period → Click "Prepare Online" → Since there are no invoices, all tables will be empty → Click "Submit" → Click "File NIL GSTR-1" → Authenticate with DSC or EVC.',
  },
  {
    title: 'File NIL GSTR-3B',
    details: 'Login → Returns → GSTR-3B → Select period → Click "Prepare Online" → All values will be zero → Click "Submit" → Click "File NIL GSTR-3B" → No payment required → Authenticate with DSC or EVC.',
  },
];

function StepList({ steps, title }) {
  const [expanded, setExpanded] = useState({});
  const [checked, setChecked] = useState({});

  const toggle = (i) => setExpanded(prev => ({ ...prev, [i]: !prev[i] }));
  const check = (i) => setChecked(prev => ({ ...prev, [i]: !prev[i] }));

  return (
    <div className="glass-panel mb-6">
      <div className="table-header"><h3>{title}</h3></div>
      <div style={{ padding: '0.5rem 0' }}>
        {steps.map((step, i) => (
          <div key={i} style={{ borderBottom: i < steps.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1.5rem',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              onClick={() => toggle(i)}
            >
              <button
                className="icon-btn"
                onClick={(e) => { e.stopPropagation(); check(i); }}
                style={{
                  color: checked[i] ? '#059669' : 'var(--text-muted)',
                  background: checked[i] ? '#ecfdf5' : 'transparent',
                  width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <CheckCircle size={18} />
              </button>
              <span style={{
                flex: 1, fontWeight: 600, fontSize: '0.9rem',
                color: checked[i] ? '#059669' : 'var(--text)',
                textDecoration: checked[i] ? 'line-through' : 'none',
              }}>
                Step {i + 1}: {step.title}
              </span>
              {expanded[i] ? <ChevronDown size={16} color="var(--text-muted)" /> : <ChevronRight size={16} color="var(--text-muted)" />}
            </div>
            {expanded[i] && (
              <div style={{
                padding: '0 1.5rem 1rem 3.75rem', fontSize: '0.85rem',
                color: 'var(--text-secondary)', lineHeight: 1.7,
              }}>
                {step.details}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GSTFilingGuide() {
  const [activeTab, setActiveTab] = useState('gstr1');

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">GST Filing Guide</h1>
          <p className="page-subtitle">Step-by-step instructions to file your GST returns on the portal</p>
        </div>
        <a href="https://gst.gov.in" target="_blank" rel="noopener noreferrer" className="btn btn-primary">
          <ExternalLink size={16} /> Open GST Portal
        </a>
      </div>

      {/* Important Note */}
      <div className="glass-panel p-6 mb-6" style={{ borderLeft: '4px solid var(--primary)' }}>
        <h4 style={{ marginBottom: '0.5rem', fontSize: '0.95rem' }}>Before You Start</h4>
        <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: '1.25rem' }}>
          <li><strong>GSTR-1</strong> (Sales return) is due by <strong>11th of next month</strong> (monthly) or <strong>13th of month after quarter</strong> (QRMP)</li>
          <li><strong>GSTR-3B</strong> (Summary return + payment) is due by <strong>20th of next month</strong> (monthly) or <strong>22nd/24th of month after quarter</strong> (QRMP)</li>
          <li>File GSTR-1 <strong>before</strong> GSTR-3B — your GSTR-3B Table 3 is auto-populated from GSTR-1</li>
          <li>Use your <strong>GST Reports</strong> page in FreeGSTBill to get all the numbers you need</li>
          <li>Keep your <strong>Expenses</strong> data handy for ITC (Input Tax Credit) in GSTR-3B Table 4</li>
          <li>Late filing attracts <strong>₹50/day</strong> (₹20/day for NIL) penalty + interest at 18% p.a.</li>
        </ul>
      </div>

      {/* Tab Selector */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {[
          { id: 'gstr1', label: 'GSTR-1 Filing' },
          { id: 'gstr3b', label: 'GSTR-3B Filing' },
          { id: 'nil', label: 'NIL Return' },
        ].map(tab => (
          <button key={tab.id}
            className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab(tab.id)}>
            <BookOpen size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'gstr1' && (
        <>
          <StepList steps={GSTR1_STEPS} title="GSTR-1 — Outward Supplies (Sales Return)" />
          <div className="glass-panel p-6" style={{ background: '#f0fdf4' }}>
            <h4 style={{ color: '#059669', marginBottom: '0.5rem' }}>Tips for GSTR-1</h4>
            <ul style={{ fontSize: '0.85rem', color: '#047857', lineHeight: 1.8, paddingLeft: '1.25rem' }}>
              <li>Use FreeGSTBill's "B2B CSV" export — it matches the GST portal format</li>
              <li>Credit notes appear in Table 9B with negative values</li>
              <li>Amendments to previous period invoices go in Table 9A</li>
              <li>If turnover {"<"} ₹5 Cr, you can opt for QRMP scheme (quarterly filing)</li>
              <li>Use the offline tool if you have more than 500 invoices per month</li>
            </ul>
          </div>
        </>
      )}

      {activeTab === 'gstr3b' && (
        <>
          <StepList steps={GSTR3B_STEPS} title="GSTR-3B — Summary Return + Tax Payment" />
          <div className="glass-panel p-6" style={{ background: '#eff6ff' }}>
            <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Tips for GSTR-3B</h4>
            <ul style={{ fontSize: '0.85rem', color: '#1e40af', lineHeight: 1.8, paddingLeft: '1.25rem' }}>
              <li>From July 2025, Table 3 is auto-populated from GSTR-1 — verify, don't re-enter</li>
              <li>ITC is only allowed if the supplier has also filed their GSTR-1 (GSTR-2B matching)</li>
              <li>Track your ITC in FreeGSTBill's Expense Tracker — enter vendor GSTIN for eligible claims</li>
              <li>Use Electronic Credit Ledger first, then pay remaining via cash challan</li>
              <li>Set aside GST money monthly — don't wait for the due date</li>
            </ul>
          </div>
        </>
      )}

      {activeTab === 'nil' && (
        <>
          <StepList steps={NIL_RETURN_STEPS} title="NIL Return — No Activity Period" />
          <div className="glass-panel p-6" style={{ background: '#fefce8' }}>
            <h4 style={{ color: '#a16207', marginBottom: '0.5rem' }}>Important</h4>
            <ul style={{ fontSize: '0.85rem', color: '#92400e', lineHeight: 1.8, paddingLeft: '1.25rem' }}>
              <li>You <strong>must</strong> file NIL returns even if there is zero activity — skipping leads to penalties</li>
              <li>After 6 months of not filing, your GSTIN can be cancelled by the department</li>
              <li>NIL GSTR-1 and NIL GSTR-3B are separate — file both</li>
              <li>Late fee for NIL return: ₹20/day (₹10 CGST + ₹10 SGST), max ₹500 per return</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
