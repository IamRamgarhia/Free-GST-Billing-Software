// v1.10.83 - exports / SEZ under a LUT (no IGST, the Rule 46 declaration) and
// the TDS & TCS report (client TDS, TCS, TDS on purchase bills).
//
// Run: `node scripts/lut-tds-test.mjs`

import { computeInvoiceTotals, generateEWayBillJSON, amountDue, paymentStatusFor, TCS_SECTIONS, TDS_SECTIONS, TDS_SECTIONS_2025, TCS_SECTIONS_2025, tdsSectionsFor, tcsSectionsFor, newActCode, sectionShort, sectionPrint, sectionOptionLabel, movedSection, withNewActSections } from '../src/utils.js';
import { fyOf, isLikelyLutArn, normaliseLutArn, lutCoversDate, isExportOrSez, exportDeclaration, lutFyOptions, LUT_DECLARATION, IGST_PAID_DECLARATION } from '../src/utils/lut.js';
import { quarterOf, fyQuarterRange, inRange, panFromGstin, salesTaxRows, purchaseTdsAmount, paidToSupplier, purchaseTdsRows, totalsBy, withClientTds, suggestTds, suggestTcs } from '../src/utils/tdsTcs.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; console.log(`  ok ${label}`); }
  else { failed++; console.log(`  FAIL ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
}

// The demo business only: DiceCodes, Karnataka.
const profile = { businessName: 'DiceCodes', country: 'India', state: 'Karnataka', gstin: '29ABCDE1234F1ZW', pin: '560001', lutArn: 'AD290426123456X', lutFy: '2026-27' };
const usClient = { name: 'Acme Inc', country: 'United States', state: '' };
const sezClient = { name: 'SEZ Unit', country: 'India', state: 'Karnataka', gstin: '29AAACS1234A1Z5', isSEZ: true, pin: '560100' };
const items = [{ name: 'Software services', hsn: '998314', quantity: 1, rate: 100000, taxPercent: 18 }];
const totalsFor = (client, invoiceOptions = {}, extra = {}) => computeInvoiceTotals({ items, profile, client, details: { invoiceDate: '2026-10-29' }, showGST: true, invoiceOptions, ...extra });

console.log('\n[LUT] Financial year and ARN');
{
  eq([fyOf('2026-04-01'), fyOf('2027-03-31'), fyOf('2026-03-31'), fyOf('')], ['2026-27', '2026-27', '2025-26', ''], 'A financial year runs April to March');
  eq(fyOf('2099-12-01'), '2099-00', 'The year after 2099 wraps to 00');
  eq([isLikelyLutArn('AD290426123456X'), isLikelyLutArn('ad29 0426 123456x'), isLikelyLutArn('AD29'), isLikelyLutArn('AD29-0426-1234-56X!')], [true, true, false, false], 'An ARN is 15 letters and digits (spaces and case forgiven)');
  eq(normaliseLutArn(' ad29-0426 123456x '), 'AD290426123456X', 'ARN is stored upper case without spaces');
  eq(lutFyOptions(new Date(2026, 9, 29)), ['2027-28', '2026-27', '2025-26', '2024-25'], 'Settings offers next year, this year and two before');
  eq([lutCoversDate(profile, '2026-10-29'), lutCoversDate(profile, '2027-04-02'), lutCoversDate({ lutFy: '2026-27' }, '2026-10-29')], [true, false, false], 'A LUT covers only its own year, and needs an ARN');
}

console.log('\n[LUT] Which supplies qualify');
{
  eq(isExportOrSez({ profile, client: usClient, details: {} }), true, 'Client abroad = export');
  eq(isExportOrSez({ profile, client: sezClient, details: {} }), true, 'SEZ client qualifies even in the same state');
  eq(isExportOrSez({ profile, client: { country: 'India', state: 'Kerala' }, details: {} }), false, 'Ordinary Indian client does not');
  eq(isExportOrSez({ profile, client: usClient, details: { placeOfSupply: 'Karnataka' } }), false, 'Foreign buyer with an Indian place of supply is not an export');
  eq(isExportOrSez({ profile: { ...profile, country: 'United Arab Emirates' }, client: usClient, details: {} }), false, 'Only an Indian business');
}

console.log('\n[LUT] Tax on the invoice');
{
  const paid = totalsFor(usClient);
  eq([paid.igst, paid.total, paid.lutZeroRated], [18000, 118000, false], 'Export without LUT charges IGST');
  const lut = totalsFor(usClient, { isLUT: true });
  eq([lut.igst, lut.cgst, lut.totalTaxAmount, lut.total, lut.lutZeroRated, lut.lines[0].tax, lut.lines[0].taxPct], [0, 0, 0, 100000, true, 0, 18], 'Export under LUT: no IGST, the line keeps its 18% rate');
  const sez = totalsFor(sezClient, { isLUT: true });
  eq([sez.igst, sez.total, sez.isInterstate, sez.lutZeroRated], [0, 100000, true, true], 'SEZ under LUT: no IGST, still inter-state');
  const sezPaid = totalsFor(sezClient);
  eq([sezPaid.igst, sezPaid.cgst], [18000, 0], 'SEZ with payment: IGST, never CGST + SGST');
  const domestic = totalsFor({ country: 'India', state: 'Kerala' }, { isLUT: true });
  eq([domestic.igst, domestic.lutZeroRated], [18000, false], 'A stray LUT flag on a domestic sale changes nothing');
  const rcm = totalsFor(sezClient, { isLUT: true, reverseCharge: true });
  eq(rcm.lutZeroRated, false, 'Never zero-rated together with reverse charge');
  const incl = totalsFor(usClient, { isLUT: true }, { taxInclusive: true });
  eq([incl.taxableAmount, incl.total, incl.taxInclusive], [100000, 100000, false], 'Tax-inclusive prices under LUT have no tax to back out');
  const cess = computeInvoiceTotals({ items: [{ ...items[0], cessPercent: 12 }], profile, client: usClient, details: {}, showGST: true, invoiceOptions: { isLUT: true } });
  eq([cess.cess, cess.total], [0, 100000], 'No cess under LUT either');
  const bos = totalsFor(usClient, { isLUT: true }, { showGST: false });
  eq(bos.lutZeroRated, false, 'A bill of supply is not marked zero-rated');
}

console.log('\n[LUT] Rule 46 declaration');
{
  const lut = totalsFor(usClient, { isLUT: true });
  eq(exportDeclaration({ profile, client: usClient, details: {}, totals: lut, options: { lutArn: 'AD290426123456X', lutFy: '2026-27' } }),
    `${LUT_DECLARATION} - LUT ARN AD290426123456X (FY 2026-27)`, 'Under LUT: the declaration with the ARN and year');
  eq(exportDeclaration({ profile, client: sezClient, details: {}, totals: lut, options: {} }), LUT_DECLARATION, 'Under LUT without a saved ARN: the declaration alone');
  eq(exportDeclaration({ profile, client: usClient, details: {}, totals: totalsFor(usClient), options: {} }), IGST_PAID_DECLARATION, 'With payment of IGST: the other Rule 46 wording');
  eq(exportDeclaration({ profile, client: { country: 'India' }, details: {}, totals: lut, options: {} }), '', 'A domestic invoice prints nothing');
  eq(exportDeclaration({ profile, client: usClient, details: {}, totals: lut, options: {}, showGST: false }), '', 'Nor does one without GST');
  eq(LUT_DECLARATION.startsWith('SUPPLY MEANT FOR EXPORT/SUPPLY TO SEZ UNIT OR SEZ DEVELOPER'), true, 'Rule 46 wording kept exactly');
}

console.log('\n[LUT] E-Way Bill');
{
  const t = totalsFor(sezClient, { isLUT: true });
  const ewb = generateEWayBillJSON(profile, sezClient, { invoiceNumber: 'INV-1', invoiceDate: '2026-10-29' }, items, t, 'tax-invoice', {});
  eq([ewb.billLists[0].itemList[0].igstRate, ewb.billLists[0].itemList[0].taxableAmount], [0, 100000], 'Rates are 0 under LUT');
  let msg = '';
  try { generateEWayBillJSON({ ...profile, pin: '' }, sezClient, {}, items, t, 'tax-invoice', {}); } catch (e) { msg = e.message; }
  eq(msg.includes('Settings → Company'), true, 'A missing business PIN says where to fill it');
  try { generateEWayBillJSON(profile, { ...sezClient, pin: '' }, {}, items, t, 'tax-invoice', {}); } catch (e) { msg = e.message; }
  eq(msg.includes('Billed To'), true, "A missing client PIN says where to fill it");
}

console.log('\n[TCS] Section 52 rate');
eq(TCS_SECTIONS.find((s) => s.code === '52').rate, 0.5, 'CGST section 52 is 0.5% since 10 July 2024');

console.log('\n[TDS & TCS] Periods');
{
  eq(['2026-04-15', '2026-09-30', '2026-10-01', '2027-03-31', ''].map(quarterOf), ['Q1', 'Q2', 'Q3', 'Q4', ''], 'Financial-year quarters');
  eq([fyQuarterRange('2026-2027'), fyQuarterRange('2026-2027', 'Q4')], [{ from: '2026-04-01', to: '2027-03-31' }, { from: '2027-01-01', to: '2027-03-31' }], 'Whole year and Q4 dates');
  eq([inRange('2026-05-01', { from: '2026-04-01', to: '2026-06-30' }), inRange('2026-07-01', { from: '2026-04-01', to: '2026-06-30' }), inRange('2026-07-01', {}), inRange('', {})], [true, false, true, false], 'Both days included; no range = everything dated');
  eq([panFromGstin('29ABCDE1234F1ZW'), panFromGstin('URP'), panFromGstin('')], ['ABCDE1234F', '', ''], 'PAN read from the GSTIN');
}

console.log('\n[TDS & TCS] Sales');
{
  const bill = (id, date, opts, totals, extra = {}) => ({ id, invoiceNumber: id, invoiceDate: date, invoiceType: 'tax-invoice', totalAmount: totals.total, ...extra,
    data: { client: { name: extra.client || 'Ramesh Traders', gstin: '29ABCDE1234F1ZW' }, invoiceOptions: opts, totals } });
  const bills = [
    bill('INV-1', '2026-05-10', { showTDS: true, tdsSection: '194J', tdsRate: 10 }, { taxableAmount: 100000, total: 118000, tdsAmount: 10000 }, { tdsCertificate: true }),
    bill('INV-2', '2026-11-02', { showTDS: true, tdsSection: '194C-co', tdsRate: 2 }, { taxableAmount: 50000, total: 59000, tdsAmount: 1000 }, { client: 'Suresh & Co' }),
    bill('INV-3', '2026-06-01', { showTCS: true, tcsSection: '52', tcsRate: 0.5 }, { taxableAmount: 20000, total: 23700, tcsAmount: 100 }),
    bill('INV-4', '2026-06-02', { showTDS: true, tdsRate: 10 }, { taxableAmount: 10000, total: 11800, tdsAmount: 1000 }, { status: 'cancelled' }),
    bill('QUO-1', '2026-06-03', { showTDS: true, tdsRate: 10 }, { taxableAmount: 10000, total: 11800, tdsAmount: 1000 }, { invoiceType: 'quotation' }),
    bill('INV-5', '2026-06-04', {}, { taxableAmount: 10000, total: 11800 }),
  ];
  const tds = salesTaxRows(bills, 'tds');
  eq(tds.map((r) => [r.invoiceNumber, r.section, r.amount, r.certificate, r.quarter, r.pan]), [['INV-1', '194J', 10000, true, 'Q1', 'ABCDE1234F'], ['INV-2', '194C', 1000, false, 'Q3', 'ABCDE1234F']], 'Only sales with TDS; cancelled and quotations left out');
  eq(salesTaxRows(bills, 'tds', fyQuarterRange('2026', 'Q1')).length, 1, 'Quarter filter');
  eq(salesTaxRows(bills, 'tcs').map((r) => [r.invoiceNumber, r.section, r.amount, r.taxable]), [['INV-3', 'CGST 52', 100, 20000]], 'TCS collected (GST TCS shown as CGST 52)');
  eq(totalsBy(tds, (r) => r.party), [{ key: 'Ramesh Traders', count: 1, taxable: 100000, amount: 10000 }, { key: 'Suresh & Co', count: 1, taxable: 50000, amount: 1000 }], 'Totals by client');
}

console.log('\n[TDS] Recorded with a payment');
{
  const bill = { id: 'INV-9', totalAmount: 118000, paidAmount: 108000, invoiceType: 'tax-invoice', data: { invoiceOptions: {}, totals: { taxableAmount: 100000, total: 118000, tdsAmount: 0 } } };
  eq([amountDue(bill), paymentStatusFor(bill, 108000)], [118000, 'partial'], 'Without TDS the short payment is Partial');
  const withTds = withClientTds(bill, { section: '194J', rate: 10 });
  eq([withTds.data.totals.tdsAmount, withTds.data.totals.netReceivable, withTds.data.invoiceOptions.showTDS, withTds.data.invoiceOptions.tdsSection], [10000, 108000, true, '194J'], 'TDS on the value before GST goes on the invoice');
  eq([amountDue(withTds), paymentStatusFor(withTds, 108000)], [108000, 'paid'], 'With the TDS recorded the invoice is Paid');
  eq(bill.data.totals.tdsAmount, 0, 'The original bill is not changed');
}

console.log('\n[TDS] Purchase bills');
{
  eq([purchaseTdsAmount(50000, 2), purchaseTdsAmount(50000, 2, '999.5'), purchaseTdsAmount(50000, 2, ''), purchaseTdsAmount(50000, 'x')], [1000, 999.5, 1000, 0], 'Rate on the value before GST, or the amount typed in');
  const p = { id: 'p1', kind: 'bill', date: '2026-08-05', invoiceNumber: 'S-77', supplierName: 'Builder', supplierGstin: '29AAACB1234C1Z5', taxableAmount: 50000, totalAmount: 59000, tdsSection: '194C-co', tdsRate: 2, tdsAmount: 1000 };
  eq(paidToSupplier(p), 58000, 'Paid to supplier = total less TDS');
  const rows = purchaseTdsRows([p, { ...p, id: 'p2', tdsAmount: 0 }, { ...p, id: 'po', kind: 'po' }]);
  eq(rows.map((r) => [r.invoiceNumber, r.section, r.amount, r.paid, r.quarter, r.pan]), [['S-77', '194C', 1000, 58000, 'Q2', 'AAACB1234C']], 'Only bills with TDS; purchase orders left out');
  eq(totalsBy(rows, (r) => r.section), [{ key: '194C', count: 1, taxable: 50000, amount: 1000 }], 'Totals by section');
}

console.log('\n[#180] TDS / TCS under the Income-tax Act, 2025 (from 1 April 2026)');
{
  eq([tdsSectionsFor('2026-03-31') === TDS_SECTIONS, tdsSectionsFor('2026-04-01') === TDS_SECTIONS_2025, tcsSectionsFor('2026-11-07') === TCS_SECTIONS_2025],
    [true, true, true], 'up to 31 March 2026 the 1961 sections, from 1 April 2026 the 2025 Act');
  const r = (code, list = TDS_SECTIONS_2025) => list.find((s) => s.code === code)?.rate;
  eq([r('393-6i-ind'), r('393-6i-oth'), r('393-1ii'), r('393-2ii-pm'), r('393-2ii-lb'), r('393-6iii-prof'), r('393-6iii-tech'), r('393-8ii'), r('393-8v')],
    [1, 2, 2, 2, 10, 10, 2, 0.1, 0.1], 'TDS rates: contractor 1/2, commission 2, rent 2/10, fees 10/2, goods 0.1, e-commerce 0.1');
  eq([r('394-1', TCS_SECTIONS_2025), r('394-2', TCS_SECTIONS_2025), r('394-4', TCS_SECTIONS_2025), r('394-5', TCS_SECTIONS_2025), r('394-6', TCS_SECTIONS_2025), r('52', TCS_SECTIONS_2025)],
    [2, 2, 2, 2, 1, 0.5], 'TCS rates from the Finance Act 2026: liquor, tendu, scrap, coal 2%; motor vehicle 1%; GST TCS 0.5%');
  eq(TCS_SECTIONS_2025.some((s) => s.code === '206C(1H)'), false, 'TCS on sale of goods (old 206C(1H)) has no place in section 394');
  eq([newActCode('194C'), newActCode('194C-co'), newActCode('194J'), newActCode('194Q'), newActCode('206C(1)', 'tcs'), newActCode('52', 'tcs'), newActCode('custom')],
    ['393-6i-ind', '393-6i-oth', '393-6iii-prof', '393-8ii', null, '52', 'custom'], 'a 1961 section moves to its 2025 place (206C(1) "varies": not guessed)');
  eq([sectionShort('393-6i-oth'), sectionShort('394-4'), sectionShort('194C-co'), sectionShort('52')], ['393(1) Sl. 6(i)', '394(1) Sl. 4', '194C', 'CGST 52'], 'what is printed for a section');
  eq([sectionPrint('393-6iii-prof', 10), sectionPrint('custom', 3), sectionPrint('', 1)], [' (393(1) Sl. 6(iii) @ 10%)', ' (@ 3%)', ''], 'TDS / TCS line on the invoice');
  // (review) a typed rate, e.g. a lower-deduction certificate, is kept.
  eq([movedSection('194J', 10), movedSection('194J', 5), movedSection('194H', 5), movedSection('194H', 3.5), movedSection('393-8ii', 0.1), movedSection('206C(1)', 1, 'tcs')],
    [{ section: '393-6iii-prof', rate: 10 }, { section: '393-6iii-prof', rate: 5 }, { section: '393-1ii', rate: 2 }, { section: '393-1ii', rate: 3.5 }, null, null],
    'moving a section: the usual rate follows it (194H old 5% too), a typed 5% or 3.5% stays');
  eq([withNewActSections({ showTDS: true, tdsSection: '194C', tdsRate: 1 }, '2026-11-07').tdsSection, withNewActSections({ tdsSection: '194C', tdsRate: 1 }, '2026-03-31').tdsSection],
    ['393-6i-ind', '194C'], 'a recurring invoice from an old template: the 2025 section from 1 April 2026, the old one before');
  eq(sectionOptionLabel('194J'), '194J — Professional / technical services (Income-tax Act, 1961)', 'a saved 1961 section is named as such');
  // The ₹50 lakh threshold of 194Q holds for its 2025 place, Sl. 8(ii).
  const goods = (section, cum) => computeInvoiceTotals({ items: [{ name: 'Steel', hsn: '7208', quantity: 1, rate: 1000000, taxPercent: 18 }], profile, client: { name: 'Buyer', state: 'Karnataka', country: 'India' }, details: { invoiceDate: '2026-11-07' }, showGST: true,
    invoiceOptions: { showTDS: true, tdsSection: section, tdsRate: 0.1, tdsCumulativeThisYear: cum } }).tdsAmount;
  eq([goods('393-8ii', 0), goods('393-8ii', 4500000), goods('194Q', 4500000)], [0, 500, 500], 'Sl. 8(ii): nothing up to ₹50 lakh a year, 0.1% on what is above (same as 194Q)');
  const fees = computeInvoiceTotals({ items, profile, client: usClient, details: { invoiceDate: '2026-11-07' }, showGST: false, invoiceOptions: { showTDS: true, tdsSection: '393-6iii-prof', tdsRate: 10 } }).tdsAmount;
  eq(fees, 10000, 'Sl. 6(iii) fees: 10% from the first rupee (the user ticks TDS when it applies)');
}

console.log('\n[#180 part 2] suggestTds / suggestTcs auto-suggest from payment kind and payee');
{
  // TDS: contractor, individual/HUF → 393-6i-ind (1%), company → 393-6i-oth (2%)
  const contractorInd = suggestTds({ gstin: '29AAACB1234C1Z5', constitution: 'Individual' }, 100000, '2026-10-01', { paymentKind: 'contractor' });
  eq([contractorInd?.section, contractorInd?.rate, contractorInd?.act], ['393-6i-ind', 1, '2025'], 'contractor + individual under 2025 Act → 393(1) Sl. 6(i) 1%');
  const contractorCo = suggestTds({ gstin: '29AAACB1234C1Z5', constitution: 'Private Limited' }, 100000, '2026-10-01', { paymentKind: 'contractor' });
  eq([contractorCo?.section, contractorCo?.rate, contractorCo?.act], ['393-6i-oth', 2, '2025'], 'contractor + company under 2025 Act → 393(1) Sl. 6(i) 2%');
  const contractorOld = suggestTds({ gstin: '29AAACB1234C1Z5', constitution: 'Private Limited' }, 100000, '2026-03-15', { paymentKind: 'contractor' });
  eq([contractorOld?.section, contractorOld?.rate, contractorOld?.act], ['194C-co', 2, '1961'], 'contractor + company under 1961 Act → 194C-co 2%');
  // Commission → 393-1ii (2%)
  const commission = suggestTds({ pan: 'ABCDE1234F' }, 50000, '2026-10-01', { paymentKind: 'commission' });
  eq([commission?.section, commission?.rate], ['393-1ii', 2], 'commission → 393(1) Sl. 1(ii) 2%');
  // Professional → 393-6iii-prof (10%)
  const prof = suggestTds({ pan: 'ABCDE1234F' }, 100000, '2026-10-01', { paymentKind: 'professional' });
  eq([prof?.section, prof?.rate], ['393-6iii-prof', 10], 'professional → 393(1) Sl. 6(iii) 10%');
  // Technical → 393-6iii-tech (2%)
  const tech = suggestTds({ pan: 'ABCDE1234F' }, 100000, '2026-10-01', { paymentKind: 'technical' });
  eq([tech?.section, tech?.rate], ['393-6iii-tech', 2], 'technical → 393(1) Sl. 6(iii) 2%');
  // Rent land/building → 393-2ii-lb (10%)
  const rentLb = suggestTds({ pan: 'ABCDE1234F' }, 50000, '2026-10-01', { paymentKind: 'rent' });
  eq([rentLb?.section, rentLb?.rate], ['393-2ii-lb', 10], 'rent land/building → 393(1) Sl. 2(ii) 10%');
  // Purchase of goods → 393-8ii (0.1%)
  const goods = suggestTds({ pan: 'ABCDE1234F' }, 1000000, '2026-10-01', { paymentKind: 'goods' });
  eq([goods?.section, goods?.rate], ['393-8ii', 0.1], 'purchase of goods → 393(1) Sl. 8(ii) 0.1%');
  // Partner remuneration → 393-7 (10%)
  const partner = suggestTds({ pan: 'ABCDE1234F' }, 500000, '2026-10-01', { paymentKind: 'partner' });
  eq([partner?.section, partner?.rate], ['393-7', 10], 'partner remuneration → 393(3) Sl. 7 10%');
  // No PAN → 20% higher rate warning
  const noPan = suggestTds({ constitution: 'Individual' }, 100000, '2026-10-01', { paymentKind: 'contractor' });
  eq([noPan?.rate, noPan?.panMissing], [20, true], 'no PAN → 20% higher rate with panMissing flag');
  // Unknown kind → null
  eq(suggestTds({ pan: 'ABCDE1234F' }, 100000, '2026-10-01', { paymentKind: 'unknown' }), null, 'unknown kind → null');

  // TCS: scrap → 394-4 (2%), tour → 394-10 (2% flat), LRS edu → 394-7 (2%), LRS other → 394-8 (20%)
  const scrap = suggestTcs({ pan: 'ABCDE1234F' }, { gross: 500000 }, '2026-10-01', { transactionKind: 'scrap' });
  eq([scrap?.section, scrap?.rate, scrap?.base, scrap?.amount], ['394-4', 2, 500000, 10000], 'scrap TCS → 394(1) Sl. 4 2% on gross');
  const tour = suggestTcs({ pan: 'ABCDE1234F' }, { gross: 200000 }, '2026-10-01', { transactionKind: 'tour' });
  eq([tour?.section, tour?.rate, tour?.base, tour?.amount], ['394-10', 2, 200000, 4000], 'overseas tour TCS → 394(1) Sl. 8 2% flat');
  const lrsEdu = suggestTcs({ pan: 'ABCDE1234F' }, { gross: 1200000 }, '2026-10-01', { transactionKind: 'lrs-edu' });
  eq([lrsEdu?.section, lrsEdu?.rate], ['394-7', 2], 'LRS education/medical → 394(1) Sl. 7 2%');
  const lrsOther = suggestTcs({ pan: 'ABCDE1234F' }, { gross: 1200000 }, '2026-10-01', { transactionKind: 'lrs-other' });
  eq([lrsOther?.section, lrsOther?.rate], ['394-8', 20], 'LRS other → 394(1) Sl. 7 20%');
  // CGST 52 base is taxable value, not gross — scrap under 394-4 uses gross
  const scrapBase = suggestTcs({ pan: 'ABCDE1234F' }, { taxable: 200000, gross: 236000 }, '2026-10-01', { transactionKind: 'scrap' });
  eq([scrapBase?.section, scrapBase?.base], ['394-4', 236000], 'scrap 394-4 uses gross invoice value (GST included)');
  // Under 1961 Act, TCS suggestions not implemented (all new provisions are 2025)
  eq(suggestTcs({ pan: 'ABCDE1234F' }, { gross: 500000 }, '2026-03-15', { transactionKind: 'scrap' }), null, 'TCS suggestions only for 2025 Act');
}

console.log('\n[#180 part 2] New TDS sections: 392 (salary), 393-7 (partner)');
{
  const r = (code, list = TDS_SECTIONS_2025) => list.find((s) => s.code === code);
  eq([r('392')?.rate, r('392')?.old, r('392')?.short], [0, '192', '392'], 'Section 392 — salary');
  eq([r('393-7')?.rate, r('393-7')?.old, r('393-7')?.short], [10, '194T', '393(3) Sl. 7'], 'Section 393(3) Sl. 7 — partner remuneration');
}

console.log('\n[#180 part 2] New TCS sections: 394-7 (LRS edu), 394-8 (LRS other), 394-10 (tour)');
{
  const r = (code, list = TCS_SECTIONS_2025) => list.find((s) => s.code === code);
  eq([r('394-7')?.rate, r('394-7')?.old, r('394-7')?.short], [2, '206C(1)', '394(1) Sl. 7'], 'LRS education/medical');
  eq([r('394-8')?.rate, r('394-8')?.old, r('394-8')?.short], [20, '206C(1)', '394(1) Sl. 7'], 'LRS other purposes');
  eq([r('394-10')?.rate, r('394-10')?.old, r('394-10')?.short], [2, '206C(1C)', '394(1) Sl. 8'], 'Overseas tour package');
}

console.log('\n────────────────────────────────────────');
console.log(`Passed: ${passed}   Failed: ${failed}`);
if (failed) process.exit(1);
