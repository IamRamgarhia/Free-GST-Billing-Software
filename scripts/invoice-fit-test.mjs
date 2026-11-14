// v1.10.86 (#188) - keeping an A4 invoice inside its paper: how far the item
// table steps down when its columns do not fit, and how PDF font scale above
// 100% is laid out instead of being cut off at both sides.
//
// Run: `node scripts/invoice-fit-test.mjs`

import { pickTableFitLevel, pdfScalePlan, TABLE_FIT_LEVELS, MIN_NAME_WIDTH } from '../src/utils/invoiceFit.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; console.log(`  ok ${label}`); }
  else { failed++; console.log(`  FAIL ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
}

// A table whose width drops by `step` px per level.
const table = (w0, step, room, name0 = 300, nameStep = 0) => {
  const tried = [];
  const level = pickTableFitLevel((l) => { tried.push(l); return { table: w0 - l * step, room, name: name0 + l * nameStep }; });
  return { level, tried };
};
eq(table(700, 50, 754), { level: 0, tried: [0] }, 'A table that fits stays as designed (one measurement)');
eq(table(755, 50, 754), { level: 0, tried: [0] }, '1px over is within rounding: stays as designed');
eq(table(790, 50, 754), { level: 1, tried: [0, 1] }, 'Too wide: one step tighter');
eq(table(850, 50, 754), { level: 2, tried: [0, 1, 2] }, 'Much too wide: two steps');
eq(table(1000, 50, 754).level, TABLE_FIT_LEVELS, 'Never more than the last level, even if it still does not fit');
eq(table(700, 50, 754, MIN_NAME_WIDTH - 30, 20).level, 2, 'A squeezed item-name column also steps down until it has room');
eq(table(700, 50, 754, MIN_NAME_WIDTH).level, 0, 'An item-name column at the minimum width is fine');
eq(pickTableFitLevel(() => null), 0, 'Nothing measured: as designed');

eq(pdfScalePlan(210, 1), { layoutWidthMm: 210, placeScale: 1 }, '100%: laid out and placed at paper width');
eq(pdfScalePlan(210, 0.8), { layoutWidthMm: 210, placeScale: 0.8 }, '80%: placed smaller and centred, as before');
eq(pdfScalePlan(210, 1.4), { layoutWidthMm: 150, placeScale: 1 }, '140%: laid out 150mm wide, placed at paper width (never wider than the paper)');
eq(pdfScalePlan(148, 1.25).placeScale <= 1, true, 'A5 at 125%: never placed wider than the paper');
eq(pdfScalePlan(210, NaN), { layoutWidthMm: 210, placeScale: 1 }, 'A bad value means 100%');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
