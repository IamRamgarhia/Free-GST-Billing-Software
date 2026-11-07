import { useState, useEffect } from 'react';
import { Package, Search, Plus, Edit3, Trash2, X, Save, Upload, Table2, Factory } from 'lucide-react';
import { getAllProducts, saveProduct, deleteProduct, getProfile, getStockAlertSettings, getEnabledModules } from '../store';
import { getAllUnits, getCountryConfig, formatCurrency, isModuleEnabled, isServiceProduct, trackedStock, filterUnitsByMode, getDefaultUnitForMode } from '../utils';
import { productsCsvToList, PRODUCTS_SAMPLE } from '../utils/listCsv';
import CsvListImport from './CsvListImport';
import { bomError, unitCost } from '../utils/manufacturing';
import { BomEditor, MakeModal, ProductionList } from './Manufacturing';
import { toast } from './Toast';
import { confirmAction } from './ConfirmModal';
import HelpButton from './HelpButton';
import ProductBulkEdit from './ProductBulkEdit';
import TableExport from './TableExport';

// v1.10.29 — reported: "here purchase price and selling price need".
// Product now carries BOTH: `purchasePrice` (what we paid the supplier) and
// `sellingPrice` (what we charge the customer). Legacy `rate` field is
// still written on save (mirrors sellingPrice) so any pre-v1.10.29 reader
// still gets a valid number, but the form no longer edits it directly —
// dead state removed for clarity.
const emptyForm = {
  // kind: v1.10.83 (#121) - 'goods' or 'service' (a service has no stock).
  kind: 'goods', name: '', hsn: '', purchasePrice: '', sellingPrice: '', taxPercent: '', gstTreatment: '', unit: 'Pcs', stock: '', description: '',
  madeHere: false, bom: [],
};

export default function InventoryView() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  // v1.10.77 (#85) - edit many products at once (see ProductBulkEdit).
  const [bulkEdit, setBulkEdit] = useState(false);
  // v1.10.84 (#177) - tick products, then delete them in one go.
  const [picked, setPicked] = useState(() => new Set());
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [units, setUnits] = useState(getAllUnits());
  const [profileCountry, setProfileCountry] = useState('India');
  const profileCurrency = getCountryConfig(profileCountry).currency;
  // The colour-coded stock badge in the table respects the user's threshold
  // — defaults to 5 if no setting saved yet. When alerts are disabled
  // entirely, items at or below threshold render in the same plain colour
  // as everything else (still "Out of Stock" red for 0 — that's a hard fact,
  // not an alert preference).
  const [stockAlerts, setStockAlerts] = useState({ enabled: true, threshold: 5 });
  // v1.10.83 (#115) - manufacturing (Settings -> Features). When off, nothing
  // below changes: no Make button, no BOM in the form, no production list.
  const mfgOn = isModuleEnabled('manufacturing', getEnabledModules());
  const [showMake, setShowMake] = useState(false);
  const [mfgReload, setMfgReload] = useState(0);
  const afterProduction = () => { setShowMake(false); setMfgReload((n) => n + 1); loadProducts(); };

  const loadProducts = async () => {
    try {
      const data = await getAllProducts();
      setProducts(data);
    } catch {
      toast('Failed to load products', 'error');
    }
  };

  useEffect(() => {
    loadProducts();
    setUnits(getAllUnits());
    getProfile().then(p => { if (p?.country) setProfileCountry(p.country); }).catch(() => {});
    getStockAlertSettings().then(setStockAlerts).catch(() => {});
  }, []);

  const filtered = search.trim()
    ? products.filter(p =>
        (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.hsn || '').toLowerCase().includes(search.toLowerCase())
      )
    : products;
  const pickedShown = filtered.filter((p) => picked.has(p.id));

  const openAdd = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (product) => {
    // v1.10.29 — Backward-compat: pre-v1.10.29 products only had `rate`.
    // Read `sellingPrice` if set, else fall back to `rate`. `purchasePrice`
    // is new — starts empty for legacy products until the user fills it.
    setForm({
      kind: isServiceProduct(product) ? 'service' : 'goods',
      name: product.name || '',
      hsn: product.hsn || '',
      purchasePrice: product.purchasePrice ?? '',
      sellingPrice: product.sellingPrice ?? product.rate ?? '',
      taxPercent: product.taxPercent || '',
      gstTreatment: product.gstTreatment || '',
      unit: product.unit || 'Nos',
      stock: product.stock ?? '', // v1.10.74 - was `|| ''`, which blanked a stock of 0
      description: product.description || '',
      madeHere: !!product.madeHere,
      bom: (product.bom || []).map((l) => ({ productId: l.productId, qty: String(l.qty ?? '') })),
    });
    setEditingId(product.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast('Product name is required', 'warning');
      return;
    }
    // v1.10.74 - the input's min/max are not enforced by the browser on save.
    const gst = form.taxPercent === '' ? 0 : Number(form.taxPercent);
    if (!Number.isFinite(gst) || gst < 0 || gst > 100) {
      toast('GST % must be between 0 and 100', 'warning');
      return;
    }
    // v1.10.83 (#115) - a raw materials list must be complete, positive and loop-free.
    const bom = form.bom.map((l) => ({ productId: l.productId, qty: Number(l.qty) }));
    if (mfgOn && form.madeHere && form.kind !== 'service') {
      const err = bomError(editingId || '_new', bom, products);
      if (err) { toast(err, 'warning'); return; }
    }
    try {
      // v1.10.29 — Persist both prices. `rate` mirrors sellingPrice so any
      // old caller reading .rate still gets the right number.
      const sellingPrice = form.sellingPrice ? parseFloat(form.sellingPrice) : 0;
      const purchasePrice = form.purchasePrice ? parseFloat(form.purchasePrice) : 0;
      const service = form.kind === 'service';
      const product = {
        // Fields this form does not show (cess % from purchase bills, etc.)
        // are kept: the record used to be rebuilt from the form alone.
        ...(editingId ? (products.find(p => p.id === editingId) || {}) : {}),
        ...(editingId ? { id: editingId } : {}),
        name: form.name.trim(),
        hsn: form.hsn.trim(),
        purchasePrice,
        sellingPrice,
        rate: sellingPrice, // mirror for legacy readers
        taxPercent: form.taxPercent ? parseFloat(form.taxPercent) : 0,
        gstTreatment: form.gstTreatment || '',
        unit: form.unit,
        kind: service ? 'service' : 'goods',
        // #121 - a service has no stock; blank stock is "not tracked" (it used
        // to save 0, which showed Out of Stock for things never counted).
        stock: service || form.stock === '' ? undefined : parseFloat(form.stock),
        description: form.description.trim(),
        // Only written while the feature is on; otherwise the fields a product
        // already has are kept as they are (spread above).
        ...(mfgOn ? (form.madeHere && !service ? { madeHere: true, bom } : { madeHere: false }) : {}),
      };
      await saveProduct(product);
      toast(editingId ? 'Product updated' : 'Product added', 'success');
      closeForm();
      loadProducts();
    } catch {
      toast('Failed to save product', 'error');
    }
  };

  const handleDelete = async (id) => {
    // v1.10.83 (#115) - say so when a made product uses it as a raw material.
    const usedIn = mfgOn ? products.filter((p) => p.madeHere && (p.bom || []).some((l) => l.productId === id)).map((p) => p.name) : [];
    if (await confirmAction({
      title: 'Delete this product?',
      message: 'Existing invoices that used this product keep their line items unchanged. This just removes the product from your catalog.'
        + (usedIn.length ? ` It is a raw material of ${usedIn.join(', ')}: remove it from their raw materials list too.` : ''),
      confirmLabel: 'Delete',
      tone: 'danger',
    })) {
      try {
        await deleteProduct(id);
        toast('Product deleted', 'success');
        loadProducts();
      } catch {
        toast('Failed to delete', 'error');
      }
    }
  };

  // #177 - only ticked products the list shows now (the search) are deleted.
  const deletePicked = async (list) => {
    if (!list.length) return;
    const ids = new Set(list.map((p) => p.id));
    const usedIn = mfgOn ? products.filter((p) => p.madeHere && !ids.has(p.id) && (p.bom || []).some((l) => ids.has(l.productId))).map((p) => p.name) : [];
    if (!(await confirmAction({
      title: `Delete ${list.length} product${list.length === 1 ? '' : 's'}?`,
      message: `${list.slice(0, 5).map((p) => p.name).join(', ')}${list.length > 5 ? ` and ${list.length - 5} more` : ''}. `
        + 'Existing invoices that used them keep their line items unchanged. This just removes them from your catalog.'
        + (usedIn.length ? ` Some are raw materials of ${usedIn.join(', ')}: remove them from their raw materials list too.` : ''),
      confirmLabel: 'Delete',
      tone: 'danger',
    }))) return;
    let done = 0;
    for (const p of list) {
      try { await deleteProduct(p.id); done += 1; } catch { /* counted below */ }
    }
    toast(done === list.length ? `${done} product${done === 1 ? '' : 's'} deleted` : `${done} of ${list.length} deleted; the rest could not be deleted`, done === list.length ? 'success' : 'error');
    setPicked(new Set());
    loadProducts();
  };

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };
  // A service starts on a service unit (Hrs) unless its unit is one already.
  const serviceUnits = filterUnitsByMode(units, 'services');
  const setKind = (kind) => setForm(prev => ({
    ...prev, kind,
    ...(kind === 'service' && !serviceUnits.some(u => u.label === prev.unit) ? { unit: getDefaultUnitForMode('services') } : {}),
  }));
  const [showImport, setShowImport] = useState(false);

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div>
            <h1 className="page-title">Products <HelpButton title="Products — how to use" doc="products" size={16} /></h1>
            <p className="page-subtitle">Manage your products and services catalog</p>
          </div>
        </div>
        {/* Wraps on a phone: with Make there are four buttons (v1.10.83, #115). */}
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => setShowImport(true)} title="Add products from a CSV, an Excel file (.xlsx, such as Vyapar's) or Tally's masters export (.xml)">
            <Upload size={16} /> Import CSV
          </button>
          <button className="btn btn-secondary" onClick={() => setBulkEdit(true)} disabled={!products.length || bulkEdit}
            title="Edit name, HSN, prices, GST %, unit and stock of many products at once">
            <Table2 size={16} /> Bulk edit
          </button>
          {mfgOn && (
            <button className="btn btn-secondary" onClick={() => setShowMake(true)} disabled={bulkEdit}
              title="Record production: uses up raw materials and adds the finished product to stock">
              <Factory size={16} /> Make
            </button>
          )}
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={18} /> Add Product
          </button>
        </div>
      </div>
      {showImport && (
        <CsvListImport what="products" sample={PRODUCTS_SAMPLE} sampleName="Products-sample.csv" doc="products#import"
          intro="One product or service per row: Name (required), Type (Goods or Service), HSN/SAC, Unit, Purchase Price, Selling Price, GST % and Stock (leave Stock blank for a service). For a product already saved, details that are empty on it are filled in from the file; nothing already filled is changed."
          parse={(rows) => { const r = productsCsvToList(rows, products); return { list: r.products, updates: r.updates, skipped: r.skipped, errors: r.errors }; }}
          save={saveProduct} onClose={() => setShowImport(false)} onDone={() => { setShowImport(false); loadProducts(); }} />
      )}
      {showMake && <MakeModal products={products} currency={profileCurrency} onClose={() => setShowMake(false)} onSaved={afterProduction} />}

      {/* Search */}
      <div className="glass-panel p-4 mb-6">
        <div className="search-box" style={{ maxWidth: '400px' }}>
          <Search size={16} className="search-icon" />
          <input type="text" placeholder="Search by name or HSN..." value={search}
            onChange={e => setSearch(e.target.value)} className="search-input" disabled={bulkEdit}
            title={bulkEdit ? 'Save or cancel the bulk edit first' : undefined} />
          {search && <button className="icon-btn" onClick={() => setSearch('')} title="Clear search" aria-label="Clear search"><X size={14} /></button>}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="section-title">{editingId ? 'Edit Product' : 'Add Product'} <HelpButton title="Adding a product or service" doc="products#add-product" size={16} /></h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Product / Service Name *</label>
                <input type="text" className="form-input" value={form.name}
                  onChange={e => updateField('name', e.target.value)} placeholder="e.g. Web Development" />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <span className="form-label" id="product-kind-label">This is a <HelpButton title="Goods or service" doc="products#goods-or-service" size={14} /></span>
                <div role="radiogroup" aria-labelledby="product-kind-label" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {[['goods', 'Goods (stock counted)'], ['service', 'Service (no stock)']].map(([id, label]) => (
                    <button key={id} type="button" role="radio" aria-checked={form.kind === id}
                      className={`type-chip ${form.kind === id ? 'type-chip-active' : ''}`} onClick={() => setKind(id)}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{form.kind === 'service' ? 'SAC Code' : 'HSN / SAC Code'}</label>
                <input type="text" className="form-input" value={form.hsn}
                  onChange={e => updateField('hsn', e.target.value)} placeholder={form.kind === 'service' ? 'e.g. 998314' : 'e.g. 4802'} />
              </div>
              {/* v1.10.29 — Purchase price + selling price side by side.
                  Selling price seeds the invoice rate; purchase price seeds
                  the purchase-bill rate. Legacy `rate` field kept invisible
                  for backward compat — writes through to sellingPrice. */}
              <div className="form-group">
                <label className="form-label">Purchase Price</label>
                <input type="number" className="form-input" value={form.purchasePrice}
                  onChange={e => updateField('purchasePrice', e.target.value)}
                  placeholder="0.00" min="0" step="any"
                  title="What you pay the supplier. Auto-fills on new Purchase Bills." />
              </div>
              <div className="form-group">
                <label className="form-label">Selling Price</label>
                <input type="number" className="form-input" value={form.sellingPrice}
                  onChange={e => updateField('sellingPrice', e.target.value)}
                  placeholder="0.00" min="0" step="any"
                  title="What you charge the customer. Auto-fills on new Invoices." />
              </div>
              <div className="form-group">
                <label className="form-label">GST %</label>
                <input type="number" className="form-input" value={form.taxPercent}
                  onChange={e => updateField('taxPercent', e.target.value)} placeholder="18" min="0" max="100" />
              </div>
              {/* v1.10.84 - for GSTR-1 Table 8: only matters at 0% or on a bill of supply. */}
              <div className="form-group">
                <label className="form-label" htmlFor="gst-treatment">If no GST is charged</label>
                <select id="gst-treatment" className="form-input" value={form.gstTreatment}
                  onChange={e => updateField('gstTreatment', e.target.value)}
                  title="How GSTR-1 reports this item when it is sold at 0% or on a bill of supply">
                  <option value="">Automatic (0% = nil-rated, bill of supply = exempt)</option>
                  <option value="nil">Nil-rated</option>
                  <option value="exempt">Exempt</option>
                  <option value="nongst">Non-GST supply</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Unit</label>
                <select className="form-input" value={form.unit}
                  onChange={e => updateField('unit', e.target.value)}>
                  {form.unit && !units.some(u => u.label === form.unit) && (
                    <option value={form.unit}>{form.unit}</option>
                  )}
                  {(form.kind === 'service' ? serviceUnits : units).map(u => <option key={u.label} value={u.label}>{u.label}{u.custom ? ' ★' : ''}</option>)}
                </select>
              </div>
              {form.kind !== 'service' && (
                <div className="form-group">
                  <label className="form-label">Stock Quantity</label>
                  <input type="number" className="form-input" value={form.stock}
                    onChange={e => updateField('stock', e.target.value)} placeholder="Blank = not counted" min="0" />
                </div>
              )}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Description (optional)</label>
                <input type="text" className="form-input" value={form.description}
                  onChange={e => updateField('description', e.target.value)} placeholder="Brief description..." />
              </div>
              {mfgOn && form.kind !== 'service' && (
                <BomEditor productId={editingId} madeHere={form.madeHere} bom={form.bom} products={products} currency={profileCurrency}
                  onChange={({ madeHere, bom }) => setForm((prev) => ({ ...prev, madeHere, bom }))} />
              )}
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button className="btn btn-secondary" onClick={closeForm}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>
                <Save size={16} /> {editingId ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Table */}
      <div className="glass-panel">
        <div className="table-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3>Products & Services <HelpButton title="The product list" doc="products#product-list" size={16} /></h3>
          {!bulkEdit && (
            <TableExport title="Products" filename="Products"
              headers={['Name', 'Type', 'HSN/SAC', 'Purchase price', 'Selling price', 'GST %', 'Unit', 'Stock']}
              rows={filtered.map((p) => [p.name, isServiceProduct(p) ? 'Service' : 'Goods', p.hsn || '', Number(p.purchasePrice) || 0, Number(p.sellingPrice ?? p.rate) || 0, Number(p.taxPercent) || 0, p.unit || 'Nos', trackedStock(p) ?? ''])} />
          )}
        </div>
        {bulkEdit && filtered.length > 0 ? (
          <ProductBulkEdit products={filtered} units={units} onDone={(saved) => { setBulkEdit(false); if (saved) loadProducts(); }} />
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Package size={48} />
            <p>{products.length === 0 ? 'No products yet. Add your first product.' : 'No products match your search.'}</p>
            {products.length === 0 && (
              <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Add Product</button>
            )}
          </div>
        ) : (
          <div className="table-scroll">
            {pickedShown.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '0.5rem 0.75rem', margin: '0 0 0.5rem', background: 'var(--primary-light)', borderRadius: 8 }}>
                <strong style={{ fontSize: '0.88rem' }}>{pickedShown.length} selected</strong>
                <button type="button" className="btn btn-secondary" style={{ color: '#dc2626', borderColor: '#dc2626' }} onClick={() => deletePicked(pickedShown)}>
                  <Trash2 size={14} /> Delete selected
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setPicked(new Set())}>Clear</button>
              </div>
            )}
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input type="checkbox" aria-label="Select all products shown"
                      checked={pickedShown.length === filtered.length}
                      onChange={(e) => setPicked(e.target.checked ? new Set(filtered.map((p) => p.id)) : new Set())} />
                  </th>
                  <th>Name</th>
                  <th>HSN/SAC</th>
                  <th>Rate</th>
                  <th>GST %</th>
                  <th>Unit</th>
                  <th>Stock</th>
                  <th className="col-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(product => (
                  <tr key={product.id}>
                    <td>
                      <input type="checkbox" aria-label={`Select ${product.name}`} checked={picked.has(product.id)}
                        onChange={(e) => setPicked((prev) => { const next = new Set(prev); if (e.target.checked) next.add(product.id); else next.delete(product.id); return next; })} />
                    </td>
                    <td className="font-medium" title={product.description || ''}>
                      {product.name}
                      {mfgOn && product.madeHere && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                          Made here · cost {formatCurrency(unitCost(product, products), profileCurrency)} per {product.unit || 'unit'}
                        </div>
                      )}
                    </td>
                    <td className="text-muted">{product.hsn || '-'}</td>
                    <td className="font-bold">{product.rate ? formatCurrency(product.rate, profileCurrency) : '-'}</td>
                    <td>{product.taxPercent ? `${product.taxPercent}%` : '-'}</td>
                    <td className="text-muted">{product.unit || 'Nos'}</td>
                    <td>
                      {/* #121 - a service, or stock never entered, is not counted: never "Out of Stock". */}
                      {isServiceProduct(product) ? (
                        <span className="text-muted" title="A service has no stock">Service</span>
                      ) : trackedStock(product) === null ? (
                        <span className="text-muted" title="No stock entered, so it is not counted">-</span>
                      ) : trackedStock(product) <= 0 ? (
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>Out of Stock</span>
                      ) : (stockAlerts.enabled !== false && trackedStock(product) <= Number(stockAlerts.threshold ?? 5)) ? (
                        <span style={{ color: '#d97706', fontWeight: 600 }}>{product.stock}</span>
                      ) : (
                        product.stock
                      )}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="icon-btn icon-btn-blue" onClick={() => openEdit(product)} title="Edit">
                          <Edit3 size={15} />
                        </button>
                        <button className="icon-btn icon-btn-red" onClick={() => handleDelete(product.id)} title="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {mfgOn && <ProductionList products={products} currency={profileCurrency} reloadKey={mfgReload} onChanged={afterProduction} />}
    </div>
  );
}
