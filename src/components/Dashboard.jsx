import { useState, useEffect } from 'react';
import { FileText, Trash2, Plus, IndianRupee, Receipt, Edit3, TrendingUp, Search, Copy, X, CheckCircle, Clock, AlertTriangle, MessageCircle, Mail, StickyNote, Send, Package } from 'lucide-react';
import { getAllBills, deleteBill, saveBill, getAllProducts, saveProduct, getProfile, getAllClients, getStockAlertSettings } from '../store';
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
  const [stats, setStats] = useState({ byCurrency: {}, count: 0 });
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fyFilter, setFyFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // Bulk-selection state. Stores a Set of bill IDs (not the bills themselves)
  // so we don't hold stale references when the underlying bill is edited
  // elsewhere. Cleared whenever filters change so the user doesn't accidentally
  // bulk-act on bills they can no longer see.
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [paymentModal, setPaymentModal] = useState(null);
  const [paymentInput, setPaymentInput] = useState({ amount: '', date: '', mode: 'bank-transfer', note: '' });
  const [showRemindAll, setShowRemindAll] = useState(false);
  const [profile, setProfileState] = useState(null);
  const [clients, setClients] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);

  const fyOptions = getFYOptions();

  const loadBills = async () => {
    try {
      const data = await getAllBills();
      const today = new Date().toISOString().split('T')[0];

      // Auto-detect overdue: if due date passed and not paid, mark as overdue.
      // Previously this did sequential `await saveBill(bill)` inside a for-loop,
      // which (a) made N round-trips serialised and (b) silently stopped on the
      // first failure. Now we collect dirty bills and save them concurrently via
      // allSettled so one slow save can't block the rest.
      const dirty = data.filter(bill => {
        const dueDate = bill.data?.details?.dueDate;
        return dueDate && dueDate < today && bill.status !== 'paid' && bill.status !== 'overdue';
      });
      if (dirty.length > 0) {
        const updates = dirty.map(bill => { bill.status = 'overdue'; return saveBill(bill, { overwrite: true }); });
        await Promise.allSettled(updates);
      }

      setBills(data);

      // Group totals by currency
      const byCurrency = {};
      for (const b of data) {
        const cur = b.currency || b.data?.invoiceOptions?.currency || 'INR';
        if (!byCurrency[cur]) byCurrency[cur] = { total: 0, tax: 0, unpaid: 0 };
        byCurrency[cur].total += b.totalAmount || 0;
        byCurrency[cur].tax += b.totalTaxAmount || 0;
        if (b.status !== 'paid') byCurrency[cur].unpaid += (b.totalAmount || 0) - (b.paidAmount || 0);
      }
      setStats({ byCurrency, count: data.length });
    } catch {
      toast('Failed to load invoices', 'error');
    }
  };

  useEffect(() => {
    loadBills();
    getProfile().then(p => setProfileState(p)).catch(() => {});
    getAllClients().then(c => setClients(c)).catch(() => {});
    // Pull the stock-alert config alongside products so the Dashboard's
    // low-stock card honours the user's threshold + on/off preference.
    Promise.all([
      getAllProducts().catch(() => []),
      getStockAlertSettings().catch(() => ({ enabled: true, threshold: 5 })),
    ]).then(([prods, cfg]) => {
      if (cfg?.enabled === false) { setLowStockProducts([]); return; }
      const threshold = Number(cfg?.threshold ?? 5);
      setLowStockProducts(prods.filter(p => (p.stock ?? 0) <= threshold));
    });
  }, []);

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

        // Move saved PDF to Trash folder
        const prefix = { 'tax-invoice': 'INV', 'proforma': 'PRO', 'credit-note': 'CN', 'bill-of-supply': 'BOS', 'delivery-challan': 'DC' }[bill.invoiceType || 'tax-invoice'] || 'INV';
        const pdfName = `${prefix}_${(bill.invoiceNumber || '').replace(/\//g, '-')}.pdf`;
        const clientName = bill.clientName || bill.data?.client?.name || 'General';
        fetch('/api/trash-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: pdfName, clientName }) }).catch(err => console.warn('Could not trash PDF:', err));

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
    if (newStatus === 'paid') {
      updated.paidAmount = bill.totalAmount;
      // When flipping to paid via the row menu, also push a synthetic payment
      // so the payment-history modal and ReportsView cashflow both reflect
      // it. Without this, "Mark as Paid" left `payments: []` and the two
      // reports disagreed with the bill's status.
      const already = (bill.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const outstanding = Math.max(0, Number(bill.totalAmount) - already);
      if (outstanding > 0) {
        updated.payments = [...(bill.payments || []), {
          amount: outstanding,
          date: new Date().toISOString().split('T')[0],
          mode: 'other',
          note: 'Marked paid',
          recordedAt: new Date().toISOString(),
        }];
      }
    }
    await saveBill(updated, { overwrite: true });
    toast(`Marked as ${STATUS_CONFIG[newStatus].label}`, 'info');
    loadBills();
  };

  const openPaymentModal = (bill) => {
    setPaymentModal(bill);
    setPaymentInput({ amount: '', date: new Date().toISOString().split('T')[0], mode: 'bank-transfer', note: '' });
  };

  const recordPayment = async () => {
    const amount = parseFloat(paymentInput.amount);
    // Validate the amount up front — reject negatives, NaN, zero, and "more than
    // the outstanding balance". Without this, a typo can record ₹9,999,999 against
    // a ₹10,000 invoice and silently invert the books.
    if (!isFinite(amount) || amount <= 0) {
      toast('Enter a positive payment amount', 'warning'); return;
    }
    const bill = paymentModal;
    const billTotal = Number(bill.totalAmount) || 0;
    const alreadyPaid = Number(bill.paidAmount) || 0;
    const outstanding = Math.max(0, billTotal - alreadyPaid);
    if (amount > outstanding + 0.01) { // 0.01 fudge for rounding
      const proceed = confirm(`This payment (${formatCurrency(amount, bill.currency)}) is more than the outstanding balance (${formatCurrency(outstanding, bill.currency)}). Record it as an overpayment anyway?`);
      if (!proceed) return;
    }
    const payments = [...(bill.payments || []), {
      amount, date: paymentInput.date, mode: paymentInput.mode,
      note: paymentInput.note, recordedAt: new Date().toISOString(),
    }];
    const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    await saveBill({
      ...bill, payments, paidAmount: totalPaid,
      status: totalPaid >= billTotal ? 'paid' : 'partial',
    }, { overwrite: true });
    toast(`Payment of ${formatCurrency(amount, bill.currency)} recorded`, 'success');
    setPaymentModal(null);
    loadBills();
  };

  // ---- Bulk operations ----
  // All bulk handlers fan out concurrently via Promise.allSettled so one
  // failure can't strand the rest. After every bulk action we refresh the
  // bills list and clear the selection.
  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleSelectAllVisible = () => setSelectedIds(prev => {
    const allVisible = filtered.every(b => prev.has(b.id));
    if (allVisible) {
      // Deselect only the visible ones, leave any off-screen selections alone
      const next = new Set(prev);
      filtered.forEach(b => next.delete(b.id));
      return next;
    }
    const next = new Set(prev);
    filtered.forEach(b => next.add(b.id));
    return next;
  });
  const clearSelection = () => setSelectedIds(new Set());
  const getSelectedBills = () => bills.filter(b => selectedIds.has(b.id));

  const bulkMarkStatus = async (newStatus) => {
    const sel = getSelectedBills();
    if (sel.length === 0) return;
    if (!confirm(`Mark ${sel.length} invoice${sel.length !== 1 ? 's' : ''} as ${newStatus}?`)) return;
    setBulkBusy(true);
    try {
      // Bulk mark-paid must push synthetic payments per bill so payment
       // history and cashflow stay consistent — see changeStatus above for
       // the same fix on the single-row path (P1 #18).
      const nowIso = new Date().toISOString();
      const today = nowIso.slice(0, 10);
      const updates = sel.map(b => {
        const patch = { ...b, status: newStatus };
        if (newStatus === 'paid') {
          patch.paidAmount = b.totalAmount || 0;
          const already = (b.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
          const outstanding = Math.max(0, Number(b.totalAmount) - already);
          if (outstanding > 0) {
            patch.payments = [...(b.payments || []), {
              amount: outstanding, date: today, mode: 'other',
              note: 'Marked paid (bulk)', recordedAt: nowIso,
            }];
          }
        }
        return saveBill(patch, { overwrite: true });
      });
      const results = await Promise.allSettled(updates);
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) toast(`${sel.length - failed} updated, ${failed} failed`, 'warning');
      else toast(`Marked ${sel.length} as ${newStatus}`, 'success');
      clearSelection();
      loadBills();
    } catch (err) { toast('Bulk update failed: ' + err.message, 'error'); }
    setBulkBusy(false);
  };

  const bulkDelete = async () => {
    const sel = getSelectedBills();
    if (sel.length === 0) return;
    if (!confirm(`Delete ${sel.length} invoice${sel.length !== 1 ? 's' : ''}? This cannot be undone (the PDF copies in Saved Invoices/ stay).`)) return;
    setBulkBusy(true);
    try {
      const results = await Promise.allSettled(sel.map(b => deleteBill(b.id)));
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) toast(`${sel.length - failed} deleted, ${failed} failed`, 'warning');
      else toast(`Deleted ${sel.length} invoice${sel.length !== 1 ? 's' : ''}`, 'success');
      clearSelection();
      loadBills();
    } catch (err) { toast('Bulk delete failed: ' + err.message, 'error'); }
    setBulkBusy(false);
  };

  const bulkExportJSON = () => {
    const sel = getSelectedBills();
    if (sel.length === 0) return;
    // Lightweight "give me these N bills as a portable file". Different from
    // the full Settings → Export Backup — this is a per-selection share, e.g.
    // for sending a CA only Q1 invoices. Could be re-imported via the
    // existing Import Backup modal (which only restores ticked sections).
    const blob = new Blob([JSON.stringify({
      exportedAt: new Date().toISOString(),
      __freegstbill_backup: true,
      __selection: true,
      bills: sel,
    }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `freegstbill-bills-${sel.length}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Exported ${sel.length} invoice${sel.length !== 1 ? 's' : ''} as JSON`, 'success');
  };

  // Bulk PDF export — feature C from the v1.6.7 audit ("All March invoices
   // as one zip"). Renders each selected bill through the existing
   // InvoicePreview → jsPDF pipeline (see openBillPDF in this file's edit
   // handler) and stitches them into a single multi-page PDF. Zip would be
   // cleaner but pulling in JSZip inflates the bundle by ~140KB; one big
   // PDF is what CAs want anyway (one file to archive).
  const bulkExportPDF = async () => {
    const sel = getSelectedBills();
    if (sel.length === 0) return;
    if (sel.length > 100 && !confirm(`Exporting ${sel.length} invoices as one PDF may take a minute and produce a large file. Continue?`)) return;
    setBulkBusy(true);
    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      // Build each bill in a hidden container, snap it, add as a page.
      // Reuses InvoicePreview via a dynamic import so its CSS + fonts
      // are hydrated once, then reused for each iteration.
      const InvoicePreviewMod = await import('./InvoicePreview');
      const { createRoot } = await import('react-dom/client');
      const { createElement } = await import('react');
      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;left:-99999px;top:0;width:794px;background:#fff;';
      document.body.appendChild(container);
      const root = createRoot(container);
      let ok = 0;
      for (let i = 0; i < sel.length; i++) {
        const bill = sel[i];
        const data = bill.data || {};
        await new Promise((resolve) => {
          root.render(createElement(InvoicePreviewMod.default, {
            profile: data.profile, client: data.client, details: data.details, items: data.items,
            totals: data.totals, invoiceType: data.invoiceType, customTerms: data.customTerms,
            customNotes: data.customNotes, extraSections: data.extraSections, options: data.invoiceOptions,
          }));
          // Give React 2 frames + a tick to flush layout + images
          requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 100)));
        });
        try {
          const canvas = await html2canvas(container.firstElementChild || container, {
            scale: Math.max(2, (window.devicePixelRatio || 1) * 1.5),
            backgroundColor: '#ffffff', useCORS: true, logging: false,
          });
          const img = canvas.toDataURL('image/jpeg', 0.92);
          const w = 210, h = (canvas.height * 210) / canvas.width;
          if (i > 0) doc.addPage();
          doc.addImage(img, 'JPEG', 0, 0, w, Math.min(h, 297), undefined, 'FAST');
          ok++;
        } catch (e) { /* skip broken bill silently — user can retry with narrower selection */ }
      }
      root.unmount();
      document.body.removeChild(container);
      if (ok === 0) { toast('Could not generate any PDFs', 'error'); return; }
      const filename = `freegstbill-invoices-${ok}-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
      toast(`Exported ${ok} of ${sel.length} invoices as one PDF`, 'success');
    } catch (e) {
      toast('Bulk PDF export failed — see console', 'error');
      console.error('bulkExportPDF', e);
    }
    setBulkBusy(false);
  };

  const shareWhatsApp = (bill) => {
    const phone = bill.clientPhone ? bill.clientPhone.replace(/\D/g, '') : '';
    const msg = `*Invoice: ${bill.invoiceNumber}*\nClient: ${bill.clientName}\nAmount: ${formatCurrency(bill.totalAmount)}\nDate: ${new Date(bill.invoiceDate).toLocaleDateString('en-IN')}\nStatus: ${(bill.status || 'unpaid').toUpperCase()}`;
    const encoded = encodeURIComponent(msg);
    const waUrl = phone ? `https://api.whatsapp.com/send?phone=${phone}&text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`;
    window.location.href = waUrl;
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

  const sendReminder = (bill) => {
    const clientPhone = bill.clientPhone || bill.data?.client?.phone || '';
    const phone = clientPhone.replace(/\D/g, '');
    const clientName = bill.clientName || 'Sir/Madam';
    const dueDate = bill.data?.details?.dueDate ? new Date(bill.data.details.dueDate).toLocaleDateString('en-IN') : 'N/A';
    const businessName = profile?.businessName || 'Our Company';
    const amount = formatCurrency(bill.totalAmount - (bill.paidAmount || 0), bill.currency);
    const msg = `Hi ${clientName}, this is a gentle reminder that Invoice ${bill.invoiceNumber} for ${amount} was due on ${dueDate}. Kindly arrange the payment at your earliest convenience. Thank you! - ${businessName}`;
    const encoded = encodeURIComponent(msg);
    const waUrl = phone ? `https://api.whatsapp.com/send?phone=${phone}&text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`;
    window.location.href = waUrl;
  };

  const getClientPhone = (bill) => {
    if (bill.clientPhone) return bill.clientPhone;
    if (bill.data?.client?.phone) return bill.data.client.phone;
    const savedClient = clients.find(c => c.name === bill.clientName);
    return savedClient?.phone || '';
  };

  const overdueBills = bills.filter(b => b.status === 'overdue');
  // Group overdue totals by currency for banner display
  const overdueByCurrency = {};
  for (const b of overdueBills) {
    const cur = b.currency || b.data?.invoiceOptions?.currency || 'INR';
    overdueByCurrency[cur] = (overdueByCurrency[cur] || 0) + (b.totalAmount || 0) - (b.paidAmount || 0);
  }
  const overdueStr = Object.entries(overdueByCurrency).map(([cur, amt]) => formatCurrency(amt, cur)).join(' + ');

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
              — {overdueStr} outstanding
            </span>
          </div>
          <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', whiteSpace: 'nowrap' }}
            onClick={(e) => { e.stopPropagation(); setShowRemindAll(true); }}>
            <Send size={13} /> Remind All
          </button>
          <span style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 500 }}>View all &rarr;</span>
        </div>
      )}

      {/* Remind All Modal */}
      {showRemindAll && (
        <div className="modal-overlay" onClick={() => setShowRemindAll(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <h3 className="section-title">Send Payment Reminders</h3>
            <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
              Click on a client below to send a WhatsApp payment reminder.
            </p>
            {overdueBills.length === 0 ? (
              <p className="text-muted">No overdue invoices.</p>
            ) : (
              <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                {overdueBills.map(bill => {
                  const phone = getClientPhone(bill);
                  return (
                    <div key={bill.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <span className="font-medium">{bill.clientName}</span>
                        <span className="text-muted" style={{ marginLeft: 8, fontSize: '0.8rem' }}>{bill.invoiceNumber}</span>
                        <span style={{ marginLeft: 8, fontWeight: 600, color: '#dc2626', fontSize: '0.85rem' }}>
                          {formatCurrency(bill.totalAmount - (bill.paidAmount || 0), bill.currency || bill.data?.invoiceOptions?.currency)}
                        </span>
                        {phone && <span className="text-muted" style={{ marginLeft: 8, fontSize: '0.75rem' }}>{phone}</span>}
                      </div>
                      <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem' }}
                        onClick={() => sendReminder({ ...bill, clientPhone: phone })}>
                        <MessageCircle size={13} /> Remind
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex gap-2 justify-end mt-4">
              <button className="btn btn-secondary" onClick={() => setShowRemindAll(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <div className="stats-grid stats-grid-4">
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue"><IndianRupee size={22} /></div>
          <div style={{ flex: 1 }}>
            <p className="stat-label">Total Invoiced</p>
            {Object.entries(stats.byCurrency).map(([cur, v]) => (
              <div key={cur} className="stat-value" style={{ fontSize: Object.keys(stats.byCurrency).length > 1 ? '1.1rem' : undefined }}>
                {formatCurrency(v.total, cur)}
              </div>
            ))}
            {Object.keys(stats.byCurrency).length === 0 && <h2 className="stat-value">—</h2>}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-green"><TrendingUp size={22} /></div>
          <div style={{ flex: 1 }}>
            <p className="stat-label">Tax Collected</p>
            {Object.entries(stats.byCurrency).map(([cur, v]) => (
              <div key={cur} className="stat-value stat-value-green" style={{ fontSize: Object.keys(stats.byCurrency).length > 1 ? '1.1rem' : undefined }}>
                {formatCurrency(v.tax, cur)}
              </div>
            ))}
            {Object.keys(stats.byCurrency).length === 0 && <h2 className="stat-value stat-value-green">—</h2>}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-amber"><Clock size={22} /></div>
          <div style={{ flex: 1 }}>
            <p className="stat-label">Outstanding</p>
            {Object.entries(stats.byCurrency).map(([cur, v]) => (
              <div key={cur} className="stat-value stat-value-amber" style={{ fontSize: Object.keys(stats.byCurrency).length > 1 ? '1.1rem' : undefined }}>
                {formatCurrency(v.unpaid, cur)}
              </div>
            ))}
            {Object.keys(stats.byCurrency).length === 0 && <h2 className="stat-value stat-value-amber">—</h2>}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-purple"><Receipt size={22} /></div>
          <div><p className="stat-label">Invoices</p><h2 className="stat-value stat-value-purple">{stats.count}</h2></div>
        </div>
      </div>

      {/* Low Stock Alerts */}
      {lowStockProducts.length > 0 && (
        <div className="glass-panel" style={{ marginBottom: '1.25rem', padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Package size={18} style={{ color: '#d97706' }} />
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#d97706' }}>
              Low Stock Alert ({lowStockProducts.length} item{lowStockProducts.length > 1 ? 's' : ''})
            </h3>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {lowStockProducts.map(p => (
              <div key={p.id} style={{
                padding: '0.4rem 0.75rem', borderRadius: 6, fontSize: '0.8rem',
                background: (p.stock ?? 0) <= 0 ? '#fef2f2' : '#fffbeb',
                border: `1px solid ${(p.stock ?? 0) <= 0 ? '#fecaca' : '#fde68a'}`,
                color: (p.stock ?? 0) <= 0 ? '#dc2626' : '#d97706',
              }}>
                <strong>{p.name}</strong>
                {p.hsn ? <span className="text-muted" style={{ marginLeft: 4, fontSize: '0.72rem' }}>({p.hsn})</span> : null}
                <span style={{ marginLeft: 6, fontWeight: 700 }}>
                  {(p.stock ?? 0) <= 0 ? 'Out of Stock' : `Stock: ${p.stock}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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

        {/* Bulk-action toolbar — only renders when at least one row is ticked. */}
        {selectedIds.size > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
            padding: '0.6rem 0.85rem', marginBottom: '0.6rem',
            background: 'var(--info-bg)', border: '1px solid var(--info-border)',
            borderRadius: '8px', color: 'var(--info-text)',
          }}>
            <strong style={{ fontSize: '0.88rem' }}>{selectedIds.size} selected</strong>
            <button type="button" className="btn btn-secondary" disabled={bulkBusy} onClick={() => bulkMarkStatus('paid')}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}><CheckCircle size={13} /> Mark paid</button>
            <button type="button" className="btn btn-secondary" disabled={bulkBusy} onClick={() => bulkMarkStatus('unpaid')}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}><Clock size={13} /> Mark unpaid</button>
            <button type="button" className="btn btn-secondary" disabled={bulkBusy} onClick={() => bulkMarkStatus('overdue')}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}><AlertTriangle size={13} /> Mark overdue</button>
            <button type="button" className="btn btn-secondary" disabled={bulkBusy} onClick={bulkExportJSON}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}><FileText size={13} /> Export JSON</button>
            <button type="button" className="btn btn-secondary" disabled={bulkBusy} onClick={bulkExportPDF}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }} title="Combine selected invoices into one multi-page PDF — CAs love this for filing archives"><Download size={13} /> Bulk PDF</button>
            <button type="button" className="btn btn-secondary" disabled={bulkBusy} onClick={bulkDelete}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
              <Trash2 size={13} /> Delete
            </button>
            <button type="button" className="icon-btn" onClick={clearSelection} title="Clear selection" style={{ marginLeft: 'auto' }}>
              <X size={14} />
            </button>
          </div>
        )}

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
                  <th style={{ width: '32px', padding: '0.5rem 0.25rem 0.5rem 0.75rem' }}>
                    <input type="checkbox"
                      checked={filtered.length > 0 && filtered.every(b => selectedIds.has(b.id))}
                      onChange={toggleSelectAllVisible}
                      title="Select all visible"
                      style={{ width: 15, height: 15, accentColor: 'var(--primary)', cursor: 'pointer' }} />
                  </th>
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
                  const billCurrency = bill.currency || bill.data?.invoiceOptions?.currency || 'INR';
                  return (
                    <tr key={bill.id} className={isOverdue || status === 'overdue' ? 'row-overdue' : ''}
                      style={selectedIds.has(bill.id) ? { background: 'var(--info-bg)' } : undefined}>
                      <td style={{ padding: '0.5rem 0.25rem 0.5rem 0.75rem' }}>
                        <input type="checkbox" checked={selectedIds.has(bill.id)} onChange={() => toggleSelect(bill.id)}
                          style={{ width: 15, height: 15, accentColor: 'var(--primary)', cursor: 'pointer' }} />
                      </td>
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
                      <td className="font-bold">
                        {formatCurrency(bill.totalAmount, billCurrency)}
                        {billCurrency !== 'INR' && <span style={{ marginLeft: 5, fontSize: '0.7rem', fontWeight: 600, color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '1px 5px', borderRadius: 4 }}>{billCurrency}</span>}
                      </td>
                      <td className="text-muted">{(bill.paidAmount || 0) > 0 ? formatCurrency(bill.paidAmount, billCurrency) : '-'}</td>
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
                          {(isOverdue || status === 'overdue') && (
                            <button className="icon-btn icon-btn-green" onClick={() => sendReminder({ ...bill, clientPhone: getClientPhone(bill) })} title="Send Reminder" style={{ color: '#d97706' }}><Send size={15} /></button>
                          )}
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
              Invoice: <strong>{paymentModal.invoiceNumber}</strong> | Total: <strong>{formatCurrency(paymentModal.totalAmount, paymentModal.currency)}</strong>
              {(paymentModal.paidAmount || 0) > 0 && <> | Paid: <strong>{formatCurrency(paymentModal.paidAmount, paymentModal.currency)}</strong></>}
              {' '}| Balance: <strong style={{ color: '#dc2626' }}>{formatCurrency(paymentModal.totalAmount - (paymentModal.paidAmount || 0), paymentModal.currency)}</strong>
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
                      <span className="font-bold">{formatCurrency(p.amount, paymentModal.currency)}</span>
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
