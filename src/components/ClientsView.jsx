import { useState, useEffect, useRef } from 'react';
import { Users, Search, FileText, ChevronDown, ChevronUp, Trash2, X, MessageCircle, Mail, Plus, Edit3, Copy, Upload, Download } from 'lucide-react';
import { getAllClients, getAllBills, deleteClient, saveClient, deleteBill, saveBill, getProfile } from '../store';
import { formatCurrency, INVOICE_TYPES } from '../utils';
import { toast } from './Toast';
import ClientModal from './ClientModal';

const STATUS_COLORS = {
  unpaid: { label: 'Unpaid', color: '#f59e0b', bg: '#fffbeb' },
  partial: { label: 'Partial', color: '#8b5cf6', bg: '#f5f3ff' },
  paid: { label: 'Paid', color: '#059669', bg: '#ecfdf5' },
  overdue: { label: 'Overdue', color: '#dc2626', bg: '#fef2f2' },
};

export default function ClientsView({ onEdit, onDuplicate, onNew }) {
  const [clients, setClients] = useState([]);
  const [bills, setBills] = useState([]);
  const [search, setSearch] = useState('');
  const [expandedClient, setExpandedClient] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [modalClient, setModalClient] = useState(null);
  const [editingClientId, setEditingClientId] = useState(null);
  const [profileCountry, setProfileCountry] = useState('');

  useEffect(() => {
    getProfile().then(p => { if (p?.country) setProfileCountry(p.country); }).catch(() => {});
  }, []);

  const loadData = async () => {
    try {
      const [c, b] = await Promise.all([getAllClients(), getAllBills()]);
      setClients(c);
      setBills(b);
    } catch {
      toast('Failed to load data', 'error');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Client Statement PDF — feature A from v1.6.7 audit ("#1 daily ask when
  // a client disputes a bill"). Produces a single-page account statement:
  // invoice list + credit notes + payments + running balance. Reuses the
  // profile block from InvoicePreview for the seller header so the styling
  // matches the invoice PDFs the client already knows.
  const [profileForStatement, setProfileForStatement] = useState(null);
  useEffect(() => {
    getProfile().then(setProfileForStatement).catch(() => {});
  }, []);

  const generateClientStatement = async (clientName) => {
    const clientBills = getClientBills(clientName);
    if (clientBills.length === 0) {
      toast('No invoices for this client', 'warning');
      return;
    }
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const savedClient = clients.find(c => c.name === clientName) || { name: clientName };
      const stats = getClientStats(clientName);
      const pageW = 210, marginL = 15, marginR = 195, tableW = marginR - marginL; // = 180
      // Helvetica core font can't render Rupee symbol properly — use "Rs." plaintext.
      // Numbers are formatted with Indian digit grouping (2,5,000.00 style).
      const fmt = (n) => {
        const v = Number(n) || 0;
        const abs = Math.abs(v);
        const rounded = abs.toFixed(2);
        const parts = rounded.split('.');
        // Indian grouping: last 3 digits, then groups of 2
        const intPart = parts[0];
        const last3 = intPart.slice(-3);
        const rest = intPart.slice(0, -3);
        const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
        return (v < 0 ? '-' : '') + 'Rs. ' + grouped + '.' + parts[1];
      };

      // ============== HEADER BAND ==============
      doc.setFillColor(30, 64, 175);
      doc.rect(0, 0, pageW, 22, 'F');
      doc.setTextColor(255); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text('CLIENT STATEMENT', pageW / 2, 12, { align: 'center' });
      doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      doc.text(`Generated ${new Date().toLocaleDateString('en-IN')}  ·  Period: All invoices`, pageW / 2, 18, { align: 'center' });
      doc.setTextColor(0);

      let y = 30;

      // ============== FROM / TO BLOCKS (side-by-side, guaranteed non-overlap) ==============
      const colL = marginL, colR = marginL + tableW / 2 + 5;   // 15 and 100
      const colWidth = tableW / 2 - 5;                          // 85 mm each column

      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(100);
      doc.text('FROM', colL, y);
      doc.text('BILL TO', colR, y);
      doc.setTextColor(0);
      y += 4;

      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text(doc.splitTextToSize(profileForStatement?.businessName || '', colWidth), colL, y);
      doc.text(doc.splitTextToSize(savedClient.name || clientName, colWidth), colR, y);
      y += 5;
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');

      const sellerLines = [
        profileForStatement?.address,
        [profileForStatement?.city, profileForStatement?.state, profileForStatement?.pin].filter(Boolean).join(', '),
        profileForStatement?.gstin ? `GSTIN: ${profileForStatement.gstin}` : null,
        profileForStatement?.email,
        profileForStatement?.phone ? `Ph: ${profileForStatement.phone}` : null,
      ].filter(Boolean);
      const clientLines = [
        savedClient.address,
        [savedClient.city, savedClient.state, savedClient.pin].filter(Boolean).join(', '),
        savedClient.gstin ? `GSTIN: ${savedClient.gstin}` : null,
        savedClient.email,
        savedClient.phone ? `Ph: ${savedClient.phone}` : null,
      ].filter(Boolean);

      const sellerHeight = sellerLines.length * 4;
      const clientHeight = clientLines.length * 4;
      let dy = 0;
      sellerLines.forEach(line => {
        doc.text(doc.splitTextToSize(line, colWidth), colL, y + dy);
        dy += 4;
      });
      dy = 0;
      clientLines.forEach(line => {
        doc.text(doc.splitTextToSize(line, colWidth), colR, y + dy);
        dy += 4;
      });
      y += Math.max(sellerHeight, clientHeight) + 5;

      // ============== SUMMARY STRIP ==============
      doc.setFillColor(241, 245, 249);
      doc.rect(marginL, y, tableW, 16, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(marginL, y, tableW, 16, 'S');

      const cellW = tableW / 4;
      const summaryCells = [
        { label: 'Invoices', value: String(stats.count) },
        { label: 'Total Billed', value: fmt(stats.total) },
        { label: 'Paid', value: fmt(stats.paid), color: [5, 150, 105] },
        { label: 'Outstanding', value: fmt(stats.unpaid), color: stats.unpaid > 0 ? [220, 38, 38] : [5, 150, 105] },
      ];
      summaryCells.forEach((cell, i) => {
        const cx = marginL + i * cellW + cellW / 2;
        doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
        doc.text(cell.label.toUpperCase(), cx, y + 5, { align: 'center' });
        doc.setFontSize(cell.label === 'Invoices' ? 12 : 10); doc.setFont('helvetica', 'bold');
        if (cell.color) doc.setTextColor(...cell.color); else doc.setTextColor(15, 23, 42);
        doc.text(cell.value, cx, y + 12, { align: 'center' });
      });
      doc.setTextColor(0);
      y += 22;

      // ============== LEDGER TABLE (Indian Dr/Cr convention) ==============
      // Columns follow standard Indian business-statement format:
      //   Date | Particulars (invoice # + type) | Debit | Credit | Balance
      // Debit  = amount charged to the client (increases receivable)
      // Credit = payment received / credit note (decreases receivable)
      // Balance = running Dr - Cr
      const col = {
        dateEnd: 42,        // Date column: 15 to 42 (27mm)
        particEnd: 105,     // Particulars: 42 to 105 (63mm)
        debitEnd: 140,      // Debit right-aligned at 140
        creditEnd: 168,     // Credit right-aligned at 168
        balanceEnd: marginR - 2, // Balance right-aligned at 193
      };

      // Header band
      doc.setFillColor(30, 64, 175);
      doc.rect(marginL, y, tableW, 9, 'F');
      doc.setTextColor(255); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text('Date', marginL + 2, y + 6);
      doc.text('Particulars', col.dateEnd + 2, y + 6);
      doc.text('Debit', col.debitEnd, y + 6, { align: 'right' });
      doc.text('Credit', col.creditEnd, y + 6, { align: 'right' });
      doc.text('Balance', col.balanceEnd, y + 6, { align: 'right' });
      doc.setTextColor(0);
      y += 11;

      // Opening balance row
      doc.setFontSize(8.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(80);
      doc.text('Opening Balance', col.dateEnd + 2, y);
      doc.text(fmt(0), col.balanceEnd, y, { align: 'right' });
      doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'normal');
      y += 6;

      // Rows
      let runningBalance = 0;
      const sortedBills = clientBills.slice().sort((a, b) => new Date(a.invoiceDate) - new Date(b.invoiceDate));

      const drawHeader = () => {
        doc.setFillColor(30, 64, 175);
        doc.rect(marginL, y, tableW, 9, 'F');
        doc.setTextColor(255); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
        doc.text('Date', marginL + 2, y + 6);
        doc.text('Particulars', col.dateEnd + 2, y + 6);
        doc.text('Debit', col.debitEnd, y + 6, { align: 'right' });
        doc.text('Credit', col.creditEnd, y + 6, { align: 'right' });
        doc.text('Balance', col.balanceEnd, y + 6, { align: 'right' });
        doc.setTextColor(0);
        y += 11;
      };

      for (let i = 0; i < sortedBills.length; i++) {
        const bill = sortedBills[i];
        const isCreditNote = bill.invoiceType === 'credit-note';
        const amount = Number(bill.totalAmount) || 0;
        const paid = Number(bill.paidAmount) || 0;
        // Compute Dr / Cr for this row
        //   Tax invoice: Dr = amount, Cr = 0
        //   Credit note: Dr = 0, Cr = amount
        //   Then if paid amount > 0 we add ANOTHER row for the payment as Cr
        const debit = isCreditNote ? 0 : amount;
        const credit = isCreditNote ? amount : 0;

        // Page break with header repeat
        if (y > 260) { doc.addPage(); y = 20; drawHeader(); }

        // Alt row shading
        if (i % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(marginL, y - 4, tableW, 6, 'F');
        }

        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(15, 23, 42);
        // Date
        doc.text(new Date(bill.invoiceDate).toLocaleDateString('en-IN'), marginL + 2, y);
        // Particulars: invoice # + type label
        const typeLabel = INVOICE_TYPES[bill.invoiceType]?.label || bill.invoiceType || '';
        const particulars = `${bill.invoiceNumber || ''} · ${typeLabel}`;
        const particText = doc.splitTextToSize(particulars, col.particEnd - col.dateEnd - 4);
        doc.text(particText[0] || '', col.dateEnd + 2, y);
        // Debit
        doc.text(debit > 0 ? fmt(debit) : '-', col.debitEnd, y, { align: 'right' });
        // Credit
        doc.text(credit > 0 ? fmt(credit) : '-', col.creditEnd, y, { align: 'right' });
        // Balance
        runningBalance += debit - credit;
        if (runningBalance > 0.01) { doc.setFont('helvetica', 'bold'); doc.setTextColor(220, 38, 38); }
        else { doc.setTextColor(5, 150, 105); }
        doc.text(fmt(runningBalance) + ' Dr', col.balanceEnd, y, { align: 'right' });
        doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'normal');
        y += 6;

        // Add a follow-on row for the payment if any
        if (paid > 0.01 && !isCreditNote) {
          if (y > 265) { doc.addPage(); y = 20; drawHeader(); }
          doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(80);
          doc.text('   Payment recd against above', col.dateEnd + 2, y);
          doc.text(fmt(paid), col.creditEnd, y, { align: 'right' });
          runningBalance -= paid;
          if (runningBalance > 0.01) { doc.setFont('helvetica', 'bold'); doc.setTextColor(220, 38, 38); }
          else { doc.setFont('helvetica', 'normal'); doc.setTextColor(5, 150, 105); }
          doc.text(fmt(runningBalance) + ' Dr', col.balanceEnd, y, { align: 'right' });
          doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'normal');
          y += 6;
        }
      }

      // ============== CLOSING BALANCE ==============
      // v1.10.14 — the v1.10.11 fix (label at col.debitEnd=140mm) still overlapped
      // for medium/large balances: "CLOSING BALANCE" at 11pt bold is ~33mm wide so
      // its right edge lands at ~173mm, but "Rs. X,XXX.XX Dr" at 12pt right-aligned
      // at balanceEnd (~193mm) has its left edge as far left as ~165mm for 4-digit
      // amounts. Real fix: park the label at marginL (~17mm) — 3x more breathing
      // room and it reads better as a bottom-of-page summary line anyway.
      y += 3;
      doc.setDrawColor(30, 64, 175); doc.setLineWidth(0.6);
      doc.line(marginL, y, marginR, y); y += 8;
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42);
      doc.text('CLOSING BALANCE', marginL, y);
      doc.setFontSize(12);
      if (runningBalance > 0.01) doc.setTextColor(220, 38, 38); else doc.setTextColor(5, 150, 105);
      const balanceLabel = fmt(Math.abs(runningBalance)) + (runningBalance > 0.01 ? ' Dr' : (runningBalance < -0.01 ? ' Cr' : ' Nil'));
      doc.text(balanceLabel, col.balanceEnd, y, { align: 'right' });
      doc.setTextColor(0);
      y += 10;
      doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(100);
      doc.text('Dr = amount receivable from client  ·  Cr = amount owed to client', marginL, y);

      // ============== SIGNATURE + FOOTER ==============
      // Signature block (right-aligned)
      y = Math.max(y + 15, 260);
      doc.setDrawColor(150); doc.line(marginR - 55, y, marginR - 2, y);
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(80);
      doc.text('Authorised Signatory', marginR - 28, y + 4, { align: 'center' });
      doc.text(profileForStatement?.businessName || '', marginR - 28, y + 8, { align: 'center' });

      doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(120);
      doc.text('Please review and confirm within 7 days. This is a computer-generated statement — no signature required.', pageW / 2, 285, { align: 'center' });
      doc.text('Generated by Free GST Billing Software', pageW / 2, 290, { align: 'center' });

      doc.save(`statement-${clientName.replace(/[^\w]+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`);
      toast('Statement PDF generated', 'success');
    } catch (e) {
      toast('Could not generate statement PDF', 'error');
      console.error('generateClientStatement', e);
    }
  };

  // Group bills by client name
  const getClientBills = (clientName) => {
    return bills.filter(b => (b.clientName || '').toLowerCase() === clientName.toLowerCase())
      .sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate));
  };

  const getClientStats = (clientName) => {
    const cBills = getClientBills(clientName);
    const total = cBills.reduce((s, b) => s + (b.totalAmount || 0), 0);
    const paid = cBills.reduce((s, b) => {
      if (b.status === 'paid') return s + (b.totalAmount || 0);
      if (b.status === 'partial') return s + (b.paidAmount || 0);
      return s;
    }, 0);
    const unpaid = total - paid;
    return { total, paid, unpaid, count: cBills.length };
  };

  // Get all unique client names from bills (includes unsaved clients)
  const allClientNames = [...new Set([
    ...clients.map(c => c.name),
    ...bills.map(b => b.clientName).filter(Boolean)
  ])];

  const filteredClients = search.trim()
    ? allClientNames.filter(name => name.toLowerCase().includes(search.toLowerCase()))
    : allClientNames;

  // Sort by outstanding amount
  const sortedClients = [...filteredClients].sort((a, b) => {
    const sa = getClientStats(a);
    const sb = getClientStats(b);
    return sb.unpaid - sa.unpaid;
  });

  const handleDeleteClient = async (id) => {
    if (confirm('Remove this saved client?')) {
      await deleteClient(id);
      toast('Client removed', 'success');
      loadData();
    }
  };

  const handleDeleteBill = async (id) => {
    if (confirm('Delete this invoice? This cannot be undone.')) {
      try { await deleteBill(id); toast('Invoice deleted', 'success'); loadData(); }
      catch { toast('Failed to delete', 'error'); }
    }
  };

  const changeStatus = async (bill, newStatus) => {
    const updated = { ...bill, status: newStatus };
    if (newStatus === 'paid') updated.paidAmount = bill.totalAmount;
    await saveBill(updated, { overwrite: true });
    toast(`Marked as ${STATUS_COLORS[newStatus]?.label || newStatus}`, 'info');
    loadData();
  };

  const openAddClient = (prefill) => {
    setModalClient(prefill || null);
    setEditingClientId(null);
    setShowForm(true);
  };

  const openEditClient = (client) => {
    setModalClient(client);
    setEditingClientId(client.id);
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setModalClient(null); setEditingClientId(null); };

  const csvInputRef = useRef(null);

  const handleCSVImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { toast('CSV file is empty or has no data rows', 'warning'); return; }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
      let imported = 0;
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === 0) continue;
        const row = {};
        headers.forEach((h, idx) => { row[h] = (values[idx] || '').trim(); });
        const name = row.name || row.client || row['client name'] || '';
        if (!name) continue;
        await saveClient({
          name,
          address: row.address || '',
          state: row.state || '',
          gstin: row.gstin || '',
          email: row.email || '',
          phone: row.phone || '',
        });
        imported++;
      }
      toast(`Imported ${imported} client${imported !== 1 ? 's' : ''}`, 'success');
      loadData();
    } catch {
      toast('Failed to parse CSV file', 'error');
    }
    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
      else { current += ch; }
    }
    result.push(current);
    return result;
  };

  const handleModalSave = async (formData) => {
    if (!formData.name.trim()) { toast('Client name is required', 'warning'); return; }
    try {
      const data = { ...formData };
      if (editingClientId) data.id = editingClientId;
      await saveClient(data);
      toast(editingClientId ? 'Client updated' : 'Client added', 'success');
      closeForm();
      loadData();
    } catch {
      toast('Failed to save client', 'error');
    }
  };

  const shareWhatsApp = (bill) => {
    const phone = bill.clientPhone ? bill.clientPhone.replace(/\D/g, '') : '';
    const msg = `*Invoice ${bill.invoiceNumber}*\nAmount: ${formatCurrency(bill.totalAmount)}\nDate: ${new Date(bill.invoiceDate).toLocaleDateString('en-IN')}\nStatus: ${(bill.status || 'unpaid').toUpperCase()}`;
    const encoded = encodeURIComponent(msg);

    const waUrl = phone ? `https://api.whatsapp.com/send?phone=${phone}&text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`;
    // v1.10.12 — open in a new tab so the user doesn't lose their
    // current invoice / modal / draft. Reported: "push reminder and
    // whatsapp in new tab not the tab or windows we are working on".
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const shareEmail = (bill) => {
    const subject = `Invoice ${bill.invoiceNumber}`;
    const body = `Dear ${bill.clientName},\n\nPlease find the details of your invoice:\n\nInvoice No: ${bill.invoiceNumber}\nAmount: ${formatCurrency(bill.totalAmount)}\nDate: ${new Date(bill.invoiceDate).toLocaleDateString('en-IN')}\nDue: ${bill.status === 'paid' ? 'Paid' : 'Pending'}\n\nRegards`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  };

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">Client-wise invoice ledger and outstanding</p>
        </div>
        <div className="flex gap-2">
          <input type="file" accept=".csv" ref={csvInputRef} style={{ display: 'none' }} onChange={handleCSVImport} />
          <button className="btn btn-secondary" onClick={() => csvInputRef.current?.click()}>
            <Upload size={16} /> Import CSV
          </button>
          <button className="btn btn-secondary" onClick={openAddClient}>
            <Plus size={18} /> Add Client
          </button>
          <button className="btn btn-primary" onClick={onNew}>
            <FileText size={18} /> New Invoice
          </button>
        </div>
      </div>

      {/* Add/Edit Client Modal */}
      <ClientModal show={showForm} onClose={closeForm} onSave={handleModalSave} client={modalClient} isEditing={!!editingClientId} defaultCountry={profileCountry} />

      {/* Search */}
      <div className="glass-panel p-4 mb-6">
        <div className="search-box" style={{ maxWidth: '400px' }}>
          <Search size={16} className="search-icon" />
          <input type="text" placeholder="Search clients..." value={search}
            onChange={e => setSearch(e.target.value)} className="search-input" />
          {search && <button className="icon-btn" onClick={() => setSearch('')}><X size={14} /></button>}
        </div>
      </div>

      {/* Client cards */}
      {sortedClients.length === 0 ? (
        <div className="glass-panel p-6">
          <div className="empty-state">
            <Users size={48} />
            <p>No clients found.</p>
            <button className="btn btn-secondary" onClick={openAddClient} style={{ marginTop: '0.5rem' }}>
              <Plus size={16} /> Add Your First Client
            </button>
          </div>
        </div>
      ) : (
        <div className="client-list">
          {sortedClients.map(clientName => {
            const stats = getClientStats(clientName);
            const savedClient = clients.find(c => c.name === clientName);
            const isExpanded = expandedClient === clientName;
            const clientBills = isExpanded ? getClientBills(clientName) : [];

            return (
              <div key={clientName} className="glass-panel mb-4" style={{ overflow: 'hidden' }}>
                {/* Client header */}
                <div className="client-card-header" onClick={() => setExpandedClient(isExpanded ? null : clientName)}>
                  <div className="client-card-info">
                    <div className="client-avatar">
                      {clientName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="client-card-name">{clientName}</h3>
                      <p className="client-card-meta">
                        {stats.count} invoice{stats.count !== 1 ? 's' : ''}
                        {savedClient?.state ? ` | ${savedClient.state}` : ''}
                        {savedClient?.gstin ? ` | ${savedClient.gstin}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="client-card-stats">
                    <div className="client-stat">
                      <span className="client-stat-label">Total</span>
                      <span className="client-stat-value">{formatCurrency(stats.total)}</span>
                    </div>
                    <div className="client-stat">
                      <span className="client-stat-label">Paid</span>
                      <span className="client-stat-value" style={{ color: '#059669' }}>{formatCurrency(stats.paid)}</span>
                    </div>
                    <div className="client-stat">
                      <span className="client-stat-label">Outstanding</span>
                      <span className="client-stat-value" style={{ color: stats.unpaid > 0 ? '#dc2626' : '#059669' }}>
                        {formatCurrency(stats.unpaid)}
                      </span>
                    </div>
                    <div style={{ marginLeft: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {isExpanded ? 'Hide' : 'View'} {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </div>

                {/* Expanded: invoice list */}
                {isExpanded && (
                  <div className="client-invoices">
                    {/* Action bar (right-aligned) — Statement PDF for CAs / clients */}
                    <div style={{ padding: '0.5rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                        onClick={() => generateClientStatement(clientName)}
                        title="Account statement: every invoice, credit note, payment, and running balance in one PDF">
                        <Download size={14} /> Statement PDF
                      </button>
                    </div>

                    {/* Client details */}
                    {savedClient && (savedClient.address || savedClient.city || savedClient.email || savedClient.phone) && (
                      <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {(savedClient.address || savedClient.city || savedClient.pin) && (
                          <span>{[savedClient.address, savedClient.city, savedClient.pin].filter(Boolean).join(', ')}</span>
                        )}
                        {savedClient.email && <span>{savedClient.email}</span>}
                        {savedClient.phone && <span>{savedClient.phone}</span>}
                      </div>
                    )}
                    {clientBills.length === 0 ? (
                      <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                        <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>No invoices for this client yet.</p>
                        <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }} onClick={onNew}>
                          <Plus size={15} /> Create Invoice
                        </button>
                      </div>
                    ) : (
                      <div className="table-scroll">
                        <table className="data-table" style={{ marginBottom: 0, minWidth: '750px' }}>
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Invoice No.</th>
                              <th>Type</th>
                              <th style={{ textAlign: 'right' }}>Amount</th>
                              <th>Status</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clientBills.map(bill => {
                              const status = bill.status || 'unpaid';
                              const sc = STATUS_COLORS[status] || STATUS_COLORS.unpaid;
                              const isOverdue = status !== 'paid' && bill.data?.details?.dueDate && new Date(bill.data.details.dueDate) < new Date();
                              return (
                                <tr key={bill.id} style={isOverdue ? { background: '#fef2f2' } : {}}>
                                  <td className="text-muted">{new Date(bill.invoiceDate).toLocaleDateString('en-IN')}</td>
                                  <td><span className="invoice-badge">{bill.invoiceNumber}</span></td>
                                  <td><span className="type-badge">{(INVOICE_TYPES[bill.invoiceType || 'tax-invoice'])?.label}</span></td>
                                  <td className="font-bold" style={{ textAlign: 'right' }}>{formatCurrency(bill.totalAmount)}</td>
                                  <td>
                                    <select className="status-select" value={isOverdue && status !== 'overdue' ? 'overdue' : status}
                                      style={{ background: sc.bg, color: sc.color, borderColor: sc.color + '44', fontSize: '0.75rem', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid', cursor: 'pointer', fontWeight: 600 }}
                                      onClick={e => e.stopPropagation()}
                                      onChange={e => changeStatus(bill, e.target.value)}>
                                      {Object.entries(STATUS_COLORS).map(([key, val]) => (
                                        <option key={key} value={key}>{val.label}</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td>
                                    <div className="table-actions">
                                      {bill.data && (
                                        <button className="icon-btn icon-btn-blue" onClick={() => onEdit(bill)} title="Edit Invoice">
                                          <Edit3 size={14} />
                                        </button>
                                      )}
                                      <button className="icon-btn icon-btn-blue" onClick={() => onDuplicate(bill)} title="Duplicate Invoice">
                                        <Copy size={14} />
                                      </button>
                                      <button className="icon-btn icon-btn-green" onClick={() => shareWhatsApp(bill)} title="WhatsApp">
                                        <MessageCircle size={14} />
                                      </button>
                                      <button className="icon-btn icon-btn-blue" onClick={() => shareEmail(bill)} title="Email">
                                        <Mail size={14} />
                                      </button>
                                      <button className="icon-btn icon-btn-red" onClick={() => handleDeleteBill(bill.id)} title="Delete Invoice">
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="client-actions-bar" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '0.75rem 1.5rem', borderTop: '1px solid var(--border)' }}>
                      {savedClient ? (
                        <>
                          <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }} onClick={() => openEditClient(savedClient)}>
                            <Edit3 size={13} /> Edit Client
                          </button>
                          <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', color: '#dc2626', borderColor: '#fecaca' }} onClick={() => handleDeleteClient(savedClient.id)}>
                            <Trash2 size={13} /> Delete Client
                          </button>
                        </>
                      ) : (
                        <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }} onClick={() => openAddClient({ name: clientName })}>
                          <Plus size={13} /> Save as Client
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
