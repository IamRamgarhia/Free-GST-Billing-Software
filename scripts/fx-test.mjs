// v1.10.83 - foreign-currency invoices in rupees, currency for a client,
// service units first, freelancer invoice defaults, GSTR-3B zero-rated
// supplies (exports + SEZ) and TDS recorded with a payment.
//
// Run: `node scripts/fx-test.mjs`

import { computeInvoiceTotals, splitLineTax, filterUnitsByMode, BUILTIN_UNITS, formatExchangeRateLine } from '../src/utils.js';
import { billCurrency, billRate, billInInr, billsInInr, currencyForClient, isForeignClient, baseCurrencyOf, toBase, currencyCountryMismatch } from '../src/utils/fx.js';
import { invoiceDefaultsForType } from '../src/utils/businessTypes.js';
import { zeroRatedTotals, withoutZeroRated } from '../src/utils/lut.js';
import { withClientTds, salesTaxRows } from '../src/utils/tdsTcs.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; console.log(`  ok ${label}`); }
  else { failed++; console.log(`  FAIL ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
}

// The demo business only: DiceCodes, Karnataka.
const profile = { businessName: 'DiceCodes', country: 'India', state: 'Karnataka', gstin: '29ABCDE1234F1ZW' };
const usClient = { name: 'Acme Inc', country: 'United States' };
const items = [{ id: '1', name: 'Design work', hsn: '998391', quantity: 10, unit: 'Hrs', rate: 50, discount: 20, taxPercent: 18 }];
const usdBill = (invoiceOptions = {}) => {
  const totals = computeInvoiceTotals({ items, profile, client: usClient, details: { invoiceDate: '2026-10-29' }, showGST: true, invoiceOptions });
  return {
    id: 'EXP-1', invoiceNumber: 'EXP-1', invoiceDate: '2026-10-29', invoiceType: 'tax-invoice', currency: 'USD',
    totalAmount: totals.total, totalTaxAmount: totals.totalTaxAmount, paidAmount: 100, payments: [{ amount: 100 }], status: 'partial',
    data: { profile, client: usClient, items, totals, invoiceOptions: { currency: 'USD', exchangeRate: '84', ...invoiceOptions } },
  };
};

console.log('\n[FX] Rate and currency of a saved invoice');
{
  const b = usdBill();
  eq([billCurrency(b), billRate(b)], ['USD', 84], 'USD invoice at its own rate');
  eq(billRate({ ...b, data: { ...b.data, invoiceOptions: { currency: 'USD', exchangeRate: '' } } }), 0, 'No rate = 0');
  eq(billRate({ currency: 'INR' }), 1, 'Rupee invoice = 1');
  eq(billCurrency({ data: { invoiceOptions: { currency: 'EUR' } } }), 'EUR', 'Older bills: currency from the options');
  eq([toBase(10, 84.5), toBase(10, 0)], [845, null], 'toBase, null without a rate');
}

console.log('\n[FX] An invoice in rupees');
{
  const b = usdBill();
  const inr = billInInr(b);
  eq([b.totalAmount, inr.totalAmount], [566.4, 47577.6], 'Total 566.40 USD = 47,577.60 INR');
  eq([inr.data.totals.taxableAmount, inr.data.totals.igst, inr.paidAmount, inr.payments[0].amount], [40320, 7257.6, 8400, 8400], 'Taxable, IGST, paid and payments in rupees');
  eq([inr.currency, inr.data.invoiceOptions.currency, inr.fxFrom], ['INR', 'INR', { currency: 'USD', rate: 84 }], 'Marked as converted from USD @ 84');
  const line = splitLineTax(inr.data.items[0], true);
  eq([Math.round(line.taxable * 100) / 100, line.igst], [40320, 7257.6], 'Line split in rupees matches the totals (rate and fixed discount converted)');
  eq(b.data.items[0].rate, 50, 'The original bill is not changed');
  eq(billInInr({ currency: 'INR', totalAmount: 5 }).totalAmount, 5, 'A rupee bill comes back as it is');
  const noRate = { ...b, data: { ...b.data, invoiceOptions: { currency: 'USD' } } };
  eq(billInInr(noRate), null, 'No rate: cannot convert');
  const { bills, missing } = billsInInr([b, noRate, { currency: 'INR', totalAmount: 1 }]);
  eq([bills.length, missing.length], [2, 1], 'billsInInr lists the one without a rate');
  const pct = billInInr({ ...b, data: { ...b.data, items: [{ ...items[0], discount: 10, discountType: 'percent' }] } });
  eq(pct.data.items[0].discount, 10, 'A percent discount is not converted');
}

console.log('\n[FX] Currency for a client');
{
  eq(currencyForClient({ country: 'India' }, profile), 'INR', 'Indian client: rupees (not the last invoice\'s USD)');
  eq(currencyForClient({ country: 'United Kingdom' }, profile), 'GBP', 'UK client: pounds');
  eq(currencyForClient({ country: 'Other' }, profile, { lastForeign: 'EUR' }), 'EUR', '"Other" country: the last foreign currency used');
  eq(currencyForClient({ country: 'Other' }, profile), 'USD', '"Other" with none used yet: USD');
  eq(currencyForClient({ country: 'India' }, profile, { preferred: 'USD' }), 'USD', 'The client\'s saved currency wins');
  eq(currencyForClient({ country: 'United Arab Emirates' }, { country: 'United Arab Emirates' }), 'AED', 'A UAE business: its own currency');
  eq([isForeignClient({ country: '' }, profile), isForeignClient(usClient, profile)], [false, true], 'No country = home country');
  eq(baseCurrencyOf({}), 'INR', 'Base currency defaults to INR');
  eq(formatExchangeRateLine('USD', '84', 'INR', 100), '1 USD = 84.0000 INR · Total ₹8,400.00', 'Rate line with the rupee total');
  eq(formatExchangeRateLine('USD', '84', 'INR'), '1 USD = 84.0000 INR', 'Rate line alone');
}

console.log('\n[Units] Services mode and freelancer defaults');
{
  eq(filterUnitsByMode(BUILTIN_UNITS, 'services').slice(0, 5).map(u => u.label), ['Hrs', 'Day', 'Month', 'Project', 'Nos'], 'Service units first');
  eq(filterUnitsByMode(BUILTIN_UNITS, 'goods')[0].label, 'Pcs', 'Goods order unchanged');
  eq(invoiceDefaultsForType('freelancer'), { invoiceMode: 'services', showItemUnit: false }, 'Freelancer: Services mode, no unit');
  eq(invoiceDefaultsForType('retail_shop'), {}, 'Other types leave invoice defaults alone');
}

console.log('\n[GSTR-3B] Zero-rated supplies: exports and SEZ in 3.1(b)');
{
  const isExport = (b) => b.kind === 'export';
  const bill = (kind, taxable, igst, extra = {}) => ({ kind, invoiceType: 'tax-invoice', data: { client: { isSEZ: kind === 'sez' }, totals: { taxableAmount: taxable, igst, cess: 0 } }, ...extra });
  const bills = [
    bill('domestic', 1000, 180),
    bill('export', 5000, 0),
    bill('sez', 2000, 360),
    bill('sez', 500, 90, { invoiceType: 'credit-note' }),
  ];
  const z = zeroRatedTotals(bills, isExport);
  eq(z.zero, { taxable: 6500, igst: 270, cess: 0 }, '3.1(b) = export + SEZ - SEZ credit note');
  eq(z.inDomestic, { taxable: 1500, igst: 270, cess: 0 }, 'Part already inside the B2B totals: SEZ sale less its credit note');
  // The domestic total as the GST screen builds it: B2B (domestic + SEZ) less every credit note.
  const domestic = { taxable: 1000 + 2000 - 500, cgst: 0, sgst: 0, igst: 180 + 360 - 90, cess: 0 };
  const a = withoutZeroRated(domestic, z.inDomestic);
  eq([a.taxable, a.igst], [1000, 180], '3.1(a) keeps only the domestic sale');
  eq(Math.round((a.igst + z.zero.igst) * 100) / 100, 450, 'Tax payable unchanged: IGST on the SEZ supply still counts');
}

console.log('\n[TDS] Recorded with a payment, kept on save');
{
  const inv = { invoiceDate: '2026-10-29', invoiceType: 'tax-invoice', totalAmount: 118000, data: { totals: { taxableAmount: 100000, total: 118000 }, invoiceOptions: {} } };
  const withTds = withClientTds(inv, { section: '194Q', rate: 0.1 });
  eq(withTds.data.invoiceOptions.tdsRecorded, { section: '194Q', rate: 0.1, amount: 100 }, 'The recorded TDS is kept on the invoice');
  const indiaClient = { country: 'India', state: 'Karnataka' };
  const recompute = (opts) => computeInvoiceTotals({ items: [{ quantity: 1, rate: 100000, taxPercent: 18 }], profile, client: indiaClient, details: {}, showGST: true, invoiceOptions: opts }).tdsAmount;
  eq(recompute({ ...withTds.data.invoiceOptions, tdsCumulativeThisYear: 0 }), 100, '194Q below ₹50L: still the TDS the client deducted');
  eq(recompute({ ...withTds.data.invoiceOptions, tdsRecorded: undefined, tdsCumulativeThisYear: 0 }), 0, 'Without it the ₹50L threshold made it 0');
  eq(recompute({ ...withTds.data.invoiceOptions, tdsRate: 2, tdsSection: '194Q', tdsCumulativeThisYear: 6000000 }), 2000, 'Changing the rate works it out again');
}

console.log('\n[TDS] Report rows in rupees');
{
  const b = usdBill({ showTDS: true, tdsSection: '194J', tdsRate: 10 });
  const rows = salesTaxRows([b], 'tds');
  eq([rows[0].taxable, rows[0].amount], [40320, 4032], 'A USD invoice\'s TDS in rupees');
  const noRate = { ...b, data: { ...b.data, invoiceOptions: { ...b.data.invoiceOptions, exchangeRate: '' } } };
  eq(salesTaxRows([noRate], 'tds')[0].fxMissing, true, 'No rate: marked');
}

console.log('\n[ERR-069] A foreign currency for a client saved in India is pointed out');
{
  const profile = { country: 'India' };
  const m = (currency, client) => currencyCountryMismatch({ currency, client, profile });
  eq(m('USD', { name: 'GTB Pro Cleaning', country: 'India' }), true, 'USD + client saved in India: warn (billed as domestic, no LUT)');
  eq(m('USD', { name: 'No country' }), true, 'USD + client with no country: warn');
  eq(m('USD', { country: 'Canada' }), false, 'USD + client in Canada: an export, no warning');
  eq(m('USD', { country: 'India', isSEZ: true }), false, 'USD + SEZ client: no warning');
  eq(m('INR', { country: 'India' }), false, 'INR: nothing to say');
  eq(m('', { country: 'India' }), false, 'no currency chosen means INR');
  eq(currencyCountryMismatch({ currency: 'USD', client: { country: 'United States' }, profile: { country: 'United States' } }), false, 'a business outside India is never warned');
}

console.log('\n────────────────────────────────────────');
console.log(`Passed: ${passed}   Failed: ${failed}`);
if (failed) process.exit(1);
