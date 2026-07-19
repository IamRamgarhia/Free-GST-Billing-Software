import { useState, useEffect, useMemo } from 'react';
import { Calculator, Landmark, FileText, TrendingUp, Upload, Info, Check, X, ChevronRight, Briefcase, Clock, Download } from 'lucide-react';
import { getAllBills, getAllExpenses, getAllPurchases, getProfile } from '../store';
import { formatCurrency } from '../utils';
import { getPrintSettings } from '../utils/printSettings';

// v1.10.31 — Parse the user's chosen PDF accent (hex like "#1e40af") into
// a [r, g, b] tuple for jsPDF's setFillColor / setDrawColor. Falls back to
// the historical Tailwind blue-900 (30,64,175) when the setting is empty or
// the user has explicitly disabled custom colors. Kept local to IncomeTax
// so the module has no runtime cost when the ITR PDF isn't generated.
function getAccentRGB() {
  try {
    const s = getPrintSettings();
    if (!s?.userColorsEnabled) return [30, 64, 175];
    const hex = String(s.pdfAccent || '').replace('#', '');
    if (hex.length !== 6) return [30, 64, 175];
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if ([r, g, b].some(v => !Number.isFinite(v))) return [30, 64, 175];
    return [r, g, b];
  } catch { return [30, 64, 175]; }
}
import {
  compareRegimes,
  computeTax,
  parseBankStatement,
  AUTO_CATEGORY_RULES,
  DEDUCTION_CAPS,
  compute44AD,
  compute44ADA,
  compute44AE,
  computeAdvanceTaxSchedule,
  compute234BInterest,
  compute234CInterest,
  ADVANCE_TAX_SCHEDULE,
  buildITR4FieldMap,
} from '../utils/itr.js';
import { toast } from './Toast';

// The Income Tax module has three sub-tabs. Keeping them in one file (rather
// than three separate route components) keeps state co-located — the Regime
// Calculator can see income figures picked up from the Bank Statement
// Import tab, for instance, without going through a global store.
const TABS = [
  { key: 'calculator', label: 'Regime Calculator', icon: Calculator, help: 'Compare Old vs New (Section 115BAC) — auto-picks the cheaper regime' },
  { key: 'presumptive', label: 'Presumptive (§44AD/ADA)', icon: Briefcase, help: 'Skip full books — declare 6/8% (business) or 50% (professional) of turnover' },
  { key: 'advance',    label: 'Advance Tax',       icon: Clock,    help: 'Four installment schedule with §234B/C interest calculation' },
  { key: 'bank',       label: 'Bank Statement Import', icon: Upload, help: 'Upload SBI / HDFC / ICICI / Axis / Kotak / PNB / Yes Bank CSV — auto-categorises' },
  { key: 'summary',    label: 'ITR Summary',    icon: FileText, help: 'Consolidated view + ITR-4 Filing Summary PDF' },
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

  // Presumptive taxation state — separate from Regime Calculator inputs
  // because the flow is different: user comes in either wanting to check
  // eligibility, OR to commit to presumptive filing for the year.
  // Persisted separately to localStorage.
  const [presumptiveInputs, setPresumptiveInputs] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('gst_itrPresumptive') || '{}');
      return {
        section: '44AD',
        digitalReceipts: 0, cashReceipts: 0, declaredIncome: 0,
        heavyVehicleMonths: 0, heavyVehicleTonnage: 12, lightVehicleMonths: 0,
        ...saved,
      };
    } catch { return { section: '44AD', digitalReceipts: 0, cashReceipts: 0, declaredIncome: 0, heavyVehicleMonths: 0, heavyVehicleTonnage: 12, lightVehicleMonths: 0 }; }
  });

  // Advance Tax state — TDS credit + payments made so far
  const [advanceInputs, setAdvanceInputs] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('gst_itrAdvanceTax') || '{}');
      return { tdsCredit: 0, payments: [], mode: 'regular', ...saved };
    } catch { return { tdsCredit: 0, payments: [], mode: 'regular' }; }
  });

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

  useEffect(() => {
    try { localStorage.setItem('gst_itrPresumptive', JSON.stringify(presumptiveInputs)); } catch { /* ignore */ }
  }, [presumptiveInputs]);
  useEffect(() => {
    try { localStorage.setItem('gst_itrAdvanceTax', JSON.stringify(advanceInputs)); } catch { /* ignore */ }
  }, [advanceInputs]);

  // Presumptive result — recomputes when the section or inputs change
  const presumptive = useMemo(() => {
    if (presumptiveInputs.section === '44AD') return compute44AD(presumptiveInputs);
    if (presumptiveInputs.section === '44ADA') return compute44ADA(presumptiveInputs);
    if (presumptiveInputs.section === '44AE') return compute44AE(presumptiveInputs);
    return null;
  }, [presumptiveInputs]);

  // Regime comparison recomputes live from inputs. `compareRegimes` runs both
  // scenarios and picks the cheaper. Rendered whether or not the user has
  // filled anything — a zero-input result is still useful.
  //
  // MUST be declared BEFORE advanceSchedule below — v1.8.1 had this reversed,
  // causing a TDZ ReferenceError that blanked the whole Income Tax view.
  const comparison = useMemo(() => compareRegimes(inputs), [inputs]);

  // Advance-tax schedule — depends on the total tax under the RECOMMENDED regime.
  // Defensive: if comparison hasn't yielded a valid shape yet (first render
  // race), fall back to a zero-tax schedule so the Advance Tax tab still
  // renders instead of crashing.
  const advanceSchedule = useMemo(() => {
    const recTotal = comparison?.[comparison?.recommended]?.totalTax ?? 0;
    return computeAdvanceTaxSchedule(
      recTotal,
      advanceInputs.tdsCredit,
      advanceInputs.payments,
      advanceInputs.mode
    );
  }, [comparison, advanceInputs]);

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

      {tab === 'presumptive' && (
        <PresumptiveTab
          presumptiveInputs={presumptiveInputs}
          setPresumptiveInputs={setPresumptiveInputs}
          presumptive={presumptive}
          onPushToCalculator={() => {
            if (!presumptive) return;
            setInputs(prev => ({ ...prev, businessIncome: presumptive.presumptiveIncome }));
            setTab('calculator');
            toast(`Presumptive income of ${formatCurrency(presumptive.presumptiveIncome)} pushed to calculator`, 'success');
          }}
        />
      )}

      {tab === 'advance' && (
        <AdvanceTaxTab
          advanceInputs={advanceInputs}
          setAdvanceInputs={setAdvanceInputs}
          schedule={advanceSchedule}
          totalTax={comparison[comparison.recommended].totalTax}
          recommended={comparison.recommended}
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
          presumptive={presumptive}
          advanceSchedule={advanceSchedule}
          fy={CURRENT_FY}
          ay={CURRENT_AY}
        />
      )}
    </div>
  );
}

// ============================================================================
// Presumptive Income sub-tab (§44AD / §44ADA / §44AE)
// ============================================================================
function PresumptiveTab({ presumptiveInputs, setPresumptiveInputs, presumptive, onPushToCalculator }) {
  const set = (patch) => setPresumptiveInputs(prev => ({ ...prev, ...patch }));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
      <div className="glass-panel p-4">
        <h3 className="section-title" style={{ marginTop: 0 }}>Section</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
          {[
            { key: '44AD',  label: '§44AD',  hint: 'Trading / Retail / Manufacturing' },
            { key: '44ADA', label: '§44ADA', hint: 'Professionals (CA, doctor, lawyer, consultant)' },
            { key: '44AE',  label: '§44AE',  hint: 'Transporters (goods carriage owners)' },
          ].map(opt => (
            <button key={opt.key}
              className={`btn ${presumptiveInputs.section === opt.key ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.8rem', padding: '0.5rem', flexDirection: 'column', alignItems: 'stretch' }}
              onClick={() => set({ section: opt.key })}>
              <strong>{opt.label}</strong>
              <span style={{ fontSize: '0.68rem', opacity: 0.75, marginTop: 4 }}>{opt.hint}</span>
            </button>
          ))}
        </div>

        {presumptiveInputs.section === '44AD' && (
          <>
            <NumberInput label="Turnover received DIGITALLY (UPI/NEFT/RTGS/cheque)" hint="Taxed at 6%. From FY 2023-24, ≤ ₹3Cr allowed if cash ≤ 5% of turnover." value={presumptiveInputs.digitalReceipts} onChange={v => set({ digitalReceipts: v })} />
            <NumberInput label="Turnover received in CASH" hint="Taxed at 8%. Keep cash ≤ 5% of turnover to qualify for the ₹3Cr limit." value={presumptiveInputs.cashReceipts} onChange={v => set({ cashReceipts: v })} />
            <NumberInput label="Actual profit (optional override)" hint="If your books show higher profit than 6/8%, declare that instead. You cannot declare less." value={presumptiveInputs.declaredIncome} onChange={v => set({ declaredIncome: v })} />
          </>
        )}

        {presumptiveInputs.section === '44ADA' && (
          <>
            <NumberInput label="Gross receipts (digital)" hint="Taxed flat at 50% of gross receipts. ≤ ₹75L (was ₹50L) if cash ≤ 5%." value={presumptiveInputs.digitalReceipts} onChange={v => set({ digitalReceipts: v })} />
            <NumberInput label="Gross receipts (cash)" value={presumptiveInputs.cashReceipts} onChange={v => set({ cashReceipts: v })} />
            <NumberInput label="Actual profit (optional override)" hint="If actual profit > 50%, declare that instead. Cannot go below 50%." value={presumptiveInputs.declaredIncome} onChange={v => set({ declaredIncome: v })} />
          </>
        )}

        {presumptiveInputs.section === '44AE' && (
          <>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>Applicable when you own ≤ 10 goods vehicles at any time in the year.</p>
            <NumberInput label="Heavy vehicles (> 12,000 kg): sum of vehicle-months" hint="Example: 2 vehicles × 12 months = 24. Rate ₹1,000 / tonne / month." value={presumptiveInputs.heavyVehicleMonths} onChange={v => set({ heavyVehicleMonths: v })} />
            <NumberInput label="Heavy vehicle gross tonnage (avg)" value={presumptiveInputs.heavyVehicleTonnage} onChange={v => set({ heavyVehicleTonnage: v })} />
            <NumberInput label="Light vehicles: sum of vehicle-months" hint="Rate ₹7,500 / month." value={presumptiveInputs.lightVehicleMonths} onChange={v => set({ lightVehicleMonths: v })} />
          </>
        )}
      </div>

      <div>
        {presumptive && (
          <div className="glass-panel p-4" style={{ marginBottom: '1rem' }}>
            <h3 className="section-title" style={{ marginTop: 0 }}>Presumptive computation</h3>
            {presumptiveInputs.section !== '44AE' && (
              <>
                <Row label="Turnover / gross receipts" value={presumptive.turnover} />
                <Row label={`Deemed income @ ${presumptiveInputs.section === '44ADA' ? '50%' : '6% / 8%'}`} value={presumptive.deemedIncome} muted />
              </>
            )}
            {presumptiveInputs.section === '44AE' && (
              <>
                <Row label="Heavy vehicles (₹1,000 × tonnes × months)" value={presumptive.heavyIncome} muted />
                <Row label="Light vehicles (₹7,500 × months)" value={presumptive.lightIncome} muted />
              </>
            )}
            <Row label="Declared income" value={presumptive.presumptiveIncome} bold big />

            {presumptive.notes.length > 0 && (
              <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: 'var(--warn-bg, #fffbeb)', borderRadius: 6, fontSize: '0.78rem' }}>
                {presumptive.notes.map((n, i) => (<p key={i} style={{ margin: i > 0 ? '0.5rem 0 0' : 0 }}>{n}</p>))}
              </div>
            )}

            {presumptive.isEligible !== false && (
              <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={onPushToCalculator}>
                <ChevronRight size={15} /> Use {formatCurrency(presumptive.presumptiveIncome)} as Business Income
              </button>
            )}
          </div>
        )}

        <div className="glass-panel p-4" style={{ fontSize: '0.82rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <Info size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--primary)' }} />
            <div>
              <strong>Why presumptive taxation?</strong>
              <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.2rem', lineHeight: 1.6 }}>
                <li>Skip full books of account + audit (§44AB)</li>
                <li>Skip advance-tax installments — pay 100% by 15 March</li>
                <li>Simpler ITR-4 (Sugam) form instead of ITR-3</li>
                <li>Once opted in, must continue for 5 assessment years — opting out early disqualifies you from §44AD for the next 5 years</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Advance Tax sub-tab
// ============================================================================
function AdvanceTaxTab({ advanceInputs, setAdvanceInputs, schedule, totalTax, recommended }) {
  const set = (patch) => setAdvanceInputs(prev => ({ ...prev, ...patch }));

  const addPayment = () => {
    const today = new Date().toISOString().split('T')[0];
    set({ payments: [...(advanceInputs.payments || []), { date: today, amount: 0 }] });
  };
  const updatePayment = (idx, patch) => {
    set({ payments: advanceInputs.payments.map((p, i) => i === idx ? { ...p, ...patch } : p) });
  };
  const removePayment = (idx) => {
    set({ payments: advanceInputs.payments.filter((_, i) => i !== idx) });
  };

  const interest234C = compute234CInterest(schedule);
  const interest234B = compute234BInterest(schedule);

  return (
    <>
      <div className="glass-panel p-4" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h3 className="section-title" style={{ margin: 0 }}>Advance Tax Schedule</h3>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <label style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input type="checkbox" checked={advanceInputs.mode === 'presumptive'}
                onChange={e => set({ mode: e.target.checked ? 'presumptive' : 'regular' })} />
              Presumptive (pay 100% by 15 March)
            </label>
          </div>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>
          Based on your recommended <strong style={{ textTransform: 'uppercase' }}>{recommended}</strong> Regime total tax of <strong>{formatCurrency(totalTax)}</strong>.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <NumberInput label="TDS already deducted" hint="From salary, contract payments, interest — as per Form 26AS" value={advanceInputs.tdsCredit} onChange={v => set({ tdsCredit: v })} />
          <div>
            <Row label="Total tax liability" value={totalTax} />
            <Row label="Less: TDS credit" value={-(Number(advanceInputs.tdsCredit) || 0)} muted={!advanceInputs.tdsCredit} />
            <Row label="Net advance-tax liability" value={schedule.netLiability} bold />
          </div>
        </div>

        {!schedule.applies && (
          <div style={{ padding: '0.75rem', background: 'var(--success-bg, #ecfdf5)', borderRadius: 6, fontSize: '0.85rem' }}>
            <Check size={14} style={{ display: 'inline', marginRight: 4 }} />
            {schedule.note}
          </div>
        )}
      </div>

      {schedule.applies && (
        <>
          <div className="glass-panel p-0" style={{ marginBottom: '1rem', overflow: 'hidden' }}>
            <table className="data-table" style={{ marginBottom: 0 }}>
              <thead>
                <tr>
                  <th>Installment</th>
                  <th>Due Date</th>
                  <th style={{ textAlign: 'right' }}>% cumulative</th>
                  <th style={{ textAlign: 'right' }}>This installment</th>
                  <th style={{ textAlign: 'right' }}>Paid by due date</th>
                  <th style={{ textAlign: 'right' }}>Shortfall</th>
                </tr>
              </thead>
              <tbody>
                {schedule.schedule.map(row => (
                  <tr key={row.installment}>
                    <td>#{row.installment}</td>
                    <td>{row.label}</td>
                    <td style={{ textAlign: 'right' }}>{(row.cumulativePct * 100).toFixed(0)}%</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(row.installmentDue)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(row.totalPaidByDue)}</td>
                    <td style={{ textAlign: 'right', color: row.shortfall > 0 ? '#dc2626' : '#059669', fontWeight: 600 }}>
                      {formatCurrency(row.shortfall)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="glass-panel p-4">
              <h4 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Payments made</h4>
              {(advanceInputs.payments || []).length === 0 && <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No advance-tax payments recorded yet.</p>}
              {(advanceInputs.payments || []).map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                  <input type="date" className="form-input" style={{ fontSize: '0.82rem', padding: '0.35rem' }}
                    value={p.date} onChange={e => updatePayment(i, { date: e.target.value })} />
                  <input type="number" className="form-input" style={{ fontSize: '0.82rem', padding: '0.35rem' }}
                    value={p.amount || ''} placeholder="Amount"
                    onChange={e => updatePayment(i, { amount: parseFloat(e.target.value) || 0 })} />
                  <button className="icon-btn icon-btn-red" onClick={() => removePayment(i)} title="Remove"><X size={14} /></button>
                </div>
              ))}
              <button className="btn btn-secondary" style={{ fontSize: '0.78rem', marginTop: '0.5rem' }} onClick={addPayment}>
                + Add payment
              </button>
            </div>

            <div className="glass-panel p-4">
              <h4 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Interest under §234B / §234C</h4>
              <Row label="§234C — installment shortfall" value={interest234C} muted={!interest234C} />
              <Row label="§234B — post year-end delay (1% per month)" value={interest234B} muted={!interest234B} />
              <Row label="Total interest" value={interest234B + interest234C} bold />
              <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: 6, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <strong>§234C</strong>: 1% per month for shortfalls in Q1-Q3 (3 months each) and Q4 (1 month). Waived if you paid ≥ 12% by 15 Jun / 36% by 15 Sep.<br /><br />
                <strong>§234B</strong>: 1% per month from 1 April of AY if you paid less than 90% of tax by 31 March.
              </div>
            </div>
          </div>
        </>
      )}
    </>
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
function SummaryTab({ bills, expenses, purchases, profile, comparison, inputs, presumptive, advanceSchedule, fy, ay }) {
  const generateITR4PDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const tax = comparison[comparison.recommended];
      // Build the ITR-4 field map from all inputs
      const rows = buildITR4FieldMap(inputs, tax, presumptive?.presumptiveIncome ? presumptive : null, inputs.deductions);

      let y = 15;
      doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text('ITR-4 (Sugam) Filing Summary', 105, y, { align: 'center' });
      y += 6;
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(`FY ${fy} · AY ${ay} · Regime: ${comparison.recommended.toUpperCase()} · Generated ${new Date().toLocaleDateString('en-IN')}`, 105, y, { align: 'center' });
      y += 6;

      // Assessee block
      if (profile?.businessName) {
        doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        doc.rect(15, y, 180, 22, 'S');
        doc.text('Assessee', 20, y + 5);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
        doc.text(`Name: ${profile.businessName}`, 20, y + 11);
        if (profile.gstin) doc.text(`GSTIN: ${profile.gstin}`, 20, y + 16);
        if (profile.pan) doc.text(`PAN: ${profile.pan}`, 120, y + 11);
        y += 26;
      }

      // Fields grouped by section
      let currentSection = '';
      for (const r of rows) {
        if (y > 265) { doc.addPage(); y = 20; }
        if (r.section !== currentSection) {
          currentSection = r.section;
          y += 4;
          doc.setFillColor(...getAccentRGB()); doc.setTextColor(255);
          doc.rect(15, y, 180, 6, 'F');
          doc.setFontSize(9); doc.setFont('helvetica', 'bold');
          doc.text(r.section, 17, y + 4);
          doc.setTextColor(0);
          y += 8;
        }
        doc.setFontSize(r.big ? 10 : 8.5);
        doc.setFont('helvetica', r.bold ? 'bold' : 'normal');
        doc.text(r.field, 17, y);
        const val = typeof r.value === 'number' ? formatCurrency(r.value) : String(r.value || '');
        doc.text(val, 190, y, { align: 'right' });
        if (r.note) {
          y += 4;
          doc.setFontSize(7); doc.setFont('helvetica', 'italic'); doc.setTextColor(120);
          doc.text(r.note, 20, y);
          doc.setTextColor(0);
        }
        y += 5;
      }

      // Advance tax summary
      if (advanceSchedule?.applies) {
        if (y > 245) { doc.addPage(); y = 20; }
        y += 4;
        doc.setFillColor(...getAccentRGB()); doc.setTextColor(255);
        doc.rect(15, y, 180, 6, 'F');
        doc.setFontSize(9); doc.setFont('helvetica', 'bold');
        doc.text('E — Advance Tax', 17, y + 4);
        doc.setTextColor(0); y += 8;

        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
        advanceSchedule.schedule.forEach(row => {
          doc.text(`Installment #${row.installment} (${row.label})`, 17, y);
          doc.text(formatCurrency(row.installmentDue), 130, y, { align: 'right' });
          doc.text(`Paid: ${formatCurrency(row.totalPaidByDue)}`, 190, y, { align: 'right' });
          y += 5;
        });
      }

      // Footer
      doc.setFontSize(7); doc.setFont('helvetica', 'italic');
      doc.text('Generated by Free GST Billing Software. Verify against your books + Form 26AS before filing on incometax.gov.in.', 105, 285, { align: 'center' });

      doc.save(`ITR-4-Summary-${profile?.businessName?.replace(/[^\w]+/g, '-') || 'assessee'}-${ay}.pdf`);
      toast('ITR-4 Summary PDF downloaded', 'success');
    } catch (e) {
      toast('Could not generate PDF', 'error');
      console.error('ITR-4 PDF', e);
    }
  };
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

      <div className="glass-panel p-4" style={{ marginTop: '1rem', background: 'linear-gradient(135deg, rgba(30,64,175,0.05) 0%, rgba(5,150,105,0.05) 100%)', border: '1px solid var(--primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 className="section-title" style={{ margin: 0, color: 'var(--primary)' }}>ITR-4 (Sugam) Filing Summary PDF</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
              One PDF with every ITR-4 field pre-computed. Copy each value into the corresponding box on incometax.gov.in — or hand the PDF to your CA.
            </p>
          </div>
          <button className="btn btn-primary" onClick={generateITR4PDF}>
            <Download size={16} /> Download ITR-4 Summary
          </button>
        </div>
      </div>

      <div className="glass-panel p-4" style={{ marginTop: '1rem' }}>
        <h3 className="section-title">Coming next in v1.9.0</h3>
        <ul style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, paddingLeft: '1.2rem', lineHeight: 1.7 }}>
          <li><strong>Form 16 upload + parse</strong> — auto-extract salary + TDS + exemptions</li>
          <li><strong>Capital Gains module</strong> — Zerodha / Groww / ICICI Direct CSV import</li>
          <li><strong>House Property module</strong> — multi-property, home-loan interest §24(b)</li>
          <li><strong>ITR-1 / ITR-2 / ITR-3 support</strong> — for salaried + rental + capital-gains assessees</li>
          <li><strong>ITR JSON export</strong> — upload directly to the IT portal</li>
          <li><strong>Form 26AS reconciliation</strong> — upload TDS certificate</li>
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
