// v1.10.85 (#168) - purchase returns: goods sent back to a supplier, written
// up as your Debit Note (DN/26-27/0001) against their purchase bill.
//
// GST: the supplier issues a credit note for the return (section 34); your
// debit note documents the return and the input tax credit it takes back.
// GSTR-2B shows the supplier's credit note as a negative entry to be netted
// off Table 4(A)(5) of GSTR-3B, so the return reduces "All other ITC" in the
// month of the debit note, head by head (IGST between states, else CGST +
// SGST), and the cess too. A month whose returns are more than its purchase
// ITC reports the extra as ITC reversed, Table 4(B)(2) (netItc below).
//
// Debit notes live in their own folder (data/debit-notes), like purchase
// orders: GSTR-2B matching and every purchase total read data/purchases, so a
// return can never be counted as a purchase. Each place a return changes
// takes it off explicitly: stock (stockApplied, like a bill), what you owe
// the supplier (withReturns -> purchaseBalance), GSTR-3B ITC, cost centres,
// and the income tax trading figures.
//
// Pure: no React, no storage (tested in scripts/debit-note-test.mjs).
import { formatDocNumber, getFinancialYearLabel, parseLocalDate, roundQty, splitPurchaseTax, baseQty, altLineFields } from '../utils.js';
import { purchaseTotals, lineDiscountFields, lineWithQuantity } from './purchaseOrders.js';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const nameKey = (it) => String(it?.name || '').trim().toLowerCase();
export const isActiveDebitNote = (dn) => !!dn && !dn.cancelled;
const notesFor = (bill, debitNotes) => (debitNotes || []).filter((dn) => isActiveDebitNote(dn) && bill?.id && dn.purchaseId === bill.id);

// The bill line a returned line came from: its own line number while that
// line still has the same name, else the first line of that name.
const billLine = (items, it) => (Number.isInteger(it?.line) && nameKey(items[it.line]) === nameKey(it)
  ? it.line : items.findIndex((x) => nameKey(x) === nameKey(it)));

// Each line of the bill: bought, already returned (on debit notes not
// cancelled) and what can still go back.
export function returnableLines(bill, debitNotes) {
  const items = bill?.items || [];
  const back = items.map(() => 0);
  for (const dn of notesFor(bill, debitNotes)) {
    for (const it of dn.items || []) {
      const i = billLine(items, it);
      if (i >= 0) back[i] = roundQty(back[i] + (Number(it.quantity) || 0));
    }
  }
  return items.map((it, i) => {
    const bought = Number(it.quantity) || 0;
    return { line: i, name: it.name || '', hsn: it.hsn || '', unit: it.unit || '', rate: Number(it.rate) || 0,
      taxPercent: Number(it.taxPercent) || 0, cessPercent: Number(it.cessPercent) || 0,
      ...(it.productId ? { productId: it.productId } : {}), ...lineDiscountFields(it),
      // #148 - a line bought in boxes goes back in boxes.
      ...altLineFields(it),
      bought, returned: back[i], left: roundQty(Math.max(0, bought - back[i])) };
  });
}

// '' when these quantities ({ line: qty }) can go back on `date`, else what to fix.
export function returnProblem(bill, debitNotes, qtyByLine, date = '') {
  if (date && bill?.date && date < bill.date) return `The debit note date cannot be before the bill's date (${bill.date})`;
  const lines = returnableLines(bill, debitNotes);
  let any = false;
  for (const l of lines) {
    const q = Number(qtyByLine?.[l.line]) || 0;
    if (q < 0) return `${l.name || 'A line'}: the quantity cannot be less than 0`;
    if (q > l.left + 1e-9) return `${l.name || 'A line'}: only ${l.left} can go back (${l.bought} bought, ${l.returned} already returned)`;
    if (q > 0) any = true;
  }
  return any ? '' : 'Enter the quantity going back on at least one line';
}

// The debit note for a return: the bill's supplier, number and date, and the
// returned lines at the bill's rates and GST. Number, id and stock are added
// when it is saved. A discounted line goes back at its discounted value (an
// amount off the line is shared out over the quantity). `owner` is the open
// business ({ gstin, name }), for a bill saved before bills had one.
export function debitNoteFromBill(bill, debitNotes, qtyByLine, { date = '', reason = '', note = '', owner = null } = {}) {
  const items = returnableLines(bill, debitNotes)
    .filter((l) => (Number(qtyByLine?.[l.line]) || 0) > 0)
    .map((l) => lineWithQuantity({ line: l.line, name: l.name, hsn: l.hsn, ...(l.unit ? { unit: l.unit } : {}), ...(l.productId ? { productId: l.productId } : {}),
      quantity: l.bought, rate: l.rate, taxPercent: l.taxPercent, cessPercent: l.cessPercent, ...lineDiscountFields(l),
      ...altLineFields(l) },
    roundQty(Number(qtyByLine[l.line]))));
  const hasOwner = !!(bill.ownerGstin || bill.ownerName);
  return {
    date, purchaseId: bill.id, billNumber: bill.invoiceNumber || '', billDate: bill.date || '',
    supplierName: bill.supplierName || '', supplierAddress: bill.supplierAddress || '', supplierGstin: bill.supplierGstin || '',
    interstate: !!bill.interstate, reverseCharge: !!bill.reverseCharge,
    ownerGstin: hasOwner ? (bill.ownerGstin || '') : (owner?.gstin || ''),
    ownerName: hasOwner ? (bill.ownerName || '') : (owner?.name || ''),
    ...(bill.costCentre ? { costCentre: bill.costCentre, costCentreName: bill.costCentreName || '' } : {}),
    items, reason: String(reason || '').trim(), note: String(note || '').trim(),
  };
}

// Taxable value, the tax by head, cess and total of a debit note.
export function debitNoteTotals(dn) {
  const t = purchaseTotals(dn?.items || []);
  const split = splitPurchaseTax(t.tax, !!dn?.interstate);
  return { taxable: r2(t.taxable), ...split, tax: r2(t.tax), cess: r2(t.cess), total: r2(t.total) };
}

// What the debit note does to stock: the returned goods go out ({ id: -qty }),
// nothing once it is cancelled. Products are found by productId, else name,
// as saving the bill found them.
export function debitNoteStock(dn, products) {
  if (!isActiveDebitNote(dn)) return {};
  const byName = new Map((products || []).map((p) => [nameKey(p), p.id]));
  const ids = new Set((products || []).map((p) => p.id));
  const out = {};
  for (const it of dn.items || []) {
    const id = (it.productId && ids.has(it.productId)) ? it.productId : byName.get(nameKey(it));
    const q = baseQty(it); // #148 - in the base unit
    if (id && q) out[id] = roundQty((out[id] || 0) - q);
  }
  return out;
}

// Returned lines that match no product, so no stock moves for them (names).
export const unmatchedLines = (dn, products) => {
  const names = new Set((products || []).map((p) => nameKey(p)));
  const ids = new Set((products || []).map((p) => p.id));
  return (dn?.items || []).filter((it) => !(it.productId && ids.has(it.productId)) && !names.has(nameKey(it))).map((it) => it.name || '-');
};

// What the debit notes against a bill take off it (with GST). A bill sent
// back in full also loses its round-off, so nothing at all is owed on it.
// v1.10.86 - on a reverse-charge bill the supplier was never owed the GST, so
// a return takes off its value without GST (dnValueOnBill).
export const dnValueOnBill = (bill, dn) => (bill?.reverseCharge ? debitNoteTotals(dn).taxable : debitNoteTotals(dn).total);
export const returnedOnBill = (bill, debitNotes) => {
  const notes = notesFor(bill, debitNotes);
  const sum = notes.reduce((s, dn) => s + dnValueOnBill(bill, dn), 0);
  const all = notes.length && (bill?.items || []).length && returnableLines(bill, debitNotes).every((l) => l.left <= 0);
  if (!all) return r2(sum);
  const t = purchaseTotals(bill.items, !!bill.applyRoundOff);
  return r2(bill.reverseCharge ? t.finalTotal - t.tax - t.cess : t.finalTotal);
};

// Editing a bill that has returns: a returned line cannot go below what went
// back, nor be renamed or removed (its debit notes point at it). '' when the
// new lines are fine, else what to fix.
// v1.10.86 - nor can its discount on the whole bill change (`discount`,
// { value, type } as on the form): the debit notes went back at its share.
const billDiscountKey = (value, type) => ((Number(value) || 0) > 0 ? `${Number(value)}|${type === 'percent' ? 'percent' : 'fixed'}` : '');
export function editProblem(bill, newItems, debitNotes, discount = null) {
  if (!notesFor(bill, debitNotes).length) return '';
  if (discount && billDiscountKey(discount.value, discount.type) !== billDiscountKey(bill?.billDiscountValue, bill?.billDiscountType)) {
    return 'Goods on this bill went back to the supplier on a debit note, so its discount on the whole bill cannot change. Cancel or delete the debit note first (Returns tab).';
  }
  const items = newItems || [];
  for (const l of returnableLines(bill, debitNotes)) {
    if (!(l.returned > 0)) continue;
    const i = nameKey(items[l.line]) === nameKey(l) ? l.line : items.findIndex((x) => nameKey(x) === nameKey(l));
    if (i < 0) return `${l.name}: ${l.returned} went back to the supplier on a debit note, so this line cannot be removed or renamed. Cancel or delete the debit note first (Returns tab).`;
    if ((Number(items[i].quantity) || 0) < l.returned - 1e-9) return `${l.name}: ${l.returned} already went back on a debit note, so the quantity cannot be less than ${l.returned}.`;
  }
  return '';
}

// Debit notes whose business no longer matches their bill's (the bill was
// assigned to a business, or saved under another one): the notes with the
// bill's owner, ready to save.
export const notesToRestamp = (bills, debitNotes) => (debitNotes || []).flatMap((dn) => {
  const bill = (bills || []).find((b) => b.id === dn.purchaseId);
  if (!bill || !(bill.ownerGstin || bill.ownerName)) return [];
  if ((dn.ownerGstin || '') === (bill.ownerGstin || '') && (dn.ownerName || '') === (bill.ownerName || '')) return [];
  return [{ ...dn, ownerGstin: bill.ownerGstin || '', ownerName: bill.ownerName || '' }];
});

// The first number from `next` on that no debit note already has (a restored
// older backup can put the counter back behind numbers in use). `nextNumber`
// gives the next number each call.
export async function freeDnNumber(nextNumber, debitNotes, tries = 1000) {
  const used = new Set((debitNotes || []).map((dn) => String(dn.dnNumber || '').trim().toLowerCase()));
  for (let i = 0; i < tries; i++) {
    const n = await nextNumber();
    if (!used.has(String(n).trim().toLowerCase())) return n;
  }
  throw new Error('No free debit note number found');
}

// The bills with `_returned` set (in memory only; savePurchase drops it), so
// purchaseBalance / purchaseStatus take returns off what is owed.
export const withReturns = (purchases, debitNotes) => (purchases || []).map((p) => {
  const returned = returnedOnBill(p, debitNotes);
  if (returned) return { ...p, _returned: returned };
  if (p?._returned === undefined) return p;
  const { _returned, ...rest } = p;
  return rest;
});

// The ITC taken back by the debit notes `inPeriod` accepts (by date).
export function purchaseReturnsTax(debitNotes, inPeriod = () => true) {
  return (debitNotes || []).filter((dn) => isActiveDebitNote(dn) && inPeriod(dn.date)).reduce((acc, dn) => {
    const t = debitNoteTotals(dn);
    return { taxable: r2(acc.taxable + t.taxable), igst: r2(acc.igst + t.igst), cgst: r2(acc.cgst + t.cgst), sgst: r2(acc.sgst + t.sgst), cess: r2(acc.cess + t.cess) };
  }, { taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 });
}

// GSTR-3B 3.1(d), inward supplies on reverse charge ({ txval, iamt, camt,
// samt, csamt } of the period's reverse-charge bills), less the period's
// returns on such bills (purchaseReturnsTax of the reverse-charge debit
// notes), never below 0, rounded to the paisa.
export const rcmNetOfReturns = (t, ret) => {
  const net = (a, b) => r2(Math.max(0, (Number(a) || 0) - (Number(b) || 0)));
  return { txval: net(t.txval, ret.taxable), iamt: net(t.iamt, ret.igst), camt: net(t.camt, ret.cgst), samt: net(t.samt, ret.sgst), csamt: net(t.csamt, ret.cess) };
};

// GSTR-3B Table 4: ITC available (4(A)(5)) net of the returns, head by head;
// a head whose returns are more than its ITC shows 0 there and the rest as
// ITC reversed (4(B)(2)). net = what is left to set off (never below 0) and
// reversed = what is to be paid back over and above.
// v1.10.86 - reverse charge on purchase bills: the period's reverse-charge
// bills ({ txval, iamt, camt, samt, csamt }, from each bill's own lines),
// less their returns (rcmNetOfReturns): GSTR-3B 3.1(d), the tax you pay in
// cash. `purchases` are the period's bills; only those ticked count.
export function rcmInward(purchases, rcmReturns) {
  const t = (purchases || []).filter((p) => !!p?.reverseCharge).reduce((acc, p) => {
    const items = Array.isArray(p.items) && p.items.length ? purchaseTotals(p.items) : null;
    const tax = items ? items.tax : Number(p.totalTax) || 0;
    const split = splitPurchaseTax(tax, !!p.interstate);
    return { txval: acc.txval + (items ? items.taxable : Number(p.taxableAmount) || 0), iamt: acc.iamt + split.igst, camt: acc.camt + split.cgst,
      samt: acc.samt + split.sgst, csamt: acc.csamt + (items ? items.cess : Number(p.totalCess) || 0) };
  }, { txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 });
  return rcmNetOfReturns(t, rcmReturns || {});
}

// v1.10.86 - the ITC available (netItc's avl) split for GSTR-3B Table 4: the
// reverse-charge tax you paid (rcmInward) is 4(A)(3), the rest 4(A)(5). The
// total is unchanged; 4(A)(3) is never more than what is available.
export function splitRcmItc(avl, rcm) {
  const heads = { igst: 'iamt', cgst: 'camt', sgst: 'samt', cess: 'csamt' };
  const isrc = {}, oth = {};
  for (const [k, j] of Object.entries(heads)) {
    const a = Number(avl?.[k]) || 0;
    isrc[k] = r2(Math.min(a, Math.max(0, Number(rcm?.[j]) || 0)));
    oth[k] = r2(a - isrc[k]);
  }
  return { isrc, oth };
}

export function netItc(itc, returns) {
  const avl = {}, rev = {};
  for (const k of ['igst', 'cgst', 'sgst', 'cess']) {
    const d = r2((Number(itc?.[k]) || 0) - (Number(returns?.[k]) || 0));
    avl[k] = Math.max(0, d);
    rev[k] = Math.max(0, r2(-d));
  }
  return { avl, rev };
}

// DN/26-27/0001, each business its own series, never handed out twice (the
// counter only goes up). The financial year is the debit note's date.
export const dnCounterKey = (businessKey) => (businessKey ? `counter_DN@${businessKey}` : 'counter_DN');
export const formatDnNumber = (next, date) => formatDocNumber({
  settings: { format: 'branded', brandPrefix: '', separator: '/', showFinYear: true, padDigits: 4, fyStyle: 'short' },
  typePrefix: 'DN',
  next,
  fyLabel: getFinancialYearLabel(date ? parseLocalDate(date) : new Date()),
});
