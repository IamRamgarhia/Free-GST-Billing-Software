// v1.10.83 - invoices in a foreign currency (an export billed in USD, EUR...).
//
// GST returns, income tax and "all in rupees" totals must be in rupees. Each
// invoice is converted at the exchange rate saved ON IT
// (invoiceOptions.exchangeRate: 1 unit = ? INR), never at today's rate, so a
// return filed last month gives the same figures today. An invoice in a
// foreign currency with no rate cannot be converted: callers list it so the
// user can open it and add the rate. Pure; tested in scripts/fx-test.mjs.

import { getCountryConfig } from '../utils.js';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const billCurrency = (b) => b?.currency || b?.data?.invoiceOptions?.currency || 'INR';

// The currency a business keeps its books in: rupees for an Indian business.
export const baseCurrencyOf = (profile) => getCountryConfig(profile?.country || 'India').currency;

// 1 unit of the invoice currency in the base currency: 1 for a base-currency
// invoice, 0 when a foreign-currency invoice has no usable rate.
export const billRate = (b, base = 'INR') => {
  if (billCurrency(b) === base) return 1;
  const rate = Number(b?.data?.invoiceOptions?.exchangeRate);
  return isFinite(rate) && rate > 0 ? rate : 0;
};

// Amounts on an invoice's totals (the rest are flags, percentages and text).
const TOTAL_KEYS = ['subtotal', 'totalDiscount', 'taxableAmount', 'cgst', 'sgst', 'utgst', 'igst', 'cess',
  'tcsAmount', 'tdsAmount', 'roundOff', 'invoiceDiscountAmount', 'total', 'netReceivable', 'totalTaxAmount',
  'rcmTaxCgst', 'rcmTaxSgst', 'rcmTaxUtgst', 'rcmTaxIgst', 'rcmTaxTotal'];
const LINE_KEYS = ['rate', 'disc', 'gross', 'afterDisc', 'taxable', 'tax', 'cess'];

const scaleKeys = (obj, keys, rate, round = r2) => {
  if (!obj) return obj;
  const out = { ...obj };
  for (const k of keys) if (typeof out[k] === 'number') out[k] = round(out[k] * rate);
  return out;
};

// A copy of the invoice with every amount in the base currency, or the bill
// itself when it is already in it. null when there is no rate to use.
// Line rates are not rounded, so qty x rate still adds up to the line value.
export const billInInr = (bill, base = 'INR') => {
  if (!bill || billCurrency(bill) === base) return bill;
  const rate = billRate(bill, base);
  if (!rate) return null;
  const data = bill.data || {};
  const totals = data.totals ? scaleKeys(data.totals, TOTAL_KEYS, rate) : data.totals;
  if (totals?.lines) totals.lines = totals.lines.map((l) => scaleKeys(l, LINE_KEYS, rate, (n) => n));
  if (totals && totals.invoiceDiscountType !== 'percent' && typeof totals.invoiceDiscountValue === 'number') {
    totals.invoiceDiscountValue = r2(totals.invoiceDiscountValue * rate);
  }
  const items = (data.items || []).map((it) => ({
    ...it,
    rate: (Number(it.rate) || 0) * rate,
    ...(it.discountType === 'percent' ? {} : { discount: (Number(it.discount) || 0) * rate }),
  }));
  return {
    ...bill,
    currency: base,
    totalAmount: r2((Number(bill.totalAmount) || 0) * rate),
    totalTaxAmount: r2((Number(bill.totalTaxAmount) || 0) * rate),
    paidAmount: r2((Number(bill.paidAmount) || 0) * rate),
    payments: (bill.payments || []).map((p) => ({ ...p, amount: r2((Number(p.amount) || 0) * rate) })),
    fxFrom: { currency: billCurrency(bill), rate },
    data: { ...data, items, totals, invoiceOptions: { ...(data.invoiceOptions || {}), currency: base } },
  };
};

// Every bill in the base currency: { bills, missing }. A bill with no rate is
// left out of `bills` and listed in `missing`.
export const billsInInr = (bills, base = 'INR') => (bills || []).reduce((acc, b) => {
  const c = billInInr(b, base);
  if (c) acc.bills.push(c); else acc.missing.push(b);
  return acc;
}, { bills: [], missing: [] });

// Is the client outside the business's country?
export const isForeignClient = (client, profile) => {
  const country = String(client?.country || '').trim();
  return !!country && country !== (profile?.country || 'India');
};

// ERR-069 - billing in a foreign currency while the client is saved in India
// (and is not an SEZ): the invoice is domestic, with no LUT, whatever the
// currency. The invoice screen warns and offers to set the client's country.
// An Indian client can pay in dollars, so the country is never guessed.
export const currencyCountryMismatch = ({ currency, client, profile }) => {
  const base = baseCurrencyOf(profile);
  return base === 'INR' && (currency || base) !== base && !isForeignClient(client, profile) && !client?.isSEZ;
};

// The currency a new invoice for this client starts in: the client's saved
// choice, else for a client abroad their own country's currency (or the last
// foreign currency used, for "Other"), else the business's own currency.
export const currencyForClient = (client, profile, { preferred = '', lastForeign = '' } = {}) => {
  if (preferred) return preferred;
  const base = baseCurrencyOf(profile);
  if (!isForeignClient(client, profile)) return base;
  const cc = getCountryConfig(client.country);
  if (cc.code !== 'XX' && cc.currency !== base) return cc.currency;
  return lastForeign && lastForeign !== base ? lastForeign : 'USD';
};

// The amount in the base currency, or null without a rate.
export const toBase = (amount, rate) => (Number(rate) > 0 ? r2((Number(amount) || 0) * Number(rate)) : null);
