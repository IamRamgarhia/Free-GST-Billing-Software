// v1.10.85 - closing the books up to a date (Settings -> Data -> Close the
// books). After a month's GST returns are filed, nothing dated on or before
// that day may change in a way that moves the accounts or the returns: no new
// or back-dated entry, no edit of its date, number, items, amounts, GSTINs or
// cancellation, no delete. What does not change the accounts stays allowed:
// recording a payment against an old invoice, printing, sharing, notes.
//
// The server checks every save and delete with `lockProblem` (it cannot be
// worked around from the screen). Pure, so it is tested on its own.

const ACCOUNT_FIELDS = {
  bills: (b) => [
    b.invoiceDate, b.invoiceNumber, b.invoiceType, b.totalAmount, b.totalTaxAmount,
    isCancelled(b), b.clientName, b.data?.client?.gstin, b.data?.client?.state,
    b.data?.details?.placeOfSupply, b.data?.items, b.data?.totals?.total, b.data?.totals?.taxableAmount,
    b.data?.profile?.gstin, b.ownerGstin,
    // (review) what moves an invoice between GSTR-1 tables with the same total:
    // SEZ, export (country, LUT), reverse charge, and the CGST/SGST/IGST split.
    b.data?.client?.isSEZ, b.data?.client?.country, b.data?.invoiceOptions?.isLUT, b.data?.invoiceOptions?.reverseCharge,
    b.data?.totals?.cgst, b.data?.totals?.sgst, b.data?.totals?.utgst, b.data?.totals?.igst, b.data?.totals?.cess,
  ],
  // Supplier payments and the paid status are not here: they stay allowed.
  purchases: (p) => [
    p.date, p.invoiceNumber, p.supplierName, p.supplierGstin, p.items, p.interstate,
    p.reverseCharge, p.applyRoundOff, p.ownerGstin, p.kind, p.status === 'cancelled',
  ],
  expenses: (e) => [e.date, e.amount, e.gstAmount, e.gstPercent, e.category, e.ownerGstin],
  // Receipts are not locked (review, 8 Nov): a receipt is a payment, like a
  // payment recorded on an old invoice, which stays allowed. Locking them left
  // a paid invoice with no receipt when the payment date was in a closed month.
  'debit-notes': (d) => [d.date, d.dnNumber, d.items, d.status, d.billId, d.ownerGstin],
  'cash-book': (c) => [c.date, c.amount, c.type, c.ownerGstin],
  // v1.10.85 - stock written off or found moves the closing stock of that date.
  'stock-adjustments': (a) => [a.date, a.productId, a.quantity, a.reason, a.stockApplied],
};

const isCancelled = (b) => b?.status === 'cancelled' || !!b?.cancelled || !!b?.data?.cancelled;

export const lockKinds = Object.keys(ACCOUNT_FIELDS);

// The date a record is booked on ('YYYY-MM-DD').
export const bookedOn = (kind, rec) => String((kind === 'bills' ? rec?.invoiceDate : rec?.date) || '').slice(0, 10);

const locked = (date, upTo) => !!upTo && !!date && date <= upTo;
const fingerprint = (kind, rec) => JSON.stringify((ACCOUNT_FIELDS[kind] || (() => [rec]))(rec || {}));

// null = allowed; otherwise a sentence for the screen. `before` is the record
// on file (null for a new one), `after` the one being saved (null = delete).
export const lockProblem = (kind, before, after, upTo) => {
  if (!upTo || !ACCOUNT_FIELDS[kind]) return null;
  const was = before ? bookedOn(kind, before) : '';
  const now = after ? bookedOn(kind, after) : '';
  if (!locked(was, upTo) && !locked(now, upTo)) return null;
  if (!after) return `It is dated ${was}, and the books are closed up to ${upTo}, so it cannot be deleted.`;
  if (!before) return `It is dated ${now}, and the books are closed up to ${upTo}. Date it after ${upTo}, or open the books in Settings -> Data.`;
  if (fingerprint(kind, before) === fingerprint(kind, after)) return null;
  return `It is dated ${locked(was, upTo) ? was : now}, and the books are closed up to ${upTo}, so its date, number, items, amounts and GST cannot change. Payments and notes still can.`;
};

// The ISO day check for a lock date typed in Settings.
export const isLockDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(s));
