// v1.10.86 - sort by column and Customise Dashboard (src/utils/listPrefs.js).
// Run: `node scripts/list-prefs-test.mjs`
import { nextSort, sortRows, normaliseLayout, moveBlock, toggleBlock, DEFAULT_LAYOUT } from '../src/utils/listPrefs.js';

let passed = 0, failed = 0;
const eq = (actual, expected, label) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; console.log(`  ok ${label}`); }
  else { failed++; console.log(`  FAIL ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
};

// A header click: A-Z, then Z-A, then the usual order; another column starts at A-Z.
eq(nextSort(null, 'date'), { key: 'date', dir: 'asc' }, 'First click sorts A-Z / low to high');
eq(nextSort({ key: 'date', dir: 'asc' }, 'date'), { key: 'date', dir: 'desc' }, 'Second click: the other way round');
eq(nextSort({ key: 'date', dir: 'desc' }, 'date'), null, 'Third click: the usual order again');
eq(nextSort({ key: 'date', dir: 'desc' }, 'amount'), { key: 'amount', dir: 'asc' }, 'Another column starts at A-Z');

const rows = [
  { n: 'INV-10', amt: 500, client: 'beta' },
  { n: 'INV-2', amt: 100, client: 'Alpha' },
  { n: 'INV-1', amt: 500, client: '' },
  { n: 'INV-3', amt: 250, client: 'alpha' },
];
const G = { n: (r) => r.n, amt: (r) => r.amt, client: (r) => r.client };
const ns = (list) => list.map((r) => r.n);
eq(sortRows(rows, null, G), rows, 'No sort: the very same list, untouched (the usual order)');
eq(sortRows(rows, { key: 'nope', dir: 'asc' }, G), rows, 'An unknown column leaves the list as it is');
eq(ns(sortRows(rows, { key: 'n', dir: 'asc' }, G)), ['INV-1', 'INV-2', 'INV-3', 'INV-10'], 'Invoice numbers: INV-2 before INV-10');
eq(ns(sortRows(rows, { key: 'amt', dir: 'desc' }, G)), ['INV-10', 'INV-1', 'INV-3', 'INV-2'], 'Amounts high to low; equal amounts keep their usual order');
eq(ns(sortRows(rows, { key: 'client', dir: 'asc' }, G)), ['INV-2', 'INV-3', 'INV-10', 'INV-1'], 'Names ignore case; a blank one goes last');
eq(ns(sortRows(rows, { key: 'client', dir: 'desc' }, G)), ['INV-10', 'INV-2', 'INV-3', 'INV-1'], 'A blank name goes last the other way round too');
eq(ns(rows), ['INV-10', 'INV-2', 'INV-1', 'INV-3'], 'Sorting never changes the list it was given');
eq(ns(sortRows([{ n: 'b', d: '2026-11-02' }, { n: 'a', d: '2026-01-15' }, { n: 'c', d: undefined }], { key: 'd', dir: 'asc' }, { d: (r) => r.d })), ['a', 'b', 'c'], 'Dates oldest first; no date last');

// Dashboard blocks.
eq(normaliseLayout(null), DEFAULT_LAYOUT, 'Nothing saved: every block, in the usual order');
eq(normaliseLayout({ order: ['list', 'bogus', 'list', 'totals'], hidden: ['support', 'bogus'] }),
  { order: ['welcome', 'support', 'overdue', 'list', 'lowStock', 'totals'], hidden: ['support'] },
  'Unknown and repeated blocks are dropped; missing ones come back at their usual place');
const moved = moveBlock(DEFAULT_LAYOUT, 'list', -1);
eq(moved.order.slice(-2), ['list', 'lowStock'], 'Move up swaps with the block above');
eq(moveBlock(DEFAULT_LAYOUT, 'welcome', -1), DEFAULT_LAYOUT, 'The first block cannot move further up');
eq(DEFAULT_LAYOUT.order[5], 'list', 'Moving makes a new layout; the default is untouched');
eq(toggleBlock(toggleBlock(DEFAULT_LAYOUT, 'overdue'), 'overdue').hidden, [], 'Hide then show again');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
