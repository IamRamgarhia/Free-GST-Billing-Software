import { useState, useEffect, lazy, Suspense } from 'react';
import { ShoppingCart, Plus, Edit3, Trash2, Search, X, Save, Download, Wand2, FileText, Eye } from 'lucide-react';
import HelpButton from './HelpButton';
import { getAllPurchases, savePurchase, deletePurchase, getAllProducts, saveProduct } from '../store';
import { formatCurrency, calculateRoundOff, getFYOptions } from '../utils';
import { getPrintSettings } from '../utils/printSettings';
import { toast } from './Toast';
import { confirmAction, promptAction } from './ConfirmModal';

// v1.10.31 — UI-C3: Same accent-color helper as ClientsView so the
// Purchase Bill PDF header rule + totals line pick up the user's brand.
function getAccentRGB() {
  try {
    const ps = getPrintSettings();
    if (ps.userColorsEnabled && ps.pdfAccent) {
      const hex = String(ps.pdfAccent).replace('#', '');
      if (/^[0-9a-f]{6}$/i.test(hex)) {
        return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
      }
    }
  } catch { /* ignore */ }
  return [30, 64, 175];
}

// v1.10.22 — Purchase-bill OCR modal. Lazy-loaded because tesseract.js is
// ~2MB gzipped; we only pay the download cost when the user actually
// opens the OCR flow.
const BillOCR = lazy(() => import('./BillOCR'));

const PAYMENT_STATUSES = ['Unpaid', 'Paid', 'Partial'];

// cessPercent added in v1.6.8 (P1 #16) — suppliers of tobacco / aerated
// drinks / motor vehicles / coal charge GST + Cess. Without a slot for it,
// we couldn't reclaim ITC on the cess in GSTR-3B Table 4(A).
const emptyItem = { name: '', hsn: '', quantity: 1, rate: 0, taxPercent: 18, cessPercent: 0 };

const emptyForm = {
  date: new Date().toISOString().split('T')[0],
  supplierName: '',
  // v1.10.29 — supplier address for the PDF header. Optional; blank
  // pre-v1.10.29 records fall through gracefully.
  supplierAddress: '',
  supplierGstin: '',
  invoiceNumber: '',
  items: [{ ...emptyItem }],
  paymentStatus: 'Unpaid',
  interstate: false, // true ⇒ supplier charged IGST; false ⇒ CGST + SGST. Routes ITC correctly in GSTR-3B.
  applyRoundOff: false, // off by default — purchase bill totals are usually pre-rounded by the supplier. Users with suppliers that don't pre-round can opt in here.
  note: '',
};

function calcItemTax(item) {
  const amount = (item.quantity || 0) * (item.rate || 0);
  const tax = (amount * (item.taxPercent || 0)) / 100;
  const cess = (amount * (Number(item.cessPercent) || 0)) / 100;
  return { amount, tax, cess, total: amount + tax + cess };
}

function calcPurchaseTotal(items, applyRoundOff = false) {
  const raw = (items || []).reduce((acc, item) => {
    const { amount, tax, cess, total } = calcItemTax(item);
    return {
      taxable: acc.taxable + amount,
      tax: acc.tax + tax,
      cess: acc.cess + cess,
      total: acc.total + total,
    };
  }, { taxable: 0, tax: 0, cess: 0, total: 0 });
  // Round-off is applied to the GRAND total (taxable + tax + cess). Stored
  // as a separate line so GSTR-3B input tax credit reflects the supplier's
  // actual tax amount, not a rounded version.
  const roundOff = applyRoundOff ? calculateRoundOff(raw.total) : 0;
  return { ...raw, roundOff, finalTotal: raw.total + roundOff };
}

// v1.10.6 — audit L4: local copy removed, imported from utils above.

export default function PurchaseBills() {
  const [purchases, setPurchases] = useState([]);
  const [search, setSearch] = useState('');
  const [fyFilter, setFyFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm, items: [{ ...emptyItem }] });
  // v1.10.22 — OCR modal state.
  const [showOCR, setShowOCR] = useState(false);
  // v1.10.30 — reported: "add a view only option modal type so can user
  // check the price without downloading the file every time". Holds the
  // purchase being previewed; modal has a Download PDF button inside.
  const [viewPurchase, setViewPurchase] = useState(null);
  const applyOCR = (extracted) => {
    // v1.10.35 — Now consumes the richer payload from BillOCR:
    // extracted.items[] with name/hsn/qty/rate/taxPercent/amount, and
    // extracted.taxBreakdown with cgst/sgst/igst/cess. Falls back to
    // the old single-line-from-grand-total behaviour only if no line
    // items were detected at all.
    setEditingId(null);
    let items;
    if (Array.isArray(extracted.items) && extracted.items.length > 0) {
      // Trust the OCR-extracted line items. Strip the internal match
      // metadata (_matchedProductId etc.) since the purchase form
      // doesn't consume it.
      items = extracted.items.map(it => ({
        name: it.name || '',
        hsn: it.hsn || '',
        quantity: Number(it.quantity) || 1,
        rate: Number(it.rate) || 0,
        taxPercent: Number(it.taxPercent) || 0,
        cessPercent: 0,
      }));
    } else if (extracted.grandTotal > 0) {
      // Legacy fallback — no line items detected, seed a single-row
      // placeholder from the grand total so the user has something to
      // split.
      items = [{ name: 'From OCR — split into real items', hsn: '', quantity: 1, rate: extracted.grandTotal, taxPercent: 0, cessPercent: 0 }];
    } else {
      items = [{ ...emptyItem }];
    }
    setForm({
      ...emptyForm,
      date: extracted.date || emptyForm.date,
      supplierName: extracted.supplierName || '',
      supplierGstin: extracted.supplierGstin || '',
      invoiceNumber: extracted.invoiceNumber || '',
      items,
    });
    setShowForm(true);
    const msg = Array.isArray(extracted.items) && extracted.items.length > 0
      ? `OCR loaded ${extracted.items.length} line item${extracted.items.length === 1 ? '' : 's'} — review HSN + tax rates before saving.`
      : 'OCR values loaded — please review, then break the total into line items with correct GST.';
    toast(msg, 'info');
  };

  const fyOptions = getFYOptions();

  const loadPurchases = async () => {
    try {
      setPurchases(await getAllPurchases());
    } catch {
      toast('Failed to load purchases', 'error');
    }
  };

  useEffect(() => {
    if (fyOptions[0]) setFyFilter(fyOptions[0].value);
    loadPurchases();
  }, []);

  const filtered = purchases.filter(p => {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!(p.supplierName || '').toLowerCase().includes(q) &&
          !(p.invoiceNumber || '').toLowerCase().includes(q) &&
          !(p.supplierGstin || '').toLowerCase().includes(q)) return false;
    }
    if (fyFilter) {
      const fy = fyOptions.find(f => f.value === fyFilter);
      if (fy && p.date) {
        if (p.date < fy.from || p.date > fy.to) return false;
      }
    }
    return true;
  });

  const totalStats = filtered.reduce((acc, p) => {
    const t = calcPurchaseTotal(p.items, !!p.applyRoundOff);
    return { taxable: acc.taxable + t.taxable, tax: acc.tax + t.tax, total: acc.total + t.finalTotal };
  }, { taxable: 0, tax: 0, total: 0 });

  const openAdd = () => {
    setForm({ ...emptyForm, items: [{ ...emptyItem }] });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (purchase) => {
    setForm({
      date: purchase.date || '',
      supplierName: purchase.supplierName || '',
      supplierAddress: purchase.supplierAddress || '',
      supplierGstin: purchase.supplierGstin || '',
      invoiceNumber: purchase.invoiceNumber || '',
      items: purchase.items && purchase.items.length > 0 ? purchase.items.map(i => ({ ...i })) : [{ ...emptyItem }],
      paymentStatus: purchase.paymentStatus || 'Unpaid',
      interstate: !!purchase.interstate,
      // Detect round-off from older entries: if roundOff field exists and is
      // non-zero, treat applyRoundOff as on. Older entries without the field
      // just default to off — they won't suddenly change totals on re-save.
      applyRoundOff: !!purchase.applyRoundOff || (typeof purchase.roundOff === 'number' && purchase.roundOff !== 0),
      note: purchase.note || '',
    });
    setEditingId(purchase.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm, items: [{ ...emptyItem }] });
  };

  // v1.10.29 — reported: "option to view as pdf give it that will be
  // better". Generates a simple one-page purchase-bill PDF with header,
  // supplier block, line items table, tax breakdown, and total. Uses
  // jsPDF's built-in text/rect helpers (same as the ledger PDF) so we
  // don't pull autotable and keep the bundle small.
  const viewAsPdf = async (purchase) => {
    try {
      const { jsPDF } = await import('jspdf');
      const t = calcPurchaseTotal(purchase.items, !!purchase.applyRoundOff);
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const marginL = 15, marginR = 195;
      let y = 20;
      const fmt = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      doc.setFontSize(18); doc.setFont('helvetica', 'bold');
      doc.text('PURCHASE BILL', marginL, y); y += 8;
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
      doc.text(`Invoice #: ${purchase.invoiceNumber || '-'}`, marginL, y); y += 5;
      doc.text(`Date: ${purchase.date ? new Date(purchase.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}`, marginL, y); y += 5;
      doc.text(`Payment: ${purchase.paymentStatus || 'Unpaid'}   ·   ${purchase.interstate ? 'Interstate (IGST)' : 'Intrastate (CGST+SGST)'}`, marginL, y); y += 8;
      doc.setDrawColor(...getAccentRGB()); doc.setLineWidth(0.5);
      doc.line(marginL, y, marginR, y); y += 8;

      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
      doc.text('Supplier', marginL, y); y += 6;
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text(purchase.supplierName || '-', marginL, y); y += 5;
      // v1.10.29 — supplier address (wraps at ~110mm so it doesn't collide
      // with anything on the right side of the header).
      if (purchase.supplierAddress) {
        const wrapped = doc.splitTextToSize(purchase.supplierAddress, 110);
        wrapped.forEach(line => { doc.text(line, marginL, y); y += 5; });
      }
      if (purchase.supplierGstin) { doc.text(`GSTIN: ${purchase.supplierGstin}`, marginL, y); y += 5; }
      y += 4;

      // Items header
      doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text('#', marginL, y);
      doc.text('Description', marginL + 8, y);
      doc.text('HSN', marginL + 80, y);
      doc.text('Qty', marginL + 100, y, { align: 'right' });
      doc.text('Rate', marginL + 122, y, { align: 'right' });
      doc.text('GST%', marginL + 140, y, { align: 'right' });
      doc.text('Amount', marginR, y, { align: 'right' });
      y += 2; doc.setLineWidth(0.2); doc.line(marginL, y, marginR, y); y += 5;

      doc.setFont('helvetica', 'normal');
      (purchase.items || []).forEach((item, idx) => {
        if (y > 265) { doc.addPage(); y = 20; }
        const lineTotal = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
        const withTax = lineTotal * (1 + (Number(item.taxPercent) || 0) / 100);
        // v1.10.30 — reported: "in purchase bill pdf long names got cut in
        // pdf fix". Prior code used `.slice(0, 40)` which mid-word truncated
        // "4 Copier Paper (Pack of..." → "4 Copier Paper (Pack o". Now we
        // wrap the description into as many lines as needed (70mm column
        // width). The row height grows to fit the wrapped text so nothing
        // clips into the next line.
        const nameCol = 70; // mm — width of description column
        const nameLines = doc.splitTextToSize(String(item.name || '-'), nameCol);
        const rowH = Math.max(6, nameLines.length * 4.5);
        // Page break if this row won't fit.
        if (y + rowH > 275) { doc.addPage(); y = 20; }
        doc.text(String(idx + 1), marginL, y);
        // Description wraps top-aligned.
        nameLines.forEach((line, lineIdx) => {
          doc.text(line, marginL + 8, y + lineIdx * 4.5);
        });
        // Everything else aligns to the top of the row (so it lines up
        // with the first line of the wrapped description).
        doc.text(String(item.hsn || '-'), marginL + 80, y);
        doc.text(String(item.quantity || 0), marginL + 100, y, { align: 'right' });
        doc.text(fmt(item.rate), marginL + 122, y, { align: 'right' });
        doc.text(String(item.taxPercent || 0) + '%', marginL + 140, y, { align: 'right' });
        doc.text(fmt(withTax), marginR, y, { align: 'right' });
        y += rowH;
      });

      // Totals
      y += 4; doc.setDrawColor(...getAccentRGB()); doc.setLineWidth(0.4);
      doc.line(marginL + 100, y, marginR, y); y += 6;
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80);
      doc.text('Taxable', marginL + 100, y); doc.text(fmt(t.taxable), marginR, y, { align: 'right' }); y += 5;
      doc.text('Tax (CGST+SGST or IGST)', marginL + 100, y); doc.text(fmt(t.tax), marginR, y, { align: 'right' }); y += 5;
      if (t.cess > 0.005) { doc.text('Cess', marginL + 100, y); doc.text(fmt(t.cess), marginR, y, { align: 'right' }); y += 5; }
      if (Math.abs(t.roundOff) > 0.005) { doc.text('Round-off', marginL + 100, y); doc.text((t.roundOff > 0 ? '+' : '') + fmt(t.roundOff), marginR, y, { align: 'right' }); y += 5; }
      y += 2; doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(marginL + 100, y, marginR, y); y += 6;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(0);
      doc.text('TOTAL', marginL + 100, y); doc.text(fmt(t.finalTotal), marginR, y, { align: 'right' });

      if (purchase.note) {
        y += 14; doc.setFontSize(9); doc.setFont('helvetica', 'italic'); doc.setTextColor(90);
        doc.text('Note: ' + purchase.note, marginL, y);
      }

      const safeInv = String(purchase.invoiceNumber || 'purchase').replace(/[^A-Za-z0-9._-]/g, '_');
      const filename = `Purchase-${safeInv}-${purchase.date || 'undated'}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error('Purchase PDF failed:', err);
      toast('Could not generate PDF — see console', 'error');
    }
  };

  const handleSave = async () => {
    if (!form.supplierName.trim()) { toast('Supplier name is required', 'warning'); return; }
    if (!form.invoiceNumber.trim()) { toast('Invoice number is required', 'warning'); return; }
    try {
      const totals = calcPurchaseTotal(form.items, form.applyRoundOff);
      const purchase = {
        ...(editingId ? { id: editingId } : {}),
        date: form.date,
        supplierName: form.supplierName.trim(),
        supplierAddress: (form.supplierAddress || '').trim(),
        supplierGstin: form.supplierGstin.trim(),
        invoiceNumber: form.invoiceNumber.trim(),
        items: form.items.map(i => ({
          name: (i.name || '').trim(),
          hsn: (i.hsn || '').trim(),
          quantity: parseFloat(i.quantity) || 0,
          rate: parseFloat(i.rate) || 0,
          taxPercent: parseFloat(i.taxPercent) || 0,
          cessPercent: parseFloat(i.cessPercent) || 0,
        })),
        // totalAmount is the grand total INCLUDING round-off so the table
        // sum and GSTR-3B reconciliation both reflect what the supplier
        // actually charged. roundOff stored separately for audit clarity.
        totalAmount: totals.finalTotal,
        totalTax: totals.tax,
        taxableAmount: totals.taxable,
        applyRoundOff: !!form.applyRoundOff,
        roundOff: totals.roundOff,
        paymentStatus: form.paymentStatus,
        interstate: !!form.interstate,
        note: form.note.trim(),
      };
      await savePurchase(purchase);

      // v1.10.29 — reported: "items added in purchase bill also available
      // for sale means automatically added to the product page too".
      // On save, upsert each line item into Products. Match by trimmed
      // lowercase name to avoid duplicates. For existing products we
      // update purchasePrice (latest cost) but leave sellingPrice alone
      // so we don't accidentally overwrite the user's margin. For new
      // products we seed sellingPrice = purchasePrice as a starting
      // point (user can raise it in Inventory later). Runs in parallel
      // and non-fatal — a single-item failure doesn't block the
      // purchase-bill save.
      // v1.10.31 — Data-F10.1-3: delta-based stock sync. Previously stock
      // was incremented only on FIRST save (create). If the user edited the
      // purchase later — changing qty from 10 → 20, or removing a line, or
      // renaming a line — the product's stock stayed at 10 (F10.1) or a
      // duplicate product was created (F10.3). Now:
      //   • Save (edit path): compute per-line delta from the pre-edit
      //     snapshot; apply that delta to each existing product's stock.
      //   • Save (create path): increment stock by full quantity.
      //   • Rename detection: match by productId first (persisted below),
      //     then by name — a rename with productId keeps the same product.
      try {
        const existingProducts = await getAllProducts();
        const byName = new Map(existingProducts.map(p => [(p.name || '').trim().toLowerCase(), p]));
        const byId = new Map(existingProducts.map(p => [p.id, p]));

        // Pre-edit snapshot: on edit, compute deltas per productId/name.
        const priorLines = editingId
          ? (purchases.find(p => p.id === editingId)?.items || [])
          : [];
        const priorQtyByKey = new Map();
        for (const p of priorLines) {
          const key = p.productId || `name:${(p.name || '').trim().toLowerCase()}`;
          priorQtyByKey.set(key, (priorQtyByKey.get(key) || 0) + (Number(p.quantity) || 0));
        }

        // Batch stock adjustments per product so we don't race on parallel saves.
        const stockDeltaById = new Map();
        const productsToUpsert = new Map();

        for (const it of purchase.items.filter(x => x.name)) {
          const qty = Number(it.quantity) || 0;
          // Match order: productId (persisted below) → name (case-insensitive).
          let existing = it.productId ? byId.get(it.productId) : null;
          if (!existing) {
            const key = it.name.trim().toLowerCase();
            existing = byName.get(key);
          }
          if (existing) {
            // Delta = current qty − prior qty (for this product).
            const priorKey = it.productId
              ? it.productId
              : `name:${(it.name || '').trim().toLowerCase()}`;
            const priorQty = priorQtyByKey.get(priorKey) || 0;
            const delta = qty - priorQty; // may be negative (line reduced) or zero (unchanged)
            stockDeltaById.set(existing.id, (stockDeltaById.get(existing.id) || 0) + delta);
            productsToUpsert.set(existing.id, {
              ...existing,
              purchasePrice: it.rate,
              hsn: existing.hsn || it.hsn,
              taxPercent: existing.taxPercent || it.taxPercent,
              cessPercent: existing.cessPercent || it.cessPercent || 0,
              // stock filled after we sum all deltas for this product.
              _placeholderId: existing.id,
            });
          } else {
            // New product — seed stock with the line qty.
            productsToUpsert.set(`__new__::${it.name.trim().toLowerCase()}`, {
              name: it.name.trim(),
              hsn: it.hsn || '',
              purchasePrice: it.rate,
              sellingPrice: it.rate,
              rate: it.rate,
              taxPercent: it.taxPercent || 0,
              cessPercent: it.cessPercent || 0,
              unit: 'Nos',
              stock: qty,
              description: '',
            });
          }
        }

        // Apply deltas + write.
        const upserts = [];
        for (const [key, prod] of productsToUpsert) {
          if (prod._placeholderId) {
            const existing = byId.get(prod._placeholderId);
            const delta = stockDeltaById.get(prod._placeholderId) || 0;
            const newStock = Math.max(0, (Number(existing.stock) || 0) + delta);
            upserts.push(saveProduct({ ...prod, stock: newStock, _placeholderId: undefined }));
          } else {
            upserts.push(saveProduct(prod));
          }
        }
        await Promise.all(upserts);
      } catch (e) {
        console.warn('Products auto-sync from purchase failed (non-fatal):', e);
      }

      toast(editingId ? 'Purchase updated' : 'Purchase added — items synced to Products', 'success');
      closeForm();
      loadPurchases();
    } catch {
      toast('Failed to save purchase', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (await confirmAction({
      title: 'Delete this purchase bill?',
      message: 'Stock levels for the products in this bill will be reverted. Any GST ITC already claimed against this bill in past returns stays as filed.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })) {
      try {
        await deletePurchase(id);
        toast('Purchase deleted', 'success');
        loadPurchases();
      } catch {
        toast('Failed to delete', 'error');
      }
    }
  };

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const updateItem = (index, field, value) => {
    setForm(prev => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const addItem = () => {
    // Tag the new row so we can focus its first input after React renders.
    // Tab → Enter on the Add Item button now keeps the user in keyboard
    // flow instead of forcing a mouse click on the empty row.
    const focusKey = 'new-' + Date.now();
    setForm(prev => ({ ...prev, items: [...prev.items, { ...emptyItem, _focusKey: focusKey }] }));
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-focus-key="${focusKey}"] input.form-input`);
      if (el) el.focus();
    });
  };

  const removeItem = (index) => {
    if (form.items.length <= 1) return;
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const exportCSV = () => {
    if (filtered.length === 0) { toast('No purchases to export', 'warning'); return; }
    const headers = ['Date', 'Supplier', 'GSTIN', 'Invoice No', 'Taxable Amount', 'Tax', 'Round-off', 'Total', 'Status', 'Note'];
    const escape = (v) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const lines = [headers.map(escape).join(',')];
    filtered.forEach(p => {
      const t = calcPurchaseTotal(p.items, !!p.applyRoundOff);
      lines.push([p.date, p.supplierName, p.supplierGstin, p.invoiceNumber, t.taxable.toFixed(2), t.tax.toFixed(2), t.roundOff.toFixed(2), t.finalTotal.toFixed(2), p.paymentStatus, p.note].map(escape).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'purchases.csv'; a.click();
    URL.revokeObjectURL(url);
    toast('Purchases CSV downloaded', 'success');
  };

  const formTotals = calcPurchaseTotal(form.items, form.applyRoundOff);

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div>
            <h1 className="page-title">Purchase Bills</h1>
            <p className="page-subtitle">Track supplier invoices for ITC claims in GSTR-3B</p>
          </div>
          <HelpButton title="Purchase Bills — how to use">
            <ul style={{ paddingLeft: '1.1rem', margin: 0 }}>
              <li><strong>Add Purchase</strong> — record every supplier tax invoice you receive. The GST paid becomes your ITC (input tax credit) in GSTR-3B.</li>
              <li><strong>Import from image (OCR)</strong> — snap the supplier's invoice with your phone. The app extracts supplier GSTIN, invoice number, date, and grand total. Line items still need manual entry (bill layouts vary too much for reliable auto-parsing).</li>
              <li><strong>Interstate toggle</strong> — flip ON when the supplier is in a different state (they charged IGST) so ITC routes correctly.</li>
              <li><strong>Payment status</strong> — Unpaid / Partial / Paid drives the "amount payable to suppliers" report.</li>
              <li><strong>Export CSV</strong> — hand to your CA at return time.</li>
            </ul>
          </HelpButton>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={exportCSV}><Download size={16} /> Export CSV</button>
          <button className="btn btn-secondary" onClick={() => setShowOCR(true)} title="Extract fields from a bill photo/scan">
            <Wand2 size={16} /> Import from image (OCR)
          </button>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Add Purchase</button>
        </div>
      </div>

      {/* v1.10.22 — Bill OCR modal (tesseract.js, lazy-loaded). */}
      {showOCR && (
        <Suspense fallback={<div className="modal-overlay"><div className="modal-content" style={{ maxWidth: 320, textAlign: 'center' }}>Loading OCR…</div></div>}>
          <BillOCR onClose={() => setShowOCR(false)} onExtracted={applyOCR} />
        </Suspense>
      )}

      {/* v1.10.30 — Purchase view modal (quick check, no download). */}
      {viewPurchase && (() => {
        const p = viewPurchase;
        const t = calcPurchaseTotal(p.items, !!p.applyRoundOff);
        return (
          <div className="modal-overlay" onClick={() => setViewPurchase(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 className="section-title" style={{ margin: 0 }}>Purchase Bill · {p.invoiceNumber || '—'}</h3>
                <button className="icon-btn" onClick={() => setViewPurchase(null)} title="Close"><X size={18} /></button>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                {p.date ? new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''} · {p.paymentStatus || 'Unpaid'} · {p.interstate ? 'Interstate (IGST)' : 'Intrastate (CGST+SGST)'}
              </div>
              {/* Supplier block */}
              <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem 1rem', borderRadius: 6, marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Supplier</div>
                <div style={{ fontWeight: 600 }}>{p.supplierName || '—'}</div>
                {p.supplierAddress && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{p.supplierAddress}</div>}
                {p.supplierGstin && <div style={{ fontSize: '0.82rem' }}>GSTIN: <strong>{p.supplierGstin}</strong></div>}
              </div>
              {/* Line items */}
              <div style={{ overflowX: 'auto', maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, marginBottom: '1rem' }}>
                <table className="data-table" style={{ fontSize: '0.82rem', width: '100%', minWidth: 500 }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Description</th>
                      <th>HSN</th>
                      <th style={{ textAlign: 'right' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Rate</th>
                      <th style={{ textAlign: 'right' }}>GST%</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(p.items || []).map((it, idx) => {
                      const line = (Number(it.quantity) || 0) * (Number(it.rate) || 0);
                      const withTax = line * (1 + (Number(it.taxPercent) || 0) / 100);
                      return (
                        <tr key={idx}>
                          <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                          <td style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{it.name || '—'}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{it.hsn || '—'}</td>
                          <td style={{ textAlign: 'right' }}>{it.quantity || 0}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(it.rate || 0)}</td>
                          <td style={{ textAlign: 'right' }}>{it.taxPercent || 0}%</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(withTax)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Totals */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.35rem 1rem', fontSize: '0.9rem', maxWidth: 320, marginLeft: 'auto' }}>
                <span style={{ color: 'var(--text-muted)' }}>Taxable</span>
                <span style={{ textAlign: 'right' }}>{formatCurrency(t.taxable)}</span>
                <span style={{ color: 'var(--text-muted)' }}>Tax</span>
                <span style={{ textAlign: 'right' }}>{formatCurrency(t.tax)}</span>
                {t.cess > 0.005 && <><span style={{ color: 'var(--text-muted)' }}>Cess</span><span style={{ textAlign: 'right' }}>{formatCurrency(t.cess)}</span></>}
                {Math.abs(t.roundOff) > 0.005 && <><span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Round-off</span><span style={{ textAlign: 'right', fontStyle: 'italic' }}>{(t.roundOff > 0 ? '+' : '') + formatCurrency(t.roundOff)}</span></>}
                <span style={{ borderTop: '2px solid var(--text)', paddingTop: 6, fontWeight: 700 }}>TOTAL</span>
                {/* v1.10.34 — was hardcoded color:'#0f172a' (slate-900) which
                    disappeared against the dark card background. Reported
                    with screenshot showing invisible total on Purchase Bill
                    view modal. Now uses --text so it flips with theme. */}
                <span style={{ borderTop: '2px solid var(--text)', paddingTop: 6, textAlign: 'right', fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)' }}>{formatCurrency(t.finalTotal)}</span>
              </div>
              {p.note && <p style={{ fontSize: '0.82rem', fontStyle: 'italic', color: 'var(--text-muted)', marginTop: '1rem' }}>Note: {p.note}</p>}
              {/* Action bar */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <button className="btn btn-secondary" onClick={() => setViewPurchase(null)}>Close</button>
                <button className="btn btn-secondary" onClick={() => { openEdit(p); setViewPurchase(null); }}><Edit3 size={14} /> Edit</button>
                <button className="btn btn-primary" onClick={() => viewAsPdf(p)}><Download size={14} /> Download PDF</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-icon stat-icon-purple"><ShoppingCart size={22} /></div>
          <div><p className="stat-label">Total Purchases</p><h2 className="stat-value stat-value-purple">{formatCurrency(totalStats.total)}</h2></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-green"><ShoppingCart size={22} /></div>
          <div><p className="stat-label">GST (ITC Eligible)</p><h2 className="stat-value stat-value-green">{formatCurrency(totalStats.tax)}</h2></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue"><ShoppingCart size={22} /></div>
          <div><p className="stat-label">Entries</p><h2 className="stat-value">{filtered.length}</h2></div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel p-4 mb-6">
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-box" style={{ maxWidth: '300px' }}>
            <Search size={16} className="search-icon" />
            <input type="text" placeholder="Search supplier, invoice..." value={search}
              onChange={e => setSearch(e.target.value)} className="search-input" />
          </div>
          <select className="filter-select" value={fyFilter} onChange={e => setFyFilter(e.target.value)}>
            {fyOptions.map(fy => <option key={fy.value} value={fy.value}>{fy.label}</option>)}
          </select>
          {search && (
            <button className="icon-btn icon-btn-red" onClick={() => setSearch('')} title="Clear search" aria-label="Clear search"><X size={15} /></button>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '720px' }}>
            <h3 className="section-title">{editingId ? 'Edit Purchase Bill' : 'Add Purchase Bill'}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input type="date" className="form-input" value={form.date} onChange={e => updateField('date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Status</label>
                <select className="form-input" value={form.paymentStatus} onChange={e => updateField('paymentStatus', e.target.value)}>
                  {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Supplier Name *</label>
                <input type="text" className="form-input" value={form.supplierName}
                  onChange={e => updateField('supplierName', e.target.value)} placeholder="Vendor / Supplier name" />
              </div>
              <div className="form-group">
                <label className="form-label">Supplier GSTIN</label>
                <input type="text" className="form-input" value={form.supplierGstin}
                  onChange={e => updateField('supplierGstin', e.target.value)} placeholder="15-digit GSTIN" maxLength={15} />
              </div>
              {/* v1.10.29 — Supplier address for the PDF. Optional; full width row. */}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Supplier Address (optional)</label>
                <input type="text" className="form-input" value={form.supplierAddress || ''}
                  onChange={e => updateField('supplierAddress', e.target.value)}
                  placeholder="Street, City, State — printed on the Purchase Bill PDF" />
              </div>
              <div className="form-group">
                <label className="form-label">Invoice Number *</label>
                <input type="text" className="form-input" value={form.invoiceNumber}
                  onChange={e => updateField('invoiceNumber', e.target.value)} placeholder="Supplier invoice no." />
              </div>
              <div className="form-group">
                <label className="form-label">Note (optional)</label>
                <input type="text" className="form-input" value={form.note}
                  onChange={e => updateField('note', e.target.value)} placeholder="Any note..." />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!form.interstate}
                    onChange={e => updateField('interstate', e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
                  <span>
                    <strong>Inter-state purchase</strong> — supplier charged IGST (different state)
                    <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block' }}>
                      Routes ITC to IGST in GSTR-3B instead of CGST + SGST. Tip: first 2 digits of supplier GSTIN = their state code.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {/* Items */}
            <h4 style={{ marginTop: '1rem', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Items</h4>
            {form.items.map((item, idx) => (
              <div key={idx} data-focus-key={item._focusKey} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: 2, margin: 0 }}>
                  {idx === 0 && <label className="form-label">Name</label>}
                  <input type="text" className="form-input" value={item.name}
                    onChange={e => updateItem(idx, 'name', e.target.value)} placeholder="Item name" />
                </div>
                <div className="form-group" style={{ flex: 1, margin: 0 }}>
                  {idx === 0 && <label className="form-label">HSN</label>}
                  <input type="text" className="form-input" value={item.hsn}
                    onChange={e => updateItem(idx, 'hsn', e.target.value)} placeholder="HSN" />
                </div>
                <div className="form-group" style={{ flex: 0.7, margin: 0 }}>
                  {idx === 0 && <label className="form-label">Qty</label>}
                  {/* v1.6.8 (P2 #30): decimal quantity for 2.5 kg / 0.5 hr / etc. */}
                  <input type="number" className="form-input" value={item.quantity} min="0" step="any"
                    onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: 1, margin: 0 }}>
                  {idx === 0 && <label className="form-label">Rate</label>}
                  <input type="number" className="form-input" value={item.rate} min="0" step="any"
                    onChange={e => updateItem(idx, 'rate', e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: 0.75, margin: 0 }}>
                  {idx === 0 && <label className="form-label">Tax %</label>}
                  {/* v1.6.8 (P2 #29): "Other…" for jeweller 3% / diamond 0.25% /
                       agriculture 0.1% and any bespoke rate. */}
                  <select className="form-input" value={
                    ['0','0.1','0.25','3','5','12','18','28'].includes(String(item.taxPercent)) ? String(item.taxPercent) : '__custom__'
                  } onChange={async e => {
                    if (e.target.value === '__custom__') {
                      const v = await promptAction({
                        title: 'Custom tax rate',
                        message: 'Enter a GST rate between 0% and 100% (up to 2 decimals).',
                        defaultValue: String(item.taxPercent || 0),
                        placeholder: 'e.g. 7.5',
                        inputType: 'number',
                        confirmLabel: 'Apply rate',
                      });
                      const n = parseFloat(v);
                      if (Number.isFinite(n) && n >= 0 && n <= 100) updateItem(idx, 'taxPercent', n);
                    } else {
                      updateItem(idx, 'taxPercent', e.target.value);
                    }
                  }}>
                    <option value="0">0%</option>
                    <option value="0.1">0.1%</option>
                    <option value="0.25">0.25%</option>
                    <option value="3">3%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                    <option value="__custom__">Other…{['0','0.1','0.25','3','5','12','18','28'].includes(String(item.taxPercent)) ? '' : ` (${item.taxPercent}%)`}</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 0.7, margin: 0 }}>
                  {idx === 0 && <label className="form-label" title="Compensation Cess — for tobacco, aerated, motor vehicles, coal, etc.">Cess %</label>}
                  <input type="number" className="form-input" value={item.cessPercent ?? 0} min="0" step="any"
                    onChange={e => updateItem(idx, 'cessPercent', e.target.value)} />
                </div>
                <div style={{ flex: '0 0 auto', marginBottom: idx === 0 ? 0 : 0 }}>
                  {form.items.length > 1 && (
                    <button className="icon-btn icon-btn-red" onClick={() => removeItem(idx)} title="Remove"><Trash2 size={15} /></button>
                  )}
                </div>
              </div>
            ))}
            <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', marginTop: '0.25rem' }}
              onClick={addItem}><Plus size={14} /> Add Item</button>

            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span>Taxable: <strong>{formatCurrency(formTotals.taxable)}</strong></span>
                <span>Tax: <strong>{formatCurrency(formTotals.tax)}</strong></span>
                {formTotals.cess > 0 && (
                  <span>Cess: <strong>{formatCurrency(formTotals.cess)}</strong></span>
                )}
                {form.applyRoundOff && (
                  <span style={{ color: '#475569' }}>
                    Round-off: <strong>{(formTotals.roundOff >= 0 ? '+' : '') + formatCurrency(formTotals.roundOff)}</strong>
                  </span>
                )}
                <span>Total: <strong>{formatCurrency(formTotals.finalTotal)}</strong></span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem', cursor: 'pointer', marginTop: '0.6rem', color: '#475569' }}>
                <input type="checkbox" checked={!!form.applyRoundOff}
                  onChange={e => updateField('applyRoundOff', e.target.checked)}
                  style={{ width: 14, height: 14, accentColor: 'var(--primary)' }} />
                <span>
                  <strong>Apply round-off</strong> — round the grand total to the nearest rupee.
                  Use when the supplier's bill is rounded (e.g. ₹1,234.56 → ₹1,235). Off by default —
                  most suppliers' totals already match what's calculated from line items.
                </span>
              </label>
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <button className="btn btn-secondary" onClick={closeForm}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}><Save size={16} /> {editingId ? 'Update' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Table */}
      <div className="glass-panel">
        <div className="table-header"><h3>Purchase Records</h3></div>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <ShoppingCart size={48} />
            <p>{purchases.length === 0 ? 'No purchase bills recorded yet.' : 'No purchases match your filters.'}</p>
            {purchases.length === 0 && <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Add Purchase</button>}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: '800px' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>GSTIN</th>
                  <th>Invoice No</th>
                  <th style={{ textAlign: 'right' }}>Taxable</th>
                  <th style={{ textAlign: 'right' }}>Tax</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const t = calcPurchaseTotal(p.items, !!p.applyRoundOff);
                  return (
                    <tr key={p.id}>
                      <td className="text-muted">{p.date ? new Date(p.date).toLocaleDateString('en-IN') : ''}</td>
                      <td className="font-medium">{p.supplierName}</td>
                      <td className="text-muted" style={{ fontSize: '0.78rem' }}>{p.supplierGstin || '-'}</td>
                      <td><span className="invoice-badge">{p.invoiceNumber}</span></td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(t.taxable)}</td>
                      <td style={{ textAlign: 'right' }} className="text-muted">{formatCurrency(t.tax)}</td>
                      <td style={{ textAlign: 'right' }} className="font-bold">{formatCurrency(t.finalTotal)}</td>
                      <td>
                        <span style={{
                          padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600,
                          background: p.paymentStatus === 'Paid' ? '#ecfdf5' : p.paymentStatus === 'Partial' ? '#f5f3ff' : '#fffbeb',
                          color: p.paymentStatus === 'Paid' ? '#059669' : p.paymentStatus === 'Partial' ? '#8b5cf6' : '#f59e0b',
                        }}>{p.paymentStatus || 'Unpaid'}</span>
                      </td>
                      <td>
                        <div className="table-actions">
                          {/* v1.10.30 — quick View modal (no download).
                              Modal has a Download PDF button inside for
                              users who do want the file. */}
                          <button className="icon-btn" onClick={() => setViewPurchase(p)} title="View details (no download)"><Eye size={15} /></button>
                          <button className="icon-btn icon-btn-blue" onClick={() => openEdit(p)} title="Edit"><Edit3 size={15} /></button>
                          <button className="icon-btn icon-btn-red" onClick={() => handleDelete(p.id)} title="Delete"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--border)' }}>
                  <td colSpan={4}>Total</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(totalStats.taxable)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(totalStats.tax)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(totalStats.total)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
