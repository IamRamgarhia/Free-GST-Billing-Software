import { useEffect, useMemo, useRef } from 'react';
import { X, Download, Printer, MessageCircle, Mail, FileText } from 'lucide-react';
import { openWhatsAppShare } from '../utils/share';
import { toast } from './Toast';
import HelpButton from './HelpButton';

// v1.10.85 (#157) - Statement PDF and Aging PDF open here first, instead of
// downloading straight away. Asked for: "view the document without
// downloading it", with Download, Print, WhatsApp and Email, and close back
// to the Client Ledger.
//
// The PDF is shown in the browser's own PDF viewer (a blob: frame, allowed by
// frame-src in index.html). Print prints that same frame, as printViaIframe
// does for invoices. WhatsApp and Email work as they do for an invoice on the
// Invoices list: a phone shares the PDF itself; on a PC (where a web page
// cannot attach a file to WhatsApp or a mail) the PDF is downloaded and the
// chat / mail opens with the message, ready to attach it.
export default function PdfPreviewModal({ doc, fileName, title, message, phone, email, subject, onClose }) {
  const frameRef = useRef(null);
  const blob = useMemo(() => doc.output('blob'), [doc]);
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const download = () => doc.save(fileName);

  const print = () => {
    try { frameRef.current.contentWindow.focus(); frameRef.current.contentWindow.print(); }
    catch { if (!window.open(url, '_blank')) download(); }
  };

  // A phone (or a PC with a share sheet) gets the PDF itself.
  const shareFile = async () => {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
    const file = new File([blob], fileName, { type: 'application/pdf' });
    if (typeof navigator.canShare !== 'function' || !navigator.canShare({ files: [file] })) return false;
    try {
      await navigator.share({ title, text: message.replace(/\*/g, ''), files: [file] });
    } catch (e) {
      // AbortError = the share sheet was closed: nothing else to do.
      if (e?.name !== 'AbortError') return false;
    }
    return true;
  };

  const whatsApp = async () => {
    if (await shareFile()) return;
    openWhatsAppShare(phone, message);
    download();
    toast(`PDF downloaded. Drag it into the WhatsApp chat${phone ? '' : ' (choose the contact there)'} — browsers can't attach it for you.`, 'info', 7000);
  };

  const mail = () => {
    // Only a plain address is used, so a stray "?" or "&" can't break the link.
    const to = /^[^\s@?&#]+@[^\s@?&#]+$/.test(String(email || '').trim()) ? String(email).trim() : '';
    const body = `Dear Sir/Madam,\n\n${message.replace(/\*/g, '')}\n\nRegards`;
    window.open(`mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
    download();
    toast('PDF downloaded. Attach it to the email.', 'info', 6000);
  };

  const btn = { fontSize: '0.85rem', padding: '0.5rem 0.9rem' };
  return (
    <div className="modal-overlay print-preview-overlay" role="dialog" aria-modal="true" aria-labelledby="pdf-preview-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ zIndex: 10001 }}>
      <div className="modal-content print-preview-content" onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 'min(900px, 96vw)', width: '100%', height: 'min(92vh, 92dvh)', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1.25rem', borderBottom: '1px solid var(--border)', background: 'var(--card-bg)' }}>
          <h3 id="pdf-preview-title" style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={18} style={{ color: 'var(--primary)' }} /> {title}
            <HelpButton title="Statement and Aging PDFs" doc="clients#statement" size={16} />
          </h3>
          <button type="button" className="icon-btn" onClick={onClose} title="Close (Esc)" aria-label="Close"><X size={18} /></button>
        </div>
        <iframe ref={frameRef} src={url} title={title} style={{ flex: 1, minHeight: 0, width: '100%', border: 0, background: 'var(--bg-secondary)' }} />
        <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid var(--border)', background: 'var(--card-bg)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" style={btn} onClick={whatsApp} title="Send on WhatsApp"><MessageCircle size={15} /> WhatsApp</button>
          <button type="button" className="btn btn-secondary" style={btn} onClick={mail} title="Send by email"><Mail size={15} /> Email</button>
          <button type="button" className="btn btn-secondary" style={btn} onClick={download}><Download size={15} /> Download</button>
          <button type="button" className="btn btn-primary" style={btn} onClick={print}><Printer size={15} /> Print</button>
        </div>
      </div>
    </div>
  );
}
