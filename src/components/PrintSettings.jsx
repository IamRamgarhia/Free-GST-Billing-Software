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
