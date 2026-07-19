import { useState, useEffect, useRef } from 'react';
import { Users, Search, FileText, ChevronDown, ChevronUp, Trash2, X, MessageCircle, Mail, Plus, Edit3, Copy, Upload, Download } from 'lucide-react';
import HelpButton from './HelpButton';
import { getAllClients, getAllBills, deleteClient, saveClient, deleteBill, saveBill, getProfile } from '../store';
import { formatCurrency, INVOICE_TYPES } from '../utils';
import { getPrintSettings } from '../utils/printSettings';
import { openWhatsAppShare } from '../utils/share';
import { confirmAction } from './ConfirmModal';
import { toast } from './Toast';

// v1.10.31 — UI-C3: Shared helper to resolve the user's accent color as an
// RGB tuple usable with jsPDF setFillColor / setDrawColor. Falls back to the
// legacy blue (#1e40af = rgb(30, 64, 175)) when the user hasn't customised.
function getAccentRGB() {
  try {
    const ps = getPrintSettings();
    if (ps.userColorsEnabled && ps.pdfAccent) {
      const hex = String(ps.pdfAccent).replace('#', '');
      if (/^[0-9a-f]{6}$/i.test(hex)) {
        return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
      }
    }
  } catch { /* ignore — fall through to default */ }
  return [30, 64, 175];
}
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
      doc.setFillColor(...getAccentRGB());
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

      // v1.10.31 — UI-C1 fix: `splitTextToSize` returns an ARRAY of
      // wrapped sub-lines; jsPDF draws each at line-height 4mm but the
      // outer loop only advanced `dy += 4`, so a 2-line-wrapped address
      // collided with the next logical line ("Birnagar / Bhagar" bleed
      // reported in Client Statement). Now dy advances by the actual
      // rendered line count.
      let sellerDy = 0;
      sellerLines.forEach(line => {
        const wrapped = doc.splitTextToSize(line, colWidth);
        doc.text(wrapped, colL, y + sellerDy);
        sellerDy += wrapped.length * 4;
      });
      let clientDy = 0;
      clientLines.forEach(line => {
        const wrapped = doc.splitTextToSize(line, colWidth);
        doc.text(wrapped, colR, y + clientDy);
        clientDy += wrapped.length * 4;
      });
      y += Math.max(sellerDy, clientDy) + 5;

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
      //
      // v1.10.35 — Column widths widened after a report showed "Dr"
      // suffix crowding the balance number. Prior debitEnd=140 /
      // creditEnd=168 / balanceEnd=193 left only 4mm between Credit
      // and Balance text — tight when both were 5-digit rupee amounts.
      // Now the Particulars column is trimmed by 5mm and that space is
      // distributed into Debit/Credit/Balance so each has proper breathing
      // room and long "Dr/Cr" suffixes never clip the page margin.
      const col = {
        dateEnd: 40,        // Date column: 15 to 40 (25mm — dd/mm/yyyy fits at 8.5pt)
        particEnd: 100,     // Particulars: 40 to 100 (60mm)
        debitEnd: 133,      // Debit right-aligned at 133
        creditEnd: 163,     // Credit right-aligned at 163
        balanceEnd: marginR - 2, // Balance right-aligned at 193
      };

      // Header band
      doc.setFillColor(...getAccentRGB());
      doc.rect(marginL, y, tableW, 9, 'F');
      doc.setTextColor(255); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text('Date', marginL + 2, y + 6);
      doc.text('Particulars', col.dateEnd + 2, y + 6);
      doc.text('Debit', col.debitEnd, y + 6, { align: 'right' });
      doc.text('Credit', col.creditEnd, y + 6, { align: 'right' });
      doc.text('Balance', col.balanceEnd, y + 6, { align: 'right' });
      doc.setTextColor(0);
      y += 11;

      // Opening balance row — italic + muted, above the first real row.
      doc.setFontSize(8.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(80);
      doc.text('Opening Balance', col.dateEnd + 2, y);
      doc.text(fmt(0), col.balanceEnd, y, { align: 'right' });
      // v1.10.35 — thin separator so the opening line reads as a
      // distinct baseline, not as a squished header extension.
      doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.15);
      doc.line(marginL, y + 2, marginR, y + 2);
      doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'normal');
      y += 7;

      // Rows
      let runningBalance = 0;
      const sortedBills = clientBills.slice().sort((a, b) => new Date(a.invoiceDate) - new Date(b.invoiceDate));

      const drawHeader = () => {
        doc.setFillColor(...getAccentRGB());
        doc.rect(marginL, y, tableW, 9, 'F');
        doc.setTextColor(255); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
        doc.text('Date', marginL + 2, y + 6);
        doc.text('Particulars', col.dateEnd + 2, y + 6);
        doc.text('Debit', col.debitEnd, y + 6, { align: 'right' });
        doc.text('Credit', col.creditEnd, y + 6, { align: 'right' });
        doc.text('Balance', col.balanceEnd, y + 6, { align: 'right' });
        doc.setTextColor(0);
        y += 12;   // v1.10.35 — was 11; 1mm extra so text doesn't kiss the header rectangle bottom
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

        // v1.10.35 — Row rendering rewrite for the reported "shows data
        // in incorrect way" screenshot:
        //   - Row height increased 6mm → 7mm so descenders don't kiss
        //     the next row and the alt-shade rectangle covers the whole
        //     row cleanly.
        //   - Alt shading Y offset fixed (was y-4, showed above the row
        //     text baseline on some renders).
        //   - Empty debit/credit cells render as a light em-dash "—"
        //     instead of a hard hyphen "-", matching the app's cell-empty
        //     convention and reducing visual noise.
        //   - The " Dr" / " Cr" suffix now uses the actual sign — was
        //     always " Dr" even for credit-side balances.
        const rowH = 7;
        if (i % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(marginL, y - rowH + 2, tableW, rowH, 'F');
        }

        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(15, 23, 42);
        // Date
        doc.text(new Date(bill.invoiceDate).toLocaleDateString('en-IN'), marginL + 2, y);
        // Particulars: invoice # + type label
        const typeLabel = INVOICE_TYPES[bill.invoiceType]?.label || bill.invoiceType || '';
        const particulars = `${bill.invoiceNumber || ''} · ${typeLabel}`;
        const particText = doc.splitTextToSize(particulars, col.particEnd - col.dateEnd - 4);
        doc.text(particText[0] || '', col.dateEnd + 2, y);
        // Debit — em-dash placeholder for empty cells.
        if (debit > 0) {
          doc.text(fmt(debit), col.debitEnd, y, { align: 'right' });
        } else {
          doc.setTextColor(180); doc.text('—', col.debitEnd, y, { align: 'right' }); doc.setTextColor(15, 23, 42);
        }
        // Credit
        if (credit > 0) {
          doc.text(fmt(credit), col.creditEnd, y, { align: 'right' });
        } else {
          doc.setTextColor(180); doc.text('—', col.creditEnd, y, { align: 'right' }); doc.setTextColor(15, 23, 42);
        }
        // Balance — sign determines Dr / Cr suffix. Red for owing (Dr),
        // green for surplus (Cr), black for balanced.
        runningBalance += debit - credit;
        const isDr = runningBalance > 0.01;
        const isCr = runningBalance < -0.01;
        if (isDr) { doc.setFont('helvetica', 'bold'); doc.setTextColor(220, 38, 38); }
        else if (isCr) { doc.setTextColor(5, 150, 105); }
        else { doc.setTextColor(15, 23, 42); }
        const suffix = isDr ? ' Dr' : isCr ? ' Cr' : '';
        doc.text(fmt(Math.abs(runningBalance)) + suffix, col.balanceEnd, y, { align: 'right' });
        doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'normal');
        y += rowH;

        // Add a follow-on row for the payment if any
        if (paid > 0.01 && !isCreditNote) {
          if (y > 265) { doc.addPage(); y = 20; drawHeader(); }
          doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(80);
          doc.text('   Payment recd against above', col.dateEnd + 2, y);
          doc.text(fmt(paid), col.creditEnd, y, { align: 'right' });
          runningBalance -= paid;
          const isDr2 = runningBalance > 0.01;
          const isCr2 = runningBalance < -0.01;
          if (isDr2) { doc.setFont('helvetica', 'bold'); doc.setTextColor(220, 38, 38); }
          else if (isCr2) { doc.setFont('helvetica', 'normal'); doc.setTextColor(5, 150, 105); }
          else { doc.setFont('helvetica', 'normal'); doc.setTextColor(15, 23, 42); }
          const suffix2 = isDr2 ? ' Dr' : isCr2 ? ' Cr' : '';
          doc.text(fmt(Math.abs(runningBalance)) + suffix2, col.balanceEnd, y, { align: 'right' });
          doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'normal');
          y += rowH;
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
      doc.setDrawColor(...getAccentRGB()); doc.setLineWidth(0.6);
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
    // v1.10.23 — reported: "OUTSTANDING SHOULD ABE DISPLAYED HERE IN
    // CLIENT LDGER TOO" — overpayments were hidden because `paid` used
    // `totalAmount` when status='paid', clamping actual receipt to the
    // invoice value. If a customer paid ₹650 on a ₹649 invoice, `paid`
    // came back 649 and `unpaid` came back 0. Now we always read the
    // ACTUAL paid amount from the payments array (falling back to
    // paidAmount, then totalAmount for legacy status-only "paid" bills
    // that were never given an explicit paidAmount).
    const paid = cBills.reduce((s, b) => {
      const fromPayments = (b.payments || []).reduce((ps, p) => ps + (Number(p.amount) || 0), 0);
      if (fromPayments > 0) return s + fromPayments;
      if (typeof b.paidAmount === 'number' && b.paidAmount > 0) return s + b.paidAmount;
      if (b.status === 'paid') return s + (b.totalAmount || 0);
      return s;
    }, 0);
    const unpaid = total - paid; // can be negative → overpayment
    return { total, paid, unpaid, count: cBills.length };
  };

  // v1.10.22 — Aging analysis: bucket unpaid amounts by how long they've
  // been outstanding. Age = today − dueDate (falls back to invoiceDate
  // when a bill has no explicit due date, since most CA-billed invoices
  // don't set one but are treated as due-on-issue).
  //
  // Buckets: current (0-30 days), 31-60, 61-90, 90+. Reported: "client
  // aging / Statement of Account". Matches Vyapar / Zoho / Tally output.
  const bucketAge = (days) => {
    if (days <= 30) return 'current';
    if (days <= 60) return 'd31_60';
    if (days <= 90) return 'd61_90';
    return 'd90plus';
  };
  const getClientAging = (clientName) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const buckets = { current: 0, d31_60: 0, d61_90: 0, d90plus: 0, total: 0 };
    const unpaidBills = [];
    for (const b of getClientBills(clientName)) {
      const outstanding = (b.totalAmount || 0) - (b.paidAmount || 0);
      if (outstanding <= 0.01) continue;
      const ref = b.data?.details?.dueDate || b.invoiceDate;
      const dueDate = ref ? new Date(ref) : today;
      const ageDays = Math.max(0, Math.floor((today - dueDate) / 86400000));
      const bucket = bucketAge(ageDays);
      buckets[bucket] += outstanding;
      buckets.total += outstanding;
      unpaidBills.push({ bill: b, ageDays, outstanding });
    }
    return { buckets, unpaidBills };
  };

  // v1.10.22 — Aging Report PDF: single-page overdue-bucket breakdown
  // (0-30, 31-60, 61-90, 90+ days) plus a per-invoice list showing
  // outstanding + age. Distinct from generateClientStatement above,
  // which is a full ledger with running balance — this is the "how
  // overdue are they?" view accountants ask for during collection calls.
  const generateAgingReport = async (clientName) => {
    try {
      const { jsPDF } = await import('jspdf');
      const { unpaidBills, buckets } = getClientAging(clientName);
      if (unpaidBills.length === 0) {
        toast(`${clientName} has no outstanding balance.`, 'info');
        return;
      }
      const profile = profileForStatement || {};
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const marginL = 15, marginR = 195;
      let y = 20;

      // Header
      doc.setFontSize(18); doc.setFont('helvetica', 'bold');
      doc.text('AGING REPORT', marginL, y); y += 8;
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
      doc.text(profile?.businessName || 'Your Business', marginL, y); y += 5;
      if (profile?.address) { doc.text(profile.address, marginL, y); y += 5; }
      if (profile?.gstin)   { doc.text(`GSTIN: ${profile.gstin}`, marginL, y); y += 5; }
      doc.setTextColor(0);
      doc.text(`As of: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, marginR, 20, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(`Client: ${clientName}`, marginR, 26, { align: 'right' });
      doc.setFont('helvetica', 'normal');

      y += 4;
      doc.setDrawColor(...getAccentRGB()); doc.setLineWidth(0.5);
      doc.line(marginL, y, marginR, y); y += 8;

      // Column headers
      doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text('Invoice #',   marginL,         y);
      doc.text('Date',        marginL + 40,    y);
      doc.text('Due',         marginL + 65,    y);
      doc.text('Age',         marginL + 90,    y);
      doc.text('Total',       marginL + 115,   y, { align: 'right' });
      doc.text('Outstanding', marginR,         y, { align: 'right' });
      y += 6;
      doc.setLineWidth(0.2);
      doc.line(marginL, y - 2, marginR, y - 2);

      // Rows
      doc.setFont('helvetica', 'normal');
      const fmt = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      for (const { bill, ageDays, outstanding } of unpaidBills) {
        if (y > 265) { doc.addPage(); y = 20; }
        const due = bill.data?.details?.dueDate ? new Date(bill.data.details.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—';
        const dt = bill.invoiceDate ? new Date(bill.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—';
        doc.text(String(bill.invoiceNumber || '—').slice(0, 24), marginL, y);
        doc.text(dt, marginL + 40, y);
        doc.text(due, marginL + 65, y);
        doc.text(`${ageDays}d`, marginL + 90, y);
        doc.text(fmt(bill.totalAmount), marginL + 115, y, { align: 'right' });
        doc.setTextColor(ageDays > 60 ? 220 : 0, ageDays > 60 ? 38 : 0, ageDays > 60 ? 38 : 0);
        doc.text(fmt(outstanding), marginR, y, { align: 'right' });
        doc.setTextColor(0);
        y += 6;
      }

      // Aging summary
      y += 6;
      doc.setDrawColor(...getAccentRGB()); doc.setLineWidth(0.5);
      doc.line(marginL, y, marginR, y); y += 8;
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text('AGEING SUMMARY', marginL, y); y += 8;
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      const bucketRows = [
        ['Current (0–30 days)', buckets.current],
        ['31–60 days',          buckets.d31_60],
        ['61–90 days',          buckets.d61_90],
        ['90+ days (overdue)',  buckets.d90plus],
      ];
      for (const [label, val] of bucketRows) {
        doc.text(label, marginL, y);
        doc.text(fmt(val), marginR, y, { align: 'right' });
        y += 6;
      }
      y += 2;
      doc.setDrawColor(0); doc.setLineWidth(0.3);
      doc.line(marginL, y, marginR, y); y += 6;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text('TOTAL OUTSTANDING', marginL, y);
      doc.setTextColor(220, 38, 38);
      doc.text(fmt(buckets.total), marginR, y, { align: 'right' });
      doc.setTextColor(0);

      const filename = `Statement-${clientName.replace(/[^A-Za-z0-9]+/g, '_').slice(0, 40)}-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
      toast(`Statement for ${clientName} downloaded`, 'success');
    } catch (err) {
      console.error('sendStatement failed:', err);
      toast('Failed to generate statement — see console', 'error');
    }
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
    if (await confirmAction({
      title: 'Remove this saved client?',
      message: 'Their existing invoices stay untouched — this only removes them from your saved clients list. You can add them again anytime.',
      confirmLabel: 'Remove',
      tone: 'danger',
    })) {
      await deleteClient(id);
      toast('Client removed', 'success');
      loadData();
    }
  };

  const handleDeleteBill = async (id) => {
    if (await confirmAction({
      title: 'Delete this invoice?',
      message: 'The invoice will be moved to Trash for 30 days. Can be restored from Settings → Trash.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })) {
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
    const msg = `*Invoice ${bill.invoiceNumber}*\nAmount: ${formatCurrency(bill.totalAmount)}\nDate: ${new Date(bill.invoiceDate).toLocaleDateString('en-IN')}\nStatus: ${(bill.status || 'unpaid').toUpperCase()}`;
    openWhatsAppShare(bill.clientPhone, msg);
  };

  const shareEmail = (bill) => {
    const subject = `Invoice ${bill.invoiceNumber}`;
    const body = `Dear ${bill.clientName},\n\nPlease find the details of your invoice:\n\nInvoice No: ${bill.invoiceNumber}\nAmount: ${formatCurrency(bill.totalAmount)}\nDate: ${new Date(bill.invoiceDate).toLocaleDateString('en-IN')}\nDue: ${bill.status === 'paid' ? 'Paid' : 'Pending'}\n\nRegards`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  };

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div>
            <h1 className="page-title">Clients</h1>
            <p className="page-subtitle">Client-wise invoice ledger and outstanding</p>
          </div>
          <HelpButton title="Clients — how to use">
            <ul style={{ paddingLeft: '1.1rem', margin: 0 }}>
              <li><strong>Click a client name</strong> to see every invoice, payment, and credit note in one place.</li>
              <li><strong>Statement PDF</strong> — a full account ledger with running balance. Send it when a client disputes a bill.</li>
              <li><strong>Aging PDF</strong> — outstanding invoices bucketed by 0-30 / 31-60 / 61-90 / 90+ days. Use it for collection calls.</li>
              <li><strong>Aging strip</strong> — the same buckets inline so you can see who's slow to pay at a glance.</li>
              <li><strong>Import / Export CSV</strong> — bulk-load or back up your client list.</li>
              <li><strong>WhatsApp / Email</strong> — quick outreach without leaving the app.</li>
            </ul>
          </HelpButton>
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
                      {/* v1.10.23 — surface overpayment explicitly (was
                          hidden as "Outstanding: ₹0" when paid > total). */}
                      <span className="client-stat-label">
                        {stats.unpaid < -0.005 ? 'Overpaid' : 'Outstanding'}
                      </span>
                      <span className="client-stat-value" style={{ color: stats.unpaid > 0.005 ? '#dc2626' : (stats.unpaid < -0.005 ? '#0369a1' : '#059669') }}>
                        {formatCurrency(Math.abs(stats.unpaid))}
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
                    {/* Action bar (right-aligned) — Statement + Aging PDFs. */}
                    <div style={{ padding: '0.5rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                        onClick={() => generateClientStatement(clientName)}
                        title="Account statement: every invoice, credit note, payment, and running balance in one PDF">
                        <Download size={14} /> Statement PDF
                      </button>
                      {/* v1.10.22 — Aging breakdown (0-30 / 31-60 / 61-90 / 90+). */}
                      <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                        onClick={() => generateAgingReport(clientName)}
                        title="Aging report: outstanding invoices bucketed by how overdue they are">
                        <Download size={14} /> Aging PDF
                      </button>
                    </div>

                    {/* v1.10.22 — Aging summary strip: shows the four
                        buckets inline so users get the answer without
                        having to open the PDF. */}
                    {(() => {
                      const { buckets } = getClientAging(clientName);
                      if (buckets.total <= 0.01) return null;
                      const fmt = (n) => formatCurrency(n, 'INR');
                      const cells = [
                        { label: 'Current', val: buckets.current, color: '#059669' },
                        { label: '31-60d',  val: buckets.d31_60,   color: '#d97706' },
                        { label: '61-90d',  val: buckets.d61_90,   color: '#ea580c' },
                        { label: '90+ d',   val: buckets.d90plus,  color: '#dc2626' },
                      ];
                      return (
                        <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8rem' }}>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Aging:</span>
                          {cells.map(c => (
                            <span key={c.label} style={{ display: 'inline-flex', gap: 4, alignItems: 'baseline' }}>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{c.label}</span>
                              <strong style={{ color: c.val > 0 ? c.color : 'var(--text-muted)' }}>{fmt(c.val)}</strong>
                            </span>
                          ))}
                        </div>
                      );
                    })()}

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
                                <tr key={bill.id} className={isOverdue ? 'row-overdue' : ''}>
                                  <td className="text-muted">{new Date(bill.invoiceDate).toLocaleDateString('en-IN')}</td>
                                  <td><span className="invoice-badge">{bill.invoiceNumber}</span></td>
                                  <td><span className="type-badge">{(INVOICE_TYPES[bill.invoiceType || 'tax-invoice'])?.label}</span></td>
                                  <td className="font-bold" style={{ textAlign: 'right' }}>{formatCurrency(bill.totalAmount, bill.currency || bill.data?.invoiceOptions?.currency || 'INR')}</td>
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
