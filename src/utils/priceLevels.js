// v1.10.85 - price levels (Settings -> Features -> Price levels, off by
// default). The business names up to 3 levels (Retail, Wholesale, Dealer); a
// product can have a price for each, besides its selling price; a client can
// be given a level. On a new invoice, a product picked for that client takes
// its level price, or the selling price when it has none for that level.
//
// Levels are kept by number ('1' to '3'), so renaming one keeps every client
// and product price on it. Pure functions, tested by scripts/price-levels-test.mjs.

export const DEFAULT_LEVEL_NAMES = ['Retail', 'Wholesale', 'Dealer'];
export const MAX_LEVELS = 3;

// The levels in use: [{ id: '1', name: 'Retail' }, ...]; a blank name is a level not used.
export const priceLevelList = (names = DEFAULT_LEVEL_NAMES) => (Array.isArray(names) ? names : [])
  .slice(0, MAX_LEVELS)
  .map((n, i) => ({ id: String(i + 1), name: String(n ?? '').trim() }))
  .filter((l) => l.name);

// Three names, blanks as '' (what the Settings boxes edit and what is saved).
export const normaliseLevelNames = (names) => Array.from({ length: MAX_LEVELS },
  (_, i) => String((Array.isArray(names) ? names[i] : '') ?? '').trim().slice(0, 30));

const positive = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

// The selling price of a product, or its price for the client's level when
// it has one. `levelId` is '' when the client has no level or the feature is off.
export const priceForLevel = (product, levelId) => {
  const selling = product?.sellingPrice ?? product?.rate ?? 0;
  if (!levelId) return selling;
  return positive(product?.levelPrices?.[levelId]) ?? selling;
};

// The level prices to save on a product: only real prices, keyed '1'-'3'.
export const cleanLevelPrices = (prices) => {
  const out = {};
  for (let i = 1; i <= MAX_LEVELS; i++) {
    const p = positive(prices?.[String(i)]);
    if (p !== null) out[String(i)] = p;
  }
  return out;
};

// ---- Products CSV: one "<level name> price" column per level ----
export const levelCsvHeader = (level) => `${level.name} price`;
export const levelCsvHeaders = (levels) => levels.map(levelCsvHeader);
export const levelCsvCells = (product, levels) => levels.map((l) => positive(product?.levelPrices?.[l.id]) ?? '');

// Extra fields for rowsToRecords: "Wholesale price" or "Level 2 price".
export const levelCsvFields = (levels) => Object.fromEntries(levels.map((l) => [
  `level${l.id}`, [levelCsvHeader(l), `level ${l.id} price`, `price level ${l.id}`],
]));

// The level prices read from one CSV record; NaN for a value that is not a number.
export const levelPricesFromRecord = (record, levels, toNum) => {
  const out = {};
  for (const l of levels) {
    const raw = record[`level${l.id}`];
    if (raw === undefined || String(raw).trim() === '') continue;
    const n = toNum(raw);
    if (!Number.isFinite(n) || n < 0) return { error: `${l.name} price must be a number` };
    if (n > 0) out[l.id] = Math.round(n * 100) / 100;
  }
  return { prices: out };
};
