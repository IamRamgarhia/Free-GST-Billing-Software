import { useState, useEffect } from 'react';
import { FileText, Trash2, Plus, IndianRupee, Receipt, Edit3, TrendingUp, Search, Copy, X, CheckCircle, Clock, AlertTriangle, MessageCircle, Mail, StickyNote } from 'lucide-react';
import { getAllBills, deleteBill, saveBill, getAllProducts, saveProduct } from '../store';
import { formatCurrency, INVOICE_TYPES } from '../utils';
import { toast } from './Toast';

const STATUS_CONFIG = {
  unpaid: { label: 'Unpaid', icon: Clock, color: '#f59e0b', bg: '#fffbeb' },
  partial: { label: 'Partial', icon: Clock, color: '#8b5cf6', bg: '#f5f3ff' },
  paid: { label: 'Paid', icon: CheckCircle, color: '#059669', bg: '#ecfdf5' },
  overdue: { label: 'Overdue', icon: AlertTriangle, color: '#dc2626', bg: '#fef2f2' },
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

export default function Dashboard({ onNew, onEdit, onDuplicate, onConvert }) {
  const [bills, setBills] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [stats, setStats] = useState({ total: 0, tax: 0, count: 0, unpaid: 0 });
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fyFilter, setFyFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentModal, setPaymentModal] = useState(null);
  const [paymentInput, setPaymentInput] = useState({ amount: '', date: '', mode: 'bank-transfer', note: '' });

  const fyOptions = getFYOptions();

  useEffect(() => { loadBills(); }, []);

  useEffect(() => {
    let result = bills;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(b =>
        (b.clientName || '').toLowerCase().includes(q) ||
        (b.invoiceNumber || '').toLowerCase().includes(q)
      );
    }
    if (typeFilter !== 'all') result = result.filter(b => (b.invoiceType || 'tax-invoice') === typeFilter);
    if (statusFilter !== 'all') result = result.filter(b => (b.status || 'unpaid') === statusFilter);
    if (fyFilter !== 'all') {
      const fy = fyOptions.find(f => f.value === fyFilter);
      if (fy) result = result.filter(b => b.invoiceDate >= fy.from && b.invoiceDate <= fy.to);
    }
    if (dateFrom) result = result.filter(b => b.invoiceDate >= dateFrom);
    if (dateTo) result = result.filter(b => b.invoiceDate <= dateTo);
    setFiltered(result);
  }, [bills, search, typeFilter, statusFilter, fyFilter, dateFrom, dateTo]);

  const loadBills = async () => {
    try {
      const data = await getAllBills();
      const today = new Date().toISOString().split('T')[0];

      // Auto-detect overdue: if due date passed and not paid, mark as overdue
      for (const bill of data) {
        const dueDate = bill.data?.details?.dueDate;
        if (dueDate && dueDate < today && bill.status !== 'paid' && bill.status !== 'overdue') {
          bill.status = 'overdue';
          await saveBill(bill);
        }
      }

      setBills(data);
      const totalAmount = data.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
      const totalTax = data.reduce((sum, b) => sum + (b.totalTaxAmount || 0), 0);
      const unpaid = data.filter(b => b.status !== 'paid').reduce((sum, b) => sum + (b.totalAmount || 0) - (b.paidAmount || 0), 0);
      setStats({ total: totalAmount, tax: totalTax, count: data.length, unpaid });
    } catch {
      toast('Failed to load invoices', 'error');
    }
  };

  const handleDelete = async (bill) => {
    if (confirm('Delete this invoice? This cannot be undone.')) {
      try {
        // Restore stock for products used in this invoice
        if (bill.data?.items) {
          const products = await getAllProducts();
          for (const item of bill.data.items) {
            if (!item.productId) continue;
            const product = products.find(p => p.id === item.productId);
            if (!product) continue;
            await saveProduct({ ...product, stock: (product.stock || 0) + (item.quantity || 0) });
          }
        }
        await deleteBill(bill.id);
        toast('Invoice deleted & stock restored', 'success');
        loadBills();
      } catch { toast('Failed to delete', 'error'); }
    }
  };

  const handleView = (bill) => {
    if (bill.data) onEdit(bill);
    else toast('No editable data saved for this invoice', 'warning');
  };

  const changeStatus = async (bill, newStatus) => {
    const updated = { ...bill, status: newStatus };
    if (newStatus === 'paid') updated.paidAmount = bill.totalAmount;
    await saveBill(updated);
    toast(`Marked as ${STATUS_CONFIG[newStatus].label}`, 'info');
    loadBills();
  };

  const openPaymentModal = (bill) => {
    setPaymentModal(bill);
    setPaymentInput({ amount: '', date: new Date().toISOString().split('T')[0], mode: 'bank-transfer', note: '' });
  };

  const recordPayment = async () => {
    if (!paymentInput.amount || parseFloat(paymentInput.amount) <= 0) {
      toast('Enter a valid amount', 'warning'); return;
    }
    const amount = parseFloat(paymentInput.amount);
    const bill = paymentModal;
    const payments = [...(bill.payments || []), {
      amount, date: paymentInput.date, mode: paymentInput.mode,
      note: paymentInput.note, recordedAt: new Date().toISOString(),
    }];
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    await saveBill({
      ...bill, payments, paidAmount: totalPaid,
      status: totalPaid >= bill.totalAmount ? 'paid' : 'partial',
    });
    toast(`Payment of ${formatCurrency(amount)} recorded`, 'success');
    setPaymentModal(null);
    loadBills();
  };

  const shareWhatsApp = (bill) => {
    const phone = bill.clientPhone ? bill.clientPhone.replace(/\D/g, '') : '';
    const msg = `*Invoice: ${bill.invoiceNumber}*\nClient: ${bill.clientName}\nAmount: ${formatCurrency(bill.totalAmount)}\nDate: ${new Date(bill.invoiceDate).toLocaleDateString('en-IN')}\nStatus: ${(bill.status || 'unpaid').toUpperCase()}`;
    const encoded = encodeURIComponent(msg);

    // Try whatsapp:// protocol first (opens desktop app if installed)
    const desktopUrl = `whatsapp://send?${phone ? `phone=${phone}&` : ''}text=${encoded}`;
    const webUrl = `https://web.whatsapp.com/send?${phone ? `phone=${phone}&` : ''}text=${encoded}`;

    // Try desktop app, fall back to web after timeout
    window.open(desktopUrl, '_self');
    setTimeout(() => {
      // If we're still here, desktop app didn't open — use web
      if (!document.hidden) {
        window.open(webUrl, '_blank');
      }
    }, 1500);
  };

  const shareEmail = (bill) => {
    const subject = `Invoice ${bill.invoiceNumber} - ${formatCurrency(bill.totalAmount)}`;
    const body = `Dear ${bill.clientName},\n\nInvoice No: ${bill.invoiceNumber}\nAmount: ${formatCurrency(bill.totalAmount)}\nDate: ${new Date(bill.invoiceDate).toLocaleDateString('en-IN')}\nStatus: ${bill.status === 'paid' ? 'Paid' : 'Payment Pending'}\n\nRegards`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  };

  const clearFilters = () => {
    setSearch(''); setTypeFilter('all'); setStatusFilter('all'); setFyFilter('all'); setDateFrom(''); setDateTo('');
  };

  const hasFilters = search || typeFilter !== 'all' || statusFilter !== 'all' || fyFilter !== 'all' || dateFrom || dateTo;

  const overdueBills = bills.filter(b => b.status === 'overdue');
  const overdueTotal = overdueBills.reduce((sum, b) => sum + (b.totalAmount || 0) - (b.paidAmount || 0), 0);

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of your invoices</p>
        </div>
        <button className="btn btn-primary" onClick={onNew}><Plus size={18} /> New Invoice</button>
      </div>

      {overdueBills.length > 0 && (
        <div className="overdue-banner" onClick={() => { setStatusFilter('overdue'); }}
          style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '0.85rem 1.25rem', marginBottom: '1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertTriangle size={20} style={{ color: '#dc2626', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 700, color: '#dc2626' }}>
              {overdueBills.length} overdue invoice{overdueBills.length > 1 ? 's' : ''}
            </span>
            <span style={{ color: '#991b1b', marginLeft: 8, fontSize: '0.85rem' }}>
              — {formatCurrency(overdueTotal)} outstanding
            </span>
          </div>
          <span style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 500 }}>View all &rarr;</span>
        </div>
      )}

      <div className="stats-grid stats-grid-4">
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue"><IndianRupee size={22} /></div>
          <div><p className="stat-label">Total Invoiced</p><h2 className="stat-value">{formatCurrency(stats.total)}</h2></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-green"><TrendingUp size={22} /></div>
          <div><p className="stat-label">Tax Collected</p><h2 className="stat-value stat-value-green">{formatCurrency(stats.tax)}</h2></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-amber"><Clock size={22} /></div>
          <div><p className="stat-label">Outstanding</p><h2 className="stat-value stat-value-amber">{formatCurrency(stats.unpaid)}</h2></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-purple"><Receipt size={22} /></div>
          <div><p className="stat-label">Invoices</p><h2 className="stat-value stat-value-purple">{stats.count}</h2></div>
        </div>
      </div>

      <div className="glass-panel">
        <div className="table-header"><h3>Invoices</h3></div>
        <div className="filters-bar">
          <div className="search-box">
            <Search size={16} className="search-icon" />
            <input type="text" placeholder="Search client or invoice..." value={search}
              onChange={e => setSearch(e.target.value)} className="search-input" />
          </div>
          <select className="filter-select" value={fyFilter} onChange={e => setFyFilter(e.target.value)}>
            <option value="all">All Years</option>
            {fyOptions.map(fy => <option key={fy.value} value={fy.value}>{fy.label}</option>)}
          </select>
          <select className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            {Object.entries(INVOICE_TYPES).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
          </select>
          <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
          <input type="date" className="filter-date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From" />
          <input type="date" className="filter-date" value={dateTo} onChange={e => setDateTo(e.target.value)} title="To" />
          {hasFilters && <button className="icon-btn icon-btn-red" onClick={clearFilters} title="Clear"><X size={15} /></button>}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <FileText size={48} />
            <p>{bills.length === 0 ? 'No invoices yet.' : 'No invoices match your filters.'}</p>
            {bills.length === 0 && <button className="btn btn-primary" onClick={onNew}><Plus size={18} /> Create Invoice</button>}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice No.</th>
                  <th>Type</th>
                  <th>Client</th>
                  <th>Amount</th>
                  <th>Paid</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(bill => {
                  const status = bill.status || 'unpaid';
                  const sc = STATUS_CONFIG[status] || STATUS_CONFIG.unpaid;
                  const isOverdue = status !== 'paid' && bill.data?.details?.dueDate && new Date(bill.data.details.dueDate) < new Date();
                  const daysOverdue = isOverdue ? Math.floor((new Date() - new Date(bill.data.details.dueDate)) / 86400000) : 0;
                  return (
                    <tr key={bill.id} style={isOverdue || status === 'overdue' ? { background: '#fef2f2' } : {}}>
                      <td className="text-muted">{new Date(bill.invoiceDate).toLocaleDateString('en-IN')}</td>
                      <td><span className="invoice-badge">{bill.invoiceNumber}</span></td>
                      <td><span className="type-badge">{(INVOICE_TYPES[bill.invoiceType || 'tax-invoice'])?.label}</span></td>
                      <td className="font-medium td-client" title={bill.clientName}>
                        {bill.clientName}
                        {bill.data?.internalNote && (
                          <span title={bill.data.internalNote} style={{ marginLeft: 4, cursor: 'help', verticalAlign: 'middle' }}>
                            <StickyNote size={13} style={{ color: '#ca8a04' }} />
                          </span>
                        )}
                      </td>
                      <td className="font-bold">{formatCurrency(bill.totalAmount)}</td>
                      <td className="text-muted">{(bill.paidAmount || 0) > 0 ? formatCurrency(bill.paidAmount) : '-'}</td>
                      <td>
                        <select className="status-select" value={isOverdue && status !== 'overdue' ? 'overdue' : status}
                          style={{ background: sc.bg, color: sc.color, borderColor: sc.color + '44' }}
                          onChange={e => changeStatus(bill, e.target.value)}>
                          {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                            <option key={key} value={key}>{val.label}</option>
                          ))}
                        </select>
                        {daysOverdue > 0 && <span style={{ fontSize: '0.7rem', color: '#dc2626', display: 'block', marginTop: 2 }}>{daysOverdue}d overdue</span>}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button className="icon-btn icon-btn-blue" onClick={() => handleView(bill)} title="Edit"><Edit3 size={15} /></button>
                          <button className="icon-btn icon-btn-blue" onClick={() => onDuplicate(bill)} title="Duplicate"><Copy size={15} /></button>
                          {(bill.invoiceType === 'proforma' || bill.invoiceType === 'delivery-challan') && (
                            <button className="icon-btn icon-btn-green" onClick={() => onConvert(bill)} title="Convert to Tax Invoice"><FileText size={15} /></button>
                          )}
                          <button className="icon-btn icon-btn-green" onClick={() => openPaymentModal(bill)} title="Payment"><IndianRupee size={15} /></button>
                          <button className="icon-btn icon-btn-green" onClick={() => shareWhatsApp(bill)} title="WhatsApp"><MessageCircle size={15} /></button>
                          <button className="icon-btn icon-btn-blue" onClick={() => shareEmail(bill)} title="Email"><Mail size={15} /></button>
                          <button className="icon-btn icon-btn-red" onClick={() => handleDelete(bill)} title="Delete"><Trash2 size={15} /></button>
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

      {/* Payment Modal */}
      {paymentModal && (
        <div className="modal-overlay" onClick={() => setPaymentModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="section-title">Record Payment</h3>
            <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
              Invoice: <strong>{paymentModal.invoiceNumber}</strong> | Total: <strong>{formatCurrency(paymentModal.totalAmount)}</strong>
              {(paymentModal.paidAmount || 0) > 0 && <> | Paid: <strong>{formatCurrency(paymentModal.paidAmount)}</strong></>}
              {' '}| Balance: <strong style={{ color: '#dc2626' }}>{formatCurrency(paymentModal.totalAmount - (paymentModal.paidAmount || 0))}</strong>
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Amount Received</label>
                <input type="number" className="form-input" value={paymentInput.amount}
                  onChange={e => setPaymentInput(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder={String(paymentModal.totalAmount - (paymentModal.paidAmount || 0))} min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Date</label>
                <input type="date" className="form-input" value={paymentInput.date}
                  onChange={e => setPaymentInput(prev => ({ ...prev, date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Mode</label>
                <select className="form-input" value={paymentInput.mode}
                  onChange={e => setPaymentInput(prev => ({ ...prev, mode: e.target.value }))}>
                  <option value="bank-transfer">Bank Transfer</option>
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Note (optional)</label>
                <input type="text" className="form-input" value={paymentInput.note}
                  onChange={e => setPaymentInput(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="Transaction ID, ref..." />
              </div>
            </div>
            {paymentModal.payments?.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <label className="form-label">Payment History</label>
                <div className="payment-history">
                  {paymentModal.payments.map((p, i) => (
                    <div key={i} className="payment-row">
                      <span>{new Date(p.date).toLocaleDateString('en-IN')}</span>
                      <span className="font-bold">{formatCurrency(p.amount)}</span>
                      <span className="text-muted">{p.mode}</span>
                      {p.note && <span className="text-muted">{p.note}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 justify-end mt-4">
              <button className="btn btn-secondary" onClick={() => setPaymentModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={recordPayment}>Record Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
