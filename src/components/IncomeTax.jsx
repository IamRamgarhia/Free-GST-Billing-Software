import { useState, useEffect, useMemo } from 'react';
import { Calculator, Landmark, FileText, TrendingUp, Upload, Save, Info, Check, X, ChevronRight } from 'lucide-react';
import { getAllBills, getAllExpenses, getAllPurchases, getProfile } from '../store';
import { formatCurrency } from '../utils';
import {
  compareRegimes,
  parseBankStatement,
  AUTO_CATEGORY_RULES,
  DEDUCTION_CAPS,
} from '../utils/itr.js';
import { toast } from './Toast';

// The Income Tax module has three sub-tabs. Keeping them in one file (rather
// than three separate route components) keeps state co-located — the Regime
// Calculator can see income figures picked up from the Bank Statement
// Import tab, for instance, without going through a global store.
const TABS = [
  { key: 'calculator', label: 'Regime Calculator', icon: Calculator, help: 'Compare Old vs New (Section 115BAC) — auto-picks the cheaper regime' },
  { key: 'bank',       label: 'Bank Statement Import', icon: Upload, help: 'Upload SBI / HDFC / ICICI / Axis / Kotak / PNB / Yes Bank CSV — auto-categorises' },
  { key: 'summary',    label: 'ITR Summary',    icon: FileText, help: 'Consolidated view of income, expenses, deductions, and tax' },
];

// FY 2024-25 (AY 2025-26) is the assessment year the app targets. The tax
// slabs in utils/itr.js are locked to this year. When India ships a new
// budget we'll bump both the label and the constants.
const CURRENT_FY = '2024-25';
const CURRENT_AY = '2025-26';

export default function IncomeTax() {
  const [tab, setTab] = useState('calculator');
  const [bills, setBills] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [profile, setProfile] = useState({});

  // Regime-calculator inputs — persist to localStorage so a returning user
  // doesn't have to re-enter their Form-16 salary + deductions every time
  // they open the tab. Reset button provided.
  const [inputs, setInputs] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('gst_itrCalcInputs') || '{}');
      return { ...defaultInputs(), ...saved };
    } catch { return defaultInputs(); }
  });

  const [bankImport, setBankImport] = useState({ bankName: '', transactions: [] });

  useEffect(() => {
    Promise.all([
      getAllBills().catch(() => []),
      getAllExpenses().catch(() => []),
      getAllPurchases().catch(() => []),
      getProfile().catch(() => ({})),
    ]).then(([b, e, p, prof]) => {
      setBills(b); setExpenses(e); setPurchases(p); setProfile(prof);
    });
  }, []);

  // Prefill Business Income from the app's own sales - purchases - expenses
  // for the current FY. Users can override; this just saves them typing on
  // first use. Only fires when their manual entry is still 0.
  useEffect(() => {
    if (!bills.length && !purchases.length) return;
    if (Number(inputs.businessIncome) > 0) return;
    const inFY = (dateStr) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
      return `${y}-${String(y + 1).slice(-2)}` === CURRENT_FY;
    };
    const sales = bills.filter(b => inFY(b.invoiceDate)).reduce((s, b) => s + (Number(b.totalAmount) || 0), 0);
    const cogs  = purchases.filter(p => inFY(p.date)).reduce((s, p) => s + (Number(p.totalAmount) || 0), 0);
    const exps  = expenses.filter(e => inFY(e.date))
                          .filter(e => e.category !== 'Personal / Drawings' && e.category !== 'Asset Purchase')
                          .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const estimated = Math.max(0, sales - cogs - exps);
    if (estimated > 0) {
      setInputs(prev => ({ ...prev, businessIncome: Math.round(estimated), _autofillHint: true }));
    }
  }, [bills, purchases, expenses]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save calculator inputs whenever they change
  useEffect(() => {
    try {
      const { _autofillHint, ...persist } = inputs; void _autofillHint;
      localStorage.setItem('gst_itrCalcInputs', JSON.stringify(persist));
    } catch { /* localStorage full — surface via existing quota toast */ }
  }, [inputs]);

  // Regime comparison recomputes live from inputs. `compareRegimes` runs both
  // scenarios and picks the cheaper. Rendered whether or not the user has
  // filled anything — a zero-input result is still useful.
  const comparison = useMemo(() => compareRegimes(inputs), [inputs]);

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Income Tax Helper</h1>
          <p className="page-subtitle">FY {CURRENT_FY} · AY {CURRENT_AY} — Old vs New Regime, bank-statement import, ITR summary</p>
        </div>
      </div>

      {/* Sub-tab strip */}
      <div className="glass-panel" style={{ padding: '0.5rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.key}
              className={`btn ${tab === t.key ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.85rem' }}
              onClick={() => setTab(t.key)}
              title={t.help}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'calculator' && (
        <RegimeCalculatorTab
          inputs={inputs}
          setInputs={setInputs}
          comparison={comparison}
          onReset={() => setInputs(defaultInputs())}
        />
      )}

      {tab === 'bank' && (
        <BankImportTab
          bankImport={bankImport}
          setBankImport={setBankImport}
          onCommit={(totals) => {
            // Piping the categorised totals into the calculator — user
            // switches to the Calculator tab and their income + interest
            // + rent are pre-filled.
            setInputs(prev => ({
              ...prev,
              businessIncome: (prev.businessIncome || 0) + (totals.business_in || 0),
              otherSources: (prev.otherSources || 0) + (totals.interest || 0),
              // house-property income is rent - 30% standard deduction (§24a) - loan interest
              housePropertyIncome: Math.max(0, ((prev.housePropertyIncome || 0) + (totals.rent_received || 0) * 0.7)),
              deductions: {
                ...prev.deductions,
                '80C':   (Number(prev.deductions?.['80C'])  || 0) + (totals.deduction_80C || 0),
                '80D':   (Number(prev.deductions?.['80D'])  || 0) + (totals.deduction_80D || 0),
                '80TTA': Math.min(10_000, (Number(prev.deductions?.['80TTA']) || 0) + (totals.interest || 0)),
              },
            }));
            setTab('calculator');
            toast('Numbers pushed to Regime Calculator', 'success');
          }}
        />
      )}

      {tab === 'summary' && (
        <SummaryTab
          bills={bills}
          expenses={expenses}
          purchases={purchases}
          profile={profile}
          comparison={comparison}
          inputs={inputs}
          fy={CURRENT_FY}
        />
      )}
    </div>
  );
}

// ============================================================================
// Regime Calculator sub-tab
// ============================================================================
function RegimeCalculatorTab({ inputs, setInputs, comparison, onReset }) {
  const set = (patch) => setInputs(prev => ({ ...prev, ...patch }));
  const setDed = (section, val) => setInputs(prev => ({
    ...prev,
    deductions: { ...prev.deductions, [section]: val },
  }));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
      {/* Left column: inputs */}
      <div className="glass-panel p-4">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 className="section-title" style={{ margin: 0 }}>Your income</h3>
          <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }} onClick={onReset}>
            <X size={14} /> Reset
          </button>
        </div>

        <NumberInput label="Gross Salary (Form 16 box 1)" hint="Enter zero if you don't have salary income. Standard Deduction is applied automatically." value={inputs.salary} onChange={v => set({ salary: v })} />
        <NumberInput label="Business / Professional Income" hint={inputs._autofillHint ? '✨ Auto-filled from your invoices minus purchases + expenses this FY. Override if needed.' : 'Net profit from your books.'} value={inputs.businessIncome} onChange={v => set({ businessIncome: v, _autofillHint: false })} />
        <NumberInput label="House Property (rent received)" hint="Enter net income AFTER 30% standard deduction and home-loan interest §24(b)." value={inputs.housePropertyIncome} onChange={v => set({ housePropertyIncome: v })} />
        <NumberInput label="Other Sources (bank interest, dividends, etc.)" hint="Includes savings-account interest; 80TTA claims that separately." value={inputs.otherSources} onChange={v => set({ otherSources: v })} />

        <h4 style={{ marginTop: '1rem', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Capital gains (special rates)</h4>
        <NumberInput label="STCG on listed equity (§111A)" hint="Taxed flat at 15%. Excludes debt / property STCG (those go into slab)." value={inputs.stcgAtSpecialRate} onChange={v => set({ stcgAtSpecialRate: v })} />
        <NumberInput label="LTCG on listed equity (§112A)" hint="₹1L exempt; balance taxed flat at 10%." value={inputs.ltcgAtSpecialRate} onChange={v => set({ ltcgAtSpecialRate: v })} />

        <h4 style={{ marginTop: '1rem', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Deductions (Old Regime only)</h4>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 0, marginBottom: '0.5rem' }}>
          Under New Regime (default from FY 2023-24), only Section 80CCD(2) — employer NPS contribution — is allowed.
          These deductions ONLY reduce your Old-Regime tax.
        </p>
        {Object.entries(DEDUCTION_CAPS).map(([section, cap]) => (
          <NumberInput key={section}
            label={`§${section}`}
            hint={`Cap: ${cap === Infinity ? 'No cap' : formatCurrency(cap)} · ${SECTION_DESCRIPTIONS[section] || ''}`}
            value={inputs.deductions?.[section] || 0}
            onChange={v => setDed(section, v)} />
        ))}
        <NumberInput label="§80CCD(2) — employer NPS" hint="Allowed under BOTH regimes. Typically 10% of salary (14% for govt)." value={inputs.deductions?.['80CCD2'] || 0} onChange={v => setDed('80CCD2', v)} />
      </div>

      {/* Right column: side-by-side comparison */}
      <div>
        <div className="glass-panel p-4" style={{ marginBottom: '1rem' }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>
            Recommended: <span style={{ color: comparison.recommended === 'new' ? '#059669' : '#8b5cf6', textTransform: 'uppercase' }}>{comparison.recommended} Regime</span>
          </h3>
          <p style={{ fontSize: '0.85rem', margin: '0 0 0.75rem 0' }}>
            Saves you <strong>{formatCurrency(comparison.savings)}</strong> compared to the other regime.
            {comparison.recommended === 'new' && ' (New Regime is the default — you don\'t need to elect anything.)'}
            {comparison.recommended === 'old' && ' (You must file Form 10-IEA before the due date to elect Old Regime.)'}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <RegimeCard title="Old Regime" result={comparison.old} highlighted={comparison.recommended === 'old'} color="#8b5cf6" />
          <RegimeCard title="New Regime" result={comparison.new} highlighted={comparison.recommended === 'new'} color="#059669" />
        </div>

        <div className="glass-panel p-4" style={{ marginTop: '1rem', fontSize: '0.8rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <Info size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--primary)' }} />
            <div>
              <strong>How this is computed:</strong> slabs → §87A rebate → surcharge (income &gt; ₹50L) → 4% Health &amp; Ed Cess.
              STCG (§111A) at 15%, LTCG (§112A) at 10% over ₹1L exempt.
              Numbers auto-save; refresh the page and they persist.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RegimeCard({ title, result, highlighted, color }) {
  return (
    <div className="glass-panel p-4" style={{
      border: highlighted ? `2px solid ${color}` : '1px solid var(--border)',
      background: highlighted ? `${color}15` : undefined,
    }}>
      <h4 style={{ margin: 0, marginBottom: '0.5rem', color }}>{title}</h4>
      <Row label="Gross Total Income" value={result.grossTotalIncome} />
      <Row label="Standard Deduction" value={-result.standardDeduction} muted={!result.standardDeduction} />
      <Row label="Chapter VI-A" value={-result.allowedDeductions} muted={!result.allowedDeductions} />
      <Row label="Taxable Income" value={result.taxableIncome} bold />
      <hr style={{ opacity: 0.2, margin: '0.5rem 0' }} />
      <Row label="Slab Tax" value={result.slabTax} />
      {(result.stcgTax > 0 || result.ltcgTax > 0) && (
        <>
          <Row label="STCG (15%)" value={result.stcgTax} muted={!result.stcgTax} />
          <Row label="LTCG (10%)" value={result.ltcgTax} muted={!result.ltcgTax} />
        </>
      )}
      {result.rebate87A > 0 && <Row label="§87A Rebate" value={-result.rebate87A} />}
      {result.surcharge > 0 && <Row label="Surcharge" value={result.surcharge} />}
      <Row label="Health & Ed Cess (4%)" value={result.cess} />
      <hr style={{ opacity: 0.2, margin: '0.5rem 0' }} />
      <Row label="Total Tax" value={result.totalTax} bold big />
    </div>
  );
}

function Row({ label, value, bold, big, muted }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      fontSize: big ? '1rem' : '0.8rem',
      fontWeight: bold ? 700 : 400,
      marginBottom: 2,
      opacity: muted ? 0.5 : 1,
    }}>
      <span>{label}</span>
      <span style={{ fontFamily: 'monospace' }}>{formatCurrency(value)}</span>
    </div>
  );
}

function NumberInput({ label, hint, value, onChange }) {
  return (
    <div style={{ marginBottom: '0.6rem' }}>
      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: 2 }}>{label}</label>
      <input type="number" className="form-input"
        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
        value={value || ''} min="0" step="any"
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        placeholder="0" />
      {hint && <p style={{ margin: '2px 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
  );
}

// ============================================================================
// Bank Statement Import sub-tab
// ============================================================================
function BankImportTab({ bankImport, setBankImport, onCommit }) {
  const [dragActive, setDragActive] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseBankStatement(text);
      if (!parsed.transactions.length) {
        toast('No transactions found. Try uploading a raw CSV from your bank\'s statement download.', 'warning');
        return;
      }
      setBankImport(parsed);
      toast(`Parsed ${parsed.transactions.length} transactions from ${parsed.bankName}`, 'success');
    } catch (e) {
      toast('Could not parse this CSV. Supported banks: SBI, HDFC, ICICI, Axis, Kotak, PNB, Yes Bank.', 'error');
    }
  };

  const changeCategory = (idx, category) => {
    setBankImport(prev => ({
      ...prev,
      transactions: prev.transactions.map((t, i) => i === idx ? { ...t, category } : t),
    }));
  };

  const totals = useMemo(() => {
    const t = {};
    (bankImport.transactions || []).forEach(row => {
      const amt = (row.credit || 0) > 0 ? row.credit : (row.debit || 0);
      t[row.category] = (t[row.category] || 0) + amt;
    });
    return t;
  }, [bankImport]);

  if (!bankImport.transactions.length) {
    return (
      <div className="glass-panel p-6">
        <div
          onDragEnter={e => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault(); setDragActive(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          style={{
            border: `2px dashed ${dragActive ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: 12,
            padding: '3rem 1rem',
            textAlign: 'center',
            background: dragActive ? 'rgba(30, 64, 175, 0.05)' : undefined,
            cursor: 'pointer',
          }}
          onClick={() => document.getElementById('bank-csv-input')?.click()}>
          <Upload size={40} style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
          <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Drop a bank-statement CSV here or click to select</p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Auto-detects: SBI · HDFC · ICICI · Axis · Kotak · PNB · Yes Bank
          </p>
          <input id="bank-csv-input" type="file" accept=".csv,text/csv" style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files?.[0])} />
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>How to get the CSV</h4>
          <ul style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.7, margin: 0, paddingLeft: '1.2rem' }}>
            <li><strong>Net-banking</strong> → Accounts → Statements → Download as CSV / Excel (save as CSV)</li>
            <li><strong>Mobile app</strong> → Account statement → Share → Export CSV</li>
            <li>Choose a date range covering the current FY (1 Apr {parseInt(CURRENT_FY.split('-')[0], 10)} onwards)</li>
            <li>Your data is parsed in-browser — nothing is uploaded to a server</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="glass-panel p-4" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 className="section-title" style={{ margin: 0 }}>{bankImport.bankName} — {bankImport.transactions.length} transactions</h3>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Review each row's category. Auto-categorised — override any you disagree with.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => setBankImport({ bankName: '', transactions: [] })}>
            <X size={16} /> Clear
          </button>
          <button className="btn btn-primary" onClick={() => onCommit(totals)}>
            <ChevronRight size={16} /> Push to Calculator
          </button>
        </div>
      </div>

      {/* Category totals strip */}
      <div className="glass-panel p-3" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.82rem' }}>
        {Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
          <span key={cat} style={{ background: CATEGORY_COLORS[cat] || '#e2e8f0', padding: '0.25rem 0.6rem', borderRadius: 4 }}>
            <strong>{CATEGORY_LABELS[cat] || cat}:</strong> {formatCurrency(amt)}
          </span>
        ))}
      </div>

      {/* Transactions grid */}
      <div className="glass-panel" style={{ overflow: 'auto', maxHeight: '60vh' }}>
        <table className="data-table" style={{ minWidth: '900px' }}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th style={{ textAlign: 'right' }}>Debit</th>
              <th style={{ textAlign: 'right' }}>Credit</th>
              <th>Category</th>
            </tr>
          </thead>
          <tbody>
            {bankImport.transactions.map((row, idx) => (
              <tr key={idx}>
                <td className="text-muted" style={{ fontSize: '0.78rem' }}>{row.date}</td>
                <td style={{ maxWidth: '350px', fontSize: '0.78rem' }} title={row.description}>{row.description}</td>
                <td style={{ textAlign: 'right', color: '#dc2626', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                  {row.debit ? formatCurrency(row.debit) : '-'}
                </td>
                <td style={{ textAlign: 'right', color: '#059669', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                  {row.credit ? formatCurrency(row.credit) : '-'}
                </td>
                <td>
                  <select value={row.category} onChange={e => changeCategory(idx, e.target.value)}
                    className="form-input" style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem', width: 'auto' }}>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ============================================================================
// ITR Summary sub-tab — consolidated snapshot
// ============================================================================
function SummaryTab({ bills, expenses, purchases, profile, comparison, inputs, fy }) {
  const inFY = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
    return `${y}-${String(y + 1).slice(-2)}` === fy;
  };

  const fyBills = bills.filter(b => inFY(b.invoiceDate));
  const fyExpenses = expenses.filter(e => inFY(e.date));
  const fyPurchases = purchases.filter(p => inFY(p.date));

  const sales = fyBills.reduce((s, b) => s + (Number(b.totalAmount) || 0), 0);
  const businessExpenses = fyExpenses.filter(e => e.category !== 'Personal / Drawings' && e.category !== 'Asset Purchase').reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const trading = fyPurchases.reduce((s, p) => s + (Number(p.totalAmount) || 0), 0);
  const assets = fyExpenses.filter(e => e.category === 'Asset Purchase').reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const netBusiness = Math.max(0, sales - trading - businessExpenses);

  // Presumptive threshold check (Section 44AD — up to ₹2Cr turnover)
  const under44ADEligible = sales < 20_000_000 && (profile?.businessType || '').toLowerCase() !== 'professional';

  return (
    <>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1rem' }}>
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue"><TrendingUp size={22} /></div>
          <div><p className="stat-label">Sales (FY {fy})</p><h2 className="stat-value">{formatCurrency(sales)}</h2></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-purple"><Landmark size={22} /></div>
          <div><p className="stat-label">Trading Purchases</p><h2 className="stat-value">{formatCurrency(trading)}</h2></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-green"><FileText size={22} /></div>
          <div><p className="stat-label">Business Expenses</p><h2 className="stat-value">{formatCurrency(businessExpenses)}</h2></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-red"><Calculator size={22} /></div>
          <div><p className="stat-label">Net Business Income</p><h2 className="stat-value">{formatCurrency(netBusiness)}</h2></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="glass-panel p-4">
          <h3 className="section-title">Income breakdown</h3>
          <Row label="Sales / Turnover" value={sales} />
          <Row label="Less: Trading purchases" value={-trading} />
          <Row label="Less: Business expenses" value={-businessExpenses} />
          <Row label="= Net business income" value={netBusiness} bold />
          <Row label="+ Salary declared" value={Number(inputs.salary) || 0} muted={!inputs.salary} />
          <Row label="+ Rent received" value={Number(inputs.housePropertyIncome) || 0} muted={!inputs.housePropertyIncome} />
          <Row label="+ Other sources" value={Number(inputs.otherSources) || 0} muted={!inputs.otherSources} />
          <Row label="+ Capital gains (STCG + LTCG)" value={(Number(inputs.stcgAtSpecialRate) || 0) + (Number(inputs.ltcgAtSpecialRate) || 0)} muted={!inputs.stcgAtSpecialRate && !inputs.ltcgAtSpecialRate} />

          {assets > 0 && (
            <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: 'var(--warn-bg, #fffbeb)', borderRadius: 6, fontSize: '0.78rem' }}>
              <strong>Note:</strong> {formatCurrency(assets)} in Asset Purchases isn't deducted here.
              Assets are capitalised then depreciated under §32 — enter depreciation as a business expense
              in the year it's claimed (not the year of purchase).
            </div>
          )}
        </div>

        <div className="glass-panel p-4">
          <h3 className="section-title">Tax snapshot</h3>
          <p style={{ fontSize: '0.85rem', margin: '0 0 0.5rem 0' }}>
            Recommended regime: <strong style={{ color: comparison.recommended === 'new' ? '#059669' : '#8b5cf6', textTransform: 'uppercase' }}>{comparison.recommended}</strong>
          </p>
          <Row label={`Tax under ${comparison.recommended.toUpperCase()} Regime`} value={comparison[comparison.recommended].totalTax} bold big />
          <Row label="Tax under other regime" value={comparison[comparison.recommended === 'new' ? 'old' : 'new'].totalTax} muted />
          <Row label="You save vs other regime" value={comparison.savings} />

          <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: 6, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {under44ADEligible && (
              <>
                <strong>💡 You may qualify for Section 44AD presumptive taxation.</strong> If your turnover is under ₹2Cr,
                you can declare 6% (digital receipts) or 8% (cash) of turnover as income and skip maintaining full books.
                File ITR-4 (Sugam) if you opt in.
                <br /><br />
              </>
            )}
            Filing due date: <strong>31 July {parseInt(fy.split('-')[1], 10) + 2000}</strong> (non-audit) ·
            <strong> 31 October {parseInt(fy.split('-')[1], 10) + 2000}</strong> (audit / §44AB).
            Advance tax installments: 15 Jun · 15 Sep · 15 Dec · 15 Mar.
          </div>
        </div>
      </div>

      <div className="glass-panel p-4" style={{ marginTop: '1rem' }}>
        <h3 className="section-title">Coming soon in v1.8.0</h3>
        <ul style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, paddingLeft: '1.2rem', lineHeight: 1.7 }}>
          <li><strong>Full deductions manager</strong> — 80C / 80D / 80TTA / 80CCD with document upload</li>
          <li><strong>Presumptive taxation module</strong> — Section 44AD / 44ADA / 44AE</li>
          <li><strong>Advance tax calculator</strong> with due-date reminders</li>
          <li><strong>ITR-4 (Sugam) Filing Summary PDF</strong> — every field pre-filled with the amount + source</li>
          <li><strong>Form 26AS reconciliation</strong> — upload TDS certificate, cross-check</li>
        </ul>
      </div>
    </>
  );
}

// ============================================================================
// Constants + helpers
// ============================================================================
function defaultInputs() {
  return {
    salary: 0,
    businessIncome: 0,
    housePropertyIncome: 0,
    otherSources: 0,
    stcgAtSpecialRate: 0,
    ltcgAtSpecialRate: 0,
    deductions: {
      '80C': 0, '80CCD1B': 0, '80D': 0, '80TTA': 0, '80TTB': 0,
      '80E': 0, '80G': 0, '80GG': 0, '80DDB': 0, '80U': 0,
      '24b': 0, '80CCD2': 0,
    },
    regime: 'new',
  };
}

const SECTION_DESCRIPTIONS = {
  '80C':     'PPF · ELSS · LIC · EPF · tuition · home-loan principal · NSC',
  '80CCD1B': 'Additional NPS (self)',
  '80D':     'Health insurance (self + family + parents)',
  '80TTA':   'Savings-account interest (< 60 yrs)',
  '80TTB':   'Bank / PO deposit interest (senior citizens)',
  '80E':     'Education-loan interest — no cap, 8 years',
  '80G':     'Donations to approved funds',
  '80GG':    'Rent paid when HRA is not received',
  '80DDB':   'Specified serious illness',
  '80U':     'Self-disability',
  '24b':     'Home-loan interest (self-occupied)',
};

const CATEGORY_LABELS = {
  salary: 'Salary income',
  business_in: 'Business receipts',
  business_out: 'Business expense',
  interest: 'Interest earned',
  rent_received: 'Rent received',
  investment: 'Investment / MF / PPF',
  deduction_80C: '80C claim',
  deduction_80D: '80D claim',
  gst_paid: 'GST paid',
  transfer: 'Transfer / unclassified',
  personal: 'Personal spending',
};

const CATEGORY_COLORS = {
  salary: '#dbeafe',
  business_in: '#dcfce7',
  business_out: '#fee2e2',
  interest: '#e0f2fe',
  rent_received: '#f3e8ff',
  investment: '#fef3c7',
  deduction_80C: '#ccfbf1',
  deduction_80D: '#ccfbf1',
  gst_paid: '#fed7aa',
  transfer: '#e2e8f0',
  personal: '#fce7f3',
};
