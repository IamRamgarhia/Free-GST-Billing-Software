// v1.10.73 - two ruled-box invoice designs, built from real invoices users
// asked for:
//   "boxed" - every section in ruled boxes, the item table filled with empty
//             rows to a fixed height (like a printed quotation pad).
//   "tally" - the Tally layout Indian businesses and their clients know:
//             reference and dispatch boxes, taxes inside the item table,
//             HSN/SAC tax summary, tax amount in words, declaration, and a
//             "Customer's Seal and Signature" box.
//
// All numbers come from the caller (InvoicePreview), which computes them the
// same way for every design, so a total can never differ between designs.
//
// PDF page breaks: buildPDF only ends a page on an element edge it knows about.
// Every block and every table row here carries data-pdf-page-boundary, so a
// page can end between rows or blocks but never cuts through one.
import React from 'react';
import { filledOrderDetails, getStateCode } from '../utils';

const LINE = '#1f2937';
const B = `1px solid ${LINE}`;
const cell = { border: B, padding: '4px 6px', verticalAlign: 'top' };
const th = { ...cell, fontWeight: 700, textAlign: 'center', background: '#f3f4f6' };
const right = { textAlign: 'right', whiteSpace: 'nowrap' };
const center = { textAlign: 'center' };
const small = { fontSize: '0.92em', color: '#374151' };
const label = { fontWeight: 700 };
const blockProps = { 'data-pdf-page-boundary': '' };
// Tally item-table cell: column lines on both sides, none between rows.
const vc = { padding: '3px 6px', borderLeft: B, borderRight: B, verticalAlign: 'top' };
const blank = (n, height) => Array.from({ length: Math.max(0, n) }, (_, i) => <td key={`b${i}`} style={{ ...vc, ...(height ? { height } : {}) }} />);

const num = (n) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);
const stateWithCode = (state) => {
  if (!state) return '';
  const code = getStateCode(state);
  return code ? `${state}, Code : ${code}` : state;
};

function Signature({ ctx, align = 'right' }) {
  const { sig } = ctx;
  return (
    <div {...blockProps} data-pdf-signature="" style={{ textAlign: align, minHeight: 90, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ fontWeight: 700 }}>for {ctx.profile?.businessName || 'Your Business'}</div>
      {sig.show && (
        <div style={{ display: 'flex', gap: 6, justifyContent: align === 'right' ? 'flex-end' : 'center', alignItems: 'flex-end', margin: '4px 0' }}>
          {sig.stampImg && <img src={sig.stampImg} alt="Stamp" style={{ maxHeight: `${sig.stampHeight}px`, maxWidth: 110, objectFit: 'contain' }} />}
          {sig.sigImg && <img src={sig.sigImg} alt="Signature" style={{ maxHeight: `${sig.sigHeight}px`, maxWidth: 160, objectFit: 'contain' }} />}
        </div>
      )}
      {ctx.showSignatoryText && <div>Authorised Signatory</div>}
    </div>
  );
}

function RichBlock({ title, html, className = '' }) {
  if (!html) return null;
  return (
    <div {...blockProps} style={{ marginBottom: 4 }}>
      <div style={label}>{title}</div>
      <div className={`inv-rich ${className}`} style={small} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

// Tax rows shown under the items (Tally) or beside the bank block (Boxed).
function taxRows(ctx) {
  const { totals, isIndia, isInterstate, showGST, taxLabel, singleRate, options } = ctx;
  const rows = [];
  const pct = singleRate != null ? ` (${singleRate}%)` : '';
  const halfPct = singleRate != null ? ` (${singleRate / 2}%)` : '';
  if (showGST) {
    if (isIndia && isInterstate) rows.push(['IGST' + pct, totals.igst]);
    else if (isIndia) {
      rows.push(['CGST' + halfPct, totals.cgst]);
      rows.push([(totals.isIntraUT ? 'UTGST' : 'SGST') + halfPct, (totals.sgst || 0) + (totals.utgst || 0)]);
    } else rows.push([taxLabel, (totals.cgst || 0) + (totals.sgst || 0) + (totals.igst || 0)]);
  }
  if (totals.cess > 0) rows.push(['Cess', totals.cess]);
  if (totals.tcsAmount > 0) rows.push([`TCS${options.tcsSection ? ` (${options.tcsSection} @ ${options.tcsRate}%)` : ''}`, totals.tcsAmount]);
  if (totals.invoiceDiscountAmount > 0) rows.push(['Less : Discount on total', -totals.invoiceDiscountAmount]);
  if (totals.roundOff) rows.push([totals.roundOff < 0 ? 'Less : Round Off' : 'Round Off', totals.roundOff]);
  return rows;
}

export function HsnSummaryTable({ ctx }) {
  const { hsnRows, isIndia, isInterstate, taxLabel, totals } = ctx;
  if (!hsnRows.length) return null;
  const sum = (k) => hsnRows.reduce((s, r) => s + r[k], 0);
  const intra = isIndia && !isInterstate;
  const sgstName = totals.isIntraUT ? 'UTGST' : 'SGST/UTGST';
  return (
    <table className="inv-hsn-summary" style={{ width: '100%', borderCollapse: 'collapse', marginTop: -1 }}>
      <thead>
        <tr {...blockProps}>
          <th style={th} rowSpan={2}>HSN/SAC</th>
          <th style={th} rowSpan={2}>Taxable Value</th>
          {intra ? (<><th style={th} colSpan={2}>CGST</th><th style={th} colSpan={2}>{sgstName}</th></>)
            : <th style={th} colSpan={2}>{isIndia ? 'IGST' : taxLabel}</th>}
          <th style={th} rowSpan={2}>Total Tax Amount</th>
        </tr>
        <tr {...blockProps}>
          <th style={th}>Rate</th><th style={th}>Amount</th>
          {intra && (<><th style={th}>Rate</th><th style={th}>Amount</th></>)}
        </tr>
      </thead>
      <tbody>
        {hsnRows.map((r) => (
          <tr key={`${r.hsn}|${r.rate}`} {...blockProps}>
            <td style={cell}>{r.hsn || '-'}</td>
            <td style={{ ...cell, ...right }}>{num(r.taxable)}</td>
            {intra ? (
              <>
                <td style={{ ...cell, ...center }}>{r.rate / 2}%</td><td style={{ ...cell, ...right }}>{num(r.tax / 2)}</td>
                <td style={{ ...cell, ...center }}>{r.rate / 2}%</td><td style={{ ...cell, ...right }}>{num(r.tax / 2)}</td>
              </>
            ) : (
              <><td style={{ ...cell, ...center }}>{r.rate}%</td><td style={{ ...cell, ...right }}>{num(r.tax)}</td></>
            )}
            <td style={{ ...cell, ...right }}>{num(r.tax)}</td>
          </tr>
        ))}
        <tr {...blockProps} style={{ fontWeight: 700 }}>
          <td style={{ ...cell, ...right }}>Total</td>
          <td style={{ ...cell, ...right }}>{num(sum('taxable'))}</td>
          {intra ? (
            <><td style={cell} /><td style={{ ...cell, ...right }}>{num(sum('tax') / 2)}</td><td style={cell} /><td style={{ ...cell, ...right }}>{num(sum('tax') / 2)}</td></>
          ) : (<><td style={cell} /><td style={{ ...cell, ...right }}>{num(sum('tax'))}</td></>)}
          <td style={{ ...cell, ...right }}>{num(sum('tax'))}</td>
        </tr>
      </tbody>
    </table>
  );
}

function BankLines({ ctx, tally }) {
  const { account, profile, sellerCC } = ctx;
  if (!ctx.showBankDetails || !(account?.bankName || profile?.bankName)) return null;
  const rows = [
    ['Bank Name', account?.bankName || profile.bankName],
    ['Account Name', account?.accountHolderName || profile?.businessName],
    ['A/c No.', account?.accountNumber || profile.accountNumber],
    [tally ? `Branch & ${sellerCC.bankLabel || 'IFS Code'}` : (sellerCC.bankLabel || 'IFSC'), [account?.branch, account?.ifsc || profile.ifsc].filter(Boolean).join(' & ')],
    ['SWIFT', account?.swift || profile.swift],
  ].filter(([, v]) => v);
  return (
    <div {...blockProps}>
      <div style={label}>{tally ? "Company's Bank Details" : 'Bank Details'}</div>
      <table style={{ borderCollapse: 'collapse' }}><tbody>
        {rows.map(([k, v]) => (
          <tr key={k}><td style={{ paddingRight: 8, whiteSpace: 'nowrap' }}>{k}</td><td>: <strong>{v}</strong></td></tr>
        ))}
      </tbody></table>
    </div>
  );
}

function UpiQr({ ctx }) {
  if (!ctx.qrDataUrl) return null;
  return (
    <div {...blockProps} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
      <img src={ctx.qrDataUrl} alt="UPI QR" style={{ width: 72, height: 72 }} />
      <div style={small}>Scan to pay (UPI)<br /><strong>{ctx.upiId}</strong></div>
    </div>
  );
}

function SellerBlock({ ctx, tally }) {
  const { profile, t, sellerCC } = ctx;
  return (
    <div>
      {t.logo && profile?.logo && !tally && (
        <img src={profile.logo} alt="Logo" style={{ maxHeight: `${profile.logoHeight || 48}px`, maxWidth: 160, objectFit: 'contain', marginBottom: 4 }} />
      )}
      {t.businessName && <div style={{ fontWeight: 800, fontSize: '1.05em' }}>{profile?.businessName || 'Your Business'}</div>}
      {t.businessAddress && profile?.address && <div style={{ whiteSpace: 'pre-line' }}>{profile.address}</div>}
      {t.businessAddress && (profile?.city || profile?.pin) && <div>{[profile.city, profile.pin].filter(Boolean).join(' - ')}</div>}
      {t.gstin && profile?.gstin && <div>{sellerCC.taxIdLabel || 'GSTIN'}{tally ? '/UIN' : ''}: <strong>{profile.gstin}</strong></div>}
      {t.state && profile?.state && <div>State Name : {stateWithCode(profile.state)}</div>}
      {(t.businessPhone && profile?.phone) || (profile?.pan && ctx.isIndia) ? (
        <div>{[t.businessPhone && profile?.phone ? `Mobile: ${profile.phone}` : '', profile?.pan && ctx.isIndia ? `PAN: ${profile.pan}` : ''].filter(Boolean).join(' | ')}</div>
      ) : null}
      {t.businessEmail && profile?.email && <div>E-Mail : {profile.email}</div>}
    </div>
  );
}

function PartyBlock({ ctx, heading, party, withContact }) {
  const { t, sellerCC } = ctx;
  return (
    <div>
      <div style={label}>{heading}</div>
      <div style={{ fontWeight: 800 }}>{party.name || 'Client Name'}</div>
      {t.clientAddress && party.address && <div style={{ whiteSpace: 'pre-line' }}>{party.address}</div>}
      {t.clientAddress && (party.city || party.pin) && <div>{[party.city, party.pin].filter(Boolean).join(' - ')}</div>}
      {t.gstin && party.gstin && <div>{sellerCC.taxIdLabel || 'GSTIN'}/UIN : <strong>{party.gstin}</strong></div>}
      {t.state && party.state && <div>State Name : {stateWithCode(party.state)}</div>}
      {withContact && t.clientPhone && party.phone && <div>Ph: {party.phone}</div>}
      {withContact && t.clientEmail && party.email && <div>E-Mail : {party.email}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TALLY STYLE
// ---------------------------------------------------------------------------
function TallyLayout({ ctx }) {
  const { details, client, items, totals, fmt, lineCalc, t, invoiceTitle } = ctx;
  const orderMap = Object.fromEntries(filledOrderDetails(details).map((f) => [f.key, f.value]));
  const shipTo = ctx.shipTo;
  const refBoxes = [
    ['Invoice No.', <strong key="n">{details?.invoiceNumber}</strong>, 'Dated', <strong key="d">{ctx.shortDate(details?.invoiceDate)}</strong>],
    ['Delivery Note', orderMap.deliveryNote, 'Mode/Terms of Payment', orderMap.paymentTerms],
    ['Reference No. & Date.', orderMap.referenceNo, 'Other References', orderMap.otherReferences],
    ["Buyer's Order No.", orderMap.buyerOrderNo, 'Dated', orderMap.buyerOrderDate],
    ['Dispatch Doc No.', orderMap.dispatchDocNo, 'Delivery Note Date', orderMap.deliveryNoteDate],
    ['Dispatched through', orderMap.dispatchedThrough, 'Destination', orderMap.destination],
  ];
  const extraRef = [
    orderMap.vehicleNo && ['Vehicle No.', orderMap.vehicleNo],
    orderMap.revisionNo && ['Revision No.', orderMap.revisionNo],
    (orderMap.periodFrom || orderMap.periodTo) && ['Service Period', [orderMap.periodFrom, orderMap.periodTo].filter(Boolean).join(' to ')],
    t.dueDate && details?.dueDate && ['Due Date', ctx.shortDate(details.dueDate)],
    ctx.showReverseChargeLine && ['Reverse Charge', ctx.reverseChargeText],
    t.placeOfSupply && ctx.placeOfSupply && ['Place of Supply', stateWithCode(ctx.placeOfSupply)],
  ].filter(Boolean);
  const refCell = (k, v) => (
    <td style={{ ...cell, width: '25%', height: 34 }}>
      <div style={small}>{k}</div>
      <div>{v || ''}</div>
    </td>
  );
  const rows = taxRows(ctx);
  const units = [...new Set(items.map((i) => i.unit || ''))];
  const totalQty = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  const showQtyTotal = units.length === 1 && t.itemQty;
  // Sl No + Description + Amount, plus the optional columns.
  const colCount = 3 + (t.hsn ? 1 : 0) + (t.itemQty ? 1 : 0) + (t.rate ? 2 : 0) + (ctx.hasAnyDiscount ? 1 : 0);
  const spacer = Math.max(0, 260 - items.length * 26 - rows.length * 20);

  return (
    <div className="grid-inv grid-inv-tally" style={{ padding: '7mm 8mm', color: '#111827', fontSize: '0.78rem', lineHeight: 1.35 }}>
      <div {...blockProps} style={{ textAlign: 'center', fontWeight: 800, fontSize: '1.15rem', marginBottom: 4 }}>{invoiceTitle}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          <tr {...blockProps}>
            <td style={{ ...cell, width: '50%' }} rowSpan={4}><SellerBlock ctx={ctx} tally /></td>
            {refCell(...refBoxes[0].slice(0, 2))}{refCell(...refBoxes[0].slice(2))}
          </tr>
          {refBoxes.slice(1, 4).map((r) => (
            <tr key={r[0]} {...blockProps}>{refCell(r[0], r[1])}{refCell(r[2], r[3])}</tr>
          ))}
          <tr {...blockProps}>
            <td style={cell} rowSpan={3 + (extraRef.length ? 1 : 0)}>
              {shipTo && <><PartyBlock ctx={ctx} heading="Consignee (Ship to)" party={shipTo} /><div style={{ height: 6 }} /></>}
              <PartyBlock ctx={ctx} heading="Buyer (Bill to)" party={client} withContact />
            </td>
            {refCell(refBoxes[4][0], refBoxes[4][1])}{refCell(refBoxes[4][2], refBoxes[4][3])}
          </tr>
          <tr {...blockProps}>{refCell(refBoxes[5][0], refBoxes[5][1])}{refCell(refBoxes[5][2], refBoxes[5][3])}</tr>
          {extraRef.length > 0 && (
            <tr {...blockProps}>
              <td style={cell} colSpan={2}>
                {extraRef.map(([k, v]) => <div key={k}><span style={small}>{k}: </span><strong>{v}</strong></div>)}
              </td>
            </tr>
          )}
          <tr {...blockProps}>
            <td style={{ ...cell, height: 48 }} colSpan={2}>
              <div style={small}>Terms of Delivery</div>
              <div>{orderMap.deliveryTerms || ''}</div>
            </td>
          </tr>
        </tbody>
      </table>
      {orderMap.workDetails && (
        <div {...blockProps} style={{ ...cell, borderTop: 'none' }}><span style={label}>Work Details: </span>{orderMap.workDetails}</div>
      )}

      <table className="inv-table grid-items" style={{ width: '100%', borderCollapse: 'collapse', margin: '-1px 0 0' }}>
        <thead>
          <tr>
            <th style={{ ...th, width: 28 }}>Sl No.</th>
            <th style={th}>Description of {ctx.isServices ? 'Services' : 'Goods'}</th>
            {t.hsn && <th style={th}>HSN/SAC</th>}
            {t.itemQty && <th style={th}>Quantity</th>}
            {t.rate && <th style={th}>Rate</th>}
            {t.rate && <th style={th}>per</th>}
            {ctx.hasAnyDiscount && <th style={th}>Disc.</th>}
            <th style={th}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const l = lineCalc(item);
            return (
              <tr key={item.id || i}>
                <td style={{ ...vc, ...center }}>{i + 1}</td>
                <td style={vc}>
                  <strong>{item.name || '-'}</strong>
                  {item.description && <div style={{ ...small, whiteSpace: 'pre-wrap' }}>{item.description}</div>}
                </td>
                {t.hsn && <td style={{ ...vc, ...center }}>{item.hsn || ''}</td>}
                {t.itemQty && <td style={{ ...vc, ...right }}><strong>{item.quantity}{t.itemUnit && item.unit ? ` ${item.unit}` : ''}</strong></td>}
                {t.rate && <td style={{ ...vc, ...right }}>{num(item.rate)}</td>}
                {t.rate && <td style={{ ...vc, ...center }}>{item.unit || ''}</td>}
                {ctx.hasAnyDiscount && <td style={{ ...vc, ...right }}>{l.discount > 0 ? num(l.discount) : ''}</td>}
                <td style={{ ...vc, ...right }}><strong>{num(l.taxable)}</strong></td>
              </tr>
            );
          })}
          {/* Subtotal, then taxes and round-off inside the table, as Tally prints them. */}
          <tr>
            <td style={vc} /><td style={vc} />{blank(colCount - 3)}
            <td style={{ ...vc, ...right, borderTop: B }}>{num(totals.subtotal - (totals.totalDiscount || 0))}</td>
          </tr>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td style={vc} />
              <td style={{ ...vc, ...right, fontStyle: 'italic', fontWeight: 700 }}>{k}</td>
              {blank(colCount - 3)}
              <td style={{ ...vc, ...right, fontWeight: 700 }}>{v < 0 ? `(-)${num(-v)}` : num(v)}</td>
            </tr>
          ))}
          {spacer > 0 && (
            <tr>{blank(colCount, spacer)}</tr>
          )}
          <tr style={{ fontWeight: 800 }}>
            <td style={cell} />
            <td style={{ ...cell, ...right }}>Total</td>
            {t.hsn && <td style={cell} />}
            {t.itemQty && <td style={{ ...cell, ...right }}>{showQtyTotal ? `${totalQty}${t.itemUnit && units[0] ? ` ${units[0]}` : ''}` : ''}</td>}
            {t.rate && <td style={cell} />}
            {t.rate && <td style={cell} />}
            {ctx.hasAnyDiscount && <td style={cell} />}
            <td style={{ ...cell, ...right, fontSize: '1.08em' }}>{fmt(totals.total)}</td>
          </tr>
        </tbody>
      </table>

      <div {...blockProps} style={{ ...cell, borderTop: 'none', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div>
          {ctx.showAmountWords && (<><div style={small}>Amount Chargeable (in words)</div><div style={{ fontWeight: 800 }}>{ctx.words(totals.total)}</div></>)}
        </div>
        <div style={{ fontStyle: 'italic', whiteSpace: 'nowrap' }}>E. &amp; O.E</div>
      </div>
      {totals.tdsAmount > 0 && (
        <div {...blockProps} style={{ ...cell, borderTop: 'none', ...small }}>
          Less: TDS{ctx.options.tdsSection ? ` (${ctx.options.tdsSection} @ ${ctx.options.tdsRate}%)` : ''} {fmt(totals.tdsAmount)} · Net Receivable <strong>{fmt(totals.netReceivable)}</strong>
        </div>
      )}

      {ctx.showHsnSummary && <HsnSummaryTable ctx={ctx} />}
      {ctx.showTaxInWords && ctx.totalTax > 0 && (
        <div {...blockProps} style={{ ...cell, borderTop: 'none' }}>Tax Amount (in words) : <strong>{ctx.words(ctx.totalTax)}</strong></div>
      )}

      <div style={{ border: B, borderTop: 'none', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <div style={{ padding: '4px 6px', borderRight: B }}>
          {ctx.notices}
          {ctx.isIndia && ctx.profile?.pan && <div {...blockProps} style={{ margin: '4px 0' }}>Company&apos;s PAN : <strong>{ctx.profile.pan}</strong></div>}
          <RichBlock title="Terms & Conditions" html={ctx.termsHtml} className={ctx.termsClassMod} />
          <RichBlock title="Notes" html={ctx.notesHtml} className={ctx.termsClassMod} />
          {ctx.showDeclaration && (
            <div {...blockProps}>
              <div style={{ ...label, textDecoration: 'underline' }}>Declaration</div>
              <div style={small}>{ctx.declarationText}</div>
            </div>
          )}
        </div>
        <div style={{ padding: '4px 6px' }}>
          <BankLines ctx={ctx} tally />
          <UpiQr ctx={ctx} />
        </div>
        {ctx.showCustomerSeal ? (
          <div {...blockProps} style={{ padding: '4px 6px', borderTop: B, borderRight: B, minHeight: 80 }}>Customer&apos;s Seal and Signature</div>
        ) : <div style={{ borderTop: B, borderRight: B }} />}
        <div style={{ padding: '4px 6px', borderTop: B }}><Signature ctx={ctx} /></div>
      </div>
      <div {...blockProps} style={{ textAlign: 'center', marginTop: 4, ...small }}>
        {ctx.showSystemGeneratedNote ? 'This is a computer generated invoice. No signature or stamp is required.' : 'This is a Computer Generated Invoice'}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BOXED GRID
// ---------------------------------------------------------------------------
const BOXED_MIN_ROWS = 8;

function BoxedLayout({ ctx }) {
  const { details, client, items, totals, fmt, lineCalc, t, invoiceTitle, accent, profile } = ctx;
  const order = filledOrderDetails(details);
  const workDetails = order.find((f) => f.key === 'workDetails');
  const metaRows = [
    t.invoiceDate && ['Date', ctx.shortDate(details?.invoiceDate)],
    t.invoiceNumber && [`${ctx.docLabel} No`, details?.invoiceNumber],
    t.dueDate && details?.dueDate && ['Due Date', ctx.shortDate(details.dueDate)],
    ctx.showReverseChargeLine && ['Reverse Charge', ctx.reverseChargeText],
    details?.originalInvoiceRef && ['Against Invoice', details.originalInvoiceRef],
    ...order.filter((f) => f.key !== 'workDetails').map((f) => [f.label, f.value]),
  ].filter(Boolean);
  const rows = taxRows(ctx);
  const filler = Math.max(0, BOXED_MIN_ROWS - items.length);
  const colCount = 3 + (t.hsn ? 1 : 0) + (t.itemQty ? 2 : 0) + (t.rate ? 1 : 0) + (ctx.hasAnyDiscount ? 1 : 0);
  const shipTo = ctx.shipTo;

  return (
    <div className="grid-inv grid-inv-boxed" style={{ padding: '7mm 8mm', color: '#111827', fontSize: '0.8rem', lineHeight: 1.35 }}>
      <div style={{ border: B }}>
        <div {...blockProps} style={{ textAlign: 'center', padding: '8px 6px', borderBottom: B }}>
          {t.logo && profile?.logo && (
            <img src={profile.logo} alt="Logo" style={{ maxHeight: `${profile.logoHeight || 48}px`, maxWidth: 160, objectFit: 'contain', display: 'block', margin: '0 auto 4px' }} />
          )}
          {t.businessName && <div style={{ fontSize: '1.7rem', fontWeight: 800, color: accent, letterSpacing: '0.02em' }}>{profile?.businessName || 'Your Business'}</div>}
          <div style={{ fontWeight: 700, color: '#4b5563', letterSpacing: '0.06em' }}>{invoiceTitle}</div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr {...blockProps}>
              <td style={{ ...cell, borderLeft: 'none', borderTop: 'none', width: '55%' }}><SellerBlock ctx={{ ...ctx, t: { ...t, logo: false } }} /></td>
              <td style={{ ...cell, borderRight: 'none', borderTop: 'none', padding: 0 }}>
                {metaRows.map(([k, v], i) => (
                  <div key={k} style={{ padding: '4px 6px', borderTop: i ? B : 'none' }}><span style={label}>{k}:</span> {v}</div>
                ))}
              </td>
            </tr>
            <tr {...blockProps}>
              <td style={{ ...cell, borderLeft: 'none' }}><PartyBlock ctx={ctx} heading="Billing To:" party={client} withContact /></td>
              <td style={{ ...cell, borderRight: 'none' }}>
                <div style={label}>Shipping To:</div>
                {shipTo ? (
                  <>
                    {shipTo.address && <div style={{ whiteSpace: 'pre-line' }}>{shipTo.address}</div>}
                    {(shipTo.city || shipTo.pin) && <div>{[shipTo.city, shipTo.pin].filter(Boolean).join(' - ')}</div>}
                    {shipTo.state && <div>State: {shipTo.state}</div>}
                  </>
                ) : <div style={small}>Same as billing address</div>}
                {t.placeOfSupply && ctx.placeOfSupply && <div style={{ marginTop: 6 }}><span style={label}>Place of Supply:</span> {ctx.placeOfSupply}</div>}
              </td>
            </tr>
          </tbody>
        </table>
        {workDetails && (
          <div {...blockProps} style={{ padding: '5px 6px', borderBottom: B }}><span style={label}>Work Details:</span> {workDetails.value}</div>
        )}
        <table className="inv-table grid-items" style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
          <thead>
            <tr>
              <th style={{ ...th, borderLeft: 'none', width: 30 }}>SI</th>
              <th style={th}>Description</th>
              {t.hsn && <th style={th}>{ctx.isServices ? 'SAC' : 'HSN/SAC'}</th>}
              {t.itemQty && <th style={th}>UNIT</th>}
              {t.itemQty && <th style={th}>QTY</th>}
              {t.rate && <th style={th}>Rate</th>}
              {ctx.hasAnyDiscount && <th style={th}>Disc.</th>}
              <th style={{ ...th, borderRight: 'none' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const l = lineCalc(item);
              return (
                <tr key={item.id || i}>
                  <td style={{ ...cell, ...center, borderLeft: 'none' }}>{i + 1}</td>
                  <td style={cell}>
                    {item.name || '-'}
                    {item.description && <div style={{ ...small, whiteSpace: 'pre-wrap' }}>{item.description}</div>}
                  </td>
                  {t.hsn && <td style={{ ...cell, ...center }}>{item.hsn || ''}</td>}
                  {t.itemQty && <td style={{ ...cell, ...center }}>{item.unit || ''}</td>}
                  {t.itemQty && <td style={{ ...cell, ...center }}>{item.quantity}</td>}
                  {t.rate && <td style={{ ...cell, ...right }}>{num(item.rate)}</td>}
                  {ctx.hasAnyDiscount && <td style={{ ...cell, ...right }}>{l.discount > 0 ? num(l.discount) : ''}</td>}
                  <td style={{ ...cell, ...right, borderRight: 'none' }}>{num(l.taxable)}</td>
                </tr>
              );
            })}
            {Array.from({ length: filler }, (_, i) => (
              <tr key={`fill-${i}`}>
                {Array.from({ length: colCount }, (__, c) => (
                  <td key={c} style={{ ...cell, height: 26, ...(c === 0 ? { borderLeft: 'none' } : {}), ...(c === colCount - 1 ? { borderRight: 'none' } : {}) }} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div {...blockProps} style={{ display: 'grid', gridTemplateColumns: '1fr auto', borderBottom: B }}>
          <div style={{ padding: '4px 6px', borderRight: B }}>
            <BankLines ctx={ctx} />
            <UpiQr ctx={ctx} />
          </div>
          <table style={{ borderCollapse: 'collapse', minWidth: 230, alignSelf: 'start' }}>
            <tbody>
              <tr><td style={{ ...cell, borderTop: 'none', ...right }}>Total</td><td style={{ ...cell, borderTop: 'none', borderRight: 'none', ...right }}>{num(totals.subtotal - (totals.totalDiscount || 0))}</td></tr>
              {rows.map(([k, v]) => (
                <tr key={k}><td style={{ ...cell, ...right }}>{k}</td><td style={{ ...cell, borderRight: 'none', ...right }}>{v < 0 ? `-${num(-v)}` : num(v)}</td></tr>
              ))}
              <tr style={{ fontWeight: 800 }}>
                <td style={{ ...cell, borderBottom: 'none', ...right }}>{ctx.invoiceType === 'credit-note' ? 'Credit Amount' : 'Grand Total'}</td>
                <td style={{ ...cell, borderBottom: 'none', borderRight: 'none', ...right }}>{fmt(totals.total)}</td>
              </tr>
              {totals.tdsAmount > 0 && (
                <tr style={small}><td style={{ ...cell, ...right }}>Less: TDS / Net Receivable</td><td style={{ ...cell, borderRight: 'none', ...right }}>{fmt(totals.netReceivable)}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {ctx.showAmountWords && (
          <div {...blockProps} style={{ padding: '4px 6px', borderBottom: B }}><span style={label}>Amount in words:</span> {ctx.words(totals.total)}</div>
        )}
        {ctx.showHsnSummary && <div style={{ margin: '0 -1px' }}><HsnSummaryTable ctx={ctx} /></div>}
        {ctx.showTaxInWords && ctx.totalTax > 0 && (
          <div {...blockProps} style={{ padding: '4px 6px', borderBottom: B }}><span style={label}>Tax amount in words:</span> {ctx.words(ctx.totalTax)}</div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: '4px 6px' }}>
          <div>
            {ctx.notices}
            <RichBlock title="Terms & Conditions:" html={ctx.termsHtml} className={ctx.termsClassMod} />
            <RichBlock title="Notes:" html={ctx.notesHtml} className={ctx.termsClassMod} />
            {ctx.showDeclaration && (
              <div {...blockProps}><div style={label}>Declaration:</div><div style={small}>{ctx.declarationText}</div></div>
            )}
            {ctx.showCustomerSeal && (
              <div {...blockProps} style={{ marginTop: 10, border: B, padding: '4px 6px', minHeight: 60, width: 200 }}>Customer&apos;s Seal and Signature</div>
            )}
          </div>
          <div style={{ minWidth: 190 }}><Signature ctx={ctx} /></div>
        </div>
        <div {...blockProps} style={{ textAlign: 'center', borderTop: B, padding: '3px 6px', ...small, fontStyle: 'italic' }}>
          {ctx.showSystemGeneratedNote ? 'This is a computer generated document. No signature or stamp is required.' : 'This is a computer generated document.'}
        </div>
      </div>
    </div>
  );
}

export default function InvoiceGridLayout({ ctx }) {
  return ctx.style === 'tally' ? <TallyLayout ctx={ctx} /> : <BoxedLayout ctx={ctx} />;
}
