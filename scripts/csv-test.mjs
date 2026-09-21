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

console.log('\n────────────────────────────────────────');
console.log(`Passed: ${passed}   Failed: ${failed}`);
if (failed) process.exit(1);
