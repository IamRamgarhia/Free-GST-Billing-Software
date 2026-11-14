// v1.10.83 - Reports › TDS & TCS: TDS your clients deducted from your sales
// (with a "certificate received" tick to reconcile with Form 26AS / AIS), TCS
// you collected, and TDS you deducted from suppliers on purchase bills. The
// sums are in utils/tdsTcs.js.
import { useState, useEffect } from 'react';
import { getAllPurchases, getProfile, saveBill } from '../store';
import { formatCurrency, getFYOptions, belongsToProfile, underNewAct } from '../utils';
import { salesTaxRows, purchaseTdsRows, totalsBy, fyQuarterRange } from '../utils/tdsTcs';
import HelpButton from './HelpButton';
import TableExport from './TableExport';
import { toast } from './Toast';

const PERIODS = [['', 'Whole year'], ['Q1', 'Q1 (Apr-Jun)'], ['Q2', 'Q2 (Jul-Sep)'], ['Q3', 'Q3 (Oct-Dec)'], ['Q4', 'Q4 (Jan-Mar)'], ['custom', 'Custom dates']];
const right = { textAlign: 'right' };
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—');

// A small "totals by ..." table under each list.
function TotalsTable({ title, rows, label }) {
  if (!rows.length) return null;
  return (
    <div style={{ flex: '1 1 260px', minWidth: 0 }}>
      <p style={{ margin: '0.75rem 0 0.35rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{title}</p>
      <div className="table-scroll">
        <table className="data-table" style={{ fontSize: '0.8rem', marginBottom: 0, minWidth: 0 }}>
          <thead><tr><th>{label}</th><th style={right}>Bills</th><th style={right}>Taxable</th><th style={right}>Amount</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}><td>{r.key}</td><td style={right}>{r.count}</td><td style={right}>{formatCurrency(r.taxable)}</td><td style={{ ...right, fontWeight: 600 }}>{formatCurrency(r.amount)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function TdsTcsReport({ bills, businessName, onBillsChanged }) {
  const fyOptions = getFYOptions();
  const [fy, setFy] = useState(fyOptions[0]?.value || '');
  const [period, setPeriod] = useState('');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [purchases, setPurchases] = useState([]);
  const [certs, setCerts] = useState({}); // id -> ticked, until the reload lands

  useEffect(() => {
    let live = true;
    Promise.all([getAllPurchases(), getProfile().catch(() => null)])
      .then(([pur, prof]) => { if (live) setPurchases((pur || []).filter((p) => belongsToProfile(p, prof))); })
      .catch(() => toast('Could not load purchase bills', 'error'));
    return () => { live = false; };
  }, []);

  const range = period === 'custom' ? custom : fyQuarterRange(fy, period);
  const fyLabel = fyOptions.find((f) => f.value === fy)?.label || '';
  const periodLabel = period === 'custom'
    ? [custom.from && fmtDate(custom.from), custom.to && fmtDate(custom.to)].filter(Boolean).join(' to ') || 'All dates'
    : `${fyLabel}${period ? ` ${period}` : ''}`;
  const subtitle = [businessName, periodLabel].filter(Boolean).join(', ');

  const tds = salesTaxRows(bills, 'tds', range).map((r) => (r.id in certs ? { ...r, certificate: certs[r.id] } : r));
  const tcs = salesTaxRows(bills, 'tcs', range);
  const own = purchaseTdsRows(purchases, range);
  const sum = (rows) => rows.reduce((s, r) => s + r.amount, 0);
  const certCount = tds.filter((r) => r.certificate).length;

  const toggleCert = async (row, on) => {
    const bill = bills.find((b) => b.id === row.id);
    if (!bill) return;
    setCerts((prev) => ({ ...prev, [row.id]: on }));
    try {
      const { tdsCertificate: _old, ...rest } = bill;
      await saveBill(on ? { ...rest, tdsCertificate: true } : rest, { overwrite: true });
      if (onBillsChanged) onBillsChanged();
    } catch {
      setCerts((prev) => ({ ...prev, [row.id]: !on }));
      toast('Could not save the tick. Try again.', 'error');
    }
  };

  const listHeaders = ['Date', 'Invoice No', 'Party', 'PAN', 'Section', 'Rate %', 'Taxable value', 'Amount'];
  const listRow = (r) => [r.date, r.invoiceNumber, r.party, r.pan, r.section, r.rate, r.taxable, r.amount];

  return (
    <>
      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="tds-fy">Financial year</label>
            <select id="tds-fy" className="form-input" value={fy} disabled={period === 'custom'} onChange={(e) => setFy(e.target.value)}>
              {fyOptions.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="tds-period">Period</label>
            <select id="tds-period" className="form-input" value={period} onChange={(e) => setPeriod(e.target.value)}>
              {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {period === 'custom' && (
            <>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="tds-from">From</label>
                <input id="tds-from" type="date" className="form-input" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="tds-to">To</label>
                <input id="tds-to" type="date" className="form-input" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
              </div>
            </>
          )}
          <HelpButton title="TDS & TCS period" doc="reports#tds-tcs" size={16} style={{ marginBottom: 7 }} />
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '1.5rem' }}>
        <div className="stat-card"><div><p className="stat-label">TDS by your clients</p><h2 className="stat-value stat-value-green">{formatCurrency(sum(tds))}</h2></div></div>
        <div className="stat-card"><div><p className="stat-label">Certificates received</p><h2 className="stat-value">{certCount} / {tds.length}</h2></div></div>
        <div className="stat-card"><div><p className="stat-label">TCS you collected</p><h2 className="stat-value stat-value-amber">{formatCurrency(sum(tcs))}</h2></div></div>
        <div className="stat-card"><div><p className="stat-label">TDS you deducted</p><h2 className="stat-value stat-value-purple">{formatCurrency(sum(own))}</h2></div></div>
      </div>

      {/* (a) TDS deducted by clients */}
      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>TDS deducted by your clients<HelpButton title="TDS deducted by your clients" doc="reports#tds-by-clients" size={16} /></h3>
          <TableExport title="TDS deducted by clients" filename={`TDS-by-clients-${periodLabel}`} subtitle={subtitle} landscape
            headers={[...listHeaders, 'Certificate received']} rows={tds.map((r) => [...listRow(r), r.certificate ? 'Yes' : 'No'])} />
        </div>
        <p className="text-muted" style={{ margin: '0 0 0.75rem', fontSize: '0.8rem' }}>
          Income tax your clients kept back from your sales invoices. It is credited to your PAN: tick each invoice once its TDS certificate (Form 16A) arrives or it shows in Form 26AS / AIS, and claim the total in your income tax return.
        </p>
        {tds.length === 0 ? (
          <p className="text-muted" style={{ fontSize: '0.85rem', textAlign: 'center', padding: '0.75rem' }}>No sales invoices with TDS in this period. Tick TDS on an invoice under Customize, or record it with a payment.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: 820, fontSize: '0.82rem', marginBottom: 0 }}>
              <thead><tr><th>Date</th><th>Invoice No</th><th>Client</th><th>PAN</th><th>Section</th><th style={right}>Rate</th><th style={right}>Taxable</th><th style={right}>TDS</th><th style={{ textAlign: 'center' }}>Certificate</th></tr></thead>
              <tbody>
                {tds.map((r) => (
                  <tr key={r.id}>
                    <td className="text-muted">{fmtDate(r.date)}</td>
                    <td><span className="invoice-badge">{r.invoiceNumber}</span></td>
                    <td className="font-medium">{r.party || '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{r.pan || '—'}</td>
                    <td>{r.section}</td>
                    <td style={right}>{r.rate}%</td>
                    <td style={right}>{formatCurrency(r.taxable)}</td>
                    <td style={{ ...right, fontWeight: 700 }}>{formatCurrency(r.amount)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={!!r.certificate} onChange={(e) => toggleCert(r, e.target.checked)}
                        aria-label={`TDS certificate received for ${r.invoiceNumber}`} style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <TotalsTable title="By client" label="Client" rows={totalsBy(tds, (r) => r.party)} />
          <TotalsTable title="By quarter" label="Quarter" rows={totalsBy(tds, (r) => r.quarter)} />
        </div>
      </div>

      {/* (b) TCS collected */}
      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>TCS you collected<HelpButton title="TCS you collected" doc="reports#tcs-collected" size={16} /></h3>
          <TableExport title="TCS collected" filename={`TCS-collected-${periodLabel}`} subtitle={subtitle} landscape headers={listHeaders} rows={tcs.map(listRow)} />
        </div>
        <p className="text-muted" style={{ margin: '0 0 0.75rem', fontSize: '0.8rem' }}>Tax you added to sales invoices and collected from buyers. You deposit it with the government and report it in your TCS return (Form 27EQ).</p>
        {tcs.length === 0 ? (
          <p className="text-muted" style={{ fontSize: '0.85rem', textAlign: 'center', padding: '0.75rem' }}>No sales invoices with TCS in this period.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: 720, fontSize: '0.82rem', marginBottom: 0 }}>
              <thead><tr><th>Date</th><th>Invoice No</th><th>Client</th><th>PAN</th><th>Section</th><th style={right}>Rate</th><th style={right}>Taxable</th><th style={right}>TCS</th></tr></thead>
              <tbody>
                {tcs.map((r) => (
                  <tr key={r.id}>
                    <td className="text-muted">{fmtDate(r.date)}</td><td><span className="invoice-badge">{r.invoiceNumber}</span></td>
                    <td className="font-medium">{r.party || '—'}</td><td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{r.pan || '—'}</td>
                    <td>{r.section}</td><td style={right}>{r.rate}%</td><td style={right}>{formatCurrency(r.taxable)}</td><td style={{ ...right, fontWeight: 700 }}>{formatCurrency(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <TotalsTable title="By client" label="Client" rows={totalsBy(tcs, (r) => r.party)} />
          <TotalsTable title="By quarter" label="Quarter" rows={totalsBy(tcs, (r) => r.quarter)} />
        </div>
      </div>

      {/* (c) TDS you deducted on purchase bills */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>TDS you deducted from suppliers<HelpButton title="TDS you deducted from suppliers" doc="reports#tds-on-purchases" size={16} /></h3>
          <TableExport title="TDS deducted from suppliers" filename={`TDS-on-purchases-${periodLabel}`} subtitle={subtitle} landscape
            headers={[...listHeaders, 'Paid to supplier']} rows={own.map((r) => [...listRow(r), r.paid])} />
        </div>
        <p className="text-muted" style={{ margin: '0 0 0.75rem', fontSize: '0.8rem' }}>TDS you kept back from suppliers' payments (from the purchase bills). Deposit it by the 7th of the next month and report it in your quarterly TDS return (Form 26Q).</p>
        {own.length === 0 ? (
          <p className="text-muted" style={{ fontSize: '0.85rem', textAlign: 'center', padding: '0.75rem' }}>No purchase bills with TDS in this period. Tick TDS deducted on a purchase bill to record it.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: 820, fontSize: '0.82rem', marginBottom: 0 }}>
              <thead><tr><th>Date</th><th>Bill No</th><th>Supplier</th><th>PAN</th><th>Section</th><th style={right}>Rate</th><th style={right}>Taxable</th><th style={right}>TDS</th><th style={right}>Paid to supplier</th></tr></thead>
              <tbody>
                {own.map((r) => (
                  <tr key={r.id}>
                    <td className="text-muted">{fmtDate(r.date)}</td><td><span className="invoice-badge">{r.invoiceNumber}</span></td>
                    <td className="font-medium">{r.party || '—'}</td><td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{r.pan || '—'}</td>
                    <td>{r.section}</td><td style={right}>{r.rate}%</td><td style={right}>{formatCurrency(r.taxable)}</td>
                    <td style={{ ...right, fontWeight: 700 }}>{formatCurrency(r.amount)}</td><td style={right}>{formatCurrency(r.paid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <TotalsTable title="By section" label="Section" rows={totalsBy(own, (r) => r.section)} />
          <TotalsTable title="By quarter" label="Quarter" rows={totalsBy(own, (r) => r.quarter)} />
        </div>
      </div>

      {/* (d) TDS return file (Form 26Q) — one CSV per quarter, the way the
      // portal wants it: deductee PAN, section, taxable value, TDS. The Act is
      // written in the filename so a return for FY 2026-27 carries the 2025
      // Act's sections (393(1) Sl. 6(i)...) and an older one keeps 194C. */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>TDS return file (Form 26Q)<HelpButton title="TDS return file" doc="reports#tds-return" size={16} /></h3>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => {
              const rows = own.filter((r) => r.quarter === q);
              return (
                <button key={q} type="button" className="btn btn-ghost btn-sm" disabled={!rows.length}
                  onClick={() => {
                    const act = rows[0]?.date && underNewAct(rows[0].date) ? 'Income-tax-Act-2025' : 'Income-tax-Act-1961';
                    downloadCSV(`TDS_26Q_${fyLabel.replace(/ /g, '_')}_${q}_${act}.csv`,
                      ['Deductee PAN', 'Section', 'Rate %', 'Taxable Value', 'TDS Amount'],
                      rows.map((r) => [r.pan || '', r.section, r.rate, r.taxable, r.amount]));
                    toast(`Form 26Q ${q} exported`, 'success');
                  }}>
                  {q} ({rows.length})
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-muted" style={{ margin: '0 0 0.75rem', fontSize: '0.8rem' }}>
          One file per quarter for the TDS return. From 1 April 2026 the sections are the Income-tax Act, 2025 (393(1) Table Sl. 6(i) for contractors, Sl. 8(ii) for purchase of goods…); bills dated before that keep 194C/194Q. Upload each file at <a href="https://www.tin-nsdl.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>tin-nsdl.com</a> or hand it to your CA.
        </p>
        {own.length === 0 ? (
          <p className="text-muted" style={{ fontSize: '0.85rem', textAlign: 'center', padding: '0.75rem' }}>No purchase bills with TDS in this period — nothing to file.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: 640, fontSize: '0.8rem', marginBottom: 0 }}>
              <thead><tr><th>Quarter</th><th>Deductee PAN</th><th>Section</th><th style={right}>Rate</th><th style={right}>Taxable</th><th style={right}>TDS</th></tr></thead>
              <tbody>
                {['Q1', 'Q2', 'Q3', 'Q4'].flatMap((q) => own.filter((r) => r.quarter === q).map((r) => (
                  <tr key={r.id}>
                    <td>{q}</td><td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{r.pan || '—'}</td><td>{r.section}</td>
                    <td style={right}>{r.rate}%</td><td style={right}>{formatCurrency(r.taxable)}</td><td style={{ ...right, fontWeight: 700 }}>{formatCurrency(r.amount)}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
