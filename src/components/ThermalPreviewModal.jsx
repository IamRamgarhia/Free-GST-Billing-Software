import { useRef, useState } from 'react';
import { X, Printer, Download } from 'lucide-react';
import InvoicePreview from './InvoicePreview';
import { getPaperSize } from '../utils';
import { toast } from './Toast';

// v1.10.34 — Thermal receipt preview modal.
//
// Prior path was buildPDF → html2canvas raster → JPEG → jsPDF → iframe →
// Chrome print. Every stage rasterized the text at least once, and the
// thermal printer (203 dpi) received a pre-rasterized image it had to
// re-sample — visible as slightly fuzzy digits on receipts, and much
// bigger print jobs (raster, not vector) that slow down old thermal
// printers with tiny buffers.
//
// New path: this modal renders <InvoicePreview> live so the user sees
// exactly what will print, then clicks Print. Print copies the receipt
// DOM's outerHTML + the document's stylesheets into a hidden iframe's
// srcdoc, and calls iframe.contentWindow.print(). Chrome sends VECTOR
// TEXT to the printer driver, which rasterizes at the printer's native
// resolution — sharp glyphs at any font size, smaller print jobs,
// faster buffer fill on old printers.
//
// UX matches the modal-preview pattern common on POS apps: compact box
// with just the receipt content, Print button, no browser chrome. No
// more "huge empty area under the cut here line" from Chrome's A4-default
// preview UI.

export default function ThermalPreviewModal({
  isOpen, onClose,
  profile, client, details, items, totals, invoiceType,
  customTerms, customNotes, extraSections, invoiceOptions,
  onDownloadPdf, // optional: falls back to PDF download for older printers
}) {
  const previewWrapperRef = useRef(null);
  const [printing, setPrinting] = useState(false);

  if (!isOpen) return null;

  const paperCfg = getPaperSize(invoiceOptions.paperSize, invoiceOptions);
  const paperLabel = paperCfg.label || `${paperCfg.widthMm}mm`;

  // Collect the document's CSS text so the iframe renders identically.
  // Uses cssRules.cssText which resolves computed values — @import URLs,
  // vendor prefixes, everything the browser has already parsed. Falls
  // back gracefully on cross-origin sheets (fonts.googleapis.com) whose
  // rules aren't readable from JS: we skip those, and the iframe uses
  // system fonts (which is fine for thermal — Courier New).
  const collectStyles = () => {
    const parts = [];
    try {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          const rules = sheet.cssRules;
          if (!rules) continue;
          for (const rule of Array.from(rules)) {
            parts.push(rule.cssText);
          }
        } catch {
          // Cross-origin stylesheet — cssRules access throws SecurityError.
          // Not a problem for thermal (system fonts suffice).
        }
      }
    } catch { /* defensive */ }
    return parts.join('\n');
  };

  const handlePrint = async () => {
    if (!previewWrapperRef.current) return;
    setPrinting(true);
    try {
      // Find the actual invoice-preview element inside our wrapper.
      const receipt = previewWrapperRef.current.querySelector('#invoice-preview');
      if (!receipt) {
        toast('Preview not ready — try again in a moment.', 'error');
        return;
      }

      const receiptHtml = receipt.outerHTML;
      const styles = collectStyles();
      const widthMm = paperCfg.widthMm;

      // Build a self-contained document. Zero body margin + @page size
      // matches the roll width; height auto so the paper shrinks to
      // content (no A4 padding).
      const doc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Print Receipt</title>
  <style>
    @page { size: ${widthMm}mm auto; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; }
    /* Ensure the receipt sits at position 0 so nothing shifts it. */
    #invoice-preview {
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      box-shadow: none !important;
      background: #fff !important;
      color: #000 !important;
      min-height: 0 !important;
    }
    /* v1.10.33 project styles — imported so class-based thermal styles
       (paper-thermal-*, thermal-qr, thermal-logo, etc.) resolve. */
    ${styles}
  </style>
</head>
<body>${receiptHtml}</body>
</html>`;

      // Hidden iframe. Kept off-screen because Chrome refuses to print
      // an iframe with display:none. Removed after the print job flushes.
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;left:-99999px;top:0;width:0;height:0;border:0;';
      iframe.setAttribute('aria-hidden', 'true');
      document.body.appendChild(iframe);

      // Use srcdoc so the iframe gets a same-origin document without
      // navigation. onload fires once the parsed doc is ready; a small
      // extra tick lets images (logo, QR) settle before we print.
      await new Promise((resolve) => {
        iframe.onload = resolve;
        iframe.srcdoc = doc;
      });
      // Wait for images to load INSIDE the iframe (logo, QR data URLs
      // usually resolve synchronously but a slow logo file might not).
      const imgs = iframe.contentDocument?.querySelectorAll('img') || [];
      await Promise.all(Array.from(imgs).map(img => (
        img.complete ? Promise.resolve()
          : new Promise(r => {
              img.onload = r;
              img.onerror = r;
              // 3s safety
              setTimeout(r, 3000);
            })
      )));

      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        // Some browsers block programmatic print on iframes without user
        // gesture. Fall back to opening in a new tab for manual print.
        console.warn('Iframe print failed, falling back:', e);
        window.open(URL.createObjectURL(new Blob([doc], { type: 'text/html' })), '_blank');
      }
      // Give the browser ~5s to consume the print job before we tear down.
      setTimeout(() => { try { iframe.remove(); } catch { /* ignore */ } }, 5000);
      // Close the preview modal so the user goes back to their invoice.
      onClose?.();
    } catch (err) {
      console.error('Thermal print failed:', err);
      toast('Print failed — try Download PDF instead', 'error');
    } finally {
      setPrinting(false);
    }
  };

  const handleDownloadPdf = () => {
    onDownloadPdf?.();
    onClose?.();
  };

  return (
    <div className="modal-overlay thermal-preview-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog" aria-modal="true"
      style={{ zIndex: 10001 }}>
      <div className="modal-content thermal-preview-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 'min(560px, 96vw)',
          maxHeight: '92vh',
          padding: 0,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--border)',
          background: 'var(--card-bg)',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Printer size={18} style={{ color: 'var(--primary)' }} />
              Thermal Receipt Preview
            </h3>
            <p style={{ margin: '0.2rem 0 0 1.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {paperLabel} — this is exactly what will print
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} title="Close (Esc)" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Preview area — scrollable, centered, "on paper" look */}
        <div style={{
          flex: 1, minHeight: 0,
          overflow: 'auto',
          padding: '1.25rem',
          background: 'var(--bg-secondary)',
          display: 'flex', justifyContent: 'center',
        }}>
          <div ref={previewWrapperRef} style={{
            background: '#fff',
            padding: '0.75rem 0.5rem',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
            borderRadius: 4,
            /* The InvoicePreview thermal branch is already width-constrained
               to paperCfg.widthMm via inline style, so we just wrap it. */
          }}>
            <InvoicePreview
              profile={profile} client={client} details={details}
              items={items} totals={totals} invoiceType={invoiceType}
              customTerms={customTerms} customNotes={customNotes}
              extraSections={extraSections} options={invoiceOptions}
            />
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: '0.9rem 1.25rem',
          borderTop: '1px solid var(--border)',
          background: 'var(--card-bg)',
          display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center',
        }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: 'auto' }}>
            Text stays vector — sharper glyphs than PDF export
          </span>
          {onDownloadPdf && (
            <button type="button" className="btn btn-secondary"
              onClick={handleDownloadPdf} disabled={printing}
              style={{ fontSize: '0.85rem', padding: '0.5rem 0.9rem' }}
              title="Download as PDF instead — for saving or emailing">
              <Download size={15} /> Download PDF
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={printing}
            style={{ fontSize: '0.85rem', padding: '0.5rem 0.9rem' }}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary"
            onClick={handlePrint} disabled={printing}
            style={{ fontSize: '0.85rem', padding: '0.5rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Printer size={16} /> {printing ? 'Sending to printer…' : 'Print Receipt'}
          </button>
        </div>
      </div>
    </div>
  );
}
