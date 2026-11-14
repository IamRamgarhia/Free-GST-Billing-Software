// v1.10.86 - (#148, #194) Supplier statement: one supplier's bills, payments
// and returns for a date range, with a running balance and what you still
// owe, on screen and as a PDF (Download, Print, WhatsApp, Email in the same
// preview as the client statement). The maths is utils/supplierStatement.js.
// `purchases` / `debitNotes` are this business's only, as the Purchases
// screen loads them.
import { useMemo, useState } from 'react';
import { Download, X } from 'lucide-react';
import HelpButton from './HelpButton';
import PdfPreviewModal from './PdfPreviewModal';
import { toast } from './Toast';
import { formatCurrency, getFYOptions, localToday } from '../utils';
import { pdfAccentRGB } from '../utils/printSettings';
import { supplierList, supplierStatement, balanceWords, supplierStatementMessage } from '../utils/supplierStatement';

const showDate = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN') : '');
// jsPDF's built-in font has no rupee sign: "Rs. 2,50,000.00".
const pdfMoney = (n) => `Rs. ${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(Number(n) || 0))}`;
// Supplier's account in your books: Cr = you owe them, Dr = they owe you.
const pdfBalance = (n) => (Math.abs(n) < 0.005 ? 'Nil' : `${pdfMoney(n)} ${n > 0 ? 'Cr' : 'Dr'}`);

async function buildPdf({ supplier, st, profile, period }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const accent = pdfAccentRGB();
  const L = 15, R = 195;
  const col = { date: L + 2, part: 42, debit: 133, credit: 163, bal: R - 2 };

  doc.setFillColor(...accent); doc.rect(0, 0, 210, 22, 'F');
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text('SUPPLIER STATEMENT', 105, 12, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.text(`Period: ${period}  ·  Made ${showDate(localToday())}`, 105, 18, { align: 'center' });
  doc.setTextColor(0);

  let y = 30;
  const block = (x, heading, lines) => {
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(100); doc.text(heading, x, y);
    doc.setTextColor(0); doc.setFontSize(10); doc.text(doc.splitTextToSize(lines[0] || '', 85), x, y + 4);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    let dy = 9;
    for (const l of lines.slice(1).filter(Boolean)) { const w = doc.splitTextToSize(l, 85); doc.text(w, x, y + dy); dy += w.length * 4; }
    return dy;
  };
  const left = block(L, 'OUR BUSINESS', [profile?.businessName, profile?.address, [profile?.city, profile?.state, profile?.pin].filter(Boolean).join(', '), profile?.gstin && `GSTIN: ${profile.gstin}`, profile?.phone && `Ph: ${profile.phone}`]);
  const right = block(105, 'SUPPLIER', [supplier.name, supplier.address, supplier.gstin && `GSTIN: ${supplier.gstin}`]);
  y += Math.max(left, right) + 4;

  // Summary strip
  doc.setFillColor(241, 245, 249); doc.rect(L, y, R - L, 16, 'F');
  const cells = [['Bills', st.totals.billed], ['Paid', st.totals.paid], ['Returned', st.totals.returned], ['Balance', st.closing]];
  cells.forEach(([label, v], i) => {
    const cx = L + (i + 0.5) * ((R - L) / 4);
    doc.setFontSize(7); doc.setTextColor(100); doc.text(label.toUpperCase(), cx, y + 5, { align: 'center' });
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42);
    doc.text(label === 'Balance' ? pdfBalance(v) : pdfMoney(v), cx, y + 12, { align: 'center' });
    doc.setFont('helvetica', 'normal');
  });
  y += 22;

  const header = () => {
    doc.setFillColor(...accent); doc.rect(L, y, R - L, 9, 'F');
    doc.setTextColor(255); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('Date', col.date, y + 6); doc.text('Particulars', col.part, y + 6);
    doc.text('Debit', col.debit, y + 6, { align: 'right' }); doc.text('Credit', col.credit, y + 6, { align: 'right' });
    doc.text('Balance', col.bal, y + 6, { align: 'right' });
    doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    y += 14;
  };
  header();
  doc.setFont('helvetica', 'italic'); doc.text('Opening balance', col.part, y); doc.text(pdfBalance(st.opening), col.bal, y, { align: 'right' });
  doc.setFont('helvetica', 'normal'); y += 7;
  st.rows.forEach((r, i) => {
    if (y > 268) { doc.addPage(); y = 20; header(); }
    if (i % 2) { doc.setFillColor(248, 250, 252); doc.rect(L, y - 5, R - L, 7, 'F'); }
    doc.text(showDate(r.date), col.date, y);
    doc.text(doc.splitTextToSize(r.particulars, col.debit - col.part - 22)[0] || '', col.part, y);
    if (r.debit) doc.text(pdfMoney(r.debit), col.debit, y, { align: 'right' });
    if (r.credit) doc.text(pdfMoney(r.credit), col.credit, y, { align: 'right' });
    doc.text(pdfBalance(r.balance), col.bal, y, { align: 'right' });
    y += 7;
  });
  if (y > 262) { doc.addPage(); y = 20; }
  doc.setDrawColor(...accent); doc.setLineWidth(0.6); doc.line(L, y, R, y); y += 8;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('CLOSING BALANCE', L, y);
  doc.text(pdfBalance(st.closing), col.bal, y, { align: 'right' });
  y += 8;
  doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(100);
  doc.text('Cr = amount we owe the supplier  ·  Dr = amount the supplier owes us', L, y);
  doc.text('Please check and confirm. This is a computer-generated statement.', 105, 285, { align: 'center' });
  return doc;
}

export default function SupplierStatement({ purchases, debitNotes, profile, initialSupplier = '', onClose }) {
  const suppliers = useMemo(() => supplierList(purchases), [purchases]);
  const fy = getFYOptions(1)[0];
  const [name, setName] = useState(() => suppliers.find((s) => s.name.toLowerCase() === String(initialSupplier).trim().toLowerCase())?.name || suppliers[0]?.name || '');
  const [from, setFrom] = useState(fy.from);
  const [to, setTo] = useState(fy.to);
  const [preview, setPreview] = useState(null);
  const supplier = suppliers.find((s) => s.name === name) || { name };
  const st = useMemo(() => supplierStatement(purchases, debitNotes, name, { from, to }), [purchases, debitNotes, name, from, to]);
  const period = from || to ? `${from ? showDate(from) : 'start'} to ${to ? showDate(to) : 'today'}` : 'All dates';

  const openPdf = async () => {
    try {
      const doc = await buildPdf({ supplier, st, profile, period });
      setPreview({
        doc, fileName: `supplier-statement-${name.replace(/[^\w]+/g, '-')}-${localToday()}.pdf`,
        title: `Statement: ${name}`, subject: `Statement of account - ${name}`,
        message: supplierStatementMessage(name, st, profile, period), phone: '', email: '', helpDoc: 'purchases#supplier-statement',
      });
    } catch {
      toast('Could not make the statement PDF', 'error');
    }
  };

  const money = (n) => (n ? formatCurrency(n) : '');
  return (<>
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 860, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
          <h3 className="section-title" style={{ margin: 0 }}>Supplier statement <HelpButton title="Supplier statement" doc="purchases#supplier-statement" size={16} style={{ marginLeft: 6 }} /></h3>
          <button type="button" className="icon-btn" onClick={onClose} title="Close" aria-label="Close"><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end', margin: '1rem 0' }}>
          <div className="form-group" style={{ flex: '1 1 220px', margin: 0 }}>
            <label className="form-label" htmlFor="sst-supplier">Supplier</label>
            <select id="sst-supplier" className="form-input" value={name} onChange={(e) => setName(e.target.value)}>
              {suppliers.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="sst-from">From</label>
            <input id="sst-from" type="date" className="form-input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="sst-to">To</label>
            <input id="sst-to" type="date" className="form-input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button type="button" className="btn btn-primary" onClick={openPdf} disabled={!name}><Download size={15} /> Statement PDF</button>
        </div>
        <p className="text-muted" style={{ fontSize: '0.85rem', margin: '0 0 0.6rem' }}>
          Bills {formatCurrency(st.totals.billed)} · Paid {formatCurrency(st.totals.paid)}
          {st.totals.returned > 0.005 && <> · Returned {formatCurrency(st.totals.returned)}</>}
          {st.totals.tds > 0.005 && <> · TDS kept back {formatCurrency(st.totals.tds)}</>}
          {' '}· <strong style={{ color: st.closing > 0.005 ? 'var(--danger)' : 'var(--success)' }}>Balance: {balanceWords(st.closing)}</strong>
        </p>
        <div className="table-scroll" style={{ maxHeight: 'calc(55vh / var(--ui-zoom, 1))', overflowY: 'auto' }}>
          <table className="data-table supplier-statement">
            <thead>
              <tr>
                <th>Date</th><th>Particulars</th>
                <th style={{ textAlign: 'right' }} title="Paid, returned or TDS kept back: takes off what you owe">Debit</th>
                <th style={{ textAlign: 'right' }} title="Bills: what you owe">Credit</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr><td /><td><em>Opening balance</em></td><td /><td /><td style={{ textAlign: 'right' }}>{balanceWords(st.opening)}</td></tr>
              {st.rows.map((r, i) => (
                <tr key={i}>
                  <td className="text-muted">{showDate(r.date)}</td>
                  <td>{r.particulars}</td>
                  <td style={{ textAlign: 'right' }}>{money(r.debit)}</td>
                  <td style={{ textAlign: 'right' }}>{money(r.credit)}</td>
                  <td style={{ textAlign: 'right' }}>{balanceWords(r.balance)}</td>
                </tr>
              ))}
              {st.rows.length === 0 && <tr><td colSpan={5} className="text-muted" style={{ textAlign: 'center' }}>Nothing with this supplier in these dates.</td></tr>}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 'bold' }}><td /><td>Closing balance</td><td /><td /><td style={{ textAlign: 'right' }}>{balanceWords(st.closing)}</td></tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
    {preview && <PdfPreviewModal {...preview} onClose={() => setPreview(null)} />}
  </>);
}
