// v1.10.85 - the Dashboard card period (src/utils/period.js).
// Run: `node scripts/period-test.mjs`
import { periodRange, inPeriod } from '../src/utils/period.js';

let passed = 0, failed = 0;
const eq = (actual, expected, label) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; console.log(`  ok ${label}`); }
  else { failed++; console.log(`  FAIL ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
};
const nov7 = new Date(2026, 10, 7);
const jan5 = new Date(2027, 0, 5);

eq(periodRange('all', '', nov7), null, 'All time: no limit');
eq(periodRange('this-month', '', nov7), { from: '2026-11-01', to: '2026-11-30' }, 'This month');
eq(periodRange('last-month', '', nov7), { from: '2026-10-01', to: '2026-10-31' }, 'Last month');
eq(periodRange('last-month', '', jan5), { from: '2026-12-01', to: '2026-12-31' }, 'Last month in January is last December');
eq(periodRange('month', '2028-02'), { from: '2028-02-01', to: '2028-02-29' }, 'A chosen month: February in a leap year');
eq(periodRange('month', ''), null, 'No month chosen yet: no limit');
eq(periodRange('2026-2027'), { from: '2026-04-01', to: '2027-03-31' }, 'A financial year runs April to March');
eq([inPeriod('2026-11-30', periodRange('this-month', '', nov7)), inPeriod('2026-12-01', periodRange('this-month', '', nov7))], [true, false], 'The last day is in, the next day is out');
eq([inPeriod('', periodRange('this-month', '', nov7)), inPeriod('', null)], [false, true], 'An undated invoice counts only in All time');

console.log(`\nperiod-test: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
