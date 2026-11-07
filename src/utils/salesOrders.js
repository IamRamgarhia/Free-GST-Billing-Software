// v1.10.85 (#135, #112, #115) - sales orders: inquiry -> quotation -> ORDER ->
// dispatch (delivery challans) -> invoice -> payment.
//
// A sales order is a bill of type 'sales-order' (INVOICE_TYPES): it prints,
// shares and numbers like a quotation (SO/2026-27/0001), counts in no total,
// report or GST return, and never moves stock (STOCK_SIGN 0).
//
// Nothing about dispatching is stored on the order itself. Every challan or
// invoice made from it carries the order's number in details.salesOrderNo,
// and the order's progress is worked out from those documents each time: a
// cancelled or deleted challan or invoice simply stops counting.
//
//   invoiced   = the invoices (tax invoice, bill of supply, composition)
//   dispatched = the invoices + the challans not yet invoiced (a challan
//                converted into one of those invoices is the same goods)
//
// Status: Open -> Partly dispatched -> Dispatched -> Invoiced, or Cancelled.
// Pure: no React, no storage (tested in scripts/sales-order-test.mjs).
import { isCancelledBill, SALES_INVOICE_TYPES, roundQty, formatShortDate, appliedStock, stockEffect, stockDelta } from '../utils.js';

export const SO_TYPE = 'sales-order';
export const SO_STATUS_LABELS = {
  open: 'Open',
  'partly-dispatched': 'Partly dispatched',
  dispatched: 'Dispatched',
  invoiced: 'Invoiced',
  cancelled: 'Cancelled',
};

const typeOf = (b) => b?.invoiceType || b?.data?.invoiceType || 'tax-invoice';
export const isSalesOrder = (b) => typeOf(b) === SO_TYPE;
const isChallan = (b) => typeOf(b) === 'delivery-challan';
const isSale = (b) => SALES_INVOICE_TYPES.includes(typeOf(b));
const orderNo = (order) => String(order?.invoiceNumber || order?.id || '').trim();
// The order a document was made from ('' when none).
export const salesOrderOf = (b) => String(b?.data?.details?.salesOrderNo || '').trim();

// The live challans and invoices made from this order.
export function orderDocs(order, bills) {
  const no = orderNo(order);
  if (!no) return [];
  return (bills || []).filter((b) => b && b.id !== order.id && salesOrderOf(b) === no
    && !isCancelledBill(b) && (isChallan(b) || isSale(b)));
}

// A document line belongs to the order line with the same line id (lines are
// copied from the order), else to the first order line of the same name.
const nameKey = (it) => String(it?.name || '').trim().toLowerCase();
function lineIndex(orderItems, it) {
  let i = it?.id ? orderItems.findIndex((o) => o?.id && o.id === it.id) : -1;
  if (i < 0 && nameKey(it)) i = orderItems.findIndex((o) => nameKey(o) === nameKey(it));
  return i;
}

// Per order line: { ordered, dispatched, invoiced, onChallan } (onChallan =
// sent on challans not yet invoiced); the documents; and those challans.
export function orderProgress(order, bills) {
  const items = order?.data?.items || [];
  const docs = orderDocs(order, bills);
  const invoiceIds = new Set(docs.filter(isSale).map((b) => b.id));
  const openChallans = docs.filter((b) => isChallan(b) && !invoiceIds.has(b.convertedTo));
  const lines = items.map((it) => ({ ordered: Number(it?.quantity) || 0, dispatched: 0, invoiced: 0, onChallan: 0 }));
  for (const d of [...docs.filter(isSale), ...openChallans]) {
    const sale = isSale(d);
    for (const it of d.data?.items || []) {
      const i = lineIndex(items, it);
      if (i < 0) continue;
      const q = Number(it?.quantity) || 0;
      lines[i].dispatched = roundQty(lines[i].dispatched + q);
      if (sale) lines[i].invoiced = roundQty(lines[i].invoiced + q);
      else lines[i].onChallan = roundQty(lines[i].onChallan + q);
    }
  }
  return { lines, docs, openChallans };
}

export function orderStatus(order, bills) {
  if (isCancelledBill(order)) return 'cancelled';
  const { lines } = orderProgress(order, bills);
  const wanted = lines.filter((l) => l.ordered > 0);
  if (!wanted.length) return 'open';
  if (wanted.every((l) => l.invoiced >= l.ordered)) return 'invoiced';
  if (wanted.every((l) => l.dispatched >= l.ordered)) return 'dispatched';
  return lines.some((l) => l.dispatched > 0) ? 'partly-dispatched' : 'open';
}

// The order's lines with what is still to dispatch (lines with nothing left
// are dropped). An over-delivery never makes a line negative.
export function orderRemainingItems(order, bills) {
  const { lines } = orderProgress(order, bills);
  return (order?.data?.items || [])
    .map((it, i) => ({ ...it, quantity: roundQty(Math.max(0, lines[i].ordered - lines[i].dispatched)) }))
    .filter((it) => it.quantity > 0);
}

// What "Invoice the rest" bills: per order line everything not yet invoiced
// (still to send + sent on challans not yet invoiced; never less than those
// challans carried), plus challan lines that are not on the order. `absorb`
// = those challans: the invoice takes them over, with the stock they moved.
export function orderToInvoice(order, bills) {
  const { lines, openChallans } = orderProgress(order, bills);
  const items = order?.data?.items || [];
  const fromOrder = items
    .map((it, i) => ({ ...it, quantity: roundQty(Math.max(lines[i].ordered - lines[i].invoiced, lines[i].onChallan)) }))
    .filter((it) => it.quantity > 0);
  const extra = openChallans.flatMap((c) => (c.data?.items || []).filter((it) => lineIndex(items, it) < 0).map((it) => ({ ...it })));
  const stock = {};
  for (const c of openChallans) {
    for (const [id, q] of Object.entries(appliedStock(c))) stock[id] = roundQty((stock[id] || 0) + (Number(q) || 0));
  }
  return { items: [...fromOrder, ...extra], absorb: openChallans.map((c) => c.id), stock };
}

// Totals for the Dashboard row: "4 of 10 sent".
export function orderSummary(order, bills) {
  const { lines, docs } = orderProgress(order, bills);
  const sum = (k) => roundQty(lines.reduce((s, l) => s + Math.min(l[k], l.ordered), 0));
  return {
    status: orderStatus(order, bills),
    ordered: sum('ordered'), dispatched: sum('dispatched'), invoiced: sum('invoiced'),
    leftToSend: lines.some((l) => l.ordered > l.dispatched),
    leftToInvoice: lines.some((l) => l.ordered > l.invoiced),
    docs: docs.map((d) => ({ id: d.id, number: d.invoiceNumber || d.id, type: typeOf(d), convertedTo: d.convertedTo || '' })),
  };
}

// v1.10.85 - an invoice made from an order that took over its challans
// ("Invoice the rest", or a challan converted) is cancelled or deleted: the
// goods still left on those challans, so the challans count again. Each gets
// its own stock record back (its goods go out of stock again, as the invoice
// put them back) and loses convertedTo, so it is editable and can be invoiced
// again; releasedFrom remembers the invoice. Undoing the cancel (or restoring
// it from the Trash) takes those challans back in, if they have not been
// invoiced since. Returns { patches: challans to save, changes: stock }.
const takenChallans = (invoice, bills, pick) => {
  const no = salesOrderOf(invoice);
  if (!no || !isSale(invoice)) return [];
  return (bills || []).filter((c) => isChallan(c) && salesOrderOf(c) === no && !isCancelledBill(c) && pick(c));
};
const addStock = (into, ch) => { for (const [id, q] of Object.entries(ch)) into[id] = roundQty((into[id] || 0) + q); return into; };
export function releaseChallansPlan(invoice, bills) {
  const changes = {};
  const patches = takenChallans(invoice, bills, (c) => c.convertedTo === invoice.id).map((c) => {
    const own = stockEffect(c.data?.items, 'delivery-challan', c.status);
    addStock(changes, stockDelta(appliedStock(c), own));
    const { convertedTo: _was, ...rest } = c;
    return { ...rest, releasedFrom: invoice.id, data: { ...c.data, stockApplied: own } };
  });
  return { patches, changes };
}
export function reabsorbChallansPlan(invoice, bills) {
  const changes = {};
  const patches = takenChallans(invoice, bills, (c) => c.releasedFrom === invoice.id && !c.convertedTo).map((c) => {
    addStock(changes, stockDelta(appliedStock(c), {}));
    const { releasedFrom: _was, ...rest } = c;
    return { ...rest, convertedTo: invoice.id, data: { ...c.data, stockApplied: {} } };
  });
  return { patches, changes };
}

// The new document to open in the editor from an order: 'delivery-challan'
// (Make delivery challan: what is left to send) or 'tax-invoice' (Invoice the
// rest: see orderToInvoice). A copy of the order linked back to it
// (details.salesOrderNo); the order's number prints as the Buyer's Order No
// when that box is empty (with the order date), else as the Reference No, so
// the customer's own PO number typed on the order is kept.
export function dispatchDraft(order, bills, type) {
  const clone = JSON.parse(JSON.stringify(order));
  const d = clone.data?.details || {};
  const no = orderNo(order);
  const has = (k) => !!String(d[k] || '').trim();
  const link = has('buyerOrderNo')
    ? (has('referenceNo') ? {} : { referenceNo: `${no} dt ${formatShortDate(order.invoiceDate)}` })
    : { buyerOrderNo: no, buyerOrderDate: order.invoiceDate || '' };
  const invoice = type !== 'delivery-challan' ? orderToInvoice(order, bills) : null;
  return {
    ...clone,
    _isDuplicate: true,
    _convertToType: type,
    ...(invoice ? { _absorb: invoice.absorb } : {}),
    data: {
      ...clone.data,
      details: { ...d, ...link, salesOrderNo: no },
      items: invoice ? invoice.items : orderRemainingItems(order, bills),
      // The editor's starting stock record (stockStart): what the challans
      // taken in already moved, so their goods are not taken out twice.
      stockApplied: invoice ? invoice.stock : {},
    },
  };
}
