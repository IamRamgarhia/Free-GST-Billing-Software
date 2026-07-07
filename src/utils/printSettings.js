// ============================================================================
// Thermal Print Settings — app-wide defaults, stored in localStorage.
// Consumed by InvoicePreview (as fallback under per-invoice options) and
// PrintSettings.jsx (as the UI form state).
// ============================================================================

export const DEFAULT_PRINT_SETTINGS = {
  // ==== Thermal-only ====
  // Typography
  fontFamily: 'mono',    // 'mono' | 'sans'
  fontSize: 'medium',    // 'small' | 'medium' | 'large' | 'xlarge'
  fontWeight: 'bold',    // 'normal' | 'bold' | 'ultra'
  allCaps: false,

  // Layout
  lineSpacing: 'normal', // 'compact' | 'normal' | 'comfortable'
  headerAlign: 'center', // 'left' | 'center'
  contrast: 'normal',    // 'normal' | 'high' | 'ultra'

  // Content
  showHSN: true,
  showRateLine: true,
  showAmountWords: true,
  showUPI: true,
  qrSize: 'medium',
  showLogo: true,
  showBankDetails: true,

  // Footer
  footerMessage: 'Thank you for your business!',
  cutMark: true,
  feedLines: 2,

  // Header
  headerCaps: true,
  showTagline: false,
  tagline: '',

  // ============================================================
  // ==== v1.9.0 PDF & universal print features ==================
  // ============================================================
  // Every one below is TOGGLEABLE. Users pick which they want.

  // -- Auto-print --
  autoPrintOnSave: false,   // send to default printer immediately after Save & PDF Download

  // -- Watermark --
  watermarkEnabled: false,
  watermarkText: 'DUPLICATE', // 'PAID' | 'DUPLICATE' | 'DRAFT' | 'OVERDUE' | 'COPY' | (custom text)
  watermarkOpacity: 15,       // 0-100 (percent)
  watermarkAngle: -35,        // degrees; -35 is the diagonal classic
  watermarkFontSize: 90,      // pt

  // -- Multi-copy print (GST rule 48) --
  multiCopyEnabled: false,
  multiCopyCount: 3,          // 1|2|3 — Original / Duplicate / Triplicate
  multiCopyLabels: ['ORIGINAL FOR RECIPIENT', 'DUPLICATE FOR TRANSPORTER', 'TRIPLICATE FOR SUPPLIER'],

  // -- Page numbers + header on subsequent pages --
  pageNumbersEnabled: true,
  pageHeaderEnabled: true,    // shows business name at top of pages 2+

  // -- Print margins (mm) --
  marginTop: 0,      // 0 = no margin (existing behaviour). Users on printers with
  marginBottom: 0,   // built-in margins can dial these UP; letterhead users set them
  marginLeft: 0,     // to shift content away from pre-printed logo.
  marginRight: 0,

  // -- Font family (sheet PDFs) --
  pdfFontFamily: 'helvetica',  // 'helvetica' | 'times' | 'courier'

  // -- Barcode / QR of invoice number --
  invoiceBarcodeEnabled: false,   // barcode of invoice # (Code128-style, printed via jsPDF text)
  invoiceQrEnabled: false,        // QR of invoice # (or verify URL if configured)
  invoiceQrUrl: '',               // e.g. https://mycompany.com/verify/{invoice_number}

  // -- Digital signature --
  signatureImage: '',        // base64 data URL (uploaded in Print Settings)
  signatureName: '',         // "Authorized Signatory Name"
  signatureShow: true,       // show on invoice? (defaults to on)

  // -- T&C on separate page --
  termsSeparatePage: false,  // put terms + notes on their own page 2

  // -- Feedback / Review QR --
  feedbackQrEnabled: false,
  feedbackQrUrl: '',         // Google Reviews / feedback form / any URL
  feedbackQrLabel: 'Rate us · Give feedback',

  // -- Reprint indicator (automatic) --
  reprintLabelEnabled: true, // when true, a "REPRINT · Copy #N" badge appears on any invoice
                             // whose printedCount > 0 (based on bill.printedCount field)

  // ============================================================
  // v1.9.1 additions — all dynamic (on/off toggles)
  // ============================================================

  // -- Print quality (PDF file size / render sharpness trade-off) --
  pdfQuality: 'standard',    // 'draft' (email-friendly) | 'standard' (default) | 'hd' (archival)

  // -- Dual currency display (for foreign clients) --
  dualCurrencyEnabled: false,
  dualCurrencyCode: 'USD',   // 'USD' | 'EUR' | 'GBP' | 'AED' | 'SGD' | 'AUD' — the "≈" secondary
  dualCurrencyRate: 83,      // 1 INR = 1/rate secondary — user maintains manually (or per-invoice)
  dualCurrencyPosition: 'below', // 'below' (line under primary) | 'inline' (same line, in parens)

  // -- PDF template style (extends the existing modern/classic/minimal) --
  pdfTemplate: 'modern',     // 'modern' | 'classic' | 'minimal' | 'corporate' | 'minimalist'

  // -- Company letterhead --
  letterheadEnabled: false,
  letterheadImage: '',       // base64 data URL — full-page A4 background (renders behind content)
  letterheadOpacity: 100,    // 0-100 (typically 100 for pre-designed letterhead)
  letterheadHideHeader: true, // when using letterhead, most users hide the generated header block

  // -- Preview zoom (app-only, saved for user's preference) --
  previewZoom: 100,          // 50-200 percent

  // ============================================================
  // v1.9.2 — full user control over PDF colours + font scale
  // ============================================================
  // When userColorsEnabled = true, the following colours override any
  // template defaults. Users can tune every aspect of the visual output
  // without needing developer changes. Live preview updates instantly.
  userColorsEnabled: false,
  pdfPrimaryText: '#0f172a',    // main body text (dark)
  pdfMutedText: '#334155',      // secondary text (labels, addresses) — v1.9.2 default darkened from #64748b
  pdfAccent: '#1e40af',         // section labels + table header background
  pdfAccentText: '#ffffff',     // text on accent-coloured backgrounds
  pdfHeaderBg: '#f8fafc',       // invoice header block background (modern template)
  pdfDividerColor: '#334155',   // hairlines between sections (darkened default)

  // Font size scale multiplier — 0.8 to 1.4. Applied via CSS transform to the
  // whole invoice-preview-container, so everything scales proportionally.
  pdfFontScale: 1.0,            // 1.0 = default; 0.85 = compact; 1.15 = large

  // Print-mode text darkening — turn off if user has a modern high-quality
  // printer and prefers the on-screen greys.
  pdfDarkenOnPrint: true,       // when true, printing-mode class forces darker gray text
};

export function getPrintSettings() {
  try {
    const raw = localStorage.getItem('gst_printSettings');
    if (!raw) return { ...DEFAULT_PRINT_SETTINGS };
    return { ...DEFAULT_PRINT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PRINT_SETTINGS };
  }
}

export function savePrintSettings(settings) {
  try {
    localStorage.setItem('gst_printSettings', JSON.stringify(settings));
    return true;
  } catch { return false; }
}

// Sample invoice for the Test Print button — uses the user's real business
// profile when available so the receipt looks realistic on their printer.
export const buildSampleInvoice = (profile) => ({
  profile: profile || {
    businessName: 'Your Business Name',
    address: 'Sample Street, Sample City',
    city: 'Sample City', state: 'Maharashtra', pin: '400001',
    phone: '+91-9999999999',
    gstin: '27AAAAA0000A1Z5',
    country: 'India',
  },
  client: { name: 'SAMPLE CUSTOMER', phone: '+91-9876543210', gstin: '', country: 'India' },
  details: { invoiceNumber: 'TEST/PRINT/0001', invoiceDate: new Date().toISOString().split('T')[0], placeOfSupply: '' },
  items: [
    { name: 'Sample Product One', hsn: '4820', quantity: 2, unit: 'Pcs', rate: 100, taxPercent: 18, discount: 0, cessPercent: 0 },
    { name: 'Sample Product Two', hsn: '9987', quantity: 1, unit: 'Nos', rate: 250, taxPercent: 12, discount: 0, cessPercent: 0 },
    { name: 'Sample Service Item', hsn: '9983', quantity: 1, unit: 'Hrs', rate: 500, taxPercent: 18, discount: 0, cessPercent: 0 },
  ],
  totals: {
    subtotal: 950, totalDiscount: 0, taxableAmount: 950,
    cgst: 90, sgst: 90, igst: 0, cess: 0,
    tcsAmount: 0, tdsAmount: 0, roundOff: 0,
    total: 1130,
  },
  invoiceType: 'tax-invoice',
});
