// v1.10.85 (#168) - purchase returns: "Return to supplier" on a purchase bill
// makes a Debit Note (DN/26-27/0001), and the Returns tab of Purchases lists
// them. The maths (what can go back, totals, stock, ITC) is in
// utils/debitNotes.js; this file is the screens and the PDF.
import { useState } from 'react';
import { RotateCcw, Download, Printer, Ban, Undo2, Trash2, X, Save } from 'lucide-react';
import ActionsMenu from './ActionsMenu';
import HelpButton from './HelpButton';
import { toast } from './Toast';
import { confirmAction } from './ConfirmModal';
import { formatCurrency, parseLocalDate, numberToWords, localToday, businessKeyOf, stockDelta } from '../utils';
import { returnableLines, returnProblem, debitNoteFromBill, debitNoteTotals, debitNoteStock, unmatchedLines, freeDnNumber } from '../utils/debitNotes';
import { purchaseLineTax } from '../utils/purchaseOrders';
import { getPrintSettings } from '../utils/printSettings';
import { getAllProducts, applyStockChanges, saveDebitNote, deleteDebitNote, getNextDnNumber } from '../store';

const showDate = (d) => (d ? parseLocalDate(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const fmt = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const REASONS = ['Damaged goods', 'Wrong item sent', 'Excess quantity', 'Quality not as ordered', 'Expired / near expiry'];

function accentRGB(ps) {
  const hex = String(ps?.userColorsEnabled ? ps.pdfAccent || '' : '').replace('#', '');
  return /^[0-9a-f]{6}$/i.test(hex) ? [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)) : [30, 64, 175];
}

// Saves a debit note and moves stock from what it did before (`prev`) to
// what it does now: a new or restored one takes the goods out, a cancelled
// one puts them back. The note is saved first, so a failed save moves nothing.
// Throws only when the note itself was not saved; a stock problem after it was
// saved comes back as stockOk: false (the caller reloads and warns, so a retry
// can never save the note twice). `unmatched` = returned lines with no product.
export async function saveDebitNoteWithStock(next, prev = null) {
  const products = await getAllProducts();
  const applied = debitNoteStock(next, products);
  const saved = await saveDebitNote({ ...next, stockApplied: applied });
  let stockOk = true;
  try { await applyStockChanges(stockDelta(prev?.stockApplied || {}, applied)); } catch { stockOk = false; }
  return { saved, stockOk, unmatched: unmatchedLines(next, products) };
}

// The debit note as an A4 PDF for the supplier: your business, the supplier,
// the bill it is against, the returned goods with their GST, and a signature.
async function buildDnPdf(dn, profile) {
  const { jsPDF } = await import('jspdf');
  const ps = getPrintSettings();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const L = 15, R = 195;
  const t = debitNoteTotals(dn);
  let y = 18;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(0);
  doc.text('DEBIT NOTE', R, y, { align: 'right' });
  doc.setFontSize(14);
  const nameLines = doc.splitTextToSize(profile?.businessName || dn.ownerName || '', 105);
  nameLines.forEach((line, i) => doc.text(line, L, y + i * 6));
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80);
  let ly = y + Math.max(1, nameLines.length) * 6;
  [...doc.splitTextToSize(profile?.address || '', 105), profile?.state ? `State: ${profile.state}` : '',
    (profile?.gstin || dn.ownerGstin) ? `GSTIN: ${profile?.gstin || dn.ownerGstin}` : ''].filter(Boolean)
    .forEach(line => { doc.text(line, L, ly); ly += 4.5; });
  let ry = y + 8;
  doc.setFontSize(10); doc.setTextColor(0);
  [['Debit note No', dn.dnNumber || '-'], ['Date', showDate(dn.date) || '-'], ['Against bill No', dn.billNumber || '-'], ['Bill date', showDate(dn.billDate) || '-']]
    .forEach(([k, v]) => { doc.setFont('helvetica', 'normal'); doc.text(`${k}:`, R - 62, ry); doc.setFont('helvetica', 'bold'); doc.text(String(v), R, ry, { align: 'right' }); ry += 5; });
  y = Math.max(ly, ry) + 3;
  doc.setDrawColor(...accentRGB(ps)); doc.setLineWidth(0.5); doc.line(L, y, R, y); y += 7;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(100);
  doc.text('TO (SUPPLIER)', L, y); y += 5;
  doc.setFontSize(11); doc.setTextColor(0); doc.text(dn.supplierName || '-', L, y); y += 5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60);
  if (dn.supplierAddress) doc.splitTextToSize(dn.supplierAddress, 120).forEach(line => { doc.text(line, L, y); y += 4.5; });
  if (dn.supplierGstin) { doc.text(`GSTIN: ${dn.supplierGstin}`, L, y); y += 4.5; }
  doc.text(dn.interstate ? 'Inter-state supply (IGST)' : 'Within the state (CGST + SGST)', L, y); y += 6;
  if (dn.reason) { doc.setTextColor(0); doc.text(`Reason: ${dn.reason}`, L, y); y += 6; }
  y += 2;

  const cols = { n: L, d: L + 7, h: L + 82, q: L + 112, u: L + 114, r: L + 145, g: L + 160 };
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(0);
  doc.text('#', cols.n, y); doc.text('Goods returned', cols.d, y); doc.text('HSN', cols.h, y);
  doc.text('Qty', cols.q, y, { align: 'right' }); doc.text('Unit', cols.u, y);
  doc.text('Rate', cols.r, y, { align: 'right' }); doc.text('GST%', cols.g, y, { align: 'right' });
  doc.text('Taxable', R, y, { align: 'right' });
  y += 2; doc.setLineWidth(0.2); doc.setDrawColor(150); doc.line(L, y, R, y); y += 5;
  doc.setFont('helvetica', 'normal');
  (dn.items || []).forEach((it, idx) => {
    const name = doc.splitTextToSize(String(it.name || '-'), 72);
    const rowH = Math.max(6, name.length * 4.5);
    if (y + rowH > 270) { doc.addPage(); y = 20; }
    doc.text(String(idx + 1), cols.n, y);
    name.forEach((line, i) => doc.text(line, cols.d, y + i * 4.5));
    doc.text(String(it.hsn || '-'), cols.h, y);
    doc.text(String(it.quantity || 0), cols.q, y, { align: 'right' });
    doc.text(String(it.unit || ''), cols.u, y);
    doc.text(fmt(it.rate), cols.r, y, { align: 'right' });
    doc.text(`${Number(it.taxPercent) || 0}%`, cols.g, y, { align: 'right' });
    // v1.10.85 (#171) - after its discount, as on the bill.
    doc.text(fmt(purchaseLineTax(it).amount), R, y, { align: 'right' });
    y += rowH;
  });

  if (y > 225) { doc.addPage(); y = 20; }
  y += 2; doc.setDrawColor(...accentRGB(ps)); doc.setLineWidth(0.4); doc.line(L + 100, y, R, y); y += 6;
  doc.setFontSize(9); doc.setTextColor(60);
  [['Taxable value', t.taxable], ...(dn.interstate ? [['IGST', t.igst]] : [['CGST', t.cgst], ['SGST', t.sgst]]), ...(t.cess > 0.005 ? [['Cess', t.cess]] : [])]
    .forEach(([k, v]) => { doc.text(k, L + 100, y); doc.text(fmt(v), R, y, { align: 'right' }); y += 5; });
  doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(L + 100, y - 2, R, y - 2); y += 4;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(0);
  doc.text('TOTAL DEBIT (INR)', L + 100, y); doc.text(fmt(t.total), R, y, { align: 'right' }); y += 6;
  doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(80);
  doc.splitTextToSize(numberToWords(t.total), R - L).forEach(line => { doc.text(line, L, y); y += 4.2; });
  y += 3;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(40);
  doc.splitTextToSize(`We have returned the goods above against your bill ${dn.billNumber || ''}${dn.billDate ? ` dated ${showDate(dn.billDate)}` : ''}, and debited your account with ${formatCurrency(t.total)}. Please issue your credit note for it.`, R - L)
    .forEach(line => { doc.text(line, L, y); y += 4.5; });
  if (dn.note) doc.splitTextToSize(`Note: ${dn.note}`, R - L).forEach(line => { y += 0.5; doc.text(line, L, y); y += 4.5; });
  if (dn.cancelled) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(40); doc.setTextColor(220, 38, 38);
    doc.text('CANCELLED', 105, 150, { align: 'center', angle: 20 });
  }
  if (y > 250) { doc.addPage(); y = 20; }
  const sy = Math.max(y + 8, 252);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(0);
  doc.text(`For ${profile?.businessName || dn.ownerName || ''}`, R, sy, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text('Authorised signatory', R, sy + 22, { align: 'right' });
  return doc;
}
const pdfName = (dn) => `${String(dn.dnNumber || 'Debit-note').replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`;
export async function downloadDebitNotePdf(dn, profile) {
  try { (await buildDnPdf(dn, profile)).save(pdfName(dn)); }
  catch (err) { console.error('Debit note PDF failed:', err); toast('Could not make the PDF', 'error'); }
}
async function printDebitNote(dn, profile) {
  try {
    const doc = await buildDnPdf(dn, profile);
    doc.autoPrint();
    if (!window.open(doc.output('bloburl'), '_blank')) doc.save(pdfName(dn));
  } catch (err) { console.error('Debit note print failed:', err); toast('Could not make the PDF', 'error'); }
}

// "Return to supplier": the bill's lines, how many can still go back, and the
// quantity going back now.
export function ReturnToSupplierModal({ bill, debitNotes, ownerProfile, onClose, onSaved }) {
  const lines = returnableLines(bill, debitNotes);
  const [qty, setQty] = useState({});
  const [date, setDate] = useState(localToday());
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  // A bill saved before bills had a business gets the open one.
  const owner = { gstin: ownerProfile?.gstin || '', name: ownerProfile?.businessName || '' };
  const draft = debitNoteFromBill(bill, debitNotes, qty, { date, reason, note, owner });
  const t = debitNoteTotals(draft);

  const save = async () => {
    const problem = (!date ? 'Enter the date of the return' : '') || returnProblem(bill, debitNotes, qty, date);
    if (problem) { toast(problem, 'warning'); return; }
    setBusy(true);
    try {
      // Skips a number already used (an older backup restored puts the counter back).
      const dnNumber = await freeDnNumber(() => getNextDnNumber({ businessKey: businessKeyOf(ownerProfile), date }), debitNotes);
      const { saved, stockOk, unmatched } = await saveDebitNoteWithStock({ ...draft, dnNumber, createdAt: new Date().toISOString() });
      if (!stockOk) toast(`${dnNumber} is saved, but the stock could not be changed. Check the stock of the returned items in Products.`, 'warning', 10000);
      else if (unmatched.length) toast(`${dnNumber} saved. No product is named ${unmatched.join(', ')}, so no stock moved for ${unmatched.length === 1 ? 'it' : 'them'}.`, 'warning', 10000);
      else toast(`${dnNumber} saved: ${formatCurrency(t.total)} returned, stock and ITC reduced`, 'success');
      onSaved(saved);
    } catch (err) {
      console.error('Debit note save failed:', err);
      toast('Could not save the debit note', 'error');
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 760 }} role="dialog" aria-label="Return to supplier">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h3 className="section-title" style={{ margin: 0 }}>Return to supplier · {bill.invoiceNumber} <HelpButton title="Purchase returns (debit notes)" doc="purchases#purchase-returns" size={16} style={{ marginLeft: 6 }} /></h3>
          <button className="icon-btn" onClick={onClose} title="Close" aria-label="Close"><X size={18} /></button>
        </div>
        <p className="text-muted" style={{ fontSize: '0.82rem', margin: '0 0 0.75rem' }}>
          {bill.supplierName} · bill dated {showDate(bill.date)}. Enter how many of each item go back. A debit note is made against this bill: the goods go out of stock, and the GST on them comes off your input tax credit.
        </p>
        <div className="table-scroll" style={{ marginBottom: '0.75rem' }}>
          <table className="data-table" style={{ fontSize: '0.82rem', minWidth: 560 }}>
            <thead><tr><th>Item</th><th style={{ textAlign: 'right' }}>Bought</th><th style={{ textAlign: 'right' }}>Returned</th><th style={{ textAlign: 'right' }}>Rate</th><th style={{ textAlign: 'right' }}>Return now</th></tr></thead>
            <tbody>
              {lines.map(l => (
                <tr key={l.line}>
                  <td style={{ whiteSpace: 'normal' }}>{l.name}<span className="text-muted"> · {l.taxPercent}% GST</span></td>
                  <td style={{ textAlign: 'right' }}>{l.bought}</td>
                  <td style={{ textAlign: 'right' }} className="text-muted">{l.returned || '-'}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(l.rate)}{l.discount ? <span className="text-muted"> less {l.discountType === 'percent' ? `${l.discount}%` : formatCurrency(l.discount)}</span> : null}</td>
                  <td style={{ textAlign: 'right' }}>
                    <input type="number" min="0" max={l.left} step="any" className="form-input" style={{ width: 90, textAlign: 'right' }}
                      aria-label={`Return quantity of ${l.name}`} disabled={l.left <= 0} placeholder={`max ${l.left}`}
                      value={qty[l.line] ?? ''} onChange={e => setQty(prev => ({ ...prev, [l.line]: e.target.value }))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
          <div className="form-group"><label className="form-label">Debit note date</label>
            <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Reason</label>
            <input className="form-input" list="dn-reasons" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Damaged goods" maxLength={120} />
            <datalist id="dn-reasons">{REASONS.map(r => <option key={r} value={r} />)}</datalist></div>
          <div className="form-group"><label className="form-label">Note (optional)</label>
            <input className="form-input" value={note} onChange={e => setNote(e.target.value)} maxLength={300} placeholder="e.g. sent back by VRL, LR 4471" /></div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'flex-end', fontSize: '0.88rem', margin: '0.5rem 0' }}>
          <span>Taxable: <strong>{formatCurrency(t.taxable)}</strong></span>
          {bill.interstate ? <span>IGST: <strong>{formatCurrency(t.igst)}</strong></span>
            : <><span>CGST: <strong>{formatCurrency(t.cgst)}</strong></span><span>SGST: <strong>{formatCurrency(t.sgst)}</strong></span></>}
          {t.cess > 0.005 && <span>Cess: <strong>{formatCurrency(t.cess)}</strong></span>}
          <span>Debit note total: <strong>{formatCurrency(t.total)}</strong></span>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}><Save size={16} /> Save debit note</button>
        </div>
      </div>
    </div>
  );
}

// The Returns tab: every debit note, with PDF, Print, Cancel / Undo and Delete.
export default function DebitNotesList({ notes, purchases = [], ownerProfile, onChanged }) {
  const setCancelled = async (dn, cancelled) => {
    // Undo: never more back than the bill has left (another return may have
    // been made while this one was cancelled).
    const bill = purchases.find((p) => p.id === dn.purchaseId);
    const problem = !cancelled && bill
      ? returnProblem(bill, notes.filter((n) => n.id !== dn.id), Object.fromEntries((dn.items || []).map((it) => [it.line, it.quantity])))
      : '';
    if (problem) { toast(`${dn.dnNumber} cannot come back: ${problem}`, 'warning', 8000); return; }
    if (!await confirmAction(cancelled ? {
      title: `Cancel ${dn.dnNumber}?`,
      message: 'It keeps its number but stops counting: the goods come back into stock, and the input tax credit and the amount you owe the supplier go back to what they were. Undo it from the same menu.',
      confirmLabel: 'Cancel debit note', cancelLabel: 'Keep it', tone: 'danger',
    } : {
      title: `Undo the cancel of ${dn.dnNumber}?`,
      message: 'The goods go out of stock again, and the return comes off your input tax credit and what you owe the supplier.',
      confirmLabel: 'Yes, undo', cancelLabel: 'No',
    })) return;
    try {
      const next = { ...dn, cancelled, cancelledAt: cancelled ? new Date().toISOString() : undefined };
      const { stockOk } = await saveDebitNoteWithStock(next, dn);
      if (!stockOk) toast(`${dn.dnNumber} is ${cancelled ? 'cancelled' : 'back'}, but the stock could not be changed. Check Products.`, 'warning', 10000);
      else toast(cancelled ? `${dn.dnNumber} cancelled, stock put back` : `${dn.dnNumber} is back`, 'success');
      onChanged();
    } catch { toast('Could not change the debit note', 'error'); }
  };
  const remove = async (dn) => {
    if (!await confirmAction({
      title: `Delete ${dn.dnNumber}?`,
      message: 'It is removed for good, and its goods come back into stock. To keep its number in your records instead, use Cancel debit note.',
      confirmLabel: 'Delete', tone: 'danger',
    })) return;
    try {
      await deleteDebitNote(dn.id);
      let stockOk = true;
      try { await applyStockChanges(stockDelta(dn.stockApplied || {}, {})); } catch { stockOk = false; }
      toast(stockOk ? `${dn.dnNumber} deleted` : `${dn.dnNumber} deleted, but its stock could not be put back. Check Products.`, stockOk ? 'success' : 'warning');
      onChanged();
    } catch { toast('Could not delete the debit note', 'error'); }
  };

  const active = notes.filter(dn => !dn.cancelled).map(debitNoteTotals);
  const sum = (k) => active.reduce((s, t) => s + t[k], 0);

  return (
    <div className="glass-panel">
      <div className="table-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3>Purchase returns (debit notes) <HelpButton title="Purchase returns (debit notes)" doc="purchases#purchase-returns" size={16} /></h3>
        <span className="text-muted" style={{ fontSize: '0.82rem' }}>Returned {formatCurrency(sum('total'))} · ITC taken back {formatCurrency(sum('tax') + sum('cess'))}</span>
      </div>
      {notes.length === 0 ? (
        <div className="empty-state">
          <RotateCcw size={48} />
          <p>No purchase returns yet. Use the return button on a purchase bill to send goods back.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table" style={{ minWidth: '800px' }}>
            <thead>
              <tr>
                <th>Date</th><th>Debit note</th><th>Supplier</th><th>Against bill</th>
                <th style={{ textAlign: 'right' }}>Taxable</th><th style={{ textAlign: 'right' }}>GST</th><th style={{ textAlign: 'right' }}>Total</th>
                <th>Status</th><th className="col-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {notes.map(dn => {
                const t = debitNoteTotals(dn);
                return (
                  <tr key={dn.id} style={dn.cancelled ? { opacity: 0.65 } : undefined}>
                    <td className="text-muted">{showDate(dn.date)}</td>
                    <td><span className="invoice-badge">{dn.dnNumber}</span></td>
                    <td className="font-medium">{dn.supplierName}</td>
                    <td className="text-muted">{dn.billNumber}{dn.billDate ? ` · ${showDate(dn.billDate)}` : ''}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(t.taxable)}</td>
                    <td style={{ textAlign: 'right' }} className="text-muted">{formatCurrency(t.tax + t.cess)}</td>
                    <td style={{ textAlign: 'right' }} className="font-bold">{formatCurrency(t.total)}</td>
                    <td><span className="type-badge">{dn.cancelled ? 'Cancelled' : 'Issued'}</span></td>
                    <td>
                      <div className="table-actions" style={{ justifyContent: 'center' }}>
                        <button className="icon-btn icon-btn-blue" onClick={() => downloadDebitNotePdf(dn, ownerProfile)} title="Download PDF" aria-label={`Download ${dn.dnNumber}`}><Download size={15} /></button>
                        <ActionsMenu label={`More actions for ${dn.dnNumber}`} items={[
                          { label: 'Print', icon: Printer, onClick: () => printDebitNote(dn, ownerProfile) },
                          { label: 'Cancel debit note', icon: Ban, tone: 'danger', onClick: () => setCancelled(dn, true), hidden: !!dn.cancelled },
                          { label: 'Undo cancel', icon: Undo2, onClick: () => setCancelled(dn, false), hidden: !dn.cancelled },
                          { label: 'Delete', icon: Trash2, tone: 'danger', onClick: () => remove(dn) },
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
  );
}
