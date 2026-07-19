import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { ArrowLeft, Plus, Trash2, Download, UserPlus, Pencil, Settings, ChevronUp, ChevronDown, MessageCircle, Check, Loader, Truck, Printer } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { saveBill, getNextInvoiceNumber, getTermsTemplates, getAllClients, saveClient, getProfile, getAllProducts, saveProduct, getInvoiceDisplayOptions, saveInvoiceDisplayOptions, getAllProfiles, getRegionMode, saveRecurring, getAllBills } from '../store';
import { INVOICE_TYPES, generateEWayBillJSON, formatCurrency, getCountryConfig, getStatesForCountry, getAllUnits, addCustomUnit, removeCustomUnit, calculateRoundOff, getCountriesForRegion, TDS_SECTIONS, TCS_SECTIONS, TERMS_PRESETS, getActiveAccounts, getDefaultAccount, getAccountById, getDefaultUnitForMode, filterUnitsByMode, PAPER_SIZES, getPaperSize, computeInvoiceTotals } from '../utils';
import { getPrintSettings, savePrintSettings } from '../utils/printSettings';
import { openWhatsAppShare } from '../utils/share';
import { confirmAction, promptAction } from './ConfirmModal';
import ThermalPreviewModal from './ThermalPreviewModal';
import { ensureToken, findOrCreateFolder, uploadPDF } from '../services/googleDrive';
import DOMPurify from 'dompurify';
import InvoicePreview from './InvoicePreview';
import { suggestGstRate } from '../utils/hsnRates';
import HelpButton from './HelpButton';
import { getClientCredit, planCreditApplication } from '../utils/clientCredit';
import ClientModal from './ClientModal';
import { toast } from './Toast';

// Rich text editor component that works with contentEditable properly
function RichEditor({ value, onChange, placeholder, toolbar = false }) {
  const ref = useRef(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (ref.current && !isInitialized.current) {
      ref.current.innerHTML = DOMPurify.sanitize(value || '');
      isInitialized.current = true;
    }
  }, []);

  // Update if value changes externally (e.g. draft restore, editing bill)
  useEffect(() => {
    if (ref.current && isInitialized.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = DOMPurify.sanitize(value || '');
    }
  }, [value]);

  const handleInput = useCallback(() => {
    if (ref.current) {
      onChange(ref.current.innerHTML);
    }
  }, [onChange]);

  // Toolbar formatting via document.execCommand. The existing innerHTML setters above
  // already wrap user content with DOMPurify.sanitize(), and the toolbar only emits
  // standard formatting tags that the same sanitizer keeps.
  const applyFormat = (cmd, val) => {
    if (ref.current) ref.current.focus();
    document.execCommand(cmd, false, val);
    if (ref.current) onChange(ref.current.innerHTML);
  };
  const btnStyle = { padding: '0.2rem 0.5rem', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', cursor: 'pointer', minWidth: '28px' };

  return (
    <>
      {toolbar && (
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
          <button type="button" onClick={() => applyFormat('bold')}        title="Bold (Ctrl+B)"      style={{ ...btnStyle, fontWeight: 700 }}>B</button>
          <button type="button" onClick={() => applyFormat('italic')}      title="Italic (Ctrl+I)"    style={{ ...btnStyle, fontStyle: 'italic' }}>I</button>
          <button type="button" onClick={() => applyFormat('underline')}   title="Underline (Ctrl+U)" style={{ ...btnStyle, textDecoration: 'underline' }}>U</button>
          <span style={{ width: 1, background: 'var(--border-color)', margin: '0 0.2rem' }} />
          <button type="button" onClick={() => applyFormat('insertUnorderedList')} title="Bullet list"  style={btnStyle}>•&nbsp;List</button>
          <button type="button" onClick={() => applyFormat('insertOrderedList')}   title="Numbered list" style={btnStyle}>1.&nbsp;List</button>
          <span style={{ width: 1, background: 'var(--border-color)', margin: '0 0.2rem' }} />
          <button type="button" onClick={() => applyFormat('formatBlock', '<h4>')}  title="Heading"   style={{ ...btnStyle, fontWeight: 700, fontSize: '0.85rem' }}>H</button>
          <button type="button" onClick={() => applyFormat('formatBlock', '<p>')}   title="Paragraph" style={btnStyle}>¶</button>
          <button type="button" onClick={async () => {
            const url = await promptAction({
              title: 'Insert link',
              message: 'Paste the URL to link to. Selected text will become the link.',
              placeholder: 'https://example.com',
              confirmLabel: 'Insert',
            });
            if (url) applyFormat('createLink', url);
          }} title="Insert link" style={btnStyle}>🔗</button>
          <span style={{ width: 1, background: 'var(--border-color)', margin: '0 0.2rem' }} />
          <button type="button" onClick={() => applyFormat('removeFormat')} title="Clear formatting" style={btnStyle}>✕</button>
        </div>
      )}
      <div ref={ref} contentEditable suppressContentEditableWarning
        className="form-input rich-editor"
        onInput={handleInput}
        style={{ minHeight: '100px', whiteSpace: 'pre-wrap' }}
        data-placeholder={placeholder} />
    </>
  );
}

// Load draft from sessionStorage
function loadDraft() {
  try {
    const saved = sessionStorage.getItem('gst_invoiceDraft');
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

const DEFAULT_OPTIONS = {
  showGST: true,
  showState: true,
  showGSTIN: true,
  showPlaceOfSupply: true,
  showHSN: true,
  showDiscount: true,
  showBankDetails: true,
  showUPI: true,
  showLogo: true,
  showSignature: true,
  showTerms: true,
  showNotes: true,
  showAmountWords: true,
  showDueDate: true,
  showItemQty: true,
  showRoundOff: false,
  invoiceMode: 'goods',    // 'goods' | 'services' | 'mixed' — drives default unit + dropdown filter
  // Paper / print size (v1.8.1+). See PAPER_SIZES in utils.js.
  //   Sheet: 'a4' | 'a4Landscape' | 'a5' | 'a5Landscape'
  //   Thermal: 'thermal80' | 'thermal58'
  paperSize: 'a4',
  // Thermal-only settings (v1.8.3) — only apply when paperSize starts with
  // 'thermal'. Left at defaults for sheet formats (they're ignored).
  //   thermalFontSize: 'small' | 'medium' (default) | 'large'
  //   thermalCompact: false → include address/HSN/rate line per item
  //                   true  → compact mode, shorter format
  //   thermalCutMark: true  → adds "----- cut here -----" at end for
  //                          auto-cutter thermal printers
  thermalFontSize: 'medium',
  thermalCompact: false,
  thermalCutMark: true,
  recurring: null,         // null OR { enabled, frequency, interval, nextDate, endMode, endDate, maxOccurrences }
  showCess: false,         // when true, exposes per-line Cess % input (India-only)
  reverseCharge: false,    // when true, GST is paid by the recipient (Section 9(3)/9(4))
  showTDS: false,
  tdsSection: '194Q',
  tdsRate: 0.1,
  // v1.10.31 — Data-F2.3: `tdsCumulativeThisYear` / `tcsCumulativeThisYear`
  // were read by the totals memo and by `computeInvoiceTotals`'s ₹50L
  // threshold logic, but never declared in DEFAULT_OPTIONS. That meant a
  // fresh invoice had `undefined` for both, so the marginal-only threshold
  // logic silently charged TDS/TCS from rupee-one instead of only after
  // the client's running annual cumulative crossed ₹50L. Now the defaults
  // exist; a future feature can auto-populate them from prior bills.
  tdsCumulativeThisYear: 0,
  showTCS: false,
  tcsSection: '206C(1H)',
  tcsRate: 0.1,
  tcsCumulativeThisYear: 0,
  customTitle: '',
  currency: 'INR',
  exchangeRate: '',
  selectedAccountId: null,   // null ⇒ resolve via last-used / default / first-active at render time
  showAccountLabel: false,   // when true, prints "Pay via: <account label>" above the bank block
  accentColor: '',
  pdfStyle: 'classic',
  // v1.10.22 — invoice-level (whole-bill) discount. Treated as a cash
  // discount / trade allowance applied AFTER tax. Doesn't affect the
  // GSTR-1 taxable value (which per Section 15(3) requires pre-supply
  // agreement — user should use per-line discount for that). Renders as
  // its own line above the grand total when > 0.
  invoiceDiscountValue: 0,
  invoiceDiscountType: 'fixed', // 'fixed' | 'percent'
  // v1.10.24 — Client-credit auto-apply. When true, opening a new invoice
  // for a client with an existing overpayment auto-applies the credit up
  // to the invoice total. When false (default), the user sees a banner
  // and clicks Apply manually. Reported: "this extra payment can be
  // added to the next bill of customer if u enabled — auto or manual".
  autoApplyClientCredit: false,
};

const ACCENT_PRESETS = [
  { color: '#1e40af', label: 'Blue' },
  { color: '#7c3aed', label: 'Purple' },
  { color: '#0f766e', label: 'Teal' },
  { color: '#be123c', label: 'Red' },
  { color: '#c2410c', label: 'Orange' },
  { color: '#15803d', label: 'Green' },
  { color: '#0369a1', label: 'Sky' },
  { color: '#1e293b', label: 'Dark' },
];

const PDF_STYLES = [
  { id: 'classic', label: 'Classic', desc: 'Clean with top accent bar' },
  { id: 'modern', label: 'Modern', desc: 'Bold header with color block' },
  { id: 'minimal', label: 'Minimal', desc: 'Simple, borderless layout' },
];

// v1.10.7 — audit H14. Extracted from the inline `items.map(...)` block
// in InvoiceGenerator. Wrapped in React.memo so only the row whose
// `item` reference changed re-renders on any keystroke.
//
// Contract:
//  • `item` — the specific line-item object. Only THIS row's ref
//    changes when the user types in it (handleItemChange uses
//    functional setState with `prev.map`, preserving unchanged item
//    references).
//  • All shared config props (invoiceOptions, units, countryTaxRates,
//    taxLabel, taxLabelIntlLabel, currency, showGST, profileCountry)
//    only change identity when they legitimately change — those DO
//    warrant a re-render across all rows.
//  • All handlers are useCallback in the parent so their identity
//    stays stable across renders.
//  • `suggestions` — the ROW's list of product suggestions. Passed in
//    as a plain array so React.memo can compare it shallowly.
//
// Perf win: typing "Widget" (6 chars) in row 1 of an invoice with 20
// items used to trigger 20 × 6 = 120 row re-renders. Now: 6 (just row 1).
const LineItem = memo(function LineItem({
  item, invoiceOptions, taxInclusive, showGST, taxLabel,
  units, countryTaxRates, filterUnitsByMode, invoiceMode,
  currency, profileCountry, suggestions,
  onFieldChange, onSelectProduct, onSetProductSearch,
  onAddCustomUnit, onRemoveCustomUnit, onRemove, clampNonNeg,
}) {
  return (
    <div className="line-item-row" data-item-id={item.id}>
      <div className="line-item-field" style={{ flex: 2.5, position: 'relative' }}>
        <label className="form-label">Description</label>
        <input type="text" className="form-input" value={item.name}
          onChange={(e) => onFieldChange(item.id, 'name', e.target.value)}
          onBlur={() => setTimeout(() => onSetProductSearch({ itemId: null, query: '' }), 200)}
          autoComplete="off" />
        {suggestions.length > 0 && (
          <div className="product-suggestions">
            {suggestions.map(p => (
              <div key={p.id} className="product-suggestion-item"
                onMouseDown={() => onSelectProduct(item.id, p)}>
                <span className="product-suggestion-name">{p.name}</span>
                <span className="product-suggestion-meta">
                  {p.hsn && `HSN: ${p.hsn}`}{p.hsn && p.rate ? ' · ' : ''}{p.rate ? formatCurrency(p.rate, currency || 'INR') : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {invoiceOptions.showHSN && (
        <div className="line-item-field" style={{ flex: 1, position: 'relative' }}>
          <label className="form-label">HSN/SAC</label>
          <input type="text" className="form-input" value={item.hsn}
            onChange={(e) => {
              const val = e.target.value;
              onFieldChange(item.id, 'hsn', val);
              // v1.10.22 — Suggest GST rate from a curated HSN/SAC table.
              // Only overwrites the tax rate when the user has NOT already
              // typed a custom rate (default 18 is treated as "unset").
              const suggested = suggestGstRate(val);
              if (suggested && (item.taxPercent === undefined || item.taxPercent === 18 || item.taxPercent === 0)) {
                onFieldChange(item.id, 'taxPercent', suggested.rate);
              }
            }} />
          {/* Show the label of the matched HSN inline so the user can
              confirm the code is right. Hidden until at least 4 chars. */}
          {(() => {
            const s = suggestGstRate(item.hsn);
            if (!s || !item.hsn || String(item.hsn).length < 4) return null;
            return (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 2, padding: '3px 6px', fontSize: '0.68rem', color: '#059669', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', zIndex: 1 }}
                title={`${s.label} — suggested ${s.rate}% GST`}>
                → {s.rate}% · {s.label}
              </div>
            );
          })()}
        </div>
      )}
      <div className="line-item-field" style={{ flex: 0.7 }}>
        <label className="form-label">Qty</label>
        <input type="number" min="0" step="any" className="form-input" value={item.quantity}
          onChange={(e) => onFieldChange(item.id, 'quantity', clampNonNeg(e.target.value))} />
      </div>
      <div className="line-item-field" style={{ flex: 0.9 }}>
        <label className="form-label">Unit</label>
        <select className="form-input" value={item.unit || 'Nos'}
          onChange={(e) => {
            if (e.target.value === '__custom__') { onAddCustomUnit(item.id); return; }
            if (e.target.value.startsWith('__remove__::')) {
              const label = e.target.value.replace('__remove__::', '');
              onRemoveCustomUnit(label);
              return;
            }
            onFieldChange(item.id, 'unit', e.target.value);
          }}>
          {(() => {
            const visible = filterUnitsByMode(units, invoiceMode);
            const showCurrentExtra = item.unit && !visible.some(u => u.label === item.unit);
            return (
              <>
                {showCurrentExtra && <option value={item.unit}>{item.unit}</option>}
                {visible.map(u => (
                  <option key={u.label} value={u.label}>{u.label}{u.custom ? ' ★' : ''}</option>
                ))}
              </>
            );
          })()}
          <option value="__custom__">＋ Add custom…</option>
          {units.some(u => u.custom) && units.filter(u => u.custom).map(u => (
            <option key={`rm-${u.label}`} value={`__remove__::${u.label}`}>− Remove "{u.label}"</option>
          ))}
        </select>
      </div>
      <div className="line-item-field" style={{ flex: 1.2 }}>
        <label className="form-label">Rate</label>
        <input type="number" min="0" step="any" className="form-input" value={item.rate}
          onChange={(e) => onFieldChange(item.id, 'rate', clampNonNeg(e.target.value))} />
      </div>
      {invoiceOptions.showDiscount && (
        <div className="line-item-field" style={{ flex: 1.8, minWidth: 200 }}>
          <label className="form-label">Discount</label>
          {/* v1.10.22 — two-mode discount: fixed rupees OR percent-of-line.
              v1.10.23 — wider min-width so value + mode selector stay
              readable on narrow rows.
              v1.10.25 — added third selector for the discount BASE when in
              fixed mode. Options: Net Amount (default), Unit Price (₹ off
              each unit × qty), Price With Tax (₹ off the tax-inclusive
              total — tax gets backed out so consumer sees clean round). */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <input type="number" min="0" step="any" className="form-input" value={item.discount}
              onChange={(e) => onFieldChange(item.id, 'discount', clampNonNeg(e.target.value))}
              style={{ flex: 1, minWidth: 55 }} />
            <select className="form-input"
              value={item.discountType === 'percent' ? 'percent' : 'fixed'}
              onChange={(e) => onFieldChange(item.id, 'discountType', e.target.value)}
              style={{ width: 52, padding: '0.4rem 0.3rem', fontSize: '0.82rem' }}
              title="Discount mode: fixed amount or percent of line">
              <option value="fixed">₹</option>
              <option value="percent">%</option>
            </select>
            {/* Base only meaningful for fixed-mode. Percent of any base is
                mathematically identical (proportional), so hide the
                selector when type='percent' to avoid dead UI. */}
            {item.discountType !== 'percent' && (
              <select className="form-input"
                value={item.discountBase || 'net'}
                onChange={(e) => onFieldChange(item.id, 'discountBase', e.target.value)}
                style={{ width: 78, padding: '0.4rem 0.3rem', fontSize: '0.75rem' }}
                title="What the ₹ discount applies to. Net = qty×rate (default). Unit = ₹X off each unit. WithTax = ₹X off tax-inclusive total.">
                <option value="net">Net</option>
                <option value="unit">Unit</option>
                <option value="with-tax">W/Tax</option>
              </select>
            )}
          </div>
        </div>
      )}
      {showGST && (
        <div className="line-item-field" style={{ flex: 1 }}>
          <label className="form-label">{taxLabel} %</label>
          <select className="form-input"
            value={countryTaxRates.includes(Number(item.taxPercent)) ? String(item.taxPercent) : '__custom__'}
            onChange={async (e) => {
              if (e.target.value === '__custom__') {
                const raw = await promptAction({
                  title: `Custom ${taxLabel} rate`,
                  message: `Enter a ${taxLabel} rate between 0% and 100% (up to 2 decimals).`,
                  defaultValue: String(item.taxPercent || 0),
                  placeholder: 'e.g. 7.5',
                  inputType: 'number',
                  confirmLabel: 'Apply rate',
                });
                if (raw === null) return;
                const n = parseFloat(raw);
                if (!isFinite(n) || n < 0 || n > 100) { toast('Tax rate must be between 0 and 100', 'warning'); return; }
                onFieldChange(item.id, 'taxPercent', n);
              } else {
                onFieldChange(item.id, 'taxPercent', parseFloat(e.target.value) || 0);
              }
            }}>
            {countryTaxRates.map(r => (
              <option key={r} value={String(r)}>{r}%</option>
            ))}
            <option value="__custom__">{countryTaxRates.includes(Number(item.taxPercent)) ? 'Custom…' : `${item.taxPercent}% (custom)`}</option>
          </select>
        </div>
      )}
      {showGST && invoiceOptions.showCess && (profileCountry || 'India') === 'India' && (
        <div className="line-item-field" style={{ flex: 0.8 }}>
          <label className="form-label" title="GST Compensation Cess (tobacco / auto / coal etc.)">Cess %</label>
          <input type="number" min="0" max="500" step="any" className="form-input"
            value={item.cessPercent || 0}
            onChange={(e) => onFieldChange(item.id, 'cessPercent', clampNonNeg(e.target.value))} />
        </div>
      )}
      <div className="line-item-field line-item-delete">
        <button className="icon-btn icon-btn-red" onClick={() => onRemove(item.id)} title="Remove"><Trash2 size={16} /></button>
      </div>
      {/* v1.10.22 — inline expandable description per row. Reported: "add
          option so user can directly enter product description into
          invoice directly". Hidden by default; expands on click. Persists
          with the item and renders under the item name in the PDF/preview. */}
      <div className="line-item-description-row" style={{ flexBasis: '100%', marginTop: 4 }}>
        {item.description || item._descOpen ? (
          <textarea
            className="form-input"
            rows={2}
            placeholder="Description (optional, shown under this line in the PDF)"
            value={item.description || ''}
            onChange={(e) => onFieldChange(item.id, 'description', e.target.value)}
            style={{ fontSize: '0.82rem', resize: 'vertical', minHeight: 40 }} />
        ) : (
          <button type="button" className="btn btn-secondary"
            onClick={() => onFieldChange(item.id, '_descOpen', true)}
            style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', color: 'var(--text-muted)' }}
            title="Add a description that will show under this line in the PDF">
            + Add description
          </button>
        )}
      </div>
    </div>
  );
});

export default function InvoiceGenerator({ onBack, profile: profileProp, editingBill }) {
  const draft = loadDraft();
  const [allProfiles, setAllProfiles] = useState([]);
  const [activeProfile, setActiveProfile] = useState(profileProp);
  const profile = activeProfile || profileProp;
  const [invoiceType, setInvoiceType] = useState(draft?.invoiceType || 'tax-invoice');
  // email/phone/isSEZ must be part of initial state — otherwise the SEZ flag
  // set inside ClientModal is silently discarded on save, and reopening the
  // bill can never restore contact fields even if the saved client has them.
  const [client, setClient] = useState(draft?.client || { name: '', address: '', city: '', pin: '', state: '', gstin: '', country: '', email: '', phone: '', isSEZ: false });
  // v1.9.1 — preview zoom (session-only). Reads from printSettings for the
  // initial value so the user's preference carries across bill switches.
  // v1.10.33 — Was READ-ONLY: the initial-load line pulled from
  // printSettings.previewZoom but nothing ever wrote it back. Every fresh
  // session started at 100% regardless of "sticky" comment. Now persists
  // on every change through the useEffect below. Also added a ref +
  // handleFitToWidth for the "Fit" button that actually fits.
  const previewPaneRef = useRef(null);
  const [previewZoom, setPreviewZoom] = useState(() => {
    try { return Number(getPrintSettings().previewZoom) || 100; } catch { return 100; }
  });
  useEffect(() => {
    try {
      const s = getPrintSettings();
      if (Number(s.previewZoom) !== previewZoom) {
        savePrintSettings({ ...s, previewZoom });
      }
    } catch { /* sandboxed localStorage — session-only degradation ok */ }
  }, [previewZoom]);
  // v1.10.33 — Actual fit-to-width. A4 preview renders at 794px @ 96dpi;
  // narrower paper sizes (A5, thermal, custom) can be smaller so we honor
  // the preview element's natural offsetWidth when possible. Fallback to
  // 794 covers the moment before InvoicePreview has mounted. Scale is
  // clamped 50-200% (matches the +/- limits so users don't get a "Fit"
  // that falls outside the range they can then tweak from).
  //
  // v1.10.33 (v2) — offsetWidth is LAYOUT width, unaffected by
  // `transform: scale(...)`. First cut divided by currentScale which
  // over-corrected on every click ("Fit → 44% → Fit → 24% → …").
  // Just read offsetWidth as-is — it's already the natural (unscaled)
  // width of the preview at the current paper size.
  const handleFitToWidth = useCallback(() => {
    if (!previewPaneRef.current) { setPreviewZoom(100); return; }
    const pane = previewPaneRef.current;
    const scaler = pane.querySelector('.preview-scaler');
    const preview = scaler?.querySelector('.invoice-preview-container');
    const paneWidth = pane.clientWidth - 16; // 8px inset breathing room on each side
    const naturalWidth = preview?.offsetWidth || 794;
    if (!(paneWidth > 0 && naturalWidth > 0)) { setPreviewZoom(100); return; }
    const ratio = paneWidth / naturalWidth;
    const nextZoom = Math.max(50, Math.min(200, Math.round(ratio * 100)));
    setPreviewZoom(nextZoom);
  }, []);
  // v1.10.22 — reported: "sidebar menu toggle option so customer will get
  // a close view for entries because quantity entry u see space is like
  // that we have to see in invoice preview what we are entering". Focus
  // mode: hide the preview so the editor gets the full width during
  // heavy data entry.
  const [previewCollapsed, setPreviewCollapsed] = useState(() => {
    try { return localStorage.getItem('fgsb_previewCollapsed') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('fgsb_previewCollapsed', previewCollapsed ? '1' : '0'); } catch { /* sandboxed */ }
  }, [previewCollapsed]);
  const [details, setDetails] = useState(draft?.details || {
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    placeOfSupply: '',
    originalInvoiceRef: '',
    // v1.10.11 — Ship To fields. Default: same as billing (no extra
    // fields shown). Untick to type a separate delivery address.
    shipToSameAsBilling: true,
    shippingAddress: '',
    shippingCity: '',
    shippingPin: '',
    shippingState: '',
  });

  const [items, setItems] = useState(draft?.items || [
    { id: Date.now().toString(), name: '', hsn: '', quantity: 1, unit: 'Nos', rate: 0, discount: 0, taxPercent: 18, cessPercent: 0 }
  ]);
  // v1.10.24 — Client credit balance state. Loaded once on mount + refreshed
  // when the client name changes. `creditToApply` is what the user chose to
  // apply on THIS bill; it becomes a `credit-applied` payment at save time,
  // paired with a `credit-transferred-out` entry on each source bill.
  const [allBillsForCredit, setAllBillsForCredit] = useState([]);
  const [creditToApply, setCreditToApply] = useState(0);
  const [units, setUnits] = useState(getAllUnits());
  const [taxInclusive, setTaxInclusive] = useState(draft?.taxInclusive || false);

  // v1.10.4 — totals is now a `useMemo` (was a `useState` fed by
  // `useEffect + setTotals` which forced a second full render on every
  // keystroke). Same value on every render for the same inputs; the
  // extra render pass per character was the biggest perf hit in this
  // component per the audit's finding H15.
  const [saving, setSaving] = useState(false);
  const [termsTemplates, setTermsTemplates] = useState([]);
  const [selectedTermsId, setSelectedTermsId] = useState(draft?.selectedTermsId || '');
  const [customTerms, setCustomTerms] = useState(draft?.customTerms || '');
  const [customNotes, setCustomNotes] = useState(draft?.customNotes || '');
  const [internalNote, setInternalNote] = useState(draft?.internalNote || '');
  const [extraSections, setExtraSections] = useState(draft?.extraSections || []);
  const [savedClients, setSavedClients] = useState([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [showClientModal, setShowClientModal] = useState(false);
  const [modalClient, setModalClient] = useState(null);
  const [isEditingClient, setIsEditingClient] = useState(false);
  const clientNameRef = useRef(null);
  const clientSuggestionsRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState({ itemId: null, query: '' });
  const [invoiceOptions, setInvoiceOptions] = useState(() => {
    try {
      const saved = localStorage.getItem('freegstbill_invoiceOptions');
      const persisted = saved ? JSON.parse(saved) : {};
      // v1.10.20 — paymentAccountSnapshot is per-bill data (frozen bank
      // details at time of save). It must NEVER be inherited via the
      // user-preference stores (localStorage / server). Strip on read so
      // opening Invoice B doesn't pick up Invoice A's snapshot.
      delete persisted.paymentAccountSnapshot;
      // Persisted options are the user's defaults, draft can override for in-progress work
      return { ...DEFAULT_OPTIONS, ...persisted, ...(draft?.invoiceOptions || {}) };
    } catch { return draft?.invoiceOptions || { ...DEFAULT_OPTIONS }; }
  });
  const [showOptions, setShowOptions] = useState(false);
  // v1.10.34 — Thermal receipt preview modal state. See directPrint below.
  const [showThermalPreview, setShowThermalPreview] = useState(false);
  const printRef = useRef(null);
  const draftInitialized = useRef(!!draft);
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const autoSaveTimer = useRef(null);
  // v1.10.22 — reported: "if user click back without even changing anything
  // it always ask to save and close". Cause: handleBack checked
  // `autoSaveStatus !== 'saved'`, and autoSaveStatus started at 'idle' on
  // mount (never flipping to 'saved' until an auto-save fired). So opening
  // an existing bill and immediately clicking Back showed the modal even
  // with zero edits. Now: `isDirty` is set only on real post-init changes,
  // and Back reads it instead. Cleared on successful save.
  const isDirty = useRef(false);
  // Skip stock deduction when EDITING an existing bill — but NOT when
   // duplicating one (P1 #21: `_isDuplicate` marks a new sale that must
   // decrement stock). Same logic applies to convert-to-tax-invoice which
   // sets _convertToType — that's also a new bill in a new type.
  const stockDeducted = useRef(!!editingBill && !editingBill?._isDuplicate && !editingBill?._convertToType);
  const hasInitialized = useRef(false); // prevent auto-save during initial load
  // Whether we've already atomically reserved a counter number for this form.
  // Peek-on-mount + reserve-on-save (P0 #9) avoids burning counter values on
  // cancelled/abandoned forms.
  const numberReserved = useRef(!!editingBill);
  // Whether the bill has been successfully persisted to the server AT LEAST
  // ONCE this session. Editing = true from the start (bill already exists).
  // For new bills, flips to true after the first successful save. Used to
  // decide whether subsequent saves need overwrite: true (they do — same
  // invoice number, otherwise the server 409s).
  const hasBeenSaved = useRef(!!editingBill);

  const typeConfig = INVOICE_TYPES[invoiceType];
  const showGST = invoiceOptions.showGST;
  // Tax label and rate presets follow the seller's country, not the client's, since
  // the seller charges and remits the tax. Sellers without a country fall back to India.
  const sellerCountryConfig = getCountryConfig(profile?.country);
  // v1.10.5 — audit M25 fix. Merge user's custom tax rates from Print
  // Settings into the country's default preset list. Prior code
  // persisted `customTaxRates` in localStorage but never read them
  // back, so the "Custom tax rate presets" UI in Print Settings was
  // dead weight. Now: user adds 3, 0.25, 7.5 → they appear in the
  // per-line tax dropdown alongside 0/5/12/18/28.
  const _psPrintForRates = getPrintSettings();
  const customRates = Array.isArray(_psPrintForRates.customTaxRates)
    ? _psPrintForRates.customTaxRates.map(Number).filter(n => isFinite(n) && n >= 0 && n <= 100)
    : [];
  const baseCountryRates = sellerCountryConfig.taxRates && sellerCountryConfig.taxRates.length
    ? sellerCountryConfig.taxRates
    : [0, 5, 12, 18, 28];
  const countryTaxRates = useMemo(
    () => [...new Set([...baseCountryRates, ...customRates])].sort((a, b) => a - b),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseCountryRates.join(','), customRates.join(',')]
  );
  const taxLabel = sellerCountryConfig.taxLabel || 'GST';

  // Clamp a numeric input to non-negative (and finite). Used for qty/rate/discount.
  // v1.10.7 — hoisted stable identity so memoized LineItem's props stay
  // shallow-equal across parent re-renders.
  const clampNonNeg = useCallback((raw) => {
    const n = parseFloat(raw);
    if (!isFinite(n) || n < 0) return 0;
    return n;
  }, []);

  // Persist options — v1.10.4 audit M16.
  // Prior: every checkbox flip fired an immediate `/api/display-options`
  // POST. Wiggling a toggle 10× → 10 network requests. localStorage
  // stays synchronous (needed for reload persistence); the server POST
  // is now debounced 800ms so quick option-tweak spins settle to one
  // request.
  const optionsPersistTimer = useRef(null);
  useEffect(() => {
    // v1.10.20 — Strip paymentAccountSnapshot before persisting. It's per-
    // bill data (bank details frozen at save time), not a user preference.
    // Prior code auto-persisted the entire invoiceOptions to localStorage
    // AND to the server, so opening Invoice A (Bank X snapshot) polluted
    // both stores, and opening Invoice B inherited Bank X — defeating the
    // v1.10.19 backfill entirely.
    const { paymentAccountSnapshot: _snap, ...persistable } = invoiceOptions;
    localStorage.setItem('freegstbill_invoiceOptions', JSON.stringify(persistable));
    if (hasInitialized.current) {
      clearTimeout(optionsPersistTimer.current);
      optionsPersistTimer.current = setTimeout(() => {
        saveInvoiceDisplayOptions(persistable).catch(() => {});
      }, 800);
    }
    return () => clearTimeout(optionsPersistTimer.current);
  }, [invoiceOptions]);

  // Load saved display options from server on mount (overrides localStorage if available)
  useEffect(() => {
    getInvoiceDisplayOptions().then(serverOpts => {
      if (serverOpts) {
        // v1.10.20 — Strip cross-invoice bleed-through of paymentAccountSnapshot
        // from any stale server-persisted options (pre-v1.10.20 clients would
        // have posted it). Preserves the current bill's snapshot in `prev`.
        delete serverOpts.paymentAccountSnapshot;
        const merged = { ...DEFAULT_OPTIONS, ...serverOpts };
        setInvoiceOptions(prev => {
          // Only update if different to avoid unnecessary re-renders
          const changed = Object.keys(merged).some(k => merged[k] !== prev[k]);
          if (changed) {
            // Preserve the per-bill snapshot from prev when applying server defaults.
            const nextOpts = { ...merged, paymentAccountSnapshot: prev.paymentAccountSnapshot };
            const { paymentAccountSnapshot: _skip, ...toPersist } = nextOpts;
            localStorage.setItem('freegstbill_invoiceOptions', JSON.stringify(toPersist));
            return nextOpts;
          }
          return prev;
        });
      }
    }).catch(() => {});
  }, []);

  // Auto-save draft to sessionStorage
  useEffect(() => {
    const draftData = { invoiceType, client, details, items, customTerms, customNotes, internalNote, extraSections, selectedTermsId, invoiceOptions, taxInclusive };
    sessionStorage.setItem('gst_invoiceDraft', JSON.stringify(draftData));
  }, [invoiceType, client, details, items, customTerms, customNotes, internalNote, extraSections, selectedTermsId, invoiceOptions, taxInclusive]);

  // Mark initialized after first render cycle so auto-save doesn't trigger on load
  useEffect(() => {
    const t = setTimeout(() => { hasInitialized.current = true; }, 1500);
    return () => clearTimeout(t);
  }, []);

  // An invoice is "meaningful" once it has a client name AND at least one line item
  // with a description and a non-zero amount. Until then we only auto-save to
  // sessionStorage (draft) — never to the persistent bills list. This prevents the
  // bug where opening "New Invoice" and clicking away saves an empty bill to the list.
  const isMeaningfulInvoice = useCallback(() => {
    if (editingBill) return true; // editing an existing bill — always persist changes
    if (!client?.name?.trim()) return false;
    return items.some(item => (item.name || '').trim() && (item.quantity || 0) * (item.rate || 0) > 0);
  }, [client?.name, items, editingBill]);

  // Debounced auto-save (2s after last change), gated on meaningful content.
  //
  // v1.8.1 CHANGE: for NEW bills that haven't been explicitly saved yet,
  // auto-save persists ONLY to the sessionStorage draft (via the effect
  // below that saves invoiceOptions). It does NOT hit the server or reserve
  // a counter number.
  //
  // Reason: users reported that opening "New Invoice" and typing burned
  // a counter value even if they never clicked Save. Auto-save was the
  // culprit — it fired 2s after any meaningful edit and atomically
  // reserved. The counter should only increment when the user commits.
  //
  // For EDITING existing bills (or after the first manual save), auto-save
  // still writes through to the server so mid-session edits are safe.
  useEffect(() => {
    if (!hasInitialized.current) return;
    // v1.10.22 — any real post-init change flips the dirty flag so Back
    // can distinguish "loaded and untouched" from "actually edited".
    isDirty.current = true;
    if (!details.invoiceNumber) return;
    if (!isMeaningfulInvoice()) {
      setAutoSaveStatus(s => s === 'saved' ? 'idle' : s);
      return;
    }

    // NEW-bill guard: skip server auto-save until the user has explicitly
    // saved once. The sessionStorage draft is still auto-persisted via the
    // separate effect below, so nothing is lost if the tab crashes.
    if (!editingBill && !hasBeenSaved.current) {
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus(s => s === 'saved' ? 'idle' : s), 2000);
      return;
    }

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      try {
        setAutoSaveStatus('saving');
        await saveInvoiceToDB(true);
        setAutoSaveStatus('saved');
        isDirty.current = false; // successful save clears dirty
        setTimeout(() => setAutoSaveStatus(s => s === 'saved' ? 'idle' : s), 2000);
      } catch (err) {
        console.error('Auto-save failed:', err);
        setAutoSaveStatus('idle');
      }
    }, 2000);

    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [invoiceType, client, details, items, customTerms, customNotes, internalNote, extraSections, invoiceOptions, isMeaningfulInvoice]);

  // Save-before-leave guard. P2 #32 rewrites this from the dangerous
  // browser `confirm()` (OK = save, Cancel = stay — users conditioned to
  // "Cancel = discard" hit Cancel expecting to leave) to a proper 3-option
  // modal. Modal state below; handleBack just opens it.
  const [leaveModal, setLeaveModal] = useState(false);
  const handleBack = () => {
    // v1.10.22 — use isDirty (real change tracking) instead of
    // autoSaveStatus. autoSaveStatus starts at 'idle' on mount and only
    // flips to 'saved' after an auto-save fires, so the old check reported
    // dirty-not-saved for every freshly-loaded bill.
    if (isMeaningfulInvoice() && isDirty.current) {
      setLeaveModal(true);
      return;
    }
    clearDraft();
    onBack();
  };

  const leaveActions = {
    saveAndExit: async () => {
      try {
        setAutoSaveStatus('saving');
        await saveInvoiceToDB(true);
        toast('Invoice saved', 'success');
        clearDraft();
        setLeaveModal(false);
        onBack();
      } catch {
        toast('Save failed — staying on the page so you can retry', 'error');
      }
    },
    discardAndExit: () => {
      clearDraft();
      setLeaveModal(false);
      onBack();
    },
    cancel: () => setLeaveModal(false),
  };

  useEffect(() => {
    const handler = (e) => {
      // v1.10.22 — mirror the handleBack fix: only warn on real dirty state.
      if (isMeaningfulInvoice() && isDirty.current) {
        e.preventDefault();
        e.returnValue = ''; // browsers show their own confirmation dialog
        return '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isMeaningfulInvoice]);

  const clearDraft = () => {
    sessionStorage.removeItem('gst_invoiceDraft');
  };

  // v1.10.16 — reported: user adds a 2nd business profile in Settings, comes
  // back to the invoice generator, but the "Billing From (Business Profile)"
  // chip row (which only renders when allProfiles.length > 1) doesn't
  // appear until they switch profiles once. Root cause: getAllProfiles()
  // fired once on mount; if the SPA kept InvoiceGenerator mounted while the
  // user was in Settings, the new profile never showed. Fix: also refetch
  // when the window regains visibility. Belt-and-braces since the
  // conditional-render path in App.jsx already unmounts+remounts, but this
  // covers the case where a stale server response is cached mid-navigation.
  useEffect(() => {
    const refetchProfiles = () => getAllProfiles().then(setAllProfiles).catch(() => {});
    const onVisible = () => { if (document.visibilityState === 'visible') refetchProfiles(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refetchProfiles);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refetchProfiles);
    };
  }, []);

  // Load terms templates and saved clients
  useEffect(() => {
    getAllProfiles().then(p => { setAllProfiles(p); if (!activeProfile && p.length > 0) setActiveProfile(profileProp); }).catch(() => {});
    getTermsTemplates().then(templates => {
      setTermsTemplates(templates);
      if (templates.length > 0 && !selectedTermsId && !draftInitialized.current) {
        setSelectedTermsId(templates[0].id);
        setCustomTerms(templates[0].content);
      }
    });
    getAllClients().then(clients => {
      setSavedClients(clients);
      // Auto-link if editing a bill with a known client
      if (client.name.trim()) {
        const match = clients.find(c => c.name.toLowerCase() === client.name.trim().toLowerCase());
        if (match) setSelectedClientId(match.id);
      }
    });
    getAllProducts().then(setProducts);
    // v1.10.24 — Load bills once for client-credit lookup. Refreshed after
    // save (inside saveInvoiceToDB's success path) so the balance stays
    // current when the same session creates multiple invoices for one client.
    getAllBills().then(setAllBillsForCredit).catch(() => {});
  }, []);

  // Initialize from editing bill or generate new number (skip if restoring from draft)
  useEffect(() => {
    if (draftInitialized.current) {
      draftInitialized.current = false;
      return;
    }
    if (editingBill?.data) {
      const d = editingBill.data;
      setClient(d.client);
      setItems(d.items);
      setInvoiceType(d.invoiceType || 'tax-invoice');
      if (d.customTerms !== undefined) setCustomTerms(d.customTerms);
      if (d.customNotes !== undefined) setCustomNotes(d.customNotes);
      if (d.internalNote !== undefined) setInternalNote(d.internalNote);
      if (d.extraSections) setExtraSections(d.extraSections);
      if (d.taxInclusive !== undefined) setTaxInclusive(d.taxInclusive);
      if (d.invoiceOptions) {
        // User's persisted defaults as base, bill options overlay
        // v1.10.19 — Backfill paymentAccountSnapshot for pre-v1.10.18 bills.
        // Reported after v1.10.18: "swaping bank account issue solve work on
        // old bills or not... i cant see it is working". Right — v1.10.18
        // only froze the snapshot at save time, so bills saved before that
        // release still resolved the bank via the live profile. But those
        // bills DID persist a full profile snapshot in d.profile since
        // v1.4.x, so we can recover the original account by looking it up
        // in d.profile.paymentAccounts (or the flat legacy fields).
        // v1.10.20 — Strip paymentAccountSnapshot from `persisted` before
        // merging. Otherwise Invoice A's snapshot (auto-saved to
        // localStorage) contaminates Invoice B's merge, and the
        // `!mergedOpts.paymentAccountSnapshot` check below sees a snapshot
        // that isn't actually the current bill's. That single bug defeated
        // the entire v1.10.19 backfill in practice.
        let mergedOpts = null;
        try {
          const saved = localStorage.getItem('freegstbill_invoiceOptions');
          const persisted = saved ? JSON.parse(saved) : {};
          delete persisted.paymentAccountSnapshot;
          mergedOpts = { ...DEFAULT_OPTIONS, ...persisted, ...d.invoiceOptions };
        } catch { mergedOpts = { ...DEFAULT_OPTIONS, ...d.invoiceOptions }; }
        // Backfilling only happens if the bill genuinely has no snapshot.
        // Check d.invoiceOptions directly (not mergedOpts) to sidestep any
        // remaining cross-store bleed-through.
        // v1.10.21 — Also heal contaminated snapshots from the v1.10.18–19
        // window. Reported: "after i full reloaded again all vanished and
        // asigned to same account which is default." Cause: bills saved
        // between v1.10.18 and v1.10.19 had snapshots polluted by
        // cross-invoice localStorage bleed — the snapshot's own `id` didn't
        // match the bill's selectedAccountId. v1.10.20 stopped the leak but
        // didn't touch the already-saved bad snapshots. Now: if the stored
        // snapshot's id doesn't match the stored selection, treat it as
        // stale and re-derive from d.profile (the frozen-at-save profile
        // snapshot, which still has the original account).
        const billSnap = d.invoiceOptions.paymentAccountSnapshot;
        const billSelId = d.invoiceOptions.selectedAccountId;
        const snapshotIsStale = billSnap && billSelId && billSnap.id && billSnap.id !== billSelId;
        if ((!billSnap || snapshotIsStale) && d.profile) {
          const snap = getAccountById(d.profile, billSelId);
          if (snap) mergedOpts.paymentAccountSnapshot = snap;
        }
        setInvoiceOptions(mergedOpts);
      }

      if (editingBill._isDuplicate) {
        const convertType = editingBill._convertToType;
        const type = convertType || d.invoiceType || 'tax-invoice';
        if (convertType) {
          setInvoiceType(convertType);
          const config = INVOICE_TYPES[convertType];
          if (config) setInvoiceOptions(prev => ({ ...prev, showGST: config.showGST, showPlaceOfSupply: config.showGST }));
        }
        // v1.10.10 — read per-type prefix override from print settings.
        const _psForPrefix = getPrintSettings();
        const rawOverride = _psForPrefix.customPrefixes?.[type];
        const overridePrefix = rawOverride && rawOverride.trim();
        const prefix = overridePrefix || INVOICE_TYPES[type]?.prefix || 'INV';
        getNextInvoiceNumber(prefix, { peek: true, explicitPrefix: !!overridePrefix }).then(num => {
          setDetails({ ...d.details, invoiceNumber: num, invoiceDate: new Date().toISOString().split('T')[0] });
          numberReserved.current = false;
        });
      } else {
        setDetails(d.details);
      }
    } else if (!details.invoiceNumber) {
      // v1.10.10 — honour the per-type prefix override for fresh invoices.
      const _psForPrefix = getPrintSettings();
      const rawOverride = _psForPrefix.customPrefixes?.[invoiceType];
      const overridePrefix = rawOverride && rawOverride.trim();
      const prefix = overridePrefix || INVOICE_TYPES[invoiceType]?.prefix || 'INV';
      getNextInvoiceNumber(prefix, { peek: true, explicitPrefix: !!overridePrefix }).then(num => {
        setDetails(prev => ({ ...prev, invoiceNumber: num }));
        numberReserved.current = false;
      });
    }
  }, [editingBill]);

  // Seed the payment-account selection on first render. For a freshly-created
  // invoice (no editingBill, no value yet) we prefer the profile's ⭐ default,
  // then the last-used account from localStorage, then the first active
  // account. Resolving here once means the dropdown shows the right value
  // immediately rather than flickering through nulls.
  // v1.10.22 — reported: "if user added two account and star the one account
  // while creating new invoice it shows old star account not new". Root
  // cause: prior priority was last-used → default → first-active. Changing
  // the ⭐ in Settings didn't invalidate the last-used pointer, so new
  // invoices kept picking the old account. Fix: ⭐ default always wins
  // when set. Last-used stays as a fallback when no account is starred
  // (e.g. an in-progress migration).
  useEffect(() => {
    if (editingBill) return; // editing — keep whatever the bill stored
    if (invoiceOptions.selectedAccountId) return; // already set
    if (!profile) return;
    const lastUsedKey = `gst_lastUsedAccountId_${profile.id || profile.businessName || 'default'}`;
    let candidate = null;
    try { candidate = localStorage.getItem(lastUsedKey); } catch { /* sandboxed */ }
    const active = getActiveAccounts(profile);
    const defaultId = getDefaultAccount(profile)?.id || null;
    const candidateResolves = candidate && active.some(a => a.id === candidate);
    const next = defaultId
      || (candidateResolves ? candidate : null)
      || active[0]?.id
      || null;
    if (next) setInvoiceOptions(prev => ({ ...prev, selectedAccountId: next }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.businessName, editingBill]);

  // Persist the just-used account to localStorage so the NEXT new invoice on
  // this profile defaults to the same one. Saved on every change rather than
  // only on Save so power users typing through 5 invoices in a row get sticky
  // behaviour even if they navigate without saving each one.
  useEffect(() => {
    if (!profile || !invoiceOptions.selectedAccountId) return;
    const lastUsedKey = `gst_lastUsedAccountId_${profile.id || profile.businessName || 'default'}`;
    try { localStorage.setItem(lastUsedKey, invoiceOptions.selectedAccountId); } catch { /* ignore */ }
  }, [profile?.id, profile?.businessName, invoiceOptions.selectedAccountId]);

  // When loading a saved bill, prefer the LIVE business profile that matches the bill's
  // snapshot (by id, falling back to businessName). Means a Settings rename / address
  // edit / new logo flows through to all historical invoices on next PDF render. Falls
  // back to the snapshot if that profile was deleted.
  useEffect(() => {
    if (!editingBill?.data?.profile || allProfiles.length === 0) return;
    const snap = editingBill.data.profile;
    const liveMatch = allProfiles.find(p =>
      (p.id && snap.id && p.id === snap.id) ||
      (p.businessName && p.businessName === snap.businessName)
    );
    if (liveMatch && liveMatch !== activeProfile) setActiveProfile(liveMatch);
  }, [editingBill, allProfiles, activeProfile]);

  const handleTypeChange = async (type) => {
    setInvoiceType(type);
    const config = INVOICE_TYPES[type];
    // v1.10.14 — honour the per-type prefix override when switching invoice type.
    const _psForPrefix = getPrintSettings();
    const rawOverride = _psForPrefix.customPrefixes?.[type];
    const overridePrefix = rawOverride && rawOverride.trim();
    const prefix = overridePrefix || config?.prefix || 'INV';
    // Peek — actual reservation happens on save.
    const num = await getNextInvoiceNumber(prefix, { peek: true, explicitPrefix: !!overridePrefix });
    numberReserved.current = false;
    setDetails(prev => ({ ...prev, invoiceNumber: num }));

    // Auto-set options based on type
    if (type === 'bill-of-supply') {
      setInvoiceOptions(prev => ({ ...prev, showGST: false, showPlaceOfSupply: false }));
    } else {
      setInvoiceOptions(prev => ({ ...prev, showGST: config.showGST, showPlaceOfSupply: config.showGST }));
    }
  };

  const toggleOption = (key) => {
    setInvoiceOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // v1.10.4 — useMemo replaces the prior useEffect+setTotals pair. Same
  // math (extracted to pure `computeInvoiceTotals` in v1.10.1), but
  // computed inline during render so React doesn't double-render on
  // every keystroke.
  const totals = useMemo(() => computeInvoiceTotals({
    items, profile, client, details, showGST, taxInclusive,
    invoiceOptions,
  }), [items, client.state, client?.isSEZ, profile?.state, profile?.country, showGST, taxInclusive, invoiceOptions.showRoundOff, invoiceOptions.showTDS, invoiceOptions.tdsRate, invoiceOptions.tdsCumulativeThisYear, invoiceOptions.showTCS, invoiceOptions.tcsRate, invoiceOptions.tcsCumulativeThisYear, invoiceOptions.reverseCharge, invoiceOptions.invoiceDiscountValue, invoiceOptions.invoiceDiscountType, details?.placeOfSupply]);

  // v1.10.24 — Compute available client credit from prior overpayments.
  // Excludes the bill we're editing (that would double-count our own
  // in-progress creditToApply state). `available` is the FIFO-orderable
  // total; `sources` powers the auditable "from Bill A/2026-27/00X" trail.
  const clientCredit = useMemo(() => {
    if (!client?.name?.trim()) return { available: 0, sources: [] };
    const otherBills = editingBill
      ? allBillsForCredit.filter(b => b.id !== editingBill.id)
      : allBillsForCredit;
    return getClientCredit(client.name, otherBills);
  }, [client?.name, allBillsForCredit, editingBill]);

  // Auto-apply once per client change when the setting is on. Uses a
  // ref-tracked "last seen client" so subsequent item edits (which move
  // totals.total up and down) don't blow away a user's manual override.
  const lastAutoAppliedClient = useRef(null);
  useEffect(() => {
    if (editingBill) return;
    if (!invoiceOptions.autoApplyClientCredit) {
      lastAutoAppliedClient.current = null;
      return;
    }
    const name = client?.name?.trim() || '';
    if (!name || lastAutoAppliedClient.current === name) return;
    lastAutoAppliedClient.current = name;
    const cap = Math.min(clientCredit.available, Number(totals.total) || 0);
    setCreditToApply(cap > 0.005 ? cap : 0);
  }, [client?.name, clientCredit.available, invoiceOptions.autoApplyClientCredit, editingBill]);

  // Warn when the seller's state is missing for Indian GST invoices — without it, the
  // interstate detection silently defaults to intrastate (CGST+SGST) which is a real money bug.
  useEffect(() => {
    const isIndia = (profile?.country || 'India') === 'India';
    if (!isIndia || !showGST) return;
    if (!profile?.state && client?.state) {
      const key = `gst_stateWarning_${profile?.businessName || 'profile'}`;
      if (!sessionStorage.getItem(key)) {
        toast('Set your business State in Settings — required for correct CGST/SGST vs IGST split.', 'warning');
        sessionStorage.setItem(key, '1');
      }
    }
  }, [profile?.state, profile?.country, profile?.businessName, client?.state, showGST]);

  // v1.10.7 — audit H14: handlers wrapped in useCallback so the memoized
  // LineItem below sees stable references and only re-renders the ROW
  // that actually changed. Prior code created new function identities
  // every render → every keystroke re-rendered EVERY line item.
  const handleItemChange = useCallback((id, field, value) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    if (field === 'name') {
      setProductSearch({ itemId: id, query: value });
    }
  }, []);

  const selectProduct = useCallback((itemId, product) => {
    // v1.10.29 — Prefer sellingPrice for sales invoices (falls back to
    // legacy `rate` for pre-v1.10.29 products).
    const salePrice = product.sellingPrice ?? product.rate ?? 0;
    setItems(prev => prev.map(item => item.id === itemId ? {
      ...item,
      name: product.name,
      hsn: product.hsn || '',
      rate: salePrice,
      unit: product.unit || item.unit || 'Nos',
      taxPercent: product.taxPercent ?? (countryTaxRates[countryTaxRates.length - 2] ?? 18),
      productId: product.id,
    } : item));
    setProductSearch({ itemId: null, query: '' });
  }, [countryTaxRates]);

  const getProductSuggestions = useCallback((itemId) => {
    if (productSearch.itemId !== itemId || !productSearch.query.trim()) return [];
    const q = productSearch.query.toLowerCase();
    return products.filter(p =>
      p.name?.toLowerCase().includes(q) || p.hsn?.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [productSearch.itemId, productSearch.query, products]);

  const addItem = () => {
    // Default unit depends on whether this invoice is for goods or services —
    // freelancers and consultants get 'Hrs' by default, retailers/manufacturers
    // get 'Nos'. The dropdown still shows the user's last-used unit if they've
    // overridden a previous row.
    const defaultUnit = items.length > 0 && items[items.length - 1].unit
      ? items[items.length - 1].unit
      : getDefaultUnitForMode(invoiceOptions.invoiceMode);
    const newId = Date.now().toString();
    setItems(prev => [...prev, {
      id: newId, name: '', hsn: '', quantity: 1, unit: defaultUnit, rate: 0, discount: 0,
      taxPercent: showGST ? (countryTaxRates[countryTaxRates.length - 2] ?? 18) : 0,
      cessPercent: 0,
    }]);
    // Move keyboard focus to the new row's Description field so users who
    // Tab to the Add Item button and press Enter don't have to grab the
    // mouse. requestAnimationFrame waits until React has actually rendered
    // the new row in the DOM before we try to find/focus it.
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-item-id="${newId}"] input.form-input`);
      if (el) el.focus();
    });
  };

  // Custom unit handler — prompts for a label, persists to localStorage, applies to current item.
  // v1.10.7 — useCallback for the LineItem memoization benefit.
  const handleAddCustomUnit = useCallback(async (itemId) => {
    const label = await promptAction({
      title: 'Add custom unit',
      message: 'Enter a short unit label. Saved for reuse across future invoices.',
      placeholder: 'e.g. Carat, Bundle, Bushel',
      confirmLabel: 'Add unit',
    });
    if (!label) return;
    const trimmed = label.trim();
    if (!trimmed) return;
    if (trimmed.length > 20) { toast('Unit name must be 20 characters or fewer', 'warning'); return; }
    const ok = addCustomUnit(trimmed);
    setUnits(getAllUnits());
    if (!ok) {
      toast(`Unit "${trimmed}" already exists or is reserved`, 'info');
    } else {
      toast(`Unit "${trimmed}" added`, 'success');
    }
    handleItemChange(itemId, 'unit', trimmed);
  }, [handleItemChange]);

  const handleRemoveCustomUnit = useCallback(async (label) => {
    if (!await confirmAction({
      title: `Remove custom unit "${label}"?`,
      message: 'Existing invoices keep this label unchanged. It just no longer appears in the unit dropdowns.',
      confirmLabel: 'Remove unit',
      tone: 'danger',
    })) return;
    removeCustomUnit(label);
    setUnits(getAllUnits());
    toast(`Removed custom unit "${label}"`, 'success');
  }, []);

  const removeItem = useCallback((id) => {
    // Uses functional setState so the useCallback dep can stay empty —
    // no stale-closure risk from items.length; the guard reads current.
    setItems(prev => prev.length > 1 ? prev.filter(item => item.id !== id) : prev);
  }, []);

  const handleTermsSelect = (templateId) => {
    setSelectedTermsId(templateId);
    const tpl = termsTemplates.find(t => t.id === templateId);
    if (tpl) setCustomTerms(tpl.content);
  };

  const selectSavedClient = (cli) => {
    // Spread the FULL client — earlier versions cherry-picked six fields
    // and silently dropped country/email/phone/isSEZ. Consequence: loading
    // an SEZ client via auto-complete cleared the SEZ flag, so the invoice
    // computed CGST+SGST instead of IGST → wrong tax on the filed return.
    setClient({
      name: cli.name || '',
      address: cli.address || '',
      city: cli.city || '',
      pin: cli.pin || '',
      state: cli.state || '',
      gstin: cli.gstin || '',
      country: cli.country || '',
      email: cli.email || '',
      phone: cli.phone || '',
      isSEZ: !!cli.isSEZ,
    });
    setSelectedClientId(cli.id);
    setShowClientSuggestions(false);
    // v1.9.1 — auto-apply per-client print preferences (if set on the client
    // record). Overrides invoice-level defaults for this session. Only fires
    // for NEW bills (not when editing) since editing bills keep saved options.
    //
    // v1.10.12 — reported: "one client is set with thermal invoice print,
    // others are also changing the preview". Root cause: prior code only
    // set a patch WHEN the client had a preference — so switching from
    // Client A (thermal) → Client B (no preference) left the thermal
    // setting sticky. Now we ALWAYS assign paperSize / currency /
    // clientAutoPrint to the new client's value OR the app default, so
    // client B resets to A4/INR cleanly.
    if (!editingBill) {
      setInvoiceOptions(prev => ({
        ...prev,
        // v1.10.33 — Was `cli.preferredPaperSize || 'a4'` which HARD-RESET
        // to A4 for every client without an explicit preference — wiping
        // out the user's globally saved default (e.g. someone who prints
        // every invoice on 80mm thermal would land back on A4 the moment
        // they picked a client). Now falls back to prev.paperSize so
        // globally-persisted choice sticks until the user changes it.
        paperSize: cli.preferredPaperSize || prev.paperSize || 'a4',
        currency: cli.preferredCurrency || prev.currency || 'INR',
        // v1.10.5 — client-level auto-print override (see original comment).
        clientAutoPrint: !!cli.autoPrint,
      }));
    }
    toast(`Loaded client: ${cli.name}`, 'info');
  };

  // Open modal to add new client (pre-fill from current invoice fields)
  const openAddClientModal = () => {
    setModalClient({ name: client.name || '', address: client.address || '', city: client.city || '', pin: client.pin || '', state: client.state || '', gstin: client.gstin || '' });
    setIsEditingClient(false);
    setShowClientModal(true);
    setShowClientSuggestions(false);
  };

  // Open modal to edit existing saved client
  const openEditClientModal = (cli) => {
    setModalClient(cli);
    setIsEditingClient(true);
    setShowClientModal(true);
  };

  // Save from modal (add or update)
  const handleClientModalSave = async (formData) => {
    const data = { ...formData };
    if (isEditingClient && modalClient?.id) data.id = modalClient.id;
    await saveClient(data);
    const updated = await getAllClients();
    setSavedClients(updated);
    // Sync the invoice form with the FULL saved record — dropping
    // country/email/phone/isSEZ here was the SEZ tax bug.
    setClient({
      name: data.name || '',
      address: data.address || '',
      city: data.city || '',
      pin: data.pin || '',
      state: data.state || '',
      gstin: data.gstin || '',
      country: data.country || '',
      email: data.email || '',
      phone: data.phone || '',
      isSEZ: !!data.isSEZ,
    });
    if (isEditingClient && modalClient?.id) {
      setSelectedClientId(modalClient.id);
      toast(`Client "${data.name}" updated!`, 'success');
    } else {
      const found = updated.find(c => c.name === data.name.trim() && !savedClients.some(old => old.id === c.id));
      if (found) setSelectedClientId(found.id);
      toast(`Client "${data.name}" saved!`, 'success');
    }
    setShowClientModal(false);
  };

  // v1.10.6 — audit L15. Small filter but cheap to memoize; keeps the
  // suggestion list identity stable across renders where neither
  // input matters (saves a downstream re-render of the suggestion
  // dropdown).
  const filteredClients = useMemo(() => {
    const q = client.name.trim().toLowerCase();
    if (!q) return savedClients;
    return savedClients.filter(cli => cli.name.toLowerCase().includes(q));
  }, [client.name, savedClients]);

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (clientSuggestionsRef.current && !clientSuggestionsRef.current.contains(e.target) &&
          clientNameRef.current && !clientNameRef.current.contains(e.target)) {
        setShowClientSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const saveInvoiceToDB = async (skipStockDeduction = false, extraPatch = {}) => {
    // Lazy counter reservation: if this is a NEW bill (no editingBill) and
    // the invoice number is still the peeked value, do the atomic increment
    // now. This means a mounted-but-cancelled form doesn't burn a counter
    // number → gapless sequences for CA-audited businesses.
    //
    // v1.9.0 — extraPatch lets callers stamp print-history fields
    // (printedCount + lastPrintedAt) at save time without needing to
    // pipe them through the entire bill state.
    let finalInvoiceNumber = details.invoiceNumber;
    if (!editingBill && !numberReserved.current) {
      try {
        // v1.10.10 — honour user's per-type prefix override.
        const _psForPrefix = getPrintSettings();
        const rawOverride = _psForPrefix.customPrefixes?.[invoiceType];
        const overridePrefix = rawOverride && rawOverride.trim();
        const prefix = overridePrefix || INVOICE_TYPES[invoiceType]?.prefix || 'INV';
        finalInvoiceNumber = await getNextInvoiceNumber(prefix, { explicitPrefix: !!overridePrefix });
        setDetails(prev => ({ ...prev, invoiceNumber: finalInvoiceNumber }));
        numberReserved.current = true;
      } catch { /* fall back to the peeked value; server will 409 if it collides */ }
    }

    // v1.10.18 — reported: "if i change bank account for the customer to one
    // bank then other also changed to that — it should show the bank was
    // selected at the time of making but it wont." Root cause: InvoicePreview
    // resolves the account via getAccountById(profile, selectedAccountId) at
    // render time. Only the id is stored on the bill; account details
    // (bankName, accountNumber, IFSC, UPI) come from the CURRENT profile at
    // render time. So editing "Bank A" in Settings retroactively rewrote
    // every historical invoice that had used Bank A. Fix: freeze the resolved
    // account into invoiceOptions.paymentAccountSnapshot at save time.
    // v1.10.19 — When the invoiceOptions already carry a snapshot AND its id
    // matches the current selection, KEEP it. This preserves the backfilled
    // snapshot for pre-v1.10.18 bills that get re-saved without a bank
    // change. Only re-snapshot from the live profile when the user
    // intentionally switched to a different account (id changed) or when
    // no prior snapshot exists.
    const priorSnapshot = invoiceOptions.paymentAccountSnapshot;
    const priorMatchesSelection = priorSnapshot && priorSnapshot.id === invoiceOptions.selectedAccountId;
    const snapAccount = priorMatchesSelection
      ? priorSnapshot
      : getAccountById(profile, invoiceOptions.selectedAccountId);
    const invoiceOptionsWithSnapshot = { ...invoiceOptions, paymentAccountSnapshot: snapAccount || null };

    // v1.10.24 — Plan client-credit application. If the user chose to
    // apply any credit on this invoice (via the banner in the Billed To
    // section), compute the dual-entry patches now: a `credit-applied`
    // payment on this bill + `credit-transferred-out` entries on the
    // source overpaid bills. Both are applied inside the try/catch
    // below so a save failure doesn't leave the source bills half-updated.
    const creditPlan = (!editingBill && creditToApply > 0.005)
      ? planCreditApplication(client.name, allBillsForCredit, creditToApply, finalInvoiceNumber)
      : null;

    const seedPayments = editingBill?.payments ? [...editingBill.payments] : [];
    if (creditPlan?.targetEntry) seedPayments.push(creditPlan.targetEntry);
    const seedPaidAmount = seedPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const seedStatus = editingBill?.status
      || (seedPaidAmount >= (Number(totals.total) || 0) - 0.005 ? 'paid'
          : (seedPaidAmount > 0.005 ? 'partial' : 'unpaid'));

    const bill = {
      id: finalInvoiceNumber,
      clientName: client.name,
      invoiceNumber: finalInvoiceNumber,
      invoiceDate: details.invoiceDate,
      invoiceType,
      currency: invoiceOptions.currency || 'INR',
      totalAmount: totals.total,
      // v1.10.1 — was `cgst + sgst + igst` which omitted UTGST and cess.
      // Reports treated cess as revenue for tobacco/auto/coal sellers.
      totalTaxAmount: totals.totalTaxAmount ?? (totals.cgst + totals.sgst + (totals.utgst || 0) + totals.igst + (totals.cess || 0)),
      status: seedStatus,
      paidAmount: seedPaidAmount,
      payments: seedPayments,
      // Preserve any pre-existing print history + carry through the patch
      printedCount: extraPatch.printedCount ?? editingBill?.printedCount ?? 0,
      lastPrintedAt: extraPatch.lastPrintedAt ?? editingBill?.lastPrintedAt ?? null,
      data: { profile, client, details: { ...details, invoiceNumber: finalInvoiceNumber }, items, totals, invoiceType, customTerms, customNotes, internalNote, extraSections, invoiceOptions: invoiceOptionsWithSnapshot, taxInclusive }
    };
    // Editing an existing bill → always overwrite. NEW bill on second-and-
    // later save this session → also overwrite (same invoice number, would
    // otherwise 409). NEW bill on first save → no overwrite, so a typo
    // hitting an existing invoice number gets caught by the server.
    const shouldOverwrite = !!editingBill || hasBeenSaved.current;
    try {
      await saveBill(bill, { overwrite: shouldOverwrite });
      // v1.10.24 — Follow-up: write the `credit-transferred-out` entries
      // to each source overpaid bill. Sequential so a failure on any one
      // stops the chain (rare — same origin, same server, right after we
      // just succeeded on the primary save). If any patch does fail, the
      // primary bill still has the credit-applied entry; the source
      // bill's overpayment display just remains stale until it's edited.
      // Toast lets the user know.
      if (creditPlan?.sourcePatches?.length) {
        try {
          for (const { updatedBill } of creditPlan.sourcePatches) {
            await saveBill(updatedBill, { overwrite: true });
          }
          const applied = creditPlan.amountApplied;
          const from = creditPlan.consumedFrom.map(c => c.invoiceNumber).join(', ');
          toast(`${formatCurrency(applied, invoiceOptions.currency || 'INR')} credit applied from ${from}`, 'success');
          // Refresh local bills list so the credit banner drops for next time.
          getAllBills().then(setAllBillsForCredit).catch(() => {});
          setCreditToApply(0);
        } catch (creditErr) {
          console.error('Source-bill credit patch failed:', creditErr);
          toast('Credit applied on this bill, but source bill update failed. Please review Client ledger.', 'warning');
        }
      }
      // v1.10.35 — Reported: "if user has selected thermal or any paper
      // size according to client it should always show that same auto or
      // else if user create new invoice and select thermal and if again
      // create new invoice with a4 pdf it should remember the choice and
      // next time show same so that if user change in new it won't
      // change that in older one".
      //
      // Behaviour:
      //  - Client selected: persist paperSize + currency + auto-print
      //    onto the client record so next invoice for that client
      //    defaults to the same choice.
      //  - No client selected: fall through to global default (already
      //    persisted via localStorage 'freegstbill_invoiceOptions' on
      //    every options change — see the useEffect around line 594).
      //  - Prior client-select code (~line 1131) reads cli.preferred*
      //    already, so this write-side fix closes the loop.
      // Fire-and-forget: don't block the save UX on a preference update.
      if (selectedClientId) {
        const cli = savedClients.find(c => c.id === selectedClientId);
        if (cli) {
          const nextPaperSize = invoiceOptions.paperSize || 'a4';
          const nextCurrency = invoiceOptions.currency || 'INR';
          const changed = cli.preferredPaperSize !== nextPaperSize
            || cli.preferredCurrency !== nextCurrency;
          if (changed) {
            const updatedClient = {
              ...cli,
              preferredPaperSize: nextPaperSize,
              preferredCurrency: nextCurrency,
            };
            saveClient(updatedClient).then(() => {
              // Refresh the in-memory clients list so subsequent
              // handleSelectClient calls see the new preference.
              setSavedClients(prev => prev.map(c => c.id === cli.id ? updatedClient : c));
            }).catch(() => { /* non-blocking */ });
          }
        }
      }
      // Mark that the invoice has been persisted at least once — subsequent
      // saves (auto-save, Save & Leave, Save & Download) can safely overwrite.
      hasBeenSaved.current = true;
      isDirty.current = false; // v1.10.22 — successful save clears dirty flag
    } catch (err) {
      if (err?.status === 409) {
        // v1.10.23 — reported (GH #16): "A bill with this invoice number
        // already exists" on create/update/status-change/add-payment. Root
        // cause: the atomic counter can lag behind the actual bills on
        // disk (backup restore, cross-tab save, hand-crafted bill numbers)
        // so `peek` returns an id that already exists → 409. Prior code
        // forced the user to hand-fix the number. Now: for a NEW bill,
        // retry with a fresh reservation, incrementing the counter until
        // we land on a truly unused number (capped at 20 tries so a
        // pathological data state can't spin forever).
        if (!editingBill && !shouldOverwrite) {
          const _psForPrefix = getPrintSettings();
          const rawOverride = _psForPrefix.customPrefixes?.[invoiceType];
          const overridePrefix = rawOverride && rawOverride.trim();
          const prefix = overridePrefix || INVOICE_TYPES[invoiceType]?.prefix || 'INV';
          let nextNum = bill.id;
          let success = false;
          for (let i = 0; i < 20; i++) {
            try {
              nextNum = await getNextInvoiceNumber(prefix, { explicitPrefix: !!overridePrefix });
              const retryBill = { ...bill, id: nextNum, invoiceNumber: nextNum };
              retryBill.data = { ...retryBill.data, details: { ...retryBill.data.details, invoiceNumber: nextNum } };
              await saveBill(retryBill, { overwrite: false });
              success = true;
              // Push the new number back into the form so the preview + any
              // subsequent save operate on the resolved id.
              setDetails(prev => ({ ...prev, invoiceNumber: nextNum }));
              hasBeenSaved.current = true;
              isDirty.current = false;
              if (nextNum !== bill.id) {
                toast(`Invoice number ${bill.id} was already used — saved as ${nextNum} instead.`, 'info');
              }
              break;
            } catch (retryErr) {
              if (retryErr?.status !== 409) throw retryErr;
              // else: number still taken, loop and try again with next counter.
            }
          }
          if (!success) {
            toast(`Could not find a free invoice number after 20 attempts. Please change the number manually.`, 'error');
            return;
          }
        } else {
          toast(`Invoice number ${bill.id} already exists. Change it before saving.`, 'error');
          return;
        }
      } else {
        throw err;
      }
    }

    // If the user ticked "Make this recurring", create/update the recurring
    // template alongside the invoice. We store enough on the template to
    // regenerate identical future invoices: client snapshot + items +
    // invoice options. Server-side processDueRecurring uses these.
    if (invoiceOptions.recurring?.enabled) {
      try {
        const rec = invoiceOptions.recurring;
        const templateId = `tpl_${details.invoiceNumber}`; // stable: tied to source invoice number
        await saveRecurring({
          id: templateId,
          sourceInvoiceId: details.invoiceNumber,
          active: true,
          frequency: rec.frequency || 'monthly',
          interval: rec.interval || 1,
          nextDate: rec.nextDate,
          endMode: rec.endMode || 'never',
          endDate: rec.endDate || '',
          maxOccurrences: rec.maxOccurrences || null,
          occurrencesCreated: 0,
          createdAt: new Date().toISOString(),
          lastGenerated: null,
          // Snapshot the data needed to regenerate. Profile is resolved live at
          // generation time (so business renames flow through), but client,
          // items, invoiceType, customTerms, etc. are frozen as the user wants
          // them on every recurring instance.
          clientName: client.name,
          clientState: client.state,
          clientGstin: client.gstin,
          clientAddress: client.address,
          clientCountry: client.country,
          clientCity: client.city,
          clientPin: client.pin,
          clientEmail: client.email,
          clientPhone: client.phone,
          isSEZ: client.isSEZ,
          invoiceType,
          profileId: profile?.id || null,
          profileBusinessName: profile?.businessName || null,
          items: items.map(i => ({ ...i })),
          customTerms,
          customNotes,
          extraSections,
          taxInclusive,
          invoiceOptions: { ...invoiceOptions, recurring: null }, // strip the recurring config from clones
        });
      } catch (err) {
        console.error('Failed to save recurring template:', err);
        toast('Invoice saved, but recurring template failed to save', 'warning');
      }
    }

    // Auto-deduct stock only once for new invoices (not edits, not auto-saves)
    if (!skipStockDeduction && !stockDeducted.current) {
      stockDeducted.current = true;
      const currentProducts = await getAllProducts();
      const lowStockWarnings = [];

      for (const item of items) {
        if (!item.productId) continue;
        const product = currentProducts.find(p => p.id === item.productId);
        if (!product) continue;

        const updatedStock = (product.stock || 0) - (item.quantity || 0);
        await saveProduct({ ...product, stock: updatedStock });

        if (updatedStock <= 0) {
          lowStockWarnings.push(`${product.name} is now out of stock!`);
        } else if (updatedStock <= 5) {
          lowStockWarnings.push(`${product.name} has only ${updatedStock} left in stock`);
        }
      }

      const refreshed = await getAllProducts();
      setProducts(refreshed);

      for (const warning of lowStockWarnings) {
        toast(warning, 'warning');
      }
    }
  };

  // Upload PDF to Google Drive if configured
  const uploadToGoogleDrive = async (pdfBlob, fileName) => {
    try {
      const latestProfile = await getProfile();
      const clientId = latestProfile.googleClientId;
      const folderName = latestProfile.googleDriveFolder || 'GST Billing Invoices';
      if (!clientId) return;

      const hasToken = await ensureToken(clientId);
      if (!hasToken) {
        toast('Google Drive: Please reconnect in Settings', 'warning');
        return;
      }

      const folderId = await findOrCreateFolder(folderName);
      await uploadPDF(fileName, pdfBlob, folderId);
      toast(`Saved to Google Drive → ${folderName}`, 'success');
    } catch (err) {
      console.error('Google Drive upload error:', err);
      toast('Google Drive upload failed: ' + err.message, 'warning');
    }
  };

  // Shared PDF generation helper. v1.10.3 — wraps the whole body in
  // try/finally so `scalerEl.style.transform` is always restored, even
  // if html2canvas or jsPDF throws mid-render. Prior code only restored
  // on the success path — an exception left the on-screen preview
  // stuck at scale 1.0 until the user navigated away.
  const buildPDF = async () => {
    const printSettings = getPrintSettings();
    const scalerEl = printRef.current.closest('.preview-scaler');
    if (scalerEl) scalerEl.style.transform = 'none';
    try {
      return await __buildPDFInner(printSettings);
    } finally {
      if (scalerEl) scalerEl.style.transform = '';
    }
  };

  const __buildPDFInner = async (printSettings) => {

    // PDF quality / size trade-off:
    //   - `compress: true` deflate-compresses PDF streams (incl. embedded images).
    //     Adds ~50-150ms but typically shrinks output by 15-30%.
    //   - Render scale = max(3, devicePixelRatio * 2). Bumping from 2 to 3 makes text
    //     visibly sharper without much file-size increase, because JPEG compresses
    //     clean line-art / glyphs efficiently. On Retina/4K screens we go higher.
    //   - JPEG quality 0.95 vs old 0.92: gain in legibility for small text outweighs
    //     the modest size bump.
    // Paper size (v1.8.1) — read from invoiceOptions. A4 default; A5 uses
    // jsPDF's built-in format; thermal 80mm/58mm use custom [width, height].
    // Thermal formats use a tall single-column layout — the InvoicePreview
    // component branches on options.paperSize CSS class to render compact.
    const paperCfg = getPaperSize(invoiceOptions.paperSize, invoiceOptions);
    // jsPDF orientation defaults to 'portrait' if the paper config doesn't
    // specify it, so pre-v1.8.3 saved bills keep rendering portrait.
    // Note: `let pdf` (not const) so the thermal path can replace it with
    // a content-height-sized instance after html2canvas returns — thermal
    // receipts were previously always 297mm tall regardless of actual
    // content, wasting 15-20cm of blank paper per receipt when the PDF
    // was reprinted.
    let pdf = new jsPDF({
      orientation: paperCfg.jsPdfOrientation || 'portrait',
      unit: 'mm',
      format: paperCfg.jsPdfFormat,
      compress: true,
    });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfPageHeight = pdf.internal.pageSize.getHeight();
    const extraPages = printRef.current.querySelectorAll('[data-pdf-page]');
    // v1.9.1 — quality-driven render scale + JPEG quality:
    //   draft   → scale 2, JPEG 0.85 → ~50% smaller PDF, email-friendly
    //   standard→ scale 3, JPEG 0.95 → default (existing behaviour)
    //   hd      → scale max(4, dpr*3), JPEG 0.98 → archival quality, larger
    // v1.10.3 — Scale is now capped at 6× on any device. Prior code
    // `Math.max(4, dpr * 3)` on a 4× DPR Android phone hit 12× → an
    // A4 canvas at 100 megapixels → OOM crash before jsPDF ever ran.
    // Also: PNG for HD (crisp text edges — invoices are line-art),
    // JPEG for draft/standard (file size wins). Prior always-JPEG
    // smudged glyph edges on high-DPI screens.
    const capScale = (n) => Math.min(6, Math.max(2, Math.round(n)));
    const qualityCfg = {
      draft:    { scale: 2, imgFormat: 'JPEG', quality: 0.85 },
      standard: { scale: capScale(Math.max(3, (window.devicePixelRatio || 1) * 2)), imgFormat: 'JPEG', quality: 0.95 },
      hd:       { scale: capScale(Math.max(4, (window.devicePixelRatio || 1) * 2.5)), imgFormat: 'PNG', quality: 1.0 },
    };
    const q = qualityCfg[printSettings.pdfQuality] || qualityCfg.standard;
    const renderScale = q.scale;
    const jpegQuality = q.quality;
    const imgFormat = q.imgFormat;   // 'JPEG' or 'PNG'
    // v1.10.3 — Await webfonts before rasterising. On a cold load,
    // html2canvas fired before Inter finished downloading → the capture
    // used fallback fonts with wrong glyph metrics → table columns
    // overflowed. `document.fonts.ready` resolves once every declared
    // font has loaded (or failed).
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch { /* non-fatal */ }
    }

    const captureOptions = (el) => ({
      scale: renderScale,
      // v1.10.3 — useCORS was `true` but every image source is a base64
      // data URL (profile.logo, generated QR). `useCORS: true` triggers
      // a CORS preflight on any relative URL that slips in and silently
      // fails; today it's a dead flag but was flagged as fragile.
      useCORS: false,
      logging: false,
      letterRendering: true,
      backgroundColor: '#ffffff',
      // v1.10.3 — was `0` (disable). A broken image (bad logo, stale
      // QR) hung the capture indefinitely, giving the user a stuck
      // "Generating…" spinner. 15s is enough for real images + a
      // fallback for corrupt ones.
      imageTimeout: 15_000,
      width: el.scrollWidth,
      height: el.scrollHeight,
    });

    // Hide extra pages, capture main invoice.
    // v1.10.8 — audit M21 real fix. Prior code stamped the same tall
    // canvas at successive negative-Y offsets. Any row straddling a
    // pdfPageHeight boundary was cut mid-content on the PDF seam.
    // Now: pre-measure the DOM row boundaries so we can crop each
    // virtual page at a safe row-boundary instead of blindly slicing
    // every pdfPageHeight mm.
    //
    // Elements collected as "no-split-inside" anchors:
    //  • Every <tr> in the items table  → keep rows whole.
    //  • .inv-header / .inv-parties     → keep title + billing block whole.
    //  • .inv-footer-block              → keep bank / T&C / notes whole.
    //  • [data-pdf-page-boundary]       → escape hatch for future needs.
    //
    // The set collected here is DOM pixels relative to printRef.current.
    // We convert to canvas pixels below (× domToCanvasScale) once html2canvas
    // has returned and we know the true canvas.width.
    const collectRowBoundaries = (container) => {
      const containerRect = container.getBoundingClientRect();
      const nodes = container.querySelectorAll(
        '.inv-table tbody tr, .inv-table thead tr, .inv-header, .inv-parties, ' +
        '.inv-footer-block, .inv-totals, [data-pdf-page-boundary]'
      );
      const set = new Set([0]);
      nodes.forEach(el => {
        const r = el.getBoundingClientRect();
        set.add(Math.max(0, r.bottom - containerRect.top));
        set.add(Math.max(0, r.top - containerRect.top));
      });
      return [...set].sort((a, b) => a - b);
    };
    const domBoundariesPx = collectRowBoundaries(printRef.current);
    const domContainerWidth = printRef.current.getBoundingClientRect().width;

    extraPages.forEach(el => el.style.display = 'none');
    const mainCanvas = await html2canvas(printRef.current, {
      ...captureOptions(printRef.current),
      onclone: (clonedDoc) => {
        clonedDoc.querySelectorAll('*').forEach(n => { n.style.letterSpacing = '0px'; n.style.wordSpacing = '0px'; });
        const inv = clonedDoc.getElementById('invoice-preview');
        if (inv) {
          // Match the target paper width so html2canvas captures at the right
          // aspect ratio. jsPDF will scale to fit the page width; we set the
          // HTML width to widthMm so glyphs land where CSS put them.
          inv.style.width = `${paperCfg.widthMm}mm`;
          inv.style.overflow = 'visible'; inv.style.minHeight = 'unset';
          inv.style.border = 'none'; inv.style.boxShadow = 'none'; inv.style.borderRadius = '0';
          // v1.9.2 — add printing-mode class so CSS rules force darker colours
          // in the PDF capture. Fixes user complaint that A4/A5 output had
          // very-light gray text that faded on paper printers. Users can
          // turn this off in Print Settings if their printer is fine with
          // lighter greys.
          if (printSettings.pdfDarkenOnPrint !== false) {
            inv.classList.add('printing-mode');
          }
        }
        clonedDoc.querySelectorAll('[data-pdf-page]').forEach(el => el.style.display = 'none');
      }
    });
    extraPages.forEach(el => el.style.display = '');

    // v1.10.3 — Record each original page as a "recipe" so multi-copy
    // (GST Rule 48) can duplicate multi-page invoices correctly.
    // v1.10.8 — Each recipe is now its own cropped image (was: one
    // shared tall image with negative-Y offsets). See M21 note above.
    const mainImgHeight = (mainCanvas.height * pdfWidth) / mainCanvas.width;
    const pageRecipes = [];

    // v1.10.9 — Wire print margins. Prior code ignored `marginTop/Bottom/
    // Left/Right` from printSettings entirely — the UI existed, defaults
    // were in printSettings.js, but no consumer read them. Now: margins
    // shift the invoice image inside each PDF page. Useful for
    // pre-printed letterheads where content must clear the top logo,
    // or for printers with built-in edge margins.
    const mTop = Math.max(0, Number(printSettings.marginTop) || 0);
    const mBottom = Math.max(0, Number(printSettings.marginBottom) || 0);
    const mLeft = Math.max(0, Number(printSettings.marginLeft) || 0);
    const mRight = Math.max(0, Number(printSettings.marginRight) || 0);

    // v1.10.10 — PDF Font Scale now applies at the PDF-placement layer,
    // not just via CSS on the preview. Prior fix (v1.10.9) set an inline
    // `font-size: 80%` on the container, which correctly changed the
    // preview because parent-relative sizing cascaded to a few text
    // nodes — but html2canvas captures the DOM at its natural size, and
    // most children use `rem`/`px` (not `em`), so the raster came out
    // at 100% and the "80% compact" setting silently did nothing in the
    // real PDF. Now: multiply BOTH placement width AND height by the
    // scale. The invoice image lands smaller on the page → text is
    // proportionally smaller → more content fits per PDF page. This
    // matches how MS Word / LibreOffice "shrink to fit" works.
    const rawScale = Number(printSettings.pdfFontScale);
    const pdfScale = isFinite(rawScale) && rawScale > 0
      ? Math.max(0.5, Math.min(1.4, rawScale))
      : 1.0;
    const availWidth = Math.max(20, pdfWidth - mLeft - mRight);
    const availHeight = Math.max(20, pdfPageHeight - mTop - mBottom);
    const contentWidth = availWidth * pdfScale;
    const contentHeight = availHeight * pdfScale;
    // Centre the scaled invoice inside the available margin box so
    // shrunk PDFs don't hug the left edge.
    const contentXOffset = mLeft + (availWidth - contentWidth) / 2;
    const contentYOffset = mTop; // top-aligned; bottom margin absorbs slack
    // Recompute the image's rendered height using the reduced content width
    // so aspect ratio stays correct after margins are applied.
    const scaledImgHeight = (mainCanvas.height * contentWidth) / mainCanvas.width;

    if (scaledImgHeight <= contentHeight + 2) {
      // Single-page fits — no cropping needed.
      const mainImg = mainCanvas.toDataURL(imgFormat === 'PNG' ? 'image/png' : 'image/jpeg', jpegQuality);
      const finalH = Math.min(scaledImgHeight, contentHeight);
      // v1.10.33 — Thermal receipts: replace the padded 72×297mm page
      // with one exactly tall enough for the actual receipt content.
      // Prior behaviour: a 40-line receipt on thermal80 produced a PDF
      // with the receipt in the top ~130mm and 165mm of blank paper
      // below — visible in Chrome's Save-as-PDF preview as the huge
      // dark area below the "cut here" line the user reported. Now
      // the PDF page height matches the receipt height (+ margins),
      // so the PDF looks like the on-screen preview.
      //
      // Only fires for the single-page path — multi-page thermal
      // (extremely long receipts) still uses paperCfg.heightMm as a
      // reasonable page-break unit.
      if (paperCfg.kind === 'thermal') {
        const thermalHeightMm = Math.max(30, Math.ceil(finalH + mTop + mBottom + 2));
        pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: [paperCfg.widthMm, thermalHeightMm],
          compress: true,
        });
      }
      pdf.addImage(mainImg, imgFormat, contentXOffset, contentYOffset, contentWidth, finalH, undefined, 'MEDIUM');
      pageRecipes.push({ img: mainImg, y: contentYOffset, h: finalH, x: contentXOffset, w: contentWidth });
    } else {
      // v1.10.8 multi-page path — snap page breaks to safe DOM row boundaries.
      //
      // 1. Convert DOM-pixel boundaries → canvas-pixel boundaries.
      const domToCanvasScale = mainCanvas.width / domContainerWidth;
      const canvasBoundariesPx = domBoundariesPx.map(y => y * domToCanvasScale);
      const totalCanvasHeightPx = mainCanvas.height;
      if (!canvasBoundariesPx.includes(totalCanvasHeightPx)) {
        canvasBoundariesPx.push(totalCanvasHeightPx);
      }
      canvasBoundariesPx.sort((a, b) => a - b);

      // 2. How many canvas pixels correspond to one CONTENT height?
      // v1.10.9 — was pdfPageHeight * (mainCanvas.width / pdfWidth). Now
      // uses contentHeight (page - top - bottom margins) so page breaks
      // respect the margin band.
      const pdfPageHeightCanvasPx = contentHeight * (mainCanvas.width / contentWidth);

      // 3. Walk the canvas top-to-bottom, allocating pages. For each
      //    page: find the largest boundary ≤ naive end, but > current
      //    page start (progress guarantee).
      const pageSplits = [];
      let pageStart = 0;
      let safety = 0;
      while (pageStart < totalCanvasHeightPx && safety++ < 100) {
        const naiveEnd = pageStart + pdfPageHeightCanvasPx;
        if (naiveEnd >= totalCanvasHeightPx) {
          pageSplits.push({ start: pageStart, end: totalCanvasHeightPx });
          break;
        }
        // Prefer the LAST boundary at or before naiveEnd; must exceed pageStart.
        let safeEnd = null;
        for (let i = canvasBoundariesPx.length - 1; i >= 0; i--) {
          const b = canvasBoundariesPx[i];
          if (b <= naiveEnd + 1 && b > pageStart + 20) {   // +20px min progress
            safeEnd = b;
            break;
          }
        }
        // No safe boundary found in range (a single "row" bigger than a page,
        // e.g. a huge terms block). Fall back to a hard slice — but still
        // print SOMETHING rather than looping forever.
        if (safeEnd === null) safeEnd = naiveEnd;
        pageSplits.push({ start: pageStart, end: safeEnd });
        pageStart = safeEnd;
      }

      // 4. For each page, crop mainCanvas → temp canvas → data URL → PDF.
      // v1.10.9 — margins; v1.10.10 — pdfFontScale via centred placement.
      for (let i = 0; i < pageSplits.length; i++) {
        const { start, end } = pageSplits[i];
        const cropHeight = end - start;
        if (cropHeight < 1) continue;
        const tmp = document.createElement('canvas');
        tmp.width = mainCanvas.width;
        tmp.height = cropHeight;
        const ctx = tmp.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, tmp.width, cropHeight);
        ctx.drawImage(mainCanvas, 0, -start);
        const pageImg = tmp.toDataURL(imgFormat === 'PNG' ? 'image/png' : 'image/jpeg', jpegQuality);
        const pageMmHeight = (cropHeight * contentWidth) / mainCanvas.width;
        if (i > 0) pdf.addPage();
        pdf.addImage(pageImg, imgFormat, contentXOffset, contentYOffset, contentWidth, pageMmHeight, undefined, 'MEDIUM');
        pageRecipes.push({ img: pageImg, y: contentYOffset, h: pageMmHeight, x: contentXOffset, w: contentWidth });
      }
    }

    // Capture each extra section as a separate PDF page (also recipe-tracked).
    for (const pageEl of extraPages) {
      const c = await html2canvas(pageEl, {
        ...captureOptions(pageEl),
        onclone: (cd) => { cd.querySelectorAll('*').forEach(n => { n.style.letterSpacing = '0px'; n.style.wordSpacing = '0px'; }); }
      });
      const extraImg = c.toDataURL(imgFormat === 'PNG' ? 'image/png' : 'image/jpeg', jpegQuality);
      const extraH = Math.min((c.height * pdfWidth) / c.width, pdfPageHeight);
      pdf.addPage();
      pdf.addImage(extraImg, imgFormat, 0, 0, pdfWidth, extraH, undefined, 'MEDIUM');
      pageRecipes.push({ img: extraImg, y: 0, h: extraH });
    }

    // v1.10.3 — scalerEl restoration moved to outer buildPDF's `finally`
    // block so it runs even if a later step throws.

    // ============================================================
    // v1.9.0 post-processing — every step below is toggleable via
    // printSettings. Priority order is:
    //   1. Add margins (visual white border, if user set them)
    //   2. Multi-copy expansion (Original / Duplicate / Triplicate)
    //   3. Watermark overlay
    //   4. Reprint indicator
    //   5. Barcode / QR of invoice number
    //   6. Feedback QR
    //   7. Page numbers + business header on subsequent pages
    // ============================================================
    const ps = printSettings; // captured from closure below
    const totalPages = pdf.getNumberOfPages();

    // ----- Multi-copy (Original / Duplicate / Triplicate) -----
    // GST Rule 48 for goods: 3 copies. For services: 2 copies.
    // v1.10.3 — Rebuilt to correctly duplicate multi-page invoices. See
    // pageRecipes comment above for background.
    if (ps.multiCopyEnabled && ps.multiCopyCount > 1) {
      const labels = ps.multiCopyLabels || ['ORIGINAL', 'DUPLICATE', 'TRIPLICATE'];
      const originalPageCount = pageRecipes.length;   // correct: 1 recipe per original page
      // Replay every original page for each additional copy.
      for (let copyIdx = 1; copyIdx < ps.multiCopyCount; copyIdx++) {
        for (const recipe of pageRecipes) {
          pdf.addPage();
          // v1.10.9 — margins carry through to duplicated copies via
          // recipe.x/w (fallback to 0/pdfWidth for legacy shapes).
          pdf.addImage(recipe.img, imgFormat,
            recipe.x ?? 0, recipe.y,
            recipe.w ?? pdfWidth, recipe.h,
            undefined, 'MEDIUM');
        }
      }
      // Now stamp corner labels using a math that actually corresponds
      // to which copy each page belongs to (was wrong before too).
      const totalCopies = ps.multiCopyCount;
      for (let copyIdx = 0; copyIdx < totalCopies; copyIdx++) {
        const label = labels[Math.min(copyIdx, labels.length - 1)] || `COPY ${copyIdx + 1}`;
        for (let p = 1; p <= originalPageCount; p++) {
          const absolutePage = copyIdx * originalPageCount + p;
          pdf.setPage(absolutePage);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(8);
          pdf.setTextColor(80, 80, 80);
          const labelWidth = pdf.getTextWidth(label) + 6;
          pdf.setDrawColor(80, 80, 80);
          pdf.setLineWidth(0.3);
          pdf.rect(pdfWidth - labelWidth - 4, 4, labelWidth, 6, 'S');
          pdf.text(label, pdfWidth - labelWidth - 1, 8);
          pdf.setTextColor(0);
        }
      }
    }

    // v1.10.3 — free the multi-megabyte base64 image strings once
    // multi-copy replay is done. Post-processing steps below only
    // mutate the PDF pages, they don't need the source images. Prior
    // code held mainImg + pageRecipes in closure through the whole
    // watermark/QR/page-number loop, doubling peak memory.
    pageRecipes.length = 0;

    // v1.10.12 — Gate the A4/A5-only post-processing on thermal paper.
    // Reports: (a) "watermark coming for thermal also — it should not
    // come", (b) page numbers "Page 2 of 3" don't make sense on a
    // continuous receipt roll, (c) invoice QR / feedback QR crowd out
    // the actual print on 58mm rolls. All post-processing steps below
    // are skipped when the paper is thermal.
    // v1.10.33 — Same fix as isThermalPaper below. `.startsWith('thermal')`
    // missed the `custom` preset at sub-100mm widths, so a Custom 76mm
    // PDF got the sheet-only watermark / page numbers / QR overlays that
    // don't belong on a thermal roll.
    const isThermalPdf = getPaperSize(invoiceOptions.paperSize, invoiceOptions).kind === 'thermal';

    // ----- Watermark overlay -----
    // v1.10.12 — Cleaned up the preset ↔ custom decision:
    //   • Custom mode ON  + custom text FILLED   → use custom text.
    //   • Custom mode ON  + custom text EMPTY    → skip (no silent
    //     fallback to preset — that was the confusing behavior
    //     reported as "after selecting predefined then customer
    //     watermark or else it is not working").
    //   • Custom mode OFF → use preset.
    //   • Master toggle OFF or thermal paper       → skip entirely.
    let rawText = null;
    if (!isThermalPdf && ps.watermarkEnabled) {
      if (ps.watermarkUseCustomText) {
        rawText = ps.watermarkCustomText ? ps.watermarkCustomText : null;
      } else {
        rawText = ps.watermarkText || null;
      }
    }
    if (rawText) {
      const text = String(rawText).toUpperCase();
      const opacity = Math.max(0, Math.min(1, (Number(ps.watermarkOpacity) || 15) / 100));
      const angle = Number(ps.watermarkAngle) || -35;
      const size = Number(ps.watermarkFontSize) || 90;
      const finalPages = pdf.getNumberOfPages();
      for (let p = 1; p <= finalPages; p++) {
        pdf.setPage(p);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(size);
        // jsPDF opacity via GState (setGState)
        try {
          const gState = new pdf.GState({ opacity });
          pdf.setGState(gState);
        } catch { /* older jsPDF versions — fallback to grey text */ }
        pdf.setTextColor(200, 200, 200);
        // Center the watermark on the page
        const cx = pdfWidth / 2;
        const cy = pdfPageHeight / 2;
        pdf.text(text, cx, cy, { align: 'center', angle });
        try {
          const gState = new pdf.GState({ opacity: 1 });
          pdf.setGState(gState);
        } catch { /* no-op */ }
        pdf.setTextColor(0);
      }
    }

    // ----- Reprint indicator (automatic when this bill has been printed before) -----
    if (!isThermalPdf && ps.reprintLabelEnabled && Number(editingBill?.printedCount) > 0) {
      const label = `REPRINT · Copy #${(Number(editingBill.printedCount) || 0) + 1}`;
      const finalPages = pdf.getNumberOfPages();
      for (let p = 1; p <= finalPages; p++) {
        pdf.setPage(p);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(220, 38, 38);
        const w = pdf.getTextWidth(label) + 4;
        pdf.setDrawColor(220, 38, 38);
        pdf.rect(4, 4, w, 6, 'S');
        pdf.text(label, 6, 8);
        pdf.setTextColor(0);
      }
    }

    // ----- Barcode / QR of invoice number -----
    if (!isThermalPdf && (ps.invoiceQrEnabled || ps.invoiceBarcodeEnabled)) {
      // Use the qrcode library that's already a dep for UPI QR
      const QRCode = (await import('qrcode')).default;
      const qrPayload = ps.invoiceQrUrl
        ? ps.invoiceQrUrl.replace(/\{invoice_number\}/g, encodeURIComponent(details.invoiceNumber))
        : details.invoiceNumber;
      if (ps.invoiceQrEnabled) {
        try {
          const qrDataUrl = await QRCode.toDataURL(qrPayload, { errorCorrectionLevel: 'M', margin: 0, width: 200 });
          pdf.setPage(pdf.getNumberOfPages());
          const size = 18; // mm
          pdf.addImage(qrDataUrl, 'PNG', pdfWidth - size - 6, pdfPageHeight - size - 12, size, size);
          pdf.setFontSize(6); pdf.setTextColor(80);
          pdf.text('Verify invoice', pdfWidth - size - 6, pdfPageHeight - 6);
          pdf.setTextColor(0);
        } catch { /* skip on error */ }
      }
      // "Barcode" — jsPDF can't render true Code128 without a lib, so we render
      // a big monospace text version of the invoice number that scans as OCR-able
      // and is legible for humans + warehouse workflows.
      if (ps.invoiceBarcodeEnabled) {
        pdf.setPage(pdf.getNumberOfPages());
        pdf.setFont('courier', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(0);
        pdf.text(String(details.invoiceNumber), 8, pdfPageHeight - 6);
      }
    }

    // ----- Feedback / Review QR -----
    if (!isThermalPdf && ps.feedbackQrEnabled && ps.feedbackQrUrl) {
      const QRCode = (await import('qrcode')).default;
      try {
        const dataUrl = await QRCode.toDataURL(ps.feedbackQrUrl, { errorCorrectionLevel: 'M', margin: 0, width: 200 });
        pdf.setPage(pdf.getNumberOfPages());
        const size = 16;
        pdf.addImage(dataUrl, 'PNG', 6, pdfPageHeight - size - 12, size, size);
        pdf.setFontSize(6); pdf.setTextColor(80);
        pdf.text(ps.feedbackQrLabel || 'Rate us', 6, pdfPageHeight - 6);
        pdf.setTextColor(0);
      } catch { /* skip */ }
    }

    // ----- Page numbers + business header on subsequent pages -----
    if (!isThermalPdf && (ps.pageNumbersEnabled || ps.pageHeaderEnabled) && pdf.getNumberOfPages() > 1) {
      const finalPages = pdf.getNumberOfPages();
      for (let p = 2; p <= finalPages; p++) {
        pdf.setPage(p);
        if (ps.pageHeaderEnabled && profile?.businessName) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9);
          pdf.setTextColor(80);
          pdf.text(profile.businessName, 8, 6);
          pdf.setDrawColor(200); pdf.setLineWidth(0.2);
          pdf.line(8, 8, pdfWidth - 8, 8);
          pdf.setTextColor(0);
        }
        if (ps.pageNumbersEnabled) {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.setTextColor(120);
          pdf.text(`Page ${p} of ${finalPages}`, pdfWidth - 8, pdfPageHeight - 4, { align: 'right' });
          pdf.setTextColor(0);
        }
      }
    }

    return pdf;
  };

  // Per-view keyboard shortcuts.
  //   Ctrl/Cmd+S       — save invoice (no PDF) if meaningful
  //   Ctrl/Cmd+P       — download PDF
  //   Ctrl/Cmd+Enter   — add a new line item (v1.10.22)
  //   Ctrl/Cmd+Shift+D — duplicate the LAST line item (v1.10.22)
  //   Esc              — close the leave-guard modal (v1.10.22)
  useEffect(() => {
    const onKey = (e) => {
      // Esc closes the leave modal without needing Ctrl.
      if (e.key === 'Escape' && leaveModal) {
        e.preventDefault();
        setLeaveModal(false);
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === 's' || e.key === 'S') {
        if (!isMeaningfulInvoice()) return; // nothing to save
        e.preventDefault();
        saveInvoiceToDB(true).then(() => toast('Invoice saved', 'success')).catch(() => toast('Save failed', 'error'));
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        // Defer to the next tick so the keydown doesn't race the PDF render.
        setTimeout(() => generatePDF(), 0);
      } else if (e.key === 'Enter') {
        // Add a new line item. Doesn't fire when the user is inside a form
        // element that should get Enter (rich-text editor autofocus etc.) —
        // browsers dispatch Ctrl+Enter to the row-level input which won't
        // preventDefault by itself.
        e.preventDefault();
        addItem();
      } else if (e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        // Duplicate the last item — quick win for "same item, next line".
        e.preventDefault();
        setItems(prev => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          return [...prev, { ...last, id: Date.now().toString() }];
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMeaningfulInvoice, leaveModal]);

  // v1.10.3 — Shared print-via-iframe helper. Prior code duplicated the
  // "createObjectURL + iframe + revoke on load" pattern in 3 places and
  // ALL 3 leaked the blob URL if `onload` never fired (broken PDF,
  // iframe blocked). Now: revoked in error handler AND unconditionally
  // on load. Iframe stays (reused by id) but does not accumulate.
  const printViaIframe = (blob) => {
    const url = URL.createObjectURL(blob);
    let cleaned = false;
    const cleanup = () => { if (!cleaned) { cleaned = true; URL.revokeObjectURL(url); } };
    // Belt: 90s hard timeout in case onload never fires.
    const timer = setTimeout(cleanup, 90_000);
    try {
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
        // Give the print job ~60s to grab the buffer, then revoke.
        setTimeout(() => { clearTimeout(timer); cleanup(); }, 60_000);
      };
      frame.onerror = () => { clearTimeout(timer); cleanup(); };
    } catch (err) {
      clearTimeout(timer); cleanup(); throw err;
    }
  };

  // v1.10.3 — Thermal receipts (58mm / 80mm rolls) no longer go through
  // html2canvas → JPEG → jsPDF. That path was 100× the CPU/memory of
  // what's needed for a text-only receipt. Now: for thermal paper sizes
  // we hand the browser the invoice HTML directly via a print-focused
  // window.print() flow. Modern printer drivers handle 58/80mm rolls
  // natively when the CSS `@page size` matches.
  //
  // v1.10.33 — Bug fix: was `.startsWith('thermal')` which does NOT
  // match the `custom` preset even when its width is under 100mm
  // (getPaperSize returns kind='thermal' for those). So a user picking
  // Custom 76mm was routed through the sheet-print path — thick roll
  // wasted paper, watermark stamped on receipt, HSN/rate lines shown.
  // Now: single source of truth — getPaperSize().kind.
  const isThermalPaper = () => getPaperSize(invoiceOptions.paperSize, invoiceOptions).kind === 'thermal';

  // v1.10.26 — Focus mode moves the preview pane off-screen (position:
  // absolute), which is fine for html2canvas (layout still computed) but
  // breaks window.print() for thermal (prints visible viewport only).
  // Un-collapse the preview for the duration of any print / download
  // operation and restore after.
  //
  // v1.10.27 — Reported: "after print, preview panel comes back up and
  // hiding again have to click." Prior code registered an `afterprint`
  // listener + 30s safety timeout, which never fired in two of the three
  // paths and left the preview expanded:
  //   - Download PDF has NO print dialog → afterprint never fires
  //   - A4 iframe print → afterprint fires on iframe.contentWindow, not
  //     the parent window we were listening on
  //   - Only thermal window.print() correctly fired afterprint on parent
  //
  // Fix: restore in the finally block, unconditionally. window.print()
  // blocks the JS thread until the native dialog closes on all desktop
  // browsers, so the restore happens after the user is done with print.
  // On mobile Safari where print() may not block, the DOM was already
  // captured at the moment print() was invoked, so restoring right after
  // is safe.
  const withPreviewOnScreen = async (fn) => {
    const wasCollapsed = previewCollapsed;
    if (!wasCollapsed) return fn();
    setPreviewCollapsed(false);
    // v1.10.28 — bumped settle from 50ms → 200ms. Reported: PDF sometimes
    // came out with content shoved to top-left on slower devices. Root
    // cause: after removing position: absolute, browser needs a real layout
    // pass; 50ms wasn't enough for React commit + reflow on low-end Android.
    // Two rAFs + a settle timeout so React commits the DOM change AND
    // the browser lays out the newly-visible preview before we snapshot.
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 200))));
    try {
      return await fn();
    } finally {
      setPreviewCollapsed(true);
    }
  };

  const directPrint = async () => {
    if (!printRef.current) return;
    // v1.10.34 — Thermal now opens a dedicated preview modal instead
    // of the buildPDF → iframe path. Reasons:
    //   - buildPDF rasterizes text via html2canvas → JPEG, losing
    //     glyph sharpness at small font sizes on 203dpi thermal
    //     printers.
    //   - The compact modal doubles as a preview — user sees exactly
    //     what will print, then clicks Print. Matches the POS-app UX
    //     the user shared as a reference ("preview like this").
    //   - The modal's Print button uses raw HTML in a hidden iframe
    //     with @page: size widthMm auto → Chrome sends VECTOR text
    //     to the driver. Text stays crisp at any DPI. See
    //     ThermalPreviewModal.jsx for details.
    // A4 / sheet paper still use the existing buildPDF path.
    if (isThermalPaper()) {
      setShowThermalPreview(true);
      return;
    }
    setSaving(true);
    try {
      await withPreviewOnScreen(async () => {
      try {
        const pdf = await buildPDF();
        const blob = pdf.output('blob');
        printViaIframe(blob);
      } catch (err) {
        console.error('A4 print failed', err);
        toast('Print failed — try Download PDF instead', 'error');
      }
      }); // end withPreviewOnScreen
    } catch (e) {
      toast('Print failed — try Download PDF instead', 'error');
    } finally {
      setSaving(false);
    }
  };

  const generatePDF = async () => {
    if (!printRef.current) return;
    try {
      setSaving(true);
      // v1.10.26 — force preview on-screen so html2canvas can snapshot it.
      // Wrapped around buildPDF only (the rest of the flow can happen with
      // preview back to collapsed state).
      const pdf = await withPreviewOnScreen(() => buildPDF());
      const fileName = `${typeConfig.prefix}_${details.invoiceNumber.replace(/\//g, '-')}.pdf`;
      pdf.save(fileName);

      // v1.9.0 — bump print history + save. Both the local bill record and
      // the server copy get updated so the reprint indicator + history
      // views stay accurate. printedCount defaults to 0 and increments
      // once per PDF generated.
      const prevPrinted = Number(editingBill?.printedCount) || 0;
      const printedPatch = {
        printedCount: prevPrinted + 1,
        lastPrintedAt: new Date().toISOString(),
      };
      await saveInvoiceToDB(false, printedPatch);
      clearDraft();

      const pdfBlob = pdf.output('blob');

      // Save to local "Saved Invoices" folder (Client Name / Month / file.pdf)
      const invoiceDate = details.invoiceDate ? new Date(details.invoiceDate) : new Date();
      const monthName = invoiceDate.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
      const clientName = client?.name || 'General';
      const params = new URLSearchParams({ name: fileName, client: clientName, month: monthName });
      fetch(`/api/save-pdf?${params}`, { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: pdfBlob }).catch(() => {});

      toast(`Invoice downloaded & saved to Saved Invoices/${clientName}/`, 'success');
      uploadToGoogleDrive(pdfBlob, fileName);

      // v1.10.3 — auto-print via the shared printViaIframe helper.
      // v1.10.5 — also fire when the loaded client has autoPrint=true,
      // even if the app-wide autoPrintOnSave is off (per-client override).
      const ps = getPrintSettings();
      if (ps.autoPrintOnSave || invoiceOptions.clientAutoPrint) {
        try { printViaIframe(pdfBlob); }
        catch { /* non-fatal — user already has the PDF downloaded */ }
      }
    } catch (err) {
      console.error(err);
      toast('Failed to generate PDF.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const shareWhatsApp = () => {
    // v1.10.29 — reported: "when i use whatsapp button it is sending
    // subtotal amount". Cause: this used `items.reduce((s, i) => s +
    // (i.quantity * i.rate), 0)` — that's the pre-tax subtotal, not the
    // invoice total. Now uses totals.total (post-tax, post-discount, with
    // round-off + TCS + invoice-level discount all applied) — the same
    // number that appears on the PDF and gets saved as bill.totalAmount.
    const cur = invoiceOptions.currency || 'INR';
    const total = formatCurrency(Number(totals.total) || 0, cur);
    const subtotal = formatCurrency(Number(totals.subtotal) || 0, cur);
    const dateStr = details.invoiceDate ? new Date(details.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
    const businessName = profile?.businessName || '';
    const lines = [
      `*Invoice: ${details.invoiceNumber}*`,
      `Date: ${dateStr}`,
      `Client: ${client?.name || ''}`,
      `Subtotal: ${subtotal}`,
      `*Total: ${total}*`,
    ];
    if (businessName) lines.push('', `— ${businessName}`);
    openWhatsAppShare(client?.phone, lines.join('\n'));
  };

  const exportEWayBill = () => {
    if (!profile?.gstin) { toast('Set your GSTIN in Settings first', 'warning'); return; }
    // v1.10.1 — Pass taxInclusive so back-calc taxable value on line items.
    // Otherwise E-Way Bill portal rejects with `amount_mismatch` on MRP-inclusive invoices.
    const ewb = generateEWayBillJSON(profile, client, details, items, totals, invoiceType, { taxInclusive });
    const blob = new Blob([JSON.stringify(ewb, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EWB-${details.invoiceNumber?.replace(/\//g, '-') || 'draft'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('E-Way Bill JSON downloaded', 'success');
  };

  return (
    <div className="generator-container">
      <div className="generator-toolbar">
        <div className="flex gap-2 items-center">
          <button className="btn btn-secondary" onClick={handleBack}><ArrowLeft size={18} /> Back</button>
          <HelpButton title="Invoice Generator — how to use">
            <ul style={{ paddingLeft: '1.1rem', margin: 0 }}>
              <li><strong>Invoice type</strong> — Tax Invoice / Proforma / Bill of Supply / Composition / Credit Note / Delivery Challan. Switching type refreshes the number to that type's counter (or your custom prefix from Print Settings).</li>
              <li><strong>Line items</strong> — start typing to auto-complete from your Products list. HSN autofills the GST rate for common codes. Click "+ Add description" for a detailed note under the item name.</li>
              <li><strong>Discount</strong> — per line: pick ₹ (fixed) or % of the line. Below the items: whole-bill discount, applied after tax.</li>
              <li><strong>Customize</strong> — toggle columns and sections on/off, pick paper size (A4 / A5 / 58mm / 80mm thermal), change the invoice title and PDF style.</li>
              <li><strong>Focus mode</strong> — the ▶/◀ button at the top hides the preview so the editor takes the full screen for heavy data entry.</li>
              <li><strong>Keyboard</strong> — Ctrl+S save · Ctrl+P PDF · Ctrl+Enter add row · Ctrl+Shift+D duplicate last row · Esc close leave modal.</li>
              <li><strong>Auto-save</strong> — every 2s once the invoice is meaningful (client + at least one item). Back button is safe if you haven't touched anything.</li>
            </ul>
          </HelpButton>
          <span style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4,
            color: autoSaveStatus === 'saving' ? 'var(--text-muted)'
                 : autoSaveStatus === 'saved' ? '#059669'
                 : isMeaningfulInvoice() ? '#94a3b8' : '#cbd5e1' }}>
            {autoSaveStatus === 'saving' && <><Loader size={13} className="spin" /> Saving...</>}
            {autoSaveStatus === 'saved' && <><Check size={13} /> All changes saved</>}
            {autoSaveStatus === 'idle' && !isMeaningfulInvoice() && <span title="Add a client name and at least one item to start saving">Draft only — not saved yet</span>}
          </span>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={generatePDF} disabled={saving}>
            <Download size={18} /> {saving ? 'Generating...' : 'Download PDF'}
          </button>
          <button className="btn btn-secondary" onClick={directPrint} disabled={saving}
            title={
              isThermalPaper()
                ? 'Send directly to your thermal printer'
                : 'Open browser print dialog (skip the PDF download)'
            }>
            <Printer size={18} /> Print
          </button>
          <button className="btn btn-secondary" onClick={shareWhatsApp} disabled={saving} style={{ background: '#25d366', color: '#fff', borderColor: '#25d366' }}>
            <MessageCircle size={18} /> WhatsApp
          </button>
          {(invoiceType === 'tax-invoice' || invoiceType === 'delivery-challan') && (
            <button className="btn btn-secondary" onClick={exportEWayBill} title="Download E-Way Bill JSON for NIC portal upload">
              <Truck size={18} /> E-Way Bill
            </button>
          )}
        </div>
      </div>

      <div className={`split-view ${previewCollapsed ? 'split-view-focus' : ''}`}>
        <div className="editor-pane">
          {/* v1.10.22 — focus mode toggle. When ON, preview is hidden and
              the editor takes the full width so line-item entry has room
              to breathe. Persists across page loads. */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button type="button" className="btn btn-secondary"
              onClick={() => setPreviewCollapsed(v => !v)}
              style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}
              title={previewCollapsed ? 'Show live preview' : 'Hide preview to focus on entries'}>
              {previewCollapsed ? '◀ Show preview' : '▶ Focus mode (hide preview)'}
            </button>
          </div>

          {/* Business Profile Selector — shown only if multiple profiles saved */}
          {allProfiles.length > 1 && (
            <div className="glass-panel p-6 mb-6">
              <h3 className="section-title" style={{ marginBottom: '0.75rem' }}>Billing From (Business Profile)</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                {allProfiles.map(bp => {
                  const isSelected = (activeProfile?.businessName || profileProp?.businessName) === bp.businessName;
                  return (
                    <button key={bp.id} type="button"
                      onClick={() => setActiveProfile(bp)}
                      style={{
                        padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.85rem', cursor: 'pointer',
                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                        background: isSelected ? 'rgba(59,130,246,0.08)' : 'var(--surface)',
                        color: isSelected ? 'var(--primary)' : 'var(--text)',
                        fontWeight: isSelected ? 700 : 400,
                      }}>
                      {bp.businessName}
                      {bp.gstin && <span style={{ fontSize: '0.72rem', marginLeft: 6, opacity: 0.7 }}>{bp.gstin}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Invoice Type */}
          <div className="glass-panel p-6 mb-6">
            <div className="flex justify-between items-center">
              <h3 className="section-title" style={{ margin: 0 }}>Invoice Type</h3>
              <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                onClick={() => setShowOptions(!showOptions)}>
                <Settings size={15} /> {showOptions ? 'Hide Options' : 'Customize'}
              </button>
            </div>
            <div className="type-selector" style={{ marginTop: '0.75rem' }}>
              {Object.entries(INVOICE_TYPES).map(([key, val]) => (
                <button key={key} className={`type-chip ${invoiceType === key ? 'type-chip-active' : ''}`}
                  onClick={() => handleTypeChange(key)}>{val.label}</button>
              ))}
            </div>
            <p className="type-desc">{typeConfig?.description}</p>

            {/* Goods / Services / Mixed selector — drives default line-item unit
                (Hrs vs Nos) and filters the unit dropdown. Stays out of the way
                for users who never touch services. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: '0.25rem' }}>This invoice is for:</span>
              {[
                { id: 'goods',    label: '📦 Goods',    desc: 'Physical products — defaults to Nos / Kg / Pcs units' },
                { id: 'services', label: '⏱ Services', desc: 'Time / work-based — defaults to Hrs and surfaces Session / Visit / Month units' },
                { id: 'mixed',    label: '🔀 Mixed',   desc: 'Both — full unit list available, no filtering' },
              ].map(opt => (
                <button key={opt.id} type="button"
                  className={`type-chip ${(invoiceOptions.invoiceMode || 'goods') === opt.id ? 'type-chip-active' : ''}`}
                  onClick={() => setInvoiceOptions(prev => ({ ...prev, invoiceMode: opt.id }))}
                  title={opt.desc}
                  style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}>
                  {opt.label}
                </button>
              ))}
              {invoiceOptions.invoiceMode === 'services' && (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  💡 Use a <strong>SAC code</strong> (services accounting code) in the HSN field
                </span>
              )}
            </div>

            {/* Customization Options */}
            {showOptions && (
              <div className="invoice-options">
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label className="form-label">Invoice Title</label>
                  <input type="text" className="form-input" value={invoiceOptions.customTitle}
                    onChange={(e) => setInvoiceOptions(prev => ({ ...prev, customTitle: e.target.value }))}
                    placeholder={typeConfig?.title || 'TAX INVOICE'} />
                </div>
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label className="form-label">Currency</label>
                  <select className="form-input" value={invoiceOptions.currency}
                    onChange={(e) => setInvoiceOptions(prev => ({ ...prev, currency: e.target.value }))}>
                    {/* Deduped currencies pulled from the region-filtered country list. */}
                    {Array.from(new Map(getCountriesForRegion(getRegionMode()).map(c => [c.currency, c])).values()).map(c => (
                      <option key={c.currency} value={c.currency}>{c.currency} ({c.currencySymbol === c.currency ? c.name : c.currencySymbol})</option>
                    ))}
                  </select>
                </div>
                {invoiceOptions.currency !== 'INR' && (
                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label className="form-label">Exchange Rate (optional, snapshot)</label>
                    <input type="number" step="any" min="0" className="form-input"
                      value={invoiceOptions.exchangeRate}
                      onChange={(e) => setInvoiceOptions(prev => ({ ...prev, exchangeRate: e.target.value }))}
                      placeholder={`1 ${invoiceOptions.currency} = ? INR`} />
                    <small style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Stored on this invoice — historical reports stay accurate even if rates change.</small>
                  </div>
                )}

                {/* Inline recurring — turn any invoice into a recurring template
                    without leaving the form. On save, this writes both the
                    invoice AND a recurring template the server auto-fires on
                    schedule. Edit/cancel the template later via the Recurring
                    Invoices view in the sidebar. */}
                {(() => {
                  const rec = invoiceOptions.recurring;
                  const isOn = !!rec?.enabled;
                  const toggle = () => {
                    if (isOn) {
                      setInvoiceOptions(prev => ({ ...prev, recurring: { ...prev.recurring, enabled: false } }));
                    } else {
                      const next = new Date(details.invoiceDate || new Date().toISOString());
                      next.setMonth(next.getMonth() + 1);
                      setInvoiceOptions(prev => ({
                        ...prev,
                        recurring: {
                          enabled: true,
                          frequency: 'monthly',
                          interval: 1,
                          nextDate: next.toISOString().split('T')[0],
                          endMode: 'never',
                          endDate: '',
                          maxOccurrences: '',
                        },
                      }));
                    }
                  };
                  const set = (key, val) => setInvoiceOptions(prev => ({
                    ...prev, recurring: { ...prev.recurring, [key]: val },
                  }));
                  return (
                    <div className={`form-group${isOn ? ' notice notice-info' : ''}`} style={{ marginBottom: '0.75rem', padding: '0.6rem', borderRadius: '6px', display: 'block' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={isOn} onChange={toggle}
                          style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
                        <strong>🔁 Make this a recurring invoice</strong>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          (auto-generate a new invoice on schedule, same items, new number)
                        </span>
                      </label>
                      {isOn && (
                        <div style={{ marginTop: '0.6rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Frequency</label>
                            <select className="form-input" value={rec.frequency}
                              onChange={e => set('frequency', e.target.value)}>
                              <option value="weekly">Weekly</option>
                              <option value="monthly">Monthly</option>
                              <option value="quarterly">Quarterly</option>
                              <option value="yearly">Yearly</option>
                            </select>
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Every N (interval)</label>
                            <input type="number" min="1" max="12" className="form-input"
                              value={rec.interval || 1}
                              onChange={e => set('interval', parseInt(e.target.value) || 1)} />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Next invoice date</label>
                            <input type="date" className="form-input" value={rec.nextDate || ''}
                              onChange={e => set('nextDate', e.target.value)} />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">End condition</label>
                            <select className="form-input" value={rec.endMode || 'never'}
                              onChange={e => set('endMode', e.target.value)}>
                              <option value="never">Never (until I stop it)</option>
                              <option value="onDate">On a specific date</option>
                              <option value="afterN">After N invoices</option>
                            </select>
                          </div>
                          {rec.endMode === 'onDate' && (
                            <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                              <label className="form-label">Stop generating after this date</label>
                              <input type="date" className="form-input" value={rec.endDate || ''}
                                onChange={e => set('endDate', e.target.value)} />
                            </div>
                          )}
                          {rec.endMode === 'afterN' && (
                            <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                              <label className="form-label">Stop after this many invoices have been generated</label>
                              <input type="number" min="1" className="form-input"
                                value={rec.maxOccurrences || ''}
                                onChange={e => set('maxOccurrences', parseInt(e.target.value) || '')}
                                placeholder="e.g. 12 for a 1-year monthly contract" />
                            </div>
                          )}
                          <div style={{ gridColumn: 'span 2', fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            Auto-generation fires every time you open the app (or daily if it stays running).
                            Future invoices get fresh sequential numbers, today's date as their invoice date,
                            and the same client + items + amounts as this one. Edit or pause the template any
                            time via <strong>Recurring</strong> in the sidebar.
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* TCS — collected by seller, ADDS to total (Section 206C, Income Tax Act) */}
                {(profile?.country || 'India') === 'India' && (
                  <div className={`form-group${invoiceOptions.showTCS ? ' notice notice-warn' : ''}`} style={{ marginBottom: '0.75rem', padding: '0.6rem', borderRadius: '6px', display: 'block' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!invoiceOptions.showTCS}
                        onChange={() => setInvoiceOptions(prev => ({ ...prev, showTCS: !prev.showTCS }))}
                        style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
                      <strong>TCS — Tax Collected at Source</strong>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>(Adds to invoice total)</span>
                    </label>
                    {invoiceOptions.showTCS && (
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <select className="form-input" value={invoiceOptions.tcsSection || '206C(1H)'}
                          onChange={(e) => {
                            const code = e.target.value;
                            const section = TCS_SECTIONS.find(s => s.code === code);
                            setInvoiceOptions(prev => ({ ...prev, tcsSection: code, tcsRate: code === 'custom' ? prev.tcsRate : section?.rate ?? prev.tcsRate }));
                          }}>
                          {TCS_SECTIONS.map(s => <option key={s.code} value={s.code}>{s.label}</option>)}
                        </select>
                        <input type="number" step="any" min="0" max="100" className="form-input"
                          value={invoiceOptions.tcsRate}
                          onChange={(e) => setInvoiceOptions(prev => ({ ...prev, tcsRate: e.target.value }))}
                          placeholder="Rate %" />
                      </div>
                    )}
                  </div>
                )}

                {/* TDS — deducted by buyer from payment, INFORMATIONAL on invoice */}
                {(profile?.country || 'India') === 'India' && (
                  <div className={`form-group${invoiceOptions.showTDS ? ' notice notice-info' : ''}`} style={{ marginBottom: '0.75rem', padding: '0.6rem', borderRadius: '6px', display: 'block' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!invoiceOptions.showTDS}
                        onChange={() => setInvoiceOptions(prev => ({ ...prev, showTDS: !prev.showTDS }))}
                        style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
                      <strong>TDS — Tax Deducted at Source</strong>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>(Buyer deducts; informational)</span>
                    </label>
                    {invoiceOptions.showTDS && (
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <select className="form-input" value={invoiceOptions.tdsSection || '194Q'}
                          onChange={(e) => {
                            const code = e.target.value;
                            const section = TDS_SECTIONS.find(s => s.code === code);
                            setInvoiceOptions(prev => ({ ...prev, tdsSection: code, tdsRate: code === 'custom' ? prev.tdsRate : section?.rate ?? prev.tdsRate }));
                          }}>
                          {TDS_SECTIONS.map(s => <option key={s.code} value={s.code}>{s.label}</option>)}
                        </select>
                        <input type="number" step="any" min="0" max="100" className="form-input"
                          value={invoiceOptions.tdsRate}
                          onChange={(e) => setInvoiceOptions(prev => ({ ...prev, tdsRate: e.target.value }))}
                          placeholder="Rate %" />
                      </div>
                    )}
                  </div>
                )}
                {/* Payment account picker — lists the active business profile's active
                    accounts. Hidden when the profile has 0 accounts (preserves v1.4.3
                    "no bank block" behaviour). Stored as invoiceOptions.selectedAccountId
                    so re-opening the invoice produces the same PDF. */}
                {(() => {
                  const accounts = getActiveAccounts(profile);
                  if (accounts.length === 0) return null;
                  const resolved = getAccountById(profile, invoiceOptions.selectedAccountId);
                  return (
                    <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                      <label className="form-label">Payment account on this invoice</label>
                      <select className="form-input" value={resolved?.id || ''}
                        onChange={(e) => {
                          // v1.10.21 — reported: "working but on select it is not
                          // changing have to save and reopen it". Cause: the
                          // preview reads options.paymentAccountSnapshot first
                          // (bank frozen at the last save). Picking a new
                          // account from the dropdown only updated
                          // selectedAccountId, so the preview kept showing the
                          // old snapshot until save+reopen re-snapshotted. Fix:
                          // resnap immediately from the LIVE profile when the
                          // user picks a different account so the preview
                          // reflects the new bank without a round trip.
                          const newId = e.target.value || null;
                          const newSnap = newId ? getAccountById(profile, newId) : null;
                          setInvoiceOptions(prev => ({ ...prev, selectedAccountId: newId, paymentAccountSnapshot: newSnap }));
                        }}>
                        {accounts.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.isDefault ? '⭐ ' : ''}{a.label || a.bankName || 'Untitled account'}
                            {a.bankName && a.label !== a.bankName ? ` — ${a.bankName}` : ''}
                          </option>
                        ))}
                      </select>
                      <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                        Bank details and UPI QR on the PDF come from the selected account.
                        Manage accounts in Settings → Payment Accounts.
                      </small>
                    </div>
                  );
                })()}
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label className="form-label">PDF Style</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {PDF_STYLES.map(s => (
                      <button key={s.id} type="button"
                        className={`type-chip ${(invoiceOptions.pdfStyle || 'classic') === s.id ? 'type-chip-active' : ''}`}
                        onClick={() => setInvoiceOptions(prev => ({ ...prev, pdfStyle: s.id }))}
                        title={s.desc}>{s.label}</button>
                    ))}
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label className="form-label">Accent Color</label>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button type="button" title="Auto (match invoice type)"
                      style={{ width: '28px', height: '28px', borderRadius: '50%', border: !invoiceOptions.accentColor ? '2.5px solid #334155' : '2px solid #cbd5e1', background: 'conic-gradient(#1e40af, #7c3aed, #0f766e, #be123c, #1e40af)', cursor: 'pointer', position: 'relative' }}
                      onClick={() => setInvoiceOptions(prev => ({ ...prev, accentColor: '' }))}>
                      {!invoiceOptions.accentColor && <span style={{ position: 'absolute', inset: '3px', borderRadius: '50%', border: '2px solid white' }} />}
                    </button>
                    {ACCENT_PRESETS.map(p => (
                      <button key={p.color} type="button" title={p.label}
                        style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: p.color, border: invoiceOptions.accentColor === p.color ? '2.5px solid #334155' : '2px solid #cbd5e1', cursor: 'pointer', position: 'relative' }}
                        onClick={() => setInvoiceOptions(prev => ({ ...prev, accentColor: p.color }))}>
                        {invoiceOptions.accentColor === p.color && <span style={{ position: 'absolute', inset: '3px', borderRadius: '50%', border: '2px solid white' }} />}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Field-level toggles, grouped. Lets the user hide any default field on the
                    PDF without losing the data on the invoice itself. */}
                {[
                  { group: 'Header & branding', items: [
                    ['showLogo', 'Logo'],
                    ['showBusinessName', 'Business name'],
                    ['showBusinessAddress', 'Business address'],
                    ['showBusinessPhone', 'Business phone'],
                    ['showBusinessEmail', 'Business email'],
                    ['showState', 'Business state'],
                    ['showGSTIN', 'Tax ID (GSTIN/VAT/etc.)'],
                  ]},
                  { group: 'Client / Bill-to', items: [
                    ['showClientAddress', 'Client address'],
                    ['showClientPhone', 'Client phone'],
                    ['showClientEmail', 'Client email'],
                    ['showPlaceOfSupply', 'Place of Supply'],
                  ]},
                  { group: 'Invoice meta', items: [
                    ['showInvoiceNumber', 'Invoice number'],
                    ['showInvoiceDate', 'Invoice date'],
                    ['showDueDate', 'Due date'],
                  ]},
                  { group: 'Items table', items: [
                    ['showHSN', 'HSN/SAC column'],
                    ['showItemQty', 'Qty column'],
                    // v1.10.33 — Renamed from "Unit column" to match
                    // reality: InvoicePreview renders the unit INSIDE the
                    // Qty cell ("5 Nos", not a separate column). Prior
                    // label misled users into unticking Qty and expecting
                    // Unit to survive as its own column — it just vanished
                    // instead. Label now describes what actually happens.
                    ['showItemUnit', 'Unit suffix (next to Qty)'],
                    ['showRateColumn', 'Rate column'],
                    ['showDiscount', 'Discount column'],
                    ['showGST', 'Tax % column (GST/VAT/etc.)'],
                    ['showCess', 'GST Cess % column (India — tobacco/auto/coal)'],
                  ]},
                  { group: 'Totals', items: [
                    ['showSubtotal', 'Subtotal row'],
                    ['showAmountWords', 'Amount in words'],
                    ['showRoundOff', 'Round-off line'],
                  ]},
                  { group: 'Compliance flags (India)', items: [
                    ['reverseCharge', 'Reverse Charge applies (Section 9(3)/9(4)) — recipient pays GST'],
                  ]},
                  // Paper-size selector rendered outside the checkbox-grid pattern
                  // — see the block below the .map(). Adding a group marker here
                  // keeps the visual flow but the actual UI is a dropdown.
                  { group: '__PAPER_SIZE__', items: [] },
                  { group: 'Footer', items: [
                    ['showBankDetails', 'Bank details'],
                    ['showAccountLabel', 'Show "Pay via: <account>" label above bank block'],
                    ['showUPI', 'UPI QR (India only)'],
                    ['showSignature', 'Signature block'],
                    ['showSignatoryText', 'Show "Authorized Signatory" caption'],
                    ['showTerms', 'Terms & Conditions'],
                    ['showNotes', 'Notes / Remarks'],
                  ]},
                ].map(section => {
                  if (section.group === '__PAPER_SIZE__') {
                    return (
                      <div key="paper-size" style={{ marginBottom: '0.6rem' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Paper / print size</div>
                        <select className="form-input" style={{ fontSize: '0.85rem' }}
                          value={invoiceOptions.paperSize || 'a4'}
                          onChange={e => setInvoiceOptions(prev => ({ ...prev, paperSize: e.target.value }))}>
                          {Object.entries(PAPER_SIZES).map(([key, ps]) => (
                            <option key={key} value={key}>{ps.label}</option>
                          ))}
                        </select>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.3rem 0 0' }}>
                          {getPaperSize(invoiceOptions.paperSize, invoiceOptions).hint}
                        </p>

                        {/* Custom size inputs — shown only when Custom preset picked */}
                        {invoiceOptions.paperSize === 'custom' && (
                          <div style={{ marginTop: '0.5rem', padding: '0.55rem 0.65rem', background: 'var(--bg-secondary)', borderRadius: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            <div>
                              <label style={{ fontSize: '0.72rem', fontWeight: 600, display: 'block', marginBottom: 3 }}>Width (mm)</label>
                              <input type="number" min="30" max="500" step="1"
                                value={invoiceOptions.customPaperWidth || 80}
                                onChange={e => setInvoiceOptions(prev => ({ ...prev, customPaperWidth: parseInt(e.target.value, 10) || 80 }))}
                                className="form-input" style={{ fontSize: '0.8rem', padding: '0.35rem' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.72rem', fontWeight: 600, display: 'block', marginBottom: 3 }}>Height (mm)</label>
                              <input type="number" min="50" max="1200" step="1"
                                value={invoiceOptions.customPaperHeight || 297}
                                onChange={e => setInvoiceOptions(prev => ({ ...prev, customPaperHeight: parseInt(e.target.value, 10) || 297 }))}
                                className="form-input" style={{ fontSize: '0.8rem', padding: '0.35rem' }} />
                            </div>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', gridColumn: 'span 2', margin: 0 }}>
                              Tip: enter your printer's <strong>printable</strong> width, not the roll width. Most 58mm thermals print at 48mm; 80mm print at 72mm. <strong>Below 100mm width auto-switches to thermal receipt layout</strong> — same rendering as the 58/80mm presets, just at your exact size.
                            </p>
                            {/* v1.10.30 — quick-pick chips for uncommon thermal rolls. */}
                            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: 4 }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Quick-pick:</span>
                              {[
                                { label: '40mm', w: 32 },
                                { label: '76mm', w: 68 },
                                { label: '90mm', w: 80 },
                                { label: '110mm', w: 102 },
                              ].map(p => (
                                <button type="button" key={p.label}
                                  onClick={() => setInvoiceOptions(prev => ({ ...prev, customPaperWidth: p.w, customPaperHeight: 297 }))}
                                  className="btn btn-secondary"
                                  style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}
                                  title={`Set to ${p.label} roll (${p.w}mm printable × auto height)`}>
                                  {p.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Thermal-only extra settings — only shown when a
                            thermal paper size is picked. Each control maps
                            to an invoiceOptions field consumed by the
                            thermal render path in InvoicePreview. */}
                        {getPaperSize(invoiceOptions.paperSize, invoiceOptions).kind === 'thermal' && (
                          <div style={{ marginTop: '0.6rem', padding: '0.6rem', background: 'var(--bg-secondary)', borderRadius: 6 }}>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
                              Thermal printer settings
                            </div>

                            <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '0.35rem' }}>
                              <span style={{ fontWeight: 600 }}>Font size</span>
                              <select className="form-input"
                                style={{ fontSize: '0.78rem', marginTop: 2 }}
                                value={invoiceOptions.thermalFontSize || 'medium'}
                                onChange={e => setInvoiceOptions(prev => ({ ...prev, thermalFontSize: e.target.value }))}>
                                <option value="small">Small (fits more per page)</option>
                                <option value="medium">Medium (recommended)</option>
                                <option value="large">Large (easier to read)</option>
                              </select>
                            </label>

                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', fontSize: '0.78rem', marginTop: '0.5rem', cursor: 'pointer' }}>
                              <input type="checkbox" checked={!!invoiceOptions.thermalCompact}
                                onChange={e => setInvoiceOptions(prev => ({ ...prev, thermalCompact: e.target.checked }))}
                                style={{ marginTop: 2, accentColor: 'var(--primary)' }} />
                              <span>
                                <strong>Compact mode</strong>
                                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  Skip HSN + per-item rate line; use two-line item rows. Saves paper on long orders.
                                </span>
                              </span>
                            </label>

                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', fontSize: '0.78rem', marginTop: '0.4rem', cursor: 'pointer' }}>
                              <input type="checkbox" checked={invoiceOptions.thermalCutMark !== false}
                                onChange={e => setInvoiceOptions(prev => ({ ...prev, thermalCutMark: e.target.checked }))}
                                style={{ marginTop: 2, accentColor: 'var(--primary)' }} />
                              <span>
                                <strong>Cut mark at bottom</strong>
                                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  Adds "— cut here —" line for auto-cutter thermal printers. Turn off if your printer feeds paper automatically.
                                </span>
                              </span>
                            </label>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div key={section.group} style={{ marginBottom: '0.6rem' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>{section.group}</div>
                      <div className="options-grid">
                        {section.items.map(([key, label]) => {
                          // These default to OFF; everything else defaults to ON.
                          const offByDefault = key === 'showRoundOff' || key === 'showAccountLabel'
                            || key === 'showCess' || key === 'reverseCharge';
                          const checked = offByDefault ? !!invoiceOptions[key] : invoiceOptions[key] !== false;
                          return (
                            <label key={key} className="option-toggle">
                              <input type="checkbox" checked={checked} onChange={() => toggleOption(key)} />
                              <span>{label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                  <button type="button" className="btn btn-secondary"
                    onClick={() => {
                      const allKeys = ['showLogo','showBusinessName','showBusinessAddress','showBusinessPhone','showBusinessEmail','showState','showGSTIN','showClientAddress','showClientPhone','showClientEmail','showPlaceOfSupply','showInvoiceNumber','showInvoiceDate','showDueDate','showHSN','showItemQty','showItemUnit','showRateColumn','showDiscount','showGST','showSubtotal','showAmountWords','showRoundOff','showBankDetails','showAccountLabel','showUPI','showSignature','showSignatoryText','showTerms','showNotes'];
                      setInvoiceOptions(prev => { const out = { ...prev }; allKeys.forEach(k => { out[k] = false; }); return out; });
                    }}
                    style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem' }}>
                    Hide all
                  </button>
                  <button type="button" className="btn btn-secondary"
                    onClick={() => setInvoiceOptions(prev => ({
                      ...DEFAULT_OPTIONS,
                      // v1.10.33 — Preserve per-bill data that lives inside
                      // invoiceOptions but is NOT a "display option" the
                      // reset button should touch. Prior code was a raw
                      // setInvoiceOptions(DEFAULT_OPTIONS) which nulled
                      // paymentAccountSnapshot (bank details frozen at save
                      // time, v1.10.20 invariant) and selectedAccountId
                      // (the account picked for THIS bill) — so an edit-
                      // then-reset silently repointed the bank block to the
                      // legacy profile bank.
                      paymentAccountSnapshot: prev.paymentAccountSnapshot,
                      selectedAccountId: prev.selectedAccountId,
                    }))}
                    style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem' }}>
                    Reset to default
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Client Modal */}
          <ClientModal show={showClientModal} onClose={() => setShowClientModal(false)} onSave={handleClientModalSave} client={modalClient} isEditing={isEditingClient} defaultCountry={profile?.country} />

          {/* Client Details */}
          <div className="glass-panel p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="section-title" style={{ margin: 0 }}>Billed To</h3>
            </div>

            {/* v1.10.24 — Client credit banner. Shows when the picked
                client has overpayment sitting unused on prior bills;
                lets the user apply it as advance on this invoice. */}
            {!editingBill && clientCredit.available > 0.005 && (
              <div style={{
                marginBottom: '1rem', padding: '0.75rem 1rem',
                background: 'rgba(3, 105, 161, 0.08)',
                border: '1px solid rgba(3, 105, 161, 0.3)',
                borderRadius: 8, fontSize: '0.85rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <strong style={{ color: '#0369a1' }}>💳 Client has {formatCurrency(clientCredit.available, invoiceOptions.currency || 'INR')} credit</strong>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                      from {clientCredit.sources.length} prior overpayment{clientCredit.sources.length > 1 ? 's' : ''}
                      {' '}({clientCredit.sources.map(s => s.invoiceNumber).slice(0, 3).join(', ')}
                      {clientCredit.sources.length > 3 ? '…' : ''})
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <input type="number" min="0" step="any" className="form-input"
                      value={creditToApply || ''} placeholder="0"
                      onChange={e => {
                        const v = Math.max(0, Number(e.target.value) || 0);
                        const cap = Math.min(clientCredit.available, Number(totals.total) || Infinity);
                        setCreditToApply(Math.min(v, cap));
                      }}
                      style={{ width: 100, fontSize: '0.82rem', padding: '0.3rem 0.5rem' }} />
                    <button type="button" className="btn btn-secondary"
                      style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
                      onClick={() => setCreditToApply(Math.min(clientCredit.available, Number(totals.total) || 0))}>
                      Apply full
                    </button>
                    {creditToApply > 0 && (
                      <button type="button" className="btn btn-secondary"
                        style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem', color: '#dc2626', borderColor: '#fca5a5' }}
                        onClick={() => setCreditToApply(0)}>
                        Skip
                      </button>
                    )}
                  </div>
                </div>
                {creditToApply > 0.005 && (
                  <div style={{ marginTop: 6, fontSize: '0.78rem', color: '#0369a1' }}>
                    → Will apply {formatCurrency(creditToApply, invoiceOptions.currency || 'INR')} as advance from prior overpayment
                    {creditToApply < clientCredit.available ? ` (${formatCurrency(clientCredit.available - creditToApply, invoiceOptions.currency || 'INR')} credit will remain)` : ''}.
                  </div>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <input type="checkbox" checked={!!invoiceOptions.autoApplyClientCredit}
                    onChange={e => setInvoiceOptions(prev => ({ ...prev, autoApplyClientCredit: e.target.checked }))} />
                  Auto-apply available client credit on future invoices
                </label>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="form-group full-width" style={{ position: 'relative' }}>
                <label className="form-label">Client Name</label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input type="text" className="form-input" style={{ flex: 1 }} value={client.name} ref={clientNameRef}
                    onChange={(e) => {
                      setClient({ ...client, name: e.target.value });
                      setSelectedClientId(null);
                      setShowClientSuggestions(true);
                    }}
                    onFocus={() => { if (savedClients.length > 0) setShowClientSuggestions(true); }}
                    placeholder="Type client name to search or add new" autoComplete="off" />
                  {selectedClientId && (
                    <button type="button" className="btn-client-edit" onClick={() => openEditClientModal(savedClients.find(c => c.id === selectedClientId))} title="Edit saved client">
                      <Pencil size={14} />
                    </button>
                  )}
                </div>
                {showClientSuggestions && savedClients.length > 0 && (
                  <div className="client-suggestions" ref={clientSuggestionsRef}>
                    {filteredClients.length > 0 && filteredClients.map(cli => (
                      <div key={cli.id} className="client-suggestion-row">
                        <button type="button" className="client-suggestion-item" onClick={() => selectSavedClient(cli)}>
                          <div className="client-suggestion-main">
                            <strong>{cli.name}</strong>
                            {(cli.city || cli.address) && <small className="client-suggestion-addr">{cli.city || cli.address.substring(0, 30)}{!cli.city && cli.address.length > 30 ? '...' : ''}</small>}
                          </div>
                          <span>{cli.state}{cli.gstin ? ` · ${cli.gstin}` : ''}</span>
                        </button>
                        <button type="button" className="client-suggestion-edit" onClick={() => { openEditClientModal(cli); setShowClientSuggestions(false); }} title="Edit client">
                          <Pencil size={12} />
                        </button>
                      </div>
                    ))}
                    {client.name.trim() && (
                      <button type="button" className="client-suggestion-save" onClick={openAddClientModal}>
                        <UserPlus size={14} /> Save "{client.name.trim()}" as new client
                      </button>
                    )}
                    {filteredClients.length === 0 && !client.name.trim() && (
                      <div className="client-picker-empty">Type to search clients</div>
                    )}
                  </div>
                )}
              </div>
              <div className="form-group full-width">
                <label className="form-label">Billing Address</label>
                <input type="text" className="form-input" value={client.address}
                  onChange={(e) => setClient({ ...client, address: e.target.value })} placeholder="Street address, locality" />
              </div>
              <div className="form-group">
                <label className="form-label">Country</label>
                <select className="form-input" value={client.country || profile?.country || 'India'}
                  onChange={(e) => setClient({ ...client, country: e.target.value, state: '' })}>
                  {(() => {
                    const visible = getCountriesForRegion(getRegionMode());
                    const cur = client.country || profile?.country;
                    const out = [];
                    if (cur && !visible.some(c => c.name === cur)) {
                      out.push(<option key={cur} value={cur}>{cur}</option>);
                    }
                    return out.concat(visible.map(c => <option key={c.code} value={c.name}>{c.name}</option>));
                  })()}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">City</label>
                <input type="text" className="form-input" value={client.city}
                  onChange={(e) => setClient({ ...client, city: e.target.value })} placeholder="e.g. Mumbai" />
              </div>
              <div className="form-group">
                {(() => { const cc = getCountryConfig(client.country || profile?.country); return <label className="form-label">{cc.postalLabel}</label>; })()}
                <input type="text" className="form-input" value={client.pin}
                  onChange={(e) => setClient({ ...client, pin: e.target.value })} placeholder="Postal / PIN code" />
              </div>
              {invoiceOptions.showState && (() => {
                const cc = getCountryConfig(client.country || profile?.country);
                const stateOpts = getStatesForCountry(client.country || profile?.country);
                return (
                  <div className="form-group">
                    <label className="form-label">{cc.stateLabel}</label>
                    {stateOpts.length > 0 ? (
                      <select className="form-input" value={client.state} onChange={(e) => setClient({ ...client, state: e.target.value })}>
                        <option value="">Select {cc.stateLabel}</option>
                        {stateOpts.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <input type="text" className="form-input" value={client.state}
                        onChange={(e) => setClient({ ...client, state: e.target.value })} placeholder={cc.stateLabel} />
                    )}
                  </div>
                );
              })()}
              {invoiceOptions.showGSTIN && (() => {
                const cc = getCountryConfig(client.country || profile?.country);
                return (
                  <div className="form-group">
                    <label className="form-label">{cc.taxIdLabel}</label>
                    <input type="text" className="form-input" value={client.gstin}
                      onChange={(e) => setClient({ ...client, gstin: e.target.value.toUpperCase() })} placeholder="Optional" maxLength={20} />
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Invoice Details */}
          <div className="glass-panel p-6 mb-6">
            <h3 className="section-title">Invoice Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Invoice Number</label>
                <input type="text" className="form-input" value={details.invoiceNumber}
                  onChange={(e) => setDetails({ ...details, invoiceNumber: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Invoice Date</label>
                <input type="date" className="form-input" value={details.invoiceDate}
                  onChange={(e) => setDetails({ ...details, invoiceDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input type="date" className="form-input" value={details.dueDate}
                  onChange={(e) => setDetails({ ...details, dueDate: e.target.value })} />
              </div>
              {invoiceOptions.showPlaceOfSupply && (() => {
                const posOpts = getStatesForCountry(profile?.country);
                return (
                  <div className="form-group">
                    <label className="form-label">Place of Supply</label>
                    {posOpts.length > 0 ? (
                      <select className="form-input" value={details.placeOfSupply}
                        onChange={(e) => setDetails({ ...details, placeOfSupply: e.target.value })}>
                        <option value="">Defaults to Client State</option>
                        {posOpts.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <input type="text" className="form-input" value={details.placeOfSupply}
                        onChange={(e) => setDetails({ ...details, placeOfSupply: e.target.value })} placeholder="State / Region" />
                    )}
                  </div>
                );
              })()}
              {invoiceType === 'credit-note' && (
                <div className="form-group full-width">
                  <label className="form-label">Original Invoice Reference</label>
                  <input type="text" className="form-input" value={details.originalInvoiceRef}
                    onChange={(e) => setDetails({ ...details, originalInvoiceRef: e.target.value })} placeholder="e.g. INV/2025-26/0001" />
                </div>
              )}

              {/* v1.10.11 — Ship-to = Bill-to checkbox. When unchecked,
                   4 shipping fields appear. Rendered next to the billing
                   block in the PDF preview. */}
              <div className="form-group full-width" style={{ marginTop: '0.5rem', padding: '0.6rem 0.85rem', background: 'var(--bg-secondary)', borderRadius: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none', fontSize: '0.88rem' }}>
                  <input type="checkbox" checked={details.shipToSameAsBilling !== false}
                    onChange={e => setDetails({ ...details, shipToSameAsBilling: e.target.checked })}
                    style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
                  <span><strong>Ship to</strong> same as bill-to address</span>
                </label>
                {details.shipToSameAsBilling === false && (
                  <div className="grid grid-cols-2 gap-3" style={{ marginTop: '0.6rem' }}>
                    <div className="form-group full-width">
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>Shipping Address</label>
                      <textarea className="form-input" rows={2} value={details.shippingAddress || ''}
                        onChange={e => setDetails({ ...details, shippingAddress: e.target.value })}
                        placeholder="Delivery address / warehouse / consignee location" />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>Shipping City</label>
                      <input type="text" className="form-input" value={details.shippingCity || ''}
                        onChange={e => setDetails({ ...details, shippingCity: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>Shipping PIN</label>
                      <input type="text" className="form-input" value={details.shippingPin || ''}
                        onChange={e => setDetails({ ...details, shippingPin: e.target.value })}
                        placeholder="6-digit PIN" maxLength={6} />
                    </div>
                    <div className="form-group full-width">
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>Shipping State</label>
                      {(() => {
                        const posOpts = getStatesForCountry(profile?.country);
                        return posOpts.length > 0 ? (
                          <select className="form-input" value={details.shippingState || ''}
                            onChange={e => setDetails({ ...details, shippingState: e.target.value })}>
                            <option value="">Same as billing state</option>
                            {posOpts.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ) : (
                          <input type="text" className="form-input" value={details.shippingState || ''}
                            onChange={e => setDetails({ ...details, shippingState: e.target.value })}
                            placeholder="Delivery state / region" />
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="glass-panel p-6 mb-6">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 className="section-title" style={{ margin: 0 }}>Line Items</h3>
              {showGST && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={taxInclusive} onChange={e => setTaxInclusive(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer' }} />
                  <span style={{ fontWeight: 500 }}>Prices include tax</span>
                </label>
              )}
            </div>
            {items.map((item) => (
              <LineItem
                key={item.id}
                item={item}
                invoiceOptions={invoiceOptions}
                taxInclusive={taxInclusive}
                showGST={showGST}
                taxLabel={taxLabel}
                units={units}
                countryTaxRates={countryTaxRates}
                filterUnitsByMode={filterUnitsByMode}
                invoiceMode={invoiceOptions.invoiceMode}
                currency={invoiceOptions.currency}
                profileCountry={profile?.country}
                suggestions={getProductSuggestions(item.id)}
                onFieldChange={handleItemChange}
                onSelectProduct={selectProduct}
                onSetProductSearch={setProductSearch}
                onAddCustomUnit={handleAddCustomUnit}
                onRemoveCustomUnit={handleRemoveCustomUnit}
                onRemove={removeItem}
                clampNonNeg={clampNonNeg}
              />
            ))}
            <button className="btn btn-secondary mt-2" onClick={addItem}><Plus size={18} /> Add Item</button>

            {/* v1.10.22 — invoice-level (whole-bill) discount. Sits below
                the line items so it reads as "…and then take X off the
                whole bill". Zero value = no line renders in the preview. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: '0.75rem', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Discount on total (whole bill)</label>
              <input type="number" min="0" step="any" className="form-input"
                value={invoiceOptions.invoiceDiscountValue || ''}
                onChange={(e) => setInvoiceOptions(prev => ({ ...prev, invoiceDiscountValue: clampNonNeg(e.target.value) }))}
                style={{ width: 100 }} placeholder="0" />
              <select className="form-input"
                value={invoiceOptions.invoiceDiscountType === 'percent' ? 'percent' : 'fixed'}
                onChange={(e) => setInvoiceOptions(prev => ({ ...prev, invoiceDiscountType: e.target.value }))}
                style={{ width: 90 }}>
                <option value="fixed">₹ (fixed)</option>
                <option value="percent">% of total</option>
              </select>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Applied after tax. For GST-compliant pre-tax discount, use per-line discount instead.
              </span>
            </div>
          </div>

          {/* Terms */}
          <div className="glass-panel p-6 mb-6">
            <h3 className="section-title">Terms & Conditions</h3>
            <div style={{ display: 'grid', gridTemplateColumns: termsTemplates.length > 0 ? '1fr 1fr' : '1fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Insert preset (by business type)</label>
                <select className="form-input" defaultValue=""
                  onChange={async (e) => {
                    if (!e.target.value) return;
                    const preset = TERMS_PRESETS.find(p => p.id === e.target.value);
                    if (!preset) return;
                    // P2 #33 — "never ask again" via sessionStorage flag.
                    // Users iterating through 3 presets to compare shouldn't
                    // see 3 confirm dialogs. Ask once per session; subsequent
                    // presets swap silently until they close the tab.
                    if (customTerms && customTerms.replace(/<[^>]*>/g, '').trim()) {
                      const skipConfirm = sessionStorage.getItem('gst_termsPresetConfirmed') === '1';
                      if (!skipConfirm) {
                        const proceed = await confirmAction({
                          title: 'Replace current Terms?',
                          message: 'Your existing Terms text will be lost. Subsequent preset swaps this session will happen silently — this confirmation is shown once.',
                          confirmLabel: 'Replace',
                          tone: 'warning',
                        });
                        if (!proceed) { e.target.value = ''; return; }
                        try { sessionStorage.setItem('gst_termsPresetConfirmed', '1'); } catch { /* ignore */ }
                      }
                    }
                    setCustomTerms(preset.body);
                    setSelectedTermsId('');
                    e.target.value = '';
                    if (preset.body) toast(`Inserted "${preset.label}" preset`, 'success');
                  }}>
                  <option value="">— Pick a business type —</option>
                  {TERMS_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                <small style={{ color: '#94a3b8', fontSize: '0.7rem' }}>India-specific starter wording. Edit freely.</small>
              </div>
              {termsTemplates.length > 0 && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Load saved template</label>
                  <select className="form-input" value={selectedTermsId} onChange={(e) => handleTermsSelect(e.target.value)}>
                    <option value="">— Custom —</option>
                    {termsTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Terms (appears on invoice — supports rich formatting)</label>
              <RichEditor toolbar value={customTerms}
                onChange={(v) => { setCustomTerms(v); setSelectedTermsId(''); }}
                placeholder="Enter or paste your terms & conditions..." />
            </div>
            <div className="form-group">
              <label className="form-label">Notes / Remarks (optional)</label>
              <RichEditor toolbar value={customNotes}
                onChange={(v) => setCustomNotes(v)}
                placeholder="Project details, special instructions, additional notes..." />
            </div>
            <div className="form-group" style={{ background: '#fefce8', border: '1px dashed #ca8a04', borderRadius: 8, padding: '0.75rem 1rem' }}>
              <label className="form-label" style={{ color: '#92400e', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v4m0 4h.01"/></svg>
                Private Note (not shown on invoice)
              </label>
              <textarea rows="2" className="form-input note-textarea" value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                style={{ fontSize: '0.82rem' }}
                placeholder="e.g. Client asked for 15-day credit, follow up on 20th, referred by Ravi..." />
            </div>
          </div>

          {/* Extra Sections */}
          <div className="glass-panel p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="section-title" style={{ margin: 0 }}>Additional Pages / Sections</h3>
              <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                onClick={() => setExtraSections(prev => [...prev, { id: Date.now().toString(), title: '', content: '' }])}>
                <Plus size={15} /> Add Section
              </button>
            </div>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>
              Add extra sections that appear after the invoice footer. You can paste formatted HTML content (bold, lists, tables, etc.).
            </p>
            {extraSections.length === 0 ? (
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>No extra sections. Click "Add Section" to create one.</p>
            ) : (
              extraSections.map((section, idx) => (
                <div key={section.id} className="extra-section-editor">
                  <div className="flex gap-2 items-center mb-2">
                    <input type="text" className="form-input" value={section.title}
                      onChange={(e) => setExtraSections(prev => prev.map(s => s.id === section.id ? { ...s, title: e.target.value } : s))}
                      placeholder="Section title (e.g. Scope of Work, Delivery Timeline)" style={{ flex: 1 }} />
                    <button className="icon-btn" onClick={() => {
                      if (idx > 0) setExtraSections(prev => { const arr = [...prev]; [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]; return arr; });
                    }} title="Move up" disabled={idx === 0}><ChevronUp size={14} /></button>
                    <button className="icon-btn" onClick={() => {
                      if (idx < extraSections.length - 1) setExtraSections(prev => { const arr = [...prev]; [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]; return arr; });
                    }} title="Move down" disabled={idx === extraSections.length - 1}><ChevronDown size={14} /></button>
                    <button className="icon-btn icon-btn-red" onClick={() => setExtraSections(prev => prev.filter(s => s.id !== section.id))} title="Remove"><Trash2 size={14} /></button>
                  </div>
                  <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                    <RichEditor
                      value={section.content}
                      onChange={(html) => setExtraSections(prev => prev.map(s => s.id === section.id ? { ...s, content: html } : s))}
                      placeholder="Type or paste formatted content here (supports bold, lists, tables from Word/Docs)..." />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Preview — visually hidden in focus mode (v1.10.22) but
            kept in the DOM so printRef stays live for PDF generation.
            v1.10.26 — reported: "in this mode print not working" for focus
            mode. Root cause: `display: none` removes the element from
            layout entirely, so html2canvas renders a 0×0 canvas → blank
            PDF and blank print. Fix: move the pane off-screen (position:
            absolute, left: -99999px) instead. The element keeps real
            dimensions so html2canvas can snapshot it, but it's invisible
            to the user and out of the flex flow (so the editor still
            takes the full viewport width in focus mode). */}
        <div ref={previewPaneRef} className="preview-pane" style={previewCollapsed
          ? { position: 'absolute', left: '-99999px', top: 0, width: '794px', pointerEvents: 'none', opacity: 0 }
          : undefined}>
          <div className="preview-pane-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>PDF Preview — This is how your invoice will look</span>
            {/* v1.9.1 — preview zoom controls. Persist choice per-session so
                a large preview stays large as user navigates between bills. */}
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <button type="button" className="btn btn-secondary" title="Zoom out"
                style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', minWidth: 24 }}
                onClick={() => setPreviewZoom(z => Math.max(50, z - 10))}>−</button>
              <span style={{ fontSize: '0.72rem', minWidth: 36, textAlign: 'center', fontWeight: 600 }}>{previewZoom}%</span>
              <button type="button" className="btn btn-secondary" title="Zoom in"
                style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', minWidth: 24 }}
                onClick={() => setPreviewZoom(z => Math.min(200, z + 10))}>+</button>
              {/* v1.10.33 — REAL fit-to-width. Prior code was
                  setPreviewZoom(100), which just set 100%, not "fit". On
                  narrow viewports the preview overflowed; on wide ones it
                  looked tiny. Now measures the pane's content width and
                  the preview's natural width (A4 = 794px @ 96dpi) and
                  scales so the preview fills without overflow. */}
              <button type="button" className="btn btn-secondary" title="Fit to preview width"
                style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}
                onClick={handleFitToWidth}>Fit</button>
            </span>
          </div>
          <div className="preview-scaler" style={{ transform: `scale(${previewZoom / 100})`, transformOrigin: 'top left' }}>
            <InvoicePreview ref={printRef} profile={profile} client={client} details={details}
              items={items} totals={totals} invoiceType={invoiceType} customTerms={customTerms}
              customNotes={customNotes} extraSections={extraSections} options={invoiceOptions} />
          </div>
        </div>
      </div>

      {/* v1.10.34 — Thermal receipt preview modal. Opens when the user
          clicks Print on a thermal-sized invoice. Modal shows the receipt
          live, click Print inside to send vector HTML to the printer. */}
      <ThermalPreviewModal
        isOpen={showThermalPreview}
        onClose={() => setShowThermalPreview(false)}
        profile={profile}
        client={client}
        details={details}
        items={items}
        totals={totals}
        invoiceType={invoiceType}
        customTerms={customTerms}
        customNotes={customNotes}
        extraSections={extraSections}
        invoiceOptions={invoiceOptions}
        onDownloadPdf={generatePDF}
      />

      {/* P2 #32 — 3-option leave modal. Replaces the previous confusing
          browser confirm() where OK=save was counterintuitive. */}
      {leaveModal && (
        <div className="modal-overlay" onClick={leaveActions.cancel}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <h3 style={{ marginTop: 0 }}>Unsaved changes</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              This invoice has changes that haven't been saved yet. What do you want to do?
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={leaveActions.cancel}>
                Keep editing
              </button>
              <button className="btn btn-secondary" style={{ color: '#dc2626', borderColor: '#fca5a5' }} onClick={leaveActions.discardAndExit}>
                Discard &amp; leave
              </button>
              <button className="btn btn-primary" onClick={leaveActions.saveAndExit}>
                Save &amp; leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
