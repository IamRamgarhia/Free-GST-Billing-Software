// v1.10.84 (#129) - phone-first customers: find a saved customer by phone
// number, add a new one from the phone number and a name, and count visits.
//
// Run: `node scripts/phone-test.mjs`

import { phoneDigits, findClientByPhone, newPhoneClient, clientVisits } from '../src/utils/phoneClients.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; console.log(`  ok ${label}`); }
  else { failed++; console.log(`  FAIL ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
}

console.log('Phone numbers are compared by their digits');
eq(phoneDigits('+91 98765 43210'), '9876543210', '+91 and spaces dropped');
eq(phoneDigits('098765-43210'), '9876543210', 'a leading 0 dropped');
eq(phoneDigits('919876543210'), '9876543210', '91 in front of 10 digits dropped');
eq(phoneDigits('0172 2654321'), '1722654321', 'a landline with its STD code');
eq(phoneDigits(''), '', 'empty stays empty');
eq(phoneDigits(undefined), '', 'missing stays empty');

console.log('Finding a saved customer');
const clients = [
  { id: 'a', name: 'Riya', phone: '+91 98765 43210' },
  { id: 'b', name: 'Arjun', phone: '98140-11111' },
  { id: 'c', name: 'No phone', phone: '' },
];
eq(findClientByPhone(clients, '9876543210')?.id, 'a', 'same number written differently');
eq(findClientByPhone(clients, '09814011111')?.id, 'b', 'with a leading 0');
eq(findClientByPhone(clients, '98765'), null, 'part of a number finds nobody');
eq(findClientByPhone(clients, '9999999999'), null, 'an unknown number finds nobody');
eq(findClientByPhone(clients, ''), null, 'an empty box never matches the client with no phone');
eq(findClientByPhone(null, '9876543210'), null, 'no saved clients');

console.log('A new customer from the phone box');
const profile = { state: 'Punjab', country: 'India' };
const riya = newPhoneClient('+91 98765 43210', '  Riya Sharma ', profile);
eq([riya.name, riya.phone, riya.state, riya.country, riya.gstin, riya.isSEZ], ['Riya Sharma', '9876543210', 'Punjab', 'India', '', false],
  'name trimmed, digits saved, in the business\'s own state (local sale)');
eq(newPhoneClient('9876543210', '', profile).name, '9876543210', 'no name given: the number is the name');
eq(newPhoneClient('9876543210', 'X', {}).country, 'India', 'country defaults to India');
// Bills find their customer by name, so two customers must not share one.
eq(newPhoneClient('9123456789', 'riya', profile, clients).name, 'riya 6789', 'a name already used gets the last 4 digits');
eq(newPhoneClient('9123456789', 'Meera', profile, clients).name, 'Meera', 'a new name stays as typed');

console.log('Visits');
const bill = (n, date, extra = {}) => ({ invoiceNumber: n, invoiceDate: date, invoiceType: 'tax-invoice', status: 'paid', ...extra });
const bills = [
  bill('1', '2026-10-01'),
  bill('2', '2026-11-03'),
  bill('3', '2026-10-20'),
  bill('Q1', '2026-11-05', { invoiceType: 'quotation' }),
  bill('4', '2026-11-06', { status: 'cancelled' }),
  bill('CN1', '2026-11-07', { invoiceType: 'credit-note' }),
];
eq(clientVisits(bills), { visits: 3, last: '2026-11-03' }, 'only real sales count; quotes, cancelled bills and credit notes do not');
eq(clientVisits([]), { visits: 0, last: '' }, 'no bills: no visits');
eq(clientVisits(undefined), { visits: 0, last: '' }, 'missing list');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
