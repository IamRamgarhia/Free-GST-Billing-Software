// v1.10.84 (#140) - size billing for glass, mirror, flex and tile shops.
// A line can be sold by the square foot: Length x Width in inches, each
// rounded UP to the shop's step (3 or 6 inches; 0 = no rounding), times the
// pieces. The line's quantity IS the square feet, so every total, the GST,
// GSTR-1 (unit Sq.ft), stock and the reports work on it unchanged; the size
// and the pieces ride along in `item.size` for printing.
//
// item.size = { l, w, pcs, step, sqft, manual, amount }
//   l, w   inches; with both empty, `sqft` is the square feet typed directly
//   manual the amount is typed (size.amount): quantity stays the square feet,
//          rate = amount / sq.ft, so GSTR-1 and stock still count the area

export const SIZE_STEPS = [0, 3, 6];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const roundUpTo = (n, step) => {
  const v = Number(n) || 0;
  const s = Number(step) || 0;
  return s > 0 ? Math.ceil(v / s - 1e-9) * s : v;
};

const hasDims = (size) => String(size?.l ?? '').trim() !== '' || String(size?.w ?? '').trim() !== '';

// Square feet for a size, to 2 decimals (what is printed and billed).
export const sizeSqft = (size) => {
  if (!hasDims(size)) return round2(Math.max(0, Number(size?.sqft) || 0));
  const l = roundUpTo(size?.l, size?.step);
  const w = roundUpTo(size?.w, size?.step);
  const pcs = Math.max(0, Number(size?.pcs) || 0);
  return round2((l * w / 144) * pcs);
};

// The line after its size changed: quantity = square feet. A manual line
// keeps the amount typed: rate = amount / sq.ft (or quantity 1 while there are
// no square feet yet).
export const applySize = (item, size) => {
  const sqft = sizeSqft(size);
  if (!size.manual) return { ...item, size, unit: 'Sq.ft', quantity: sqft };
  const amount = Math.max(0, Number(size.amount) || 0);
  return sqft > 0
    ? { ...item, size, unit: 'Sq.ft', quantity: sqft, rate: amount / sqft }
    : { ...item, size, unit: 'Sq.ft', quantity: 1, rate: amount };
};

// A change to a size line's boxes. Ticking "Type amount" starts from the
// line's current amount; unticking keeps the rate per sq.ft it worked out, so
// the amount does not jump either way.
export const changeSize = (item, patch) => {
  const next = { ...item.size, ...patch };
  if (patch.manual === true && !item.size.manual) {
    next.amount = round2((Number(item.quantity) || 0) * (Number(item.rate) || 0));
  }
  return applySize(item, next);
};

// A line's unit changed (or a product was picked). With size billing on,
// Sq.ft makes it a size line that keeps its quantity as square feet until a
// size is typed; any other unit turns a size line back into a plain one (one
// piece per square foot is not assumed: the quantity becomes the pieces).
// NA (#143) has no quantity: held at 1.
export const itemWithUnit = (item, unit, opts = {}) => {
  const base = plainWithUnit(item, unit, opts);
  if (opts.sizeOn && unit === RFT_UNIT && !base.rft) return { ...base, rft: { basis: 'sqft', from: 'all', ids: [], custom: '' } };
  if (unit !== RFT_UNIT && base.rft) {
    const plain = { ...base };
    delete plain.rft;
    return plain;
  }
  return base;
};

const plainWithUnit = (item, unit, { sizeOn = false, step = 0 } = {}) => {
  if (sizeOn && unit === 'Sq.ft' && !item.size) {
    return applySize(item, { l: '', w: '', pcs: 1, step, sqft: Number(item.quantity) || 0 });
  }
  if (unit !== 'Sq.ft' && item.size) {
    const { size, ...plain } = item;
    const pcs = hasDims(size) ? Number(size.pcs) || 1 : Number(item.quantity) || 1;
    return { ...plain, unit, quantity: unit === 'NA' ? 1 : pcs };
  }
  return { ...item, unit, ...(unit === 'NA' ? { quantity: 1 } : {}) };
};

// "25 x 30" as printed in the Size column (the measured size, not rounded).
export const sizeLabel = (size) => (hasDims(size)
  ? `${Number(size.l) || 0} x ${Number(size.w) || 0}`
  : '');

// Pieces printed in the Qty column of a size line ('' when no size was typed).
export const sizePieces = (item) => (item?.size && hasDims(item.size) ? Number(item.size.pcs) || 0 : '');

// Whether the size boxes are filled (else the square feet are typed directly).
export const sizeHasDims = hasDims;

// The square feet printed in the SQFT column.
export const lineSqft = (item) => (item?.size ? sizeSqft(item.size) : null);

// v1.10.85 (#140) - RFT lines (polish, aluminium channel): the quantity comes
// from the size lines on the same invoice, either their square feet or their
// edges (2 x (rounded L + rounded W) / 12 x pieces, in running feet), for all
// of them, the ticked ones, or a value typed by hand. The quantity is stored
// like any line's, so totals, GST, GSTR-1 and old invoices are unchanged.
//
// item.rft = { basis: 'sqft' | 'perimeter', from: 'all' | 'selected' | 'custom', ids, custom }
export const RFT_UNIT = 'Rft';

export const perimeterRft = (size) => {
  if (!hasDims(size)) return 0;
  const l = roundUpTo(size?.l, size?.step);
  const w = roundUpTo(size?.w, size?.step);
  const pcs = Math.max(0, Number(size?.pcs) || 0);
  return round2((2 * (l + w) / 12) * pcs);
};

// The size lines an RFT line can be worked out from.
export const rftSources = (items) => (items || []).filter((i) => i.size && !i.rft);

export const rftQuantity = (rft, items) => {
  if (rft?.from === 'custom') return round2(Math.max(0, Number(rft.custom) || 0));
  const ids = rft?.from === 'selected' ? new Set(rft.ids || []) : null;
  const measure = rft?.basis === 'perimeter' ? perimeterRft : sizeSqft;
  return round2(rftSources(items)
    .filter((i) => !ids || ids.has(i.id))
    .reduce((sum, i) => sum + measure(i.size), 0));
};

// Every RFT line's quantity brought up to date; the same array when nothing
// moved, so it can run after every change without re-rendering for nothing.
export const withRftLines = (items) => {
  let changed = false;
  const next = (items || []).map((i) => {
    if (!i.rft) return i;
    const quantity = rftQuantity(i.rft, items);
    if (quantity === Number(i.quantity)) return i;
    changed = true;
    return { ...i, quantity };
  });
  return changed ? next : items;
};

// What an RFT line measures, for the printed Qty: "18.33 rft" or "12.5 sqft".
export const rftLabel = (item) => `${Number(item?.quantity) || 0} ${item?.rft?.basis === 'perimeter' ? 'rft' : 'sqft'}`;
