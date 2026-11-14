// v1.10.86 (#197) - scan a returned parcel's label to find its invoice.
//
// A USB barcode scanner types the code into the Dashboard search and presses
// Enter. When that text is exactly the invoice number, the order ID
// (buyerOrderNo) or the AWB / tracking ID (dispatchDocNo) of ONE sales
// invoice, the Dashboard shows that invoice with Open and Return / credit note.
// The ordinary search (billMatchesSearch) is untouched: this is an extra,
// exact-only lookup.
// Pure: no React, no storage (tested in scripts/scan-return-test.mjs).
import { SALES_INVOICE_TYPES, isCancelledBill, isCreditNote } from '../utils.js';

// Case and spaces do not matter: "fmpc 0000001" is FMPC0000001.
const norm = (v) => String(v || '').replace(/\s+/g, '').toLowerCase();

const scanKeys = (bill) => {
  const d = bill?.data?.details || {};
  return [bill?.invoiceNumber, d.buyerOrderNo, d.dispatchDocNo].map(norm).filter(Boolean);
};

// { bill, creditNotes } for the one sales invoice the scanned text names, or
// null (nothing typed, no match, or several invoices match - then the list
// below shows them all). creditNotes: the credit notes already made against
// it (Original Invoice Reference = its number), cancelled ones left out.
export const findScannedInvoice = (bills, query) => {
  const q = norm(query);
  if (!q) return null;
  const hits = (bills || []).filter((b) => !isCancelledBill(b)
    && SALES_INVOICE_TYPES.includes(b?.invoiceType || 'tax-invoice') && scanKeys(b).includes(q));
  if (hits.length !== 1) return null;
  const [bill] = hits;
  const no = norm(bill.invoiceNumber);
  const creditNotes = (bills || []).filter((b) => isCreditNote(b) && no && norm(b?.data?.details?.originalInvoiceRef) === no);
  return { bill, creditNotes };
};

// The invoice as a new credit note: same client, items, quantities, rates and
// tax options, the original referenced, its order ID / AWB kept in the order
// details. Opened through Duplicate (a new document of its own type), NOT
// Convert: a conversion takes over the source's stock record and marks it
// converted, which is right for a challan becoming an invoice but would undo
// the sale here. As a new credit note it starts with no stock record, so
// saving puts back exactly the quantities it shows (stockEffect, +1), and a
// smaller quantity is a partial return.
export const creditNoteDraft = (bill) => {
  const copy = JSON.parse(JSON.stringify(bill));
  const { stockApplied: _s, ...data } = copy.data || {};
  const { convertedTo: _c, cancelledAt: _x, einvoice: _e, printedCount: _p, lastPrintedAt: _l, ...rest } = copy;
  return {
    ...rest,
    invoiceType: 'credit-note',
    status: '', payments: [], paidAmount: 0,
    data: { ...data, invoiceType: 'credit-note', details: { ...(data.details || {}), originalInvoiceRef: bill.invoiceNumber } },
  };
};
