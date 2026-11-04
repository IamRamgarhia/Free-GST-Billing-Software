// v1.10.84 (#130) - reading .xlsx files (Vyapar's exports, or any Excel
// sheet) for the import screens, without a spreadsheet library.
//
// Run: `node scripts/xlsx-read-test.mjs`

import { zipSync, strToU8 } from 'fflate';
import { readXlsx, excelSerialToIso } from '../src/utils/xlsxRead.js';
import { buildXlsx } from '../src/utils/xlsx.js';
import { bestSheet, fileToSheets } from '../src/utils/importFile.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; console.log(`  ok ${label}`); }
  else { failed++; console.log(`  FAIL ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
}

console.log('Our own .xlsx export reads back');
const own = readXlsx(buildXlsx([['Name', 'Rate', 'Note'], ['Pen & Ink <A>', 12.5, ''], ['Mouse', 250, 'x']], 'Products'));
eq(own.map((s) => s.name), ['Products'], 'sheet name');
eq(own[0].rows, [['Name', 'Rate', 'Note'], ['Pen & Ink <A>', '12.5'], ['Mouse', '250', 'x']], 'cells, numbers as text, & and < decoded (Excel leaves trailing empty cells out)');

console.log('A file as Excel writes it: shared strings, gaps, two sheets');
const xml = (s) => strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${s}`);
const ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const vyapar = zipSync({
  '[Content_Types].xml': xml('<Types/>'),
  'xl/workbook.xml': xml(`<workbook ${ns}><sheets><sheet name="Sale Report" sheetId="1" r:id="rId1"/><sheet name="Item Details" sheetId="2" r:id="rId2"/></sheets></workbook>`),
  'xl/_rels/workbook.xml.rels': xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet1.xml"/>'
    + '<Relationship Id="rId3" Type="x" Target="sharedStrings.xml"/></Relationships>'),
  'xl/sharedStrings.xml': xml(`<sst ${ns} count="5" uniqueCount="5"><si><t>DiceCodes</t></si><si><t>Invoice No.</t></si>`
    + '<si><r><t>Party </t></r><r><rPr><b/></rPr><t>Name</t></r></si><si><t xml:space="preserve"> Cash Sale </t></si><si><t>Total</t></si></sst>'),
  'xl/worksheets/sheet1.xml': xml(`<worksheet ${ns}><sheetData>`
    + '<row r="1"><c r="A1" t="s"><v>0</v></c></row>'
    + '<row r="3"><c r="A3" t="s"><v>1</v></c><c r="C3" t="s"><v>2</v></c></row>'
    + '<row r="4"><c r="A4"><v>101</v></c><c r="C4" t="s"><v>3</v></c><c r="D4" t="b"><v>1</v></c><c r="E4" t="str"><f>A4</f><v>101</v></c></row>'
    + '<row r="5"><c r="A5" t="s"><v>4</v></c><c r="B5" t="inlineStr"><is><t>a&amp;b</t></is></c></row>'
    + '</sheetData></worksheet>'),
  'xl/worksheets/sheet2.xml': xml(`<worksheet ${ns}><sheetData><row r="1"><c r="AA1"><v>46327</v></c></row></sheetData></worksheet>`),
});
const sheets = readXlsx(vyapar);
eq(sheets.map((s) => s.name), ['Sale Report', 'Item Details'], 'sheets in workbook order, found through the relationships');
eq(sheets[0].rows, [
  ['DiceCodes'],
  [],
  ['Invoice No.', '', 'Party Name'],
  ['101', '', ' Cash Sale ', 'TRUE', '101'],
  ['Total', 'a&b'],
], 'missing rows kept as empty rows, gaps as empty cells, rich text joined, booleans, formulas use their value');
eq(sheets[1].rows[0].length, 27, 'column AA is the 27th');
eq(sheets[1].rows[0][26], '46327', 'a date cell is its serial number');

console.log('Excel date numbers');
eq(excelSerialToIso(46325), '2026-10-30', '46325 is 30 Oct 2026');
eq(excelSerialToIso(45383), '2024-04-01', '45383 is 1 Apr 2024');
eq(excelSerialToIso(61), '1900-03-01', 'after Excel\'s false 29 Feb 1900');
eq(excelSerialToIso('abc'), '', 'not a number');

console.log('Not an Excel file');
let err = '';
try { readXlsx(strToU8('Name,Rate\nPen,12')); } catch (e) { err = e.message; }
eq(/not an \.xlsx/i.test(err), true, 'a CSV given as .xlsx says so');
err = '';
try { readXlsx(zipSync({ 'a.txt': strToU8('x') })); } catch (e) { err = e.message; }
eq(/no sheets/i.test(err), true, 'a zip without a workbook says so');

console.log('Which sheet the import screens open on (#130)');
const cover = { name: 'Cover', rows: [['DiceCodes'], []] };
const report = { name: 'Sale Report', rows: [['Invoice No', 'Party Name'], ['V-1', 'DiceCodes']] };
const items = { name: 'Item Details', rows: [['Invoice No', 'Item Name'], ['V-1', 'Pen'], ['V-1', 'Ink']] };
const ready = (rows) => (rows[0]?.includes('Item Name') ? rows.length - 1 : 0);
eq(bestSheet([cover, report, items], ready), 2, 'the sheet the screen can import the most from');
eq(bestSheet([cover, report, items], () => 0), 1, 'none importable: the first sheet that has rows under a header');
eq(bestSheet([cover], () => 0), 0, 'no rows anywhere: the first sheet');

console.log('The file chooser (.xlsx and .csv)');
eq((await fileToSheets(new File([vyapar], 'Vyapar.xlsx'), 'sales')).map((s) => s.name), ['Sale Report', 'Item Details'], 'an .xlsx gives its sheets');
eq(await fileToSheets(new File([String.fromCharCode(0xFEFF) + 'Name,Rate\r\nPen,12\r\n'], 'p.csv'), 'products'), [{ name: 'p.csv', rows: [['Name', 'Rate'], ['Pen', '12']] }], 'a CSV is one sheet');
err = '';
try { await fileToSheets(new File(['x'], 'old.xls'), 'products'); } catch (e) { err = e.message; }
eq(/\.xlsx/.test(err), true, 'an old .xls asks for .xlsx or CSV');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
