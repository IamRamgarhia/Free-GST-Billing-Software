// v1.10.77 (#85) - closing stock and its value at the end of any month.
// Calculation lives in utils/products.js (unit-tested); this file only shows
// and exports it. Products and stock are shared by all your businesses, so
// this report reads every invoice and purchase, not just the open company's.
import { useEffect, useState } from 'react';
import { Package, Trash2 } from 'lucide-react';
import { getAllBills, getAllProducts, getAllPurchases, getAllProductions, getAllDebitNotes, getAllStockAdjustments, deleteStockAdjustment } from '../store';
import { localToday } from '../utils';
import { closingStock, stockValueOf } from '../utils/products';
import { toast } from './Toast';
import TableExport from './TableExport';
import HelpButton from './HelpButton';
import { confirmAction } from './ConfirmModal';
import { categoryOptions, brandOptions, productMatches, reasonLabel } from '../utils/stock';

const amt = (n) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Last day of a YYYY-MM month, or today while that month is still running.
const monthEnd = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  const last = `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
  const today = localToday();
  return last > today ? today : last;
};

export default function StockReport({ businessName }) {
  const [data, setData] = useState(null);
  const [month, setMonth] = useState(localToday().slice(0, 7));
  // v1.10.85 (#142) - item, category (with its sub-levels) and brand.
  const [filter, setFilter] = useState({ item: '', category: '', brand: '' });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    // v1.10.83 (#115) - production entries move stock too (always read, even
    // with the feature off: entries saved earlier still moved stock).
    // v1.10.85 (#168) - and purchase returns (debit notes).
    // v1.10.85 - and stock adjustments (damaged, found, ...).
    Promise.all([getAllProducts(), getAllBills(), getAllPurchases(), getAllProductions().catch(() => []), getAllDebitNotes().catch(() => []), getAllStockAdjustments().catch(() => [])])
      .then(([products, bills, purchases, productions, debitNotes, adjustments]) => setData({
        products: products || [],
        bills: bills || [],
        purchases: purchases || [],
        productions: productions || [],
        debitNotes: debitNotes || [],
        adjustments: adjustments || [],
      }))
      .catch(() => toast('Failed to load stock', 'error'));
  }, [reload]);

  if (!data) return <div className="glass-panel" style={{ padding: '1.25rem' }}>Loading stock…</div>;

  const asOf = monthEnd(month);
  const qty = closingStock(data.products, data.bills, data.purchases, asOf, data.productions, data.debitNotes, data.adjustments);
  const rows = data.products
    .filter((p) => qty.has(p.id) && productMatches(p, filter)) // services have no stock (#121)
    .map((p) => ({ p, q: qty.get(p.id) ?? 0, ...stockValueOf(p, qty.get(p.id)) }))
    .sort((a, b) => String(a.p.name || '').localeCompare(String(b.p.name || '')));
  const total = rows.reduce((s, r) => s + (r.q > 0 ? r.value : 0), 0);
  const asOfLabel = new Date(`${asOf}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const exportRows = [
    ...rows.map((r) => [r.p.name, r.p.hsn || '', r.p.unit || 'Nos', r.q, r.price, r.q > 0 ? r.value : 0]),
    ['Total', '', '', '', '', Math.round(total * 100) / 100],
  ];
  const num = { textAlign: 'right', whiteSpace: 'nowrap' };
  // A select, not <input type="month">: Firefox shows that as a plain text box.
  // The month's stock adjustments, for the products shown.
  const shownIds = new Set(rows.map((r) => r.p.id));
  const monthAdj = data.adjustments.filter((a) => String(a.date || '').slice(0, 7) === month && shownIds.has(a.productId));
  const cats = categoryOptions(data.products);
  const brands = brandOptions(data.products);
  const setF = (k, v) => setFilter((prev) => ({ ...prev, [k]: v }));
  const removeAdj = async (a) => {
    if (!(await confirmAction({ title: 'Delete this stock adjustment?', message: `${a.productName}: ${a.quantity > 0 ? '+' : ''}${a.quantity} (${reasonLabel(a.reason)}). The stock goes back by the same quantity.`, confirmLabel: 'Delete', tone: 'danger' }))) return;
    try { await deleteStockAdjustment(a); toast('Adjustment deleted; stock put back', 'success'); setReload((n) => n + 1); }
    catch (err) { toast(err?.message || 'Could not delete it', 'error'); }
  };
  const lastMonths = Array.from({ length: 36 }, (_, i) => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
    return [`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })];
  });

  return (
    <div className="glass-panel">
      <div className="table-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <h3>Closing stock as on {asOfLabel}<HelpButton title="Closing stock" doc="reports#stock" size={16} /></h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="text" className="form-input" style={{ width: 160 }} aria-label="Item" placeholder="Item name..." value={filter.item} onChange={(e) => setF('item', e.target.value)} />
          {cats.length > 0 && (
            <select className="form-input" style={{ width: 'auto', maxWidth: 240 }} aria-label="Category" value={filter.category} onChange={(e) => setF('category', e.target.value)}>
              <option value="">All categories</option>
              {cats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {brands.length > 0 && (
            <select className="form-input" style={{ width: 'auto' }} aria-label="Brand" value={filter.brand} onChange={(e) => setF('brand', e.target.value)}>
              <option value="">All brands</option>
              {brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
          <select className="form-input" style={{ width: 'auto' }} value={month} aria-label="Month" onChange={(e) => setMonth(e.target.value)}>
            {lastMonths.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
          <TableExport title={`Closing stock ${asOfLabel}`} filename={`Closing-stock-${asOf}`}
            subtitle={`${businessName ? `${businessName}, ` : ''}closing stock as on ${asOfLabel}, valued at purchase price`}
            headers={['Product', 'HSN/SAC', 'Unit', 'Closing qty', 'Rate', 'Value']} rows={rows.length ? exportRows : []} />
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="empty-state">
          <Package size={48} />
          <p>{data.products.length ? 'No products match the filters.' : 'No products yet. Add them under Products.'}</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table" style={{ minWidth: 640 }}>
            <thead>
              <tr><th>Product</th><th>HSN/SAC</th><th>Unit</th><th style={num}>Closing qty</th><th style={num}>Rate</th><th style={num}>Value</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.p.id}>
                  <td className="font-medium">{r.p.name}</td>
                  <td>{r.p.hsn || '-'}</td>
                  <td>{r.p.unit || 'Nos'}</td>
                  <td style={{ ...num, color: r.q < 0 ? 'var(--danger)' : undefined }}>{r.q}</td>
                  <td style={num} title={r.atCost ? 'Purchase price' : 'No purchase price, so selling price'}>{amt(r.price)}{r.atCost ? '' : ' *'}</td>
                  <td style={num}>{r.q > 0 ? amt(r.value) : '-'}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700, background: 'var(--bg-secondary)' }}>
                <td colSpan={5}>Total stock value</td>
                <td style={num}>{amt(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {monthAdj.length > 0 && (
        <div style={{ padding: '0.5rem 1.25rem 0.75rem' }}>
          <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.9rem' }}>Stock adjustments this month <HelpButton title="Stock adjustments" doc="products#stock-adjust" size={14} /></h4>
          <table className="data-table" style={{ minWidth: 0, fontSize: '0.84rem' }} aria-label="Stock adjustments">
            <thead><tr><th>Date</th><th>Product</th><th style={num}>Quantity</th><th>Reason</th><th>Note</th><th /></tr></thead>
            <tbody>
              {monthAdj.map((a) => (
                <tr key={a.id}>
                  <td>{a.date}</td>
                  <td>{a.productName}</td>
                  <td style={{ ...num, color: a.quantity < 0 ? 'var(--danger)' : 'var(--success)' }}>{a.quantity > 0 ? '+' : ''}{a.quantity} {a.unit || ''}</td>
                  <td>{reasonLabel(a.reason)}</td>
                  <td className="text-muted">{a.note || ''}</td>
                  <td><button type="button" className="icon-btn icon-btn-red" title="Delete (puts the stock back)" aria-label={`Delete adjustment of ${a.productName}`} onClick={() => removeAdj(a)}><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0 1.25rem 1rem', margin: 0 }}>
        Worked back from today&apos;s stock using the dates of your invoices, purchase bills{data.productions.length ? ', production entries' : ''}{data.adjustments.length ? ' and stock adjustments' : ''}. Stock you typed in by hand on the Products screen has no date, so it counts as if it changed today.
        Value is at purchase price; * means no purchase price is saved, so the selling price is used. Negative stock is shown in red and not counted in the total.
      </p>
    </div>
  );
}
