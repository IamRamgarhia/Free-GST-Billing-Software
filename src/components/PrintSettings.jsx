import { useState, useEffect, useRef } from 'react';
import { Printer, TestTube, RotateCcw, Info } from 'lucide-react';
import { toast } from './Toast';
import InvoicePreview from './InvoicePreview';
import { getProfile } from '../store';
import { DEFAULT_PRINT_SETTINGS, getPrintSettings, savePrintSettings, buildSampleInvoice } from '../utils/printSettings';

// ============================================================================
// Print Settings — app-wide defaults for the thermal printer render.
// Persisted to localStorage key `gst_printSettings`. InvoicePreview merges
// these with per-invoice overrides from invoiceOptions.
//
// Per user feedback (v1.8.3): existing thermal output had inconsistent
// darkness (some gray, some black), Large font size didn't scale properly,
// and users need dedicated controls to match their specific printer.
// Reference receipts from SMART BAZAAR / Reliance show the ideal style:
//   ALL CAPS · BOLD everywhere · consistent dark ink · monospace font
// ============================================================================

export default function PrintSettings() {
  const [settings, setSettings] = useState(getPrintSettings);
  const [showTestPreview, setShowTestPreview] = useState(false);
  const [profile, setProfile] = useState(null);
  const previewRef = useRef(null);

  useEffect(() => { getProfile().then(setProfile).catch(() => {}); }, []);

  const set = (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    savePrintSettings(next);
  };

  const reset = () => {
    setSettings({ ...DEFAULT_PRINT_SETTINGS });
    savePrintSettings({ ...DEFAULT_PRINT_SETTINGS });
    toast('Print settings reset to defaults', 'info');
  };

  const runTestPrint = async () => {
    // Render a sample invoice with current settings, then trigger browser print.
    setShowTestPreview(true);
    // Wait for React to render the preview + fonts to load, then generate PDF.
    setTimeout(async () => {
      try {
        const { jsPDF } = await import('jspdf');
        const html2canvas = (await import('html2canvas')).default;
        if (!previewRef.current) { toast('Preview not ready', 'error'); return; }

        const canvas = await html2canvas(previewRef.current, {
          scale: Math.max(2, (window.devicePixelRatio || 1) * 1.5),
          backgroundColor: '#ffffff', useCORS: true, logging: false,
        });
        const width = 80; // 80mm thermal width for the test print
        const height = (canvas.height * width) / canvas.width;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [width, Math.max(150, height)] });
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, width, height, undefined, 'FAST');

        // Print via hidden iframe (same pattern as invoice direct-print)
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        let frame = document.getElementById('fgsb-print-frame');
        if (!frame) {
          frame = document.createElement('iframe');
          frame.id = 'fgsb-print-frame';
          frame.style.cssText = 'position:fixed;left:-99999px;top:-99999px;width:0;height:0;border:0;';
          document.body.appendChild(frame);
        }
        frame.src = url;
        frame.onload = () => {
          try { frame.contentWindow.focus(); frame.contentWindow.print(); }
          catch { window.open(url, '_blank'); }
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        };
        toast('Test print sent to your default printer', 'success');
      } catch (e) {
        console.error('Test print failed', e);
        toast('Test print failed — try Download PDF instead', 'error');
      }
    }, 300);
  };

  // Build the invoiceOptions that flows into the InvoicePreview for the test
  // preview. All the user's chosen print settings map into the thermal-specific
  // invoiceOptions fields that InvoicePreview already reads.
  const previewInvoiceOptions = {
    paperSize: 'thermal80',
    showGST: true,
    showBankDetails: settings.showBankDetails,
    showUPI: settings.showUPI,
    showAmountWords: settings.showAmountWords,
    showTerms: false, showNotes: false,
    thermalFontSize: settings.fontSize,
    thermalCompact: !settings.showRateLine && !settings.showHSN,
    thermalCutMark: settings.cutMark,
    // Custom fields wired in the InvoicePreview thermal render
    thermalFontFamily: settings.fontFamily,
    thermalFontWeight: settings.fontWeight,
    thermalAllCaps: settings.allCaps,
    thermalLineSpacing: settings.lineSpacing,
    thermalContrast: settings.contrast,
    thermalHeaderAlign: settings.headerAlign,
    thermalHeaderCaps: settings.headerCaps,
    thermalShowLogo: settings.showLogo,
    thermalShowHSN: settings.showHSN,
    thermalShowRate: settings.showRateLine,
    thermalQrSize: settings.qrSize,
    thermalFooterMessage: settings.footerMessage,
    thermalFeedLines: settings.feedLines,
    thermalTagline: settings.showTagline ? settings.tagline : '',
  };

  const sample = buildSampleInvoice(profile);

  return (
    <div className="glass-panel p-6 mb-6">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h3 className="section-title" style={{ marginTop: 0, marginBottom: '0.25rem' }}>
            <Printer size={18} style={{ display: 'inline', verticalAlign: -3, marginRight: 6 }} />
            Thermal Printer Settings
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
            App-wide defaults for the thermal receipt template. Each invoice can override these in its own Customize panel.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" style={{ fontSize: '0.82rem' }} onClick={reset}>
            <RotateCcw size={14} /> Reset defaults
          </button>
          <button className="btn btn-primary" style={{ fontSize: '0.82rem' }} onClick={runTestPrint}>
            <TestTube size={14} /> Test Print
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1.25rem' }}>
        {/* TYPOGRAPHY */}
        <SettingGroup title="Typography">
          <SelectRow label="Font family" value={settings.fontFamily} onChange={v => set({ fontFamily: v })}
            options={[
              ['mono', 'Monospace (Courier) — thermal-optimized'],
              ['sans', 'Sans-serif (Arial-like)'],
            ]}
            hint="Monospace prints crisper on most thermal printers." />
          <SelectRow label="Font size" value={settings.fontSize} onChange={v => set({ fontSize: v })}
            options={[
              ['small', 'Small (fits more per receipt)'],
              ['medium', 'Medium (recommended)'],
              ['large', 'Large'],
              ['xlarge', 'Extra Large (easier for older customers)'],
            ]} />
          <SelectRow label="Font weight" value={settings.fontWeight} onChange={v => set({ fontWeight: v })}
            options={[
              ['normal', 'Normal'],
              ['bold', 'Bold (recommended)'],
              ['ultra', 'Ultra bold (darkest print)'],
            ]}
            hint="Thermal print heads render bold weights much darker than normal — pick bold or ultra for consistent legibility." />
          <ToggleRow label="ALL CAPS mode" value={settings.allCaps} onChange={v => set({ allCaps: v })}
            hint="Renders every text element in UPPERCASE — matches the SMART BAZAAR / Reliance receipt style. Best for high legibility." />
        </SettingGroup>

        {/* LAYOUT */}
        <SettingGroup title="Layout">
          <SelectRow label="Line spacing" value={settings.lineSpacing} onChange={v => set({ lineSpacing: v })}
            options={[
              ['compact', 'Compact (save paper)'],
              ['normal', 'Normal'],
              ['comfortable', 'Comfortable (easier to read)'],
            ]} />
          <SelectRow label="Header alignment" value={settings.headerAlign} onChange={v => set({ headerAlign: v })}
            options={[
              ['center', 'Center (default)'],
              ['left', 'Left-aligned'],
            ]} />
          <SelectRow label="Print contrast" value={settings.contrast} onChange={v => set({ contrast: v })}
            options={[
              ['normal', 'Normal'],
              ['high', 'High (recommended for old printers)'],
              ['ultra', 'Ultra — darkest'],
            ]}
            hint="Applies grayscale + contrast filter to logo / QR so faded prints come out darker." />
          <ToggleRow label="Force ALL CAPS in header" value={settings.headerCaps} onChange={v => set({ headerCaps: v })}
            hint="Business name always uppercase (independent of ALL CAPS mode)." />
        </SettingGroup>

        {/* CONTENT */}
        <SettingGroup title="Content">
          <ToggleRow label="Show business logo" value={settings.showLogo} onChange={v => set({ showLogo: v })} />
          <ToggleRow label="Show HSN code per item" value={settings.showHSN} onChange={v => set({ showHSN: v })}
            hint="Required for GST compliance if you're printing tax invoices. Turn off for informal counter receipts." />
          <ToggleRow label='Show "Qty × Rate" line per item' value={settings.showRateLine} onChange={v => set({ showRateLine: v })} />
          <ToggleRow label="Show amount in words" value={settings.showAmountWords} onChange={v => set({ showAmountWords: v })} />
          <ToggleRow label="Show bank details" value={settings.showBankDetails} onChange={v => set({ showBankDetails: v })} />
          <ToggleRow label="Show UPI QR code" value={settings.showUPI} onChange={v => set({ showUPI: v })} />
          {settings.showUPI && (
            <SelectRow label="UPI QR size" value={settings.qrSize} onChange={v => set({ qrSize: v })}
              options={[
                ['small', 'Small (60 × 60 px)'],
                ['medium', 'Medium (90 × 90 px)'],
                ['large', 'Large (120 × 120 px)'],
              ]} />
          )}
        </SettingGroup>

        {/* FOOTER */}
        <SettingGroup title="Footer">
          <TextRow label="Custom footer message" value={settings.footerMessage} onChange={v => set({ footerMessage: v })}
            placeholder="Thank you for your business!"
            hint='Appears above the cut mark. Leave blank to hide.' />
          <ToggleRow label='Show cut mark ("✂ cut here")' value={settings.cutMark} onChange={v => set({ cutMark: v })}
            hint="For thermal printers without auto-cutters. Turn off if your printer feeds paper automatically." />
          <SelectRow label="Feed lines after cut" value={String(settings.feedLines)} onChange={v => set({ feedLines: parseInt(v, 10) })}
            options={[['0', 'No extra feed'], ['1', '1 line'], ['2', '2 lines (default)'], ['3', '3 lines'], ['4', '4 lines'], ['6', '6 lines']]}
            hint="Extra blank lines after the cut mark so the tear is clean." />
          <ToggleRow label="Show tagline" value={settings.showTagline} onChange={v => set({ showTagline: v })}
            hint="Optional tagline printed below business name." />
          {settings.showTagline && (
            <TextRow label="Tagline text" value={settings.tagline} onChange={v => set({ tagline: v })}
              placeholder="e.g. Fresh & Local Since 2010" />
          )}
        </SettingGroup>
      </div>

      {/* ============================================================ */}
      {/* PDF & UNIVERSAL PRINT FEATURES (v1.9.0) */}
      {/* ============================================================ */}
      <div style={{ marginTop: '1.75rem', padding: '1rem 1.25rem', background: 'var(--bg-secondary)', borderRadius: 8 }}>
        <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: 'var(--primary)' }}>
          📄 PDF & universal print features
        </h4>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
          Applies to A4 / A5 / Letter / Legal / thermal — every option here is dynamic (turn on / off any time).
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>

          {/* AUTO-PRINT */}
          <SettingGroup title="Auto-print">
            <ToggleRow label="Auto-print on save" value={settings.autoPrintOnSave} onChange={v => set({ autoPrintOnSave: v })}
              hint="Send to your default printer immediately after Save & Download PDF. Perfect for POS counters — no manual click needed." />
          </SettingGroup>

          {/* WATERMARK */}
          <SettingGroup title="Watermark">
            <ToggleRow label="Show watermark" value={settings.watermarkEnabled} onChange={v => set({ watermarkEnabled: v })}
              hint="Big diagonal stamp across the PDF (e.g. PAID / DUPLICATE / DRAFT)." />
            {settings.watermarkEnabled && (
              <>
                <SelectRow label="Watermark text" value={settings.watermarkText} onChange={v => set({ watermarkText: v })}
                  options={[
                    ['PAID', 'PAID'], ['DUPLICATE', 'DUPLICATE'], ['DRAFT', 'DRAFT'],
                    ['OVERDUE', 'OVERDUE'], ['COPY', 'COPY'], ['ORIGINAL', 'ORIGINAL'],
                    ['CANCELLED', 'CANCELLED'], ['REPRINT', 'REPRINT'],
                  ]} />
                <SelectRow label="Opacity" value={String(settings.watermarkOpacity)} onChange={v => set({ watermarkOpacity: parseInt(v, 10) })}
                  options={[['5', 'Very faint (5%)'], ['10', 'Faint (10%)'], ['15', 'Medium (15%)'], ['25', 'Strong (25%)'], ['40', 'Very strong (40%)']]} />
              </>
            )}
          </SettingGroup>

          {/* MULTI-COPY */}
          <SettingGroup title="Multi-copy (GST rule 48)">
            <ToggleRow label="Print multiple copies with labels" value={settings.multiCopyEnabled} onChange={v => set({ multiCopyEnabled: v })}
              hint="Prints your invoice N times with corner labels (ORIGINAL FOR RECIPIENT / DUPLICATE FOR TRANSPORTER / etc.). GST rule 48 requires 3 copies for goods, 2 for services." />
            {settings.multiCopyEnabled && (
              <SelectRow label="Number of copies" value={String(settings.multiCopyCount)} onChange={v => set({ multiCopyCount: parseInt(v, 10) })}
                options={[['2', '2 (Original + Duplicate — services)'], ['3', '3 (Original + Duplicate + Triplicate — goods)']]} />
            )}
          </SettingGroup>

          {/* PAGE NUMBERS + HEADER */}
          <SettingGroup title="Multi-page invoices">
            <ToggleRow label="Page numbers on every page" value={settings.pageNumbersEnabled} onChange={v => set({ pageNumbersEnabled: v })}
              hint='Shows "Page 2 of 5" bottom-right on pages 2+.' />
            <ToggleRow label="Business name header on pages 2+" value={settings.pageHeaderEnabled} onChange={v => set({ pageHeaderEnabled: v })}
              hint="Repeats your business name at the top so multi-page invoices look professional." />
          </SettingGroup>

          {/* MARGINS */}
          <SettingGroup title="Print margins (mm)">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
              <NumInput label="Top" value={settings.marginTop} onChange={v => set({ marginTop: v })} />
              <NumInput label="Bottom" value={settings.marginBottom} onChange={v => set({ marginBottom: v })} />
              <NumInput label="Left" value={settings.marginLeft} onChange={v => set({ marginLeft: v })} />
              <NumInput label="Right" value={settings.marginRight} onChange={v => set({ marginRight: v })} />
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '3px 0 0' }}>
              For users printing on pre-printed letterhead — shift content down to avoid your logo, or in from the edge to fit binding.
            </p>
          </SettingGroup>

          {/* BARCODE + QR */}
          <SettingGroup title="Verification codes">
            <ToggleRow label="Invoice number as QR" value={settings.invoiceQrEnabled} onChange={v => set({ invoiceQrEnabled: v })}
              hint="Prints a QR of the invoice number (or verification URL if set below) in the bottom-right corner." />
            {settings.invoiceQrEnabled && (
              <TextRow label="Verification URL (optional)" value={settings.invoiceQrUrl} onChange={v => set({ invoiceQrUrl: v })}
                placeholder="https://mycompany.com/verify/{invoice_number}"
                hint="{invoice_number} gets replaced with the actual invoice #. Leave blank to encode just the number." />
            )}
            <ToggleRow label="Invoice number as barcode text" value={settings.invoiceBarcodeEnabled} onChange={v => set({ invoiceBarcodeEnabled: v })}
              hint="Prints the invoice number in large monospace at the bottom-left for warehouse scanning / filing." />
          </SettingGroup>

          {/* FEEDBACK QR */}
          <SettingGroup title="Customer feedback QR">
            <ToggleRow label="Feedback / review QR" value={settings.feedbackQrEnabled} onChange={v => set({ feedbackQrEnabled: v })}
              hint="Adds a QR at the bottom-left of the PDF that opens a URL — Google Reviews, feedback form, WhatsApp chat, anything you want." />
            {settings.feedbackQrEnabled && (
              <>
                <TextRow label="URL to encode" value={settings.feedbackQrUrl} onChange={v => set({ feedbackQrUrl: v })}
                  placeholder="e.g. https://g.page/r/YOUR_ID/review" />
                <TextRow label="Label above QR" value={settings.feedbackQrLabel} onChange={v => set({ feedbackQrLabel: v })}
                  placeholder="Rate us · Give feedback" />
              </>
            )}
          </SettingGroup>

          {/* DIGITAL SIGNATURE */}
          <SettingGroup title="Digital signature">
            <ToggleRow label="Show signature on invoice" value={settings.signatureShow} onChange={v => set({ signatureShow: v })} />
            {settings.signatureShow && (
              <>
                {settings.signatureImage ? (
                  <>
                    <div style={{ padding: '0.5rem', background: '#fff', borderRadius: 4, textAlign: 'center', marginBottom: '0.4rem' }}>
                      <img src={settings.signatureImage} alt="signature" style={{ maxHeight: 60, maxWidth: '100%' }} />
                    </div>
                    <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                      onClick={() => set({ signatureImage: '' })}>
                      Remove signature
                    </button>
                  </>
                ) : (
                  <>
                    <label style={{ fontSize: '0.78rem', display: 'block', marginBottom: 3 }}>Upload signature (PNG / JPG)</label>
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 2 * 1024 * 1024) { toast('Image too large (max 2MB)', 'warning'); return; }
                        const reader = new FileReader();
                        reader.onload = (ev) => set({ signatureImage: ev.target.result });
                        reader.readAsDataURL(file);
                      }}
                      style={{ fontSize: '0.78rem' }} />
                  </>
                )}
                <TextRow label="Signatory name" value={settings.signatureName} onChange={v => set({ signatureName: v })}
                  placeholder="e.g. Rakesh Kumar · Director"
                  hint="Falls back to business name if left blank." />
              </>
            )}
          </SettingGroup>

          {/* T&C SEPARATE PAGE */}
          <SettingGroup title="Terms &amp; Conditions">
            <ToggleRow label="Print T&amp;C on a separate page" value={settings.termsSeparatePage} onChange={v => set({ termsSeparatePage: v })}
              hint="For long terms — puts them on page 2 instead of squishing on page 1. Only affects invoices with T&amp;C enabled." />
          </SettingGroup>

          {/* FONT FAMILY (PDF) */}
          <SettingGroup title="PDF font family">
            <SelectRow label="Font used in generated PDFs" value={settings.pdfFontFamily} onChange={v => set({ pdfFontFamily: v })}
              options={[
                ['helvetica', 'Helvetica (default, cleanest)'],
                ['times', 'Times New Roman (traditional / formal)'],
                ['courier', 'Courier (monospace / retro / receipt style)'],
              ]}
              hint="Applies to the letterhead, table, and totals. Affects sheet formats (A4/A5/Letter/Legal); thermal has its own font setting above." />
          </SettingGroup>

          {/* REPRINT INDICATOR */}
          <SettingGroup title="Reprint tracking">
            <ToggleRow label="Show REPRINT badge on reprints" value={settings.reprintLabelEnabled} onChange={v => set({ reprintLabelEnabled: v })}
              hint="Automatic red badge in the top-left of the PDF when an invoice has been printed before. Tracks how many times each bill was printed." />
          </SettingGroup>

          {/* PRINT QUALITY */}
          <SettingGroup title="PDF quality vs file size">
            <SelectRow label="Print quality" value={settings.pdfQuality} onChange={v => set({ pdfQuality: v })}
              options={[
                ['draft', 'Draft — smallest file (email-friendly)'],
                ['standard', 'Standard — default balance'],
                ['hd', 'HD — archival quality (largest file)'],
              ]}
              hint="Draft = ~50% smaller PDFs, fine for emailing. HD = crisper text at 100% zoom, larger file, better for physical archive." />
          </SettingGroup>

          {/* DUAL CURRENCY (foreign clients) */}
          <SettingGroup title="Dual currency display">
            <ToggleRow label="Show foreign-currency equivalent" value={settings.dualCurrencyEnabled} onChange={v => set({ dualCurrencyEnabled: v })}
              hint="For INR invoices to foreign clients, shows the total in a second currency next to the ₹ amount. Uses YOUR manually set rate — no live conversion." />
            {settings.dualCurrencyEnabled && (
              <>
                <SelectRow label="Secondary currency" value={settings.dualCurrencyCode} onChange={v => set({ dualCurrencyCode: v })}
                  options={[
                    ['USD', 'USD ($)'], ['EUR', 'EUR (€)'], ['GBP', 'GBP (£)'],
                    ['AED', 'AED (د.إ)'], ['SGD', 'SGD (S$)'], ['AUD', 'AUD (A$)'], ['JPY', 'JPY (¥)'],
                  ]} />
                <NumInput label={`Rate (1 ${settings.dualCurrencyCode} = ? INR)`} value={settings.dualCurrencyRate}
                  onChange={v => set({ dualCurrencyRate: v })} min={0.01} max={10000} />
                <SelectRow label="Display position" value={settings.dualCurrencyPosition} onChange={v => set({ dualCurrencyPosition: v })}
                  options={[
                    ['below', 'On a line below the ₹ amount'],
                    ['inline', 'Inline in parentheses'],
                  ]} />
              </>
            )}
          </SettingGroup>

          {/* COMPANY LETTERHEAD */}
          <SettingGroup title="Company letterhead">
            <ToggleRow label="Use pre-printed letterhead image" value={settings.letterheadEnabled} onChange={v => set({ letterheadEnabled: v })}
              hint="Upload your own designed letterhead as a full-page background. Invoice content prints on top. Best for businesses with formal branded stationery." />
            {settings.letterheadEnabled && (
              <>
                {settings.letterheadImage ? (
                  <>
                    <div style={{ padding: '0.5rem', background: '#fff', borderRadius: 4, textAlign: 'center', marginBottom: '0.4rem' }}>
                      <img src={settings.letterheadImage} alt="letterhead" style={{ maxHeight: 100, maxWidth: '100%' }} />
                    </div>
                    <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                      onClick={() => set({ letterheadImage: '' })}>
                      Remove letterhead
                    </button>
                  </>
                ) : (
                  <>
                    <label style={{ fontSize: '0.78rem', display: 'block', marginBottom: 3 }}>Upload letterhead (PNG / JPG, A4 recommended)</label>
                    <input type="file" accept="image/png,image/jpeg,image/webp"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 3 * 1024 * 1024) { toast('Image too large (max 3MB)', 'warning'); return; }
                        const reader = new FileReader();
                        reader.onload = (ev) => set({ letterheadImage: ev.target.result });
                        reader.readAsDataURL(file);
                      }}
                      style={{ fontSize: '0.78rem' }} />
                  </>
                )}
                <ToggleRow label="Hide invoice header block" value={settings.letterheadHideHeader} onChange={v => set({ letterheadHideHeader: v })}
                  hint="When letterhead already has your business info, hide the generated header block to avoid duplication." />
              </>
            )}
          </SettingGroup>

          {/* PDF TEMPLATE STYLE */}
          <SettingGroup title="PDF template style (visual design)">
            <SelectRow label="Template" value={settings.pdfTemplate} onChange={v => set({ pdfTemplate: v })}
              options={[
                ['modern', 'Modern (colorful header · default)'],
                ['classic', 'Classic (professional / conservative)'],
                ['minimal', 'Minimal (clean / whitespace)'],
                ['corporate', 'Corporate (formal blue/navy)'],
                ['minimalist', 'Minimalist (grayscale + Inter)'],
              ]}
              hint="Changes the header block and table styling of the A4/A5 PDF. Thermal receipts use their own compact template." />
          </SettingGroup>

          {/* v1.9.2 — DARKEN ON PRINT */}
          <SettingGroup title="Print darkness">
            <ToggleRow label="Force darker text on printed PDF" value={settings.pdfDarkenOnPrint} onChange={v => set({ pdfDarkenOnPrint: v })}
              hint="Fixes light-gray labels + addresses fading on paper printers. Applies automatically when generating the PDF (screen view is unchanged). Turn off if your printer already prints greys crisply." />
          </SettingGroup>

          {/* v1.9.2 — FONT SIZE SCALE */}
          <SettingGroup title="PDF font scale">
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>
              Overall size: <strong>{Math.round((settings.pdfFontScale || 1) * 100)}%</strong>
            </label>
            <input type="range" min="80" max="140" step="5"
              value={Math.round((settings.pdfFontScale || 1) * 100)}
              onChange={e => set({ pdfFontScale: parseInt(e.target.value, 10) / 100 })}
              style={{ width: '100%', accentColor: 'var(--primary)' }} />
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '3px 0 0' }}>
              80% = compact (fits more per page) · 100% = default · 140% = large. Scales the entire PDF proportionally.
            </p>
          </SettingGroup>

        </div>
      </div>

      {/* ============================================================ */}
      {/* v1.9.2 — PDF STYLE EDITOR (full color control) */}
      {/* ============================================================ */}
      <div style={{ marginTop: '1.5rem', padding: '1rem 1.25rem', background: 'var(--bg-secondary)', borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--primary)' }}>
              🎨 PDF Style Editor — full control over every colour
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
              Match your brand. Every colour you change updates the live preview instantly and gets baked into your PDFs.
            </p>
          </div>
          <ToggleRow label="Use custom colours" value={settings.userColorsEnabled} onChange={v => set({ userColorsEnabled: v })} />
        </div>

        {settings.userColorsEnabled && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
            <ColorRow label="Primary text" value={settings.pdfPrimaryText || '#0f172a'} onChange={v => set({ pdfPrimaryText: v })}
              hint="Main body text — client name, item names, totals." />
            <ColorRow label="Muted text" value={settings.pdfMutedText || '#334155'} onChange={v => set({ pdfMutedText: v })}
              hint="Labels, addresses, meta info (Date, Invoice #)." />
            <ColorRow label="Accent colour" value={settings.pdfAccent || '#1e40af'} onChange={v => set({ pdfAccent: v })}
              hint="Section titles + table header background." />
            <ColorRow label="Accent text" value={settings.pdfAccentText || '#ffffff'} onChange={v => set({ pdfAccentText: v })}
              hint="Text on the accent colour (usually white on a coloured header)." />
            <ColorRow label="Header background" value={settings.pdfHeaderBg || '#f8fafc'} onChange={v => set({ pdfHeaderBg: v })}
              hint="Header block behind the business name / invoice title." />
            <ColorRow label="Divider lines" value={settings.pdfDividerColor || '#334155'} onChange={v => set({ pdfDividerColor: v })}
              hint="Hairlines between sections + table row borders." />
            <div style={{ gridColumn: '1 / -1' }}>
              <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                onClick={() => set({
                  pdfPrimaryText: '#0f172a', pdfMutedText: '#334155',
                  pdfAccent: '#1e40af', pdfAccentText: '#ffffff',
                  pdfHeaderBg: '#f8fafc', pdfDividerColor: '#334155',
                })}>
                Reset colours to defaults
              </button>
            </div>
          </div>
        )}
      </div>

      {/* LIVE PREVIEW */}
      <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <strong style={{ fontSize: '0.9rem' }}>
            <Info size={14} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />
            Live preview
          </strong>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sample invoice · 80mm thermal</span>
        </div>
        <div style={{ overflow: 'auto', maxHeight: '600px', background: '#fff', padding: '1rem', borderRadius: 6 }}>
          <InvoicePreview
            ref={previewRef}
            profile={sample.profile}
            client={sample.client}
            details={sample.details}
            items={sample.items}
            totals={sample.totals}
            invoiceType={sample.invoiceType}
            options={previewInvoiceOptions}
            customTerms=""
            customNotes=""
            extraSections={[]}
          />
        </div>
      </div>

      {/* Hidden preview for the actual test-print rendering (may need
          a bigger scale / different container than the on-screen preview). */}
      {showTestPreview && null}
    </div>
  );
}

// ---- small building blocks -------------------------------------------------

function SettingGroup({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.6rem' }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        {children}
      </div>
    </div>
  );
}

function ToggleRow({ label, value, onChange, hint }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem' }}>
      <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)}
        style={{ marginTop: 2, accentColor: 'var(--primary)' }} />
      <span style={{ flex: 1 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        {hint && <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{hint}</span>}
      </span>
    </label>
  );
}

function SelectRow({ label, value, onChange, options, hint }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 3 }}>{label}</label>
      <select className="form-input" style={{ fontSize: '0.82rem', padding: '0.35rem 0.55rem' }}
        value={value} onChange={e => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      {hint && <p style={{ margin: '3px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
  );
}

function ColorRow({ label, value, onChange, hint }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}>{label}</label>
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          style={{ width: 42, height: 32, padding: 0, border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }} />
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          className="form-input" style={{ fontSize: '0.8rem', padding: '0.3rem 0.4rem', fontFamily: 'monospace' }}
          placeholder="#000000" />
      </div>
      {hint && <p style={{ margin: '3px 0 0', fontSize: '0.68rem', color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
  );
}

function NumInput({ label, value, onChange, min = 0, max = 100 }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 2 }}>{label}</label>
      <input type="number" min={min} max={max} step="0.5"
        value={value ?? 0}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="form-input" style={{ fontSize: '0.8rem', padding: '0.3rem 0.4rem', width: '100%' }} />
    </div>
  );
}

function TextRow({ label, value, onChange, hint, placeholder }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 3 }}>{label}</label>
      <input type="text" className="form-input" style={{ fontSize: '0.82rem', padding: '0.35rem 0.55rem' }}
        value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      {hint && <p style={{ margin: '3px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
  );
}
