// v1.10.83 (#112) - Reports > By cost centre: sales, purchases, expenses and
// profit for each branch, site or project in the period chosen above. The
// maths is costCentreReport() in utils/costCentres.js (tested in
// scripts/costcentre-test.mjs).
import { useState, useEffect } from 'react';
import { getAllPurchases, getAllDebitNotes } from '../store';
import { formatCurrency, belongsToProfile } from '../utils';
import { costCentreReport, centreLabel } from '../utils/costCentres';
import { billCurrency } from '../utils/partyOutstanding';
import { useCostCentres } from './useCostCentres';
import TableExport from './TableExport';
import HelpButton from './HelpButton';
import { toast } from './Toast';

const HEADERS = ['Cost centre', 'Sales (taxable)', 'GST on sales', 'Sales total', 'Purchases (ex. GST)', 'Expenses (ex. GST)', 'Profit'];

// bills and expenses come from ReportsView, already narrowed to this business
// with cancelled invoices left out. Purchases have no currency: they count as INR.
export default function CostCentreReport({ bills, expenses, profile, from, to, currency, subtitle, periodLabel }) {
  const { centres } = useCostCentres(profile);
  const [purchases, setPurchases] = useState([]);
  const [debitNotes, setDebitNotes] = useState([]);
  useEffect(() => {
    getAllPurchases()
      .then((rows) => setPurchases((rows || []).filter((p) => belongsToProfile(p, profile))))
      .catch(() => toast('Failed to load purchases', 'error'));
    // v1.10.85 (#168) - purchase returns come off the purchases.
    getAllDebitNotes()
      .then((rows) => setDebitNotes((rows || []).filter((p) => belongsToProfile(p, profile))))
      .catch(() => setDebitNotes([]));
  }, [profile]);

  const { rows, total } = costCentreReport({
    bills: bills.filter((b) => billCurrency(b) === currency),
    purchases: currency === 'INR' ? purchases : [],
    debitNotes: currency === 'INR' ? debitNotes : [],
    expenses: expenses.filter((e) => (e.currency || 'INR') === currency),
    centres, from, to,
  });
  const nameOf = (r) => centreLabel(r) + (r.archived ? ' (archived)' : '');
  const cells = (r) => [r.salesTaxable, r.salesTax, r.salesTotal, r.purchases, r.expenses, r.profit];
  const money = (n) => formatCurrency(n, currency);

  return (
    <div className="glass-panel">
      <div className="table-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3>By cost centre<HelpButton title="By cost centre" doc="reports#cost-centres" size={16} /></h3>
        <TableExport title="Profit by cost centre" filename={`Cost-centres-${periodLabel}`} landscape
          subtitle={subtitle} headers={HEADERS}
          rows={[...rows.map((r) => [nameOf(r), ...cells(r)]), ['Total', ...cells(total)]]} />
      </div>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 1.25rem 0.75rem' }}>
        Profit = sales (taxable) - purchases - expenses, all without GST. Credit notes are subtracted; cancelled invoices, quotations and challans are left out.
      </p>
      <div className="table-scroll">
        <table className="data-table" style={{ minWidth: '760px' }}>
          <thead><tr>
            {HEADERS.map((h, i) => <th key={h} style={i ? { textAlign: 'right' } : undefined}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-medium" style={r.archived ? { opacity: 0.7 } : undefined}>{nameOf(r)}</td>
                {cells(r).map((v, i) => (
                  <td key={i} style={{ textAlign: 'right', ...(i === 5 ? { fontWeight: 700, color: v >= 0 ? 'var(--success)' : 'var(--danger)' } : {}) }}>{money(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--border)' }}>
              <td>Total</td>
              {cells(total).map((v, i) => <td key={i} style={{ textAlign: 'right' }}>{money(v)}</td>)}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
