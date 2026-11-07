// v1.10.85 - price levels: names, the price used for a client's level, what
// a product saves, and the level columns of the Products CSV import / export.
//
// Run: `node scripts/price-levels-test.mjs`

import {
  DEFAULT_LEVEL_NAMES, priceLevelList, normaliseLevelNames, priceForLevel, cleanLevelPrices,
  levelCsvHeaders, levelCsvCells,
} from '../src/utils/priceLevels.js';
import { productsCsvToList } from '../src/utils/listCsv.js';
import { toCsvLine } from '../src/utils.js';

let passed = 0, failed = 0;
function ok(cond, label, got) {
  if (cond) { passed++; console.log(`  ok ${label}`); }
  else { failed++; console.log(`  FAIL ${label}\n${JSON.stringify(got, null, 1)}`); }
}

const levels = priceLevelList(DEFAULT_LEVEL_NAMES);
ok(levels.map((l) => `${l.id}:${l.name}`).join() === '1:Retail,2:Wholesale,3:Dealer', 'default levels', levels);
ok(priceLevelList(['Shop', '', 'Bulk']).map((l) => l.id).join() === '1,3', 'a blank name is a level not used (ids stay)', priceLevelList(['Shop', '', 'Bulk']));
ok(normaliseLevelNames([' A ', null]).join('|') === 'A||', 'names: always three, trimmed', normaliseLevelNames([' A ', null]));
ok(priceLevelList(['a', 'b', 'c', 'd']).length === 3, 'at most 3 levels', '');

const chair = { name: 'Steel chair', sellingPrice: 1500, levelPrices: { 2: 1300, 3: '' } };
ok(priceForLevel(chair, '2') === 1300, 'a client on Wholesale gets the Wholesale price', priceForLevel(chair, '2'));
ok(priceForLevel(chair, '3') === 1500, 'no price for that level: the selling price', priceForLevel(chair, '3'));
ok(priceForLevel(chair, '') === 1500, 'no level: the selling price', priceForLevel(chair, ''));
ok(priceForLevel({ rate: 99 }, '1') === 99, 'an old product with only rate', priceForLevel({ rate: 99 }, '1'));

ok(JSON.stringify(cleanLevelPrices({ 1: '90.505', 2: '', 3: '-4', 4: 7 })) === '{"1":90.51}', 'saved level prices: real prices only, levels 1-3', cleanLevelPrices({ 1: '90.505', 2: '', 3: '-4', 4: 7 }));

ok(levelCsvHeaders(levels).join() === 'Retail price,Wholesale price,Dealer price', 'export headings', levelCsvHeaders(levels));
ok(levelCsvCells(chair, levels).join() === ',1300,', 'export cells (blank where none)', levelCsvCells(chair, levels));

// Import: a file with level columns (as the export writes them), and a saved
// product that gets the level price it does not have yet.
const csv = [
  toCsvLine(['Name', 'Selling Price', 'GST %', 'Retail price', 'Wholesale price', 'Dealer price']),
  toCsvLine(['DiceCodes Pen', 20, 18, '', 16, 14]),
  toCsvLine(['DiceCodes Pad', 50, 18, 'abc', '', '']),
  toCsvLine(['DiceCodes Saved', 30, 18, '', 25, '']),
].join('\n');
const existing = [{ id: 'p1', name: 'DiceCodes Saved', sellingPrice: 30, taxPercent: 18, hsn: '9608', unit: 'Nos', description: 'x', stock: 1, purchasePrice: 10, levelPrices: { 3: 22 } }];
const r = productsCsvToList(csv, existing, levels);
ok(JSON.stringify(r.products[0]?.levelPrices) === '{"2":16,"3":14}', 'imported level prices', r.products[0]);
ok(r.errors.length === 1 && /Retail price must be a number/.test(r.errors[0]), 'a level price that is not a number is an error', r.errors);
ok(JSON.stringify(r.updates[0]?.levelPrices) === '{"2":25,"3":22}', 'a saved product gets the missing level price, keeps its own', r.updates[0]);
const off = productsCsvToList(csv, [], []);
ok(off.products.every((p) => !p.levelPrices) && off.errors.length === 0, 'with Price levels off the columns are ignored', off);
const byNumber = productsCsvToList([toCsvLine(['Name', 'Selling Price', 'Level 2 price']), toCsvLine(['DiceCodes Ink', 40, 35])].join('\n'), [], levels);
ok(byNumber.products[0]?.levelPrices?.['2'] === 35, '"Level 2 price" works too', byNumber.products[0]);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
