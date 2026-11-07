// v1.10.83 (#112) - the Purchase orders tab of Purchases: the list, View, and
// the PO as a PDF to print or send. The form is the purchase bill form in PO
// mode (PurchaseBills.jsx), which owns saving, Convert and Cancel.
import { useState } from 'react';
import { ClipboardList, Search, X, Eye, Edit3, Copy, Ban, FileText, Download, Printer, MessageCircle, Mail } from 'lucide-react';
import ActionsMenu from './ActionsMenu';
import { formatCurrency, splitPurchaseTax, parseLocalDate, numberToWords } from '../utils';
import { purchaseTotals, poStatus, PO_STATUS_LABELS, purchaseLineTax } from '../utils/purchaseOrders';
import { getPrintSettings } from '../utils/printSettings';
import { openWhatsAppShare } from '../utils/share';
import { toast } from './Toast';
import HelpButton from './HelpButton';

const STATUS_COLORS = {
  open: { bg: 'rgba(37, 99, 235, 0.14)', color: '#3b82f6' },
  'partly-received': { bg: 'rgba(245, 158, 11, 0.14)', color: '#f59e0b' },
  received: { bg: 'rgba(5, 150, 105, 0.14)', color: '#059669' },
  cancelled: { bg: 'rgba(100, 116, 139, 0.16)', color: '#94a3b8' },
};

const showDate = (d) => (d ? parseLocalDate(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const fmt = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// v1.10.85 (#171) - after any line discount.
const lineAmount = (it) => purchaseLineTax({ ...it, quantity: Number(it.quantity) || 0, rate: Number(it.rate) || 0 }).amount;

// Same accent colour the purchase bill PDF uses.
function accentRGB(ps) {
  const hex = String(ps?.userColorsEnabled ? ps.pdfAccent || '' : '').replace('#', '');
  return /^[0-9a-f]{6}$/i.test(hex) ? [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)) : [30, 64, 175];
}

// The PO as an A4 PDF: your business at the top, the supplier, the items, the
// GST split, terms and a signature box. jsPDF only, like the purchase bill PDF.
async function buildPoPdf(po, profile) {
  const { jsPDF } = await import('jspdf');
  const ps = getPrintSettings();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const L = 15, R = 195;
  const t = purchaseTotals(po.items);
  let y = 18;

  // Business (left) and the title with PO details (right).
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(0);
  doc.text('PURCHASE ORDER', R, y, { align: 'right' });
  doc.setFontSize(14);
  const nameLines = doc.splitTextToSize(profile?.businessName || '', 105);
  nameLines.forEach((line, i) => doc.text(line, L, y + i * 6));
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80);
  let ly = y + Math.max(1, nameLines.length) * 6;
  const bizLines = [
    ...doc.splitTextToSize(profile?.address || '', 105),
    profile?.state ? `State: ${profile.state}` : '',
    profile?.gstin ? `GSTIN: ${profile.gstin}` : '',
    [profile?.phone && `Phone: ${profile.phone}`, profile?.email].filter(Boolean).join('   '),
  ].filter(Boolean);
  bizLines.forEach(line => { doc.text(line, L, ly); ly += 4.5; });
  let ry = y + 8;
  doc.setFontSize(10); doc.setTextColor(0);
  [['PO No', po.poNumber || '-'], ['PO date', showDate(po.date) || '-'], ...(po.expectedDate ? [['Expected by', showDate(po.expectedDate)]] : [])]
    .forEach(([k, v]) => { doc.setFont('helvetica', 'normal'); doc.text(`${k}:`, R - 45, ry); doc.setFont('helvetica', 'bold'); doc.text(String(v), R, ry, { align: 'right' }); ry += 5; });
  y = Math.max(ly, ry) + 3;
  doc.setDrawColor(...accentRGB(ps)); doc.setLineWidth(0.5); doc.line(L, y, R, y); y += 7;

  // Supplier
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(100);
  doc.text('TO (SUPPLIER)', L, y); y += 5;
  doc.setFontSize(11); doc.setTextColor(0); doc.text(po.supplierName || '-', L, y); y += 5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60);
  if (po.supplierAddress) doc.splitTextToSize(po.supplierAddress, 120).forEach(line => { doc.text(line, L, y); y += 4.5; });
  if (po.supplierGstin) { doc.text(`GSTIN: ${po.supplierGstin}`, L, y); y += 4.5; }
  doc.text(po.interstate ? 'Inter-state supply (IGST)' : 'Within the state (CGST + SGST)', L, y); y += 8;

  // Items
  const cols = { n: L, d: L + 7, h: L + 82, q: L + 112, u: L + 114, r: L + 145, g: L + 160 };
  const head = () => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(0);
    doc.text('#', cols.n, y); doc.text('Description', cols.d, y); doc.text('HSN', cols.h, y);
    doc.text('Qty', cols.q, y, { align: 'right' }); doc.text('Unit', cols.u, y);
    doc.text('Rate', cols.r, y, { align: 'right' }); doc.text('GST%', cols.g, y, { align: 'right' });
    doc.text('Amount', R, y, { align: 'right' });
    y += 2; doc.setLineWidth(0.2); doc.setDrawColor(150); doc.line(L, y, R, y); y += 5;
    doc.setFont('helvetica', 'normal');
  };
  head();
  (po.items || []).forEach((it, idx) => {
    const name = doc.splitTextToSize(String(it.name || '-'), 72);
    const rowH = Math.max(6, name.length * 4.5);
    if (y + rowH > 270) { doc.addPage(); y = 20; head(); }
    doc.text(String(idx + 1), cols.n, y);
    name.forEach((line, i) => doc.text(line, cols.d, y + i * 4.5));
    doc.text(String(it.hsn || '-'), cols.h, y);
    doc.text(String(it.quantity || 0), cols.q, y, { align: 'right' });
    doc.text(String(it.unit || ''), cols.u, y);
    doc.text(fmt(it.rate), cols.r, y, { align: 'right' });
    doc.text(`${Number(it.taxPercent) || 0}%`, cols.g, y, { align: 'right' });
    doc.text(fmt(lineAmount(it)), R, y, { align: 'right' });
    y += rowH;
  });

  // Totals
  if (y > 230) { doc.addPage(); y = 20; }
  y += 2; doc.setDrawColor(...accentRGB(ps)); doc.setLineWidth(0.4); doc.line(L + 100, y, R, y); y += 6;
  doc.setFontSize(9); doc.setTextColor(60);
  const split = splitPurchaseTax(t.tax, !!po.interstate);
  const rows = [['Taxable value', t.taxable],
    ...(po.interstate ? [['IGST', split.igst]] : [['CGST', split.cgst], ['SGST', split.sgst]]),
    ...(t.cess > 0.005 ? [['Cess', t.cess]] : [])];
  rows.forEach(([k, v]) => { doc.text(k, L + 100, y); doc.text(fmt(v), R, y, { align: 'right' }); y += 5; });
  doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(L + 100, y - 2, R, y - 2); y += 4;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(0);
  doc.text('TOTAL (INR)', L + 100, y); doc.text(fmt(t.finalTotal), R, y, { align: 'right' }); y += 6;
  doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(80);
  doc.splitTextToSize(numberToWords(Math.round(t.finalTotal * 100) / 100), R - L).forEach(line => { doc.text(line, L, y); y += 4.2; });
  y += 4;

  // Terms
  if (po.note) {
    const lines = doc.splitTextToSize(po.note, R - L);
    if (y + 6 + lines.length * 4.5 > 255) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(0);
    doc.text('Notes / terms', L, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(60);
    lines.forEach(line => { doc.text(line, L, y); y += 4.5; });
  }

  // Signature, bottom right.
  if (y > 250) { doc.addPage(); y = 20; }
  const sy = Math.max(y + 8, 252);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(0);
  doc.text(`For ${profile?.businessName || ''}`, R, sy, { align: 'right' });
  const sig = profile?.signature || (ps.signatureShow !== false ? ps.signatureImage : '');
  if (sig && /^data:image\/(png|jpe?g)/i.test(sig)) {
    try {
      const p = doc.getImageProperties(sig);
      const h = 14, w = Math.min(50, (p.width / p.height) * h);
      doc.addImage(sig, R - w, sy + 2, w, h);
    } catch { /* an unreadable image leaves the space blank for a pen */ }
  }
  doc.setFont('helvetica', 'normal');
  doc.text('Authorised signatory', R, sy + 22, { align: 'right' });
  return doc;
}

const pdfName = (po) => `${String(po.poNumber || 'Purchase-order').replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`;

// Text for WhatsApp and email: what is ordered and the total.
function poMessage(po, profile) {
  const t = purchaseTotals(po.items);
  return [
    `*Purchase order ${po.poNumber}*`,
    profile?.businessName ? `From: ${profile.businessName}` : '',
    `Date: ${showDate(po.date)}${po.expectedDate ? `   Expected by: ${showDate(po.expectedDate)}` : ''}`,
    '',
    ...(po.items || []).map((it, i) => `${i + 1}. ${it.name} - ${it.quantity}${it.unit ? ` ${it.unit}` : ''} @ ${formatCurrency(it.rate)}`),
    '',
    `*Total: ${formatCurrency(t.finalTotal)}* (with GST)`,
    po.note ? `\nNotes: ${po.note}` : '',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n').trim();
}

export default function PurchaseOrders({ orders, purchases, ownerProfile, onNew, onEdit, onConvert, onDuplicate, onCancel }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewPo, setViewPo] = useState(null);

  const rows = orders.map(po => ({ po, status: poStatus(po, purchases) }));
  const q = search.trim().toLowerCase();
  const filtered = rows.filter(({ po, status }) =>
    (!statusFilter || status === statusFilter) &&
    (!q || [po.poNumber, po.supplierName, po.supplierGstin].some(v => String(v || '').toLowerCase().includes(q))));

  const downloadPdf = async (po) => {
    try { (await buildPoPdf(po, ownerProfile)).save(pdfName(po)); }
    catch (err) { console.error('PO PDF failed:', err); toast('Could not make the PDF', 'error'); }
  };
  const printPdf = async (po) => {
    try {
      const doc = await buildPoPdf(po, ownerProfile);
      doc.autoPrint();
      // A blocked pop-up still gets the file, as a download.
      if (!window.open(doc.output('bloburl'), '_blank')) doc.save(pdfName(po));
    } catch (err) { console.error('PO print failed:', err); toast('Could not make the PDF', 'error'); }
  };
  // On a phone that can share files, the PDF goes along; otherwise the text.
  const shareWhatsApp = async (po) => {
    const text = poMessage(po, ownerProfile);
    try {
      const file = new File([(await buildPoPdf(po, ownerProfile)).output('blob')], pdfName(po), { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
        await navigator.share({ files: [file], text: text.replace(/\*/g, '') });
        return;
      }
    } catch { /* fall back to the text */ }
    openWhatsAppShare('', text);
  };
  const shareEmail = (po) => {
    const subject = `Purchase order ${po.poNumber}${ownerProfile?.businessName ? ` from ${ownerProfile.businessName}` : ''}`;
    const body = `Dear ${po.supplierName || 'Sir/Madam'},\n\nPlease supply the following.\n\n${poMessage(po, ownerProfile).replace(/\*/g, '')}\n\nRegards`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  };

  const view = viewPo ? rows.find(r => r.po.id === viewPo) : null;

  return (
    <>
      <div className="glass-panel p-4 mb-6">
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-box" style={{ maxWidth: '300px' }}>
            <Search size={16} className="search-icon" />
            <input type="text" placeholder="Search PO number, supplier..." value={search}
              onChange={e => setSearch(e.target.value)} className="search-input" aria-label="Search purchase orders" />
          </div>
          <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Status">
            <option value="">All statuses</option>
            {Object.entries(PO_STATUS_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          {(search || statusFilter) && (
            <button className="icon-btn icon-btn-red" onClick={() => { setSearch(''); setStatusFilter(''); }} title="Clear filters" aria-label="Clear filters"><X size={15} /></button>
          )}
        </div>
      </div>

      <div className="glass-panel">
        <div className="table-header"><h3>Purchase orders <HelpButton title="Purchase orders" doc="purchases#po-list" size={16} style={{ marginLeft: 6 }} /></h3></div>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <ClipboardList size={48} />
            <p>{orders.length === 0 ? 'No purchase orders yet.' : 'No purchase orders match your filters.'}</p>
            {orders.length === 0 && <button className="btn btn-primary" onClick={onNew}>New purchase order</button>}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: '760px' }}>
              <thead>
                <tr>
                  <th>PO number</th>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Expected</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th>Status</th>
                  <th className="col-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ po, status }) => {
                  // Received and cancelled orders are read-only: View and
                  // Duplicate, as for a converted quotation.
                  const readOnly = status === 'received' || status === 'cancelled';
                  const sc = STATUS_COLORS[status];
                  return (
                    <tr key={po.id}>
                      <td><span className="invoice-badge">{po.poNumber}</span></td>
                      <td className="text-muted">{showDate(po.date)}</td>
                      <td className="font-medium">{po.supplierName}</td>
                      <td className="text-muted">{showDate(po.expectedDate) || '-'}</td>
                      <td style={{ textAlign: 'right' }} className="font-bold">{formatCurrency(purchaseTotals(po.items).finalTotal)}</td>
                      <td><span className="type-badge" style={{ background: sc.bg, color: sc.color }}>{PO_STATUS_LABELS[status]}</span></td>
                      <td>
                        <div className="table-actions" style={{ justifyContent: 'center' }}>
                          <button className="icon-btn icon-btn-blue" onClick={() => setViewPo(po.id)} title="View" aria-label={`View ${po.poNumber}`}><Eye size={15} /></button>
                          {status === 'open' && (
                            <button className="icon-btn icon-btn-blue" onClick={() => onEdit(po)} title="Edit" aria-label={`Edit ${po.poNumber}`}><Edit3 size={15} /></button>
                          )}
                          {!readOnly && (
                            <button className="icon-btn icon-btn-green" onClick={() => onConvert(po)} title="Convert to purchase bill" aria-label={`Convert ${po.poNumber} to purchase bill`}><FileText size={15} /></button>
                          )}
                          <ActionsMenu label={`More actions for ${po.poNumber}`} items={[
                            { label: 'Duplicate', icon: Copy, onClick: () => onDuplicate(po) },
                            { label: 'Print', icon: Printer, onClick: () => printPdf(po), hidden: readOnly },
                            { label: 'Download PDF', icon: Download, onClick: () => downloadPdf(po), hidden: readOnly },
                            { label: 'WhatsApp', icon: MessageCircle, tone: 'green', onClick: () => shareWhatsApp(po), hidden: readOnly },
                            { label: 'Email', icon: Mail, onClick: () => shareEmail(po), hidden: readOnly },
                            { label: 'Cancel order', icon: Ban, tone: 'danger', onClick: () => onCancel(po), hidden: readOnly },
                          ]} />
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

      {view && (() => {
        const { po, status } = view;
        const t = purchaseTotals(po.items);
        const split = splitPurchaseTax(t.tax, !!po.interstate);
        const readOnly = status === 'received' || status === 'cancelled';
        const close = () => setViewPo(null);
        const muted = { color: 'var(--text-muted)' };
        return (
          <div className="modal-overlay" onClick={close}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 className="section-title" style={{ margin: 0 }}>Purchase order · {po.poNumber} <HelpButton title="Viewing and sending a purchase order" doc="purchases#po-view" size={16} style={{ marginLeft: 6 }} /></h3>
                <button className="icon-btn" onClick={close} title="Close" aria-label="Close"><X size={18} /></button>
              </div>
              <div style={{ fontSize: '0.85rem', ...muted, marginBottom: '1rem' }}>
                {showDate(po.date)}{po.expectedDate ? ` · Expected by ${showDate(po.expectedDate)}` : ''} · {PO_STATUS_LABELS[status]} · {po.interstate ? 'Inter-state (IGST)' : 'Within the state (CGST + SGST)'}
              </div>
              <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem 1rem', borderRadius: 6, marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.72rem', ...muted, textTransform: 'uppercase', marginBottom: 4 }}>Supplier</div>
                <div style={{ fontWeight: 600 }}>{po.supplierName || '-'}</div>
                {po.supplierAddress && <div style={{ fontSize: '0.85rem', ...muted }}>{po.supplierAddress}</div>}
                {po.supplierGstin && <div style={{ fontSize: '0.82rem' }}>GSTIN: <strong>{po.supplierGstin}</strong></div>}
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, marginBottom: '1rem' }}>
                <table className="data-table" style={{ fontSize: '0.82rem', width: '100%', minWidth: 520 }}>
                  <thead>
                    <tr><th>#</th><th>Description</th><th>HSN</th><th style={{ textAlign: 'right' }}>Qty</th><th>Unit</th><th style={{ textAlign: 'right' }}>Rate</th><th style={{ textAlign: 'right' }}>GST%</th><th style={{ textAlign: 'right' }}>Amount</th></tr>
                  </thead>
                  <tbody>
                    {(po.items || []).map((it, idx) => (
                      <tr key={idx}>
                        <td style={muted}>{idx + 1}</td>
                        <td style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{it.name}</td>
                        <td style={muted}>{it.hsn || '-'}</td>
                        <td style={{ textAlign: 'right' }}>{it.quantity}</td>
                        <td style={muted}>{it.unit || ''}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(it.rate || 0)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(it.taxPercent) || 0}%</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(lineAmount(it))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.35rem 1rem', fontSize: '0.9rem', maxWidth: 320, marginLeft: 'auto' }}>
                <span style={muted}>Taxable value</span><span style={{ textAlign: 'right' }}>{formatCurrency(t.taxable)}</span>
                {po.interstate ? (
                  <><span style={muted}>IGST</span><span style={{ textAlign: 'right' }}>{formatCurrency(split.igst)}</span></>
                ) : (
                  <>
                    <span style={muted}>CGST</span><span style={{ textAlign: 'right' }}>{formatCurrency(split.cgst)}</span>
                    <span style={muted}>SGST</span><span style={{ textAlign: 'right' }}>{formatCurrency(split.sgst)}</span>
                  </>
                )}
                {t.cess > 0.005 && <><span style={muted}>Cess</span><span style={{ textAlign: 'right' }}>{formatCurrency(t.cess)}</span></>}
                <span style={{ borderTop: '2px solid var(--text)', paddingTop: 6, fontWeight: 700 }}>TOTAL</span>
                <span style={{ borderTop: '2px solid var(--text)', paddingTop: 6, textAlign: 'right', fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)' }}>{formatCurrency(t.finalTotal)}</span>
              </div>
              {po.note && <p style={{ fontSize: '0.82rem', ...muted, marginTop: '1rem', whiteSpace: 'pre-wrap' }}>Notes / terms: {po.note}</p>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <button className="btn btn-secondary" onClick={close}>Close</button>
                <button className="btn btn-secondary" onClick={() => { close(); onDuplicate(po); }}><Copy size={14} /> Duplicate</button>
                {!readOnly && <>
                  {status === 'open' && <button className="btn btn-secondary" onClick={() => { close(); onEdit(po); }}><Edit3 size={14} /> Edit</button>}
                  <button className="btn btn-secondary" onClick={() => shareWhatsApp(po)}><MessageCircle size={14} /> WhatsApp</button>
                  <button className="btn btn-secondary" onClick={() => shareEmail(po)}><Mail size={14} /> Email</button>
                  <button className="btn btn-secondary" onClick={() => printPdf(po)}><Printer size={14} /> Print</button>
                  <button className="btn btn-secondary" onClick={() => downloadPdf(po)}><Download size={14} /> Download PDF</button>
                  <button className="btn btn-primary" onClick={() => { close(); onConvert(po); }}><FileText size={14} /> Convert to purchase bill</button>
                </>}
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
