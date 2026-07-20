import { useEffect, useRef, useState } from 'react';
import { X, Printer, Download, Loader } from 'lucide-react';
import InvoicePreview from './InvoicePreview';
import { getPaperSize } from '../utils';

// v1.10.36 — Portal-based print preview modal.
//
// Design decision (per user report on v1.10.35): DO NOT re-serialize
// the receipt HTML into an iframe. The v1.10.35 approach did that
// (clone outerHTML + copy document.styleSheets → iframe.srcdoc →
// iframe.print()) and shrank the QR + degraded print quality because
// CSS max-width caps beat inline widths, cross-origin fonts were
// dropped, and CSS var(--*) inheritance broke.
//
// This modal is PURELY VISUAL. It renders <InvoicePreview> with the
// EXACT SAME props the parent passes into the main on-screen preview
// — same component, same code path, guaranteed identical output. When
// the user clicks Print inside the modal, we DON'T print the modal's
// DOM: we close the modal and call the parent's `onPrint` callback,
// which triggers the existing directPrint → buildPDF → printViaIframe
// pipeline. That path uses the parent's `printRef` (the ORIGINAL
// on-screen preview) and has been the working, reliable path all along.
//
// So: the modal is what the user LOOKS at, and the parent's existing
// on-screen preview is what the printer receives. Since both are
// rendered by the same React component with the same props, the pixels
// are the same. No CSS drift risk.

export default function PrintPreviewModal({
  isOpen, onClose, onPrint, onDownloadPdf,
  profile, client, details, items, totals, invoiceType,
  customTerms, customNotes, extraSections, invoiceOptions,
}) {
  const [printing, setPrinting] = useState(false);
  const modalRef = useRef(null);

  // Esc-to-close keyboard shortcut, matching every other modal in the app.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !printing) onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, printing, onClose]);

  if (!isOpen) return null;

  const paperCfg = getPaperSize(invoiceOptions.paperSize, invoiceOptions);
  const paperLabel = paperCfg.label || `${paperCfg.widthMm}mm`;
  const isThermal = paperCfg.kind === 'thermal';

  const handlePrint = async () => {
    if (printing) return;
    setPrinting(true);
    try {
      // Close the modal BEFORE the print pipeline starts. The pipeline
      // uses the parent's existing on-screen preview via printRef, so
      // the modal doesn't need to stay open to keep the DOM alive.
      // Closing first also lets the browser's native print dialog
      // appear over a clean editor view instead of layered over our
      // modal.
      onClose?.();
      // Small tick so React commits the close before onPrint kicks off
      // its own layout / html2canvas work.
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 20)));
      await onPrint?.();
    } finally {
      setPrinting(false);
    }
  };

  const handleDownload = async () => {
    if (printing) return;
    setPrinting(true);
    try {
      onClose?.();
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 20)));
      await onDownloadPdf?.();
    } finally {
      setPrinting(false);
    }
  };

  // For thermal the preview scales to fit the modal since the receipt
  // is very narrow (48-104mm) — a 1:1 view would show a strip that's
  // dwarfed by the modal chrome. For A4 we show at ~70% so the whole
  // page fits without scrolling on typical laptop viewports.
  const previewScale = isThermal ? 1.6 : 0.72;

  return (
    <div className="modal-overlay print-preview-overlay"
      role="dialog" aria-modal="true" aria-labelledby="print-preview-title"
      onClick={(e) => { if (e.target === e.currentTarget && !printing) onClose(); }}
      style={{ zIndex: 10001 }}>
      <div ref={modalRef} className="modal-content print-preview-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: isThermal ? 'min(520px, 96vw)' : 'min(900px, 96vw)',
          maxHeight: '92vh',
          padding: 0,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.9rem 1.25rem',
          borderBottom: '1px solid var(--border)',
          background: 'var(--card-bg)',
        }}>
          <div>
            <h3 id="print-preview-title"
              style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Printer size={18} style={{ color: 'var(--primary)' }} />
              Print preview
            </h3>
            <p style={{ margin: '0.2rem 0 0 1.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {paperLabel} — click Print to send to your printer
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} disabled={printing}
            title="Close (Esc)" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Preview area — the SAME InvoicePreview component + SAME props
            as the main on-screen preview. React re-uses the render, so
            what the user sees here is bit-for-bit what the print pipeline
            will rasterize. */}
        <div style={{
          flex: 1, minHeight: 0,
          overflow: 'auto',
          padding: '1.25rem 0.75rem',
          background: 'var(--bg-secondary)',
          display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
        }}>
          <div style={{
            background: '#fff',
            padding: '0.5rem',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.18)',
            borderRadius: 4,
            transform: `scale(${previewScale})`,
            transformOrigin: 'top center',
            /* Compensate for the visual shrink of the scaled child so
               the scrollable area matches the visible receipt height. */
            marginBottom: `${Math.round((1 - previewScale) * -400)}px`,
          }}>
            <InvoicePreview
              previewOnly
              profile={profile} client={client} details={details}
              items={items} totals={totals} invoiceType={invoiceType}
              customTerms={customTerms} customNotes={customNotes}
              extraSections={extraSections} options={invoiceOptions}
            />
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: '0.85rem 1.25rem',
          borderTop: '1px solid var(--border)',
          background: 'var(--card-bg)',
          display: 'flex', gap: '0.5rem', flexWrap: 'wrap',
          justifyContent: 'flex-end', alignItems: 'center',
        }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginRight: 'auto' }}>
            {isThermal
              ? 'Preview is scaled 160% — actual print matches your paper roll width'
              : 'Preview is scaled — actual print will be full-size on the selected paper'}
          </span>
          {onDownloadPdf && (
            <button type="button" className="btn btn-secondary"
              onClick={handleDownload} disabled={printing}
              style={{ fontSize: '0.85rem', padding: '0.5rem 0.9rem' }}
              title="Save as PDF instead">
              <Download size={15} /> Download PDF
            </button>
          )}
          <button type="button" className="btn btn-secondary"
            onClick={onClose} disabled={printing}
            style={{ fontSize: '0.85rem', padding: '0.5rem 0.9rem' }}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary"
            onClick={handlePrint} disabled={printing}
            style={{ fontSize: '0.85rem', padding: '0.5rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {printing
              ? <><Loader size={15} className="spin" /> Sending…</>
              : <><Printer size={15} /> Print</>}
          </button>
        </div>
      </div>
    </div>
  );
}
