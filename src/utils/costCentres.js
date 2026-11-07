/*
 * v1.10.83 (#112) - cost centres: tag a bill, purchase or expense with a
 * branch, site or project, then see sales, purchases, expenses and profit
 * for each one.
 *
 * Requested: "There is no Cost center management for Project or Branch".
 * One cost centre per document, kept simple on purpose: splitting one bill
 * across two sites is a different (and much bigger) feature.
 *
 * The list lives in meta.json as `costCentres`: [{ id, name, code, archived,
 * business }]. `business` is businessKeyOf() of the business it belongs to;
 * a centre with none shows under every business, the same rule
 * belongsToProfile() uses for records that cannot be attributed.
 *
 * A document stores `costCentre` (the id) and `costCentreName` (the name when
 * it was tagged), so a rename or archive never blanks an old document.
 * Invoices keep both in data.details (they travel with the rest of the
 * invoice details: drafts, edits, duplicates); purchases and expenses keep
 * them on the record itself.
 */
import { salesSign, businessKeyOf } from '../utils.js';
import { debitNoteTotals } from './debitNotes.js';

export const UNTAGGED = '__untagged';

export const centreOf = (doc) => doc?.costCentre || doc?.data?.details?.costCentre || '';
const centreNameOf = (doc) => doc?.costCentreName || doc?.data?.details?.costCentreName || '';

export const centreLabel = (c) => (c?.code ? `${c.name} (${c.code})` : (c?.name || ''));

// This business's centres (plus any filed under no business).
export const centresForBusiness = (all, profile) => {
  const key = businessKeyOf(profile);
  return (all || []).filter((c) => !c.business || !key || c.business === key);
};

// A business saved under a new GSTIN or name keeps its centres.
export const rekeyCentres = (all, from, to) =>
  (all || []).map((c) => (from && to && c.business === from ? { ...c, business: to } : c));

// '' = all, UNTAGGED = documents with no cost centre, else one centre's id.
export const matchesCentre = (doc, filter) => {
  if (!filter) return true;
  return filter === UNTAGGED ? !centreOf(doc) : centreOf(doc) === filter;
};

// The fields a document stores for a chosen centre; none at all when it is
// cleared, so an untagged document looks exactly as it did before #112.
export const centreFields = (id, name) => (id ? { costCentre: id, costCentreName: name || '' } : {});

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const inRange = (date, from, to) => !!date && (!from || date >= from) && (!to || date <= to);
// TCS is collected for the government, like GST: in the total, not income
// (same as the Profit & Loss tab).
const tcsOf = (b) => Number(b.data?.totals?.tcsAmount) || 0;
// Same rule as the Income Tax helper: the stored taxable value, else total less tax.
const purchaseTaxable = (p) => (p.taxableAmount != null ? Number(p.taxableAmount) || 0
  : (Number(p.totalAmount) || 0) - (Number(p.totalTax) || 0));

/**
 * Sales, purchases, expenses and profit per cost centre, for dates from..to
 * (YYYY-MM-DD, both included; empty = open-ended).
 *
 * Sales follow the Profit & Loss tab: only documents with salesSign() count
 * (quotes and challans 0, cancelled 0, credit notes -1). Taxable = total less
 * GST and TCS. Purchases and expenses are counted without GST, since the GST
 * on them comes back as input tax credit. Profit = sales taxable - purchases
 * - expenses. Pass bills, purchases and expenses of one business and one
 * currency.
 *
 * Rows: every active centre, archived ones only when they have something in
 * the period, a centre a document names but the list no longer has (e.g. a
 * backup from another PC), then "Untagged". Plus a total row.
 */
export function costCentreReport({ bills = [], purchases = [], expenses = [], debitNotes = [], centres = [], from = '', to = '' }) {
  const rows = new Map();
  const blank = (id, name, extra = {}) => ({ id, name, code: '', archived: false, salesTaxable: 0, salesTax: 0, salesTotal: 0, purchases: 0, expenses: 0, profit: 0, count: 0, ...extra });
  for (const c of centres) rows.set(c.id, blank(c.id, c.name, { code: c.code || '', archived: !!c.archived }));
  const rowFor = (doc) => {
    const id = centreOf(doc) || UNTAGGED;
    if (!rows.has(id)) rows.set(id, blank(id, id === UNTAGGED ? 'Untagged' : (centreNameOf(doc) || 'Unknown cost centre')));
    const row = rows.get(id);
    row.count += 1;
    return row;
  };

  for (const b of bills) {
    const sign = salesSign(b);
    if (!b?.data || sign === 0 || !inRange(b.invoiceDate, from, to)) continue;
    const row = rowFor(b);
    const total = sign * (Number(b.totalAmount) || 0);
    const tax = sign * ((Number(b.totalTaxAmount) || 0) + tcsOf(b));
    row.salesTotal += total;
    row.salesTax += tax;
    row.salesTaxable += total - tax;
  }
  for (const p of purchases) {
    if (!inRange(p?.date, from, to)) continue;
    rowFor(p).purchases += purchaseTaxable(p);
  }
  // v1.10.85 (#168) - goods sent back on a debit note come off the purchases
  // of the bill's cost centre (the debit note carries it), by its date.
  for (const dn of debitNotes) {
    if (!dn || dn.cancelled || !inRange(dn.date, from, to)) continue;
    rowFor(dn).purchases -= debitNoteTotals(dn).taxable;
  }
  for (const e of expenses) {
    if (!inRange(e?.date, from, to)) continue;
    rowFor(e).expenses += (Number(e.amount) || 0) - (Number(e.gstAmount) || 0);
  }

  if (!rows.has(UNTAGGED)) rows.set(UNTAGGED, blank(UNTAGGED, 'Untagged'));
  const untagged = rows.get(UNTAGGED);
  rows.delete(UNTAGGED);
  const out = [...rows.values()].filter((r) => !r.archived || r.count > 0);
  out.push(untagged);

  const total = blank('', 'Total');
  const finished = out.map((r) => {
    const row = { ...r, salesTaxable: r2(r.salesTaxable), salesTax: r2(r.salesTax), salesTotal: r2(r.salesTotal), purchases: r2(r.purchases), expenses: r2(r.expenses) };
    row.profit = r2(row.salesTaxable - row.purchases - row.expenses);
    for (const k of ['salesTaxable', 'salesTax', 'salesTotal', 'purchases', 'expenses', 'profit', 'count']) total[k] += row[k];
    return row;
  });
  for (const k of ['salesTaxable', 'salesTax', 'salesTotal', 'purchases', 'expenses', 'profit']) total[k] = r2(total[k]);
  return { rows: finished, total };
}
