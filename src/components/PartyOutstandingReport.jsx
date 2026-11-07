// v1.10.75 - Party outstanding in Tally's layout: parties down the side,
// months across, totals on the right and at the bottom. Calculation lives in
// utils/partyOutstanding.js (unit-tested); this file only shows and exports it.
import { useState, useEffect } from 'react';
import { Wallet } from 'lucide-react';
import { getFinancialYearStart, belongsToProfile } from '../utils';
import { getAllPurchases, getProfile, getAllDebitNotes } from '../store';
import { withReturns } from '../utils/debitNotes';
import { periodMonths, partyOutstanding, supplierOutstanding, billCurrency } from '../utils/partyOutstanding';
import TableExport from './TableExport';
import HelpButton from './HelpButton';

const amt = (n) => (n ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');

export default function PartyOutstandingReport({ bills, businessName }) {
  const thisYear = new Date().getFullYear();
  const [mode, setMode] = useState('fy');
  const [year, setYear] = useState(getFinancialYearStart());
  const currencies = [...new Set(bills.map(billCurrency))].sort((a, b) => (a === 'INR' ? -1 : b === 'INR' ? 1 : a.localeCompare(b)));
  const [currency, setCurrency] = useState('INR');
  // v1.10.83 (#123) - 'clients': what clients owe you; 'suppliers': what you
  // owe suppliers on purchase bills (rupees only), loaded when first shown.
  const [side, setSide] = useState('clients');
  const [purchases, setPurchases] = useState(null);
  useEffect(() => {
    if (side !== 'suppliers' || purchases) return;
    // v1.10.85 (#168) - goods returned on debit notes are not owed.
    Promise.all([getAllPurchases(), getProfile().catch(() => null), getAllDebitNotes().catch(() => [])])
      .then(([rows, prof, dns]) => setPurchases(withReturns((rows || []).filter((r) => belongsToProfile(r, prof)), (dns || []).filter((r) => belongsToProfile(r, prof)))))
      .catch(() => setPurchases([]));
  }, [side, purchases]);
  const suppliers = side === 'suppliers';
  const cur = suppliers ? 'INR' : (currencies.includes(currency) ? currency : (currencies[0] || 'INR'));

  const months = periodMonths(mode, year);
  const rows = suppliers ? supplierOutstanding(purchases || [], months) : partyOutstanding(bills, months, cur);
  const hasEarlier = rows.some((r) => r.earlier > 0);
  const colTotal = (key) => rows.reduce((s, r) => s + (r.months[key] || 0), 0);
  const earlierTotal = rows.reduce((s, r) => s + r.earlier, 0);
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const years = Array.from({ length: 6 }, (_, i) => (mode === 'fy' ? getFinancialYearStart() : thisYear) - i);
  const periodLabel = mode === 'fy' ? `FY ${year}-${String(year + 1).slice(-2)}` : `Jan-Dec ${year}`;
  const heads = [suppliers ? 'Supplier' : 'Party', ...(hasEarlier ? ['Earlier'] : []), ...months.map((m) => m.label), 'Total'];
  const cells = (r) => [...(hasEarlier ? [r.earlier] : []), ...months.map((m) => r.months[m.key] || 0), r.total];
  const totals = [...(hasEarlier ? [earlierTotal] : []), ...months.map((m) => colTotal(m.key)), grandTotal];

  const r2 = (n) => Math.round(n * 100) / 100;
  const exportRows = rows.length ? [...rows.map((r) => [r.name, ...cells(r).map(r2)]), ['Total', ...totals.map(r2)]] : [];

  const num = { textAlign: 'right', whiteSpace: 'nowrap' };
  // Party and Total stay in view while the months scroll sideways.
  const pin = (edge) => ({ position: 'sticky', [edge]: 0, zIndex: 1, background: 'var(--bg-secondary)' });
  const last = heads.length - 2;
  return (
    <div className="glass-panel">
      <div className="table-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <h3>{suppliers ? 'Owed to suppliers by month' : 'Party outstanding by month'}<HelpButton title={suppliers ? 'Owed to suppliers by month' : 'Party outstanding by month'} doc={suppliers ? 'reports#supplier-outstanding' : 'reports#party-outstanding'} size={16} /></h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="form-input" style={{ width: 'auto' }} value={side} aria-label="Who owes" onChange={(e) => setSide(e.target.value)}>
            <option value="clients">Clients owe you</option>
            <option value="suppliers">You owe suppliers</option>
          </select>
          <select className="form-input" style={{ width: 'auto' }} value={mode} aria-label="Months"
            onChange={(e) => { setMode(e.target.value); setYear(e.target.value === 'fy' ? getFinancialYearStart() : thisYear); }}>
            <option value="fy">Financial year (Apr-Mar)</option>
            <option value="calendar">Calendar year (Jan-Dec)</option>
          </select>
          <select className="form-input" style={{ width: 'auto' }} value={year} aria-label="Year" onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{mode === 'fy' ? `FY ${y}-${String(y + 1).slice(-2)}` : y}</option>)}
          </select>
          {!suppliers && currencies.length > 1 && (
            <select className="form-input" style={{ width: 'auto' }} value={cur} aria-label="Currency" onChange={(e) => setCurrency(e.target.value)}>
              {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <TableExport title={`${suppliers ? 'Owed to suppliers' : 'Party outstanding'} ${periodLabel}`} filename={`${suppliers ? 'Supplier' : 'Party'}-Outstanding-${periodLabel}`} landscape
            subtitle={`${businessName ? `${businessName}, ` : ''}${suppliers ? 'owed to suppliers' : 'party outstanding'}, ${periodLabel} (${cur}), unpaid as on ${new Date().toLocaleDateString('en-IN')}`}
            headers={heads} rows={exportRows} />
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="empty-state">
          <Wallet size={48} />
          <p>{!suppliers ? `Nobody owes you anything for ${periodLabel}.` : purchases ? `You owe no supplier anything for ${periodLabel}.` : 'Loading...'}</p>
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
        {suppliers ? (
          <>What you still owe each supplier today, in the month of their bill: the bill total, less TDS you keep back, less the payments recorded on it. A bill marked Paid owes nothing.
            {hasEarlier && ' "Earlier" is bills from before this period that are still unpaid.'}</>
        ) : (
          <>What each party still owes today, in the month of the invoice. Only sales count; estimates, challans and cancelled invoices are left out, and credit notes are not subtracted (as on Outstanding &amp; Aging).
            {hasEarlier && ' "Earlier" is invoices from before this period that are still unpaid.'}</>
        )}
      </p>
    </div>
  );
}
