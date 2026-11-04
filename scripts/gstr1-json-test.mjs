// v1.10.83 (#133) - GSTR-1 JSON parts the GST portal is strict about.
// Run: `node scripts/gstr1-json-test.mjs`
import { hsnSplitFrom, hsnTable, stripEmpty, lineTreatment, nilTable, expTable, exportNote, b2bInvType, docIssueSummary, docIssueDetails, cleanGstin, gstinFormatOk, hsnSummary, hsnIsB2B, isExportBill, hsnCsvRow, HSN_CSV_HEADERS, mergeHsnRows } from '../src/utils/gstr1Json.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n     expected: ${e}\n     actual:   ${a}`); }
}

console.log('\n[#133] HSN summary split into B2B and B2C from May 2025');
eq(hsnSplitFrom('082026'), true, 'August 2026 is split');
eq(hsnSplitFrom('052025'), true, 'May 2025 is the first split month');
eq(hsnSplitFrom('042025'), false, 'April 2025 still uses one list');
const rows = [
  { b2b: true, hsn_sc: '4802', desc: 'A4 Copier Paper (500 sheets) premium bright white', uqc: 'PAC', qty: 20, rt: 12, txval: 5600, iamt: 0, camt: 336, samt: 336, csamt: 0 },
  { b2b: false, hsn_sc: '998314', desc: 'Website design', uqc: 'NA', qty: 0, rt: 18, txval: 1000, iamt: 180, camt: 0, samt: 0, csamt: 0 },
  { b2b: true, hsn_sc: '4820', desc: 'Notebook', uqc: 'NOS', qty: 40, rt: 12, txval: 2200, iamt: 0, camt: 132, samt: 132, csamt: 0 },
];
const split = hsnTable(rows, '082026');
eq(Object.keys(split), ['hsn_b2b', 'hsn_b2c'], 'the file has hsn_b2b and hsn_b2c, not data');
eq(split.hsn_b2b.map((r) => `${r.num}:${r.hsn_sc}`), ['1:4802', '2:4820'], 'B2B rows only, numbered from 1');
eq(split.hsn_b2c.map((r) => `${r.num}:${r.hsn_sc}`), ['1:998314'], 'B2C rows numbered from 1 on their own');
eq(split.hsn_b2b[0].desc.length <= 30, true, 'a description is cut to 30 characters');
eq('b2b' in split.hsn_b2b[0], false, 'the sorting flag is not written to the file');
eq(Object.keys(hsnTable(rows, '032025')), ['data'], 'a return before May 2025 keeps one list');

console.log('\n[#133] Blank values are not written');
eq(stripEmpty({ gstin: '03AAA', b2b: [], b2cs: [{ pos: '03', rt: 0, txval: 0, etin: '' }], cdnr: [], hsn: { hsn_b2b: [], hsn_b2c: [{ num: 1 }] }, doc_issue: { doc_det: [] } }),
  { gstin: '03AAA', b2cs: [{ pos: '03', rt: 0, txval: 0 }], hsn: { hsn_b2c: [{ num: 1 }] } },
  'empty lists, empty objects and "" go; 0 stays');

console.log('\n[v1.10.84] Which table a line belongs in');
const lt = (o) => lineTreatment({ invoiceType: 'tax-invoice', isExport: false, taxPercent: 18, gstTreatment: '', ...o });
eq(lt({}), 'taxable', 'a line that charges GST is taxable');
eq(lt({ taxPercent: 0 }), 'nil', 'a 0% line on a tax invoice is nil-rated');
eq(lt({ taxPercent: 0, gstTreatment: 'exempt' }), 'exempt', '...or exempt when its product says so');
eq(lt({ taxPercent: 0, gstTreatment: 'nongst' }), 'nongst', '...or non-GST');
eq(lt({ taxPercent: 18, gstTreatment: 'exempt' }), 'taxable', 'a line that charged tax stays taxable whatever the product says');
eq(lt({ invoiceType: 'bill-of-supply', taxPercent: 0 }), 'exempt', 'a bill of supply is exempt by default');
eq(lt({ invoiceType: 'bill-of-supply', taxPercent: 0, gstTreatment: 'nil' }), 'nil', '...nil-rated when its product says so');
eq(lt({ isExport: true, taxPercent: 0 }), 'taxable', 'an export line is zero-rated (Table 6A), never nil');

console.log('\n[v1.10.84] Table 8 (nil)');
eq(nilTable([
  { interstate: false, b2b: false, treatment: 'exempt', txval: 1000 },
  { interstate: false, b2b: false, treatment: 'nil', txval: 250.005 },
  { interstate: true, b2b: true, treatment: 'nongst', txval: 500 },
  { interstate: false, b2b: false, treatment: 'exempt', txval: -200 },
  { interstate: true, b2b: false, treatment: 'taxable', txval: 9999 },
  { interstate: false, b2b: true, treatment: 'nil', txval: 100 },
  { interstate: false, b2b: true, treatment: 'nil', txval: -100 },
]), { inv: [
  { sply_ty: 'INTRB2B', nil_amt: 0, expt_amt: 0, ngsup_amt: 500 },
  { sply_ty: 'INTRAB2C', nil_amt: 250.01, expt_amt: 800, ngsup_amt: 0 },
] }, 'summed per supply type in portal order; a credit note reduces its row; a row that nets to 0 and taxable lines are left out');
eq(nilTable([]), undefined, 'no nil supplies: no table');

console.log('\n[v1.10.84] Table 6A (exp) and export credit notes');
const exp = expTable([
  { inum: 'EX/1', idt: '05-10-2026', val: 118000, wopay: false, lines: [{ rt: 18, txval: 100000, iamt: 18000, csamt: 0 }] },
  { inum: 'EX/2', idt: '06-10-2026', val: 50000, wopay: true, lines: [{ rt: 18, txval: 30000, iamt: 0, csamt: 0 }, { rt: 12, txval: 20000, iamt: 0, csamt: 0 }] },
  { inum: 'EX/3', idt: '07-10-2026', val: 1120, wopay: false, lines: [{ rt: 12, txval: 500, iamt: 60 }, { rt: 12, txval: 500, iamt: 60 }] },
]);
eq(exp.map((g) => `${g.exp_typ}:${g.inv.map((i) => i.inum).join('+')}`), ['WPAY:EX/1+EX/3', 'WOPAY:EX/2'], 'grouped as WPAY then WOPAY');
eq(exp[0].inv[0], { inum: 'EX/1', idt: '05-10-2026', val: 118000, itms: [{ txval: 100000, rt: 18, iamt: 18000, csamt: 0 }] }, 'flat items with rate and IGST, no place of supply');
eq(exp[0].inv[1].itms, [{ txval: 1000, rt: 12, iamt: 120, csamt: 0 }], 'lines at one rate add up into one item');
eq(exp[1].inv[0].itms, [{ txval: 50000, rt: 0, iamt: 0, csamt: 0 }], 'without payment: one item at rate 0 and no tax');
eq(exportNote({ nt_num: 'CN/1', nt_dt: '09-10-2026', val: 11800, wopay: false, lines: [{ rt: 18, txval: 10000, iamt: 1800 }] }),
  { typ: 'EXPWP', ntty: 'C', nt_num: 'CN/1', nt_dt: '09-10-2026', val: 11800, itms: [{ num: 1, itm_det: { rt: 18, txval: 10000, iamt: 1800, csamt: 0 } }] },
  'an export credit note: cdnur typ EXPWP, no place of supply');
eq(exportNote({ nt_num: 'CN/2', nt_dt: '09-10-2026', val: 100, wopay: true, lines: [{ rt: 18, txval: 100 }] }).typ, 'EXPWOP', '...EXPWOP under a LUT');

console.log('\n[v1.10.84] b2b invoice type');
eq(b2bInvType({}), 'R', 'a regular sale');
eq(b2bInvType({ rcm: true, sez: true }), 'R', 'reverse charge to an SEZ is R');
eq(b2bInvType({ sez: true, lut: true }), 'SEWOP', 'SEZ under a LUT');
eq(b2bInvType({ sez: true }), 'SEWP', 'SEZ with IGST');
eq(b2bInvType({ deemedExport: true, rcm: true }), 'DE', 'a deemed export is DE, before anything else');

console.log('\n[ERR-056] Table 13: one row per number series, by the number\'s value');
{
  const b = (invoiceNumber, invoiceType = 'tax-invoice', status = 'unpaid') => ({ invoiceNumber, invoiceType, status });
  const sum = docIssueSummary([
    b('INV/9'), b('INV/10'), b('INV/11', 'tax-invoice', 'cancelled'),
    b('ACME/1'), b('ACME/2'),
    b('QUO/1', 'quotation'), b('PRO/1', 'proforma'),
    b('CN/1', 'credit-note'), b('DC/7', 'delivery-challan'), b('BOS/3', 'bill-of-supply'),
  ]);
  const rows = Object.values(sum).map((d) => `${d.nature}:${d.series}${d.from}..${d.to}:${d.total}/${d.cancelled}`);
  eq(rows, ['1:INV/INV/9..INV/11:3/1', '1:ACME/ACME/1..ACME/2:2/0', '5:CN/CN/1..CN/1:1/0', '12:DC/DC/7..DC/7:1/0', '1:BOS/BOS/3..BOS/3:1/0'],
    'two prefixes are two rows; INV/9 comes before INV/10; cancelled counted; quotations and proformas left out');
  const det = docIssueDetails(sum);
  eq(det.map((d) => `${d.doc_num}:${d.docs.length}`), ['1:3', '5:1', '12:1'], 'doc_num is the portal\'s nature code (1, 5, 12), not a position');
  eq(det[0].docs[0], { num: 1, from: 'INV/9', to: 'INV/11', totnum: 3, cancel: 1, net_issue: 2 }, 'net issued = total - cancelled');
}

console.log('\n[#141] A GSTIN saved with a space or a hidden character');
eq(cleanGstin('21GLZPP9877E1Z3 '), '21GLZPP9877E1Z3', 'a space after it is dropped');
eq(cleanGstin(' 21glzpp9877e1z3'), '21GLZPP9877E1Z3', 'small letters and a space before it');
eq(cleanGstin('21GLZPP9877E1Z3​'), '21GLZPP9877E1Z3', 'an invisible character (pasted from a web page)');
eq(cleanGstin('21 GLZPP 9877 E1Z3'), '21GLZPP9877E1Z3', 'spaces inside');
eq(cleanGstin('21GLZPP9877E1Z'), '21GLZPP9877E1Z', 'too short: left as typed, so the check still shows it');
eq(gstinFormatOk('21GLZPP9877E1Z3'), true, 'a real GSTIN passes');
eq(gstinFormatOk('27AAACR5055KAZ1'), true, 'the 13th character can be a letter (10th+ registration in a state)');
eq(gstinFormatOk('21GLZPP9877E1Z3 '), false, 'the check itself still wants the clean value');

console.log('\n[#166] One Table 12 builder for the screen, the CSV and the JSON');
{
  const profile = { state: 'Karnataka', country: 'India' };
  const bill = (invoiceNumber, client, items, extra = {}) => ({
    invoiceNumber, invoiceType: 'tax-invoice', ...extra,
    data: { profile, client, details: { placeOfSupply: client.state || '' }, items, totals: { isInterstate: client.state !== 'Karnataka' }, ...extra.data },
  });
  const reg = { name: 'Acme Traders', gstin: '29AAACA1234A1Z5', state: 'Karnataka', country: 'India' };
  const walkIn = { name: 'Walk-in', state: 'Karnataka', country: 'India' };
  // A buyer abroad who gave a tax number: still an export, so B2C.
  const abroad = { name: 'Globex Inc', gstin: 'US123456789', country: 'United States' };
  const paper = { name: 'A4 Paper', hsn: '4802', unit: 'Pcs', quantity: 10, rate: 100, taxPercent: 12 };
  const bills = [
    bill('DC/001', reg, [paper, { name: 'Unlabelled item', hsn: '', unit: 'Pcs', quantity: 1, rate: 50, taxPercent: 18 }]),
    bill('DC/002', walkIn, [{ ...paper, quantity: 5 }, { name: 'Website design', hsn: '998314', unit: 'Nos', quantity: 1, rate: 1000, taxPercent: 18 }]),
    bill('DC/003', abroad, [{ ...paper, quantity: 3 }]),
    bill('CN/001', reg, [{ ...paper, quantity: 2 }], { invoiceType: 'credit-note' }),
  ];
  const { rows, missingHsn } = hsnSummary(bills);
  const b2b = rows.filter((r) => r.b2b), b2c = rows.filter((r) => !r.b2b);
  eq(b2b.map((r) => `${r.hsn_sc}:${r.qty}:${r.txval}`), ['4802:8:800'], 'B2B: 10 sold less 2 credited = 8, value 800 (a credit note reduces the row)');
  eq(b2b[0].camt + b2b[0].samt, 96, 'B2B tax is net of the credit note too (12% of 800)');
  eq(b2c.map((r) => `${r.hsn_sc}:${r.uqc}:${r.qty}:${r.txval}`), ['4802:PCS:8:800', '998314:NA:0:1000'], 'B2C: walk-in and export together (5 + 3), the service as NA with quantity 0');
  eq(b2c.find((r) => r.hsn_sc === '4802').iamt, 36, 'the export line keeps its IGST in B2C');
  eq(missingHsn, 1, 'a line with no HSN is left out and counted');
  eq(hsnIsB2B(bills[2]), false, 'an export bill is never B2B, even with a tax number');
  eq(isExportBill(bills[2]), true, 'a client abroad with no Indian place of supply is an export');

  const json = hsnTable(rows, '082026');
  const sum = (list, k) => Math.round(list.reduce((s, r) => s + r[k], 0) * 100) / 100;
  for (const [label, screen, file] of [['B2B', b2b, json.hsn_b2b], ['B2C', b2c, json.hsn_b2c]]) {
    eq(['txval', 'iamt', 'camt', 'samt', 'qty'].map((k) => sum(file, k)), ['txval', 'iamt', 'camt', 'samt', 'qty'].map((k) => sum(screen, k)), `${label}: the JSON list adds up to the screen table`);
    eq(screen.map((r) => hsnCsvRow(r)[6]), file.map((r) => r.txval.toFixed(2)), `${label}: the CSV taxable values are the JSON ones`);
  }
  eq(HSN_CSV_HEADERS.slice(0, 5), ['HSN', 'Description', 'UQC', 'Total Quantity', 'Total Value'], 'the CSV keeps the portal column order');
  eq(hsnCsvRow(b2b[0]).slice(0, 5), ['4802', 'A4 Paper', 'PCS', 8, '896.00'], 'a CSV row: HSN, description, UQC, quantity, total value');
}

console.log('\n[#166 review] Before May 2025 Table 12 is one list: B2B and B2C rows of one HSN add up');
{
  const rows = [
    { b2b: true, hsn_sc: '7009', desc: 'Mirror', uqc: 'SQF', qty: 10, rt: 18, txval: 1000, iamt: 0, camt: 90, samt: 90, csamt: 0 },
    { b2b: false, hsn_sc: '7009', desc: 'Mirror', uqc: 'SQF', qty: 2.5, rt: 18, txval: 250, iamt: 0, camt: 22.5, samt: 22.5, csamt: 0 },
    { b2b: false, hsn_sc: '7005', desc: 'Glass', uqc: 'SQF', qty: 4, rt: 18, txval: 400, iamt: 72, camt: 0, samt: 0, csamt: 0 },
  ];
  eq(mergeHsnRows(rows).map((r) => [r.hsn_sc, r.qty, r.txval, r.camt]), [['7009', 12.5, 1250, 112.5], ['7005', 4, 400, 0]], 'one row per HSN, rate and unit');
  const old = hsnTable(rows, '042025');
  eq([old.data.length, old.data[0].txval, old.data.map((r) => r.num)], [2, 1250, [1, 2]], 'the JSON of an April 2025 return has the merged rows, numbered');
  const split = hsnTable(rows, '052025');
  eq(split.hsn_b2b.length + split.hsn_b2c.length, 3, 'from May 2025 the two lists stay apart');
}

console.log('\n────────────────────────────────────────');
console.log(`Passed: ${passed}   Failed: ${failed}`);
if (failed) process.exit(1);
