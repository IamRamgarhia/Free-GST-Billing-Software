import { useState, useEffect, useRef } from 'react';
import { Receipt, Plus, Trash2, Search, X, Download, Printer } from 'lucide-react';
import { getAllReceipts, saveReceipt, deleteReceipt, getAllBills, getProfile } from '../store';
import { formatCurrency, numberToWords } from '../utils';
import { toast } from './Toast';

const PAYMENT_MODES = ['Bank Transfer', 'UPI', 'Cash', 'Cheque', 'Card', 'Other'];

const emptyForm = {
  date: new Date().toISOString().split('T')[0],
  receiptNo: '',
  clientName: '',
  clientAddress: '',
  amount: '',
  paymentMode: 'Bank Transfer',
  referenceNo: '',
  againstInvoice: '',
  note: '',
};

export default function ReceiptVoucher() {
  const [receipts, setReceipts] = useState([]);
  const [bills, setBills] = useState([]);
  const [profile, setProfile] = useState({});
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [previewReceipt, setPreviewReceipt] = useState(null);
  const receiptRef = useRef(null);

  const loadData = async () => {
    try {
      const [recs, bls, prof] = await Promise.all([getAllReceipts(), getAllBills(), getProfile()]);
      setReceipts(recs);
      setBills(bls);
      setProfile(prof);
    } catch {
      toast('Failed to load data', 'error');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getNextReceiptNo = () => {
    const count = receipts.length + 1;
    const now = new Date();
    const fy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return `RCP/${fy}-${String(fy + 1).slice(-2)}/${String(count).padStart(4, '0')}`;
  };

  const filtered = search.trim()
    ? receipts.filter(r =>
        (r.clientName || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.receiptNo || '').toLowerCase().includes(search.toLowerCase()))
    : receipts;

  const openAdd = () => {
    setForm({ ...emptyForm, receiptNo: getNextReceiptNo() });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setForm({ ...emptyForm }); };

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const selectInvoice = (bill) => {
    setForm(prev => ({
      ...prev,
      clientName: bill.clientName || '',
      clientAddress: bill.data?.client?.address || '',
      amount: String(bill.totalAmount - (bill.paidAmount || 0)),
      againstInvoice: bill.invoiceNumber || '',
    }));
  };

  const handleSave = async () => {
    if (!form.clientName.trim()) { toast('Client name required', 'warning'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast('Enter valid amount', 'warning'); return; }
    try {
      const receipt = {
        ...form,
        amount: parseFloat(form.amount),
      };
      await saveReceipt(receipt);
      toast('Receipt saved', 'success');
      closeForm();
      loadData();
    } catch {
      toast('Failed to save', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this receipt?')) {
      try { await deleteReceipt(id); toast('Deleted', 'success'); loadData(); }
      catch { toast('Failed to delete', 'error'); }
    }
  };

  const printReceipt = (receipt) => {
    setPreviewReceipt(receipt);
    setTimeout(() => {
      const el = receiptRef.current;
      if (!el) return;
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html><head><title>Receipt ${receipt.receiptNo}</title>
        <style>
          body { font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 2rem; color: #1a1a2e; }
          .receipt-box { max-width: 600px; margin: 0 auto; border: 2px solid #e2e8f0; border-radius: 8px; padding: 2rem; }
          .receipt-header { text-align: center; margin-bottom: 1.5rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 1rem; }
          .receipt-title { font-size: 1.5rem; font-weight: 800; color: #0f172a; margin: 0; }
          .receipt-subtitle { font-size: 0.8rem; color: #64748b; margin: 0.25rem 0 0; }
          .receipt-row { display: flex; justify-content: space-between; padding: 0.5rem 0; font-size: 0.9rem; border-bottom: 1px solid #f1f5f9; }
          .receipt-label { color: #64748b; font-weight: 500; }
          .receipt-value { color: #1e293b; font-weight: 600; }
          .receipt-amount { font-size: 1.5rem; font-weight: 800; color: #1e40af; text-align: center; margin: 1.5rem 0; padding: 1rem; background: #eff6ff; border-radius: 8px; }
          .receipt-words { font-size: 0.85rem; color: #334155; font-style: italic; text-align: center; margin-bottom: 1.5rem; }
          .receipt-footer { display: flex; justify-content: space-between; margin-top: 3rem; padding-top: 1rem; }
          .receipt-sig { text-align: center; }
          .receipt-sig-line { width: 180px; border-bottom: 1.5px solid #1e293b; margin-bottom: 0.25rem; }
          .receipt-sig-label { font-size: 0.75rem; color: #64748b; }
          .business-name { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.25rem; }
          .business-details { font-size: 0.75rem; color: #64748b; }
          @media print { body { margin: 0; } .receipt-box { border: none; } }
        </style></head><body>
        ${el.innerHTML}
        <script>window.print(); window.close();</script>
        </body></html>
      `);
      printWindow.document.close();
      setPreviewReceipt(null);
    }, 100);
  };

  const unpaidBills = bills.filter(b => b.status !== 'paid');

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Receipts</h1>
          <p className="page-subtitle">Generate payment receipts for clients</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> New Receipt</button>
      </div>

      {/* Add Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h3 className="section-title">New Payment Receipt</h3>

            {/* Quick select from unpaid invoices */}
            {unpaidBills.length > 0 && !form.againstInvoice && (
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Quick Select — Unpaid Invoices</label>
                <div className="client-picker" style={{ maxHeight: '150px' }}>
                  {unpaidBills.slice(0, 10).map(bill => (
                    <button key={bill.id} className="client-picker-item" onClick={() => selectInvoice(bill)}>
                      <div>
                        <strong>{bill.clientName}</strong>
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{bill.invoiceNumber}</span>
                      </div>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(bill.totalAmount - (bill.paidAmount || 0))}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Receipt No</label>
                <input type="text" className="form-input" value={form.receiptNo} onChange={e => updateField('receiptNo', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input type="date" className="form-input" value={form.date} onChange={e => updateField('date', e.target.value)} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Received From (Client Name) *</label>
                <input type="text" className="form-input" value={form.clientName} onChange={e => updateField('clientName', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Amount *</label>
                <input type="number" className="form-input" value={form.amount} onChange={e => updateField('amount', e.target.value)} min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Mode</label>
                <select className="form-input" value={form.paymentMode} onChange={e => updateField('paymentMode', e.target.value)}>
                  {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Reference / Transaction No</label>
                <input type="text" className="form-input" value={form.referenceNo} onChange={e => updateField('referenceNo', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Against Invoice</label>
                <input type="text" className="form-input" value={form.againstInvoice} onChange={e => updateField('againstInvoice', e.target.value)} placeholder="e.g. INV/2025-26/0001" />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Note (optional)</label>
                <input type="text" className="form-input" value={form.note} onChange={e => updateField('note', e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button className="btn btn-secondary" onClick={closeForm}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>Save Receipt</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden receipt for printing */}
      {previewReceipt && (
        <div style={{ position: 'absolute', left: '-9999px' }} ref={receiptRef}>
          <div className="receipt-box">
            <div className="receipt-header">
              <p className="business-name">{profile.businessName || 'Your Business'}</p>
              <p className="business-details">{profile.address}</p>
              {profile.gstin && <p className="business-details">GSTIN: {profile.gstin}</p>}
              <h2 className="receipt-title">PAYMENT RECEIPT</h2>
            </div>
            <div className="receipt-row"><span className="receipt-label">Receipt No:</span><span className="receipt-value">{previewReceipt.receiptNo}</span></div>
            <div className="receipt-row"><span className="receipt-label">Date:</span><span className="receipt-value">{new Date(previewReceipt.date).toLocaleDateString('en-IN')}</span></div>
            <div className="receipt-row"><span className="receipt-label">Received From:</span><span className="receipt-value">{previewReceipt.clientName}</span></div>
            <div className="receipt-row"><span className="receipt-label">Payment Mode:</span><span className="receipt-value">{previewReceipt.paymentMode}</span></div>
            {previewReceipt.referenceNo && <div className="receipt-row"><span className="receipt-label">Reference No:</span><span className="receipt-value">{previewReceipt.referenceNo}</span></div>}
            {previewReceipt.againstInvoice && <div className="receipt-row"><span className="receipt-label">Against Invoice:</span><span className="receipt-value">{previewReceipt.againstInvoice}</span></div>}
            <div className="receipt-amount">{formatCurrency(previewReceipt.amount)}</div>
            <p className="receipt-words">{numberToWords(previewReceipt.amount)}</p>
            {previewReceipt.note && <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Note: {previewReceipt.note}</p>}
            <div className="receipt-footer">
              <div className="receipt-sig"><div className="receipt-sig-line"></div><span className="receipt-sig-label">Received By</span></div>
              <div className="receipt-sig"><div className="receipt-sig-line"></div><span className="receipt-sig-label">Authorized Signatory</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="glass-panel p-4 mb-6">
        <div className="search-box" style={{ maxWidth: '400px' }}>
          <Search size={16} className="search-icon" />
          <input type="text" placeholder="Search receipts..." value={search}
            onChange={e => setSearch(e.target.value)} className="search-input" />
        </div>
      </div>

      {/* Receipts Table */}
      <div className="glass-panel">
        <div className="table-header"><h3>Payment Receipts</h3></div>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <Receipt size={48} />
            <p>{receipts.length === 0 ? 'No receipts generated yet.' : 'No receipts match your search.'}</p>
            {receipts.length === 0 && <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Create Receipt</button>}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: '700px' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Receipt No</th>
                  <th>Client</th>
                  <th>Against Invoice</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Mode</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(rcp => (
                  <tr key={rcp.id}>
                    <td className="text-muted">{rcp.date ? new Date(rcp.date).toLocaleDateString('en-IN') : ''}</td>
                    <td><span className="invoice-badge">{rcp.receiptNo}</span></td>
                    <td className="font-medium">{rcp.clientName}</td>
                    <td className="text-muted">{rcp.againstInvoice || '-'}</td>
                    <td style={{ textAlign: 'right' }} className="font-bold">{formatCurrency(rcp.amount)}</td>
                    <td className="text-muted">{rcp.paymentMode}</td>
                    <td>
                      <div className="table-actions">
                        <button className="icon-btn icon-btn-blue" onClick={() => printReceipt(rcp)} title="Print"><Printer size={15} /></button>
                        <button className="icon-btn icon-btn-red" onClick={() => handleDelete(rcp.id)} title="Delete"><Trash2 size={15} /></button>
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
