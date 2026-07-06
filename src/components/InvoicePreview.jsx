import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import DOMPurify from 'dompurify';
import { numberToWords, formatCurrency, INVOICE_TYPES, getCountryConfig, CURRENCY_NAMES, formatExchangeRateLine, getAccountById, getPaperSize } from '../utils';

const InvoicePreview = React.forwardRef(({ profile, client, details, items, totals, invoiceType = 'tax-invoice', customTerms, customNotes, extraSections = [], options = {} }, ref) => {
  // Interstate detection must match InvoiceGenerator.jsx — it honours
  // details.placeOfSupply (POS override) and client.isSEZ (SEZ supplies
  // are always interstate regardless of physical state). Without this
  // the totals block could show IGST while the item table showed
  // CGST+SGST for the same bill (POS override or SEZ client).
  //
  // Cheapest correct signal: totals.igst > 0 means the computation upstream
  // routed the tax as IGST — so trust that, and fall back to the state
  // comparison only if totals aren't populated (e.g. legacy JSON with no
  // igst field).
  const businessState = profile?.state?.trim().toLowerCase();
  const clientState = client?.state?.trim().toLowerCase();
  const isInterstate = (typeof totals?.igst === 'number' && totals.igst > 0)
    || !!client?.isSEZ
    || (details?.placeOfSupply && businessState && details.placeOfSupply.toLowerCase() !== businessState)
    || (businessState && clientState && businessState !== clientState);
  const typeConfig = INVOICE_TYPES[invoiceType] || INVOICE_TYPES['tax-invoice'];
  // Seller's country drives tax label (GST / VAT / SST / MwSt etc.) and bank label.
  const sellerCC = getCountryConfig(profile?.country);
  const isIndia = (profile?.country || 'India') === 'India';
  const taxLabel = sellerCC.taxLabel || 'GST';

  // Resolve the payment account once per render. Falls back to the synthesised
  // legacy account (built from flat profile bank fields) when no array exists,
  // so v1.4.3 invoices render byte-identical with no `selectedAccountId`.
  const account = getAccountById(profile, options.selectedAccountId);
  const showAccountLabel = options.showAccountLabel === true;

  // Options with defaults. Each toggle defaults to ON so old invoices keep rendering as
  // before; users opt INTO hiding fields via Customize.
  const opt = (key, fallback = true) => options[key] !== undefined ? options[key] : fallback;
  const showGST = opt('showGST', typeConfig.showGST);
  const showState = opt('showState');
  const showGSTIN = opt('showGSTIN');
  const showPlaceOfSupply = opt('showPlaceOfSupply', showGST);
  const showHSN = opt('showHSN');
  const showDiscount = opt('showDiscount');
  const showBankDetails = opt('showBankDetails');
  const showUPI = opt('showUPI');
  const showLogo = opt('showLogo');
  const showSignature = opt('showSignature');
  const showSignatoryText = opt('showSignatoryText');
  const showTerms = opt('showTerms');
  const showNotes = opt('showNotes');
  const showAmountWords = opt('showAmountWords');
  const showDueDate = opt('showDueDate');
  const showItemQty = opt('showItemQty');
  const showItemUnit = opt('showItemUnit');
  const showRateColumn = opt('showRateColumn');
  const showSubtotal = opt('showSubtotal');
  // Header / client meta — default ON
  const showBusinessName = opt('showBusinessName');
  const showBusinessAddress = opt('showBusinessAddress');
  const showBusinessPhone = opt('showBusinessPhone');
  const showBusinessEmail = opt('showBusinessEmail');
  const showClientAddress = opt('showClientAddress');
  const showClientPhone = opt('showClientPhone');
  const showClientEmail = opt('showClientEmail');
  const showInvoiceNumber = opt('showInvoiceNumber');
  const showInvoiceDate = opt('showInvoiceDate');
  const customTitle = options.customTitle || typeConfig.title;
  const currencySymbol = options.currency || 'INR';

  const fmt = (amount) => {
    if (currencySymbol === 'INR') return formatCurrency(amount);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencySymbol, minimumFractionDigits: 2 }).format(amount || 0);
  };

  const amountInWords = (num) => {
    if (currencySymbol === 'INR') return numberToWords(num);
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const convert = (n) => {
      if (n === 0) return 'Zero';
      let result = '';
      if (n >= 1000000) { result += convert(Math.floor(n / 1000000)) + ' Million '; n %= 1000000; }
      if (n >= 1000) { result += convert(Math.floor(n / 1000)) + ' Thousand '; n %= 1000; }
      if (n >= 100) { result += a[Math.floor(n / 100)] + ' Hundred '; n %= 100; }
      if (n >= 20) { result += b[Math.floor(n / 10)] + ' '; if (n % 10) result += a[n % 10] + ' '; }
      else if (n > 0) { result += a[n] + ' '; }
      return result.trim();
    };
    const names = CURRENCY_NAMES[currencySymbol] || { major: currencySymbol, minor: 'Cents' };
    const rounded = Math.round(num * 100) / 100;
    const whole = Math.floor(rounded);
    const cents = Math.round((rounded - whole) * 100);
    let result = convert(whole) + ' ' + names.major;
    if (cents > 0) result += ' and ' + convert(cents) + ' ' + names.minor;
    return result + ' Only';
  };

  const [qrDataUrl, setQrDataUrl] = useState('');

  // Generate UPI QR code. The VPA now comes from the selected payment account
  // (so switching account swaps both bank block + QR), with fallback to the
  // legacy flat profile.upiId for invoices that pre-date multi-account support.
  const upiId = account?.upiId || profile?.upiId || '';
  useEffect(() => {
    if (!showUPI || !upiId || !totals.total || currencySymbol !== 'INR') {
      setQrDataUrl('');
      return;
    }
    const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(profile?.businessName || '')}&am=${totals.total.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Payment for ${details?.invoiceNumber || 'Invoice'}`)}`;
    QRCode.toDataURL(upiUrl, { width: 120, margin: 1, errorCorrectionLevel: 'M' })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [showUPI, upiId, profile?.businessName, totals.total, details?.invoiceNumber, currencySymbol]);

  const accentColors = {
    'tax-invoice': '#1e40af',
    'proforma': '#7c3aed',
    'bill-of-supply': '#0f766e',
    'credit-note': '#be123c',
  };
  const accent = options.accentColor || accentColors[invoiceType] || accentColors['tax-invoice'];
  const pdfStyle = options.pdfStyle || 'classic';

  // Check if any item has discount
  const hasAnyDiscount = showDiscount && items.some(item => (item.discount || 0) > 0);

  // Header renderers per style
  const renderModernHeader = () => (
    <>
      <div style={{ background: accent, padding: '1.5rem 2rem', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          {showLogo && profile?.logo && (
            <img src={profile.logo} alt="Logo" style={{ maxHeight: `${profile.logoHeight || 48}px`, maxWidth: '180px', objectFit: 'contain', marginBottom: '0.5rem', display: 'block', filter: 'brightness(0) invert(1)' }} />
          )}
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, letterSpacing: '0.08em' }}>{customTitle}</h1>
          {invoiceType === 'proforma' && (
            <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', margin: '0.25rem 0 0' }}>For estimation purposes only</p>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          {showBusinessName && <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.25rem' }}>{profile?.businessName || 'Your Business'}</h2>}
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
            {showBusinessAddress && profile?.address && <p style={{ margin: 0 }}>{profile.address}</p>}
            {showBusinessAddress && (profile?.city || profile?.pin) && <p style={{ margin: 0 }}>{[profile.city, profile.pin].filter(Boolean).join(' - ')}</p>}
            {showState && profile?.state && <p style={{ margin: 0 }}>{profile.state}</p>}
            {showGSTIN && profile?.gstin && <p style={{ margin: 0 }}>{getCountryConfig(profile?.country).taxIdLabel}: {profile.gstin}</p>}
            {showBusinessEmail && profile?.email && <p style={{ margin: 0 }}>{profile.email}</p>}
            {showBusinessPhone && profile?.phone && <p style={{ margin: 0 }}>Ph: {profile.phone}</p>}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 2rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.78rem' }}>
          {showInvoiceNumber && <span><strong style={{ color: '#64748b' }}>No.</strong> {details?.invoiceNumber}</span>}
          {showInvoiceDate && <span><strong style={{ color: '#64748b' }}>Date</strong> {details?.invoiceDate ? new Date(details.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</span>}
          {showDueDate && details?.dueDate && <span><strong style={{ color: '#64748b' }}>Due</strong> {new Date(details.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
        </div>
        {invoiceType === 'credit-note' && details?.originalInvoiceRef && (
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Against: <strong style={{ color: '#334155' }}>{details.originalInvoiceRef}</strong></span>
        )}
      </div>
    </>
  );

  const renderMinimalHeader = () => (
    <div style={{ padding: '2rem 2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          {showLogo && profile?.logo && (
            <img src={profile.logo} alt="Logo" style={{ maxHeight: `${profile.logoHeight || 48}px`, maxWidth: '180px', objectFit: 'contain', marginBottom: '0.5rem', display: 'block' }} />
          )}
          {showBusinessName && <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>{profile?.businessName || 'Your Business'}</h2>}
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', lineHeight: 1.6, marginTop: '0.25rem' }}>
            {showBusinessAddress && profile?.address && <p style={{ margin: 0 }}>{profile.address}</p>}
            {showBusinessAddress && (profile?.city || profile?.pin) && <p style={{ margin: 0 }}>{[profile.city, profile.pin].filter(Boolean).join(' - ')}</p>}
            {showState && profile?.state && <p style={{ margin: 0 }}>{profile.state}</p>}
            {showGSTIN && profile?.gstin && <p style={{ margin: 0 }}>{getCountryConfig(profile?.country).taxIdLabel}: {profile.gstin}</p>}
            {showBusinessEmail && profile?.email && <p style={{ margin: 0 }}>{profile.email}</p>}
            {showBusinessPhone && profile?.phone && <p style={{ margin: 0 }}>Ph: {profile.phone}</p>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: accent, margin: '0 0 0.5rem', letterSpacing: '0.05em' }}>{customTitle}</h1>
          <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.8 }}>
            {showInvoiceNumber && <p style={{ margin: 0 }}>{details?.invoiceNumber}</p>}
            {showInvoiceDate && <p style={{ margin: 0 }}>{details?.invoiceDate ? new Date(details.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</p>}
            {showDueDate && details?.dueDate && <p style={{ margin: 0 }}>Due: {new Date(details.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>}
          </div>
        </div>
      </div>
      {invoiceType === 'proforma' && (
        <p style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic', margin: '0 0 0.5rem' }}>This is not a tax invoice. For estimation purposes only.</p>
      )}
      <div style={{ borderBottom: `1.5px solid ${accent}`, marginBottom: '0' }} />
    </div>
  );

  const renderClassicHeader = () => (
    <>
      <div style={{ height: '6px', background: `linear-gradient(90deg, ${accent}, ${accent}cc, ${accent}88)` }} />
      <div className="inv-header">
        <div className="inv-header-left">
          {showLogo && profile?.logo && (
            <img src={profile.logo} alt="Logo" style={{ maxHeight: `${profile.logoHeight || 48}px`, maxWidth: '180px', objectFit: 'contain', marginBottom: '0.75rem', display: 'block' }} />
          )}
          <h1 className="inv-title" style={{ color: accent }}>{customTitle}</h1>
          {invoiceType === 'proforma' && (
            <p style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic', marginBottom: '0.75rem' }}>This is not a tax invoice. For estimation purposes only.</p>
          )}
          {invoiceType === 'credit-note' && details?.originalInvoiceRef && (
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.75rem' }}>Against Invoice: <strong style={{ color: '#334155' }}>{details.originalInvoiceRef}</strong></p>
          )}
          <div className="inv-meta">
            {showInvoiceNumber && <div className="inv-meta-row"><span className="inv-meta-label">No.</span><span className="inv-meta-value">{details?.invoiceNumber}</span></div>}
            {showInvoiceDate && <div className="inv-meta-row"><span className="inv-meta-label">Date</span><span className="inv-meta-value">{details?.invoiceDate ? new Date(details.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</span></div>}
            {showDueDate && details?.dueDate && (
              <div className="inv-meta-row"><span className="inv-meta-label">Due Date</span><span className="inv-meta-value">{new Date(details.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
            )}
          </div>
        </div>
        <div className="inv-header-right">
          {showBusinessName && <h2 className="inv-business-name">{profile?.businessName || 'Your Business'}</h2>}
          <div className="inv-business-details">
            {showBusinessAddress && profile?.address && <p>{profile.address}</p>}
            {showBusinessAddress && (profile?.city || profile?.pin) && <p>{[profile.city, profile.pin].filter(Boolean).join(' - ')}</p>}
            {showState && profile?.state && <p>{profile.state}</p>}
            {showGSTIN && profile?.gstin && <p>{getCountryConfig(profile?.country).taxIdLabel}: <strong>{profile.gstin}</strong></p>}
            {showBusinessEmail && profile?.email && <p>{profile.email}</p>}
            {showBusinessPhone && profile?.phone && <p>Ph: {profile.phone}</p>}
          </div>
        </div>
      </div>
    </>
  );

  // Billing parties section (shared but styled per variant)
  const renderParties = () => {
    const padStyle = pdfStyle === 'modern' ? { padding: '1rem 2rem' } : pdfStyle === 'minimal' ? { padding: '0 2rem 1rem', border: 'none' } : {};
    return (
      <div className="inv-parties" style={padStyle}>
        <div className="inv-party">
          <h4 className="inv-section-label">BILL TO</h4>
          <p className="inv-party-name">{client?.name || 'Client Name'}</p>
          <div className="inv-party-details">
            {showClientAddress && client?.address && <p>{client.address}</p>}
            {showClientAddress && (client?.city || client?.pin) && <p>{[client.city, client.pin].filter(Boolean).join(' - ')}</p>}
            {showState && client?.state && <p>{client.state}</p>}
            {showGSTIN && client?.gstin && <p>{getCountryConfig(profile?.country).taxIdLabel}: <strong>{client.gstin}</strong></p>}
            {showClientEmail && client?.email && <p>{client.email}</p>}
            {showClientPhone && client?.phone && <p>Ph: {client.phone}</p>}
          </div>
        </div>
        {showPlaceOfSupply && (
          <div className="inv-party inv-party-right">
            <h4 className="inv-section-label">PLACE OF SUPPLY</h4>
            <p className="inv-party-name">{details?.placeOfSupply || client?.state || '-'}</p>
            {showGST && isIndia && isInterstate && <span className="inv-tax-badge">Interstate (IGST)</span>}
            {showGST && isIndia && !isInterstate && businessState && clientState && <span className="inv-tax-badge inv-tax-badge-green">Intrastate (CGST + SGST)</span>}
            {showGST && !isIndia && <span className="inv-tax-badge inv-tax-badge-green">{taxLabel}</span>}
          </div>
        )}
      </div>
    );
  };

  // Paper-size class + width (v1.8.1 / adapted v1.8.2). Preview container
  // adopts the target paper's width in mm so what-you-see matches
  // what-you-print. For A4/A5 (sheets), the existing multi-column layout
  // renders at scaled type. For thermal 80mm/58mm, we switch to a
  // completely different template — see renderThermalReceipt below.
  //
  // The problem in v1.8.1 was: only the container width changed; the inline
  // margins (`margin: '0 2rem'`) inside the items table + party blocks
  // stayed at A4 sizes. On an 80mm roll, that meant the items were pushed
  // off the right edge. v1.8.2 branches on `kind === 'thermal'` and
  // renders a proper single-column receipt.
  const paperCfg = getPaperSize(options.paperSize);
  const isThermal = paperCfg.kind === 'thermal';
  const containerStyle = {
    width: `${paperCfg.widthMm}mm`,
    minHeight: paperCfg.kind === 'sheet' ? `${paperCfg.heightMm}mm` : undefined,
    ...(isThermal ? { fontFamily: '"Courier New", monospace', fontSize: paperCfg.widthMm >= 80 ? '10.5px' : '9px' } : {}),
  };

  // Thermal receipt render — single column, no colour panels, no margins.
  // Used for both 80mm and 58mm; the CSS class (`paper-thermal-58` vs
  // `paper-thermal-80`) further trims (hide QR at 58mm etc.). Inlined here
  // rather than extracted to a helper because it needs access to all the
  // opt() / totals / items closures. Escape-hatch: user can switch back to
  // A4/A5 any time in Customize.
  if (isThermal) {
    const invoiceNum = details?.invoiceNumber || '';
    const invoiceDate = details?.invoiceDate ? new Date(details.invoiceDate).toLocaleDateString('en-IN') : '';
    const sellerCurrency = getCountryConfig(profile?.country).currency;
    const currencySymbol = sellerCurrency === 'INR' ? '₹' : sellerCurrency;
    const showRoundOff = opt('showRoundOff', false);
    const showQR = opt('showUPI') && paperCfg.widthMm >= 80 && qrDataUrl;
    return (
      <div
        className={`invoice-preview-container ${paperCfg.cssClass} paper-thermal`}
        ref={ref} id="invoice-preview" style={containerStyle}>
        <div style={{ padding: '6px 4px', textAlign: 'center', borderBottom: '1px dashed #000' }}>
          {profile?.logo && <img src={profile.logo} alt="" style={{ maxHeight: 40, marginBottom: 4 }} />}
          <div style={{ fontWeight: 700, fontSize: '1.05em' }}>{profile?.businessName || ''}</div>
          {profile?.address && <div style={{ fontSize: '0.85em' }}>{profile.address}</div>}
          {(profile?.city || profile?.state || profile?.pin) && <div style={{ fontSize: '0.85em' }}>{[profile?.city, profile?.state, profile?.pin].filter(Boolean).join(', ')}</div>}
          {profile?.gstin && <div style={{ fontSize: '0.85em' }}>GSTIN: {profile.gstin}</div>}
          {profile?.phone && <div style={{ fontSize: '0.85em' }}>Ph: {profile.phone}</div>}
        </div>

        <div style={{ padding: '4px', textAlign: 'center', borderBottom: '1px dashed #000', fontWeight: 700, textTransform: 'uppercase' }}>
          {typeConfig?.label || 'Invoice'}
        </div>

        <div style={{ padding: '4px', borderBottom: '1px dashed #000', fontSize: '0.9em' }}>
          <div><strong>#:</strong> {invoiceNum}</div>
          <div><strong>Date:</strong> {invoiceDate}</div>
          {client?.name && <div><strong>To:</strong> {client.name}</div>}
          {client?.gstin && <div><strong>GSTIN:</strong> {client.gstin}</div>}
          {client?.phone && <div><strong>Ph:</strong> {client.phone}</div>}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88em' }}>
          <thead>
            <tr style={{ borderBottom: '1px dashed #000' }}>
              <th style={{ textAlign: 'left', padding: '3px 4px' }}>Item</th>
              <th style={{ textAlign: 'center', padding: '3px 2px', width: '18%' }}>Qty</th>
              <th style={{ textAlign: 'right', padding: '3px 4px', width: '32%' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {(items || []).map((item, idx) => {
              const amount = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
              return (
                <tr key={idx} style={{ borderBottom: '1px dotted #ccc' }}>
                  <td style={{ padding: '3px 4px' }}>
                    <div style={{ fontWeight: 600 }}>{item.name || item.description || 'Item'}</div>
                    {item.hsn && <div style={{ fontSize: '0.8em', color: '#555' }}>HSN {item.hsn}</div>}
                    <div style={{ fontSize: '0.82em', color: '#555' }}>@ {currencySymbol}{(Number(item.rate) || 0).toFixed(2)} {showGST && item.taxPercent > 0 ? `+ ${item.taxPercent}%` : ''}</div>
                  </td>
                  <td style={{ textAlign: 'center', padding: '3px 2px' }}>{Number(item.quantity) || 0}{item.unit ? ` ${item.unit}` : ''}</td>
                  <td style={{ textAlign: 'right', padding: '3px 4px' }}>{currencySymbol}{amount.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ padding: '4px', borderTop: '1px dashed #000', borderBottom: '1px dashed #000', fontSize: '0.9em' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Subtotal:</span><span>{currencySymbol}{(Number(totals?.subtotal) || 0).toFixed(2)}</span>
          </div>
          {Number(totals?.totalDiscount) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Discount:</span><span>-{currencySymbol}{Number(totals.totalDiscount).toFixed(2)}</span>
            </div>
          )}
          {showGST && Number(totals?.cgst) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>CGST:</span><span>{currencySymbol}{Number(totals.cgst).toFixed(2)}</span>
            </div>
          )}
          {showGST && Number(totals?.sgst) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>SGST:</span><span>{currencySymbol}{Number(totals.sgst).toFixed(2)}</span>
            </div>
          )}
          {showGST && Number(totals?.igst) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>IGST:</span><span>{currencySymbol}{Number(totals.igst).toFixed(2)}</span>
            </div>
          )}
          {Number(totals?.cess) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Cess:</span><span>{currencySymbol}{Number(totals.cess).toFixed(2)}</span>
            </div>
          )}
          {showRoundOff && Number(totals?.roundOff) !== 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Round-off:</span><span>{Number(totals.roundOff) > 0 ? '+' : ''}{currencySymbol}{Number(totals.roundOff).toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.08em', marginTop: 3, borderTop: '1px solid #000', paddingTop: 3 }}>
            <span>TOTAL:</span><span>{currencySymbol}{(Number(totals?.total) || 0).toFixed(2)}</span>
          </div>
        </div>

        {showAmountWords && (
          <div style={{ padding: '4px', fontSize: '0.82em', textAlign: 'center', borderBottom: '1px dashed #000' }}>
            <em>{amountInWords(totals?.total || 0)}</em>
          </div>
        )}

        {showBankDetails && (account?.bankName || profile?.bankName) && (
          <div style={{ padding: '4px', fontSize: '0.85em', borderBottom: '1px dashed #000' }}>
            <div style={{ fontWeight: 600 }}>Bank Details:</div>
            <div>{account?.bankName || profile?.bankName}</div>
            {(account?.accountNumber || profile?.accountNumber) && <div>A/c: {account?.accountNumber || profile?.accountNumber}</div>}
            {(account?.ifsc || profile?.ifsc) && <div>IFSC: {account?.ifsc || profile?.ifsc}</div>}
          </div>
        )}

        {showQR && (
          <div style={{ padding: '4px', textAlign: 'center', borderBottom: '1px dashed #000' }}>
            <img src={qrDataUrl} alt="UPI QR" style={{ width: 80, height: 80 }} />
            <div style={{ fontSize: '0.75em' }}>Scan to pay via UPI</div>
          </div>
        )}

        {showNotes && customNotes && (
          <div style={{ padding: '4px', fontSize: '0.82em', borderBottom: '1px dashed #000' }}
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(customNotes) }} />
        )}

        <div style={{ padding: '6px 4px', textAlign: 'center', fontSize: '0.82em' }}>
          <div>Thank you for your business!</div>
          {profile?.email && <div>{profile.email}</div>}
          <div style={{ marginTop: 4, opacity: 0.65 }}>via Free GST Billing Software</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`invoice-preview-container ${paperCfg.cssClass}`}
      ref={ref} id="invoice-preview" style={containerStyle}>
      {pdfStyle === 'modern' && renderModernHeader()}
      {pdfStyle === 'minimal' && renderMinimalHeader()}
      {pdfStyle === 'classic' && renderClassicHeader()}

      {renderParties()}

      {/* Items table */}
      <table className="inv-table" style={{ tableLayout: 'auto', ...(pdfStyle === 'modern' ? { margin: '0 2rem', width: 'calc(100% - 4rem)' } : pdfStyle === 'minimal' ? { margin: '0 2rem', width: 'calc(100% - 4rem)', borderTop: 'none' } : {}) }}>
        <thead>
          {showGST ? (
            isIndia && isInterstate ? (
              <>
                <tr>
                  <th className="inv-th" rowSpan="2">#</th>
                  <th className="inv-th" rowSpan="2">Description</th>
                  {showHSN && <th className="inv-th inv-th-center" rowSpan="2">HSN/SAC</th>}
                  {showItemQty && <th className="inv-th inv-th-center" rowSpan="2">Qty</th>}
                  {showRateColumn && <th className="inv-th inv-th-right" rowSpan="2">Rate</th>}
                  {hasAnyDiscount && <th className="inv-th inv-th-right" rowSpan="2">Disc.</th>}
                  <th className="inv-th inv-th-center" colSpan="2" style={{ borderBottom: '1px solid #cbd5e1' }}>IGST</th>
                  <th className="inv-th inv-th-right" rowSpan="2">Amount</th>
                </tr>
                <tr>
                  <th className="inv-th inv-th-center">%</th>
                  <th className="inv-th inv-th-right">Amt</th>
                </tr>
              </>
            ) : isIndia ? (
              <>
                <tr>
                  <th className="inv-th" rowSpan="2">#</th>
                  <th className="inv-th" rowSpan="2">Description</th>
                  {showHSN && <th className="inv-th inv-th-center" rowSpan="2">HSN/SAC</th>}
                  {showItemQty && <th className="inv-th inv-th-center" rowSpan="2">Qty</th>}
                  {showRateColumn && <th className="inv-th inv-th-right" rowSpan="2">Rate</th>}
                  {hasAnyDiscount && <th className="inv-th inv-th-right" rowSpan="2">Disc.</th>}
                  <th className="inv-th inv-th-center" colSpan="2" style={{ borderBottom: '1px solid #cbd5e1' }}>CGST</th>
                  <th className="inv-th inv-th-center" colSpan="2" style={{ borderBottom: '1px solid #cbd5e1' }}>SGST</th>
                  <th className="inv-th inv-th-right" rowSpan="2">Amount</th>
                </tr>
                <tr>
                  <th className="inv-th inv-th-center">%</th>
                  <th className="inv-th inv-th-right">Amt</th>
                  <th className="inv-th inv-th-center">%</th>
                  <th className="inv-th inv-th-right">Amt</th>
                </tr>
              </>
            ) : (
              // Foreign: single tax column (VAT/SST/etc.) — no CGST/SGST/IGST split
              <>
                <tr>
                  <th className="inv-th" rowSpan="2">#</th>
                  <th className="inv-th" rowSpan="2">Description</th>
                  {showHSN && <th className="inv-th inv-th-center" rowSpan="2">HSN/SAC</th>}
                  {showItemQty && <th className="inv-th inv-th-center" rowSpan="2">Qty</th>}
                  {showRateColumn && <th className="inv-th inv-th-right" rowSpan="2">Rate</th>}
                  {hasAnyDiscount && <th className="inv-th inv-th-right" rowSpan="2">Disc.</th>}
                  <th className="inv-th inv-th-center" colSpan="2" style={{ borderBottom: '1px solid #cbd5e1' }}>{taxLabel}</th>
                  <th className="inv-th inv-th-right" rowSpan="2">Amount</th>
                </tr>
                <tr>
                  <th className="inv-th inv-th-center">%</th>
                  <th className="inv-th inv-th-right">Amt</th>
                </tr>
              </>
            )
          ) : (
            <tr>
              <th className="inv-th">#</th>
              <th className="inv-th">Description</th>
              {showHSN && <th className="inv-th inv-th-center">HSN/SAC</th>}
              {showItemQty && <th className="inv-th inv-th-center">Qty</th>}
              {showRateColumn && <th className="inv-th inv-th-right">Rate</th>}
              {hasAnyDiscount && <th className="inv-th inv-th-right">Disc.</th>}
              <th className="inv-th inv-th-right">Amount</th>
            </tr>
          )}
        </thead>
        <tbody>
          {items.map((item, index) => {
            const lineAmount = item.quantity * item.rate;
            const discount = item.discount || 0;
            const grossAfterDiscount = lineAmount - discount;
            const taxRate = item.taxPercent || 0;
            const isTaxInclusive = totals.taxInclusive;
            const afterDiscount = isTaxInclusive && showGST ? grossAfterDiscount / (1 + taxRate / 100) : grossAfterDiscount;
            const taxAmount = isTaxInclusive && showGST ? grossAfterDiscount - afterDiscount : afterDiscount * taxRate / 100;
            const halfRate = taxRate / 2;
            const halfTax = taxAmount / 2;
            return (
              <tr key={item.id} className={index % 2 === 0 ? 'inv-tr-even' : ''}>
                <td className="inv-td inv-td-muted">{index + 1}</td>
                <td className="inv-td inv-td-name">{item.name || '-'}</td>
                {showHSN && <td className="inv-td inv-td-center inv-td-muted">{item.hsn || '-'}</td>}
                {showItemQty && <td className="inv-td inv-td-center">{item.quantity}{showItemUnit && item.unit ? ` ${item.unit}` : ''}</td>}
                {showRateColumn && <td className="inv-td inv-td-right">{fmt(item.rate)}</td>}
                {hasAnyDiscount && <td className="inv-td inv-td-right">{discount > 0 ? fmt(discount) : '-'}</td>}
                {showGST && (
                  isIndia && isInterstate ? (
                    <>
                      <td className="inv-td inv-td-center">{taxRate}%</td>
                      <td className="inv-td inv-td-right">{fmt(taxAmount)}</td>
                    </>
                  ) : isIndia ? (
                    <>
                      <td className="inv-td inv-td-center">{halfRate}%</td>
                      <td className="inv-td inv-td-right">{fmt(halfTax)}</td>
                      <td className="inv-td inv-td-center">{halfRate}%</td>
                      <td className="inv-td inv-td-right">{fmt(halfTax)}</td>
                    </>
                  ) : (
                    <>
                      <td className="inv-td inv-td-center">{taxRate}%</td>
                      <td className="inv-td inv-td-right">{fmt(taxAmount)}</td>
                    </>
                  )
                )}
                <td className="inv-td inv-td-right inv-td-amount">{fmt(afterDiscount)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals section */}
      <div className="inv-totals-section" style={pdfStyle !== 'classic' ? { padding: '1rem 2rem' } : {}}>
        <div className="inv-words">
          {showAmountWords && (
            <>
              <h4 className="inv-section-label">AMOUNT IN WORDS</h4>
              <p className="inv-words-text">{amountInWords(totals.total)}</p>
            </>
          )}
          {/* UPI QR Code */}
          {qrDataUrl && (
            <div style={{ marginTop: '1.25rem' }}>
              <h4 className="inv-section-label">SCAN TO PAY (UPI)</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <img src={qrDataUrl} alt="UPI QR" style={{ width: '90px', height: '90px', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', lineHeight: 1.5 }}>
                  <p style={{ margin: 0, color: '#94a3b8' }}>UPI ID:</p>
                  <p style={{ margin: 0, color: '#334155', fontWeight: 600, fontSize: '0.75rem' }}>{upiId}</p>
                  <p style={{ margin: '0.25rem 0 0', color: '#94a3b8' }}>{fmt(totals.total)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="inv-totals">
          {showSubtotal && (
            <div className="inv-total-row">
              <span>Subtotal</span>
              <span>{fmt(totals.subtotal)}</span>
            </div>
          )}
          {totals.totalDiscount > 0 && (
            <div className="inv-total-row" style={{ color: '#dc2626' }}>
              <span>Discount</span>
              <span>- {fmt(totals.totalDiscount)}</span>
            </div>
          )}
          {showGST && (
            isIndia && isInterstate ? (
              <div className="inv-total-row">
                <span>IGST</span>
                <span>{fmt(totals.igst)}</span>
              </div>
            ) : isIndia ? (
              <>
                <div className="inv-total-row">
                  <span>CGST</span>
                  <span>{fmt(totals.cgst)}</span>
                </div>
                <div className="inv-total-row">
                  <span>SGST</span>
                  <span>{fmt(totals.sgst)}</span>
                </div>
              </>
            ) : (
              <div className="inv-total-row">
                <span>{taxLabel}</span>
                <span>{fmt((totals.cgst || 0) + (totals.sgst || 0) + (totals.igst || 0))}</span>
              </div>
            )
          )}
          {totals.cess > 0 && (
            <div className="inv-total-row">
              <span>GST Cess</span>
              <span>{fmt(totals.cess)}</span>
            </div>
          )}
          {totals.tcsAmount > 0 && (
            <div className="inv-total-row">
              <span>TCS{options.tcsSection ? ` (${options.tcsSection} @ ${options.tcsRate}%)` : ''}</span>
              <span>{fmt(totals.tcsAmount)}</span>
            </div>
          )}
          {totals.roundOff !== undefined && totals.roundOff !== 0 && (
            <div className="inv-total-row" style={{ color: '#64748b', fontStyle: 'italic' }}>
              <span>Round-off</span>
              <span>{totals.roundOff > 0 ? '+' : ''}{fmt(totals.roundOff)}</span>
            </div>
          )}
          {pdfStyle === 'modern' ? (
            <div className="inv-total-row inv-total-final inv-total-modern" style={{ background: accent, color: '#fff', borderRadius: '6px', padding: '0.6rem 0.75rem', marginTop: '0.25rem' }}>
              <span style={{ color: '#fff' }}>{invoiceType === 'credit-note' ? 'Credit Amount' : 'Total Due'}</span>
              <span style={{ color: '#fff' }}>{fmt(totals.total)}</span>
            </div>
          ) : (
            <div className="inv-total-row inv-total-final">
              <span>{invoiceType === 'credit-note' ? 'Credit Amount' : 'Total Due'}</span>
              <span style={{ color: accent }}>{fmt(totals.total)}</span>
            </div>
          )}
          {totals.tdsAmount > 0 && (
            <>
              <div className="inv-total-row" style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem', borderTop: '1px dashed #e2e8f0', paddingTop: '0.4rem' }}>
                <span>Less: TDS{options.tdsSection ? ` (${options.tdsSection} @ ${options.tdsRate}%)` : ''}</span>
                <span>− {fmt(totals.tdsAmount)}</span>
              </div>
              <div className="inv-total-row" style={{ fontWeight: 600, color: '#0f766e', fontSize: '0.78rem' }}>
                <span>Net Receivable</span>
                <span>{fmt(totals.netReceivable)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Reverse-charge declaration (India) — printed prominently between the
          tax block and the footer when the seller has flagged this invoice as
          RCM. The buyer is responsible for paying GST under Section 9(3)/9(4). */}
      {options.reverseCharge && isIndia && showGST && (
        <div style={{ margin: '0 2rem 0.5rem', padding: '0.5rem 0.75rem', background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', borderRadius: 4, fontSize: '0.78rem', color: 'var(--warn-text)' }}>
          <strong>Reverse Charge applicable.</strong> GST is payable by the recipient under Section 9(3)/9(4) of the CGST Act.
        </div>
      )}

      {/* Composition-scheme mandatory declaration — Rule 46A of CGST Rules. The
          exact wording is prescribed; do not paraphrase. */}
      {invoiceType === 'composition' && (
        <div style={{ margin: '0 2rem 0.5rem', padding: '0.5rem 0.75rem', background: 'var(--info-bg)', border: '1px solid var(--info-border)', borderRadius: 4, fontSize: '0.78rem', color: 'var(--info-text)', fontStyle: 'italic' }}>
          "Composition taxable person, not eligible to collect tax on supplies."
          &nbsp;<span style={{ fontStyle: 'normal', fontSize: '0.7rem' }}>(Rule 46A, CGST Rules)</span>
        </div>
      )}

      {/* Footer */}
      <div className="inv-footer" style={pdfStyle !== 'classic' ? { padding: '1rem 2rem' } : {}}>
        <div className="inv-footer-left">
          {/* Bank details render from the resolved payment account. Account fields
              fall back to the flat profile fields when neither array entry nor flat
              field exists — guarantees byte-identical PDFs for v1.4.3 invoices. */}
          {showBankDetails && (account?.bankName || profile?.bankName) && (
            <div className="inv-footer-block">
              <h4 className="inv-section-label">BANK DETAILS</h4>
              {showAccountLabel && account?.label && (
                <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                  Pay via: <strong style={{ color: '#334155' }}>{account.label}</strong>
                </p>
              )}
              <div className="inv-footer-details">
                <p><span className="inv-detail-label">Bank:</span> {account?.bankName || profile.bankName}</p>
                <p><span className="inv-detail-label">A/C No:</span> {account?.accountNumber || profile.accountNumber}</p>
                {(account?.ifsc || profile.ifsc) && <p><span className="inv-detail-label">{sellerCC.bankLabel || 'IFSC'}:</span> {account?.ifsc || profile.ifsc}</p>}
                {(account?.swift || profile.swift) && <p><span className="inv-detail-label">SWIFT/BIC:</span> {account?.swift || profile.swift}</p>}
                {profile.pan && isIndia && <p><span className="inv-detail-label">PAN:</span> {profile.pan}</p>}
              </div>
            </div>
          )}
          {options.exchangeRate && currencySymbol !== 'INR' && (
            <div className="inv-footer-block">
              <h4 className="inv-section-label">EXCHANGE RATE</h4>
              <p className="inv-terms">{formatExchangeRateLine(currencySymbol, options.exchangeRate, profile?.country === 'India' || !profile?.country ? 'INR' : sellerCC.currency)}</p>
            </div>
          )}
          {/* Terms and notes accept rich HTML; same DOMPurify sanitization the extraSections
              block uses, which keeps b/i/u/lists/links/headings and strips everything else. */}
          {(() => {
            const termsHtml = customTerms ? DOMPurify.sanitize(customTerms) : '';
            const hasTerms = termsHtml && termsHtml.replace(/<[^>]*>/g, '').trim();
            return showTerms && hasTerms ? (
              <div className="inv-footer-block">
                <h4 className="inv-section-label">TERMS & CONDITIONS</h4>
                <div className="inv-terms inv-rich" dangerouslySetInnerHTML={{ __html: termsHtml }} />
              </div>
            ) : null;
          })()}
          {(() => {
            const notesHtml = customNotes ? DOMPurify.sanitize(customNotes) : '';
            const hasNotes = notesHtml && notesHtml.replace(/<[^>]*>/g, '').trim();
            return showNotes && hasNotes ? (
              <div className="inv-footer-block">
                <h4 className="inv-section-label">NOTES / REMARKS</h4>
                <div className="inv-terms inv-rich" dangerouslySetInnerHTML={{ __html: notesHtml }} />
              </div>
            ) : null;
          })()}
        </div>
        {showSignature && profile?.signature && (
          <div className="inv-signature">
            {showSignatoryText && <p className="inv-sig-label">Authorized Signatory</p>}
            <img src={profile.signature} alt="Signature" style={{
              maxHeight: '60px', maxWidth: '180px', objectFit: 'contain',
              display: 'block', marginLeft: 'auto', marginBottom: '0.4rem'
            }} />
            <p className="inv-sig-name">{profile?.businessName}</p>
          </div>
        )}
      </div>

      {/* Extra Sections - each starts on new page */}
      {(() => {
        const filtered = extraSections.filter(s => s.title || s.content);
        const totalPages = filtered.length > 0 ? 1 + filtered.length : 1;
        return filtered.map((section, idx) => (
          <div key={section.id} className="inv-extra-page" data-pdf-page={idx + 2}>
            <div className="inv-extra-page-header">
              <div>
                <span className="inv-extra-ref">{customTitle} — {details?.invoiceNumber}</span>
                {client?.name && <span className="inv-extra-ref"> | {client.name}</span>}
              </div>
              <span className="inv-extra-page-num">Page {idx + 2} of {totalPages}</span>
            </div>
            {section.title && <h4 className="inv-section-label" style={{ marginBottom: '0.75rem' }}>{section.title.toUpperCase()}</h4>}
            {section.content && (
              <div className="inv-extra-content" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(section.content) }} />
            )}
          </div>
        ));
      })()}

      {/* Watermark for proforma */}
      {invoiceType === 'proforma' && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%) rotate(-35deg)',
          fontSize: '5rem', fontWeight: 800, color: `${accent}0a`,
          pointerEvents: 'none', whiteSpace: 'nowrap'
        }}>
          ESTIMATE
        </div>
      )}

      {/* Bottom bar for modern style */}
      {pdfStyle === 'modern' && (
        <div style={{ height: '4px', background: accent, marginTop: 'auto' }} />
      )}
    </div>
  );
});

export default InvoicePreview;
