// v1.10.85 (#137, #158) - print barcode labels, from Products (the ticked
// products, 1 label each to start) or from a purchase bill (one label per
// piece bought). The preview is the first sheet of the very page that prints
// (labelSheetHtml in an iframe); Print builds every sheet in a hidden frame
// and opens the browser's print window.
import { useEffect, useMemo, useState } from 'react';
import { Printer, X, Wand2 } from 'lucide-react';
import { getAllProducts, getProfile, saveProduct } from '../store';
import { formatCurrency, getCountryConfig } from '../utils';
import { LABEL_LAYOUTS, labelQtysFromBill, labelSheetHtml, layoutById, mrpOf, nextInternalCode, codeFitsLabel } from '../utils/barcode';
import HelpButton from './HelpButton';
import { toast } from './Toast';

const PREFS_KEY = 'fgsb_labelPrefs';
const MAX_PER_ITEM = 999;
const readPrefs = () => {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') || {}; } catch { return {}; }
};
const savePrefs = (p) => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* private window: not remembered */ } };

// productIds: the ticked products (Products screen). bill (+ its debitNotes):
// a purchase bill. onSaved: products changed here (codes made).
export default function BarcodeLabels({ productIds, bill, debitNotes = [], title = 'Print barcode labels', onClose, onSaved }) {
  const [products, setProducts] = useState(null);
  // What is typed in the count boxes, and (a moment later) what the sheets use.
  const [draft, setDraft] = useState({});
  const [qty, setQty] = useState({});
  const [unmatched, setUnmatched] = useState([]);
  const [profile, setProfile] = useState({});
  const [prefs, setPrefs] = useState(() => ({ layout: LABEL_LAYOUTS[0].id, price: 'selling', business: true, ...readPrefs() }));
  const [making, setMaking] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([getAllProducts(), getProfile().catch(() => ({}))]).then(([all, prof]) => {
      if (!live) return;
      setProducts(all || []);
      setProfile(prof || {});
      const start = bill
        ? Object.fromEntries(labelQtysFromBill(bill, all, debitNotes).rows.map((x) => [x.product.id, String(x.qty)]))
        : Object.fromEntries((productIds || []).map((id) => [id, '1']));
      if (bill) setUnmatched(labelQtysFromBill(bill, all, debitNotes).unmatched);
      setDraft(start);
      setQty(start);
    }).catch(() => toast('Could not load the products', 'error'));
    return () => { live = false; };
    // Filled once, when the window opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Counts are taken 300 ms after the last key, so typing 250 does not draw
  // 2, 25 and 250 sheets. Over 999 of one product is cut to 999, and said so.
  useEffect(() => {
    const t = setTimeout(() => {
      if (Object.values(draft).some((v) => Number(v) > MAX_PER_ITEM)) toast(`At most ${MAX_PER_ITEM} labels of one product at a time`, 'warning');
      setQty(draft);
    }, 300);
    return () => clearTimeout(t);
  }, [draft]);

  const setPref = (k, v) => setPrefs((prev) => { const next = { ...prev, [k]: v }; savePrefs(next); return next; });
  const rows = useMemo(() => (products || []).filter((p) => p.id in draft), [products, draft]);
  const noCode = rows.filter((p) => !p.barcode);
  const tooLong = rows.filter((p) => p.barcode && !codeFitsLabel(p.barcode, prefs.layout));
  const currency = getCountryConfig(profile.country || 'India').currency;

  // One entry per label to print (up to 999 of each product).
  const labels = useMemo(() => {
    const priceText = (p) => (prefs.price === 'mrp' ? `MRP ${formatCurrency(mrpOf(p), currency)}`
      : prefs.price === 'selling' ? formatCurrency(Number(p.sellingPrice ?? p.rate) || 0, currency) : '');
    return (products || []).filter((p) => p.id in qty && p.barcode).flatMap((p) => {
      const n = Math.min(MAX_PER_ITEM, Math.max(0, Math.floor(Number(qty[p.id]) || 0)));
      const one = { name: p.name, code: p.barcode, price: priceText(p), business: prefs.business ? profile.businessName : '' };
      return Array.from({ length: n }, () => one);
    });
  }, [products, qty, prefs.price, prefs.business, profile.businessName, currency]);
  const layout = layoutById(prefs.layout);
  const perSheet = layout.cols * layout.rows;
  const sheets = Math.ceil(labels.length / perSheet);
  // The preview is the first sheet only (a roll: the first few labels).
  const previewHtml = useMemo(() => labelSheetHtml(labels.slice(0, layout.roll ? 6 : perSheet), prefs.layout),
    [labels, prefs.layout, layout.roll, perSheet]);

  // "Give them a code": the next internal code for each product without one.
  const makeCodes = async () => {
    setMaking(true);
    try {
      // The latest list, so a code made on another device meanwhile is not repeated.
      let all = await getAllProducts();
      for (const p of noCode) {
        const cur = all.find((x) => x.id === p.id) || p;
        if (cur.barcode) continue; // given one meanwhile, elsewhere
        const saved = { ...cur, barcode: nextInternalCode(all) };
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

  // Every sheet, in a hidden frame of its own, then the print window.
  const print = () => {
    if (!labels.length) { toast('No labels to print', 'warning'); return; }
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;left:-99999px;top:0;width:0;height:0;border:0;';
    frame.setAttribute('aria-hidden', 'true');
    frame.onload = () => {
      try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch { toast('Printing failed - try again', 'error'); }
      setTimeout(() => frame.remove(), 60000);
    };
    frame.srcdoc = labelSheetHtml(labels, prefs.layout);
    document.body.appendChild(frame);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 940, width: 'calc(96vw / var(--ui-zoom, 1))' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
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
                          aria-label={`Labels for ${p.name}`} value={draft[p.id] ?? ''} disabled={!p.barcode}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setDraft((prev) => ({ ...prev, [p.id]: e.target.value }))} />
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
            {tooLong.length > 0 && (
              <p style={{ fontSize: '0.8rem', margin: '0 0 0.5rem', color: 'var(--warn-text, #b45309)' }} role="alert">
                Too long to scan reliably on this label: {tooLong.map((p) => p.barcode).join(', ')}. Choose a bigger label, or give the product a shorter code.
              </p>
            )}
            {unmatched.length > 0 && (
              <p className="text-muted" style={{ fontSize: '0.8rem', margin: '0 0 0.5rem' }}>
                Not in Products, so no label: {unmatched.join(', ')}
              </p>
            )}
            <iframe className="label-preview" title="Label preview" srcDoc={previewHtml}
              style={{ width: '100%', height: 400, border: '1px solid var(--border)', borderRadius: 6, background: '#e5e7eb' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {labels.length} label{labels.length === 1 ? '' : 's'}{layout.roll ? '' : ` on ${sheets} sheet${sheets === 1 ? '' : 's'}`}{labels.length > (layout.roll ? 6 : perSheet) ? ' (the preview shows the first)' : ''}.
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
