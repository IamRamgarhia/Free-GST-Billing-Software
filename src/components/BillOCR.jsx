import { useState, useRef } from 'react';
import { X, Upload, Loader, Wand2 } from 'lucide-react';
import { toast } from './Toast';

/*
 * v1.10.22 — Purchase-bill OCR.
 *
 * Reported: "purchase bill ocr for faster and accurate entry".
 *
 * User uploads a photo/scan of a supplier's tax invoice; we OCR the image
 * via tesseract.js (loaded on demand, kept out of the main bundle) and
 * heuristically pull out:
 *
 *   - Supplier GSTIN — 15-char format is strict enough to catch reliably.
 *   - Invoice number — after "Invoice", "Bill", "No." labels.
 *   - Invoice date   — dd/mm/yyyy or dd-mm-yyyy variants.
 *   - Grand total    — the number labelled "Total", "Grand Total", or
 *                      "Amount Payable", with rupee-format tolerance.
 *
 * Line items are NOT auto-parsed — table extraction from OCR text is
 * unreliable across bill layouts and misrouted ITC is worse than a slow
 * manual entry. User confirms the extracted header fields and fills line
 * items themselves.
 *
 * Tesseract.js runs entirely client-side (WebAssembly). No network
 * calls to a paid OCR provider, so the offline-first + free positioning
 * of the app is preserved. First run downloads ~2MB of language data
 * to browser cache; subsequent runs are instant.
 */

// GSTIN: 2-digit state code + 5 letters + 4 digits + 1 letter + entity
// code (digit/letter) + 'Z' + check digit/letter. Real length: 15.
const GSTIN_RE = /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b/;

// Date variants seen on Indian tax invoices:
//   14/07/2026, 14-07-2026, 14 Jul 2026, 14th July 2026 (rare).
const DATE_RES = [
  /\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/,
  /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{2,4})\b/i,
];

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

const parseDateFrom = (text) => {
  for (const re of DATE_RES) {
    const m = text.match(re);
    if (!m) continue;
    let y, mo, d;
    if (/^\d/.test(m[2])) {
      // Numeric month → assume DD-MM-YYYY (India default).
      d = Number(m[1]); mo = Number(m[2]); y = Number(m[3]);
    } else {
      d = Number(m[1]); mo = MONTHS[m[2].slice(0, 3).toLowerCase()]; y = Number(m[3]);
    }
    if (y < 100) y = 2000 + y;
    if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 2000 || y > 2100) continue;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return '';
};

// Invoice number: first non-blank token after "Invoice", "Bill", or "No".
// Length ceiling (25 chars) drops paragraph-continuation false positives.
const parseInvoiceNumber = (text) => {
  const m = text.match(/(?:invoice|bill|inv|voucher)\s*(?:no\.?|#|number)?\s*:?\s*([A-Za-z0-9/\-]{2,25})/i);
  return m ? m[1].trim() : '';
};

// Supplier name — heuristic: the first uppercase-heavy line above the
// GSTIN. Often a company name is set in all-caps on Indian bills.
const parseSupplierName = (text) => {
  const gstinIdx = text.search(GSTIN_RE);
  const above = gstinIdx > 0 ? text.slice(0, gstinIdx) : text;
  const lines = above.split(/\n+/).map(l => l.trim()).filter(Boolean);
  // Look backwards from the GSTIN for a line with >=50% uppercase letters
  // and >=3 words. That's usually the supplier's registered name.
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.length < 4 || line.length > 80) continue;
    const letters = line.replace(/[^A-Za-z]/g, '');
    if (letters.length < 4) continue;
    const upper = letters.replace(/[^A-Z]/g, '').length / letters.length;
    if (upper >= 0.5) return line;
  }
  return '';
};

// Grand total — walks label patterns from most-specific to most-general,
// returns the first match as a JS number. Indian rupee formatting has
// commas we strip; a bare "Total" without a currency prefix is fine.
const parseGrandTotal = (text) => {
  const patterns = [
    /grand\s*total[^0-9-]{0,10}(?:rs\.?|inr|₹)?\s*([\d,]+\.?\d*)/i,
    /(?:amount|amt)\s+payable[^0-9-]{0,10}(?:rs\.?|inr|₹)?\s*([\d,]+\.?\d*)/i,
    /(?:invoice\s+)?total[^0-9-]{0,10}(?:rs\.?|inr|₹)?\s*([\d,]+\.?\d*)/i,
    /net\s+(?:amount|payable)[^0-9-]{0,10}(?:rs\.?|inr|₹)?\s*([\d,]+\.?\d*)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const n = Number(m[1].replace(/,/g, ''));
    if (isFinite(n) && n > 0) return n;
  }
  return 0;
};

// Everything above assembled — returns partial patch of PurchaseBills.emptyForm.
const heuristicParseBill = (rawText) => {
  const text = rawText.replace(/[ \t]+/g, ' ');
  const gstinMatch = text.match(GSTIN_RE);
  return {
    supplierGstin: gstinMatch ? gstinMatch[0] : '',
    supplierName: parseSupplierName(text),
    invoiceNumber: parseInvoiceNumber(text),
    date: parseDateFrom(text),
    grandTotal: parseGrandTotal(text),
    _rawText: rawText,
  };
};

export default function BillOCR({ onClose, onExtracted }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'ocr' | 'done' | 'error'
  const [progress, setProgress] = useState(0);
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState(null);
  const fileInputRef = useRef(null);

  const pickFile = (f) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      toast('Please upload an image (PNG, JPG, WebP).', 'warning');
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      toast('Image is over 8MB — please compress first (or take a smaller photo).', 'warning');
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setStatus('idle');
    setRawText('');
    setParsed(null);
    setProgress(0);
  };

  const runOCR = async () => {
    if (!file) return;
    setStatus('ocr');
    setProgress(0);
    try {
      // Dynamic import keeps tesseract's ~2MB core out of the main
      // bundle — only fetched when a user actually opens this modal.
      const Tesseract = await import('tesseract.js');
      const worker = await Tesseract.createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text' && typeof m.progress === 'number') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });
      const { data } = await worker.recognize(file);
      await worker.terminate();
      setRawText(data.text);
      const p = heuristicParseBill(data.text);
      setParsed(p);
      setStatus('done');
    } catch (err) {
      console.error('OCR failed:', err);
      toast('OCR failed — the image may be too blurry. Try a sharper photo.', 'error');
      setStatus('error');
    }
  };

  const applyToForm = () => {
    if (!parsed) return;
    onExtracted({
      supplierName: parsed.supplierName,
      supplierGstin: parsed.supplierGstin,
      invoiceNumber: parsed.invoiceNumber,
      date: parsed.date,
      grandTotal: parsed.grandTotal,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 780 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wand2 size={18} /> Import from bill image (OCR)
          </h3>
          <button className="icon-btn" onClick={onClose} title="Close"><X size={18} /></button>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 0, marginBottom: '1rem' }}>
          Upload a photo or scan of the supplier's invoice. We'll extract the
          GSTIN, invoice number, date and grand total. Line items still need
          to be entered manually — bill layouts vary too much for reliable
          auto-parsing. Everything runs in your browser, nothing is uploaded
          to a server.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: previewUrl ? '1fr 1fr' : '1fr', gap: '1rem' }}>
          {/* Left: file picker + preview */}
          <div>
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); pickFile(e.dataTransfer.files?.[0]); }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--border-color)', borderRadius: 8,
                padding: '1.25rem', textAlign: 'center', cursor: 'pointer',
                background: 'var(--bg-secondary)', minHeight: 120,
              }}>
              <Upload size={26} style={{ opacity: 0.6, marginBottom: 6 }} />
              <p style={{ margin: 0, fontSize: '0.85rem' }}>
                {file ? file.name : 'Click or drag a bill image here'}
              </p>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => pickFile(e.target.files?.[0])} />
            </div>
            {previewUrl && (
              <img src={previewUrl} alt="Bill preview"
                style={{ marginTop: 10, maxWidth: '100%', maxHeight: 300, border: '1px solid var(--border-color)', borderRadius: 4 }} />
            )}
            {file && status !== 'ocr' && (
              <button className="btn btn-primary" onClick={runOCR} style={{ marginTop: 10, width: '100%' }}>
                <Wand2 size={16} /> Extract fields
              </button>
            )}
            {status === 'ocr' && (
              <div style={{ marginTop: 10, textAlign: 'center', fontSize: '0.85rem' }}>
                <Loader size={16} className="spin" style={{ verticalAlign: '-3px', marginRight: 6 }} />
                Reading image… {progress}%
              </div>
            )}
          </div>

          {/* Right: extracted result */}
          {parsed && (
            <div style={{ background: 'var(--bg-secondary)', padding: '0.85rem', borderRadius: 6 }}>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>Extracted fields</h4>
              <FieldPreview label="Supplier" value={parsed.supplierName} onChange={v => setParsed(p => ({ ...p, supplierName: v }))} />
              <FieldPreview label="GSTIN" value={parsed.supplierGstin} onChange={v => setParsed(p => ({ ...p, supplierGstin: v }))} />
              <FieldPreview label="Invoice No." value={parsed.invoiceNumber} onChange={v => setParsed(p => ({ ...p, invoiceNumber: v }))} />
              <FieldPreview label="Date" value={parsed.date} onChange={v => setParsed(p => ({ ...p, date: v }))} type="date" />
              <FieldPreview label="Grand total" value={parsed.grandTotal || ''} onChange={v => setParsed(p => ({ ...p, grandTotal: Number(v) || 0 }))} type="number" />
              <details style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <summary style={{ cursor: 'pointer' }}>Raw OCR text</summary>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.7rem', maxHeight: 140, overflow: 'auto', marginTop: 4 }}>{rawText}</pre>
              </details>
              <button className="btn btn-primary" onClick={applyToForm} style={{ marginTop: 8, width: '100%' }}>
                Use these values
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldPreview({ label, value, onChange, type = 'text' }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>{label}</label>
      <input type={type} className="form-input" value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        style={{ fontSize: '0.82rem', padding: '0.3rem 0.5rem' }} />
    </div>
  );
}
