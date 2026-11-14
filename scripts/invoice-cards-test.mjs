// v1.10.86 - New Invoice cards: order and open / closed (src/utils/invoiceCards.js).
// Run: `node scripts/invoice-cards-test.mjs`
import { CARD_IDS, normaliseCardLayout, placeCard, moveCardBy, setCardOpen, slotAt, isSameSlot } from '../src/utils/invoiceCards.js';

let passed = 0, failed = 0;
const eq = (actual, expected, label) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; console.log(`  ok ${label}`); }
  else { failed++; console.log(`  FAIL ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
};

const D = normaliseCardLayout(null);
eq(D, { order: CARD_IDS, closed: [] }, 'Nothing saved: the usual order, all open');
eq(normaliseCardLayout({ order: ['terms', 'bogus', 'terms', 'type'], closed: ['items', 'x', 'items'] }),
  { order: ['terms', 'client', 'items', 'details', 'type'], closed: ['items'] },
  'Unknown and repeated ids dropped; missing cards back at their usual place');
eq(normaliseCardLayout({ order: 'junk', closed: 5 }), D, 'A broken saved value gives the usual layout');

eq(placeCard(D, 'terms', 0).order, ['terms', 'type', 'client', 'items', 'details'], 'Drag the last card to the top');
eq(placeCard(D, 'type', 5).order, ['client', 'items', 'details', 'terms', 'type'], 'Drag the first card to the bottom');
eq(placeCard(D, 'client', 4).order, ['type', 'items', 'details', 'client', 'terms'], 'Drop before a later card');
eq(placeCard(D, 'items', 2), D, 'Dropped where it was: the same layout');
eq(placeCard(D, 'items', 3), D, 'Dropped just below itself: the same layout');
eq(placeCard(D, 'nope', 0), D, 'An unknown card changes nothing');

eq(moveCardBy(D, 'client', -1).order, ['client', 'type', 'items', 'details', 'terms'], 'Move up');
eq(moveCardBy(D, 'client', 1).order, ['type', 'items', 'client', 'details', 'terms'], 'Move down');
eq(moveCardBy(D, 'type', -1), D, 'The top card cannot move up');
eq(moveCardBy(D, 'terms', 1), D, 'The bottom card cannot move down');

const shut = setCardOpen(D, 'items', false);
eq(shut.closed, ['items'], 'Close a card');
eq(setCardOpen(shut, 'items', false).closed, ['items'], 'Closing it twice keeps it once');
eq(setCardOpen(shut, 'items', true).closed, [], 'Open it again');
eq(D.closed, [], 'The layout passed in is never changed');

eq(slotAt([100, 300, 500], 50), 0, 'Above the first middle: the top');
eq(slotAt([100, 300, 500], 301), 2, 'Between middles: before the next card');
eq(slotAt([100, 300, 500], 900), 3, 'Below the last middle: the end');
eq([isSameSlot(CARD_IDS, 'items', 2), isSameSlot(CARD_IDS, 'items', 3), isSameSlot(CARD_IDS, 'items', 4)], [true, true, false], 'No drop line where the card already is');

console.log(`invoice-cards-test: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
