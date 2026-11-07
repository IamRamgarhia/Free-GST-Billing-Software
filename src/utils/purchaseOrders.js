// v1.10.83 (#112) - purchase orders: the pure parts (totals, status, numbering,
// the bill a PO turns into), kept out of the components so they can be tested.
import { calculateRoundOff, formatDocNumber, getFinancialYearLabel, parseLocalDate, roundQty, resolveLineDiscount, baseQty, lineFactor, altLineFields } from '../utils.js';

// Line and document totals for purchase bills and purchase orders alike.
// Moved here from PurchaseBills.jsx unchanged, so both use the same sums.
// v1.10.85 (#171) - a line discount (discountType 'percent', else an amount
// off the line; resolveLineDiscount, as on sales invoices) comes off before
// GST and cess. `amount` is the taxable value after it; `gross` is qty x rate.
// A line with no discount gives exactly what it gave before.
export function purchaseLineTax(item) {
  const gross = (item.quantity || 0) * (item.rate || 0);
  const discount = purchaseLineDiscount(item);
  const amount = discount ? gross - discount : gross;
  const tax = (amount * (item.taxPercent || 0)) / 100;
  const cess = (amount * (Number(item.cessPercent) || 0)) / 100;
  return { gross, discount, amount, tax, cess, total: amount + tax + cess };
}
// The discount on a purchase line (0 when none). Only percent or an amount
// off the whole line: the purchase form offers no other kind.
export const purchaseLineDiscount = (item) => resolveLineDiscount({
  quantity: item?.quantity, rate: item?.rate, discount: item?.discount,
  discountType: item?.discountType === 'percent' ? 'percent' : 'fixed',
});
// The discount fields a saved line keeps: none at all without a discount, so
// lines look exactly as they did before #171.
export const lineDiscountFields = (it) => ((Number(it?.discount) || 0) > 0
  ? { discount: Number(it.discount), discountType: it.discountType === 'percent' ? 'percent' : 'fixed' } : {});
// The line for part of its quantity: a percent discount stays as it is, an
// amount off the line is shared out (2 of 10 returned carry 2/10 of it).
export const lineWithQuantity = (it, q) => {
  const of = Number(it?.quantity) || 0;
  const amountOff = (Number(it?.discount) || 0) > 0 && it.discountType !== 'percent';
  return { ...it, quantity: q, ...(amountOff && of > 0 ? { discount: Math.round((Number(it.discount) * q / of) * 100) / 100 } : {}) };
};
// v1.10.85 (#160) - does any line of a purchase carry this serial number /
// IMEI (or part of one)? Serials are typed comma or space separated.
export const purchaseHasSerial = (p, query) => {
  const q = String(query || '').trim().toLowerCase();
  return !!q && (p?.items || []).some((it) => String(it?.serialNo || '').toLowerCase().includes(q));
};
// What one unit really cost (after its discount, before GST): the cost price
// a purchase gives the product.
export const purchaseUnitCost = (item) => {
  const q = Number(item?.quantity) || 0;
  if (!purchaseLineDiscount(item) || q <= 0) return Number(item?.rate) || 0;
  return Math.round((purchaseLineTax(item).amount / q) * 10000) / 10000;
};

export function purchaseTotals(items, applyRoundOff = false) {
  const raw = (items || []).reduce((acc, item) => {
    const { amount, tax, cess, total } = purchaseLineTax(item);
    return {
      taxable: acc.taxable + amount,
      tax: acc.tax + tax,
      cess: acc.cess + cess,
      total: acc.total + total,
    };
  }, { taxable: 0, tax: 0, cess: 0, total: 0 });
  // Round-off is applied to the GRAND total (taxable + tax + cess). Stored
  // as a separate line so GSTR-3B input tax credit reflects the supplier's
  // actual tax amount, not a rounded version.
  const roundOff = applyRoundOff ? calculateRoundOff(raw.total) : 0;
  return { ...raw, roundOff, finalTotal: raw.total + roundOff };
}

export const PO_STATUS_LABELS = {
  open: 'Open',
  'partly-received': 'Partly received',
  received: 'Received',
  cancelled: 'Cancelled',
};

// Bill lines are matched to PO lines by item name, the same way saving a bill
// matches products.
const nameKey = (it) => String(it?.name || '').trim().toLowerCase();

// What is still to come on a PO: its lines less everything the bills saved
// from it (bill.fromPo) received. Two PO lines of the same item share what
// was received, first line first.
export function poRemainingItems(po, purchases) {
  const got = new Map();
  for (const b of purchases || []) {
    if (!po?.id || b?.fromPo !== po.id) continue;
    // v1.10.85 (#148) - counted in the base unit: a PO of 2 boxes of 12 and a
    // bill of 12 pieces leave 1 box to come.
    for (const it of b.items || []) got.set(nameKey(it), (got.get(nameKey(it)) || 0) + baseQty(it));
  }
  const out = [];
  for (const it of po?.items || []) {
    const qty = baseQty(it);
    const take = Math.min(qty, got.get(nameKey(it)) || 0);
    got.set(nameKey(it), (got.get(nameKey(it)) || 0) - take);
    const left = roundQty((qty - take) / lineFactor(it));
    if (left > 0) out.push(lineWithQuantity(it, left));
  }
  return out;
}

// Open until a bill is saved from it; Received once the bills cover every
// line; Partly received in between. Cancelled is the user's choice and stays.
export function poStatus(po, purchases) {
  if (po?.cancelled) return 'cancelled';
  if (!(purchases || []).some((b) => po?.id && b?.fromPo === po.id)) return 'open';
  return poRemainingItems(po, purchases).length ? 'partly-received' : 'received';
}

// The purchase bill form, filled from a PO: what is still to come, at the PO's
// rates. The supplier's bill number is left for the user to type.
export function billFormFromPo(po, purchases) {
  return {
    supplierName: po.supplierName || '',
    supplierAddress: po.supplierAddress || '',
    supplierGstin: po.supplierGstin || '',
    interstate: !!po.interstate,
    invoiceNumber: '',
    items: poRemainingItems(po, purchases).map((it) => ({
      name: it.name || '', hsn: it.hsn || '', quantity: it.quantity, unit: it.unit || '',
      rate: Number(it.rate) || 0, taxPercent: Number(it.taxPercent) || 0, cessPercent: Number(it.cessPercent) || 0,
      ...lineDiscountFields(it),
      // v1.10.85 (#148) - a line ordered in boxes is billed in boxes.
      ...altLineFields(it),
    })),
    fromPo: po.id,
    // v1.10.83 (#112) - the bill belongs to the same cost centre as its order.
    costCentre: po.costCentre || '',
    costCentreName: po.costCentreName || '',
  };
}

// Each business counts its own POs (counter_PO@<business>), and a number is
// never handed out twice: the counter only goes up.
export const poCounterKey = (businessKey) => (businessKey ? `counter_PO@${businessKey}` : 'counter_PO');

// PO/26-27/0001 - the financial year of the PO's date.
export const formatPoNumber = (next, date) => formatDocNumber({
  settings: { format: 'branded', brandPrefix: '', separator: '/', showFinYear: true, padDigits: 4, fyStyle: 'short' },
  typePrefix: 'PO',
  next,
  fyLabel: getFinancialYearLabel(date ? parseLocalDate(date) : new Date()),
});
