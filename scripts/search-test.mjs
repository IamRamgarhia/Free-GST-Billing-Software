// #172: the Invoices search finds a bill by its client, number, the client's
// phone / GSTIN, and its order / dispatch / reference details and own fields.
import assert from 'node:assert/strict';
import { billMatchesSearch } from '../src/utils.js';

const bill = {
  clientName: 'Riya Sharma', invoiceNumber: 'DC/26-27/0042',
  data: {
    client: { phone: '+91 98765 43210', gstin: '29ABCDE1234F1ZW' },
    details: {
      buyerOrderNo: 'OD4307711250', dispatchDocNo: 'FMPC2093847561', dispatchedThrough: 'Ekart',
      customFields: [{ label: 'Marketplace', value: 'Meesho' }],
    },
  },
};
for (const q of ['riya', 'dc/26-27/0042', '98765', '29abcde', 'od4307711250', 'FMPC2093847561', 'ekart', 'meesho', '  '])
  assert.ok(billMatchesSearch(bill, q), q);
assert.ok(!billMatchesSearch(bill, 'flipkart'));
assert.ok(billMatchesSearch({ clientName: 'Old bill' }, 'old'));
assert.ok(!billMatchesSearch({}, 'x'));
console.log('search-test: 12 passed, 0 failed');
