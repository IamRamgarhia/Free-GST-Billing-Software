// Customer details from the New Invoice page are saved back to the customer.
//
// Run: `node scripts/clientsync-test.mjs`

import { cleanCustomFields, printableCustomFields, findClientMatch, mergeClientRecord, pickCustomerPrefs } from '../src/utils/clientSync.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n     expected: ${e}\n     actual:   ${a}`); }
}

eq(cleanCustomFields([{ label: ' PO ', value: ' 12 ' }, { label: '', value: '' }, null]), [{ label: 'PO', value: '12' }], 'blank rows dropped, values trimmed');
eq(printableCustomFields([{ label: 'PO', value: '' }, { label: 'Ref', value: 'A1' }]), [{ label: 'Ref', value: 'A1' }], 'only filled fields print');

const saved = [
  { id: 'c1', name: 'Ravi Traders', gstin: '', phone: '', city: 'Pune' },
  { id: 'c2', name: 'Asha Stores', gstin: '27AAAAA0000A1Z5' },
];
eq(findClientMatch(saved, { name: 'x' }, 'c2')?.id, 'c2', 'picked client wins');
eq(findClientMatch(saved, { name: '  ravi traders ' }, null)?.id, 'c1', 'matches by name, any case');
eq(findClientMatch(saved, { name: 'Asha Stores', gstin: '29BBBBB0000B1Z5' }, null), null, 'different GSTIN is a different customer');
eq(findClientMatch(saved, { name: '' }, null), null, 'no name, no match');

// New customer typed straight on the invoice.
const fresh = mergeClientRecord(null, { name: 'New Co', phone: ' 98765 43210 ', customFields: [{ label: 'Vendor code', value: 'V-9' }] });
eq([fresh.name, fresh.phone, fresh.customFields], ['New Co', '98765 43210', [{ label: 'Vendor code', value: 'V-9' }]], 'new customer gets phone and custom fields');
eq(mergeClientRecord(null, { name: '  ' }), null, 'no name, nothing saved');

// Existing customer: phone added on the invoice.
const upd = mergeClientRecord({ ...saved[0], preferredPaperSize: 'a5' }, { name: 'Ravi Traders', phone: '9999', city: '' });
eq([upd.id, upd.phone, upd.city, upd.preferredPaperSize], ['c1', '9999', 'Pune', 'a5'], 'phone added; blank city keeps the saved one; other settings kept');
eq(mergeClientRecord(saved[0], { name: 'Ravi Traders', city: 'Pune' }), null, 'nothing changed, nothing saved');

const cf = mergeClientRecord({ id: 'c3', name: 'Z', customFields: [{ label: 'PO', value: '1' }, { label: 'Area', value: 'N' }] },
  { name: 'Z', customFields: [{ label: 'po', value: '2' }, { label: 'Route', value: 'R4' }] });
eq(cf.customFields, [{ label: 'PO', value: '2' }, { label: 'Area', value: 'N' }, { label: 'Route', value: 'R4' }], 'custom fields: same label updates, new label added');

eq(pickCustomerPrefs({ showHSN: false, pdfStyle: 'modern', paymentAccountSnapshot: { x: 1 }, exchangeRate: 83 }), { pdfStyle: 'modern', showHSN: false }, 'prefs keep display options only');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
