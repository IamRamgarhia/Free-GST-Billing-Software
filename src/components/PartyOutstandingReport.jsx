// v1.10.75 - Party outstanding in Tally's layout: parties down the side,
// months across, totals on the right and at the bottom. Calculation lives in
// utils/partyOutstanding.js (unit-tested); this file only shows and exports it.
import { useState } from 'react';
import { Download, Printer, Wallet } from 'lucide-react';
import { getFinancialYearStart, toCsvLine } from '../utils';
import { periodMonths, partyOutstanding, billCurrency } from '../utils/partyOutstanding';
import { toast } from './Toast';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const amt = (n) => (n ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');

export default function PartyOutstandingReport({ bills, businessName }) {
  const thisYear = new Date().getFullYear();
  const [mode, setMode] = useState('fy');
  const [year, setYear] = useState(getFinancialYearStart());
  const currencies = [...new Set(bills.map(billCurrency))].sort((a, b) => (a === 'INR' ? -1 : b === 'INR' ? 1 : a.localeCompare(b)));
  const [currency, setCurrency] = useState('INR');
  const cur = currencies.includes(currency) ? currency : (currencies[0] || 'INR');

  const months = periodMonths(mode, year);
  const rows = partyOutstanding(bills, months, cur);
  const hasEarlier = rows.some((r) => r.earlier > 0);
  const colTotal = (key) => rows.reduce((s, r) => s + (r.months[key] || 0), 0);
  const earlierTotal = rows.reduce((s, r) => s + r.earlier, 0);
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const years = Array.from({ length: 6 }, (_, i) => (mode === 'fy' ? getFinancialYearStart() : thisYear) - i);
  const periodLabel = mode === 'fy' ? `FY ${year}-${String(year + 1).slice(-2)}` : `Jan-Dec ${year}`;
  const heads = ['Party', ...(hasEarlier ? ['Earlier'] : []), ...months.map((m) => m.label), 'Total'];
  const cells = (r) => [...(hasEarlier ? [r.earlier] : []), ...months.map((m) => r.months[m.key] || 0), r.total];
  const totals = [...(hasEarlier ? [earlierTotal] : []), ...months.map((m) => colTotal(m.key)), grandTotal];

  const exportCsv = () => {
    if (!rows.length) { toast('Nothing outstanding to export', 'warning'); return; }
    const lines = [toCsvLine(heads), ...rows.map((r) => toCsvLine([r.name, ...cells(r).map((n) => n.toFixed(2))])),
      toCsvLine(['Total', ...totals.map((n) => n.toFixed(2))])];
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url; a.download = `Party-Outstanding-${periodLabel.replace(/\s+/g, '_')}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast('Party outstanding CSV downloaded', 'success');
  };

  // A plain page of its own, so the browser's Print (or Save as PDF) gets the
  // table alone, landscape, without the app around it.
  const print = () => {
    if (!rows.length) { toast('Nothing outstanding to print', 'warning'); return; }
    const w = window.open('', '_blank');
    if (!w) { toast('Allow pop-ups for this page to print the report', 'error'); return; }
    const tr = (label, nums, bold) => `<tr${bold ? ' class="t"' : ''}><td>${esc(label)}</td>${nums.map((n) => `<td class="n">${amt(n)}</td>`).join('')}</tr>`;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Party Outstanding ${esc(periodLabel)}</title><style>
      @page { size: A4 landscape; margin: 10mm; } body { font: 10px Arial, sans-serif; color: #000; }
      h1 { font-size: 14px; margin: 0; } p { margin: 2px 0 8px; } table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #555; padding: 3px 4px; } th { background: #eee; } .n { text-align: right; white-space: nowrap; }
      .t td { font-weight: bold; background: #f4f4f4; }</style></head><body>
      <h1>${esc(businessName || 'Party Outstanding')}</h1><p>Party outstanding, ${esc(periodLabel)} (${esc(cur)}), unpaid as on ${new Date().toLocaleDateString('en-IN')}</p>
      <table><thead><tr>${heads.map((h, i) => `<th${i ? ' class="n"' : ''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>
      ${rows.map((r) => tr(r.name, cells(r))).join('')}${tr('Total', totals, true)}</tbody></table></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  const num = { textAlign: 'right', whiteSpace: 'nowrap' };
  // Party and Total stay in view while the months scroll sideways.
  const pin = (side) => ({ position: 'sticky', [side]: 0, zIndex: 1, background: 'var(--bg-secondary)' });
  const last = heads.length - 2;
  return (
    <div className="glass-panel">
      <div className="table-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <h3>Party outstanding by month</h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="form-input" style={{ width: 'auto' }} value={mode} aria-label="Months"
            onChange={(e) => { setMode(e.target.value); setYear(e.target.value === 'fy' ? getFinancialYearStart() : thisYear); }}>
            <option value="fy">Financial year (Apr-Mar)</option>
            <option value="calendar">Calendar year (Jan-Dec)</option>
          </select>
          <select className="form-input" style={{ width: 'auto' }} value={year} aria-label="Year" onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{mode === 'fy' ? `FY ${y}-${String(y + 1).slice(-2)}` : y}</option>)}
          </select>
          {currencies.length > 1 && (
            <select className="form-input" style={{ width: 'auto' }} value={cur} aria-label="Currency" onChange={(e) => setCurrency(e.target.value)}>
              {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <button className="btn btn-secondary" onClick={print}><Printer size={16} /> Print / PDF</button>
          <button className="btn btn-secondary" onClick={exportCsv}><Download size={16} /> CSV</button>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="empty-state">
          <Wallet size={48} />
          <p>Nobody owes you anything for {periodLabel}.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table" style={{ minWidth: '1000px', fontSize: '0.8rem' }}>
            <thead>
              <tr>{heads.map((h, i) => <th key={h} style={i === 0 ? pin('left') : i === last + 1 ? { ...num, ...pin('right') } : num}>{i === last + 1 ? `Total (${cur})` : h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td className="font-medium" style={pin('left')}>{r.name}</td>
                  {cells(r).map((n, i) => (
                    <td key={i} style={i === last ? { ...num, ...pin('right'), fontWeight: 700 } : num}>{amt(n) || '-'}</td>
                  ))}
                </tr>
              ))}
              <tr style={{ fontWeight: 700, background: 'var(--bg-secondary)' }}>
                <td style={pin('left')}>Total</td>
                {totals.map((n, i) => <td key={i} style={i === last ? { ...num, ...pin('right') } : num}>{amt(n) || '-'}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0 1.25rem 1rem', margin: 0 }}>
        What each party still owes today, in the month of the invoice. Only sales count; estimates, challans and cancelled invoices are left out, and credit notes are not subtracted (as on Outstanding &amp; Aging).
        {hasEarlier && ' "Earlier" is invoices from before this period that are still unpaid.'}
      </p>
    </div>
  );
}
