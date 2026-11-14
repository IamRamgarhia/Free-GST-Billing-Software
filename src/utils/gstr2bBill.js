// v1.10.86 - (#175) GSTR-2B -> purchase bill. A "2B only" row (the supplier
// reported the invoice, your books do not have it) opens the purchase bill
// form filled in from the 2B data, for the user to check and Save. Nothing is
// saved here.
//
// 2B gives no item names or HSN: one line per GST rate, quantity 1 at the
// taxable value, named "Purchase at 18% GST (from GSTR-2B)". Lines still
// carrying that name are not added to Products when the bill is saved (no
// stock moves); renamed to a product, they count as usual.
//
// Only invoices (docdata.b2b) are matched; credit / debit notes (cdnr) are
// counted so the screen can say they were left out.
//
// The mapping is pure (scripts/gstr2b-bill-test.mjs); the hand-over to the
// Purchases screen keeps the draft and the imported 2B file in this tab's
// sessionStorage, like utils/reorderDraft.js.
import { purchaseTotals } from './purchaseOrders.js';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const PLACEHOLDER = /\(from GSTR-2B\)$/;
export const isTwoBPlaceholder = (name) => PLACEHOLDER.test(String(name || '').trim());

// 2B dates are dd-mm-yyyy; the form wants yyyy-mm-dd. '' when unreadable.
export function twoBDate(dt) {
  const s = String(dt || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(s);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

const RATES = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28, 40];
// The item's GST rate: `rt`, else worked out from its tax (nearest GST rate).
function itemRate(it) {
  if (it?.rt !== undefined && it?.rt !== null && it?.rt !== '' && Number.isFinite(Number(it.rt))) return Number(it.rt);
  const txval = Number(it?.txval) || 0;
  const tax = (Number(it?.igst) || 0) + (Number(it?.cgst) || 0) + (Number(it?.sgst) || 0);
  if (!(txval > 0)) return 0;
  const pct = (tax / txval) * 100;
  return RATES.reduce((best, r) => (Math.abs(r - pct) < Math.abs(best - pct) ? r : best), 0);
}

// The purchase bill form fields for one 2B invoice. `sup` is its supplier
// ({ ctin, trdnm }), `ownGstin` your GSTIN (place of supply when no tax shows
// the split), `period` the 2B return period for the note.
export function purchaseFromTwoB(sup, inv, { ownGstin = '', period = '' } = {}) {
  const byRate = new Map();
  let igst = 0, cgst = 0;
  for (const it of inv?.items || []) {
    const rate = itemRate(it);
    const cur = byRate.get(rate) || { txval: 0, cess: 0 };
    byRate.set(rate, { txval: cur.txval + (Number(it.txval) || 0), cess: cur.cess + (Number(it.cess) || 0) });
    igst += Number(it.igst) || 0;
    cgst += (Number(it.cgst) || 0) + (Number(it.sgst) || 0);
  }
  const items = [...byRate.entries()].sort((a, b) => b[0] - a[0]).map(([rate, v]) => ({
    name: `Purchase at ${rate}% GST (from GSTR-2B)`, hsn: '', quantity: 1, unit: '',
    rate: r2(v.txval), taxPercent: rate,
    cessPercent: v.cess > 0 && v.txval > 0 ? Math.round((v.cess / v.txval) * 1e6) / 1e4 : 0,
  }));
  // IGST charged: between states. No tax at all: the place of supply says.
  const ownState = String(ownGstin || '').slice(0, 2);
  const pos = String(inv?.pos || '').padStart(2, '0');
  const interstate = igst > 0.005 ? true : cgst > 0.005 ? false : !!(inv?.pos && ownState && pos !== ownState);
  // The supplier's invoice value is usually rounded to the rupee.
  const val = Number(inv?.val) || 0;
  const exact = purchaseTotals(items).total;
  const applyRoundOff = val > 0 && Math.abs(exact - val) >= 0.005 && Math.abs(purchaseTotals(items, true).finalTotal - val) < 0.005;
  const note = [
    `From GSTR-2B${period ? ` (${period})` : ''}`,
    inv?.itcavl === 'N' && `ITC not available as per 2B${inv?.rsn ? ` (${inv.rsn})` : ''}`,
  ].filter(Boolean).join('. ');
  return {
    supplierName: String(sup?.trdnm || '').trim() || String(sup?.ctin || '').toUpperCase(),
    supplierGstin: String(sup?.ctin || '').trim().toUpperCase(),
    invoiceNumber: String(inv?.inum || '').trim(),
    date: twoBDate(inv?.dt),
    interstate,
    applyRoundOff,
    items,
    note,
    // v1.10.86 - the bill's Reverse charge tick, from 2B (GSTR-3B 3.1(d)).
    reverseCharge: inv?.rev === 'Y',
  };
}

// Credit / debit notes in the 2B file (not matched by the reconciliation).
export const twoBNoteCount = (root) => (root?.docdata?.cdnr || root?.cdnr || [])
  .reduce((s, sup) => s + ((sup?.nt || []).length), 0);

// ---- hand-over between GST Returns and Purchases (this tab only) ----
const DRAFT = 'fgsb_purchaseFrom2B';
const FILE = 'fgsb_gstr2bFile';
const BACK = 'fgsb_backTo2B';
const put = (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode / too big: nothing kept */ } };
const read = (k) => { try { const raw = sessionStorage.getItem(k); return raw ? JSON.parse(raw) : null; } catch { return null; } };
const drop = (k) => { try { sessionStorage.removeItem(k); } catch { /* nothing to drop */ } };

export const putTwoBDraft = (form) => put(DRAFT, form);
export const takeTwoBDraft = () => { const d = read(DRAFT); drop(DRAFT); return d && Array.isArray(d.items) ? d : null; };
// The imported 2B file, so coming back to GST Returns shows it again.
export const keepTwoBFile = (root) => (root ? put(FILE, root) : drop(FILE));
export const keptTwoBFile = () => read(FILE);
// Set when a 2B bill is saved: GST Returns opens on the GSTR-2B tab once
// (read in a state initialiser, cleared in an effect: StrictMode runs
// initialisers twice).
export const markBackToTwoB = () => put(BACK, true);
export const wantsBackToTwoB = () => !!read(BACK);
export const clearBackToTwoB = () => drop(BACK);
