import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import DOMPurify from 'dompurify';
import { numberToWords, formatCurrency, INVOICE_TYPES } from '../utils';

const InvoicePreview = React.forwardRef(({ profile, client, details, items, totals, invoiceType = 'tax-invoice', customTerms, customNotes, extraSections = [], options = {} }, ref) => {
  const businessState = profile?.state?.trim().toLowerCase();
  const clientState = client?.state?.trim().toLowerCase();
  const isInterstate = businessState && clientState && businessState !== clientState;
  const typeConfig = INVOICE_TYPES[invoiceType] || INVOICE_TYPES['tax-invoice'];

  // Options with defaults
  const showGST = options.showGST !== undefined ? options.showGST : typeConfig.showGST;
  const showState = options.showState !== undefined ? options.showState : true;
  const showGSTIN = options.showGSTIN !== undefined ? options.showGSTIN : true;
  const showPlaceOfSupply = options.showPlaceOfSupply !== undefined ? options.showPlaceOfSupply : showGST;
  const showHSN = options.showHSN !== undefined ? options.showHSN : true;
  const showDiscount = options.showDiscount !== undefined ? options.showDiscount : true;
  const showBankDetails = options.showBankDetails !== undefined ? options.showBankDetails : true;
  const showUPI = options.showUPI !== undefined ? options.showUPI : true;
  const showLogo = options.showLogo !== undefined ? options.showLogo : true;
  const showSignature = options.showSignature !== undefined ? options.showSignature : true;
  const showTerms = options.showTerms !== undefined ? options.showTerms : true;
  const showNotes = options.showNotes !== undefined ? options.showNotes : true;
  const showAmountWords = options.showAmountWords !== undefined ? options.showAmountWords : true;
  const showDueDate = options.showDueDate !== undefined ? options.showDueDate : true;
  const showItemQty = options.showItemQty !== undefined ? options.showItemQty : true;
  const customTitle = options.customTitle || typeConfig.title;
  const currencySymbol = options.currency || 'INR';

  const fmt = (amount) => {
    if (currencySymbol === 'INR') return formatCurrency(amount);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencySymbol, minimumFractionDigits: 2 }).format(amount || 0);
  };

  const amountInWords = (num) => {
    if (currencySymbol === 'INR') return numberToWords(num);
    // English number-to-words for foreign currencies
    const currencyNames = { USD: 'Dollars', EUR: 'Euros', GBP: 'Pounds', AUD: 'Dollars', CAD: 'Dollars', SGD: 'Dollars', AED: 'Dirhams' };
    const centsNames = { USD: 'Cents', EUR: 'Cents', GBP: 'Pence', AUD: 'Cents', CAD: 'Cents', SGD: 'Cents', AED: 'Fils' };
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
    const rounded = Math.round(num * 100) / 100;
    const whole = Math.floor(rounded);
    const cents = Math.round((rounded - whole) * 100);
    let result = convert(whole) + ' ' + (currencyNames[currencySymbol] || currencySymbol);
    if (cents > 0) result += ' and ' + convert(cents) + ' ' + (centsNames[currencySymbol] || 'Cents');
    return result + ' Only';
  };

  const [qrDataUrl, setQrDataUrl] = useState('');

  // Generate UPI QR code
  useEffect(() => {
    if (!showUPI || !profile?.upiId || !totals.total || currencySymbol !== 'INR') {
      setQrDataUrl('');
      return;
    }
    const upiUrl = `upi://pay?pa=${encodeURIComponent(profile.upiId)}&pn=${encodeURIComponent(profile.businessName || '')}&am=${totals.total.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Payment for ${details?.invoiceNumber || 'Invoice'}`)}`;
    QRCode.toDataURL(upiUrl, { width: 120, margin: 1, errorCorrectionLevel: 'M' })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [showUPI, profile?.upiId, profile?.businessName, totals.total, details?.invoiceNumber, currencySymbol]);

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
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.25rem' }}>{profile?.businessName || 'Your Business'}</h2>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
            {profile?.address && <p style={{ margin: 0 }}>{profile.address}</p>}
            {(profile?.city || profile?.pin) && <p style={{ margin: 0 }}>{[profile.city, profile.pin].filter(Boolean).join(' - ')}</p>}
            {showState && profile?.state && <p style={{ margin: 0 }}>{profile.state}</p>}
            {showGSTIN && profile?.gstin && <p style={{ margin: 0 }}>GSTIN: {profile.gstin}</p>}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 2rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.78rem' }}>
          <span><strong style={{ color: '#64748b' }}>No.</strong> {details?.invoiceNumber}</span>
          <span><strong style={{ color: '#64748b' }}>Date</strong> {details?.invoiceDate ? new Date(details.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</span>
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
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>{profile?.businessName || 'Your Business'}</h2>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', lineHeight: 1.6, marginTop: '0.25rem' }}>
            {profile?.address && <p style={{ margin: 0 }}>{profile.address}</p>}
            {(profile?.city || profile?.pin) && <p style={{ margin: 0 }}>{[profile.city, profile.pin].filter(Boolean).join(' - ')}</p>}
            {showState && profile?.state && <p style={{ margin: 0 }}>{profile.state}</p>}
            {showGSTIN && profile?.gstin && <p style={{ margin: 0 }}>GSTIN: {profile.gstin}</p>}
            {profile?.email && <p style={{ margin: 0 }}>{profile.email}</p>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: accent, margin: '0 0 0.5rem', letterSpacing: '0.05em' }}>{customTitle}</h1>
          <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.8 }}>
            <p style={{ margin: 0 }}>{details?.invoiceNumber}</p>
            <p style={{ margin: 0 }}>{details?.invoiceDate ? new Date(details.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</p>
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
            <div className="inv-meta-row"><span className="inv-meta-label">No.</span><span className="inv-meta-value">{details?.invoiceNumber}</span></div>
            <div className="inv-meta-row"><span className="inv-meta-label">Date</span><span className="inv-meta-value">{details?.invoiceDate ? new Date(details.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</span></div>
            {showDueDate && details?.dueDate && (
              <div className="inv-meta-row"><span className="inv-meta-label">Due Date</span><span className="inv-meta-value">{new Date(details.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
            )}
          </div>
        </div>
        <div className="inv-header-right">
          <h2 className="inv-business-name">{profile?.businessName || 'Your Business'}</h2>
          <div className="inv-business-details">
            {profile?.address && <p>{profile.address}</p>}
            {(profile?.city || profile?.pin) && <p>{[profile.city, profile.pin].filter(Boolean).join(' - ')}</p>}
            {showState && profile?.state && <p>{profile.state}</p>}
            {showGSTIN && profile?.gstin && <p>GSTIN: <strong>{profile.gstin}</strong></p>}
            {profile?.email && <p>{profile.email}</p>}
            {profile?.phone && <p>Ph: {profile.phone}</p>}
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
            {client?.address && <p>{client.address}</p>}
            {(client?.city || client?.pin) && <p>{[client.city, client.pin].filter(Boolean).join(' - ')}</p>}
            {showState && client?.state && <p>{client.state}</p>}
            {showGSTIN && client?.gstin && <p>GSTIN: <strong>{client.gstin}</strong></p>}
          </div>
        </div>
        {showPlaceOfSupply && (
          <div className="inv-party inv-party-right">
            <h4 className="inv-section-label">PLACE OF SUPPLY</h4>
            <p className="inv-party-name">{details?.placeOfSupply || client?.state || '-'}</p>
            {showGST && isInterstate && <span className="inv-tax-badge">Interstate (IGST)</span>}
            {showGST && !isInterstate && businessState && clientState && <span className="inv-tax-badge inv-tax-badge-green">Intrastate (CGST + SGST)</span>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="invoice-preview-container" ref={ref} id="invoice-preview">
      {pdfStyle === 'modern' && renderModernHeader()}
      {pdfStyle === 'minimal' && renderMinimalHeader()}
      {pdfStyle === 'classic' && renderClassicHeader()}

      {renderParties()}

      {/* Items table */}
      <table className="inv-table" style={{ tableLayout: 'auto', ...(pdfStyle === 'modern' ? { margin: '0 2rem', width: 'calc(100% - 4rem)' } : pdfStyle === 'minimal' ? { margin: '0 2rem', width: 'calc(100% - 4rem)', borderTop: 'none' } : {}) }}>
        <thead>
          {showGST ? (
            isInterstate ? (
              <>
                <tr>
                  <th className="inv-th" rowSpan="2">#</th>
                  <th className="inv-th" rowSpan="2">Description</th>
                  {showHSN && <th className="inv-th inv-th-center" rowSpan="2">HSN/SAC</th>}
                  {showItemQty && <th className="inv-th inv-th-center" rowSpan="2">Qty</th>}
                  <th className="inv-th inv-th-right" rowSpan="2">Rate</th>
                  {hasAnyDiscount && <th className="inv-th inv-th-right" rowSpan="2">Disc.</th>}
                  <th className="inv-th inv-th-center" colSpan="2" style={{ borderBottom: '1px solid #cbd5e1' }}>IGST</th>
                  <th className="inv-th inv-th-right" rowSpan="2">Amount</th>
                </tr>
                <tr>
                  <th className="inv-th inv-th-center">%</th>
                  <th className="inv-th inv-th-right">Amt</th>
                </tr>
              </>
            ) : (
              <>
                <tr>
                  <th className="inv-th" rowSpan="2">#</th>
                  <th className="inv-th" rowSpan="2">Description</th>
                  {showHSN && <th className="inv-th inv-th-center" rowSpan="2">HSN/SAC</th>}
                  {showItemQty && <th className="inv-th inv-th-center" rowSpan="2">Qty</th>}
                  <th className="inv-th inv-th-right" rowSpan="2">Rate</th>
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
            )
          ) : (
            <tr>
              <th className="inv-th">#</th>
              <th className="inv-th">Description</th>
              {showHSN && <th className="inv-th inv-th-center">HSN/SAC</th>}
              {showItemQty && <th className="inv-th inv-th-center">Qty</th>}
              <th className="inv-th inv-th-right">Rate</th>
              {hasAnyDiscount && <th className="inv-th inv-th-right">Disc.</th>}
              <th className="inv-th inv-th-right">Amount</th>
            </tr>
          )}
        </thead>
        <tbody>
          {items.map((item, index) => {
            const lineAmount = item.quantity * item.rate;
            const discount = item.discount || 0;
            const afterDiscount = lineAmount - discount;
            const taxRate = item.taxPercent || 0;
            const taxAmount = afterDiscount * taxRate / 100;
            const halfRate = taxRate / 2;
            const halfTax = taxAmount / 2;
            return (
              <tr key={item.id} className={index % 2 === 0 ? 'inv-tr-even' : ''}>
                <td className="inv-td inv-td-muted">{index + 1}</td>
                <td className="inv-td inv-td-name">{item.name || '-'}</td>
                {showHSN && <td className="inv-td inv-td-center inv-td-muted">{item.hsn || '-'}</td>}
                {showItemQty && <td className="inv-td inv-td-center">{item.quantity}</td>}
                <td className="inv-td inv-td-right">{fmt(item.rate)}</td>
                {hasAnyDiscount && <td className="inv-td inv-td-right">{discount > 0 ? fmt(discount) : '-'}</td>}
                {showGST && (
                  isInterstate ? (
                    <>
                      <td className="inv-td inv-td-center">{taxRate}%</td>
                      <td className="inv-td inv-td-right">{fmt(taxAmount)}</td>
                    </>
                  ) : (
                    <>
                      <td className="inv-td inv-td-center">{halfRate}%</td>
                      <td className="inv-td inv-td-right">{fmt(halfTax)}</td>
                      <td className="inv-td inv-td-center">{halfRate}%</td>
                      <td className="inv-td inv-td-right">{fmt(halfTax)}</td>
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
                  <p style={{ margin: 0, color: '#334155', fontWeight: 600, fontSize: '0.75rem' }}>{profile.upiId}</p>
                  <p style={{ margin: '0.25rem 0 0', color: '#94a3b8' }}>{fmt(totals.total)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="inv-totals">
          <div className="inv-total-row">
            <span>Subtotal</span>
            <span>{fmt(totals.subtotal)}</span>
          </div>
          {totals.totalDiscount > 0 && (
            <div className="inv-total-row" style={{ color: '#dc2626' }}>
              <span>Discount</span>
              <span>- {fmt(totals.totalDiscount)}</span>
            </div>
          )}
          {showGST && (
            isInterstate ? (
              <div className="inv-total-row">
                <span>IGST</span>
                <span>{fmt(totals.igst)}</span>
              </div>
            ) : (
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
            )
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
        </div>
      </div>

      {/* Footer */}
      <div className="inv-footer" style={pdfStyle !== 'classic' ? { padding: '1rem 2rem' } : {}}>
        <div className="inv-footer-left">
          {showBankDetails && profile?.bankName && (
            <div className="inv-footer-block">
              <h4 className="inv-section-label">BANK DETAILS</h4>
              <div className="inv-footer-details">
                <p><span className="inv-detail-label">Bank:</span> {profile.bankName}</p>
                <p><span className="inv-detail-label">A/C No:</span> {profile.accountNumber}</p>
                <p><span className="inv-detail-label">IFSC:</span> {profile.ifsc}</p>
                {profile.pan && <p><span className="inv-detail-label">PAN:</span> {profile.pan}</p>}
              </div>
            </div>
          )}
          {showTerms && customTerms && (
            <div className="inv-footer-block">
              <h4 className="inv-section-label">TERMS & CONDITIONS</h4>
              <div className="inv-terms">
                {customTerms.split('\n').filter(l => l.trim()).map((line, i) => (
                  <span key={i}>{line.trim()}{i < customTerms.split('\n').filter(l => l.trim()).length - 1 ? ' | ' : ''}</span>
                ))}
              </div>
            </div>
          )}
          {showNotes && customNotes && (
            <div className="inv-footer-block">
              <h4 className="inv-section-label">NOTES / REMARKS</h4>
              <p className="inv-terms">{customNotes}</p>
            </div>
          )}
        </div>
        {showSignature && profile?.signature && (
          <div className="inv-signature">
            <p className="inv-sig-label">Authorized Signatory</p>
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
