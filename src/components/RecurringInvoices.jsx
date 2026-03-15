import { useState, useEffect } from 'react';
import { RefreshCw, Plus, Edit3, Trash2, Play, Pause, Calendar, X, Save } from 'lucide-react';
import { getAllRecurring, saveRecurring, deleteRecurring, getAllClients, saveBill, getNextInvoiceNumber } from '../store';
import { formatCurrency, INVOICE_TYPES } from '../utils';
import { toast } from './Toast';

const FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

const emptyForm = {
  clientName: '', clientState: '', clientGstin: '', clientAddress: '',
  frequency: 'monthly', invoiceType: 'tax-invoice',
  items: [{ description: '', hsn: '', quantity: 1, rate: '', taxPercent: 18, discount: 0 }],
  notes: '', nextDate: '', active: true,
};

export default function RecurringInvoices() {
  const [templates, setTemplates] = useState([]);
  const [clients, setClients] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });

  const load = async () => {
    try {
      const [recs, cls] = await Promise.all([getAllRecurring(), getAllClients()]);
      setTemplates(recs);
      setClients(cls);
    } catch {
      toast('Failed to load data', 'error');
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    setForm({ ...emptyForm, nextDate: nextMonth.toISOString().split('T')[0] });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (tpl) => {
    setForm({
      clientName: tpl.clientName || '',
      clientState: tpl.clientState || '',
      clientGstin: tpl.clientGstin || '',
      clientAddress: tpl.clientAddress || '',
      frequency: tpl.frequency || 'monthly',
      invoiceType: tpl.invoiceType || 'tax-invoice',
      items: tpl.items || [{ description: '', hsn: '', quantity: 1, rate: '', taxPercent: 18, discount: 0 }],
      notes: tpl.notes || '',
      nextDate: tpl.nextDate || '',
      active: tpl.active !== false,
    });
    setEditingId(tpl.id);
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditingId(null); };

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const updateItem = (idx, field, value) => {
    setForm(prev => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...prev, items };
    });
  };

  const addItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { description: '', hsn: '', quantity: 1, rate: '', taxPercent: 18, discount: 0 }],
    }));
  };

  const removeItem = (idx) => {
    if (form.items.length <= 1) return;
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const selectClient = (cli) => {
    setForm(prev => ({
      ...prev,
      clientName: cli.name || '',
      clientState: cli.state || '',
      clientGstin: cli.gstin || '',
      clientAddress: cli.address || '',
    }));
  };

  const handleSave = async () => {
    if (!form.clientName.trim()) { toast('Client name required', 'warning'); return; }
    if (!form.items.some(i => i.description && i.rate)) { toast('Add at least one item with description and rate', 'warning'); return; }
    try {
      await saveRecurring({
        ...(editingId ? { id: editingId } : {}),
        ...form,
        items: form.items.filter(i => i.description),
      });
      toast(editingId ? 'Template updated' : 'Recurring invoice created', 'success');
      closeForm();
      load();
    } catch {
      toast('Failed to save', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this recurring invoice template?')) {
      try { await deleteRecurring(id); toast('Deleted', 'success'); load(); }
      catch { toast('Failed to delete', 'error'); }
    }
  };

  const toggleActive = async (tpl) => {
    await saveRecurring({ ...tpl, active: !tpl.active });
    toast(tpl.active ? 'Paused' : 'Activated', 'info');
    load();
  };

  const generateNow = async (tpl) => {
    try {
      const typeConfig = INVOICE_TYPES[tpl.invoiceType || 'tax-invoice'];
      const invoiceNumber = await getNextInvoiceNumber(typeConfig.prefix);
      const today = new Date().toISOString().split('T')[0];

      const items = (tpl.items || []).map(i => ({
        description: i.description,
        hsn: i.hsn || '',
        quantity: parseFloat(i.quantity) || 1,
        rate: parseFloat(i.rate) || 0,
        taxPercent: parseFloat(i.taxPercent) || 0,
        discount: parseFloat(i.discount) || 0,
      }));

      const totalAmount = items.reduce((sum, i) => {
        const base = i.quantity * i.rate - i.discount;
        return sum + base + (base * i.taxPercent / 100);
      }, 0);
      const totalTaxAmount = items.reduce((sum, i) => {
        const base = i.quantity * i.rate - i.discount;
        return sum + (base * i.taxPercent / 100);
      }, 0);

      const bill = {
        id: invoiceNumber,
        invoiceNumber,
        invoiceDate: today,
        invoiceType: tpl.invoiceType || 'tax-invoice',
        clientName: tpl.clientName,
        totalAmount: Math.round(totalAmount * 100) / 100,
        totalTaxAmount: Math.round(totalTaxAmount * 100) / 100,
        status: 'unpaid',
        paidAmount: 0,
        payments: [],
        data: {
          details: { invoiceNumber, invoiceDate: today },
          client: { name: tpl.clientName, state: tpl.clientState, gstin: tpl.clientGstin, address: tpl.clientAddress },
          items,
        },
        generatedFrom: tpl.id,
      };

      await saveBill(bill);

      // Advance next date
      const next = new Date(tpl.nextDate || today);
      if (tpl.frequency === 'weekly') next.setDate(next.getDate() + 7);
      else if (tpl.frequency === 'monthly') next.setMonth(next.getMonth() + 1);
      else if (tpl.frequency === 'quarterly') next.setMonth(next.getMonth() + 3);
      else if (tpl.frequency === 'yearly') next.setFullYear(next.getFullYear() + 1);

      await saveRecurring({ ...tpl, nextDate: next.toISOString().split('T')[0], lastGenerated: today });

      toast(`Invoice ${invoiceNumber} generated for ${tpl.clientName}`, 'success');
      load();
    } catch (err) {
      toast('Failed to generate: ' + err.message, 'error');
    }
  };

  const getDueTemplates = () => {
    const today = new Date().toISOString().split('T')[0];
    return templates.filter(t => t.active !== false && t.nextDate && t.nextDate <= today);
  };

  const dueTemplates = getDueTemplates();

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Recurring Invoices</h1>
          <p className="page-subtitle">Auto-generate invoices for retainer clients</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> New Template</button>
      </div>

      {/* Due Now Alert */}
      {dueTemplates.length > 0 && (
        <div className="glass-panel p-4 mb-6" style={{ borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
          <h4 style={{ marginBottom: '0.5rem', color: '#92400e' }}>{dueTemplates.length} invoice{dueTemplates.length > 1 ? 's' : ''} due for generation</h4>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {dueTemplates.map(tpl => (
              <button key={tpl.id} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                onClick={() => generateNow(tpl)}>
                <Play size={14} /> {tpl.clientName} — {FREQUENCIES.find(f => f.value === tpl.frequency)?.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px', maxHeight: '90vh' }}>
            <h3 className="section-title">{editingId ? 'Edit Template' : 'New Recurring Invoice'}</h3>

            {/* Client picker */}
            {!editingId && clients.length > 0 && !form.clientName && (
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Quick Select Client</label>
                <div className="client-picker">
                  {clients.map(cli => (
                    <button key={cli.id} className="client-picker-item" onClick={() => selectClient(cli)}>
                      <strong>{cli.name}</strong>
                      <span>{cli.state}{cli.gstin ? ` | ${cli.gstin}` : ''}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Client Name *</label>
                <input type="text" className="form-input" value={form.clientName} onChange={e => updateField('clientName', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Client GSTIN</label>
                <input type="text" className="form-input" value={form.clientGstin} onChange={e => updateField('clientGstin', e.target.value)} maxLength={15} />
              </div>
              <div className="form-group">
                <label className="form-label">Frequency</label>
                <select className="form-input" value={form.frequency} onChange={e => updateField('frequency', e.target.value)}>
                  {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Next Due Date</label>
                <input type="date" className="form-input" value={form.nextDate} onChange={e => updateField('nextDate', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Invoice Type</label>
                <select className="form-input" value={form.invoiceType} onChange={e => updateField('invoiceType', e.target.value)}>
                  {Object.entries(INVOICE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>

            {/* Line Items */}
            <h4 style={{ marginTop: '1rem', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>Line Items</h4>
            {form.items.map((item, idx) => (
              <div key={idx} className="line-item-row" style={{ alignItems: 'flex-end' }}>
                <div className="line-item-field" style={{ flex: 2 }}>
                  <label className="form-label">Description</label>
                  <input type="text" className="form-input" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} />
                </div>
                <div className="line-item-field" style={{ width: 80 }}>
                  <label className="form-label">Qty</label>
                  <input type="number" className="form-input" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} min="1" />
                </div>
                <div className="line-item-field" style={{ width: 100 }}>
                  <label className="form-label">Rate</label>
                  <input type="number" className="form-input" value={item.rate} onChange={e => updateItem(idx, 'rate', e.target.value)} min="0" />
                </div>
                <div className="line-item-field" style={{ width: 70 }}>
                  <label className="form-label">GST%</label>
                  <input type="number" className="form-input" value={item.taxPercent} onChange={e => updateItem(idx, 'taxPercent', e.target.value)} min="0" />
                </div>
                <div className="line-item-delete">
                  {form.items.length > 1 && (
                    <button className="icon-btn icon-btn-red" onClick={() => removeItem(idx)}><X size={14} /></button>
                  )}
                </div>
              </div>
            ))}
            <button className="btn btn-secondary" onClick={addItem} style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>
              <Plus size={14} /> Add Item
            </button>

            <div className="flex gap-2 justify-end mt-4">
              <button className="btn btn-secondary" onClick={closeForm}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}><Save size={16} /> {editingId ? 'Update' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Templates List */}
      <div className="glass-panel">
        <div className="table-header"><h3>Recurring Templates</h3></div>
        {templates.length === 0 ? (
          <div className="empty-state">
            <RefreshCw size={48} />
            <p>No recurring invoices set up yet.</p>
            <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Create Template</button>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: '700px' }}>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Frequency</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Next Due</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map(tpl => {
                  const total = (tpl.items || []).reduce((s, i) => {
                    const base = (parseFloat(i.quantity) || 1) * (parseFloat(i.rate) || 0) - (parseFloat(i.discount) || 0);
                    return s + base + (base * (parseFloat(i.taxPercent) || 0) / 100);
                  }, 0);
                  const isDue = tpl.active !== false && tpl.nextDate && tpl.nextDate <= new Date().toISOString().split('T')[0];
                  return (
                    <tr key={tpl.id} style={isDue ? { background: '#fffbeb' } : {}}>
                      <td className="font-medium">{tpl.clientName}</td>
                      <td><span className="type-badge">{FREQUENCIES.find(f => f.value === tpl.frequency)?.label}</span></td>
                      <td className="text-muted">{INVOICE_TYPES[tpl.invoiceType || 'tax-invoice']?.label}</td>
                      <td style={{ textAlign: 'right' }} className="font-bold">{formatCurrency(total)}</td>
                      <td className={isDue ? 'font-bold' : 'text-muted'} style={isDue ? { color: '#d97706' } : {}}>
                        {tpl.nextDate ? new Date(tpl.nextDate).toLocaleDateString('en-IN') : '-'}
                      </td>
                      <td>
                        <span className="status-badge" style={{
                          background: tpl.active !== false ? '#ecfdf5' : '#f3f4f6',
                          color: tpl.active !== false ? '#059669' : '#6b7280',
                        }}>
                          {tpl.active !== false ? 'Active' : 'Paused'}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button className="icon-btn icon-btn-green" onClick={() => generateNow(tpl)} title="Generate Now"><Play size={15} /></button>
                          <button className="icon-btn icon-btn-blue" onClick={() => toggleActive(tpl)} title={tpl.active !== false ? 'Pause' : 'Activate'}>
                            {tpl.active !== false ? <Pause size={15} /> : <Play size={15} />}
                          </button>
                          <button className="icon-btn icon-btn-blue" onClick={() => openEdit(tpl)} title="Edit"><Edit3 size={15} /></button>
                          <button className="icon-btn icon-btn-red" onClick={() => handleDelete(tpl.id)} title="Delete"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
