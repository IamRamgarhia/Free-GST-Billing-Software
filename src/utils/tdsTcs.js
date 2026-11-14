// v1.10.83 - the Reports › TDS & TCS tab, and TDS recorded on a payment or a
// purchase bill. Pure functions, tested in scripts/tds-tcs-test.mjs.
//
//   - TDS your clients deducted from your sales invoices (invoiceOptions.showTDS,
//     totals.tdsAmount): money credited to your PAN, checked against Form 26AS
//     / AIS and the TDS certificate (Form 16A) each client sends.
//   - TCS you collected on sales (totals.tcsAmount).
//   - TDS you deducted from suppliers on purchase bills (purchase.tdsAmount):
//     what you deposit and report in your own TDS return (Form 26Q).

import { countsAsSales, sectionShort, tdsSectionsFor, tcsSectionsFor, TDS_SECTIONS_2025, TCS_SECTIONS_2025, TDS_SECTIONS, TCS_SECTIONS, NEW_ACT_FROM, underNewAct, newActCode, isPurchaseOfGoodsTds } from '../utils.js';
import { billInInr } from './fx.js';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Indian financial-year quarter of a YYYY-MM-DD date: Q1 Apr-Jun ... Q4 Jan-Mar.
export const quarterOf = (date) => {
  const m = Number(String(date || '').slice(5, 7));
  if (!m) return '';
  return m >= 4 && m <= 6 ? 'Q1' : m >= 7 && m <= 9 ? 'Q2' : m >= 10 ? 'Q3' : 'Q4';
};

// Dates of a financial year ('2026-2027' or start year 2026), whole or one
// quarter: { from, to }, both days included.
export const fyQuarterRange = (fyStart, quarter = '') => {
  const y = Number(String(fyStart).slice(0, 4));
  if (!y) return { from: '', to: '' };
  const q = { Q1: [`${y}-04-01`, `${y}-06-30`], Q2: [`${y}-07-01`, `${y}-09-30`], Q3: [`${y}-10-01`, `${y}-12-31`], Q4: [`${y + 1}-01-01`, `${y + 1}-03-31`] }[quarter];
  return q ? { from: q[0], to: q[1] } : { from: `${y}-04-01`, to: `${y + 1}-03-31` };
};

export const inRange = (date, { from = '', to = '' } = {}) => {
  const d = String(date || '').slice(0, 10);
  if (!d) return false;
  return (!from || d >= from) && (!to || d <= to);
};

// A GSTIN carries the holder's PAN in characters 3-12.
export const panFromGstin = (gstin) => {
  const g = String(gstin || '').trim().toUpperCase();
  return /^\d{2}[A-Z]{5}\d{4}[A-Z]/.test(g) ? g.slice(2, 12) : '';
};

// '194C-co', '194J-tech', '194I-pm' are rate variants of one section.
// v1.10.85 (#180) - 393(1) Sl. 6(i) for the 2025 Act's sections (sectionShort).
const sectionLabel = (code) => (code === 'custom' ? 'Custom' : sectionShort(code));
const taxableOf = (bill) => {
  const t = bill?.data?.totals || {};
  return r2(t.taxableAmount ?? ((t.subtotal || 0) - (t.totalDiscount || 0)));
};

// One row per sales invoice with TDS (kind 'tds') or TCS (kind 'tcs').
// Cancelled invoices, quotations, challans and credit notes are left out.
export const salesTaxRows = (bills, kind = 'tds', range = {}) => (bills || [])
  .filter((b) => b?.data && countsAsSales(b) && inRange(b.invoiceDate, range))
  .map((orig) => {
    // v1.10.83 - in rupees, at the invoice's own exchange rate (TDS is in
    // rupees); an invoice with no rate is shown as billed, marked fxMissing.
    const b = billInInr(orig) || orig;
    const opt = b.data.invoiceOptions || {};
    const t = b.data.totals || {};
    const client = b.data.client || {};
    const amount = r2(kind === 'tds' ? t.tdsAmount : t.tcsAmount);
    return {
      id: b.id,
      invoiceNumber: b.invoiceNumber || '',
      date: b.invoiceDate || '',
      quarter: quarterOf(b.invoiceDate),
      party: client.name || b.clientName || '',
      gstin: client.gstin || '',
      pan: client.pan || panFromGstin(client.gstin),
      section: sectionLabel(kind === 'tds' ? (opt.tdsSection || '194Q') : (opt.tcsSection || '206C(1H)')),
      rate: Number(kind === 'tds' ? opt.tdsRate : opt.tcsRate) || 0,
      taxable: taxableOf(b),
      amount,
      certificate: kind === 'tds' ? !!b.tdsCertificate : undefined,
      ...(b === orig && (orig.currency || opt.currency || 'INR') !== 'INR' ? { fxMissing: true } : {}),
    };
  })
  .filter((r) => r.amount > 0)
  .sort((a, b) => a.date.localeCompare(b.date) || a.invoiceNumber.localeCompare(b.invoiceNumber));

// TDS on a purchase bill: worked out on the value before GST (CBDT Circular
// 23/2017) at `rate`, unless an amount was typed in (`manual`).
export const purchaseTdsAmount = (taxable, rate, manual = '') => {
  if (manual !== '' && manual !== null && manual !== undefined && isFinite(Number(manual))) return Math.max(0, r2(manual));
  return Math.max(0, r2((Number(taxable) || 0) * (Number(rate) || 0) / 100));
};

// What the supplier is actually paid: the bill total less the TDS kept back.
export const paidToSupplier = (purchase) => r2((Number(purchase?.totalAmount) || 0) - (Number(purchase?.tdsAmount) || 0));

export const purchaseTdsRows = (purchases, range = {}) => (purchases || [])
  .filter((p) => (Number(p?.tdsAmount) || 0) > 0 && (p.kind || 'bill') === 'bill' && inRange(p.date, range))
  .map((p) => ({
    id: p.id,
    invoiceNumber: p.invoiceNumber || '',
    date: p.date || '',
    quarter: quarterOf(p.date),
    party: p.supplierName || '',
    gstin: p.supplierGstin || '',
    pan: p.supplierPan || panFromGstin(p.supplierGstin),
    section: sectionLabel(p.tdsSection),
    rate: Number(p.tdsRate) || 0,
    taxable: r2(p.taxableAmount),
    amount: r2(p.tdsAmount),
    paid: paidToSupplier(p),
  }))
  .sort((a, b) => a.date.localeCompare(b.date) || a.invoiceNumber.localeCompare(b.invoiceNumber));

// Totals grouped by `keyOf(row)`: [{ key, count, taxable, amount }], sorted by key.
export const totalsBy = (rows, keyOf) => {
  const map = new Map();
  for (const r of rows || []) {
    const k = keyOf(r) || '—';
    const g = map.get(k) || { key: k, count: 0, taxable: 0, amount: 0 };
    g.count += 1; g.taxable = r2(g.taxable + r.taxable); g.amount = r2(g.amount + r.amount);
    map.set(k, g);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
};

// v1.10.86 (#180 part 2) — work out which TDS / TCS provision applies from the
// kind of payment, the payee's constitution and the transaction date, instead
// of the user ticking a section by hand. Returns { section, rate, base, amount,
// act } or null when nothing applies. `act` is '1961' or '2025' so the voucher
// and the return quote the right Act. The rate follows the section's usual rate
// for the Act the transaction is under; a rate typed for a lower-deduction
// certificate is never guessed (the user keeps it).
export const suggestTds = (payee = {}, taxable, invoiceDate, opts = {}) => {
  const act = underNewAct(invoiceDate) ? '2025' : '1961';
  const list = act === '2025' ? TDS_SECTIONS_2025 : TDS_SECTIONS;
  const pan = String(payee.pan || panFromGstin(payee.gstin) || '').trim().toUpperCase();
  const hasPan = /^[A-Z]{5}\d{4}[A-Z]$/.test(pan);
  const isCompany = /(^|,)(company|pvt ltd|private limited|ltd)(,|$)/i.test(String(payee.constitution || '')) || /^\d{5}[A-Z]{2}[A-Z]{4}\d[A-Z]/.test(String(payee.gstin || ''));
  const kind = String(opts.paymentKind || '').toLowerCase();
  const code = act === '2025'
    ? (kind === 'contractor' ? (isCompany ? '393-6i-oth' : '393-6i-ind')
      : kind === 'commission' ? '393-1ii'
      : kind === 'professional' ? '393-6iii-prof'
      : kind === 'technical' ? '393-6iii-tech'
      : kind === 'rent' ? '393-2ii-lb'
      : kind === 'goods' ? '393-8ii'
      : kind === 'partner' ? '393-7'
      : null)
    : (kind === 'contractor' ? (isCompany ? '194C-co' : '194C')
      : kind === 'commission' ? '194H'
      : kind === 'professional' ? '194J'
      : kind === 'technical' ? '194J-tech'
      : kind === 'rent' ? '194I'
      : kind === 'goods' ? '194Q'
      : kind === 'partner' ? '195'
      : null);
  if (!code) return null;
  const section = list.find((s) => s.code === code);
  if (!section) return null;
  // Higher TDS rate when the payee has no PAN (20% under both Acts) — the
  // software cannot apply it automatically without a PAN, so it is a warning.
  const rate = hasPan ? section.rate : (section.rate > 0 ? 20 : section.rate);
  return { section: code, rate, base: r2(Number(taxable) || 0), amount: r2((Number(taxable) || 0) * rate / 100), act, panMissing: !hasPan && rate > section.rate };
};

// v1.10.86 (#180 part 2) — work out which TCS provision applies on a sale.
export const suggestTcs = (payee = {}, invoiceValue, invoiceDate, opts = {}) => {
  const act = underNewAct(invoiceDate) ? '2025' : '1961';
  const list = act === '2025' ? TCS_SECTIONS_2025 : TCS_SECTIONS;
  const kind = String(opts.transactionKind || '').toLowerCase();
  const code = act === '2025'
    ? (kind === 'liquor' ? '394-1'
      : kind === 'tendu' ? '394-2'
      : kind === 'timber' ? '394-3'
      : kind === 'scrap' ? '394-4'
      : kind === 'coal' ? '394-5'
      : kind === 'motor-vehicle' ? '394-6'
      : kind === 'lrs-edu' ? '394-7'
      : kind === 'lrs-other' ? '394-8'
      : kind === 'tour' ? '394-10'
      : kind === 'parking' ? '394-9'
      : null)
    : null;
  if (!code) return null;
  const section = list.find((s) => s.code === code);
  if (!section) return null;
  // TCS is worked out on the gross invoice value, GST included (CBDT Circular
  // 17/2020), except CGST section 52, which is on the net taxable value.
  const base = code === '52' ? r2(Number(invoiceValue?.taxable) || 0) : r2(Number(invoiceValue?.gross) || 0);
  return { section: code, rate: section.rate, base, amount: r2(base * section.rate / 100), act };
};

// A client paid less because they deducted TDS the invoice did not show: the
// invoice takes the TDS (section, rate on the value before GST), so it is owed
// only the Net Receivable and can become Paid. Returns a new bill.
export const withClientTds = (bill, { section = '194J', rate = 0 } = {}) => {
  const data = bill?.data || {};
  const totals = data.totals || {};
  const tdsAmount = r2(taxableOf(bill) * (Number(rate) || 0) / 100);
  return {
    ...bill,
    data: {
      ...data,
      // tdsRecorded keeps this amount when the invoice is saved again (computeInvoiceTotals).
      invoiceOptions: { ...(data.invoiceOptions || {}), showTDS: tdsAmount > 0, tdsSection: section, tdsRate: Number(rate) || 0,
        tdsRecorded: { section, rate: Number(rate) || 0, amount: tdsAmount } },
      totals: { ...totals, tdsAmount, netReceivable: r2((Number(totals.total) || 0) - tdsAmount) },
    },
  };
};
