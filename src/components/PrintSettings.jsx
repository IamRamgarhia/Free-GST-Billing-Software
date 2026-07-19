import { useState, useEffect, useRef } from 'react';
import { Printer, TestTube, RotateCcw, Info, Save as SaveIcon, Trash2 } from 'lucide-react';
import { toast } from './Toast';
import { confirmAction } from './ConfirmModal';
import InvoicePreview from './InvoicePreview';
import { getProfile } from '../store';
import { DEFAULT_PRINT_SETTINGS, getPrintSettings, savePrintSettings, buildSampleInvoice, BUSINESS_PRESETS, applyBusinessPreset, LABEL_PRESETS } from '../utils/printSettings';

// v1.9.9 — Visual design presets. Each is a starting point that flips
// the pdfTemplate + color palette + thermal typography + a couple of
// layout tweaks in one click. Users can still edit every individual
// setting below afterwards (the preset just seeds sensible defaults for
// the vibe they picked).
//
// v1.9.10 — presets now shape BOTH the PDF and the thermal render.
// Colors are PDF-only (thermal printers are B&W by physics), but font
// family / weight / spacing / all-caps / header alignment / content
// toggles all apply to both, so switching preset visibly changes the
// thermal preview too.
const DESIGN_PRESETS = [
  {
    id: 'modern',
    name: 'Modern',
    icon: '💎',
    description: 'Sans font, blue accents. Clean, tech-startup feel.',
    settings: {
      // PDF
      pdfTemplate: 'modern',
      userColorsEnabled: true,
      pdfPrimaryText: '#0f172a', pdfMutedText: '#334155',
      pdfAccent: '#1e40af', pdfAccentText: '#ffffff',
      pdfHeaderBg: '#eef2ff', pdfDividerColor: '#cbd5e1',
      // Thermal — sans, bold, comfortable, mixed case (modern feel)
      fontFamily: 'sans', fontWeight: 'bold', fontSize: 'medium',
      lineSpacing: 'normal', allCaps: false,
      headerAlign: 'center', headerCaps: true, contrast: 'high',
    },
  },
  {
    id: 'classic',
    name: 'Classic',
    icon: '📜',
    description: 'Mono font, ALL CAPS. Traditional SMART BAZAAR receipt style.',
    settings: {
      // PDF
      pdfTemplate: 'classic',
      userColorsEnabled: true,
      pdfPrimaryText: '#000000', pdfMutedText: '#333333',
      pdfAccent: '#000000', pdfAccentText: '#ffffff',
      pdfHeaderBg: '#ffffff', pdfDividerColor: '#000000',
      // Thermal — mono ultra-bold ALL CAPS (max legibility, classic look)
      fontFamily: 'mono', fontWeight: 'ultra', fontSize: 'medium',
      lineSpacing: 'compact', allCaps: true,
      headerAlign: 'center', headerCaps: true, contrast: 'ultra',
    },
  },
  {
    id: 'corporate',
    name: 'Corporate',
    icon: '🏢',
    description: 'Sans + gold. Bold headers, comfortable spacing.',
    settings: {
      // PDF
      pdfTemplate: 'corporate',
      userColorsEnabled: true,
      pdfPrimaryText: '#0b1e3f', pdfMutedText: '#334155',
      pdfAccent: '#0b1e3f', pdfAccentText: '#f5c542',
      pdfHeaderBg: '#f1f5f9', pdfDividerColor: '#0b1e3f',
      // Thermal — sans, bold, comfortable, header caps only
      fontFamily: 'sans', fontWeight: 'bold', fontSize: 'medium',
      lineSpacing: 'comfortable', allCaps: false,
      headerAlign: 'center', headerCaps: true, contrast: 'high',
    },
  },
  {
    id: 'minimalist',
    name: 'Minimalist',
    icon: '⚪',
    description: 'Ultra clean. Airy spacing, no bold clutter.',
    settings: {
      // PDF
      pdfTemplate: 'minimalist',
      userColorsEnabled: true,
      pdfPrimaryText: '#111111', pdfMutedText: '#666666',
      pdfAccent: '#111111', pdfAccentText: '#ffffff',
      pdfHeaderBg: '#ffffff', pdfDividerColor: '#dddddd',
      // Thermal — sans, normal weight, comfortable, left header, no caps
      fontFamily: 'sans', fontWeight: 'normal', fontSize: 'medium',
      lineSpacing: 'comfortable', allCaps: false,
      headerAlign: 'left', headerCaps: false, contrast: 'normal',
    },
  },
  {
    id: 'colorful',
    name: 'Colorful',
    icon: '🎨',
    description: 'Warm orange. Retail / cafe / boutique feel.',
    settings: {
      // PDF
      pdfTemplate: 'modern',
      userColorsEnabled: true,
      pdfPrimaryText: '#1a1a1a', pdfMutedText: '#4a4a4a',
      pdfAccent: '#ea580c', pdfAccentText: '#ffffff',
      pdfHeaderBg: '#fff7ed', pdfDividerColor: '#fdba74',
      // Thermal — sans bold, normal spacing, show tagline for friendly touch
      fontFamily: 'sans', fontWeight: 'bold', fontSize: 'medium',
      lineSpacing: 'normal', allCaps: false,
      headerAlign: 'center', headerCaps: true, contrast: 'high',
      showTagline: true,
    },
  },
  {
    id: 'minimal',
    name: 'Compact',
    icon: '📄',
    description: 'Mono ALL CAPS, tight rows. Max lines per receipt.',
    settings: {
      // PDF
      pdfTemplate: 'minimal',
      userColorsEnabled: true,
      pdfPrimaryText: '#0f172a', pdfMutedText: '#475569',
      pdfAccent: '#0f172a', pdfAccentText: '#ffffff',
      pdfHeaderBg: '#f8fafc', pdfDividerColor: '#94a3b8',
      pdfFontScale: 0.9,
      // Thermal — mono ultra-bold, small compact ALL CAPS (max density)
      fontFamily: 'mono', fontWeight: 'ultra', fontSize: 'small',
      lineSpacing: 'compact', allCaps: true,
      headerAlign: 'center', headerCaps: true, contrast: 'ultra',
      showRateLine: false,
    },
  },
  // v1.9.11 — three new presets modeled on reference invoices user
  // shared (Amazon / LTIMindtree / Nike style). Same PDF template
  // machinery — just distinctive color + typography combos.
  {
    id: 'enterprise',
    name: 'Enterprise',
    icon: '🛒',
    description: 'Bold blue header, prominent branding. E-commerce feel.',
    settings: {
      pdfTemplate: 'modern',
      userColorsEnabled: true,
      pdfPrimaryText: '#0f172a', pdfMutedText: '#1e293b',
      pdfAccent: '#0284c7', pdfAccentText: '#ffffff',
      pdfHeaderBg: '#ffffff', pdfDividerColor: '#0284c7',
      pdfDarkenOnPrint: true,
      // Thermal — sans bold clean
      fontFamily: 'sans', fontWeight: 'bold', fontSize: 'medium',
      lineSpacing: 'normal', allCaps: false,
      headerAlign: 'left', headerCaps: true, contrast: 'high',
      showHSN: true,
    },
  },
  {
    id: 'itservices',
    name: 'IT Services',
    icon: '💻',
    description: 'Navy heading, highlighted total box. Consulting look.',
    settings: {
      pdfTemplate: 'corporate',
      userColorsEnabled: true,
      pdfPrimaryText: '#0f172a', pdfMutedText: '#1e293b',
      pdfAccent: '#1e3a8a', pdfAccentText: '#ffffff',
      pdfHeaderBg: '#eff6ff', pdfDividerColor: '#1e3a8a',
      pdfDarkenOnPrint: true,
      // Thermal — sans bold comfortable
      fontFamily: 'sans', fontWeight: 'bold', fontSize: 'medium',
      lineSpacing: 'comfortable', allCaps: false,
      headerAlign: 'left', headerCaps: true, contrast: 'high',
    },
  },
  {
    id: 'retail',
    name: 'Retail Brand',
    icon: '👟',
    description: 'Logo-first, clean rows with HSN column. Brand-forward.',
    settings: {
      pdfTemplate: 'minimalist',
      userColorsEnabled: true,
      pdfPrimaryText: '#0a0a0a', pdfMutedText: '#262626',
      pdfAccent: '#0a0a0a', pdfAccentText: '#ffffff',
      pdfHeaderBg: '#ffffff', pdfDividerColor: '#0a0a0a',
      pdfDarkenOnPrint: true,
      // Thermal — sans bold normal
      fontFamily: 'sans', fontWeight: 'bold', fontSize: 'medium',
      lineSpacing: 'normal', allCaps: false,
      headerAlign: 'left', headerCaps: true, contrast: 'high',
      showHSN: true,
    },
  },
];

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
  // v1.9.8 — preview mode toggle so users see the right layout for the
  // change they're making. Sticky preview on the right stays in view as
  // they scroll settings on the left.
  const [previewMode, setPreviewMode] = useState('pdf'); // 'pdf' | 'thermal' | 'both'

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

        // v1.10.3 — await fonts + capped scale + blob leak fix.
        if (document.fonts && document.fonts.ready) {
          try { await document.fonts.ready; } catch { /* non-fatal */ }
        }
        // v1.10.11 — buffer-safe mode lowers the scale + JPEG quality
        // and grayscales the capture so old thermal printers with
        // small buffers can accept it.
        const bufSafe = !!settings.thermalBufferSafe;
        const capScale = bufSafe
          ? 2
          : Math.min(6, Math.max(2, Math.round((window.devicePixelRatio || 1) * 1.5)));
        const canvas = await html2canvas(previewRef.current, {
          scale: capScale,
          backgroundColor: '#ffffff', useCORS: false, logging: false,
        });
        // Grayscale the canvas in-place when buffer-safe is on. This
        // simplifies the raster the printer driver needs to process.
        if (bufSafe) {
          try {
            const ctx = canvas.getContext('2d');
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const d = img.data;
            for (let i = 0; i < d.length; i += 4) {
              // Luminosity method; also boost contrast so grays snap to B/W.
              const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
              const v = gray < 180 ? 0 : 255;   // hard threshold for dot-matrix feel
              d[i] = d[i + 1] = d[i + 2] = v;
            }
            ctx.putImageData(img, 0, 0);
          } catch { /* CORS-tainted canvas can't be read; fall back to raw */ }
        }
        const width = 80;
        const height = (canvas.height * width) / canvas.width;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [width, Math.max(150, height)] });
        const jpegQ = bufSafe ? 0.72 : 0.95;
        pdf.addImage(canvas.toDataURL('image/jpeg', jpegQ), 'JPEG', 0, 0, width, height, undefined, 'FAST');

        // v1.10.3 — blob URL revoked in `finally`-equivalent (timer +
        // load handler both trigger cleanup once). Prior code only
        // revoked in onload; if the iframe never loaded (blocked, bad
        // PDF), the blob URL leaked forever.
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        let cleaned = false;
        const cleanup = () => { if (!cleaned) { cleaned = true; URL.revokeObjectURL(url); } };
        const timer = setTimeout(cleanup, 90_000);
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
          setTimeout(() => { clearTimeout(timer); cleanup(); }, 60_000);
        };
        frame.onerror = () => { clearTimeout(timer); cleanup(); };
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
            Print & PDF Settings
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
            App-wide defaults for every printed / PDF invoice. 70+ settings — every one dynamic. Each invoice can override via its Customize panel.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" style={{ fontSize: '0.82rem' }}
            onClick={() => {
              const next = { ...settings, onboardingComplete: false };
              setSettings(next); savePrintSettings(next);
              toast('Setup wizard will re-open on next page reload', 'info');
            }}
            title="Show the first-run wizard again">
            🚀 Run setup wizard
          </button>
          <button className="btn btn-secondary" style={{ fontSize: '0.82rem' }} onClick={reset}>
            <RotateCcw size={14} /> Reset defaults
          </button>
          <button className="btn btn-primary" style={{ fontSize: '0.82rem' }} onClick={runTestPrint}>
            <TestTube size={14} /> Test Print
          </button>
        </div>
      </div>

      {/* v1.9.8 — Split layout: settings scroll on the left, preview stays sticky on the right */}
      <div className="print-settings-layout" style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(340px, 460px)',
        gap: '1.25rem',
        marginTop: '1.25rem',
        alignItems: 'flex-start',
      }}>
        <div className="print-settings-body" style={{ minWidth: 0 }}>

      {/* v1.9.9 — Design preset picker. One-click starting point; every
           setting below still fully editable. Shows a filled swatch strip
           so the user can eyeball the vibe before committing. */}
      <div style={{
        padding: '0.85rem 1rem',
        background: 'linear-gradient(135deg, var(--bg-secondary), var(--card))',
        border: '1px solid var(--border)',
        borderRadius: 10,
        marginBottom: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.6rem', gap: '0.5rem', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '0.9rem' }}>🎨 Choose a design <span style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: 6 }}>affects PDF + Thermal</span></strong>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Click a design to start. Edit anything below.</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
          {DESIGN_PRESETS.map(preset => {
            // v1.9.13 — Multiple presets share the same pdfTemplate value
            // (e.g. Modern, Colorful, and Enterprise all use pdfTemplate:
            // 'modern'). Comparing on pdfTemplate lit up all of them at
            // once. Track a distinct activePresetId instead.
            const active = settings.activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  const next = { ...settings, ...preset.settings, activePresetId: preset.id };
                  setSettings(next); savePrintSettings(next);
                  toast(`Applied "${preset.name}" design — every setting still editable below`, 'success');
                }}
                style={{
                  padding: '0.6rem 0.5rem',
                  border: active ? '2px solid var(--primary)' : '1px solid var(--border)',
                  borderRadius: 8,
                  background: active ? 'var(--primary-light, rgba(30,64,175,0.08))' : 'var(--card)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex', flexDirection: 'column', gap: '0.35rem',
                  transition: 'all 0.15s',
                }}
                title={preset.description}
              >
                {/* Mini color-swatch preview strip */}
                <div style={{ display: 'flex', gap: 3, height: 22, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <div style={{ flex: 2, background: preset.settings.pdfHeaderBg || '#f8fafc' }} />
                  <div style={{ flex: 1.5, background: preset.settings.pdfAccent || '#1e40af' }} />
                  <div style={{ flex: 1, background: preset.settings.pdfPrimaryText || '#0f172a' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{preset.icon} {preset.name}</span>
                  {active && <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 700 }}>ACTIVE</span>}
                </div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>{preset.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        {/* TYPOGRAPHY — thermal-only since v1.10.9 */}
        <SettingGroup title="Typography (Thermal receipts)">
          <SelectRow label="Font family" value={settings.fontFamily} onChange={v => set({ fontFamily: v })}
            options={[
              ['mono', 'Monospace (Courier) — thermal-optimized'],
              ['sans', 'Sans-serif (Arial-like)'],
            ]}
            hint="Applies to THERMAL receipts only. For A4/A5 PDFs use the 'PDF FONT FAMILY' section below." />
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

          {/* v1.10.11 — COMPACT HEADER + THERMAL BUFFER-SAFE MODE */}
          <SettingGroup title="Layout &amp; printer compatibility">
            <ToggleRow label="Compact upper header (fit more items on page 1)"
              value={settings.headerCompact} onChange={v => set({ headerCompact: v })}
              hint="Shrinks the header, billing block, and Place-of-Supply spacing so the items table starts higher up. Best when your invoices routinely spill to page 2 because of large headers." />
            <ToggleRow label="Thermal buffer-safe mode (for old / low-memory receipt printers)"
              value={settings.thermalBufferSafe} onChange={v => set({ thermalBufferSafe: v })}
              hint="Uses grayscale, drops render scale for thermal captures, and lowers JPEG quality. Helps ₹800–₹2000 thermal printers with small internal buffers avoid stuck B/W print jobs." />
          </SettingGroup>

          {/* PER-TYPE INVOICE PREFIX OVERRIDES (v1.10.10) */}
          <SettingGroup title="Custom prefix per invoice type">
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>
              Leave blank to use the built-in default. Each type has its own atomic counter — changing a prefix starts a fresh count for the new one.
            </p>
            {[
              { key: 'tax-invoice',     label: 'Tax Invoice',       def: 'INV'  },
              { key: 'proforma',        label: 'Proforma / Estimate', def: 'EST' },
              { key: 'bill-of-supply',  label: 'Bill of Supply',    def: 'BOS'  },
              { key: 'composition',     label: 'Composition',       def: 'COMP' },
              { key: 'credit-note',     label: 'Credit Note',       def: 'CN'   },
              { key: 'delivery-challan',label: 'Delivery Challan',  def: 'DC'   },
            ].map(({ key, label, def }) => (
              <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: '0.5rem', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: '0.82rem' }}>{label}</span>
                <input type="text" className="form-input"
                  value={settings.customPrefixes?.[key] || ''}
                  onChange={e => set({ customPrefixes: { ...(settings.customPrefixes || {}), [key]: e.target.value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 8) } })}
                  placeholder={def} maxLength={8}
                  style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem' }} />
              </div>
            ))}
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
                    {/* v1.10.10 — reported: "letterhead not working". Root
                         cause: enabling the toggle without uploading an
                         image left `letterheadImage = ''` which silently
                         does nothing at render time. Warn the user
                         instead of letting them think it's on. */}
                    <div style={{ padding: '0.5rem 0.75rem', background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', color: 'var(--warn-text)', borderRadius: 6, fontSize: '0.78rem', marginBottom: '0.6rem' }}>
                      ⚠ Letterhead is enabled but no image is uploaded yet. Upload a PNG or JPG below (A4 recommended, max 3 MB) — the toggle does nothing until an image is set.
                    </div>
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
            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: '3px 0 0', fontStyle: 'italic' }}>
              v1.10.10 note: applied at PDF export time. The on-screen preview always renders at 100% — download a PDF to see the actual scale.
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

      {/* ============================================================ */}
      {/* v1.9.3 — Full user control: 14 new dynamic sections */}
      {/* ============================================================ */}

      {/* -- BUSINESS TYPE PRESETS -- */}
      <div style={{ marginTop: '1.5rem', padding: '1rem 1.25rem', background: 'var(--bg-secondary)', borderRadius: 8 }}>
        <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', color: 'var(--primary)' }}>
          ⚡ Business type presets — one-click configuration
        </h4>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>
          Applies 15+ recommended settings for your business type. You can still customise anything afterwards.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
          {Object.entries(BUSINESS_PRESETS).map(([key, preset]) => (
            <button key={key} type="button" className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.6rem', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', gap: '3px' }}
              onClick={async () => {
                if (!await confirmAction({
                  title: `Apply "${preset.label}" preset?`,
                  message: `This will overwrite ${Object.keys(preset.patch).length} print settings on top of your current setup. You can undo by picking "Reset to defaults".`,
                  confirmLabel: 'Apply preset',
                  tone: 'warning',
                })) return;
                const next = applyBusinessPreset(settings, key);
                setSettings(next);
                savePrintSettings(next);
                toast(`Applied "${preset.label}" preset`, 'success');
              }}>
              <strong>{preset.label}</strong>
              <span style={{ fontSize: '0.7rem', opacity: 0.75 }}>{preset.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {/* -- SECTION LABELS (multi-language + custom text) -- */}
      <div style={{ marginTop: '1.5rem', padding: '1rem 1.25rem', background: 'var(--bg-secondary)', borderRadius: 8 }}>
        <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', color: 'var(--primary)' }}>
          🌐 Section labels — multi-language + custom text
        </h4>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>
          Pick a language preset OR override any individual label. Custom text overrides the language preset for that field.
        </p>
        <SelectRow label="Language preset" value={settings.labelLanguage} onChange={v => set({ labelLanguage: v })}
          options={[
            ['en', 'English'],
            ['hi', 'हिन्दी (Hindi)'],
            ['ta', 'தமிழ் (Tamil)'],
            ['mr', 'मराठी (Marathi)'],
            ['bn', 'বাংলা (Bengali)'],
          ]} />
        <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem' }}>
          <TextRow label='"BILL TO" label' value={settings.labelBillTo} onChange={v => set({ labelBillTo: v })}
            placeholder={LABEL_PRESETS[settings.labelLanguage]?.billTo || LABEL_PRESETS.en.billTo} />
          <TextRow label='"PLACE OF SUPPLY" label' value={settings.labelPlaceOfSupply} onChange={v => set({ labelPlaceOfSupply: v })}
            placeholder={LABEL_PRESETS[settings.labelLanguage]?.placeOfSupply || LABEL_PRESETS.en.placeOfSupply} />
          <TextRow label='"BANK DETAILS" label' value={settings.labelBankDetails} onChange={v => set({ labelBankDetails: v })}
            placeholder={LABEL_PRESETS[settings.labelLanguage]?.bankDetails || LABEL_PRESETS.en.bankDetails} />
          <TextRow label='"AMOUNT IN WORDS" label' value={settings.labelAmountInWords} onChange={v => set({ labelAmountInWords: v })}
            placeholder={LABEL_PRESETS[settings.labelLanguage]?.amountInWords || LABEL_PRESETS.en.amountInWords} />
          <TextRow label='"TERMS & CONDITIONS" label' value={settings.labelTerms} onChange={v => set({ labelTerms: v })}
            placeholder={LABEL_PRESETS[settings.labelLanguage]?.terms || LABEL_PRESETS.en.terms} />
          <TextRow label='"NOTES" label' value={settings.labelNotes} onChange={v => set({ labelNotes: v })}
            placeholder={LABEL_PRESETS[settings.labelLanguage]?.notes || LABEL_PRESETS.en.notes} />
          <TextRow label='"Authorized Signatory" text' value={settings.labelAuthorizedSignatory} onChange={v => set({ labelAuthorizedSignatory: v })}
            placeholder={LABEL_PRESETS[settings.labelLanguage]?.authorizedSignatory || LABEL_PRESETS.en.authorizedSignatory} />
        </div>
      </div>

      {/* -- FORMATTING (date, number, currency) -- */}
      <div style={{ marginTop: '1.5rem', padding: '1rem 1.25rem', background: 'var(--bg-secondary)', borderRadius: 8 }}>
        <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', color: 'var(--primary)' }}>
          📅 Formatting — date, number, currency
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          <SelectRow label="Date format" value={settings.dateFormat} onChange={v => set({ dateFormat: v })}
            options={[
              ['dd-mon-yyyy', '02 Apr 2026 (Indian)'],
              ['dd-mmm-yyyy', '02-Apr-2026'],
              ['dd-mm-yyyy', '02/04/2026'],
              ['mm-dd-yyyy', '04/02/2026 (US)'],
              ['yyyy-mm-dd', '2026-04-02'],
              ['iso', 'ISO 8601'],
            ]} />
          <SelectRow label="Number grouping" value={settings.numberFormat} onChange={v => set({ numberFormat: v })}
            options={[
              ['indian', '1,00,000.00 (Indian)'],
              ['western', '100,000.00 (Western)'],
              ['european', '100.000,00 (European)'],
            ]} />
          <SelectRow label="Decimal places" value={String(settings.decimalPlaces)} onChange={v => set({ decimalPlaces: parseInt(v, 10) })}
            options={[['0', '0 (no decimals)'], ['2', '2 (default)'], ['3', '3'], ['4', '4']]} />
          <SelectRow label="Currency symbol position" value={settings.currencyPosition} onChange={v => set({ currencyPosition: v })}
            options={[['before', '₹100 (before number)'], ['after', '100₹ (after number)']]} />
        </div>
      </div>

      {/* -- ROW DENSITY -- */}
      <div style={{ marginTop: '1.5rem', padding: '1rem 1.25rem', background: 'var(--bg-secondary)', borderRadius: 8 }}>
        <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', color: 'var(--primary)' }}>
          📏 Row density
        </h4>
        <SelectRow label="Vertical spacing in tables + sections" value={settings.rowDensity} onChange={v => set({ rowDensity: v })}
          options={[
            ['compact', 'Compact — fit more per page'],
            ['normal', 'Normal (default)'],
            ['comfortable', 'Comfortable — easier to read'],
          ]}
          hint="Affects both A4/A5 PDFs and the on-screen preview." />
      </div>

      {/* -- CUSTOM WATERMARK TEXT -- */}
      <div style={{ marginTop: '1.5rem', padding: '1rem 1.25rem', background: 'var(--bg-secondary)', borderRadius: 8 }}>
        <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', color: 'var(--primary)' }}>
          💧 Custom watermark text
        </h4>
        {/* v1.10.10 — reported "custom watermark text not working". Root
             cause: this section only writes `watermarkUseCustomText` +
             `watermarkCustomText`, but the master `watermarkEnabled`
             toggle lives in a DIFFERENT section above. Users toggled
             the custom text here without turning the master on and got
             silence. Now: turning on Custom text auto-enables the
             master, and if the master is off we show a warning here
             instead of silently accepting the choice. */}
        {!settings.watermarkEnabled && settings.watermarkUseCustomText && (
          <div style={{ padding: '0.5rem 0.75rem', background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', color: 'var(--warn-text)', borderRadius: 6, fontSize: '0.78rem', marginBottom: '0.6rem' }}>
            ⚠ The master "Show watermark" toggle is OFF. Turning it on now so your custom text actually renders on invoices.
            <button type="button" className="btn btn-primary" style={{ marginLeft: '0.5rem', fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
              onClick={() => set({ watermarkEnabled: true })}>Turn on now</button>
          </div>
        )}
        <ToggleRow label="Use custom text (overrides preset)" value={settings.watermarkUseCustomText}
          onChange={v => set(v ? { watermarkUseCustomText: v, watermarkEnabled: true } : { watermarkUseCustomText: v })}
          hint="When enabled, the text below replaces the PAID/DUPLICATE/etc. preset picker. Automatically turns on the master 'Show watermark' toggle too." />
        {settings.watermarkUseCustomText && (
          <TextRow label="Watermark text" value={settings.watermarkCustomText} onChange={v => set({ watermarkCustomText: v })}
            placeholder="e.g. CONFIDENTIAL · SAMPLE · PROOF ONLY · YOUR-COMPANY-NAME"
            hint="Any text you want. Automatically uppercased." />
        )}
      </div>

      {/* -- CUSTOM TAX RATES -- */}
      <div style={{ marginTop: '1.5rem', padding: '1rem 1.25rem', background: 'var(--bg-secondary)', borderRadius: 8 }}>
        <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', color: 'var(--primary)' }}>
          💯 Custom tax rate presets
        </h4>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.6rem' }}>
          Built-in rates: 0% · 5% · 12% · 18% · 28%. Add your own (e.g. 3% jewellery, 0.25% diamond, 7.5% custom).
        </p>
        <CustomListEditor
          values={settings.customTaxRates || []}
          onChange={v => set({ customTaxRates: v })}
          placeholder="e.g. 3, 0.25, 7.5"
          hint="Comma-separated numbers. Between 0 and 100." />
      </div>

      {/* v1.10.5 — audit M25. Three unwired UI sections deleted here:
           * "Custom fields (default on every invoice)" — customInvoiceFields
             was saved but never rendered on the invoice.
           * "Items table column widths" — columnWidths were saved but no
             code applied them to .inv-table columns.
           * "Payment reminder scheduling" (below saved-templates) —
             reminderTemplate + reminderDaysAfter* had no send-side wiring.
         The setting defaults stay in printSettings.js so existing
         localStorage payloads still parse (extra keys are ignored). If
         someone wants these features, the settings shape is ready — the
         missing piece is the consumer code. */}

      {/* -- SAVED CUSTOM TEMPLATES -- */}
      <div style={{ marginTop: '1.5rem', padding: '1rem 1.25rem', background: 'var(--bg-secondary)', borderRadius: 8 }}>
        <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', color: 'var(--primary)' }}>
          💾 My saved templates
        </h4>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.6rem' }}>
          Save your current setup as a named template. Recall any time.
        </p>
        <SavedTemplatesEditor
          templates={settings.savedTemplates || []}
          onChange={v => set({ savedTemplates: v })}
          currentSettings={settings}
          onLoad={async (tpl) => {
            if (!await confirmAction({
              title: `Load template "${tpl.name}"?`,
              message: 'This overwrites your current print settings. Save the current setup as a template first if you want to be able to go back.',
              confirmLabel: 'Load template',
              tone: 'warning',
            })) return;
            setSettings(tpl.settings);
            savePrintSettings(tpl.settings);
            toast(`Loaded "${tpl.name}"`, 'success');
          }} />
      </div>

      {/* v1.10.5 — reminder-scheduling UI removed. See M25 audit note
           above the SAVED TEMPLATES section. Notification bell still
           surfaces overdue bills using `reminderEnabled` alone. */}

        </div>{/* end .print-settings-body */}

        {/* v1.9.8 — Sticky preview pane. Stays in view while user scrolls
             settings on the left. Tab toggle at top switches between the
             PDF (A4) and Thermal (80mm) render. Split view shows both. */}
        <div className="print-settings-preview-pane" style={{
          position: 'sticky', top: '1rem',
          maxHeight: 'calc(100vh - 2rem)',
          padding: '1rem',
          background: 'var(--bg-secondary)',
          borderRadius: 8,
          display: 'flex', flexDirection: 'column', gap: '0.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <strong style={{ fontSize: '0.9rem' }}>
              <Info size={14} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />
              Live preview
            </strong>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Updates as you type</span>
          </div>

          {/* Preview mode tabs */}
          <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--card)', padding: '0.25rem', borderRadius: 6 }}>
            {[
              ['pdf', '📄 PDF (A4)'],
              ['thermal', '🖨 Thermal (80mm)'],
              ['both', '⊞ Split view'],
            ].map(([key, label]) => (
              <button key={key} type="button"
                onClick={() => setPreviewMode(key)}
                style={{
                  flex: 1, padding: '0.35rem', border: 'none', borderRadius: 4,
                  background: previewMode === key ? 'var(--primary)' : 'transparent',
                  color: previewMode === key ? '#fff' : 'var(--text)',
                  fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                }}>
                {label}
              </button>
            ))}
          </div>

          {/* Preview canvas — scrolls internally so left settings scroll independently.
              CSS transform: scale doesn't shrink the layout box, so we wrap the
              scaled invoice in a container sized to the post-scale dimensions.
              Otherwise the 210mm A4 pushes out of the pane and content clips. */}
          <div style={{ overflow: 'auto', flex: 1, background: '#fff', padding: '0.75rem', borderRadius: 6, minHeight: 200 }}>
            {previewMode === 'both' ? (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ zoom: 0.42, minWidth: 0 }}>
                  <InvoicePreview
                    profile={sample.profile}
                    client={sample.client}
                    details={sample.details}
                    items={sample.items}
                    totals={sample.totals}
                    invoiceType={sample.invoiceType}
                    options={{ ...previewInvoiceOptions, paperSize: 'a4' }}
                    customTerms="" customNotes="" extraSections={[]}
                  />
                </div>
                <div style={{ zoom: 0.85, minWidth: 0 }}>
                  <InvoicePreview
                    profile={sample.profile}
                    client={sample.client}
                    details={sample.details}
                    items={sample.items}
                    totals={sample.totals}
                    invoiceType={sample.invoiceType}
                    options={{ ...previewInvoiceOptions, paperSize: 'thermal80' }}
                    customTerms="" customNotes="" extraSections={[]}
                  />
                </div>
              </div>
            ) : previewMode === 'pdf' ? (
              <div style={{ zoom: 0.5, minWidth: 0 }}>
                <InvoicePreview
                  ref={previewRef}
                  profile={sample.profile}
                  client={sample.client}
                  details={sample.details}
                  items={sample.items}
                  totals={sample.totals}
                  invoiceType={sample.invoiceType}
                  options={{ ...previewInvoiceOptions, paperSize: 'a4' }}
                  customTerms="" customNotes="" extraSections={[]}
                />
              </div>
            ) : (
              <div style={{ margin: '0 auto', width: 'fit-content' }}>
                <InvoicePreview
                  ref={previewRef}
                  profile={sample.profile}
                  client={sample.client}
                  details={sample.details}
                  items={sample.items}
                  totals={sample.totals}
                  invoiceType={sample.invoiceType}
                  options={{ ...previewInvoiceOptions, paperSize: 'thermal80' }}
                  customTerms="" customNotes="" extraSections={[]}
                />
              </div>
            )}
          </div>
        </div>
      </div>{/* end .print-settings-layout */}

      {/* Hidden preview for the actual test-print rendering */}
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

function CustomListEditor({ values, onChange, placeholder }) {
  const [input, setInput] = useState('');
  return (
    <div>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        {(values || []).map((v, i) => (
          <span key={i} style={{ background: 'var(--primary)', color: '#fff', padding: '0.15rem 0.5rem', borderRadius: 12, fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {v}%
            <button type="button" onClick={() => onChange(values.filter((_, j) => j !== i))}
              style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, fontSize: '0.85rem', lineHeight: 1 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.35rem' }}>
        <input type="text" value={input} onChange={e => setInput(e.target.value)}
          placeholder={placeholder}
          className="form-input" style={{ fontSize: '0.82rem', padding: '0.35rem 0.55rem', flex: 1 }} />
        <button type="button" className="btn btn-secondary" style={{ fontSize: '0.78rem' }}
          onClick={() => {
            const parsed = input.split(',').map(s => parseFloat(s.trim())).filter(n => Number.isFinite(n) && n >= 0 && n <= 100);
            if (parsed.length === 0) return;
            const merged = Array.from(new Set([...(values || []), ...parsed])).sort((a, b) => a - b);
            onChange(merged);
            setInput('');
          }}>Add</button>
      </div>
    </div>
  );
}

function ExtraFieldsEditor({ fields, onChange }) {
  const [label, setLabel] = useState('');
  return (
    <div>
      {(fields || []).map((f, i) => (
        <div key={i} style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.35rem' }}>
          <input type="text" value={f.label} className="form-input"
            style={{ fontSize: '0.82rem', padding: '0.35rem', flex: 1 }}
            onChange={e => {
              const next = [...fields];
              next[i] = { ...next[i], label: e.target.value };
              onChange(next);
            }} />
          <button type="button" className="icon-btn icon-btn-red"
            onClick={() => onChange(fields.filter((_, j) => j !== i))}
            title="Remove"><Trash2 size={14} /></button>
        </div>
      ))}
      {(fields || []).length < 5 && (
        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.35rem' }}>
          <input type="text" value={label} onChange={e => setLabel(e.target.value)}
            placeholder="e.g. PO Reference"
            className="form-input" style={{ fontSize: '0.82rem', padding: '0.35rem', flex: 1 }} />
          <button type="button" className="btn btn-secondary" style={{ fontSize: '0.78rem' }}
            onClick={() => {
              if (!label.trim()) return;
              onChange([...(fields || []), { label: label.trim(), value: '' }]);
              setLabel('');
            }}>Add field</button>
        </div>
      )}
    </div>
  );
}

function SavedTemplatesEditor({ templates, onChange, currentSettings, onLoad }) {
  const [name, setName] = useState('');
  return (
    <div>
      {(templates || []).map((tpl, i) => (
        <div key={i} style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.35rem', alignItems: 'center', padding: '0.4rem', background: 'var(--card)', borderRadius: 5 }}>
          <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 600 }}>{tpl.name}</span>
          <button type="button" className="btn btn-secondary" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
            onClick={() => onLoad(tpl)}>Load</button>
          <button type="button" className="icon-btn icon-btn-red"
            onClick={() => onChange(templates.filter((_, j) => j !== i))}><Trash2 size={13} /></button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem' }}>
        <input type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Template name (e.g. Retail v1)"
          className="form-input" style={{ fontSize: '0.82rem', padding: '0.35rem', flex: 1 }} />
        <button type="button" className="btn btn-primary" style={{ fontSize: '0.78rem' }}
          onClick={() => {
            if (!name.trim()) return;
            onChange([...(templates || []), { name: name.trim(), settings: { ...currentSettings } }]);
            setName('');
            toast(`Saved template "${name.trim()}"`, 'success');
          }}>
          <SaveIcon size={13} /> Save current as template
        </button>
      </div>
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
