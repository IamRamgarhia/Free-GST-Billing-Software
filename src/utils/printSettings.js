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
  // v1.10.27 — default flipped from 'standard' to 'hd' after user report:
  // "make sure print is full 100% hd quality in pdf". HD uses PNG @ scale
  // capped at 6 (dpr × 2.5), which is 3-5× larger file than standard's
  // JPEG @ scale ≤ 4 but crisp on high-res prints. Users who prefer
  // email-friendly files can switch to 'standard' or 'draft' in Print
  // Settings.
  pdfQuality: 'hd',    // 'draft' (email-friendly) | 'standard' | 'hd' (default, crispest)

  // -- Dual currency display (for foreign clients) --
  dualCurrencyEnabled: false,
  dualCurrencyCode: 'USD',   // 'USD' | 'EUR' | 'GBP' | 'AED' | 'SGD' | 'AUD' — the "≈" secondary
  dualCurrencyRate: 83,      // 1 INR = 1/rate secondary — user maintains manually (or per-invoice)
  dualCurrencyPosition: 'below', // 'below' (line under primary) | 'inline' (same line, in parens)

  // -- PDF template style. Accepts 5 values but only 3 physical render
  // paths exist: `corporate` → classic + CSS class variant,
  // `minimalist` → minimal + CSS class variant. See InvoicePreview.jsx
  // `pdfStyleRaw` mapping (audit L8 comment fix). --
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
  pdfDarkenOnPrint: true,

  // ============================================================
  // v1.9.3 — Full user control. Every hardcoded string / format
  // / preset now overridable so no developer changes are ever
  // needed for personalisation. The "easiest tool to use"
  // philosophy: 55+ settings, all discoverable, all persistent.
  // ============================================================

  // -- Custom section labels (multi-language) --
  // Users can rename every visible label to match their brand or language.
  // Pre-loaded presets: English (default), Hindi, Tamil, Marathi, Bengali.
  // Users can override any individual label without picking a language preset.
  labelLanguage: 'en',           // 'en' | 'hi' | 'ta' | 'mr' | 'bn' | 'custom'
  labelBillTo: '',               // '' → use language preset; anything else → override
  labelShipTo: '',
  labelPlaceOfSupply: '',
  labelAmountInWords: '',
  labelBankDetails: '',
  labelTerms: '',
  labelNotes: '',
  labelAuthorizedSignatory: '',
  labelSubtotal: '',
  labelTotal: '',
  labelInvoice: '',              // "TAX INVOICE" title

  // -- Layout density --
  rowDensity: 'normal',          // 'compact' | 'normal' | 'comfortable'

  // -- Currency + Number formatting --
  currencyPosition: 'before',    // 'before' (₹100) | 'after' (100₹)
  numberFormat: 'indian',        // 'indian' (1,00,000) | 'western' (100,000) | 'european' (100.000,00)
  decimalPlaces: 2,              // 0 | 2 | 3 | 4

  // -- Date format --
  dateFormat: 'dd-mon-yyyy',     // 'dd-mon-yyyy' (02-Apr-2026) | 'dd-mm-yyyy' | 'mm-dd-yyyy' | 'yyyy-mm-dd' | 'dd-mmm-yyyy' | 'iso'

  // -- Watermark: custom text option --
  watermarkUseCustomText: false, // when true, watermarkCustomText overrides watermarkText preset
  watermarkCustomText: '',

  // -- Custom tax rate presets (user adds beyond 5/12/18/28) --
  // Additive to the built-in list. User adds/removes via UI.
  customTaxRates: [],            // [0.1, 0.25, 3, 7.5] etc.

  // -- Custom invoice extra fields --
  // v1.10.5 — NOT YET WIRED. Setting exists so a future consumer can
  // add it without a data migration; UI in PrintSettings was removed
  // (was configurable but never rendered on the invoice, per audit M25).
  customInvoiceFields: [],

  // -- Column widths (items table, sheet PDFs) --
  // v1.10.5 — NOT YET WIRED. See customInvoiceFields note above.
  columnWidths: {
    item: 35, hsn: 10, qty: 8, rate: 15, tax: 12, amount: 20,
  },

  // -- Saved custom PDF templates --
  // Each saved template snapshot is a full settings object under a user-given
  // name. Users tune → save as "Retail Template" → recall any time.
  savedTemplates: [],            // [{ name: 'Retail v1', settings: {...} }]

  // -- Setup / onboarding --
  onboardingComplete: false,     // set to true after user finishes the setup wizard

  // v1.9.13 — Tracks which design preset the user last clicked, so the
  // preset picker can highlight it correctly. Multiple presets share the
  // same pdfTemplate value, so pdfTemplate alone is ambiguous.
  activePresetId: '',            // '' | 'modern' | 'classic' | 'corporate' | 'minimalist' | 'colorful' | 'minimal' | 'enterprise' | 'itservices' | 'retail'

  // v1.10.10 — Per-invoice-type prefix overrides. Empty string = fall
  // back to the built-in default from `INVOICE_TYPES[type].prefix`.
  // Users can now brand each series independently: `RTL` for retail
  // tax invoices, `RPT` for repeat customers, `QTE` for quotes,
  // whatever fits their internal numbering. Report request:
  // "every type should have special code to starts with because it
  // will mismatch". Each type gets its own atomic counter (already
  // the case — the server-side counter is per-prefix), so switching
  // Tax Invoice → 'INV' to 'RTL' resets the counter for RTL.
  customPrefixes: {
    'tax-invoice': '',      // default 'INV'
    'proforma': '',         // default 'EST'
    'bill-of-supply': '',   // default 'BOS'
    'composition': '',      // default 'COMP'
    'credit-note': '',      // default 'CN'
    'delivery-challan': '', // default 'DC'
  },

  // v1.10.11 — Compact upper-header mode. Reduces the padding + spacing
  // in the header / parties / place-of-supply blocks so users can fit
  // more product rows on page 1 before the invoice spills to page 2.
  // Reported: "upper header portion till before product rows make it
  // more compact so other details can feed thr". Off by default so
  // existing users don't see their invoices unexpectedly restyled.
  headerCompact: false,

  // v1.10.11 — Thermal buffer-safe mode. Old thermal printers with
  // small internal buffers (< 128 KB is common on ₹800-₹2000 units)
  // get stuck when the browser sends a colour or high-DPI receipt.
  // Enabling this switches the thermal render to grayscale + smaller
  // font baseline so the transmitted image data drops sharply.
  // Reported: "some old printers will not stuck in b/w print. Because
  // in market low beffer size printer available".
  thermalBufferSafe: false,

  // ============================================================
  // v1.9.4 — Payment reminder auto-scheduling + accessibility opts
  // ============================================================
  // Reminders are advisory: when the notification centre polls upcoming
  // filings + low stock, it also checks overdue invoices and surfaces
  // them here. Users get a bell-badge count; clicking opens the affected
  // bill's WhatsApp share prefilled with a reminder message.
  reminderEnabled: true,             // consumed by notification bell (overdue count)
  // v1.10.5 — the three below are NOT YET WIRED. Setting shape kept so
  // a future notification-send integration doesn't need a data migration;
  // UI in PrintSettings was removed per audit M25.
  reminderDaysBeforeDue: 3,
  reminderDaysAfterOverdue: [1, 7, 14, 30],
  reminderTemplate: 'Hi {client}, this is a friendly reminder about invoice {invoice_number} for {amount} dated {invoice_date}. Kindly make the payment at your earliest convenience. Thank you!',
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

// ============================================================================
// v1.9.3 — Multi-language section labels
// Presets for major Indian languages. User can override any individual label
// via labelXxx field regardless of preset.
// ============================================================================
export const LABEL_PRESETS = {
  en: {
    billTo: 'BILL TO',
    shipTo: 'SHIP TO',
    placeOfSupply: 'PLACE OF SUPPLY',
    amountInWords: 'AMOUNT IN WORDS',
    bankDetails: 'BANK DETAILS',
    terms: 'TERMS & CONDITIONS',
    notes: 'NOTES',
    authorizedSignatory: 'Authorized Signatory',
    subtotal: 'Subtotal',
    total: 'Total',
    invoice: 'TAX INVOICE',
  },
  hi: {
    billTo: 'क्रेता (BILL TO)',
    shipTo: 'शिपिंग पता (SHIP TO)',
    placeOfSupply: 'आपूर्ति स्थान',
    amountInWords: 'शब्दों में राशि',
    bankDetails: 'बैंक विवरण',
    terms: 'नियम एवं शर्तें',
    notes: 'टिप्पणी',
    authorizedSignatory: 'अधिकृत हस्ताक्षरकर्ता',
    subtotal: 'उप-कुल',
    total: 'कुल',
    invoice: 'कर चालान',
  },
  ta: {
    billTo: 'விற்பனையாளர்',
    shipTo: 'அனுப்பும் முகவரி',
    placeOfSupply: 'விநியோக இடம்',
    amountInWords: 'சொற்களில் தொகை',
    bankDetails: 'வங்கி விவரங்கள்',
    terms: 'விதிமுறைகள்',
    notes: 'குறிப்புகள்',
    authorizedSignatory: 'அங்கீகரிக்கப்பட்ட கையொப்பம்',
    subtotal: 'மொத்தம்',
    total: 'மொத்தத்தொகை',
    invoice: 'வரி விலைப்பட்டியல்',
  },
  mr: {
    billTo: 'खरेदीदार',
    shipTo: 'शिपिंग पत्ता',
    placeOfSupply: 'पुरवठ्याचे ठिकाण',
    amountInWords: 'शब्दात रक्कम',
    bankDetails: 'बँक तपशील',
    terms: 'नियम व अटी',
    notes: 'नोट्स',
    authorizedSignatory: 'अधिकृत स्वाक्षरीकर्ता',
    subtotal: 'उप-एकूण',
    total: 'एकूण',
    invoice: 'कर चलन',
  },
  bn: {
    billTo: 'ক্রেতা',
    shipTo: 'শিপিং ঠিকানা',
    placeOfSupply: 'সরবরাহের স্থান',
    amountInWords: 'কথায় পরিমাণ',
    bankDetails: 'ব্যাংক বিবরণ',
    terms: 'শর্তাবলী',
    notes: 'নোট',
    authorizedSignatory: 'অনুমোদিত স্বাক্ষরকারী',
    subtotal: 'উপ-মোট',
    total: 'মোট',
    invoice: 'কর চালান',
  },
};

// Resolve a label — priority: user override → language preset → English default
export function getLabel(settings, key) {
  const overrideKey = 'label' + key.charAt(0).toUpperCase() + key.slice(1);
  if (settings[overrideKey]) return settings[overrideKey];
  const preset = LABEL_PRESETS[settings.labelLanguage] || LABEL_PRESETS.en;
  return preset[key] || LABEL_PRESETS.en[key] || '';
}

// ============================================================================
// v1.9.3 — Number + date formatting
// ============================================================================
export function formatNumber(n, settings) {
  const num = Number(n) || 0;
  const decimals = Number(settings.decimalPlaces ?? 2);
  const fmt = settings.numberFormat || 'indian';
  const abs = Math.abs(num);
  const rounded = abs.toFixed(decimals);

  if (fmt === 'western') {
    const [int, dec] = rounded.split('.');
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (num < 0 ? '-' : '') + (dec ? `${grouped}.${dec}` : grouped);
  }
  if (fmt === 'european') {
    const [int, dec] = rounded.split('.');
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (num < 0 ? '-' : '') + (dec ? `${grouped},${dec}` : grouped);
  }
  // indian (default): 1,00,000 grouping
  const [int, dec] = rounded.split('.');
  const last3 = int.slice(-3);
  const rest = int.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
  return (num < 0 ? '-' : '') + (dec ? `${grouped}.${dec}` : grouped);
}

export function formatCurrencyEx(n, currencyCode, settings) {
  const symbolMap = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', SGD: 'S$', AUD: 'A$', JPY: '¥', CAD: 'C$' };
  const sym = symbolMap[currencyCode] || currencyCode;
  const num = formatNumber(n, settings);
  return settings.currencyPosition === 'after' ? `${num}${sym}` : `${sym}${num}`;
}

export function formatDate(dateStr, settings) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  const fmt = settings.dateFormat || 'dd-mon-yyyy';
  switch (fmt) {
    case 'dd-mm-yyyy': return `${dd}/${mm}/${yyyy}`;
    case 'mm-dd-yyyy': return `${mm}/${dd}/${yyyy}`;
    case 'yyyy-mm-dd': return `${yyyy}-${mm}-${dd}`;
    case 'iso': return d.toISOString().slice(0, 10);
    case 'dd-mmm-yyyy': return `${dd}-${mon}-${yyyy}`;
    case 'dd-mon-yyyy':
    default: return `${dd} ${mon} ${yyyy}`;
  }
}

// ============================================================================
// v1.9.3 — Business type presets (one-click configuration)
// Each preset patches printSettings with a common baseline for that vertical.
// User can still tweak everything afterwards.
// ============================================================================
export const BUSINESS_PRESETS = {
  retail_shop: {
    label: '🛒 Retail Shop / Kirana',
    hint: 'Small retail counter · thermal receipt · quick print',
    patch: {
      pdfTemplate: 'modern',
      fontSize: 'medium', fontWeight: 'bold', allCaps: true,
      autoPrintOnSave: true,
      showRateLine: true, showHSN: false,
      footerMessage: 'Thank you! Visit again!',
      cutMark: true, feedLines: 2,
      labelLanguage: 'en',
    },
  },
  freelancer: {
    label: '💻 Freelancer / Consultant',
    hint: 'A4 PDF · monthly retainer · professional feel',
    patch: {
      pdfTemplate: 'minimalist',
      showHSN: true, showAmountWords: true, showRateLine: true,
      pageNumbersEnabled: true, pageHeaderEnabled: true,
      pdfFontFamily: 'helvetica',
      pdfQuality: 'standard',
      labelLanguage: 'en',
    },
  },
  restaurant: {
    label: '🍽 Restaurant / Cafe / Bar',
    hint: '80mm thermal · compact receipt · UPI QR prominent',
    patch: {
      pdfTemplate: 'modern',
      fontSize: 'medium', fontWeight: 'bold', allCaps: false,
      autoPrintOnSave: true,
      showHSN: false, showRateLine: false, showAmountWords: false,
      showUPI: true, qrSize: 'large',
      cutMark: true, feedLines: 3,
      footerMessage: 'Thanks for dining with us!',
    },
  },
  wholesale: {
    label: '📦 Wholesale / Trading',
    hint: 'A5 landscape · multi-copy · GST rule 48 compliant',
    patch: {
      pdfTemplate: 'classic',
      multiCopyEnabled: true, multiCopyCount: 3,
      showHSN: true, showAmountWords: true,
      pdfDarkenOnPrint: true,
      pdfQuality: 'standard',
      labelLanguage: 'en',
    },
  },
  manufacturer: {
    label: '🏭 Manufacturing',
    hint: 'A4 · detailed items · e-Way Bill ready · multi-page headers',
    patch: {
      pdfTemplate: 'corporate',
      showHSN: true, showAmountWords: true, showRateLine: true,
      pageNumbersEnabled: true, pageHeaderEnabled: true,
      invoiceQrEnabled: true,
      multiCopyEnabled: true, multiCopyCount: 3,
    },
  },
  service: {
    label: '🛠 Service / Repair Shop',
    hint: 'A5 portrait · single copy · signature line prominent',
    patch: {
      pdfTemplate: 'classic',
      showHSN: false, showAmountWords: true,
      signatureShow: true,
      pdfFontFamily: 'helvetica',
      labelLanguage: 'en',
    },
  },
};

export function applyBusinessPreset(currentSettings, presetKey) {
  const preset = BUSINESS_PRESETS[presetKey];
  if (!preset) return currentSettings;
  return { ...currentSettings, ...preset.patch };
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
