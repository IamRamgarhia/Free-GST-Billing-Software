import { useState, useEffect } from 'react';
import { Package, Search, Plus, Edit3, Trash2, X, Save } from 'lucide-react';
import { getAllProducts, saveProduct, deleteProduct } from '../store';
import { toast } from './Toast';

const UNITS = ['Nos', 'Hrs', 'Kg', 'Ltr', 'Mtr', 'Sq.ft', 'Box', 'Pair', 'Set', 'Pcs'];

const emptyForm = {
  name: '', hsn: '', rate: '', taxPercent: '', unit: 'Nos', stock: '', description: '',
};

export default function InventoryView() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });

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
  }, []);

  const filtered = search.trim()
    ? products.filter(p =>
        (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.hsn || '').toLowerCase().includes(search.toLowerCase())
      )
    : products;

  const openAdd = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (product) => {
    setForm({
      name: product.name || '',
      hsn: product.hsn || '',
      rate: product.rate || '',
      taxPercent: product.taxPercent || '',
      unit: product.unit || 'Nos',
      stock: product.stock || '',
      description: product.description || '',
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
    try {
      const product = {
        ...(editingId ? { id: editingId } : {}),
        name: form.name.trim(),
        hsn: form.hsn.trim(),
        rate: form.rate ? parseFloat(form.rate) : 0,
        taxPercent: form.taxPercent ? parseFloat(form.taxPercent) : 0,
        unit: form.unit,
        stock: form.stock ? parseFloat(form.stock) : 0,
        description: form.description.trim(),
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
    if (confirm('Delete this product? This cannot be undone.')) {
      try {
        await deleteProduct(id);
        toast('Product deleted', 'success');
        loadProducts();
      } catch {
        toast('Failed to delete', 'error');
      }
    }
  };

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">Manage your products and services catalog</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={18} /> Add Product
        </button>
      </div>

      {/* Search */}
      <div className="glass-panel p-4 mb-6">
        <div className="search-box" style={{ maxWidth: '400px' }}>
          <Search size={16} className="search-icon" />
          <input type="text" placeholder="Search by name or HSN..." value={search}
            onChange={e => setSearch(e.target.value)} className="search-input" />
          {search && <button className="icon-btn" onClick={() => setSearch('')}><X size={14} /></button>}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="section-title">{editingId ? 'Edit Product' : 'Add Product'}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Product / Service Name *</label>
                <input type="text" className="form-input" value={form.name}
                  onChange={e => updateField('name', e.target.value)} placeholder="e.g. Web Development" />
              </div>
              <div className="form-group">
                <label className="form-label">HSN / SAC Code</label>
                <input type="text" className="form-input" value={form.hsn}
                  onChange={e => updateField('hsn', e.target.value)} placeholder="e.g. 998314" />
              </div>
              <div className="form-group">
                <label className="form-label">Rate (Default Price)</label>
                <input type="number" className="form-input" value={form.rate}
                  onChange={e => updateField('rate', e.target.value)} placeholder="0.00" min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">GST %</label>
                <input type="number" className="form-input" value={form.taxPercent}
                  onChange={e => updateField('taxPercent', e.target.value)} placeholder="18" min="0" max="28" />
              </div>
              <div className="form-group">
                <label className="form-label">Unit</label>
                <select className="form-input" value={form.unit}
                  onChange={e => updateField('unit', e.target.value)}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Stock Quantity</label>
                <input type="number" className="form-input" value={form.stock}
                  onChange={e => updateField('stock', e.target.value)} placeholder="0" min="0" />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Description (optional)</label>
                <input type="text" className="form-input" value={form.description}
                  onChange={e => updateField('description', e.target.value)} placeholder="Brief description..." />
              </div>
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
        <div className="table-header"><h3>Products & Services</h3></div>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <Package size={48} />
            <p>{products.length === 0 ? 'No products yet. Add your first product.' : 'No products match your search.'}</p>
            {products.length === 0 && (
              <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Add Product</button>
            )}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>HSN/SAC</th>
                  <th>Rate</th>
                  <th>GST %</th>
                  <th>Unit</th>
                  <th>Stock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(product => (
                  <tr key={product.id}>
                    <td className="font-medium" title={product.description || ''}>{product.name}</td>
                    <td className="text-muted">{product.hsn || '-'}</td>
                    <td className="font-bold">{product.rate ? `₹${Number(product.rate).toLocaleString('en-IN')}` : '-'}</td>
                    <td>{product.taxPercent ? `${product.taxPercent}%` : '-'}</td>
                    <td className="text-muted">{product.unit || 'Nos'}</td>
                    <td>
                      {(product.stock ?? 0) <= 0 ? (
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>Out of Stock</span>
                      ) : (product.stock ?? 0) <= 5 ? (
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
    </div>
  );
}
