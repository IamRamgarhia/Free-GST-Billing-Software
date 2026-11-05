// v1.10.66 (#63) — CSV export safety.
//
// Run: `node scripts/csv-test.mjs`
//
// A cell that starts with = + - @ (or a tab / carriage return) is executed as
// a formula when the CSV is opened in Excel, LibreOffice or Google Sheets. The
// exports in Expenses, Purchases and GST Returns wrote such text raw, so a
// client or item name could plant a live formula in someone's ledger.
//
// The other half matters just as much: amounts must come out untouched, or
// the fix breaks every sum a user runs over an exported column.

import { toCsvCell, toCsvLine } from '../src/utils.js';
import { dateOrderNote, parseCsv, toIsoDate, toNum, salesCsvToBills, billsToSalesCsv, purchaseCsvToRecords, purchasesToCsv, SALES_TEMPLATE, PURCHASE_TEMPLATE, receivedByInvoice, newProductsFromBills } from '../src/utils/bulkCsv.js';
import { productsCsvToList, clientsCsvToList } from '../src/utils/listCsv.js';
import { readFileSync } from 'fs';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  if (actual === expected) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
}

console.log('\n[#63] Formula-like text is written as plain text');
eq(toCsvCell('=HYPERLINK("http://evil.example","Invoice")'),
  `"'=HYPERLINK(""http://evil.example"",""Invoice"")"`,
  'leading = gets an apostrophe, and its quotes are still escaped');
eq(toCsvCell("=cmd|' /C calc'!A0"), "'=cmd|' /C calc'!A0", 'DDE command payload');
eq(toCsvCell('+91 98765 43210'), "'+91 98765 43210", 'leading + (a phone number) stays text');
eq(toCsvCell('@SUM(A1:A9)'), "'@SUM(A1:A9)", 'leading @');
eq(toCsvCell('-2+3'), "'-2+3", 'leading - followed by an expression');
eq(toCsvCell('\t=1+1'), "'\t=1+1", 'leading tab');
eq(toCsvCell('\r=1+1'), `"'\r=1+1"`, 'leading carriage return');

console.log('\n[#63] Real data is left intact');
eq(toCsvCell(-500), '-500', 'negative number');
eq(toCsvCell('-500.00'), '-500.00', 'negative amount string, as toFixed(2) produces');
eq(toCsvCell(1234.5), '1234.5', 'positive number');
eq(toCsvCell(0), '0', 'zero');
eq(toCsvCell('-'), '-', 'a lone dash placeholder');
eq(toCsvCell('Acme Traders'), 'Acme Traders', 'plain text');
eq(toCsvCell('03AAAAA1111A1Z1'), '03AAAAA1111A1Z1', 'GSTIN');
eq(toCsvCell(null), '', 'null');
eq(toCsvCell(undefined), '', 'undefined');

console.log('\n[#63] Quoting still works');
eq(toCsvCell('Mehta, Sons'), '"Mehta, Sons"', 'comma');
eq(toCsvCell('6" pipe'), '"6"" pipe"', 'double quote');
eq(toCsvCell('line one\nline two'), '"line one\nline two"', 'a line break cannot split the row');
eq(toCsvLine(['=1', 'Acme', -20, '']), "'=1,Acme,-20,", 'toCsvLine escapes every cell');

console.log('\n[#101] Bulk CSV import / export of sales and purchase bills');
{
  const rows = parseCsv('﻿a,b\r\n"x, ""y""",2\n"multi\nline",3\n\n');
  eq(JSON.stringify(rows), JSON.stringify([['a', 'b'], ['x, "y"', '2'], ['multi\nline', '3']]), 'parser: BOM, quotes, commas and line breaks in cells, CRLF, blank lines');
  eq([toIsoDate('2026-10-01'), toIsoDate('01-10-2026'), toIsoDate('1/10/26'), toIsoDate('05-Oct-2026'), toIsoDate('31-02-2026')].join(' '),
    '2026-10-01 2026-10-01 2026-10-01 2026-10-05 ', 'dates: ISO, DD-MM-YYYY, D/M/YY, DD-Mon-YYYY; 31 Feb refused');
  eq([toNum('1,234.50'), toNum('₹ 99'), toNum('', 1), Number.isNaN(toNum('abc'))].join(' '), '1234.5 99 1 true', 'numbers: commas, ₹, blank default, text refused');

  const profile = { country: 'India', state: 'Maharashtra', gstin: '27AAAAA0000A1Z5', businessName: 'Acme' };
  const products = [{ id: 'p1', name: 'Steel rod 8mm', hsn: '7214', unit: 'Kg' }];
  const res = salesCsvToBills(SALES_TEMPLATE, { profile, products, adjustStock: true });
  const b = res.bills[0];
  eq(res.bills.length, 1, 'template: two rows with one number make one invoice');
  eq(res.errors.length, 0, 'template imports with no errors');
  eq(b.totalAmount, 1026.6, 'totals worked out like the invoice screen: (720 + 150) + 18% = 1026.60');
  eq([b.data.totals.cgst, b.data.totals.sgst, b.data.totals.igst].join(','), '78.3,78.3,0', 'same state: CGST + SGST');
  eq(JSON.stringify(b.data.stockApplied), '{"p1":-10}', 'stock follows the bill only for the product it names');
  eq(salesCsvToBills(SALES_TEMPLATE, { profile, products }).bills[0].data.stockApplied.p1, undefined, 'without "adjust stock" no product is linked and stock does not move');
  eq(res.newClients.length, 1, 'a client not in the list is offered as a new client');

  const inter = salesCsvToBills(SALES_TEMPLATE.replace(/Maharashtra/g, 'Gujarat'), { profile });
  eq(inter.bills[0].data.totals.igst, 156.6, 'client in another state: IGST');
  eq(salesCsvToBills(SALES_TEMPLATE, { profile, existingIds: new Set(['INV/2026-27/0101']) }).skipped.join(), 'INV/2026-27/0101', 'an invoice number already used is skipped, never overwritten');
  const bos = salesCsvToBills(SALES_TEMPLATE.replace(/Tax Invoice/g, 'Bill of Supply'), { profile });
  eq(bos.bills[0].totalAmount, 870, 'a bill of supply charges no GST');
  const bad = salesCsvToBills('Invoice Number,Date,Client,Item,Qty,Rate\nX1,32-13-2026,A,B,1,5\nX2,2026-10-01,A,B,1,abc\nX3,2026-10-01,,B,1,5', { profile });
  eq(bad.bills.length + ':' + bad.errors.length, '0:3', 'bad date, bad rate and missing client are each reported, nothing half-imported');

  const again = salesCsvToBills(billsToSalesCsv(res.bills), { profile, products, adjustStock: true });
  eq(again.bills[0].totalAmount, b.totalAmount, 'export -> import gives the same invoice total');

  const pur = purchaseCsvToRecords(PURCHASE_TEMPLATE, { profile });
  const p = pur.purchases[0];
  eq([pur.purchases.length, p.taxableAmount, p.totalTax, p.totalAmount, p.ownerGstin].join(','), '1,6000,1080,7080,27AAAAA0000A1Z5', 'purchase: totals as the purchase form, filed under the business');
  eq(purchaseCsvToRecords(PURCHASE_TEMPLATE, { profile, existing: [{ supplierGstin: '27AAACG1234K1Z2', invoiceNumber: 'sup/552' }] }).skipped.length, 1, 'a supplier bill already booked is skipped');
  eq(purchaseCsvToRecords(PURCHASE_TEMPLATE.replace(',No,', ',,'), { profile, inferInterstate: () => true }).purchases[0].interstate, true, 'blank Inter-state is worked out from the GSTIN');
  eq(purchaseCsvToRecords(purchasesToCsv([p]), { profile }).purchases[0].totalAmount, 7080, 'purchase export -> import round trip');
}

console.log('\n[Review] Import never merges different invoices or double-books a bill');
{
  const head = 'Invoice Number,Invoice Date,Client Name,Client State,Item Name,Quantity,Rate,GST %\n';
  const r = salesCsvToBills(head + '1,2025-04-02,Alpha Traders,Punjab,Pens,1,1000,18\n1,2026-04-03,Beta Stores,Gujarat,Ink,1,1000,18\n',
    { profile: { country: 'India', state: 'Punjab' } });
  eq(r.bills.length, 0, 'Two different invoices sharing a number are not merged into one');
  eq(/different date or client/.test(r.errors.join(' ')), true, 'and the row is named in the error');
  const ok = salesCsvToBills(head + '7,2026-04-03,Alpha Traders,Punjab,Pens,1,100,18\n7,,alpha traders,,Ink,2,50,18\n',
    { profile: { country: 'India', state: 'Punjab' } });
  eq(ok.bills.length === 1 && ok.bills[0].data.items.length === 2, true, 'Item rows of one invoice (blank or same-name repeats) still make one invoice');

  // Export -> import keeps the bill discount and the round-off (977 came back as 1026.6).
  const prof = { country: 'India', state: 'Punjab' };
  const src = salesCsvToBills(head.replace('GST %\n', 'GST %,Bill Discount,Round Off\n') + '9,2026-10-01,Alpha Traders,Punjab,Pens,3,290.3,18,50,Yes\n', { profile: prof });
  const back = salesCsvToBills(billsToSalesCsv(src.bills), { profile: prof });
  eq(`${src.bills[0].totalAmount}`, `${Math.round(3 * 290.3 * 1.18 - 50)}`, 'Bill discount and round-off are applied on import');
  eq(back.bills[0].totalAmount, src.bills[0].totalAmount, 'An exported invoice re-imports to the same total');

  const existing = [{ supplierName: 'Ravi Paper Mart', supplierGstin: '03AAAAA1111A1Z1', invoiceNumber: 'RP-9' }];
  const p = purchaseCsvToRecords('Invoice Number,Invoice Date,Supplier Name,Item Name,Quantity,Rate\nRP-9,2026-10-01,ravi paper mart,A4 Paper,10,250\n', { existing });
  eq(`${p.purchases.length}/${p.skipped.length}`, "0/1", 'A bill saved with a GSTIN is found again from a CSV row with only the supplier name');
}

console.log('\n[Review] Day-first and month-first dates');
{
  eq(dateOrderNote(['13/01/2026', '10/01/2026']).warning, undefined, 'A file with a day over 12 is clearly day first: no warning');
  eq(/10 January 2026/.test(dateOrderNote(['10/01/2026', '2026-01-05']).warning), true, 'Only ambiguous dates: a warning names how one was read');
  eq(/month first/.test(dateOrderNote(['10/25/2026', '10/01/2026']).error), true, 'A month-first file (10/25/2026) is refused as a whole');
  const head = 'Invoice Number,Invoice Date,Client Name,Item Name,Rate\n';
  const us = salesCsvToBills(head + '1,10/25/2026,A,Pen,10\n2,10/01/2026,B,Ink,10\n', { profile: { country: 'India', state: 'Punjab' } });
  eq(`${us.bills.length}/${us.errors.length}`, '0/1', '...so not even its ambiguous rows are imported with swapped dates');
  const p = purchaseCsvToRecords('Invoice Number,Invoice Date,Supplier Name,Item Name,Rate\nX1,03/04/2026,S,Paper,5\n', {});
  eq(`${p.purchases.length}/${p.warnings.length}`, '1/1', 'Purchases get the same warning');
}

console.log('\n[#132] A GSTIN already saved finds that client, whatever the name');
{
  const profile = { country: 'India', state: 'Punjab' };
  const head = 'Invoice Number,Invoice Date,Client Name,Client GSTIN,Item Name,Rate,GST %\n';
  const clients = [{ id: 'c1', name: 'Sharma Traders', gstin: '03AAACS1234A1Z5', state: 'Punjab', phone: '98100' }];
  const r = salesCsvToBills(head + 'A1,2026-10-01,Sharma Tradres,03aaacs1234a1z5,Pens,100,18\n', { profile, clients });
  eq(r.newClients.length, 0, 'a mistyped name with a saved GSTIN adds no new client');
  eq(r.bills[0].clientName, 'Sharma Traders', '...and the invoice goes to the saved client, by its saved name');
  eq(r.bills[0].data.client.phone, '98100', '...with the saved client details');
  const two = salesCsvToBills(head + 'B1,2026-10-01,New Co,03BBBCN1234B1Z5,Pens,100,18\nB2,2026-10-02,New Company,03BBBCN1234B1Z5,Ink,50,18\n', { profile });
  eq(two.newClients.length, 1, 'two new rows with one GSTIN make one new client, not two');
  eq(two.bills.map((b) => b.clientName).join('|'), 'New Co|New Co', '...and both invoices use its first name');
  eq(salesCsvToBills(head + 'C1,2026-10-01,Sharma Traders,,Pens,100,18\n', { profile, clients }).newClients.length, 0, 'no GSTIN on the row: still found by name');
}

console.log('\n[#134] The Products export imports back, every column');
{
  // The exact file from the report: v1.10.82's own Products export, filled in
  // in Excel (saved as CSV UTF-8, so with a byte-order mark).
  const v82 = '﻿Name,HSN/SAC,Purchase price,Selling price,GST %,Unit,Stock\r\nPVC 2 PIPE 4KG ISI AST,39172390,822,822,18,Ft,0\r\n';
  const p = productsCsvToList(v82, []).products[0];
  eq(JSON.stringify([p.hsn, p.purchasePrice, p.sellingPrice, p.taxPercent, p.unit, p.stock]), JSON.stringify(['39172390', 822, 822, 18, 'Ft', 0]),
    'HSN/SAC, both prices and GST % are read, not only the name');
  // Today's export headings, read from the Products screen itself, so a change
  // to them that the import does not follow fails here.
  const src = readFileSync(new URL('../src/components/InventoryView.jsx', import.meta.url), 'utf8');
  const headers = JSON.parse((/headers=\{(\[[^\]]*\])\}/.exec(src) || [])[1].replace(/'/g, '"'));
  const row = { Name: 'Pen', Type: 'Goods', 'HSN/SAC': '9608', 'Purchase price': 6, 'Selling price': 10, 'GST %': 12, Unit: 'Nos', Stock: 40 };
  const now = productsCsvToList([toCsvLine(headers), toCsvLine(headers.map((h) => row[h] ?? ''))].join('\n'), []).products[0];
  eq(JSON.stringify([now?.hsn, now?.purchasePrice, now?.sellingPrice, now?.taxPercent, now?.unit, now?.stock]), JSON.stringify(['9608', 6, 10, 12, 'Nos', 40]),
    `the screen's own export headings (${headers.join(', ')}) all import`);
}

console.log('\n[#134] Importing products again fills in what is empty, never overwrites');
{
  // As left by v1.10.82: only Name, Unit and Stock were read.
  const existing = [
    { id: 'p1', name: 'DiceCodes PVC Pipe', hsn: '', purchasePrice: 0, sellingPrice: 0, rate: 0, taxPercent: 0, unit: 'Ft', stock: 5, description: '' },
    { id: 'p2', name: 'DiceCodes Pen ', hsn: '9608', purchasePrice: 0, sellingPrice: 10, rate: 10, taxPercent: 12, unit: 'Nos', description: 'blue' },
    { id: 'p3', name: 'DiceCodes Exempt Book', hsn: '4901', purchasePrice: 40, sellingPrice: 50, rate: 50, taxPercent: 0, unit: 'Nos', stock: 2, description: 'x' },
  ];
  const file = [
    'Name,HSN/SAC,Purchase price,Selling price,GST %,Unit,Stock,Description',
    'DiceCodes PVC Pipe,39172390,822,850,18,Mtr,90,new',
    'dicecodes pen,9999,6,99,18,Box,40,red',
    'DiceCodes Exempt Book,4902,41,51,5,Box,9,y',
    'DiceCodes Pen,1111,7,1,1,Kg,1,z',
    'DiceCodes Brand New,4820,1,2,12,Nos,3,',
  ].join('\n');
  const r = productsCsvToList(file, existing);
  eq(r.products.map((p) => p.name).join('|'), 'DiceCodes Brand New', 'a new name is added as before');
  eq(r.updates.map((p) => p.id).join('|'), 'p1|p2', 'saved products with empty details are updated (same id, no duplicate)');
  const [pipe, pen] = r.updates;
  eq(JSON.stringify([pipe.hsn, pipe.purchasePrice, pipe.sellingPrice, pipe.rate, pipe.taxPercent, pipe.unit, pipe.stock, pipe.description]), JSON.stringify(['39172390', 822, 850, 850, 18, 'Ft', 5, 'new']),
    'the empty HSN, prices, GST % and description are filled; unit and stock already set are kept');
  eq(JSON.stringify([pen.name, pen.hsn, pen.purchasePrice, pen.sellingPrice, pen.taxPercent, pen.unit, pen.description, pen.stock]), JSON.stringify(['DiceCodes Pen ', '9608', 6, 10, 12, 'Nos', 'blue', 40]),
    'only the empty purchase price and the untracked stock are filled; every value already there stays');
  eq(r.skipped, 2, 'nothing to fill (the 0% book has its HSN, so 0% is its rate) and a repeat in the file: skipped');
  eq(existing[0].hsn, '', 'the saved list itself is not changed');
}

console.log('\n[#130] Files exported from Vyapar (layouts seen in real exports)');
{
  const profile = { country: 'India', state: 'Punjab', gstin: '03ABCDE1234F1Z5' };
  // Newer "Item Details" sheet: title rows above the header, "Tax Percent"
  // beside "Tax", an Excel date number, a cancelled sale, a Total row.
  const newer = [
    ['DiceCodes'], ['Sale Report: 01/10/2026 to 31/10/2026'],
    ['Date', 'Invoice No./Txn No.', 'Party Name', 'Item Name', 'Item Code', 'HSN/SAC', 'Category', 'Description', 'Quantity', 'Unit', 'UnitPrice', 'Discount Percent', 'Discount', 'Tax Percent', 'Tax', 'Transaction Type', 'Amount'],
    ['46325', 'V-1', 'Riya Sharma', 'Pen', 'P1', '9608', 'Stationery', 'Blue ink', '10', 'Nos', '20', '0', '0', '18', '36', 'Sale', '236'],
    ['30/10/2026', 'V-2', 'Arjun', 'Ink', '', '3215', '', '', '1', 'Nos', '100', '0', '0', '12', '12', 'Sale[Cancelled]', '112'],
    ['Total', '', '', '', '', '', '', '', '11', '', '', '', '', '', '48', '', '348'],
  ];
  const sale = [
    ['DiceCodes'], ['Sale Report'],
    ['Date', 'Order No', 'Invoice No', 'Party Name', 'GSTIN', 'Party Phone No.', 'Transaction Type', 'Total Amount', 'Payment Type', 'Received/Paid Amount', 'Balance Due'],
    ['30/10/2026', '', 'V-1', 'Riya Sharma', '', '98765 43210', 'Sale', '236', 'Cash', '100', '136'],
    ['Total', '', '', '', '', '', '', '236', '', '100', '136'],
  ];
  const r = salesCsvToBills(newer, { profile, received: receivedByInvoice(sale) });
  eq(r.errors.join(' | '), '', 'no errors: title rows and the Total row are not data');
  eq(r.bills.map((b) => b.invoiceNumber).join(','), 'V-1', 'the cancelled sale is left out...');
  eq(r.warnings.some((w) => /1 cancelled invoice was left out/.test(w)), true, '...and the preview says so');
  const b = r.bills[0];
  eq(b.invoiceDate, '2026-10-30', 'an Excel date number becomes the date');
  eq(`${b.data.items[0].rate}|${b.data.items[0].taxPercent}|${b.data.items[0].hsn}`, '20|18|9608', '"Tax Percent" is the rate, not the "Tax" amount beside it');
  eq(b.totalAmount, 236, 'the total matches Vyapar\'s');
  eq(`${b.status}|${b.paidAmount}|${b.payments.length}`, 'partial|100|1', 'what the Sale Report says was received becomes a payment');
  // Older "Sale Items" sheet: discount and GST as "amount (rate%)".
  const older = [
    ['Date', 'Party Name', 'Invoice No.', 'Item Name', 'Item code', 'HSN/SAC', 'Quantity', 'Price/Unit', 'Discount', 'GST', 'Amount'],
    ['05/12/2025', 'Cash Sale', '17', 'Notebook', '', '4820', '2', '50', '10 (10.0%)', '16.2 (18.0%)', '106.2'],
  ];
  const o = salesCsvToBills(older, { profile });
  eq(o.errors.join(' | '), '', 'older layout reads without errors');
  eq(`${o.bills[0].data.items[0].discount}|${o.bills[0].data.items[0].taxPercent}|${o.bills[0].totalAmount}`, '10|18|106.2',
    '"10 (10.0%)" is a ₹10 discount and "16.2 (18.0%)" is 18% GST');
  eq(o.bills[0].status, 'unpaid', 'without a Sale Report nothing is marked paid');
  // Item and party files.
  const items = productsCsvToList([
    ['Item Code', 'Item Name*', 'HSN', 'Sale Price', 'Purchase Price', 'Opening Stock Quantity', 'Minimum Stock Quantity', 'Item Location', 'Tax Rate', 'Tax Inclusive (Y/N)'],
    ['P1', 'Pen', '9608', '23.6', '15', '100', '10', 'Shelf 2', 'GST@18%', 'Y'],
    ['P2', 'Register', '4820', '80', '60', '', '', '', '12%', 'N'],
  ]);
  eq(items.errors.join(' | '), '', 'Vyapar item file reads without errors');
  eq(items.products.map((p) => `${p.name}:${p.sellingPrice}:${p.taxPercent}:${p.stock ?? '-'}`).join(' '), 'Pen:20:18:100 Register:80:12:-',
    '"GST@18%" and "12%" read as rates; an inclusive price has its tax taken out');
  const parties = clientsCsvToList([
    ['Party Name', 'GSTIN', 'Phone No.', 'Email Id', 'Billing Address', 'State'],
    ['Riya Sharma', '', '9876543210', 'riya@example.com', '4 Mall Road, Ludhiana', 'Punjab'],
  ]);
  eq(parties.clients.map((c) => `${c.name}|${c.phone}|${c.address}`).join(), 'Riya Sharma|9876543210|4 Mall Road, Ludhiana', 'Vyapar party columns map onto clients');
  eq(toIsoDate('45383'), '2024-04-01', 'a date number in a CSV too');
  eq(toIsoDate('2026'), '', 'a plain year is not a date');
}

// #170: an invoice import adds new items to Products, never changes saved ones.
{
  const bills = [{ data: { items: [{ name: 'Mouse ', hsn: '8471', unit: 'Pcs', rate: 250, taxPercent: 18 }, { name: 'Pen drive', rate: 399, taxPercent: 12 }] } },
    { data: { items: [{ name: 'mouse', rate: 1 }, { name: 'Cable', rate: 99, taxPercent: 18, cessPercent: 1 }] } }];
  const out = newProductsFromBills(bills, [{ name: 'Pen Drive' }]);
  eq(out.map((p) => p.name).join(','), 'Mouse,Cable', '#170 only new item names, once each');
  eq(`${out[0].hsn}|${out[0].unit}|${out[0].sellingPrice}|${out[0].taxPercent}|${out[0].stock}`, '8471|Pcs|250|18|0', '#170 the new product keeps HSN, unit, rate, GST; stock 0');
  eq(out[1].cessPercent, 1, '#170 cess carried over');
}

console.log('\n────────────────────────────────────────');
console.log(`Passed: ${passed}   Failed: ${failed}`);
if (failed) process.exit(1);
