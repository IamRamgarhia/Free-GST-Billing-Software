// v1.10.84 (#140) - size billing (glass, mirror): Length x Width in inches,
// rounded up to 3 or 6 inches, / 144 x pieces = square feet; amount = sq.ft x rate.
//
// Run: `node scripts/glass-test.mjs`

import { roundUpTo, sizeSqft, applySize, changeSize, sizeLabel, sizePieces, lineSqft, itemWithUnit } from '../src/utils/glass.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; console.log(`  ok ${label}`); }
  else { failed++; console.log(`  FAIL ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
}
const amount = (i) => Math.round(i.quantity * i.rate * 100) / 100;

eq([roundUpTo(25, 6), roundUpTo(30, 6), roundUpTo(31, 6)], [30, 30, 36], '6 inch rounding goes up, an exact size stays');
eq([roundUpTo(25, 3), roundUpTo(27, 3), roundUpTo(27.5, 3)], [27, 27, 30], '3 inch rounding');
eq(roundUpTo(25.5, 0), 25.5, 'No rounding: the size as measured');

// The shop's own example: 25 x 30, Qty 2, 6 inch, Rs 50 = 12.50 SQFT, Rs 625.
const ex = applySize({ id: 1, name: '6mm Mirror', rate: 50 }, { l: 25, w: 30, pcs: 2, step: 6 });
eq(ex.quantity, 12.5, "The shop's example: 12.50 sq.ft");
eq(amount(ex), 625, "The shop's example: Rs 625");
eq(ex.unit, 'Sq.ft', 'The line is billed in Sq.ft (GSTR-1 unit SQF)');
eq([sizeLabel(ex.size), sizePieces(ex)], ['25 x 30', 2], 'Size printed as measured, pieces in Qty');

eq(sizeSqft({ l: 25, w: 30, pcs: 2, step: 3 }), 11.25, '3 inch: 27 x 30 / 144 x 2 = 11.25 sq.ft');
eq(sizeSqft({ l: 18, w: 24, pcs: 1, step: 0 }), 3, 'No rounding: 18 x 24 = 3 sq.ft');
eq(sizeSqft({ l: 10, w: 10, pcs: 3, step: 6 }), 3, 'Small piece: 12 x 12 x 3 = 3 sq.ft');
eq(sizeSqft({ l: 25, w: 30, pcs: 0, step: 6 }), 0, 'No pieces: 0');

// Type amount (review MEDIUM-1, -3): quantity stays the sq.ft, the amount stays put.
const on = changeSize(ex, { manual: true });
eq([on.quantity, amount(on), on.size.amount], [12.5, 625, 625], 'Ticking Type amount: still 12.50 sq.ft, amount 625 kept');
const typed = changeSize(on, { amount: 900 });
eq([typed.quantity, amount(typed)], [12.5, 900], 'Amount typed: 900, GSTR-1 and stock still see 12.50 sq.ft');
const off = changeSize(typed, { manual: false });
eq([off.quantity, amount(off)], [12.5, 900], 'Unticking keeps 900 (was multiplied by the sq.ft)');
const bigger = changeSize(off, { l: 31 });
eq(bigger.quantity, 15, 'After unticking, a new size is billed at the rate per sq.ft');
eq(applySize({ rate: 0 }, { l: '', w: '', pcs: 1, manual: true, amount: 400 }).rate, 400, 'Amount typed before any size: billed as one amount');
eq(lineSqft(on), 12.5, 'A manual line still prints its sq.ft');
eq(lineSqft({ name: 'Silicon', quantity: 5 }), null, 'A QTY line has no sq.ft');

// Switching units (review MEDIUM-2).
const plain = { id: 3, name: 'Floor tiles', quantity: 250, unit: 'Nos', rate: 60 };
const toSqft = itemWithUnit(plain, 'Sq.ft', { sizeOn: true, step: 6 });
eq([toSqft.quantity, amount(toSqft), sizeLabel(toSqft.size), sizePieces(toSqft)], [250, 15000, '', ''], 'Sq.ft with no size typed: the 250 stays as square feet');
eq(sizeSqft({ ...toSqft.size, sqft: 300 }), 300, 'Square feet typed directly while no size is typed');
eq(itemWithUnit(plain, 'Sq.ft').size, undefined, 'Sq.ft with size billing off: an ordinary unit');
const back = itemWithUnit(ex, 'Nos', { sizeOn: true });
eq([back.size, back.quantity, back.unit], [undefined, 2, 'Nos'], 'Back to Nos: the pieces become the quantity, size gone');
eq(itemWithUnit(toSqft, 'Nos', { sizeOn: true }).quantity, 250, 'Back to Nos with no size typed: the quantity stays');
eq(itemWithUnit(plain, 'NA').quantity, 1, 'NA: quantity held at 1');
eq(itemWithUnit(ex, 'Sq.ft', { sizeOn: true }), { ...ex, unit: 'Sq.ft' }, 'Sq.ft again on a size line: nothing changes');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
