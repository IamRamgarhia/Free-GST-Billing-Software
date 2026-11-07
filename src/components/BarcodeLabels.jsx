// v1.10.85 (#137, #158) - print barcode labels, from Products (the ticked
// products, 1 label each to start) or from a purchase bill (one label per
// piece bought). The preview is the very page that prints: labelSheetHtml in
// an iframe, and Print prints that iframe through the browser's print window.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Printer, X, Wand2 } from 'lucide-react';
import { getAllProducts, getProfile, saveProduct } from '../store';
import { formatCurrency, getCountryConfig } from '../utils';
import { LABEL_LAYOUTS, labelQtysFromBill, labelSheetHtml, layoutById, mrpOf, nextInternalCode } from '../utils/barcode';
import HelpButton from './HelpButton';
import { toast } from './Toast';

const PREFS_KEY = 'fgsb_labelPrefs';
const MAX_PER_ITEM = 999;
const readPrefs = () => {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') || {}; } catch { return {}; }
};
const savePrefs = (p) => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* private window: not remembered */ } };

// productIds: the ticked products (Products screen). billItems: the lines of
// a purchase bill. onSaved: products changed here (codes made).
export default function BarcodeLabels({ productIds, billItems, title = 'Print barcode labels', onClose, onSaved }) {
  const [products, setProducts] = useState(null);
  const [qty, setQty] = useState({});
  const [unmatched, setUnmatched] = useState([]);
  const [profile, setProfile] = useState({});
  const [prefs, setPrefs] = useState(() => ({ layout: LABEL_LAYOUTS[0].id, price: 'selling', business: true, ...readPrefs() }));
  const [making, setMaking] = useState(false);
  const frameRef = useRef(null);

  useEffect(() => {
    let live = true;
    Promise.all([getAllProducts(), getProfile().catch(() => ({}))]).then(([all, prof]) => {
      if (!live) return;
      setProducts(all || []);
      setProfile(prof || {});
      if (billItems) {
        const r = labelQtysFromBill(billItems, all);
        setQty(Object.fromEntries(r.rows.map((x) => [x.product.id, String(x.qty)])));
        setUnmatched(r.unmatched);
      } else {
        setQty(Object.fromEntries((productIds || []).map((id) => [id, '1'])));
      }
    }).catch(() => toast('Could not load the products', 'error'));
    return () => { live = false; };
    // Filled once, when the window opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setPref = (k, v) => setPrefs((prev) => { const next = { ...prev, [k]: v }; savePrefs(next); return next; });
  const rows = useMemo(() => (products || []).filter((p) => p.id in qty), [products, qty]);
  const noCode = rows.filter((p) => !p.barcode);
  const currency = getCountryConfig(profile.country || 'India').currency;
  const priceText = (p) => (prefs.price === 'mrp' ? `MRP ${formatCurrency(mrpOf(p), currency)}`
    : prefs.price === 'selling' ? formatCurrency(Number(p.sellingPrice ?? p.rate) || 0, currency) : '');

  // One entry per label to print (up to 999 of each product).
  const labels = rows.filter((p) => p.barcode).flatMap((p) => {
    const n = Math.min(MAX_PER_ITEM, Math.max(0, Math.floor(Number(qty[p.id]) || 0)));
    const one = { name: p.name, code: p.barcode, price: priceText(p), business: prefs.business ? profile.businessName : '' };
    return Array.from({ length: n }, () => one);
  });
  const html = labelSheetHtml(labels, prefs.layout);
  const layout = layoutById(prefs.layout);
  const sheets = Math.ceil(labels.length / (layout.cols * layout.rows));

  // "Give them a code": the next internal code for each product without one.
  const makeCodes = async () => {
    setMaking(true);
    try {
      let all = products;
      for (const p of noCode) {
        const saved = { ...p, barcode: nextInternalCode(all) };
        await saveProduct(saved);
        all = all.map((x) => (x.id === p.id ? saved : x));
      }
      setProducts(all);
      toast(`${noCode.length} product${noCode.length === 1 ? '' : 's'} got a barcode`, 'success');
      onSaved?.();
    } catch {
      toast('Could not save the barcodes', 'error');
    } finally {
      setMaking(false);
    }
  };

  const print = () => {
    if (!labels.length) { toast('No labels to print', 'warning'); return; }
    try {
      const w = frameRef.current?.contentWindow;
      w.focus();
      w.print();
    } catch {
      toast('Printing failed - try again', 'error');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 940, width: '96vw' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 className="section-title" style={{ margin: 0 }}>{title} <HelpButton title="Barcode labels" doc="products#barcode-labels" size={16} /></h3>
          <button type="button" className="icon-btn" onClick={onClose} title="Close" aria-label="Close"><X size={18} /></button>
        </div>
        {!products ? <p className="text-muted">Loading...</p> : (
          <>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
              <div className="form-group" style={{ margin: 0, minWidth: 260 }}>
                <label className="form-label" htmlFor="label-layout">Labels</label>
                <select id="label-layout" className="form-input" value={prefs.layout} onChange={(e) => setPref('layout', e.target.value)}>
                  {LABEL_LAYOUTS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="label-price">Price on the label</label>
                <select id="label-price" className="form-input" value={prefs.price} onChange={(e) => setPref('price', e.target.value)}>
                  <option value="selling">Selling price</option>
                  <option value="mrp">MRP (selling price with GST)</option>
                  <option value="none">No price</option>
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', paddingBottom: 8 }}>
                <input type="checkbox" checked={!!prefs.business} onChange={(e) => setPref('business', e.target.checked)} />
                Business name
              </label>
            </div>
            <div className="table-scroll" style={{ maxHeight: 190, overflowY: 'auto', marginBottom: '0.5rem' }}>
              <table className="data-table" style={{ fontSize: '0.85rem', minWidth: 0 }}>
                <thead><tr><th>Product</th><th>Barcode</th><th style={{ width: 110 }}>Labels</th></tr></thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td className="text-muted">{p.barcode || 'No barcode'}</td>
                      <td>
                        <input type="number" className="form-input" min="0" max={MAX_PER_ITEM} step="1" style={{ width: 90 }}
                          aria-label={`Labels for ${p.name}`} value={qty[p.id] ?? ''} disabled={!p.barcode}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setQty((prev) => ({ ...prev, [p.id]: e.target.value }))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {noCode.length > 0 && (
              <p style={{ fontSize: '0.82rem', margin: '0 0 0.5rem', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span>{noCode.length} {noCode.length === 1 ? 'product has' : 'products have'} no barcode yet, so no label.</span>
                <button type="button" className="btn btn-secondary" onClick={makeCodes} disabled={making}
                  title="Gives each one the next code of the shop's own (20000001, 20000002, ...)">
                  <Wand2 size={14} /> Give {noCode.length === 1 ? 'it' : 'them'} a code
                </button>
              </p>
            )}
            {unmatched.length > 0 && (
              <p className="text-muted" style={{ fontSize: '0.8rem', margin: '0 0 0.5rem' }}>
                Not in Products, so no label: {unmatched.join(', ')}
              </p>
            )}
            <iframe ref={frameRef} className="label-preview" title="Label preview" srcDoc={html}
              style={{ width: '100%', height: 400, border: '1px solid var(--border)', borderRadius: 6, background: '#e5e7eb' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {labels.length} label{labels.length === 1 ? '' : 's'}{layout.roll ? '' : ` on ${sheets} sheet${sheets === 1 ? '' : 's'}`}.
                {' '}In the print window choose {layout.roll ? 'your label printer, ' : ''}scale 100% (Actual size) and margins None.
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
                <button type="button" className="btn btn-primary" onClick={print} disabled={!labels.length}><Printer size={16} /> Print</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
