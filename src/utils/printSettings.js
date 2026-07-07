// ============================================================================
// Thermal Print Settings — app-wide defaults, stored in localStorage.
// Consumed by InvoicePreview (as fallback under per-invoice options) and
// PrintSettings.jsx (as the UI form state).
// ============================================================================

export const DEFAULT_PRINT_SETTINGS = {
  // Typography
  fontFamily: 'mono',    // 'mono' | 'sans'
  fontSize: 'medium',    // 'small' | 'medium' | 'large' | 'xlarge'
  fontWeight: 'bold',    // 'normal' | 'bold' | 'ultra'
  allCaps: false,        // uppercase every text element (SMART BAZAAR style)

  // Layout
  lineSpacing: 'normal', // 'compact' | 'normal' | 'comfortable'
  headerAlign: 'center', // 'left' | 'center'
  contrast: 'normal',    // 'normal' | 'high' | 'ultra' — image filter

  // Content
  showHSN: true,
  showRateLine: true,
  showAmountWords: true,
  showUPI: true,
  qrSize: 'medium',      // 'small' | 'medium' | 'large'
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
