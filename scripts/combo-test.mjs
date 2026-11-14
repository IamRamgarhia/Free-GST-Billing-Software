// v1.10.86 - the suggestion list of a text box (utils/combo.js), the app's
// own white box in place of the browser's black <datalist> list.
import assert from 'node:assert/strict';
import { filterOptions, normaliseOptions, isExactOption } from '../src/utils/combo.js';

const cats = ['Opening balance', 'Sales', 'Advance', 'Salary', 'Tea & snacks', 'Transport', 'Owner drawing', 'Deposit to bank', 'Other'];
const values = (list) => list.map((o) => o.value);
let n = 0;
const ok = (fn) => { fn(); n += 1; };

// Empty and repeated values go; strings and { value, label } both work.
ok(() => assert.deepEqual(normaliseOptions(['A', '', null, 'a', ' B ', { value: 'P0802', label: 'Software' }]),
  [{ value: 'A', label: '' }, { value: 'B', label: '' }, { value: 'P0802', label: 'Software' }]));
// Nothing typed: every option, in order.
ok(() => assert.deepEqual(values(filterOptions(cats, '  ')), cats));
// Any case; starts-with first, then a word starting with it, then inside a word.
ok(() => assert.deepEqual(values(filterOptions(cats, 'SA')), ['Sales', 'Salary']));
ok(() => assert.deepEqual(values(filterOptions(['Deposit to bank', 'Banking fees', 'Embankment'], 'bank')), ['Banking fees', 'Deposit to bank', 'Embankment']));
ok(() => assert.deepEqual(values(filterOptions(cats, 'snack')), ['Tea & snacks']));
// The label is searched too (a purpose code by what it is for).
ok(() => assert.deepEqual(values(filterOptions([{ value: 'P0802', label: 'Software' }, { value: 'P1006', label: 'Consulting' }], 'consult')), ['P1006']));
// No match: nothing (the box still takes the typed text).
ok(() => assert.deepEqual(filterOptions(cats, 'xyz'), []));
ok(() => assert.deepEqual(filterOptions(undefined, 'a'), []));
// Exact option, any case.
ok(() => assert.ok(isExactOption(cats, ' sales ')));
ok(() => assert.ok(!isExactOption(cats, 'Sal')));
ok(() => assert.ok(!isExactOption(cats, '')));
console.log(`combo-test: ${n} passed, 0 failed`);
