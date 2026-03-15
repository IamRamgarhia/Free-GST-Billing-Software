import { useState, useEffect } from 'react';
import { Wallet, Plus, Edit3, Trash2, Search, X, Save, Download, Calendar } from 'lucide-react';
import { getAllExpenses, saveExpense, deleteExpense } from '../store';
import { formatCurrency } from '../utils';
import { toast } from './Toast';

const EXPENSE_CATEGORIES = [
  'Office Rent', 'Utilities', 'Internet & Phone', 'Software & Tools',
  'Travel', 'Meals & Entertainment', 'Office Supplies', 'Salary & Wages',
  'Professional Fees', 'Insurance', 'Marketing & Ads', 'Raw Materials',
  'Shipping & Courier', 'Repairs & Maintenance', 'Bank Charges', 'GST Paid',
  'Other',
];

const PAYMENT_MODES = ['Bank Transfer', 'UPI', 'Cash', 'Cheque', 'Card', 'Other'];

const emptyForm = {
  date: new Date().toISOString().split('T')[0],
  description: '',
  category: 'Other',
  amount: '',
  gstAmount: '',
  gstPercent: '',
  vendorName: '',
  vendorGstin: '',
  invoiceNo: '',
  paymentMode: 'Bank Transfer',
  note: '',
};

function getFYOptions() {
  const now = new Date();
  const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const options = [];
  for (let i = 0; i < 5; i++) {
    const y = currentYear - i;
    options.push({ value: `${y}-${y + 1}`, label: `FY ${y}-${String(y + 1).slice(-2)}`, from: `${y}-04-01`, to: `${y + 1}-03-31` });
  }
  return options;
}

export default function ExpenseTracker() {
  const [expenses, setExpenses] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [fyFilter, setFyFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });

  const fyOptions = getFYOptions();

  const loadExpenses = async () => {
    try {
      setExpenses(await getAllExpenses());
    } catch {
      toast('Failed to load expenses', 'error');
    }
  };

  useEffect(() => {
    if (fyOptions[0]) setFyFilter(fyOptions[0].value);
    loadExpenses();
  }, []);

  const filtered = expenses.filter(exp => {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!(exp.description || '').toLowerCase().includes(q) &&
          !(exp.vendorName || '').toLowerCase().includes(q) &&
          !(exp.invoiceNo || '').toLowerCase().includes(q)) return false;
    }
    if (categoryFilter !== 'all' && exp.category !== categoryFilter) return false;
    if (fyFilter) {
      const fy = fyOptions.find(f => f.value === fyFilter);
      if (fy && exp.date) {
        if (exp.date < fy.from || exp.date > fy.to) return false;
      }
    }
    return true;
  });

  const totalAmount = filtered.reduce((s, e) => s + (e.amount || 0), 0);
  const totalGST = filtered.reduce((s, e) => s + (e.gstAmount || 0), 0);

  const openAdd = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (exp) => {
    setForm({
      date: exp.date || '',
      description: exp.description || '',
      category: exp.category || 'Other',
      amount: exp.amount || '',
      gstAmount: exp.gstAmount || '',
      gstPercent: exp.gstPercent || '',
      vendorName: exp.vendorName || '',
      vendorGstin: exp.vendorGstin || '',
      invoiceNo: exp.invoiceNo || '',
      paymentMode: exp.paymentMode || 'Bank Transfer',
      note: exp.note || '',
    });
    setEditingId(exp.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const handleSave = async () => {
    if (!form.description.trim()) { toast('Description is required', 'warning'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast('Enter a valid amount', 'warning'); return; }
    try {
      const expense = {
        ...(editingId ? { id: editingId } : {}),
        date: form.date,
        description: form.description.trim(),
        category: form.category,
        amount: parseFloat(form.amount),
        gstAmount: form.gstAmount ? parseFloat(form.gstAmount) : 0,
        gstPercent: form.gstPercent ? parseFloat(form.gstPercent) : 0,
        vendorName: form.vendorName.trim(),
        vendorGstin: form.vendorGstin.trim(),
        invoiceNo: form.invoiceNo.trim(),
        paymentMode: form.paymentMode,
        note: form.note.trim(),
      };
      await saveExpense(expense);
      toast(editingId ? 'Expense updated' : 'Expense added', 'success');
      closeForm();
      loadExpenses();
    } catch {
      toast('Failed to save expense', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this expense?')) {
      try {
        await deleteExpense(id);
        toast('Expense deleted', 'success');
        loadExpenses();
      } catch {
        toast('Failed to delete', 'error');
      }
    }
  };

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleGSTCalc = (val) => {
    updateField('gstPercent', val);
    if (val && form.amount) {
      const base = parseFloat(form.amount);
      const gst = (base * parseFloat(val)) / (100 + parseFloat(val));
      updateField('gstAmount', Math.round(gst * 100) / 100);
    }
  };

  const exportCSV = () => {
    if (filtered.length === 0) { toast('No expenses to export', 'warning'); return; }
    const headers = ['Date', 'Description', 'Category', 'Amount', 'GST Amount', 'GST %', 'Vendor', 'Vendor GSTIN', 'Invoice No', 'Payment Mode', 'Note'];
    const escape = (v) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const lines = [headers.map(escape).join(',')];
    filtered.forEach(e => {
      lines.push([e.date, e.description, e.category, e.amount, e.gstAmount || 0, e.gstPercent || 0, e.vendorName, e.vendorGstin, e.invoiceNo, e.paymentMode, e.note].map(escape).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'expenses.csv'; a.click();
    URL.revokeObjectURL(url);
    toast('Expenses CSV downloaded', 'success');
  };

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">Track business expenses for P&L and ITC claims</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={exportCSV}><Download size={16} /> Export CSV</button>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Add Expense</button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-icon stat-icon-purple"><Wallet size={22} /></div>
          <div><p className="stat-label">Total Expenses</p><h2 className="stat-value stat-value-purple">{formatCurrency(totalAmount)}</h2></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-green"><Calendar size={22} /></div>
          <div><p className="stat-label">GST Paid (ITC)</p><h2 className="stat-value stat-value-green">{formatCurrency(totalGST)}</h2></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue"><Wallet size={22} /></div>
          <div><p className="stat-label">Entries</p><h2 className="stat-value">{filtered.length}</h2></div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel p-4 mb-6">
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-box" style={{ maxWidth: '300px' }}>
            <Search size={16} className="search-icon" />
            <input type="text" placeholder="Search expenses..." value={search}
              onChange={e => setSearch(e.target.value)} className="search-input" />
          </div>
          <select className="filter-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="all">All Categories</option>
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="filter-select" value={fyFilter} onChange={e => setFyFilter(e.target.value)}>
            {fyOptions.map(fy => <option key={fy.value} value={fy.value}>{fy.label}</option>)}
          </select>
          {(search || categoryFilter !== 'all') && (
            <button className="icon-btn icon-btn-red" onClick={() => { setSearch(''); setCategoryFilter('all'); }}><X size={15} /></button>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '620px' }}>
            <h3 className="section-title">{editingId ? 'Edit Expense' : 'Add Expense'}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input type="date" className="form-input" value={form.date} onChange={e => updateField('date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-input" value={form.category} onChange={e => updateField('category', e.target.value)}>
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Description *</label>
                <input type="text" className="form-input" value={form.description}
                  onChange={e => updateField('description', e.target.value)} placeholder="e.g. AWS Hosting - March" />
              </div>
              <div className="form-group">
                <label className="form-label">Amount (incl. GST) *</label>
                <input type="number" className="form-input" value={form.amount}
                  onChange={e => { updateField('amount', e.target.value); if (form.gstPercent) handleGSTCalc(form.gstPercent); }}
                  placeholder="0.00" min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">GST % (for ITC)</label>
                <input type="number" className="form-input" value={form.gstPercent}
                  onChange={e => handleGSTCalc(e.target.value)} placeholder="18" min="0" max="28" />
                {form.gstAmount > 0 && <p className="field-hint">GST: {formatCurrency(form.gstAmount)}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Vendor Name</label>
                <input type="text" className="form-input" value={form.vendorName}
                  onChange={e => updateField('vendorName', e.target.value)} placeholder="Optional" />
              </div>
              <div className="form-group">
                <label className="form-label">Vendor GSTIN</label>
                <input type="text" className="form-input" value={form.vendorGstin}
                  onChange={e => updateField('vendorGstin', e.target.value)} placeholder="For ITC claim" maxLength={15} />
              </div>
              <div className="form-group">
                <label className="form-label">Invoice / Bill No</label>
                <input type="text" className="form-input" value={form.invoiceNo}
                  onChange={e => updateField('invoiceNo', e.target.value)} placeholder="Optional" />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Mode</label>
                <select className="form-input" value={form.paymentMode} onChange={e => updateField('paymentMode', e.target.value)}>
                  {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Note (optional)</label>
                <input type="text" className="form-input" value={form.note}
                  onChange={e => updateField('note', e.target.value)} placeholder="Any additional note..." />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button className="btn btn-secondary" onClick={closeForm}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}><Save size={16} /> {editingId ? 'Update' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Expense Table */}
      <div className="glass-panel">
        <div className="table-header"><h3>Expense Records</h3></div>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <Wallet size={48} />
            <p>{expenses.length === 0 ? 'No expenses recorded yet.' : 'No expenses match your filters.'}</p>
            {expenses.length === 0 && <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Add Expense</button>}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: '800px' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Vendor</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'right' }}>GST</th>
                  <th>Mode</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(exp => (
                  <tr key={exp.id}>
                    <td className="text-muted">{exp.date ? new Date(exp.date).toLocaleDateString('en-IN') : ''}</td>
                    <td className="font-medium">{exp.description}</td>
                    <td><span className="type-badge">{exp.category}</span></td>
                    <td className="text-muted">{exp.vendorName || '-'}</td>
                    <td style={{ textAlign: 'right' }} className="font-bold">{formatCurrency(exp.amount)}</td>
                    <td style={{ textAlign: 'right' }} className="text-muted">{exp.gstAmount ? formatCurrency(exp.gstAmount) : '-'}</td>
                    <td className="text-muted">{exp.paymentMode}</td>
                    <td>
                      <div className="table-actions">
                        <button className="icon-btn icon-btn-blue" onClick={() => openEdit(exp)} title="Edit"><Edit3 size={15} /></button>
                        <button className="icon-btn icon-btn-red" onClick={() => handleDelete(exp.id)} title="Delete"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--border)' }}>
                  <td colSpan={4}>Total</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(totalAmount)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(totalGST)}</td>
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
