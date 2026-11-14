// v1.10.86 - Settings -> "New invoice starts with": the type, due date, GST %,
// payment mode and goods / services a brand-new invoice starts with.
//
// Run: `node scripts/invoice-start-test.mjs`

import {
  startTypeFor, startDueDate, startTaxRate, startPaidMode, startOptionsPatch,
  htmlLineCount, htmlFirstWords, START_KEY,
} from '../src/utils/invoiceStart.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; console.log(`  ok ${label}`); }
  else { failed++; console.log(`  FAIL ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
}

console.log('Document type');
eq(startTypeFor({}, ''), 'tax-invoice', 'nothing set: Tax Invoice');
eq(startTypeFor({}, 'quotation'), 'quotation', 'Last used: the last type picked');
eq(startTypeFor({ type: 'proforma' }, 'quotation'), 'proforma', 'a Settings type wins over the last one');
eq(startTypeFor({ type: 'no-such' }, 'nope'), 'tax-invoice', 'unknown types fall back');
eq(startTypeFor({ type: 'sales-order' }, 'delivery-challan', (t) => t !== 'sales-order'), 'delivery-challan', 'a switched-off type is skipped');

console.log('Due date');
eq(startDueDate('2026-11-14', {}, 'retail'), '', 'not set: no due date');
eq(startDueDate('2026-11-14', {}, 'freelancer'), '2026-11-29', 'not set: a freelancer gets 15 days (as before)');
eq(startDueDate('2026-11-14', { dueDays: 0 }, 'freelancer'), '', '"None" wins over the freelancer default');
eq(startDueDate('2026-11-14', { dueDays: 30 }, 'retail'), '2026-12-14', '30 days');
eq(startDueDate('2027-01-25', { dueDays: '10' }, ''), '2027-02-04', 'a custom number of days, across a month end');

console.log('GST %');
const rates = [0, 5, 12, 18, 28, 40];
eq(startTaxRate({}, rates), 18, 'not set: 18%');
eq(startTaxRate({ taxRate: 5 }, rates), 5, 'Settings 5%');
eq(startTaxRate({ taxRate: '0' }, rates), 0, 'Settings 0% (exempt goods)');
eq(startTaxRate({ taxRate: 7 }, rates), 18, 'a rate not offered is ignored');
eq(startTaxRate({}, [0, 7, 20, 25]), 20, 'no 18% in the list: the second-highest');

console.log('Received now: how it was paid');
const modes = [['cash', 'Cash'], ['upi', 'UPI'], ['card', 'Card']];
eq(startPaidMode({}, 'cash', modes), 'cash', 'not set: the last one used');
eq(startPaidMode({ paidMode: 'upi' }, 'cash', modes), 'upi', 'Settings UPI');
eq(startPaidMode({ paidMode: 'gold' }, 'card', modes), 'card', 'an unknown mode is ignored');

console.log('Options');
eq(startOptionsPatch({}, 'tax-invoice', ''), {}, 'nothing set: nothing changes');
eq(startOptionsPatch({ [START_KEY]: { mode: 'services' } }, 'tax-invoice', 'tax-invoice'),
  { invoiceMode: 'services', showItemUnit: false }, 'Services: no unit column');
eq(startOptionsPatch({ [START_KEY]: { mode: 'services' }, showItemUnitManual: true }, 'tax-invoice', ''),
  { invoiceMode: 'services' }, 'a unit column set by hand is kept');
eq(startOptionsPatch({}, 'bill-of-supply', 'tax-invoice'), { showGST: false, showPlaceOfSupply: false }, 'Bill of Supply starts without GST');
eq(startOptionsPatch({ showGST: false }, 'tax-invoice', 'bill-of-supply'), { showGST: true, showPlaceOfSupply: true }, 'a Tax Invoice after a Bill of Supply has GST');
eq(startOptionsPatch({ showGST: false }, 'tax-invoice', 'tax-invoice'), {}, 'GST switched off by hand on the same type stays off');

console.log('Folded section summaries');
eq(htmlLineCount('<p>1. One</p><p>2. Two</p><p></p><ol><li>Three</li></ol>'), 3, 'counts lines with text');
eq(htmlLineCount(''), 0, 'empty');
eq(htmlFirstWords('<p>Call before&nbsp;delivery &amp; collect the cheque on Friday morning</p>', 30), 'Call before delivery & collec…', 'first words, shortened');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
