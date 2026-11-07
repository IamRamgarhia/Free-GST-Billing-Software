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
import { formatDocNumber, getFinancialYearLabel, parseLocalDate, roundQty, splitPurchaseTax } from '../utils.js';
import { purchaseTotals } from './purchaseOrders.js';

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
      bought, returned: back[i], left: roundQty(Math.max(0, bought - back[i])) };
  });
}

// '' when these quantities ({ line: qty }) can go back, else what to fix.
export function returnProblem(bill, debitNotes, qtyByLine) {
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
// when it is saved.
export function debitNoteFromBill(bill, debitNotes, qtyByLine, { date = '', reason = '', note = '' } = {}) {
  const items = returnableLines(bill, debitNotes)
    .filter((l) => (Number(qtyByLine?.[l.line]) || 0) > 0)
    .map((l) => ({ line: l.line, name: l.name, hsn: l.hsn, ...(l.unit ? { unit: l.unit } : {}), quantity: roundQty(Number(qtyByLine[l.line])),
      rate: l.rate, taxPercent: l.taxPercent, cessPercent: l.cessPercent }));
  return {
    date, purchaseId: bill.id, billNumber: bill.invoiceNumber || '', billDate: bill.date || '',
    supplierName: bill.supplierName || '', supplierAddress: bill.supplierAddress || '', supplierGstin: bill.supplierGstin || '',
    interstate: !!bill.interstate, reverseCharge: !!bill.reverseCharge,
    ownerGstin: bill.ownerGstin || '', ownerName: bill.ownerName || '',
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
    const q = Number(it.quantity) || 0;
    if (id && q) out[id] = roundQty((out[id] || 0) - q);
  }
  return out;
}

// What the debit notes against a bill take off it (with GST).
export const returnedOnBill = (bill, debitNotes) => r2(notesFor(bill, debitNotes).reduce((s, dn) => s + debitNoteTotals(dn).total, 0));

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

// GSTR-3B Table 4: ITC available (4(A)(5)) net of the returns, head by head;
// a head whose returns are more than its ITC shows 0 there and the rest as
// ITC reversed (4(B)(2)). net = what is left to set off (never below 0) and
// reversed = what is to be paid back over and above.
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
