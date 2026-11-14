// v1.10.86 - what needs the user: the bell's sections and the red dots in
// the menu (src/utils/attention.js).
//
// Run: `node scripts/attention-test.mjs`

import { findAttention, menuDots, rollupDot, NEW_IN } from '../src/utils/attention.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; console.log(`  ok ${label}`); }
  else { failed++; console.log(`  FAIL ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
}

const now = new Date(2026, 10, 15, 10, 0); // 15 Nov 2026
const me = { gstin: '29ABCDE1234F1ZW', businessName: 'DiceCodes' };
const other = { gstin: '27AAAAA0000A1Z5', businessName: 'Other Co' };
const bill = (n, dueDate, extra = {}) => ({ id: n, invoiceNumber: n, status: 'unpaid', data: { profile: me, details: { dueDate } }, ...extra });
const bills = [
  bill('INV-1', '2026-11-01'),
  bill('INV-2', '2026-11-14', { status: 'paid' }),
  bill('INV-3', '2026-11-10', { status: 'cancelled' }),
  bill('Q-1', '2026-11-01', { invoiceType: 'quotation' }),
  bill('INV-4', '2026-11-02', { data: { profile: other, details: { dueDate: '2026-11-02' } } }),
  bill('INV-5', '2026-11-17'),
  bill('INV-6', ''),
];
const products = [
  { id: 'p1', name: 'Pen', stock: 2 },
  { id: 'p2', name: 'Book', stock: 50 },
  { id: 'p3', name: 'Repair', kind: 'service', stock: 0 },
  { id: 'p4', name: 'Bag', stock: '' },
];
const templates = [
  { id: 't1', clientName: 'A', nextDate: '2026-11-15', ownerGstin: me.gstin },
  { id: 't2', clientName: 'B', nextDate: '2026-11-15', active: false, ownerGstin: me.gstin },
  { id: 't3', clientName: 'C', nextDate: '2026-12-15', ownerGstin: me.gstin },
  { id: 't4', clientName: 'D', nextDate: '2026-11-01', ownerGstin: other.gstin },
];

console.log('findAttention');
const att = findAttention({ bills, products, stockCfg: { enabled: true, threshold: 5 }, templates, profile: me, now });
eq(att.overdue.map(b => b.id), ['INV-1'], 'overdue: unpaid sales of this business past the due date only');
eq(att.dueSoon.map(b => b.id), ['INV-5'], 'due soon: within 3 days');
eq(att.lowStock.map(p => p.id), ['p1'], 'low stock: services and untracked left out');
eq(att.recurringDue.map(t => t.id), ['t1'], 'recurring: active, due by today, this business');
eq(findAttention({ products, stockCfg: { enabled: false }, now }).lowStock, [], 'stock alerts off: no low stock');
eq(findAttention({ products, stockCfg: { threshold: 60 }, now }).lowStock.map(p => p.id), ['p1', 'p2'], 'threshold honoured');
eq(findAttention({ bills, now }).overdue.map(b => b.id), ['INV-1', 'INV-4'], 'no open business: every business');
eq(findAttention().overdue, [], 'nothing loaded is safe');

// 15 Nov 2026: GSTR-3B for October (period 9_2026) is due 20 Nov, 5 days away.
const filings = att.filings.map(f => f.label);
eq(filings.some(l => l.startsWith('GSTR-3B (Oct')), true, 'GSTR-3B for October is due within 10 days');
eq(att.filings.every(f => f.daysAway <= 10), true, 'only the next 10 days');
const filedAtt = findAttention({ now, filed: { '9_2026': { gstr3b: true } } });
eq(filedAtt.filings.some(f => f.label.startsWith('GSTR-3B (Oct')), false, 'marked Filed on GST Returns: no reminder');

console.log('menuDots');
const dots = menuDots(att, { autoFire: { count: 2 }, update: '1.10.87', unseenNew: ['inventory', 'nonsense'] });
eq(dots.dashboard, { count: 1, text: '1 overdue invoice' }, 'Dashboard: overdue invoices, with a count');
eq(dots.recurring, { count: 3, text: '1 recurring invoice due to be made; 2 recurring invoices made today' }, 'Recurring: due + made today');
eq(dots.inventory, { count: 1, text: `1 product low on stock; New in this update: ${NEW_IN.items.inventory}` }, 'Products: low stock + New');
eq(dots.filing.count, 0, 'GST Returns: a plain dot');
eq(/^GSTR-3B \(Oct 2026\) due in 5 days/.test(dots.filing.text), true, 'GST Returns: says which and when');
eq(dots.settings, { count: 0, text: 'Update to v1.10.87 is available' }, 'Settings: an update');
eq(dots.nonsense, undefined, 'an unknown "new" id is ignored');
eq(menuDots(att, { live: () => false }), {}, 'all cleared in the bell ("Mark all as read"): no dots');
eq(Object.keys(menuDots(findAttention({ now: new Date(2026, 10, 1) }), {})), ['filing'], 'nothing else to do: only the filing');
eq(menuDots({ overdue: [] }, {}), {}, 'nothing: no dots');

console.log('rollupDot');
eq(rollupDot(['dashboard', 'new', 'recurring'], dots), { count: 0, text: '1 overdue invoice; 1 recurring invoice due to be made; 2 recurring invoices made today' }, 'a group: one dot, every reason');
eq(rollupDot(['clients', 'new'], dots), null, 'nothing inside: no dot');
eq(rollupDot(undefined, dots), null, 'no items is safe');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
