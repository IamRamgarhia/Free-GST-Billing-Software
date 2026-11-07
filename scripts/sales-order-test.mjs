// v1.10.85 (#135, #112, #115) - sales orders: number series, never a sale,
// never stock, dispatch status from the challans and invoices made from it.
//
// Run: `node scripts/sales-order-test.mjs`

import {
  orderStatus, orderProgress, orderRemainingItems, orderSummary, dispatchDraft, isSalesOrder, SO_STATUS_LABELS,
} from '../src/utils/salesOrders.js';
import {
  INVOICE_TYPES, formatDocNumber, stockEffect, salesSign, countsAsSales, isModuleEnabled, DOC_TYPE_PREFIXES, ownPrefixProblem,
} from '../src/utils.js';
import { docIssueSummary } from '../src/utils/gstr1Json.js';
import { costOfGoodsSold } from '../src/utils/products.js';
import { modulesForType } from '../src/utils/businessTypes.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n     expected: ${e}\n     actual:   ${a}`); }
}

const order = {
  id: 'SO/2026-27/0001', invoiceNumber: 'SO/2026-27/0001', invoiceType: 'sales-order', invoiceDate: '2026-11-14', status: 'unpaid', totalAmount: 14160,
  data: {
    invoiceType: 'sales-order',
    details: { invoiceNumber: 'SO/2026-27/0001', invoiceDate: '2026-11-14' },
    items: [
      { id: 'l1', productId: 'p1', name: 'Steel Chair', quantity: 10, rate: 1000, taxPercent: 18 },
      { id: 'l2', productId: 'p2', name: 'Steel Table', quantity: 2, rate: 1000, taxPercent: 18 },
    ],
    stockApplied: {},
  },
};
let n = 0;
const doc = (type, items, extra = {}) => ({
  id: `D${++n}`, invoiceNumber: `D${n}`, invoiceType: type, status: 'unpaid', ...extra,
  data: { invoiceType: type, details: { salesOrderNo: 'SO/2026-27/0001' }, items },
});

console.log('\n[#135] The document type');
{
  const t = INVOICE_TYPES['sales-order'];
  eq([t.label, t.prefix, t.title, t.showGST], ['Sales Order', 'SO', 'SALES ORDER', true], 'Sales Order, prefix SO, prints SALES ORDER with GST');
  eq(formatDocNumber({ settings: { fyStyle: 'short' }, typePrefix: 'SO', next: 1, fyLabel: '2026-27' }), 'SO/26-27/0001', 'Its own number series: SO/26-27/0001');
  eq(formatDocNumber({ settings: {}, typePrefix: 'SO', next: 7, fyLabel: '2026-27' }), 'SO/2026-27/0007', 'Default format: SO/2026-27/0007');
  eq(formatDocNumber({ settings: { brandPrefix: 'ACME' }, typePrefix: 'SO', next: 1, fyLabel: '2026-27' }), 'ACME-SO/2026-27/0001', 'With a brand prefix: ACME-SO/... (counts apart from invoices)');
  eq(DOC_TYPE_PREFIXES.includes('SO') && !!ownPrefixProblem('SO', {}), true, 'A business cannot take SO as its own prefix');
  eq(isSalesOrder(order), true, 'isSalesOrder');
}

console.log('\n[#135] Never a sale, never stock, never in GST returns');
{
  eq(stockEffect(order.data.items, 'sales-order', 'unpaid'), {}, 'Saving an order moves no stock');
  eq(stockEffect(order.data.items, 'sales-order', 'cancelled'), {}, 'Cancelling it moves none either');
  eq([salesSign(order), countsAsSales(order)], [0, false], 'Not counted in sales totals, reports or TDS/TCS');
  eq(Object.keys(docIssueSummary([order])).length, 0, 'Not in the GSTR-1 document summary (Table 13)');
  eq(costOfGoodsSold([order], [{ id: 'p1', name: 'Steel Chair', purchasePrice: 600 }]).cost, 0, 'No cost of goods sold in Profit & Loss');
}

console.log('\n[#135] Dispatch status');
{
  eq(orderStatus(order, []), 'open', 'Nothing made from it: Open');
  const dc1 = doc('delivery-challan', [{ id: 'l1', name: 'Steel Chair', quantity: 4 }]);
  eq(orderStatus(order, [dc1]), 'partly-dispatched', 'A challan for 4 of 10 chairs: Partly dispatched');
  eq(orderProgress(order, [dc1]).lines, [{ ordered: 10, dispatched: 4, invoiced: 0, onChallan: 4 }, { ordered: 2, dispatched: 0, invoiced: 0, onChallan: 0 }], 'Dispatched vs ordered, per line');
  eq(orderRemainingItems(order, [dc1]).map((i) => [i.id, i.quantity]), [['l1', 6], ['l2', 2]], 'Left to dispatch: 6 chairs, 2 tables');
  const dc2 = doc('delivery-challan', [{ id: 'l1', name: 'Steel Chair', quantity: 6 }, { id: 'l2', name: 'Steel Table', quantity: 2 }]);
  eq(orderStatus(order, [dc1, dc2]), 'dispatched', 'Two challans cover everything: Dispatched');
  eq(orderRemainingItems(order, [dc1, dc2]), [], 'Nothing left to dispatch');
  // Converting a challan to an invoice (the challan's convertedTo) is the same goods.
  const inv1 = doc('tax-invoice', dc1.data.items);
  const dc1c = { ...dc1, convertedTo: inv1.id };
  eq(orderProgress(order, [dc1c, dc2, inv1]).lines[0], { ordered: 10, dispatched: 10, invoiced: 4, onChallan: 6 }, 'An invoice made from a challan is not dispatched twice');
  eq(orderStatus(order, [dc1c, dc2, inv1]), 'dispatched', 'Partly invoiced but all sent: still Dispatched');
  const inv2 = doc('tax-invoice', dc2.data.items);
  eq(orderStatus(order, [dc1c, { ...dc2, convertedTo: inv2.id }, inv1, inv2]), 'invoiced', 'All invoiced: Invoiced');
  eq(orderProgress(order, [dc1c, dc2, { ...inv1, status: 'cancelled' }]).lines[0], { ordered: 10, dispatched: 10, invoiced: 0, onChallan: 10 }, 'Its invoice cancelled: the challan counts as sent (not invoiced) again');
}

console.log('\n[#135] Part by challan, the rest to one invoice');
{
  const dc = doc('delivery-challan', [{ id: 'l1', name: 'Steel Chair', quantity: 4 }], {});
  dc.data.stockApplied = { p1: -4 };
  const rest = dispatchDraft(order, [dc], 'tax-invoice');
  eq(rest.data.items.map((i) => [i.id, i.quantity]), [['l1', 10], ['l2', 2]], 'Invoice the rest: all 12 not yet invoiced (4 on the challan + 8 still to send)');
  eq([rest._absorb, rest.data.stockApplied], [[dc.id], { p1: -4 }], 'It takes in the challan, and the 4 chairs the challan already took out of stock');
  eq(stockEffect(rest.data.items, 'tax-invoice', 'unpaid'), { p1: -10, p2: -2 }, '...so saving it takes out only 6 more chairs and 2 tables');
  const inv = doc('tax-invoice', rest.data.items);
  const after = [{ ...dc, convertedTo: inv.id, data: { ...dc.data, stockApplied: {} } }, inv];
  eq(orderStatus(order, after), 'invoiced', 'Challan for part, then Invoice the rest: Invoiced');
  eq(orderSummary(order, after).dispatched, 12, 'Every piece sent once (not 16)');
  const less = doc('tax-invoice', [{ id: 'l1', name: 'Steel Chair', quantity: 7 }]);
  eq(orderStatus(order, [{ ...dc, convertedTo: less.id }, less]), 'partly-dispatched', 'The invoice cut to 7 chairs: Partly dispatched, 3 chairs and 2 tables to go');
  const extra = doc('delivery-challan', [{ id: 'l1', name: 'Steel Chair', quantity: 4 }, { id: 'pk', name: 'Packing', quantity: 1 }]);
  eq(dispatchDraft(order, [extra], 'tax-invoice').data.items.map((i) => i.name), ['Steel Chair', 'Steel Table', 'Packing'], 'A challan line not on the order is invoiced with it (its stock was taken over)');
  const over = doc('delivery-challan', [{ id: 'l2', name: 'Steel Table', quantity: 3 }]);
  eq(dispatchDraft(order, [over], 'tax-invoice').data.items.find((i) => i.id === 'l2').quantity, 3, 'An over-delivery on a challan is invoiced in full');
  eq(dispatchDraft(order, [], 'delivery-challan')._absorb, undefined, 'A challan takes nothing in');
  eq(orderStatus(order, [doc('tax-invoice', order.data.items)]), 'invoiced', 'Whole order invoiced at once: Invoiced');
  eq(orderStatus(order, [doc('bill-of-supply', order.data.items)]), 'invoiced', 'A bill of supply invoices it too');
}

console.log('\n[#135] What counts');
{
  const dc = doc('delivery-challan', [{ id: 'l1', name: 'Steel Chair', quantity: 4 }]);
  eq(orderStatus(order, [{ ...dc, status: 'cancelled' }]), 'open', 'A cancelled challan stops counting (back to Open)');
  eq(orderStatus(order, [{ ...dc, data: { ...dc.data, details: { salesOrderNo: 'SO/2026-27/0002' } } }]), 'open', 'A challan of another order does not count');
  eq(orderStatus(order, [{ ...dc, data: { ...dc.data, details: {} } }]), 'open', 'A challan made from no order does not count');
  eq(orderStatus(order, [doc('quotation', [{ id: 'l1', name: 'Steel Chair', quantity: 4 }])]), 'open', 'A quotation never dispatches');
  eq(orderStatus(order, [doc('delivery-challan', [{ id: 'x9', name: 'steel chair ', quantity: 4 }])]), 'partly-dispatched', 'A line added by hand finds its order line by name');
  eq(orderStatus(order, [doc('delivery-challan', [{ id: 'x9', name: 'Packing', quantity: 1 }])]), 'open', 'A line not on the order is ignored');
  eq(orderRemainingItems(order, [doc('delivery-challan', [{ id: 'l1', name: 'Steel Chair', quantity: 12 }])]).map((i) => i.quantity), [2], 'Sending more than ordered never leaves a negative line');
  eq(orderStatus({ ...order, status: 'cancelled' }, []), 'cancelled', 'A cancelled order: Cancelled');
  eq(orderStatus(order, [doc('delivery-challan', [{ id: 'l1', name: 'Steel Chair', quantity: 0.25 }, { id: 'l1', name: 'Steel Chair', quantity: 0.05 }])]) === 'partly-dispatched'
    && orderProgress(order, [doc('delivery-challan', [{ id: 'l1', name: 'Steel Chair', quantity: 0.1 }, { id: 'l1', name: 'Steel Chair', quantity: 0.2 }])]).lines[0].dispatched === 0.3, true, 'Decimal quantities add up without float dust');
  eq(Object.keys(SO_STATUS_LABELS), ['open', 'partly-dispatched', 'dispatched', 'invoiced', 'cancelled'], 'Open -> Partly dispatched -> Dispatched -> Invoiced, and Cancelled');
}

console.log('\n[#135] Dispatching: the challan / invoice opened from the order');
{
  const dc = doc('delivery-challan', [{ id: 'l1', name: 'Steel Chair', quantity: 4 }]);
  const draft = dispatchDraft(order, [dc], 'delivery-challan');
  eq([draft._isDuplicate, draft._convertToType, draft.id], [true, 'delivery-challan', order.id], 'A new document of the chosen type, made from the order');
  eq(draft.data.items.map((i) => [i.id, i.quantity]), [['l1', 6], ['l2', 2]], 'Only what is left to dispatch, same line ids');
  eq([draft.data.details.salesOrderNo, draft.data.details.buyerOrderNo, draft.data.details.buyerOrderDate], ['SO/2026-27/0001', 'SO/2026-27/0001', '2026-11-14'], 'Linked to the order; the order number prints as Buyer\'s Order No with its date');
  eq(draft.data.stockApplied, {}, 'Takes over no stock (the order moved none)');
  const withPo = { ...order, data: { ...order.data, details: { ...order.data.details, buyerOrderNo: 'PO-7781' } } };
  const d2 = dispatchDraft(withPo, [], 'tax-invoice');
  eq([d2.data.details.buyerOrderNo, d2.data.details.referenceNo], ['PO-7781', 'SO/2026-27/0001 dt 14-Nov-26'], 'The customer\'s own PO number stays; the order number goes in Reference No');
  eq(order.data.items[0].quantity, 10, 'The order itself is not changed');
  const s = orderSummary(order, [dc]);
  eq([s.status, s.ordered, s.dispatched, s.invoiced, s.docs.map((d) => d.number)], ['partly-dispatched', 12, 4, 0, [dc.invoiceNumber]], 'Row summary: 4 of 12 dispatched, and its challans');
}

console.log('\n[#135] Feature switch');
{
  eq(isModuleEnabled('salesOrders', {}), false, 'Off unless switched on (existing users see nothing new)');
  for (const t of ['wholesale', 'manufacturer', 'everything']) eq(modulesForType(t).salesOrders, true, `${t}: on`);
  for (const t of ['retail_shop', 'freelancer', 'restaurant', 'service']) eq(modulesForType(t).salesOrders, false, `${t}: off`);
}

console.log(`\nsales-order-test: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
